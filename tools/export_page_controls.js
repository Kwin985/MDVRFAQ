#!/usr/bin/env node
/**
 * 从网页版「配置参数生成工具」的真实 DOM 导出 45 个子页的控件定义。
 * 比解析压缩 JS 模板更准：字段名、控件类型、中文标签、下拉选项全部来自渲染结果。
 *
 * 输出 dist/tools/config-gen/controls.json，可合并进 APP 的 schema。
 * 用法: node tools/export_page_controls.js [--diagnose]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = require('D:/Web/WebP/node_modules/puppeteer-core');
}

const ROOT = path.dirname(__dirname);
const DIST = path.join(ROOT, 'dist');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EN = process.argv.includes('--en');
const OUT = path.join(DIST, EN ? 'tools/config-gen/controls.en.json' : 'tools/config-gen/controls.json');
const DIAGNOSE = process.argv.includes('--diagnose');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      let fp = path.join(DIST, rel);
      if (rel.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(DIST) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/** 在页面内提取「指定子页 section」的控件定义，避免抓到其它子页的隐藏 DOM。 */
function collectInPage(subId) {
  const sec = document.querySelector(`[data-sec="${subId}"]`);
  const root = sec || document.querySelector('#editor') || document;
  const out = [];
  const seen = new Set();
  // [data-k] 才是真正的输入元素；[data-fk] 只是部分控件的标签包裹，不能作为抓取依据
  root.querySelectorAll('[data-k]').forEach(el => {
    const key = el.getAttribute('data-k');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const tag = el.tagName ? el.tagName.toLowerCase() : 'input';
    let kind = 'text';
    let options = [];
    if (tag === 'select') {
      kind = 'select';
      options = [...el.options].map(o => ({ v: o.value, l: o.textContent.trim() }));
    } else if (tag === 'input' && el.type === 'checkbox') {
      kind = 'toggle';
    } else if (tag === 'input' && (el.type === 'number' || el.inputMode === 'numeric')) {
      kind = 'number';
    }
    let label = '';
    const wrap = el.closest('[data-fk]') || el.parentElement;
    const lab = wrap ? wrap.querySelector('label,span') : null;
    if (lab && lab !== el) label = (lab.textContent || '').trim();
    if (!label) {
      const tr = el.closest('tr');
      const td = el.closest('td');
      if (tr && td) {
        const ths = [...(tr.closest('table')?.querySelectorAll('thead th') || [])];
        const idx = [...tr.children].indexOf(td);
        if (idx >= 0 && ths[idx]) label = ths[idx].textContent.trim();
      }
    }
    if (!label) {
      const prev = el.previousElementSibling;
      if (prev && prev.children.length === 0) label = (prev.textContent || '').trim();
    }
    if (label.length > 40) label = label.slice(0, 40);
    out.push({ key, kind, label, options });
  });
  return out;
}

