#!/usr/bin/env node
/**
 * 从上游「配置参数生成工具」导出参数字典，供独立 HarmonyOS APP 作为资源使用。
 *
 * 输出 schema.json：
 *   modules    9 模块 / 45 子页导航树（key/label/short/subs）
 *   fieldMap   826 个参数字段 -> XML 节点归属（解密表 3）
 *   fieldAttrs 193 个字段属性列表（解密表 2）
 *   nodeGroups 36 个分组节点定义（解密表 1）
 *   calib      7 条 ADAS 标定参数（解密表 4）
 *   fields     从渲染模板提取的全部 data-k 字段名（保序去重）
 *
 * 用法: node tools/export_config_schema.js [--out <path>]
 * 上游升级后重跑本脚本，APP 与网页版即共享同一份参数真相源。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.dirname(__dirname);
const SRC = path.join(ROOT, 'dist/tools/config-gen/js/mdvr-config.min.js');
const KEY = [158, 55, 66, 193, 8, 109, 243, 90, 33, 188, 116, 224, 21, 168, 111, 210];

function keystream(len) {
  const k = [];
  for (let t = 0; t < 24; t++) {
    k.push(255 & ((KEY[t % KEY.length] ^ ((1370997737 >> (8 * (3 & t))) & 255)) ^ ((37 * t + 11) & 255)));
  }
  const g = new Array(256);
  for (let i = 0; i < 256; i++) g[i] = i;
  let b = 0;
  for (let d = 0; d < 256; d++) {
    b = (b + g[d] + k[d % k.length]) & 255;
    const m = g[d]; g[d] = g[b]; g[b] = m;
  }
  let d = 0; b = 0;
  const out = Buffer.alloc(len);
  for (let D = 0; D < len; D++) {
    d = (d + 1) & 255; b = (b + g[d]) & 255;
    const m = g[d]; g[d] = g[b]; g[b] = m;
    out[D] = g[(g[d] + g[b]) & 255];
  }
  return out;
}

function decode(b64) {
  const raw = Buffer.from(b64, 'base64');
  const ks = keystream(raw.length);
  for (let i = 0; i < raw.length; i++) raw[i] ^= ks[i];
  return JSON.parse(zlib.inflateRawSync(raw).toString('utf8'));
}

/**
 * 按 k("id","title","desc",...) 把 45 个子页模板切段，提取各页绑定的参数字段。
 * 绑定形式：p("字段")、data-k="字段"，以及带中文标签的 x/y("标签","字段",...)。
 * 说明：多通道动态字段（如 AIn_0 / AlarmIO_10）由 fieldAttrs 表覆盖，模板里不出现。
 */
function extractPageFields(s) {
  const marks = [...s.matchAll(/\bk\("([a-z0-9_]+)","([^"]{1,30})","([^"]{0,80})",/g)]
    .map(m => ({ pos: m.index, id: m[1], title: m[2], desc: m[3] }));
  return marks.map((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].pos : s.length;
    const seg = s.slice(mk.pos, Math.min(end, mk.pos + 6000));
    const map = new Map();
    for (const m of seg.matchAll(/\b[xy]\("([^"]{1,24})","([\w]+)"/g)) {
      if (!map.has(m[2])) map.set(m[2], m[1]);
    }
    for (const m of seg.matchAll(/\bp\("([\w]+)"\)|data-k="([\w]+)"/g)) {
      const k = m[1] || m[2];
      if (!map.has(k)) map.set(k, '');
    }
    return {
      id: mk.id, title: mk.title, desc: mk.desc,
      controls: [...map.entries()].map(([key, label]) => ({ key, label })),
    };
  });
}

function extractModules(s) {
  const re = /\{key:"(\w+)",label:"([^"]+)",short:"([^"]+)",icon:[^,]+,subs:\[(.*?)\]\}/gs;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const subs = [];
    const subRe = /\{id:"([^"]+)",label:"([^"]+)"\}/g;
    let sm;
    while ((sm = subRe.exec(m[4])) !== null) subs.push({ id: sm[1], label: sm[2] });
    out.push({ key: m[1], label: m[2], short: m[3], subs });
  }
  return out;
}

