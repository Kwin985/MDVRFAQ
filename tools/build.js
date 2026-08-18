/**
 * MDVR FAQ - Static Prerender Build
 * 把 content.json 中的 352 个页面预渲染为干净 URL 的静态 HTML，
 * 并产出 sitemap.xml / robots.txt / llms.txt / 404.html / _headers / 落地页。
 *
 * 用法:
 *   node tools/build.js
 *   VIDEO_BASE=https://customer-subdomain.cloudflarestream.com node tools/build.js
 *   SITE_URL=https://mdvrfaq.com node tools/build.js
 */
const fs = require('fs');
const path = require('path');
const marked = require(path.resolve(__dirname, '../dist/assets/js/vendor/marked.min.js'));

// ---------- 配置 ----------
const SITE_URL = (process.env.SITE_URL || 'https://mdvrfaq.com').replace(/\/$/, '');
const VIDEO_BASE = (process.env.VIDEO_BASE || 'https://media.mdvrfaq.com').replace(/\/$/, '');
const SITE_NAME = 'MDVR FAQ';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ---------- Google Analytics (gtag.js) ----------
// 在每个页面 <head> 之后注入，用于流量统计。GA_ID 即 Google 代码中的衡量 ID。
const GA_ID = 'G-5T43SBNCLL';
const GA_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>`;

const DIST = path.resolve(__dirname, '../dist');
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(DIST, 'content.json');

// 章节元信息: section -> {lang, type, prefix, label, home}
const SECTION_META = {
  zh_docs:   { lang: 'zh', locale: 'zh-CN', type: 'docs',   prefix: '/zh/docs',   label: '中文使用指南', labelEn: 'Chinese Guide',    landingSub: 'MDVR 设备配置 · 平台操作 · 故障排查' },
  en_docs:   { lang: 'en', locale: 'en',    type: 'docs',   prefix: '/en/docs',   label: 'English Guide', labelEn: 'English Guide',  landingSub: 'MDVR setup · platform use · troubleshooting' },
  zh_videos: { lang: 'zh', locale: 'zh-CN', type: 'videos', prefix: '/zh/videos', label: '中文教学视频', labelEn: 'Chinese Tutorials', landingSub: '实操演示 · 安装配置视频' },
  en_videos: { lang: 'en', locale: 'en',    type: 'videos', prefix: '/en/videos', label: 'English Tutorials', labelEn: 'English Tutorials', landingSub: 'Hands-on demos & walkthroughs' },
};
const COUNTERPART = { zh_docs: 'en_docs', en_docs: 'zh_docs', zh_videos: 'en_videos', en_videos: 'zh_videos' };
const PRIMARY_LANG_SECTION = { zh_docs: 'zh_docs', en_docs: 'zh_docs', zh_videos: 'zh_videos', en_videos: 'zh_videos' };

// ---------- 作者联系信息 (全局, 每页显示, 中英文本地化) ----------
const CONTACT = {
  email: 'kwin@citops.com',
  phone: '18682037629',
  author: 'MDVR FAQ 作者',
  zh: {
    title: '联系作者',
    text: '如果您对本文有任何建议或咨询，欢迎随时联系作者，我们将竭诚为您解答。如果您想更详细了解车载录像产品，也欢迎联系我们。',
    emailLabel: '邮箱',
    phoneLabel: '电话',
  },
  en: {
    title: 'Contact the Author',
    text: 'If you have any suggestions or questions about this article, please feel free to contact the author. We are happy to help. If you would like to learn more about our in-vehicle video recorder (MDVR) products, please feel free to contact the author as well.',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
  },
};

// ---------- 友情链接 (全站页脚, 中英文一致) ----------
const FRIENDLY_LINKS = [
  { name: 'citops.com', url: 'https://citops.com' },
  { name: 'mdvr.ai', url: 'https://mdvr.ai' },
  { name: 'ptzdome.cn', url: 'https://ptzdome.cn' },
  { name: 'pixconvert.cn', url: 'https://pixconvert.cn' },
];
function renderFooter(lang) {
  const label = lang === 'en' ? 'Friendly Links' : '友情链接';
  const links = FRIENDLY_LINKS.map((l) =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>`
  ).join('');
  return `<footer class="site-footer">
  <div class="footer-inner">
    <span class="footer-label">${esc(label)}</span>
    <nav class="footer-links" aria-label="${esc(label)}">${links}</nav>
  </div>
</footer>`;
}

// ---------- 产品选型板块 (Products) ----------
// 由 tools/products.js 通过依赖注入提供渲染与媒体收集逻辑
const createProducts = require('./products');
let PROD = createProducts({ esc, SITE_URL, SITE_NAME, renderHeaderNav, renderSidebarSections, renderContact, renderFooter, GA_TAG, CONTACT_EMAIL: CONTACT.email });
function renderContact(lang) {
  const c = CONTACT[lang] || CONTACT.zh;
  return `<aside class="contact-callout" aria-label="${esc(c.title)}">
  <div class="contact-ico" aria-hidden="true">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  </div>
  <div class="contact-body">
    <strong class="contact-title">${esc(c.title)}</strong>
    <p class="contact-text">${esc(c.text)}</p>
    <div class="contact-links">
      <a class="contact-email" href="mailto:${esc(CONTACT.email)}">✉ ${esc(c.emailLabel)}: ${esc(CONTACT.email)}</a>
      <a class="contact-phone" href="tel:+86${esc(CONTACT.phone)}">☎ ${esc(c.phoneLabel)}: +86 ${esc(CONTACT.phone)}</a>
    </div>
  </div>
</aside>`;
}