async function main() {
  const { srv, port } = await startServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`http://127.0.0.1:${port}${EN ? '/tools/config-gen/en/' : '/tools/config-gen/'}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    const probeArg = process.argv.find(a => a.startsWith('--probe='));
    if (probeArg) {
      const id = probeArg.split('=')[1];
      const schema0 = JSON.parse(fs.readFileSync(path.join(DIST, 'tools/config-gen/schema.json'), 'utf8'));
      let mod = 'basic';
      for (const m of schema0.modules) for (const s of m.subs) if (s.id === id) mod = m.key;
      await page.evaluate((id) => { window.__probeId = id; }, id);
      await page.evaluate((m, s) => {
        const mb = document.querySelector(`[data-mod="${m}"]:not([data-sub])`);
        if (mb) mb.click();
        const sb = document.querySelector(`[data-mod="${m}"][data-sub="${s}"]`);
        if (sb) sb.click();
      }, mod, id);
      await new Promise(r => setTimeout(r, 200));
      const info = await page.evaluate(() => ({
        sections: [...document.querySelectorAll('#editor [data-sec]')].map(e => ({
          sec: e.getAttribute('data-sec'), fk: e.querySelectorAll('[data-fk]').length,
          visible: e.getClientRects().length > 0,
        })),
        totalFk: document.querySelectorAll('#editor [data-fk]').length,
        secHtml: (document.querySelector(`#editor [data-sec="${window.__probeId}"]`) || {}).outerHTML?.slice(0, 1400) || '(no section)',
      }));
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    if (DIAGNOSE) {
      const info = await page.evaluate(() => {
        const nav = document.querySelector('#nav, .sidebar, [class*="nav"]');
        const clickable = [...document.querySelectorAll('[data-mod],[data-sub],[data-page],[data-key],button,a')]
          .slice(0, 30)
          .map(e => ({ tag: e.tagName, attrs: [...e.attributes].map(a => `${a.name}=${a.value}`).join(' ').slice(0, 120), text: (e.textContent || '').trim().slice(0, 20) }));
        const fks = [...document.querySelectorAll('[data-fk]')];
        return {
          title: document.title,
          clickable,
          fkCount: fks.length,
          fkVisible: fks.filter(e => e.getClientRects().length > 0).length,
          fkSamples: fks.slice(0, 3).map(e => e.outerHTML.slice(0, 500)),
          editorHtml: (document.querySelector('#editor') || document.body).outerHTML.slice(0, 400),
        };
      });
      console.log(JSON.stringify(info, null, 2));
      return;
    }
    const schemaPath = path.join(DIST, 'tools/config-gen/schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const results = [];
    let noButton = 0;
    for (const mod of schema.modules) {
      for (const sub of mod.subs) {
        const clicked = await page.evaluate((m, s) => {
          const modBtn = document.querySelector(`[data-mod="${m}"]:not([data-sub])`);
          if (modBtn) modBtn.click();
          const subBtn = document.querySelector(`[data-mod="${m}"][data-sub="${s}"]`);
          if (subBtn) { subBtn.click(); return true; }
          return false;
        }, mod.key, sub.id);
        if (!clicked) noButton++;
        await new Promise(r => setTimeout(r, 90));
        const controls = await page.evaluate(collectInPage, sub.id);
        results.push({ module: mod.key, id: sub.id, title: sub.label, controls });
      }
    }
    // 英文运行：逐个展开模块，收集模块名与子页名的英文文案
    const navPath = path.join(DIST, 'tools/config-gen/nav.en.json');
    if (EN) {
      const nav = await page.evaluate(() => {
        const out = { modules: {}, subs: {} };
        const modBtns = [...document.querySelectorAll('button[data-mod]:not([data-sub])')];
        for (const mb of modBtns) {
          const m = mb.getAttribute('data-mod');
          const sp = mb.querySelector('span.flex-1') || mb.querySelector('span');
          if (sp) out.modules[m] = (sp.textContent || '').trim();
          mb.click();
          document.querySelectorAll(`[data-mod="${m}"][data-sub]`).forEach(b => {
            out.subs[m + '/' + b.getAttribute('data-sub')] = (b.textContent || '').trim();
          });
        }
        return out;
      });
      fs.writeFileSync(navPath, JSON.stringify(nav, null, 1), 'utf8');
      for (const m of schema.modules) {
        if (nav.modules[m.key]) m.labelEn = nav.modules[m.key];
        for (const sub of m.subs) {
          const v = nav.subs[m.key + '/' + sub.id];
          if (v) sub.labelEn = v;
        }
      }
    } else if (fs.existsSync(navPath)) {
      const nav = JSON.parse(fs.readFileSync(navPath, 'utf8'));
      for (const m of schema.modules) {
        if (nav.modules[m.key]) m.labelEn = nav.modules[m.key];
        for (const sub of m.subs) {
          const v = nav.subs[m.key + '/' + sub.id];
          if (v) sub.labelEn = v;
        }
      }
    }

    fs.writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');

    // 中文运行：写回完整控件定义；英文运行：只补 labelEn，不动中文与其它字段
    const byId = new Map(results.map(r => [r.id, r]));
    for (const p of schema.pageFields) {
      const hit = byId.get(p.id);
      if (!EN) {
        // 全量覆盖：抓到 0 控件的页也要清空，避免多次运行累积出重复控件
        p.controls = hit ? hit.controls.map(c => ({
          key: c.key, label: c.label, labelEn: '', kind: c.kind, options: c.options,
        })) : [];
      } else {
        if (!hit || hit.controls.length === 0) continue;
        const enByKey = new Map(hit.controls.map(c => [c.key, c]));
        for (const c of p.controls) {
          const en = enByKey.get(c.key);
          if (!en) continue;
          if (en.label) c.labelEn = en.label;
          if (en.options && en.options.length > 0) c.optionsEn = en.options;
        }
      }
    }
    fs.writeFileSync(schemaPath, JSON.stringify(schema), 'utf8');

    const filled = results.filter(r => r.controls.length > 0).length;
    const total = results.reduce((n, r) => n + r.controls.length, 0);
    const kinds = {};
    for (const r of results) for (const c of r.controls) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
    const withLabel = results.reduce((n, r) => n + r.controls.filter(c => c.label).length, 0);
    console.log(`子页 ${results.length} | 有控件 ${filled} | 控件 ${total} | 导航缺失 ${noButton}`);
    console.log('类型分布:', JSON.stringify(kinds), '| 带中文标签:', withLabel);
    const empty = results.filter(r => r.controls.length === 0).map(r => r.id);
    console.log('仍为空的页:', JSON.stringify(empty));
    console.log('已写出:', OUT);
    console.log('已写回:', schemaPath);
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
