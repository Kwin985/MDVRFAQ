#!/usr/bin/env node
'use strict';
/**
 * 由中文版工具生成英文版（只改字符串文案，不改任何逻辑）。
 *
 *   node tools/build-config-gen-en.js            # 生成 mdvr-config.en.min.js + en/index.html
 *   node tools/build-config-gen-en.js --report   # 只报告，不写文件
 *
 * 词库：tools/config-gen-en/*.json（键 = 中文片段，值 = 英文）
 * 页面：tools/config-gen-en/page.json（整串替换规则，用于 HTML 骨架）
 *
 * 安全约束（全部为硬校验，任一失败即中止）：
 *   1. 中文字符必须 100% 落在字符串字面量内（acorn 词法定位，逐个替换）；
 *   2. 译文不得含裸引号 / 反斜杠（允许 \n \" 这类既有转义）；
 *   3. 生成结果与源文件的 token 序列必须完全一致；
 *   4. 生成结果必须能通过 acorn 语法解析。
 */
const fs = require('fs');
const path = require('path');
const acorn = require('./vendor/acorn.js');
const { mapLiterals, cjkOutsideLiterals, sameStructure } = require('./lib/literals.js');
const { decode, encode } = require('./lib/cfgtable.js');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets/ext-tools/config-gen');
const SRC_JS = path.join(SRC_DIR, 'js/mdvr-config.min.js');
const OUT_JS = path.join(SRC_DIR, 'js/mdvr-config.en.min.js');
const SRC_HTML = path.join(SRC_DIR, 'index.html');
const OUT_HTML = path.join(SRC_DIR, 'en/index.html');
const DICT_DIR = path.join(ROOT, 'tools/config-gen-en');

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff01-\uff60]/;
const PUNCT = new Set(['，', '。', '；', '：', '、', '（', '）', '「', '」', '　']);

/** 译文不得引入裸引号/反斜杠（允许源串已有的 \\n \\" 转义） */
function badValue(v, zh = '') {
  // 允许复现原文已有的引号（说明该字面量本来就不是用这种引号包裹的）
  const allowed = new Set(['"', "'", '`'].filter((q) => zh.includes(q)));
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '\\') {
      const n = v[i + 1];
      if (n && 'nrt"\'`\\'.includes(n)) { i++; continue; }
      return `反斜杠转义不合法：\\${n || ''}`;
    }
    if ((c === '"' || c === "'" || c === '`') && !allowed.has(c)) return `含引号 ${c}`;
  }
  return null;
}

function loadDict() {
  const files = fs.readdirSync(DICT_DIR).filter((f) => f.endsWith('.json') && f !== 'page.json').sort();
  const dict = new Map();
  const conflicts = [];
  for (const f of files) {
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(path.join(DICT_DIR, f), 'utf8'));
    } catch (e) {
      throw new Error(`${f} 不是合法 JSON：${e.message}`);
    }
    for (const [zh, en] of Object.entries(obj)) {
      if (!zh) continue;
      if (typeof en !== 'string') throw new Error(`${f}: ${zh} 的值不是字符串`);
      const bad = badValue(en, zh);
      if (bad) throw new Error(`${f}: 「${zh}」译文有问题（${bad}），会破坏字面量 -> ${en}`);
      if (dict.has(zh) && dict.get(zh) !== en) conflicts.push(`${zh}\n   ${dict.get(zh)}\n   ${en}  <- ${f}`);
      dict.set(zh, en);
    }
  }
  if (conflicts.length) {
    console.error('词库存在同一原文的多种译法（请只保留一种）：\n' + conflicts.join('\n'));
    process.exit(1);
  }
  return [...dict.entries()].sort((a, b) => b[0].length - a[0].length);
}

function translateText(text, entries) {
  let out = text;
  for (const [zh, en] of entries) {
    if (out.indexOf(zh) < 0) continue;
    // 单字只允许标点全局替换，或整串精确匹配（避免「时」「天」「第」误伤句子）
    if (zh.length < 2 && !PUNCT.has(zh) && out !== zh) continue;
    out = out.split(zh).join(en);
  }
  return out;
}

function reportLeftovers(src, label) {
  const runs = new Map();
  mapLiterals(src, (text) => {
    if (!CJK.test(text)) return text;
    const re = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff01-\uff60]+/g;
    let m;
    while ((m = re.exec(text))) {
      if (!runs.has(m[0])) {
        const s = Math.max(0, m.index - 14), e = Math.min(text.length, m.index + m[0].length + 14);
        runs.set(m[0], text.slice(s, e).replace(/\s+/g, ' ').trim());
      }
    }
    return text;
  });
  if (!runs.size) {
    console.log(`  ${label}: 0 条未翻译`);
    return 0;
  }
  console.log(`  ${label}: ${runs.size} 个中文片段未翻译`);
  let n = 0;
  for (const [k, ctx] of runs) {
    if (n++ >= 60) { console.log(`    … 其余 ${runs.size - 60} 个省略`); break; }
    console.log(`    · ${JSON.stringify(k)}  <=  ${ctx}`);
  }
  return runs.size;
}

