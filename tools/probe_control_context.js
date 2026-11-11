#!/usr/bin/env node
/**
 * 诊断：打印指定子页每个 [data-k] 的上下文（列名 / 行头 / 分组标题 / 容器类名）。
 * 用来设计「重复标签消歧」规则，不做导出。
 * 用法: node tools/probe_control_context.js serial,timing,ioin,p808,wifi
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
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

function probe(subId) {
  const sec = document.querySelector(`[data-sec="${subId}"]`);
  if (!sec) return { error: 'no section' };
  const rows = [];
  sec.querySelectorAll('[data-k]').forEach(el => {
    const key = el.getAttribute('data-k');
    const tr = el.closest('tr');
    let table = el.closest('table');
    let colName = '';
    let rowHead = '';
    if (tr && table) {
      const ths = [...table.querySelectorAll('thead th')];
      const td = el.closest('td');
      const idx = td ? [...tr.children].indexOf(td) : -1;
      if (idx >= 0 && ths[idx]) colName = (ths[idx].textContent || '').trim();
      const first = tr.children[0];
      if (first && first !== td && !first.querySelector('[data-k]')) rowHead = (first.textContent || '').trim();
    }
    // 最近的分组标题（h4 / legend / .group-box 的标题 / summary）
    let groupTitle = '';
    let p = el.parentElement;
    while (p && p !== sec) {
      const h = p.querySelector(':scope > h4, :scope > legend, :scope > .group-title, :scope > summary');
      if (h) { groupTitle = (h.textContent || '').trim(); break; }
      p = p.parentElement;
    }
    const wrap = el.closest('[data-fk]');
    const lab = wrap ? wrap.querySelector('label,span') : null;
    rows.push({
      key, tag: el.tagName.toLowerCase(), colName, rowHead, groupTitle,
      fkLabel: lab ? (lab.textContent || '').trim() : '',
      wrapClass: wrap ? wrap.className : '',
      parentClass: el.parentElement ? el.parentElement.className : '',
    });
  });
  return { sec: subId, headHtml: sec.querySelector('.sec-body')?.firstElementChild?.outerHTML.slice(0, 260) || '', rows };
}

async function main() {
  const ids = (process.argv[2] || 'serial').split(',');
  const { srv, port } = await startServer();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/config-gen/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const schema = JSON.parse(fs.readFileSync(path.join(DIST, 'tools/config-gen/schema.json'), 'utf8'));
    const modOf = {};
    for (const m of schema.modules) for (const s of m.subs) modOf[s.id] = m.key;
    for (const id of ids) {
      await page.evaluate((m, s) => {
        const mb = document.querySelector(`[data-mod="${m}"]:not([data-sub])`);
        if (mb) mb.click();
        const sb = document.querySelector(`[data-mod="${m}"][data-sub="${s}"]`);
        if (sb) sb.click();
      }, modOf[id], id);
      await new Promise(r => setTimeout(r, 150));
      const info = await page.evaluate(probe, id);
      console.log('\n===== ' + id + ' =====');
      console.log(info.headHtml || '');
      const uniq = [];
      for (const r of info.rows || []) {
        const sig = [r.colName, r.rowHead, r.groupTitle, r.fkLabel, r.wrapClass, r.parentClass].join(' | ');
        if (!uniq.some(u => u.sig === sig)) uniq.push({ sig, sample: r.key });
      }
      uniq.slice(0, 12).forEach(u => console.log('  ' + u.sig + '   <- ' + u.sample));
      console.log('  total controls:', (info.rows || []).length);
    }
  } finally {
    await browser.close();
    srv.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
