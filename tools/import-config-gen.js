#!/usr/bin/env node
/**
 * 同步上游「配置参数生成工具」到本站（/tools/config-gen/）
 *
 * 用法：
 *   node tools/import-config-gen.js                # 从上游 FQA 拉取
 *   node tools/import-config-gen.js --dir <目录>    # 用本地已下载的文件（含 html/css/js/mdvrconfig）
 *
 * 做的事：
 *   1. 下载 Configuration-generation-tool.html + mdvr-config.min.css/js + mdvrconfig/*.xml
 *   2. 改写资源路径为本站绝对路径（/tools/config-gen/...），去掉 pug2 外链
 *   3. 注入 SEO meta / favicon / 返回帮助中心 / 英文入口
 *   4. 写到 assets/ext-tools/config-gen/（build.js 会整体同步到 dist/tools/）
 *
 * 升级流程：上游改版后重跑本脚本 → node tools/build.js → 部署。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'ext-tools', 'config-gen');
const BASE = 'http://pug2.4000329988.com/fqa/web/tools';
const TMP = path.join(ROOT, '.workbuddy', 'tmp', 'config-gen-upstream');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='18' height='14' rx='2' fill='%232563eb'/%3E%3Cline x1='3' y1='9' x2='21' y2='9' stroke='white' stroke-width='1.5'/%3E%3Cline x1='9' y1='20' x2='15' y2='20' stroke='%232563eb' stroke-width='2'/%3E%3C/svg%3E";

const META = `  <title>配置参数生成工具 · 在线生成设备配置 / 在线命令 / 二维码 | MDVR FAQ</title>
  <meta name="description" content="MDVR 车载录像机配置参数在线生成工具：按模块填写参数，实时生成可下发的在线命令、config.xml 配置文件或配置二维码，支持导入配置反解析回填。">
  <link rel="canonical" href="https://mdvrfaq.com/tools/config-gen/">
  <meta name="theme-color" content="#103048">
  <link rel="icon" href="${FAVICON}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="配置参数生成工具 | MDVR FAQ">
  <meta property="og:description" content="按模块填写设备参数，实时生成在线命令 / config.xml / 配置二维码，支持配置反解析。">
  <meta property="og:url" content="https://mdvrfaq.com/tools/config-gen/">
`;

async function get(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

async function downloadAll() {
  fs.mkdirSync(TMP, { recursive: true });
  const jobs = [
    ['Configuration-generation-tool.html', 'config-gen.html'],
    ['../static/css/mdvr-config.min.css', 'mdvr-config.min.css'],
    ['../static/js/mdvr-config.min.js', 'mdvr-config.min.js'],
  ];
  for (const [remote, local] of jobs) {
    await get(`${BASE}/${remote}`, path.join(TMP, local));
    console.log(`   拉取 ${remote}`);
  }
  const xmls = ['M18EV', 'M20EV', 'M51HV', 'M93HV'];
  for (const m of xmls) {
    const name = `config - ${m}出厂配置.xml`;
    await get(`${BASE}/mdvrconfig/${encodeURIComponent(name)}`, path.join(TMP, 'mdvrconfig', name));
    console.log(`   拉取 mdvrconfig/${name}`);
  }
  return TMP;
}

function adaptHtml(src) {
  let h = src.replace(/^\uFEFF/, '');

  // 1. title / meta
  h = h.replace(/<title>[\s\S]*?<\/title>\s*/, META);
  if (!h.includes('配置参数生成工具 · 在线生成')) throw new Error('title 注入失败');

  // 2. 资源路径 -> 本站绝对路径
  h = h.replace(
    /<link rel="stylesheet" href="\.\.\/static\/css\/mdvr-config\.min\.css[^"]*">/,
    '<link rel="stylesheet" href="/tools/config-gen/css/mdvr-config.min.css?v=1">'
  );
  h = h.replace(
    /<script src="\.\.\/static\/js\/mdvr-config\.min\.js[^"]*"><\/script>/,
    '<script src="/tools/config-gen/js/mdvr-config.min.js?v=1"></script>'
  );
  if (h.includes('../static/')) throw new Error('仍有未改写的 ../static/ 引用');

  // 3. 扫码工具外链 -> 本站
  h = h.replace(
    /href="http:\/\/pug2\.4000329988\.com\/fqa\/web\/tools\/qrconfig-zh\.html"/,
    'href="/tools/qrconfig-zh.html"'
  );
  if (h.includes('pug2.4000329988.com')) throw new Error('仍有 pug2 外链');

  // 4. 左上角品牌区 -> 返回帮助中心（保持原布局，外层 div 直接换成 a）
  h = h.replace(
    '<div class="flex items-center gap-3" style="min-width:0">',
    '<a class="flex items-center gap-3" href="/zh/docs/" title="返回帮助中心" style="min-width:0;text-decoration:none;color:inherit">'
  );
  h = h.replace('</div>\n  <!-- ★ V1.29', '</a>\n  <!-- ★ V1.29');

  // 5. 右上角加英文入口
  h = h.replace(
    '<div class="flex items-center gap-2" style="justify-self:end">',
    '<div class="flex items-center gap-2" style="justify-self:end">\n    <a class="mini-btn" href="/tools/config-gen/en/" title="English guide" style="text-decoration:none">EN</a>'
  );

  // 6. noscript
  h = h.replace('<body>', '<body>\n<noscript><p style="padding:12px 20px;background:#fff7ed;color:#9a3412;font-size:13px">本工具需要启用 JavaScript。</p></noscript>');

  return h;
}

(async () => {
  const argIdx = process.argv.indexOf('--dir');
  const dir = argIdx > -1 ? path.resolve(process.argv[argIdx + 1]) : await downloadAll();

  fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'mdvrconfig'), { recursive: true });

  const html = fs.readFileSync(path.join(dir, 'config-gen.html'), 'utf8');
  fs.writeFileSync(path.join(OUT, 'index.html'), adaptHtml(html), 'utf8');
  fs.copyFileSync(path.join(dir, 'mdvr-config.min.css'), path.join(OUT, 'css', 'mdvr-config.min.css'));
  fs.copyFileSync(path.join(dir, 'mdvr-config.min.js'), path.join(OUT, 'js', 'mdvr-config.min.js'));
  for (const f of fs.readdirSync(path.join(dir, 'mdvrconfig'))) {
    fs.copyFileSync(path.join(dir, 'mdvrconfig', f), path.join(OUT, 'mdvrconfig', f));
  }

  // 提取版本号，方便核对上游是否更新
  const ver = (html.match(/class="text-sm font-semibold leading-tight">[^<]*<span[^>]*>V?([\d.]+)<\/span>/) || [])[1] || '?';
  console.log(`\n完成：assets/ext-tools/config-gen/  上游版本 V${ver}`);
  console.log('下一步：node tools/build.js');
})().catch((e) => {
  console.error('同步失败：', e.message);
  process.exit(1);
});