// ---------- 工具 ----------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function stripMd(s) {
  return String(s || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function makeDesc(md) {
  const t = stripMd(md).replace(/\[TOC\]/gi, '').trim();
  return t.length > 155 ? t.slice(0, 152).trim() + '…' : t;
}
function slugify(s, i) { return 'h-' + i; }

function pageUrl(section, id) { return `${SECTION_META[section].prefix}/${id}/`; }
function pageAbsUrl(section, id) { return SITE_URL + pageUrl(section, id); }

// ---------- 加载数据 ----------
const data = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
const pages = data.pages;
const nav = data.nav;

// id -> 出现的章节
const idSections = {};
for (const id in pages) {
  const s = pages[id].section;
  (idSections[id] = idSections[id] || new Set()).add(s);
}

// 每个章节的扁平顺序(用于上/下篇)
function flatOrder(sectionNav) {
  const ids = [];
  (sectionNav.top_pages || []).forEach(p => ids.push(String(p.id)));
  (function walk(cats) {
    (cats || []).forEach(c => {
      (c.pages || []).forEach(p => ids.push(String(p.id)));
      walk(c.subcatalogs);
    });
  })(sectionNav.catalogs);
  return ids;
}
const orderIndex = {}; // section -> {id:index}
for (const s in nav) orderIndex[s] = {};
for (const s in nav) {
  flatOrder(nav[s]).forEach((id, i) => { orderIndex[s][id] = i; });
}

// 每个章节首页(用于导航/落地页)
function firstPageOf(section) {
  const ids = flatOrder(nav[section]);
  return ids.length ? ids[0] : null;
}

// ---------- FAQ↔产品 关联映射（"不喧宾夺主"：产品靠 FAQ 曝光） ----------
// 型号 → 链接（用于文档正文内联产品链接）
const modelToProduct = {};
for (const it of PROD.ITEMS) {
  const code = (it.modelCode || '').trim();
  if (code) modelToProduct[it.lang + '|' + code] = { id: it.id, url: '/products/item/' + it.id + '/', code };
}
// 文档 → 产品（用于产品页"相关文档"回链）
const docsForProduct = {};
for (const id in pages) {
  const p = pages[id];
  const lang = SECTION_META[p.section] ? SECTION_META[p.section].lang : null;
  if (!lang) continue;
  const txt = stripMd(p.content);
  for (const it of PROD.ITEMS) {
    if (it.lang !== lang) continue;
    const code = (it.modelCode || '').trim();
    if (!code || txt.indexOf(code) === -1) continue;
    (docsForProduct[it.id] = docsForProduct[it.id] || []).push({ url: pageUrl(p.section, id), title: p.title });
  }
}
// 重建 PROD 注入 docsForProduct（工厂无副作用，安全重建）
PROD = createProducts({ esc, SITE_URL, SITE_NAME, renderHeaderNav, renderSidebarSections, renderContact, renderFooter, GA_TAG, CONTACT_EMAIL: CONTACT.email, docsForProduct });

// ---------- Markdown 预处理 + 渲染 ----------
marked.setOptions({ gfm: true, breaks: false });

function preprocess(md) {
  let s = md;
  // 不间断空格 NBSP(U+00A0) 归一为普通空格。源数据大量使用 NBSP（尤其步骤 "1.\u00a0对准"），
  // 而 CommonMark 不把 NBSP 视为列表项的合法分隔空格，会导致 "N. " 步骤无法被识别为有序列表。
  s = s.replace(/\u00a0/g, ' ');
  s = s.replace(/\[TOC\]/gi, '');
  // 剥离原平台自动追加的“说明”版权/旧联系方式声明块（含冲突的旧邮箱 707953684@qq.com / 电话 18145839719）。
  // 该块以“## 说明”标题开头、以“联系电话：18145839719”结尾；已存在统一全局联系模块，故整体移除。
  s = s.replace(/##\s*\*{0,2}说明\*{0,2}[^\n]*[\s\S]*?联系电话[：:]\s*18145839719[^\n]*\n?/g, '');
  // 修正缺失空格的 ATX 标题：#####X -> ##### X（避免被当成纯文本，如 LED 状态页）
  // 仅在“# 号后紧跟非 # 非空白字符”时才补空格，避免破坏正常标题(如 ### X)
  s = s.replace(/^(#{1,6})([^#\s])/gm, '$1 $2');
  // 整句被误标为标题：源数据常把一整段说明/警告用 ###/##### 包成标题（如 274 的“注意：如果从设备拔出…”，
  // 322 的“路由功能简介：即本设备可连接互联网…”，91 的“使用AI司机人脸识别功能需要先满足以下几个前提条件！”），
  // 渲染成巨型标题破坏排版。判定：标题文本含“，。；！”（多分句/整句/感叹）则去 # 号转为正文段落；
  // 疑问句（FAQ 小标题，如 318 的“如何在设备端触发一个报警？”）与短标签（含“：”的“操作步骤：”等）
  // 保留为标题，避免误伤合法层级。
  s = s.replace(/^(#{1,6})\s+(.+)$/gm, function (m, h, txt) {
    if (/[，。；！]/.test(txt)) return txt;
    return m;
  });
  // 过深的标题(#####/######)在正文里会被渲染成过小的 h5/h6 副标题，且常与上层 ### 形成倒置层级
  // （如 “Back panel / Front panel / Device DEBUG port” 变成不起眼的小标题，323 页甚至出现 ### 父级比 ##### 子级还大的倒置）。
  // 整体抬升两级：###### -> ####、##### -> ###，使章节标签清晰、层级合理；#～#### 保持不变。
  s = s.replace(/^(#{6})\s/gm, '#### ');
  s = s.replace(/^(#{5})\s/gm, '### ');
  // “·” / “•” 项目符号行 -> 标准 Markdown 无序列表
  s = s.replace(/^[·•]\s+/gm, '- ');
  // 中文数字枚举（行首 "1、" / "2）" / "（3）"）-> 标准 Markdown 有序列表
  // 否则 marked 不识别，导致步骤与图片挤进同一段、排版崩溃
  s = s.replace(/^[ \t]*[（(]?(\d+)[、）)]\s*/gm, '$1. ');
  // 小数步骤 "1.1" / "1.3.1" / "2.3.4"（行首 N.M[.K…] 形式，末级后常紧跟中文无空格）-> 加粗引导 "**1.3.1** "。
  // markdown 不认 "1.3.1" 为列表项；旧规则只匹配两级(1.3)会把 "1.3.1" 拆成 "1.3 .1"（如 zh/docs/146）。
  // 改为匹配多级小数整体，与配图/正文清晰分隔，且 (?!\d) 防止误伤版本号(如 1.10)。
  s = s.replace(/^(\d+(?:\.\d+)+)(?!\d)\s*(\S)/gm, '**$1** $2');
  // 步骤写成 "1.Enter" / "2.Select"（数字点与文字间无空格）-> 补空格为 "1. Enter"。
  // marked 要求 "N. " 才认作有序列表项，否则整段步骤塌成一个 <p>（如 en/docs/194 等 77 页）。
  s = s.replace(/^(\d+)\.(\S)/gm, '$1. $2');
  // 步骤用竖线 " | " 拼接在同一行（如 "1. 对准… |  | 2. 按… | 3. 进入…"，常见于 zh/docs/173/247/318 等），
  // 导致全部塌进一个 <p>。把"步骤之间的 |"（含双竖线 |  | ）替换为换行，让 marked 拆成有序列表各项。
  // 用 ^ 锚定行首步骤，可避免误伤表格行（表格行以 | 开头，其内 | 不在行首步骤后）。
  s = s.replace(/^(\d+\.\s[^|\n]*?)(?:\s*\|\s*)+(?=\d+\.\s)/gm, '$1\n');
  // 行首 "N. " 步骤前补空行：CommonMark 规定非 "1." 开头的有序列表不能"打断"上一段落，
  // 若步骤（如 6. 7. 或 3. 4. 5.）紧跟在上文（如 "答：…"）无空行，会被并入同一 <p>。
  // 补空行让每个步骤成为独立块，marked 即可正确生成有序列表。表格行/标题/加粗步骤不受影响（不以数字开头）。
  s = s.replace(/^(\d+\.\s)/gm, '\n$1');
  // 图片与相邻文字分离：源数据常见“文字/代码/说明 紧接 ![](图片) 再紧接 ps:说明/型号标注”无空行，
  // 被 marked 塞进同一个 <p>，图文黏连（如 zh/docs/174 的“code+图+ps”、251 的“图+型号标注”）。
  // 在图片前后补足空行，使每张截图成为独立块、其后的说明/标注成为独立段落，阅读更清晰。
  // 排除：后/前一行是另一张图(连续截图)、标题(#)、引用(>)、表格行(|)，避免破坏这些结构。
  s = s.replace(/(!\[[^\]]*\]\([^)]*\))\n([^\n!>#|][^\n]*)/g, '$1\n\n$2');
  s = s.replace(/([^\n!][^\n]*)\n(!\[[^\]]*\]\([^)]*\))/g, '$1\n\n$2');
  // GFM 表格分隔行列数对齐表头：原数据常见表头 4 列、分隔行 3 列（或反之），
  // 导致 marked 拒绝渲染为 <table>。按表头列数重建分隔行。
  s = normalizeTableDelimiter(s);
  // 列表项行与紧跟的图片之间若有空行，合并之，使图片作为懒 continuation 归入 <li> 内
  // （避免生成 <ol><p><img></p></ol> 这种非法结构，也保证步骤与配图紧密对应）
  s = s.replace(/^(\s*(?:\d+\.|\-|\*)\s+.*)\n+(\s*!\[[^\]]*\]\([^)]*\)\s*)$/gm, '$1\n$2');
  // 将 "PWR:…; GPS:…" 这类指标描述按指标拆成独立段落，提升可读性
  s = s.replace(/([;)])\s*(?=[A-Z]{2,4}:)/g, '$1\n\n');
  // 资源路径改为根绝对路径
  s = s.replace(/assets\/images\//g, '/assets/images/');
  s = s.replace(/assets\/videos\//g, VIDEO_BASE + '/');
  // 图片统一发射为 WebP（磁盘上 dist/assets/images 已全量转换为 .webp）
  s = s.replace(/(\/assets\/[^\s"'()>]+\.)(png|jpe?g)\b/gi, '$1webp');
  // 装饰性分隔线（源里常见的 [========] / [--------] 等）-> 语义化 <hr>，
  // 避免被当成字面文本段落。用 <hr> 而非 "---"，以防止被 CommonMark 误判为 setext 二级标题下划线。
  s = s.replace(/^[ \t]*\[[=\-~*.#]{3,}\][ \t]*$/gm, '<hr>');
  // 剔除源数据里的装饰性/错误字符：
  // 1) 连续 2+ 个全角右书名号 》》》（常见于两图之间的冗余符号）。注意：单书名号 《...》 是合法引用，不在其列，故只删连续 >=2 个。
  s = s.replace(/》{2,}/g, '');
  // 2) 连续多余句点 ". . ." -> "."（如 "and so on. . . Note"）
  s = s.replace(/\.\s*\.\s*\./g, '.');
  // 3) 连续全角句点 。。 -> 。
  s = s.replace(/。\s*。/g, '。');
  // 内部 hash 链接改写为干净 URL
  s = s.replace(/\]\(\s*#\/(\w+)\/(\d+)\s*\)/g, (m, sec, pid) => {
    if (SECTION_META[sec]) return `](${SECTION_META[sec].prefix}/${pid}/)`;
    return m;
  });
  return s;
}

// GFM 表格分隔行列数对齐表头：按表头单元格数重建分隔行，保留已有对齐符号
function normalizeTableDelimiter(md) {
  const lines = md.split('\n');
  const countCells = (row) => {
    let t = row.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    if (t === '') return 1;
    return t.split('|').length;
  };
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // 分隔行：仅由 | : - 和空白组成，且至少含一个 | 与一个 -
    if (/\|/.test(line) && /-/.test(line) && /^[\s|:-]+$/.test(line)) {
      const header = lines[i - 1];
      if (!header || !header.includes('|')) continue;
      const hCount = countCells(header);
      const delimCells = countCells(line);
      if (delimCells !== hCount) {
        const cells = [];
        const orig = header; // 原分隔行内容（可能含对齐）
        const origParts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
        for (let k = 0; k < hCount; k++) cells.push(origParts[k] && /-/.test(origParts[k]) ? origParts[k] : '---');
        lines[i] = '| ' + cells.join(' | ') + ' |';
      }
    }
  }
  return lines.join('\n');
}

// 清理文本，去除 Markdown 强调/链接语法，避免注入 alt 时破坏图片语法
function cleanText(s) {
  return String(s)
    .replace(/`/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '')
    .replace(/[\[\]()]/g, '')          // 防止破坏 ![alt](url) 语法
    .replace(/\s+/g, ' ')
    .trim();
}

// 为内容图片补全 alt（SEO/无障碍）：图片 alt 缺失时，按优先级取
//   1) 紧邻图注（图片后 1~2 行内的短纯文本标签，非标题/列表/图片/外链/句子续写）
//   2) 最近的标题文本
//   3) 页面标题
// 站点图片文件名为哈希值（如 36aea4499c7b24b1.webp），无语义，故必须依赖上下文推导。
function addImageAlt(md, pageTitle) {
  const lines = md.split('\n');
  let lastHeading = '';
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const hm = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (hm) lastHeading = cleanText(hm[2]);
    if (line.indexOf('![') !== -1) {
      let caption = '';
      for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
        const cand = lines[k];
        if (cand === undefined) break;
        if (cand.trim() === '') continue;                 // 允许隔一个空行
        if (/^#{1,6}\s/.test(cand)) break;                // 遇到标题，交给 heading 逻辑
        if (/!\[|https?:\/\/|\|/.test(cand)) break;       // 含图片/外链/表格，跳过
        if (/^\s*[-*+]\s/.test(cand)) break;              // 无序列表项
        if (/^\s*\d+[.)]\s/.test(cand)) break;            // 有序列表项
        if (/^\s*>/.test(cand)) break;                    // 引用块
        const t = cleanText(cand);
        // 图注应是“短标签”：长度适中，且不是句子续写（含中英文逗号/分号/句号等多判为句子）
        if (t.length >= 2 && t.length <= 30 && !/[，,；;。．！？!?]/.test(t)) caption = t;
        break;
      }
      const alt = (caption || lastHeading || cleanText(pageTitle || '')).slice(0, 80);
      if (alt) line = line.replace(/!\[\]\(/g, '![' + alt + '](');
    }
    out.push(line);
  }
  return out.join('\n');
}

// 给 <video> 注入 poster（缩略图）；文件名与视频 basename 对应，由 build 拷贝到 dist
// 注意：传入的 src 可能已被改写为绝对地址（VIDEO_BASE），故只认 .mp4 的 basename，兼容相对/绝对两种形式
function addVideoPoster(html) {
  return html.replace(/<video\b([^>]*)>/gi, (m, attrs) => {
    if (/\bposter\s*=/.test(attrs)) return m;
    const sm = attrs.match(/src\s*=\s*["']([^"']+\.mp4)["']/i);
    if (!sm) return m;
    const hash = path.basename(sm[1]).replace(/\.mp4$/i, '');
    const poster = SITE_URL + '/assets/video-thumbs/' + hash + '.jpg';
    return `<video${attrs} poster="${poster}">`;
  });
}

// 视频页 description 剔除嵌入的 <video> 标签（含源内容里可能缺尾 `>` 的残缺标签），空则回退标题
function videoDesc(page) {
  const s = makeDesc(page.content)
    .replace(/<[^>]*>/g, '')
    .replace(/<\/?video\b[^>]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s || page.title;
}

function renderContent(md, pageTitle, lang) {
  const html = marked.parse(addImageAlt(preprocess(md), pageTitle));
  // 给 h2-h4 加 id，给 img 加懒加载，给 video 加 preload=metadata
  let n = 0;
  let out = html.replace(/<h([2-4])>/g, (m, lvl) => `<h${lvl} id="${slugify('', ++n)}">`);
  out = out.replace(/<img\s/g, '<img loading="lazy" decoding="async" ');
  out = out.replace(/<video\s/g, '<video preload="metadata" ');
  out = addVideoPoster(out);
  // 给每个代码块加「一键复制」按钮（中英按语言出文案），方便复制配置/查询参数
  const copyLabel = lang === 'en' ? 'Copy' : '复制';
  const copyAria = lang === 'en' ? 'Copy code' : '复制代码';
  out = out.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g,
    (m, attrs, inner) =>
      `<div class="code-block"><button type="button" class="code-copy-btn" data-label="${copyLabel}" aria-label="${copyAria}">${copyLabel}</button><pre${attrs}>${inner}</pre></div>`
  );
  return out;
}

function firstImage(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return m ? m[1] : '';
}

// ---------- FAQ 检测 (GEO) ----------
function detectFAQ(md) {
  const qa = [];
  const lines = md.split(/\r?\n/);
  let curQ = null, curA = [];
  const isQ = s => /^\s*(?:\*\*)?(?:问|Q|Question)\b[:：]?/i.test(s);
  const isA = s => /^\s*(?:\*\*)?(?:答|A|Answer)\b[:：]?/i.test(s);
  for (const ln of lines) {
    if (isQ(ln)) {
      if (curQ && curA.length) qa.push([curQ, curA.join(' ')]);
      curQ = stripMd(ln); curA = [];
    } else if (isA(ln)) {
      if (curQ === null) curQ = '';
      curA.push(stripMd(ln));
    } else if (curQ !== null && ln.trim()) {
      curA.push(stripMd(ln));
    }
  }
  if (curQ && curA.length) qa.push([curQ, curA.join(' ')]);
  return qa.length >= 2 ? qa : null;
}

// ---------- 侧边栏渲染 ----------
// 文档正文内联产品链接：把型号自动链接到产品页（避开标签与已有链接）
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function linkifyProducts(html, lang) {
  const list = [];
  for (const k in modelToProduct) if (k.indexOf(lang + '|') === 0) list.push(modelToProduct[k]);
  if (!list.length) return html;
  const codes = list.map((m) => m.code).sort((a, b) => b.length - a.length).map(escRe);
  const re = new RegExp('(' + codes.join('|') + ')', 'g');
  let inLink = false;
  return html.replace(/(<a\b[^>]*>)|(<\/a>)|(<[^>]+>)|([^<]+)/gi,
    (m, openA, closeA, tag, text) => {
      if (openA) { inLink = true; return m; }
      if (closeA) { inLink = false; return m; }
      if (tag) return m;
      if (!text) return m;
      return inLink ? text : text.replace(re, (code) => {
        const pm = list.find((x) => x.code === code);
        return '<a class="pd-inline" href="' + pm.url + '">' + code + '</a>';
      });
    });
}

function renderSidebar(section, activeId, lang) {
  const sec = nav[section];
  let h = renderSidebarSections(section, lang);
  h += '<nav class="nav-tree" aria-label="文档导航">';
  (sec.top_pages || []).forEach(p => {
    const id = String(p.id);
    h += `<a class="nav-tree-link ${id === activeId ? 'active' : ''}" href="${esc(pageUrl(section, id))}">${esc(p.title)}</a>`;
  });
  h += renderCatalogs(sec.catalogs || [], activeId);
  h += '</nav>';
  return h;
}
function renderCatalogs(cats, activeId) {
  let h = '';
  (cats || []).forEach(c => {
    h += '<div class="nav-tree-item">';
    h += `<div class="nav-tree-toggle" role="button" tabindex="0">${esc(c.name)}<span class="chevron">▾</span></div>`;
    h += '<div class="nav-tree-children">';
    (c.pages || []).forEach(p => {
      const id = String(p.id);
      h += `<a class="nav-tree-page ${id === activeId ? 'active' : ''}" href="${esc(pageUrl(p.section, id))}">${esc(p.title)}</a>`;
    });
    if (c.subcatalogs && c.subcatalogs.length) h += renderCatalogs(c.subcatalogs, activeId);
    h += '</div></div>';
  });
  return h;
}

// ---------- 顶部导航 ----------
function renderHeaderNav(activeSection, lang) {
  let h = '';
  for (const s in SECTION_META) {
    const fp = firstPageOf(s);
    if (!fp) continue;
    const active = s === activeSection ? ' active' : '';
    h += `<div class="nav-item"><a class="${active}" href="${esc(pageUrl(s, fp))}">${esc(SECTION_META[s].label)}</a></div>`;
  }
  const accActive = activeSection === 'products' ? ' active' : '';
  const prodLang = lang === 'en' ? 'zh' : 'en';
  h += `<div class="nav-item"><a class="${accActive} nav-accessories" href="/products/${prodLang}/">产品选型 / Products</a></div>`;
  return h;
}

// 移动端侧边栏顶部的板块切换（PC 端隐藏，靠顶部导航即可）
// 按「使用指南 / 教学视频」分组，2 列紧凑网格；产品选型单列降权
function renderSidebarSections(activeSection, lang) {
  const groups = [
    { label: '使用指南', items: [['zh_docs', '中文使用指南'], ['en_docs', 'English Guide']] },
    { label: '教学视频', items: [['zh_videos', '中文教学视频'], ['en_videos', 'English Tutorials']] },
  ];
  let h = '<div class="sidebar-sections"><div class="sidebar-sections-title">全部板块</div>';
  for (const g of groups) {
    h += `<div class="sec-group"><div class="sec-group-label">${esc(g.label)}</div><div class="sec-grid">`;
    for (const [s, text] of g.items) {
      const fp = firstPageOf(s);
      if (!fp) continue;
      const active = s === activeSection ? ' active' : '';
      h += `<a class="sidebar-section-link${active}" href="${esc(pageUrl(s, fp))}">${esc(text)}</a>`;
    }
    h += '</div></div>';
  }
  const accActive = activeSection === 'products' ? ' active' : '';
  const prodLang = lang === 'en' ? 'zh' : 'en';
  h += `<a class="sidebar-section-link sec-accessories${accActive}" href="/products/${prodLang}/">产品选型 / Products</a>`;
  h += '</div>';
  return h;
}

// ---------- JSON-LD ----------
function jsonLd(page, renderedHtml, faq) {
  const m = SECTION_META[page.section];
  const canonical = pageAbsUrl(page.section, page.id);
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.title,
      inLanguage: m.locale,
      articleSection: page.cat_name || '',
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      author: { '@type': 'Person', name: CONTACT.author, email: CONTACT.email },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: m.label, item: SITE_URL + m.prefix + '/' },
        { '@type': 'ListItem', position: 2, name: page.cat_name || m.label, item: canonical },
        { '@type': 'ListItem', position: 3, name: page.title, item: canonical },
      ],
    },
  ];
  if (faq) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  // 视频页补充 VideoObject 结构化数据（缩略图 + 视频地址），利于 Google 视频搜索索引
  if (page.section.endsWith('videos')) {
    const vm = renderedHtml.match(/<video\b[^>]*src=["']([^"']+)["']/i);
    if (vm) {
      const src = vm[1];
      const hash = path.basename(src).replace(/\.mp4$/i, '');
      const contentUrl = src.startsWith('http') ? src : (VIDEO_BASE + '/' + src.replace(/^assets\/videos\//, ''));
      const thumbUrl = SITE_URL + '/assets/video-thumbs/' + hash + '.jpg';
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: page.title,
        description: videoDesc(page),
        thumbnailUrl: [thumbUrl],
        contentUrl: contentUrl,
        uploadDate: BUILD_DATE + 'T00:00:00+08:00',
        publisher: { '@type': 'Organization', name: SITE_NAME },
      });
    }
  }
  return ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n  ');
}

// ---------- 页面模板 ----------
function renderPage(page) {
  const m = SECTION_META[page.section];
  const canonical = pageAbsUrl(page.section, page.id);
  const htmlContent = linkifyProducts(renderContent(page.content, page.title, m.lang), m.lang);
  const faq = detectFAQ(page.content);
  const ogImg = firstImage(htmlContent);

  // 语言/区域 hreflang
  const alt = [];
  const cSec = COUNTERPART[page.section];
  const idSet = idSections[String(page.id)] || new Set();
  // 自身语言声明
  alt.push(`<link rel="alternate" hreflang="${m.lang}" href="${esc(canonical)}">`);
  let xdefault = canonical;
  if (idSet.has(cSec)) {
    alt.push(`<link rel="alternate" hreflang="${SECTION_META[cSec].lang}" href="${esc(pageAbsUrl(cSec, page.id))}">`);
    xdefault = pageAbsUrl(cSec, page.id);
  }
  alt.push(`<link rel="alternate" hreflang="x-default" href="${esc(xdefault)}">`);

  // 上/下篇
  const idx = orderIndex[page.section];
  const pos = idx[String(page.id)];
  const order = flatOrder(nav[page.section]);
  let prev = null, next = null;
  if (pos != null) {
    if (pos > 0) { const pid = order[pos - 1]; prev = pages[pid]; }
    if (pos < order.length - 1) { const pid = order[pos + 1]; next = pages[pid]; }
  }

  const breadcrumb = `<nav class="breadcrumb" aria-label="面包屑">
    <a href="${esc(m.prefix + '/')}">${esc(m.label)}</a><span class="separator">/</span>
    <span>${esc(page.cat_name || '')}</span><span class="separator">/</span>
    <span class="current">${esc(page.title)}</span>
  </nav>`;

  const pageNav = `<nav class="page-nav" aria-label="上一篇/下一篇">
    ${prev ? `<a class="prev" href="${esc(pageUrl(prev.section, prev.id))}"><span class="nav-label">← 上一篇</span><span class="nav-title">${esc(prev.title)}</span></a>` : '<span></span>'}
    ${next ? `<a class="next" href="${esc(pageUrl(next.section, next.id))}"><span class="nav-label">下一篇 →</span><span class="nav-title">${esc(next.title)}</span></a>` : '<span></span>'}
  </nav>`;

  // 语言切换链接
  let langHref = m.prefix + '/' + (firstPageOf(page.section)) + '/';
  if (idSet.has(cSec)) langHref = pageUrl(cSec, page.id);
  const langLabel = m.lang === 'zh' ? 'EN' : '中文';

  const html = `<!DOCTYPE html>
<html lang="${m.locale}" data-theme="light">
<head>
  ${GA_TAG}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff" id="themeColorMeta">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>${esc(page.title)} - ${SITE_NAME}</title>
  <meta name="description" content="${esc(makeDesc(page.content))}">
  <link rel="canonical" href="${esc(canonical)}">
  ${alt.join('\n  ')}
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(makeDesc(page.content))}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  ${ogImg ? `<meta property="og:image" content="${esc(ogImg.startsWith('http') ? ogImg : SITE_URL + ogImg)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='18' height='14' rx='2' fill='%232563eb'/%3E%3Cline x1='3' y1='9' x2='21' y2='9' stroke='white' stroke-width='1.5'/%3E%3Cline x1='9' y1='20' x2='15' y2='20' stroke='%232563eb' stroke-width='2'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/assets/css/style.css?v=5">
  <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
  ${jsonLd(page, htmlContent, faq)}
</head>
<body>
  <header class="header">
    <div class="header-left">
      <button class="menu-toggle" id="menuToggle" aria-label="切换菜单">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a href="/" class="logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="18" x2="12" y2="20"/></svg>
        <span class="logo-text">${SITE_NAME}</span>
      </a>
    </div>
    <nav class="header-nav" id="headerNav">${renderHeaderNav(page.section, m ? m.lang : null)}</nav>
    <div class="header-right">
      <a class="lang-btn" id="langBtn" href="${esc(langHref)}" title="切换语言">${langLabel}</a>
      <button class="theme-btn" id="themeBtn" title="切换主题">
        <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="search-toggle" id="searchToggle" aria-label="搜索文档" title="搜索文档">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
    </div>
  </header>

  <aside class="sidebar" id="sidebar">
    <div class="search-box">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="searchInput" placeholder="搜索文档..." autocomplete="off">
      <button class="search-clear" id="searchClear" style="display:none;">✕</button>
    </div>
    <div class="search-results" id="searchResults" style="display:none;"></div>
    ${renderSidebar(page.section, String(page.id), m ? m.lang : null)}
  </aside>

  <div class="sidebar-overlay" id="sidebarOverlay"></div>

  <main class="main-content">
    <div class="content-wrapper">
      ${breadcrumb}
      <article class="article">
        <div class="article-content">${htmlContent}</div>
      </article>
      ${pageNav}
      ${renderContact(m.lang)}
    </div>
  </main>

  ${renderFooter(m.lang)}

  <div class="lightbox" id="lightbox">
    <span class="lightbox-close" id="lightboxClose">✕</span>
    <img class="lightbox-img" id="lightboxImg" src="" alt="">
  </div>

  <button class="back-to-top" id="backToTop" title="回到顶部">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
  </button>

  <script src="/assets/js/app.js?v=3"></script>
</body>
</html>`;
  return html;
}

// ---------- 落地页 ----------
function renderLanding() {
  const zhDoc = firstPageOf('zh_docs'), enDoc = firstPageOf('en_docs');
  const zhVid = firstPageOf('zh_videos'), enVid = firstPageOf('en_videos');
  const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  ${GA_TAG}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>${SITE_NAME} - MDVR 车载录像机 使用指南与教学视频中心</title>
  <meta name="description" content="${SITE_NAME} 提供 MDVR（车载录像机）/ Mobile DVR 终端设备及监控平台的使用指南与教学视频，涵盖设备配置、平台操作、故障排查、安装演示等常见问题解答。">
  <link rel="canonical" href="${SITE_URL}/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${SITE_NAME}">
  <meta property="og:description" content="MDVR（车载录像机）使用指南与教学视频中心：设备配置、平台操作、故障排查、安装演示">
  <meta property="og:url" content="${SITE_URL}/">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='18' height='14' rx='2' fill='%232563eb'/%3E%3Cline x1='3' y1='9' x2='21' y2='9' stroke='white' stroke-width='1.5'/%3E%3Cline x1='9' y1='20' x2='15' y2='20' stroke='%232563eb' stroke-width='2'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/assets/css/style.css?v=5">
  <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: SITE_NAME, url: SITE_URL,
    description: 'MDVR（车载录像机）使用指南与教学视频中心：设备配置、平台操作、故障排查、安装演示',
  })}</script>
  <style>
    .landing{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:30px;padding:0 24px 56px;text-align:center;
      background:linear-gradient(180deg, var(--color-primary-light, #eef2ff) 0%, var(--color-bg) 320px);}
    .landing h1{font-size:52px;line-height:1.1;font-weight:800;letter-spacing:-0.5px;margin-bottom:12px;color:var(--color-text);}
    .landing p{font-size:18px;line-height:1.6;color:var(--color-text-secondary);max-width:580px;}
    .lang-cards{display:grid;grid-template-columns:repeat(2,minmax(190px,240px));gap:18px;justify-content:center;width:100%;max-width:560px;}
    .lang-card{padding:24px 26px;border:1px solid var(--color-border);border-left:4px solid var(--color-primary);border-radius:12px;transition:all .2s;background:var(--color-bg);text-align:left;}
    .lang-card:hover{border-color:var(--color-primary);box-shadow:0 10px 28px var(--color-shadow);transform:translateY(-3px);background:var(--color-primary-light, #eef2ff);}
    .lang-card .big{font-size:24px;font-weight:700;color:var(--color-text);margin-bottom:6px;}
    .lang-card .sub{font-size:13.5px;line-height:1.55;color:var(--color-text-secondary);}
    .acc-note{font-size:12px;color:var(--color-text-tertiary);letter-spacing:.5px;text-transform:uppercase;margin-top:6px;}
    .acc-entry{display:flex;align-items:center;gap:16px;padding:18px 26px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-bg);transition:all .2s;max-width:560px;width:100%;text-align:left;}
    .acc-entry:hover{box-shadow:0 2px 10px var(--color-shadow);transform:translateY(-1px);border-color:var(--color-primary);}
    .acc-entry .ico{flex:0 0 auto;width:40px;height:40px;border-radius:10px;background:var(--color-bg-tertiary);color:var(--color-text-secondary);display:flex;align-items:center;justify-content:center;}
    .acc-entry .txt{flex:1;}
    .acc-entry .big{font-size:17px;font-weight:600;color:var(--color-text);margin-bottom:3px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
    .acc-entry .tag{font-size:11px;font-weight:700;letter-spacing:.5px;background:var(--color-bg-tertiary);color:var(--color-text-secondary);padding:2px 8px;border-radius:20px;}
    .acc-entry .sub{font-size:12.5px;color:var(--color-text-secondary);line-height:1.6;}
    .acc-entry .arrow{flex:0 0 auto;color:var(--color-text-tertiary);font-size:20px;}
    @media (max-width:560px){
      .landing h1{font-size:34px;}
      .lang-cards{grid-template-columns:1fr;max-width:320px;}
      .acc-entry{padding:18px 20px;gap:13px;}
      .acc-entry .arrow{display:none;}
    }
  </style>
</head>
<body>
  <div class="landing">
    <div>
      <h1>${SITE_NAME}</h1>
      <p>MDVR / Mobile DVR 车载录像终端 · 使用指南与教学视频中心</p>
    </div>
    <div class="lang-cards">
      <a class="lang-card" href="${esc(pageUrl('zh_docs', zhDoc))}"><div class="big">${esc(SECTION_META.zh_docs.label)}</div><div class="sub">${esc(SECTION_META.zh_docs.landingSub)}</div></a>
      <a class="lang-card" href="${esc(pageUrl('en_docs', enDoc))}"><div class="big">${esc(SECTION_META.en_docs.label)}</div><div class="sub">${esc(SECTION_META.en_docs.landingSub)}</div></a>
      <a class="lang-card" href="${esc(pageUrl('zh_videos', zhVid))}"><div class="big">${esc(SECTION_META.zh_videos.label)}</div><div class="sub">${esc(SECTION_META.zh_videos.landingSub)}</div></a>
      <a class="lang-card" href="${esc(pageUrl('en_videos', enVid))}"><div class="big">${esc(SECTION_META.en_videos.label)}</div><div class="sub">${esc(SECTION_META.en_videos.landingSub)}</div></a>
    </div>
    <div class="acc-note">辅助工具 · Supplementary</div>
    <a class="acc-entry" href="/products/en/">
      <span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z"/><path d="M4 6.5l8 4.5 8-4.5"/><path d="M12 11v9"/></svg></span>
      <span class="txt">
        <span class="big">产品选型 / Products</span>
        <span class="sub">${PROD.ITEMS.length} 款主机 · 摄像头 · 配件规格与图片，含 ${PROD.KITS.length} 套整车预置配置方案，支持中英文对照与规格书下载</span>
      </span>
      <span class="arrow">→</span>
    </a>
    <div class="landing-contact">
      <span>如有建议或咨询，请联系作者：</span>
      <a href="mailto:${esc(CONTACT.email)}">✉ ${esc(CONTACT.email)}</a>
      <span class="sep">·</span>
      <a href="tel:+86${esc(CONTACT.phone)}">☎ +86 ${esc(CONTACT.phone)}</a>
    </div>
  </div>

  ${renderFooter('zh')}
</body>
</html>`;
  return html;
}

// ---------- 写入文件 ----------
function writeFile(rel, content) {
  const fp = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
}

let count = 0;
for (const id in pages) {
  const p = pages[id];
  const url = pageUrl(p.section, p.id);
  writeFile(url + 'index.html', renderPage(p));
  count++;
}

// ---------- 产品选型板块 (Products) ----------
// 清理旧 /accessories 产物（已由 _redirects 永久 301 到 /products）
for (const d of ['accessories', path.join('assets', 'accessories-media')]) {
  const dp = path.join(DIST, d);
  if (fs.existsSync(dp)) { try { fs.rmSync(dp, { recursive: true, force: true }); } catch (e) {} }
}

// 301 跳转页（/products/ -> /products/en/，英文优先）
function redirectHtml(to) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=${esc(to)}">
<link rel="canonical" href="${esc(SITE_URL + to)}">
<link rel="alternate" hreflang="x-default" href="${esc(SITE_URL + to)}">
<title>Redirecting…</title></head>
<body><p>Redirecting to <a href="${esc(to)}">${esc(to)}</a>…</p>
<script>location.href=${JSON.stringify(to)}</script></body></html>`;
}

let prodCount = 0;
// /products/ -> 英文落地页（英文优先，301 跳转）
writeFile('products/index.html', redirectHtml('/products/en/')); prodCount++;
writeFile('products/en/index.html', PROD.renderLanding('en')); prodCount++;
writeFile('products/zh/index.html', PROD.renderLanding('zh')); prodCount++;
// 按品类分页（避免同类产品堆在一页）
for (const lang of ['en', 'zh']) for (const ty of ['host', 'camera', 'accessory']) {
  writeFile('products/' + lang + '/' + ty + '/index.html', PROD.renderCatalog(lang, ty)); prodCount++;
}
for (const it of PROD.ITEMS) { writeFile('products/item/' + it.id + '/index.html', PROD.renderItem(it)); prodCount++; }
for (const b of PROD.KITS) { writeFile('products/bundle/' + b.id + '/index.html', PROD.renderBundle(b)); prodCount++; }

// 仅拷贝被引用的媒体到 dist/assets/products-media/（跳过未变化文件以加速重建）
let copyN = 0, copySkip = 0, copyBytes = 0;
for (const rel of PROD.COPY) {
  const src = path.join(PROD.MEDIA, rel);
  const dst = path.join(DIST, 'assets', 'products-media', rel);
  if (!fs.existsSync(src)) continue;
  try {
    const sStat = fs.statSync(src);
    if (fs.existsSync(dst)) {
      const dStat = fs.statSync(dst);
      if (dStat.size === sStat.size && dStat.mtimeMs >= sStat.mtimeMs) { copySkip++; continue; }
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    copyN++; copyBytes += sStat.size;
  } catch (e) {}
}
console.log(`✅ 产品选型: ${prodCount} 个页面 -> dist/products/ ; 拷贝媒体 ${copyN} 个 (跳过 ${copySkip}), ${(copyBytes / 1048576).toFixed(1)} MB`);

// 落地页
writeFile('index.html', renderLanding());

// 404
writeFile('404.html', `<!DOCTYPE html><html lang="zh-CN"><head>${GA_TAG}<meta charset="UTF-8"><title>404 - ${SITE_NAME}</title>
<link rel="stylesheet" href="/assets/css/style.css?v=5"></head><body>
<main class="main-content"><div class="content-wrapper" style="text-align:center;padding-top:120px;">
<h1>404</h1><p>页面不存在。<a href="/">返回首页</a></p></div></main></body></html>`);

// sitemap.xml
const urls = [];
urls.push({ loc: SITE_URL + '/', pri: '0.5', freq: 'weekly' });
for (const id in pages) {
  const p = pages[id];
  const isVideo = p.section.endsWith('videos');
  urls.push({ loc: pageAbsUrl(p.section, p.id), pri: isVideo ? '0.6' : '0.8', freq: 'weekly' });
}
// 产品选型（英文优先）
urls.push({ loc: SITE_URL + '/products/', pri: '0.6', freq: 'weekly' });
urls.push({ loc: SITE_URL + '/products/en/', pri: '0.7', freq: 'weekly' });
urls.push({ loc: SITE_URL + '/products/zh/', pri: '0.7', freq: 'weekly' });
for (const lang of ['en', 'zh']) for (const ty of ['host', 'camera', 'accessory']) {
  urls.push({ loc: SITE_URL + `/products/${lang}/${ty}/`, pri: '0.6', freq: 'weekly' });
}
for (const it of PROD.ITEMS) urls.push({ loc: SITE_URL + '/products/item/' + it.id + '/', pri: '0.5', freq: 'weekly' });
for (const b of PROD.KITS) urls.push({ loc: SITE_URL + '/products/bundle/' + b.id + '/', pri: '0.5', freq: 'weekly' });
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
for (const u of urls) {
  sm += `  <url><loc>${esc(u.loc)}</loc><lastmod>${BUILD_DATE}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>\n`;
}
sm += '</urlset>';
writeFile('sitemap.xml', sm);

// video-sitemap.xml（Google 视频搜索专用；含缩略图地址）
let vsm = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
  '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
for (const id in pages) {
  const p = pages[id];
  if (!p.section.endsWith('videos')) continue;
  const vm = (p.content || '').match(/<video\b[^>]*src=["']([^"']+)["']/i);
  if (!vm) continue;
  const src = vm[1];
  const hash = path.basename(src).replace(/\.mp4$/i, '');
  const contentUrl = src.startsWith('http') ? src : (VIDEO_BASE + '/' + src.replace(/^assets\/videos\//, ''));
  const thumbUrl = SITE_URL + '/assets/video-thumbs/' + hash + '.jpg';
  vsm += '  <url>\n';
  vsm += `    <loc>${esc(pageAbsUrl(p.section, p.id))}</loc>\n`;
  vsm += '    <video:video>\n';
  vsm += `      <video:thumbnail_loc>${esc(thumbUrl)}</video:thumbnail_loc>\n`;
  vsm += `      <video:title>${esc(p.title)}</video:title>\n`;
  vsm += `      <video:description>${esc(videoDesc(p))}</video:description>\n`;
  vsm += `      <video:content_loc>${esc(contentUrl)}</video:content_loc>\n`;
  vsm += `      <video:publication_date>${esc(BUILD_DATE)}</video:publication_date>\n`;
  vsm += '      <video:family_friendly>yes</video:family_friendly>\n';
  vsm += '    </video:video>\n';
  vsm += '  </url>\n';
}
vsm += '</urlset>';
writeFile('video-sitemap.xml', vsm);

// 复制视频缩略图到 dist（供线上 https://mdvrfaq.com/assets/video-thumbs/ 访问）
const VTHUMB_SRC = path.join(ROOT, 'assets', 'video-thumbs');
const VTHUMB_DST = path.join(DIST, 'assets', 'video-thumbs');
if (fs.existsSync(VTHUMB_SRC)) {
  fs.mkdirSync(VTHUMB_DST, { recursive: true });
  let copied = 0;
  for (const f of fs.readdirSync(VTHUMB_SRC)) {
    if (f.toLowerCase().endsWith('.jpg')) {
      fs.copyFileSync(path.join(VTHUMB_SRC, f), path.join(VTHUMB_DST, f));
      copied++;
    }
  }
  console.log(`   视频缩略图已拷贝 ${copied} 张 -> dist/assets/video-thumbs/`);
}

// robots.txt
const robots = `User-agent: *
Allow: /
Allow: /llms.txt

# AI / LLM crawlers - 明确允许以提升 GEO 可见性
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Bytespider
Allow: /
User-agent: AI2Bot
Allow: /
User-agent: Omgilibot
Allow: /
User-agent: Diffbot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/video-sitemap.xml
`;
writeFile('robots.txt', robots);

// llms.txt (GEO)
let llm = `# ${SITE_NAME}\n\n`;
llm += `> 面向 MDVR / Mobile DVR（车载录像机）终端设备及监控平台的使用指南与教学视频中心，涵盖设备配置、平台操作、故障排查、安装演示等常见问题解答。\n\n`;
llm += `## Contact\n`;
llm += `- 邮箱 (Email): ${CONTACT.email}\n`;
llm += `- 电话 (Phone): +86 ${CONTACT.phone}\n`;
llm += `- 说明: 如有任何建议或咨询，请联系作者。\n\n`;
llm += `## Documentation\n`;
llm += `- 中文文档: ${SITE_URL}/zh/docs/\n`;
llm += `- English Docs: ${SITE_URL}/en/docs/\n`;
llm += `## Videos\n`;
llm += `- 中文视频: ${SITE_URL}/zh/videos/\n`;
llm += `- English Videos: ${SITE_URL}/en/videos/\n\n`;
for (const s in SECTION_META) {
  const m = SECTION_META[s];
  llm += `### ${m.label} (${m.labelEn})\n`;
  (nav[s].catalogs || []).forEach(c => {
    const fp = (c.pages && c.pages[0]) ? c.pages[0] : null;
    const link = fp ? pageAbsUrl(fp.section, fp.id) : (SITE_URL + m.prefix + '/');
    llm += `- [${c.name}](${link})\n`;
    (c.subcatalogs || []).forEach(sc => {
      const sfp = (sc.pages && sc.pages[0]) ? sc.pages[0] : null;
      const slink = sfp ? pageAbsUrl(sfp.section, sfp.id) : link;
      llm += `  - [${sc.name}](${slink})\n`;
    });
  });
  llm += '\n';
}
llm += `## Products (产品选型)\n`;
llm += `- Products Home (EN): ${SITE_URL}/products/en/\n`;
llm += `- 产品选型首页 (ZH): ${SITE_URL}/products/zh/\n`;
const CAT_LABEL = { host: ['MDVR Hosts', '主机'], camera: ['Cameras', '摄像头'], accessory: ['Accessories', '配件'] };
for (const lang of ['en', 'zh']) for (const ty of ['host', 'camera', 'accessory']) {
  llm += `- ${CAT_LABEL[ty][lang === 'en' ? 0 : 1]}: ${SITE_URL}/products/${lang}/${ty}/\n`;
}
for (const b of PROD.KITS) llm += `- [${b.lang === 'zh' ? b.name : b.nameEn}](${SITE_URL}/products/bundle/${b.id}/)\n`;
llm += '\n';
writeFile('llms.txt', llm);

// _headers (Cloudflare Pages)
const headers = `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=86400

/*.css
  Cache-Control: public, max-age=86400

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;
writeFile('_headers', headers);

// _redirects (Cloudflare Pages)
// 旧版站点结构（Google 仍抓取到的旧 URL）永久 301 迁移到现行结构，避免 404
// - 旧 /en|zh/{host,camera,accessory}/ 分类页 -> 现行 /products/{en,zh}/{...}/
// - 旧 /en、/zh 站点根（语言首页）-> 现行双语入口首页 /
// - 旧 /accessories -> /products
writeFile('_redirects', [
  '/en/accessory /products/en/accessory/ 301',
  '/en/host /products/en/host/ 301',
  '/en/camera /products/en/camera/ 301',
  '/zh/accessory /products/zh/accessory/ 301',
  '/zh/host /products/zh/host/ 301',
  '/zh/camera /products/zh/camera/ 301',
  '/en / 301',
  '/zh / 301',
  '/accessories/* /products/:splat 301',
  '/products /products/en/ 301',
].join('\n') + '\n');

console.log(`✅ 构建完成: ${count} 个页面 -> dist/`);
console.log(`   sitemap.xml / robots.txt / llms.txt / 404.html / _headers 已生成`);
console.log(`   SITE_URL=${SITE_URL}  VIDEO_BASE=${VIDEO_BASE}`);
