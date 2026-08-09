const fs = require('fs');
const path = require('path');

// 加载 marked (UMD)
let marked;
try {
  marked = require('D:/Web/MdvrFAQ/dist/assets/js/vendor/marked.min.js');
} catch (e) {
  // 退路：用 vm 执行并提取全局
  const vm = require('vm');
  const code = fs.readFileSync('D:/Web/MdvrFAQ/dist/assets/js/vendor/marked.min.js', 'utf-8');
  const sandbox = { module: { exports: {} }, exports: {}, window: {}, self: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  marked = sandbox.module.exports.marked || sandbox.marked || sandbox.module.exports;
}
if (!marked || !marked.parse) {
  console.error('marked 加载失败');
  process.exit(1);
}

marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });

const data = JSON.parse(fs.readFileSync('D:/Web/MdvrFAQ/dist/content.json', 'utf-8'));

console.log('=== 视频页面 (page 28) 解析 ===');
const vp = data.pages['28'];
const vHtml = marked.parse(vp.content);
console.log(vHtml);
console.log('包含 <video 标签:', vHtml.includes('<video'));
console.log();

console.log('=== 图文页面解析 ===');
let imgPage = null;
for (const [id, p] of Object.entries(data.pages)) {
  if (p.content.includes('![](') && p.section === 'zh_docs') { imgPage = { id, p }; break; }
}
if (imgPage) {
  const iHtml = marked.parse(imgPage.p.content);
  console.log('页面', imgPage.id, imgPage.p.title);
  console.log('包含 <img 标签:', iHtml.includes('<img'));
  console.log(iHtml.substring(0, 600));
}

console.log();
console.log('=== 语言切换匹配测试 ===');
// 模拟 toggleLanguage 的匹配逻辑
function getOrderedPages(section) {
  const nav = data.nav[section];
  const pages = [];
  if (nav.top_pages) pages.push(...nav.top_pages);
  function addCatalogs(catalogs) {
    for (const cat of catalogs) {
      pages.push(...cat.pages);
      if (cat.subcatalogs) addCatalogs(cat.subcatalogs);
    }
  }
  if (nav.catalogs) addCatalogs(nav.catalogs);
  return pages;
}
const zhPages = getOrderedPages('zh_docs');
const enPages = getOrderedPages('en_docs');
console.log('中文文档页:', zhPages.length, '英文文档页:', enPages.length);

// 测试一个中文页切换英文
const testZh = zhPages.find(p => p.title.includes('ADAS') || p.cat_name && p.cat_name.includes('ADAS'));
if (testZh) {
  const target = testZh.title.trim().toLowerCase();
  const match = enPages.find(p => (p.title||'').trim().toLowerCase() === target);
  console.log('测试中文页:', testZh.title, '| cat:', testZh.cat_name);
  console.log('精确匹配英文页:', match ? match.title : '无（将回退到 index 或默认页）');
}