function main() {
  const entries = loadDict();
  const exact = new Map(Object.entries(JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'chunks.json'), 'utf8'))));
  for (const [zh, en] of exact) {
    const bad = badValue(en, zh);
    if (bad) throw new Error(`chunks.json: 「${zh}」译文有问题（${bad}）`);
  }
  console.log(`词库 ${entries.length} 条 + 整串译文 ${exact.size} 条`);

  const js = fs.readFileSync(SRC_JS, 'utf8');
  const cover = cjkOutsideLiterals(js);
  if (cover.outside !== 0) throw new Error(`源文件有 ${cover.outside} 个中文字符在字符串之外，无法安全替换`);
  console.log(`中文覆盖检查：${cover.total} 个中文字符全部位于字符串内`);

  const dictMap = new Map(entries);
  let hitExact = 0;
  const enJsRaw = mapLiterals(js, (t) => {
    if (exact.has(t)) { hitExact++; return exact.get(t); }
    return CJK.test(t) ? translateText(t, entries) : t;
  });
  console.log(`整串命中 ${hitExact} 处`);

  // 内嵌数据表（base64 -> RC4 流 -> raw deflate -> JSON）里的中文也要翻
  const translateBlobs = (src) =>
    src.replace(/"([A-Za-z0-9+/=]{120,})"/g, (whole, b64) => {
      let data;
      try { data = decode(b64); } catch { return whole; }
      const walk = (v) => {
        if (typeof v === 'string') {
          if (!CJK.test(v)) return v;
          return exact.get(v) || dictMap.get(v) || translateText(v, entries);
        }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === 'object') {
          const o = {};
          for (const k of Object.keys(v)) o[k] = walk(v[k]);
          return o;
        }
        return v;
      };
      const out = walk(data);
      if (JSON.stringify(out) === JSON.stringify(data)) return whole;
      const enc = encode(out);
      if (JSON.stringify(decode(enc)) !== JSON.stringify(out)) throw new Error('内嵌数据表重新编码后自检失败');
      return '"' + enc + '"';
    });

  const enJs = translateBlobs(enJsRaw);
  let blobCjk = 0;
  enJs.replace(/"([A-Za-z0-9+/=]{120,})"/g, (whole, b64) => {
    try { blobCjk += (JSON.stringify(decode(b64)).match(/[\u4e00-\u9fff]/g) || []).length; } catch { /* 非数据表 */ }
    return whole;
  });
  console.log(`内嵌数据表残留中文字符: ${blobCjk}`);

  const diff = sameStructure(js, enJs);
  if (diff) throw new Error('结构校验失败：' + diff);
  acorn.parse(enJs, { ecmaVersion: 'latest' });
  console.log('结构校验：token 序列一致，语法解析通过');

  const reportOnly = process.argv.includes('--report');
  if (!reportOnly) {
    fs.writeFileSync(OUT_JS, enJs, 'utf8');
    console.log(`写入 ${path.relative(ROOT, OUT_JS)}  ${js.length} -> ${enJs.length} 字节`);
  }

  console.log('未翻译检查：');
  const leftJs = reportLeftovers(enJs, 'en JS');

  // HTML：页面级整串替换，避免逐词替换拆碎句子
  const html = fs.readFileSync(SRC_HTML, 'utf8');
  const pageRules = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'page.json'), 'utf8'));
  let enHtml = html;
  const missing = [];
  for (const [from, to] of pageRules) {
    if (enHtml.indexOf(from) < 0) { missing.push(from); continue; }
    enHtml = enHtml.split(from).join(to);
  }
  enHtml = enHtml.replace(/<!--[\s\S]*?-->/g, '');
  if (!reportOnly) {
    fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
    fs.writeFileSync(OUT_HTML, enHtml, 'utf8');
    console.log(`写入 ${path.relative(ROOT, OUT_HTML)}`);
  }
  if (missing.length) {
    console.log(`  ⚠ 页面规则未命中 ${missing.length} 条（上游可能已改版）：`);
    missing.slice(0, 20).forEach((m) => console.log('    · ' + JSON.stringify(m.slice(0, 90))));
  }
  const leftHtml = (enHtml.match(new RegExp(CJK.source, 'g')) || []).length;
  console.log(`  en HTML 残留中文字符: ${leftHtml}`);

  if (leftJs || leftHtml || blobCjk || missing.length) process.exitCode = 2;
}

main();
