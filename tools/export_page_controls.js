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

/**
 * 在页面内提取「指定子页 section」的控件定义，避免抓到其它子页的隐藏 DOM。
 *
 * 上游页面大量使用「表头列名 + 行头 + 分组标题」来表达重复参数：
 *   · 串口页：行头 RS232 / RS485，列名 串口功能 / 波特率…
 *   · 定时录像：行头 星期日 / 星期一，列名 时段1 开始…
 *   · 808 平台：h4 「第一个 808 配置」「第二个 808 配置」
 * 只取字段标签会得到一堆同名控件（8 个「串口功能」），所以这里把行头/分组一并带出，
 * APP 端按 group 分小节渲染。
 */
function collectInPage(subId, isEn) {
  const sec = document.querySelector(`[data-sec="${subId}"]`);
  const root = sec || document.querySelector('#editor') || document;
  const out = [];
  const seen = new Set();
  // BSD 的分区没有标题，只有 data-bsdzone 标记
  const BSD_ZONE = { f: '前盲区', l: '左盲区', r: '右盲区', b: '后盲区' };
  const normRowHead = (t) => {
    const m = /^TopicNum_(\d+)$/i.exec(t);
    return m ? `主题 ${Number(m[1]) + 1}` : t;
  };
  const groupOf = (el) => {
    const td = el.closest('td');
    const tr = el.closest('tr');
    const table = el.closest('table');
    if (tr && table) {
      const first = tr.children[0];
      if (first && first !== td && !first.querySelector('[data-k]')) {
        const t = (first.textContent || '').trim();
        if (t) {
          // 行头只有编号时（串口编号 1~5、通道 1~2），带上表头文字才看得懂
          if (/^\d+$/.test(t)) {
            const th0 = table.querySelector('thead th');
            const cap = th0 ? (th0.textContent || '').trim() : '';
            return cap ? `${cap} ${t}` : t;
          }
          return normRowHead(t);
        }
      }
    }
    let p = el.parentElement;
    while (p && p !== sec) {
      const h = p.querySelector(':scope > h4, :scope > legend, :scope > summary');
      if (h) {
        const t = (h.textContent || '').trim();
        if (t) return t;
      }
      const zone = p.getAttribute && p.getAttribute('data-bsdzone');
      if (zone) return BSD_ZONE[zone] || '';
      p = p.parentElement;
    }
    return '';
  };
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
    // <label class="inl-chk"><input data-k=…>开启xx</label>：标签就是包裹元素自身的文字
    if (!label && wrap && wrap.tagName && wrap.tagName.toLowerCase() === 'label') {
      label = (wrap.textContent || '').trim();
    }
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
    // 上游输入框预填了设备默认值（数据位 8、停止位 1、各类阈值…），
    // APP 需要把它当作「当前值」显示，否则用户看到的是空框，根本不知道默认是多少。
    let dv = '';
    if (tag === 'input' && el.type === 'checkbox') {
      dv = el.checked ? '1' : '0';
    } else if (tag === 'select' || tag === 'input' || tag === 'textarea') {
      dv = el.value === undefined || el.value === null ? '' : String(el.value);
      // 上游把默认值放在 placeholder 上（数据位 8、停止位 1…），value 是空的。
      // 只接受短、纯 ASCII 的 placeholder，避免把「如 139.9.251.220」这类提示当成默认值。
      const ph = el.getAttribute ? (el.getAttribute('placeholder') || '') : '';
      if (!dv && ph && ph.length <= 12 && !/[\u4e00-\u9fa5\s]/.test(ph)) {
        dv = ph;
      }
    }
    out.push({ key, kind, label, options, dv, group: groupOf(el) });
  });
  // 同一页里标签重名且没有分组的（如「录像保存天数」的开关与天数），给开关补一个后缀，
  // 否则列表里会出现两个完全一样的行。
  const count = new Map();
  for (const c of out) count.set(c.label, (count.get(c.label) || 0) + 1);
  for (const c of out) {
    if (count.get(c.label) > 1 && !c.group && c.kind === 'toggle' && c.label) {
      c.label = c.label + (isEn ? ' (switch)' : ' (开关)');
    }
  }
  // 夏令时的 4 个「开始」「结束」下拉在 DOM 里没有行头/分组，只能靠字段名尾词区分
  // （…FromMon / …FromDay / …FromWeekday / …FromHour）。把公共部分提成小节标题，
  // 尾词翻成「月 / 日 / 星期 / 时」，列表才不会出现 4 行一模一样的「开始」。
  const SUFFIX = {
    Mon: ['月', 'Month'], Month: ['月', 'Month'], Day: ['日', 'Day'],
    Weekday: ['星期', 'Weekday'], Hour: ['时', 'Hour'],
    Min: ['分', 'Minute'], Minute: ['分', 'Minute'], Sec: ['秒', 'Second'],
  };
  for (const c of out) {
    if (count.get(c.label) > 1 && !c.group) {
      const tail = (c.key.split('_').pop() || '').match(/[A-Z][a-z]+$/);
      const w = tail && SUFFIX[tail[0]];
      if (w) {
        c.group = c.label;
        c.label = isEn ? w[1] : w[0];
      }
    }
  }
  // ---- 通道级「虚拟控件」----
  // 上游有 5 个子页用的是 data-vt / data-mir / data-chnname / data-gbchn，
  // 没有 data-k，所以上面的循环抓不到。这些控件在网页版里对应虚拟字段
  // （__res_0、__mir_ud_0…），生成 XML 时展开成嵌套节点或位掩码：
  //   __res_N      -> stMainStream/stVideoPara/VChn_N @ ucFD_Resolution
  //   __fps_N      -> … @ ucFD_FrameRate        __br_N -> … @ uiFD_BitRate
  //   __aud_N      -> … @ uiFD_DisableAudio     __vid_N -> … @ uiFD_DisableVideo（值反转）
  //   __mir_ud_N   -> stVideoMirror/stVideoMirrorPara/VChn_N @ ucFD_UpDown
  //   __mir_lr_N   -> … @ ucFD_LeftRight
  //   __chnname_N  -> stChnOSD/stChnOSDPara/VChn_N @ strFD_ChnName
  //   __gb_chn_N   -> stGB28181/stGB28181SubID/SUBDEVID_N @ strFD_LensId
  //   __cam_N      -> stMainStream @ uiFD_VideoFmt（每通道 4bit 位掩码）
  //   __pal_N      -> stMainStream @ uiFD_VideoMode（每通道 1bit 位掩码）
  // 规则取自上游 mdvr-config.min.js 的 XML 生成段，已用真实输出逐条比对。
  const VIRT = {
    cam: { k: '__cam_', maskField: 'uiFD_VideoFmt', maskShift: 4, maskBits: 15, def: ['分辨率(摄像头)', 'Camera resolution'] },
    enc: { k: '__res_', path: 'stMainStream/stVideoPara/VChn_', attr: 'ucFD_Resolution', def: ['分辨率(编码)', 'Encode resolution'] },
    fps: { k: '__fps_', path: 'stMainStream/stVideoPara/VChn_', attr: 'ucFD_FrameRate', def: ['帧率', 'Frame rate'] },
    br: { k: '__br_', path: 'stMainStream/stVideoPara/VChn_', attr: 'uiFD_BitRate', def: ['码率', 'Bitrate'] },
    audio: { k: '__aud_', path: 'stMainStream/stVideoPara/VChn_', attr: 'uiFD_DisableAudio', invert: true, def: ['音频', 'Audio'] },
    video: { k: '__vid_', path: 'stMainStream/stVideoPara/VChn_', attr: 'uiFD_DisableVideo', invert: true, def: ['视频', 'Video'] },
    pal: { k: '__pal_', maskField: 'uiFD_VideoMode', maskShift: 1, maskBits: 1, def: ['通道制式', 'Channel format'] },
    ud: { k: '__mir_ud_', path: 'stVideoMirror/stVideoMirrorPara/VChn_', attr: 'ucFD_UpDown', def: ['上下镜像', 'Flip vertical'] },
    lr: { k: '__mir_lr_', path: 'stVideoMirror/stVideoMirrorPara/VChn_', attr: 'ucFD_LeftRight', def: ['左右镜像', 'Flip horizontal'] },
    chnname: { k: '__chnname_', path: 'stChnOSD/stChnOSDPara/VChn_', attr: 'strFD_ChnName', def: ['通道名称', 'Channel name'] },
    gbchn: { k: '__gb_chn_', path: 'stGB28181/stGB28181SubID/SUBDEVID_', attr: 'strFD_LensId', def: ['通道编码 ID', 'Channel device ID'] },
  };
  const virtualLabel = (el, def) => {
    // 主码流表：列名在 td[data-label]；镜像表：行名在 tr 首格；其余用内置双语名
    const td = el.closest('td');
    const tr = el.closest('tr');
    const col = td ? (td.getAttribute('data-label') || '').trim() : '';
    const row = tr && tr.children[0] ? (tr.children[0].textContent || '').trim() : '';
    if (col && !/^\d+$/.test(col) && !/^CH\d+$/.test(col)) return col.slice(0, 40);
    if (row && !/^\d+$/.test(row) && !/^PAL|NTSC/.test(row)) return row.slice(0, 40);
    return def[isEn ? 1 : 0];
  };
  root.querySelectorAll('[data-vt],[data-mir],[data-chnname],[data-gbchn]').forEach(el => {
    const vt = el.getAttribute('data-vt');
    const mir = el.getAttribute('data-mir');
    const kind = vt || mir || (el.hasAttribute('data-chnname') ? 'chnname' : 'gbchn');
    const spec = VIRT[kind];
    if (!spec) return;
    const ch = el.getAttribute('data-ch') || el.getAttribute('data-chnname') || el.getAttribute('data-gbchn');
    if (ch === null || ch === undefined || !/^\d+$/.test(ch)) return;
    const key = spec.k + ch;
    if (seen.has(key)) return;
    seen.add(key);
    const tag = el.tagName ? el.tagName.toLowerCase() : 'input';
    let ck = 'text';
    let options = [];
    let dv = '';
    if (tag === 'select') {
      ck = 'select';
      options = [...el.options].map(o => ({ v: o.value, l: o.textContent.trim() }));
      dv = el.value === undefined || el.value === null ? '' : String(el.value);
    } else if (tag === 'input' && el.type === 'checkbox') {
      ck = 'toggle';
      dv = el.checked ? '1' : '0';
    } else {
      dv = el.value === undefined || el.value === null ? '' : String(el.value);
    }
    const c = {
      key, kind: ck, label: virtualLabel(el, spec.def), options, dv,
      group: '', groupEn: '', channel: Number(ch),
    };
    if (spec.path) {
      c.xmlPath = spec.path + ch;
      c.xmlAttr = spec.attr;
      if (spec.invert) c.invert = true;
    } else if (spec.maskField) {
      c.maskField = spec.maskField;
      c.maskShift = spec.maskShift * Number(ch);
      c.maskBits = spec.maskBits;
    }
    out.push(c);
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
        await new Promise(r => setTimeout(r, 180));
        const controls = await page.evaluate(collectInPage, sub.id, EN);
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
        p.controls = hit ? hit.controls.map(c => {
          // 通道级虚拟控件带的 XML 映射元数据也要原样带到 APP（ArkTS 侧有对应可选字段）
          const o = {
            key: c.key, label: c.label, labelEn: '', kind: c.kind, options: c.options,
            dv: c.dv, group: c.group, groupEn: '',
          };
          if (c.channel !== undefined) o.channel = c.channel;
          if (c.xmlPath) { o.xmlPath = c.xmlPath; o.xmlAttr = c.xmlAttr; }
          if (c.invert) o.invert = true;
          if (c.maskField) {
            o.maskField = c.maskField; o.maskShift = c.maskShift; o.maskBits = c.maskBits;
          }
          return o;
        }) : [];
      } else {
        if (!hit || hit.controls.length === 0) continue;
        const enByKey = new Map(hit.controls.map(c => [c.key, c]));
        for (const c of p.controls) {
          const en = enByKey.get(c.key);
          if (!en) continue;
          if (en.label) c.labelEn = en.label;
          if (en.options && en.options.length > 0) c.optionsEn = en.options;
          if (en.group) c.groupEn = en.group;
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