function main() {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1]
    : path.join(ROOT, 'dist/tools/config-gen/schema.json');
  const s = fs.readFileSync(SRC, 'utf8');

  const tables = [...s.matchAll(/['"]([A-Za-z0-9+/=]{120,})['"]/g)]
    .map(x => x[1]).filter((v, i, a) => a.indexOf(v) === i);
  if (tables.length !== 4) throw new Error('期望 4 个加密数据表，实际 ' + tables.length);
  const decoded = tables.map(decode);

  // 按结构识别 4 张表，避免依赖顺序
  const nodeGroups = decoded.find(o => Array.isArray(o) && o[0] && o[0].node);
  const calib = decoded.find(o => Array.isArray(o) && o[0] && o[0].attr);
  const objTables = decoded.filter(o => !Array.isArray(o));
  const fieldMap = objTables.reduce((a, b) => (Object.keys(a).length > Object.keys(b).length ? a : b));
  const fieldAttrs = objTables.reduce((a, b) => (Object.keys(a).length < Object.keys(b).length ? a : b));

  const fields = [];
  const seen = new Set();
  for (const m of s.matchAll(/data-k="([^"]+)"/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); fields.push(m[1]); }
  }

  const modules = extractModules(s);
  const subCount = modules.reduce((n, m) => n + m.subs.length, 0);
  if (modules.length !== 9 || subCount !== 45) {
    throw new Error(`模块树异常: ${modules.length} 模块 / ${subCount} 子页（期望 9/45）`);
  }
  const pageFields = extractPageFields(s);
  if (pageFields.length !== 45) {
    throw new Error(`子页字段提取异常: ${pageFields.length} 页（期望 45）`);
  }

  const schema = {
    source: 'Configuration-generation-tool V1.81',
    generatedAt: new Date().toISOString(),
    modules, pageFields,
    fieldMap, fieldAttrs, nodeGroups, calib, fields,
  };

  // 保留 DOM 精化结果：export_page_controls.js 产出的控件定义与双语标签。
  // 这样上游升级后单跑本脚本也不会退回「只有字段名」的初稿。
  const dir = path.dirname(outPath);
  const zhPath = path.join(dir, 'controls.json');
  const enPath = path.join(dir, 'controls.en.json');
  if (fs.existsSync(zhPath)) {
    const byId = new Map(JSON.parse(fs.readFileSync(zhPath, 'utf8')).map(r => [r.id, r]));
    for (const p of schema.pageFields) {
      const hit = byId.get(p.id);
      if (hit) {
        p.controls = hit.controls.map(c => ({
          key: c.key, label: c.label, labelEn: '', kind: c.kind, options: c.options,
        }));
      }
    }
    if (fs.existsSync(enPath)) {
      const enById = new Map(JSON.parse(fs.readFileSync(enPath, 'utf8')).map(r => [r.id, r]));
      for (const p of schema.pageFields) {
        const hit = enById.get(p.id);
        if (!hit) continue;
        const enMap = new Map(hit.controls.map(c => [c.key, c.label]));
        for (const c of p.controls) {
          const en = enMap.get(c.key);
          if (en) c.labelEn = en;
        }
      }
    }
    console.log('  已合并 DOM 精化控件与双语标签');
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(schema), 'utf8');
  console.log('导出:', outPath);
  console.log(`  模块 ${modules.length} / 子页 ${subCount}`);
  console.log(`  字段映射 ${Object.keys(fieldMap).length} | 字段属性 ${Object.keys(fieldAttrs).length}`);
  console.log(`  分组节点 ${Array.isArray(nodeGroups) ? nodeGroups.length : 0} | 标定 ${Array.isArray(calib) ? calib.length : 0}`);
  const withFields = pageFields.filter(p => p.controls.length > 0).length;
  const ctrlTotal = pageFields.reduce((n, p) => n + p.controls.length, 0);
  console.log(`  子页字段 ${pageFields.length} 页（有字段 ${withFields} 页）/ 控件 ${ctrlTotal} 项`);
  console.log(`  模板字段 ${fields.length} | 文件 ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

main();
