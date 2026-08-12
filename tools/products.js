/**
 * 产品选型板块 (Products) —— 主机 / 摄像头 / 配件 + 预置方案
 * 由 build.js 通过依赖注入调用，独立于文档站渲染逻辑。
 * 页面：
 *   /products/                 选型首页（按场景 / 按品类 / 按产品线）
 *   /products/{zh|en}/         产品目录（搜索 + 分面筛选 + 分区分组）
 *   /products/item/{id}/       产品详情（两栏 PDP）
 *   /products/bundle/{id}/     配置方案（清单表格）
 */
const fs = require('fs');
const path = require('path');

const BASE = '/products';
const WEB = '/assets/products-media';

module.exports = function createProducts(deps) {
  const { esc, SITE_URL, SITE_NAME, renderHeaderNav, renderSidebarSections, renderContact, renderFooter, docsForProduct = {} } = deps;

  const DIR = path.resolve(__dirname, '../data/accessories');
  const MEDIA = path.join(DIR, 'media');

  let CATALOG = { items: [] };
  let BUNDLES = { bundles: [] };
  // 优先使用富化后的目录（含 modelCode / summary / keySpecs / chips）
  for (const f of ['catalog.enriched.json', 'catalog.json']) {
    try { CATALOG = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); break; } catch (e) { /* next */ }
  }
  try { BUNDLES = JSON.parse(fs.readFileSync(path.join(DIR, 'bundles.json'), 'utf8')); } catch (e) {}

  const ITEMS = CATALOG.items || [];
  const KITS = BUNDLES.bundles || [];

  /* ---------------- 媒体引用收集（只拷被引用的文件） ---------------- */
  const COPY = new Set();
  const addWeb = (w) => { if (w && w.startsWith(WEB + '/')) COPY.add(w.slice(WEB.length + 1)); };
  const addRel = (r) => { if (r) COPY.add(String(r).replace(/^media\//, '')); };
  const mediaUrl = (rel) => WEB + '/' + String(rel || '').replace(/^media\//, '');

  const itemDir = (it) => path.join(MEDIA, it.lang, it.type, it.id);
  const byId = (id) => ITEMS.find((i) => i.id === id) || null;
  const kitsOf = (id) => KITS.filter((b) => b.host === id || (b.parts || []).some((p) => p.id === id));

  function specHtml(it) {
    const p = path.join(itemDir(it), 'spec.html');
    if (!fs.existsSync(p)) return null;
    let html = fs.readFileSync(p, 'utf8');
    const re = new RegExp(WEB.replace(/\//g, '\\/') + '\\/[^"\')\\s]+', 'g');
    let m;
    while ((m = re.exec(html))) addWeb(m[0]);
    // 补全规格图 alt：spec.html 自带图片多无 alt，用物料名兜底（SEO/无障碍）
    html = html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs) => {
      if (/\balt\s*=/.test(attrs)) return full;
      const name = esc(it.name);
      return `<img${attrs} alt="${name}" loading="lazy" decoding="async">`;
    });
    return html;
  }
  // 收集一个物料的全部媒体（封面/画廊/规格书）
  function claim(it) {
    if (!it) return;
    if (it.cover) addRel(it.cover);
    (it.gallery || []).forEach(addRel);
    if (it.specDocx) addRel(it.specDocx);
  }

  /* ---------------- 文案 ---------------- */
  const T = {
    zh: {
      section: '产品选型',
      home: '产品选型首页',
      catalog: '中文产品目录',
      all: '全部产品',
      host: '主机', accessory: '配件', camera: '摄像头',
      hostP: '主机', accessoryP: '配件', cameraP: '摄像头',
      kits: '配置方案',
      search: '搜索型号 / 名称 / 参数…',
      results: '项产品',
      noResult: '没有匹配的产品，试试其他关键词。',
      byScene: '按应用场景选型',
      bySceneSub: '已配好的整车方案，含主机、摄像头与外设清单，可直接参考选型。',
      byType: '按产品品类浏览',
      byTypeSub: '从主机、摄像头到线材外设，全部规格书与实物图在线可查。',
      byLine: '按主机产品线',
      viewKit: '查看配置清单',
      items: '款',
      spec: '规格书',
      keySpec: '关键参数',
      fullSpec: '完整规格书',
      download: '下载规格书 (DOCX)',
      inquiry: '咨询这款产品',
      usedIn: '用于以下方案',
      related: '同类产品',
      relDocs: '相关文档',
      otherKits: '相关配置方案',
      prev: '上一款', next: '下一款',
      config: '配置清单',
      qty: '数量',
      role: '用途 / 安装位置',
      product: '产品',
      type: '品类',
      model: '型号',
      hostRole: '录像主机',
      noSpec: '该产品暂无在线规格书，欢迎联系我们获取详细资料。',
      langSwitch: 'English Catalog',
      overview: '产品简介',
      totalLine: (a, b, c, d) => `${a} 款主机 · ${b} 款摄像头 · ${c} 款配件 · ${d} 套预置方案`,
      heroTitle: '产品选型中心',
      heroSub: 'MDVR 主机、车载摄像头与外设配件——规格书、实物图与整车配置方案，一站式查询。',
      helpTitle: '不确定选哪一款？',
      helpText: '告诉我们车型、通道数与使用场景，我们会给出完整配置建议。',
    },
    en: {
      section: 'Products',
      home: 'Products Home',
      catalog: 'English Catalog',
      all: 'All Products',
      host: 'MDVR', accessory: 'Accessory', camera: 'Camera',
      hostP: 'MDVR Hosts', accessoryP: 'Accessories', cameraP: 'Cameras',
      kits: 'Solution Kits',
      search: 'Search model / name / spec…',
      results: 'products',
      noResult: 'No matching products. Try another keyword.',
      byScene: 'Find by Application',
      bySceneSub: 'Ready-made vehicle kits with host, cameras and peripherals.',
      byType: 'Browse by Category',
      byTypeSub: 'Hosts, cameras, cables and peripherals — full specs and photos online.',
      byLine: 'MDVR Product Lines',
      viewKit: 'View configuration',
      items: 'items',
      spec: 'Specification',
      keySpec: 'Key Specs',
      fullSpec: 'Full Specification',
      download: 'Download Spec (DOCX)',
      inquiry: 'Enquire about this product',
      usedIn: 'Used in these kits',
      related: 'Related products',
      relDocs: 'Related articles',
      otherKits: 'Other Solution Kits',
      prev: 'Previous', next: 'Next',
      config: 'Configuration List',
      qty: 'Qty',
      role: 'Role / Position',
      product: 'Product',
      type: 'Category',
      model: 'Model',
      hostRole: 'Recording host',
      noSpec: 'Online specification is not available yet. Please contact us for details.',
      langSwitch: '中文目录',
      overview: 'Overview',
      totalLine: (a, b, c, d) => `${a} hosts · ${b} cameras · ${c} accessories · ${d} kits`,
      heroTitle: 'Product Selector',
      heroSub: 'MDVR hosts, vehicle cameras and peripherals — specs, photos and complete vehicle kits in one place.',
      helpTitle: 'Not sure which model fits?',
      helpText: 'Tell us your vehicle type, channel count and scenario — we will propose a complete configuration.',
    },
  };
  const t = (lang) => T[lang] || T.zh;
  const typeLabel = (type, lang) => t(lang)[type] || type;
  const typePlural = (type, lang) => t(lang)[type + 'P'] || typeLabel(type, lang);
  const TYPE_ORDER = ['host', 'camera', 'accessory'];
  const hubUrl = (l) => (l === 'en' ? BASE + '/en/' : BASE + '/zh/');
  const catUrl = (l, ty) => BASE + '/' + l + '/' + ty + '/';

  const TYPE_ICON = {
    host: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="10" y1="14" x2="18" y2="14"/>',
    camera: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    accessory: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };
  const icon = (type) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICON[type] || TYPE_ICON.accessory}</svg>`;

  const kitName = (b, lang) => (lang === 'en' ? (b.nameEn || b.name) : b.name);
  const kitSummary = (b, lang) => (lang === 'en' ? (b.summaryEn || b.summary) : b.summary);

  /* ---------------- 通用片段 ---------------- */
  function breadcrumb(trail) {
    const parts = (trail || []).map((x) => (x.href
      ? `<a href="${esc(x.href)}">${esc(x.label)}</a>`
      : `<span class="current">${esc(x.label)}</span>`));
    return `<nav class="breadcrumb" aria-label="breadcrumb">${parts.join('<span class="separator">/</span>')}</nav>`;
  }

  // 产品图：产品照多为白底，深色模式下强制浅色画布以保证可读
  function thumb(it, cls) {
    const src = it.cover ? mediaUrl(it.cover) : '';
    if (it.cover) addRel(it.cover);
    return `<div class="${cls}">${src
      ? `<img loading="lazy" decoding="async" src="${esc(src)}" alt="${esc(it.name)}">`
      : `<span class="pd-noimg">${esc((it.name || '?').slice(0, 2))}</span>`}</div>`;
  }

  function productCard(it) {
    claim(it);
    const lang = it.lang;
    const chips = (it.chips || []).slice(0, 3)
      .map((c) => `<span class="pd-chip">${esc(c)}</span>`).join('');
    const sub = it.modelCode || (it.type === 'host' ? it.line : '') || '';
    // 供前端搜索的检索串
    const hay = [it.name, it.modelCode, it.line, (it.chips || []).join(' '), it.summary]
      .filter(Boolean).join(' ').toLowerCase();
    return `<a class="pd-card" href="${BASE}/item/${esc(it.id)}/"
      data-type="${esc(it.type)}" data-line="${esc(it.lineKey || '')}" data-hay="${esc(hay)}">
      ${thumb(it, 'pd-card-img')}
      <div class="pd-card-body">
        <span class="pd-tag pd-tag-${esc(it.type)}">${esc(typeLabel(it.type, lang))}</span>
        <h3 class="pd-card-name">${esc(it.name)}</h3>
        ${sub ? `<div class="pd-card-sub">${esc(sub)}</div>` : ''}
        ${chips ? `<div class="pd-chips">${chips}</div>` : ''}
      </div>
    </a>`;
  }

  /* ---------------- 页面外壳 ---------------- */
  function shell(o) {
    const lang = o.lang || 'zh';
    const L = t(lang);
    const locale = lang === 'zh' ? 'zh-CN' : 'en';
    const other = lang === 'zh' ? 'en' : 'zh';
    const canonical = SITE_URL + (o.canonical || BASE + '/');
    const alts = o.alternates || [];
    return `<!DOCTYPE html>
<html lang="${locale}" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff" id="themeColorMeta">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>${esc(o.title)} - ${SITE_NAME}</title>
  <meta name="description" content="${esc(o.desc || L.heroSub)}">
  <link rel="canonical" href="${esc(canonical)}">
${alts.map(a => '  <link rel="alternate" hreflang="' + a.lang + '" href="' + esc(SITE_URL + a.href) + '">').join('\n')}
  <link rel="alternate" hreflang="x-default" href="${esc(SITE_URL + (o.xDefault || canonical.replace(SITE_URL, '')))}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${locale === 'zh' ? 'zh_CN' : 'en'}">
${alts.map(a => '  <meta property="og:locale:alternate" content="' + (a.lang === 'zh' ? 'zh_CN' : 'en') + '">').join('\n')}
  <meta property="og:title" content="${esc(o.title)}">
  <meta property="og:description" content="${esc(o.desc || L.heroSub)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='18' height='14' rx='2' fill='%232563eb'/%3E%3Cline x1='3' y1='9' x2='21' y2='9' stroke='white' stroke-width='1.5'/%3E%3Cline x1='9' y1='20' x2='15' y2='20' stroke='%232563eb' stroke-width='2'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script>try{var th=localStorage.getItem('theme');if(th)document.documentElement.setAttribute('data-theme',th);}catch(e){}</script>
  ${o.jsonld ? `<script type="application/ld+json">${o.jsonld}</script>` : ''}
</head>
<body class="pd-page ${o.bodyClass || ''}">
  <header class="header">
    <div class="header-left">
      <button class="menu-toggle" id="menuToggle" aria-label="menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a href="/" class="logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="18" x2="12" y2="20"/></svg>
        <span class="logo-text">${SITE_NAME}</span>
      </a>
    </div>
    <nav class="header-nav" id="headerNav">${renderHeaderNav('products', lang)}</nav>
    <div class="header-right">
      <a class="lang-btn" id="langBtn" href="${BASE}/${other}/" title="switch language">${lang === 'zh' ? 'EN' : '中文'}</a>
      <button class="theme-btn" id="themeBtn" title="theme">
        <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </header>

  <aside class="sidebar" id="sidebar">${sidebar(lang, o.active || '')}</aside>
  <div class="sidebar-overlay" id="sidebarOverlay"></div>

  <main class="main-content">
    <div class="content-wrapper pd-wrapper">
      ${o.breadcrumb || ''}
      ${o.content}
      ${renderContact(lang)}
    </div>
  </main>

  ${renderFooter(lang)}

  <div class="lightbox" id="lightbox">
    <span class="lightbox-close" id="lightboxClose">✕</span>
    <img class="lightbox-img" id="lightboxImg" src="" alt="">
  </div>
  <button class="back-to-top" id="backToTop" title="top">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
  </button>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
  }

  /* ---------------- 侧边栏 ---------------- */
  function sidebar(lang, active) {
    const L = t(lang);
    const other = lang === 'zh' ? 'en' : 'zh';
    let h = renderSidebarSections('products', lang);
    h += `<nav class="nav-tree" aria-label="${esc(L.section)}">`;
    h += `<a class="nav-tree-link ${active === 'landing' ? 'active' : ''}" href="${BASE}/">${esc(L.home)}</a>`;

    // 当前语言目录（按品类分页）
    h += '<div class="nav-tree-item">';
    h += `<div class="nav-tree-toggle open" role="button" tabindex="0">${esc(L.catalog)}<span class="chevron">▾</span></div>`;
    h += '<div class="nav-tree-children">';
    h += `<a class="nav-tree-page" href="${esc(hubUrl(lang))}">${esc(L.all)}</a>`;
    for (const ty of TYPE_ORDER) {
      const n = ITEMS.filter((i) => i.lang === lang && i.type === ty).length;
      if (!n) continue;
      h += `<a class="nav-tree-page" href="${esc(catUrl(lang, ty))}">${esc(typePlural(ty, lang))} <span class="pd-count">${n}</span></a>`;
    }
    h += '</div></div>';

    // 配置方案
    if (KITS.length) {
      h += '<div class="nav-tree-item">';
      h += `<div class="nav-tree-toggle ${active.startsWith('b-') ? 'open' : ''}" role="button" tabindex="0">${esc(L.kits)}<span class="chevron">▾</span></div>`;
      h += '<div class="nav-tree-children">';
      KITS.forEach((b) => {
        h += `<a class="nav-tree-page ${active === b.id ? 'active' : ''}" href="${BASE}/bundle/${esc(b.id)}/">${esc(kitName(b, lang))}</a>`;
      });
      h += '</div></div>';
    }

    // 另一语言
    h += `<a class="nav-tree-link" href="${BASE}/${other}/">${esc(L.langSwitch)}</a>`;
    h += '</nav>';
    return h;
  }

  /* ---------------- 1. 选型首页 ---------------- */
  function renderLanding(lang) {
    const L = t(lang);
    const mine = ITEMS.filter((i) => i.lang === lang);
    const nHost = mine.filter((i) => i.type === 'host').length;
    const nCam = mine.filter((i) => i.type === 'camera').length;
    const nAcc = mine.filter((i) => i.type === 'accessory').length;

    // 场景方案卡（用主机封面作视觉）
    const kitCards = KITS.map((b) => {
      const host = byId(b.host);
      if (host) claim(host);
      const img = host && host.cover ? mediaUrl(host.cover) : '';
      const n = 1 + (b.parts || []).reduce((a, p) => a + (p.qty || 1), 0);
      return `<a class="pd-kit-card" href="${BASE}/bundle/${esc(b.id)}/">
        <div class="pd-kit-img">${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(kitName(b, lang))}">` : ''}</div>
        <div class="pd-kit-body">
          <h3>${esc(kitName(b, lang))}</h3>
          <p>${esc(kitSummary(b, lang))}</p>
          <div class="pd-chips">${(b.highlights || []).slice(0, 4).map((x) => `<span class="pd-chip">${esc(x)}</span>`).join('')}</div>
          <span class="pd-kit-more">${esc(L.viewKit)} · ${n} ${esc(L.items)} <span aria-hidden="true">→</span></span>
        </div>
      </a>`;
    }).join('');

    // 品类卡（取该品类前 3 张图做拼贴）
    const typeCards = TYPE_ORDER.map((ty) => {
      const list = mine.filter((i) => i.type === ty);
      if (!list.length) return '';
      const pics = list.filter((i) => i.cover).slice(0, 3);
      pics.forEach((p) => addRel(p.cover));
      return `<a class="pd-type-card" href="${esc(catUrl(lang, ty))}">
        <div class="pd-type-pics">${pics.map((p) => `<img loading="lazy" src="${esc(mediaUrl(p.cover))}" alt="${esc(p.name)}">`).join('')}</div>
        <div class="pd-type-info">
          <span class="pd-type-ico">${icon(ty)}</span>
          <div>
            <h3>${esc(typePlural(ty, lang))}</h3>
            <div class="pd-type-n">${list.length} ${esc(L.items)}</div>
          </div>
          <span class="pd-arrow" aria-hidden="true">→</span>
        </div>
      </a>`;
    }).join('');

    // 主机产品线
    const lines = [];
    mine.filter((i) => i.type === 'host').forEach((i) => {
      const key = i.lineKey || i.line || '';
      if (!key) return;
      let g = lines.find((x) => x.key === key);
      if (!g) { g = { key, label: i.line || key, n: 0 }; lines.push(g); }
      g.n++;
    });
    const lineChips = lines.map((g) =>
      `<a class="pd-line-chip" href="${esc(catUrl(lang, 'host'))}">${esc(g.label)}<span class="pd-count">${g.n}</span></a>`).join('');

    const content = `
    <section class="pd-hero">
      <h1>${esc(L.heroTitle)}</h1>
      <p class="pd-hero-sub">${esc(L.heroSub)}</p>
      <div class="pd-stats">
        <span><b>${nHost}</b> ${esc(typePlural('host', lang))}</span>
        <span><b>${nCam}</b> ${esc(typePlural('camera', lang))}</span>
        <span><b>${nAcc}</b> ${esc(typePlural('accessory', lang))}</span>
        <span><b>${KITS.length}</b> ${esc(L.kits)}</span>
      </div>
      <div class="pd-hero-actions">
        <a class="pd-btn pd-btn-primary" href="${esc(catUrl(lang, 'host'))}">${esc(typePlural('host', lang))} →</a>
        <a class="pd-btn" href="#kits">${esc(L.byScene)}</a>
      </div>
    </section>

    <section class="pd-sec" id="kits">
      <div class="pd-sec-head"><h2>${esc(L.byScene)}</h2><p>${esc(L.bySceneSub)}</p></div>
      <div class="pd-kit-grid">${kitCards}</div>
    </section>

    <section class="pd-sec">
      <div class="pd-sec-head"><h2>${esc(L.byType)}</h2><p>${esc(L.byTypeSub)}</p></div>
      <div class="pd-type-grid">${typeCards}</div>
    </section>

    ${lineChips ? `<section class="pd-sec">
      <div class="pd-sec-head"><h2>${esc(L.byLine)}</h2></div>
      <div class="pd-line-row">${lineChips}</div>
    </section>` : ''}`;

    const other = lang === 'zh' ? 'en' : 'zh';
    return shell({
      lang, title: L.heroTitle, desc: L.heroSub,
      active: 'landing', canonical: lang === 'zh' ? BASE + '/zh/' : BASE + '/en/',
      alternates: [{ lang: other, href: other === 'en' ? '/en/' : '/zh/' }],
      xDefault: '/en/',
      bodyClass: 'pd-landing',
      breadcrumb: breadcrumb([{ label: L.section }]),
      content,
    });
  }

  /* ---------------- 2. 产品目录 ---------------- */
  function renderCatalog(lang, type) {
    const L = t(lang);
    const mine = ITEMS.filter((i) => i.lang === lang);
    const single = !!type;
    const list = single ? mine.filter((i) => i.type === type) : mine;
    const typesToShow = single ? [type] : TYPE_ORDER;

    // 分区：主机按产品线二级分组，其余平铺
    let sections = '';
    for (const ty of typesToShow) {
      const list = mine.filter((i) => i.type === ty);
      if (!list.length) continue;
      let inner = '';
      if (ty === 'host') {
        const groups = [];
        list.forEach((i) => {
          const key = i.lineKey || i.line || '—';
          let g = groups.find((x) => x.key === key);
          if (!g) { g = { key, label: i.line || key, list: [] }; groups.push(g); }
          g.list.push(i);
        });
        inner = groups.map((g) => `<div class="pd-subgroup" data-line="${esc(g.key)}">
          <h3 class="pd-subgroup-title">${esc(g.label)}<span class="pd-count">${g.list.length}</span></h3>
          <div class="pd-grid">${g.list.map(productCard).join('')}</div>
        </div>`).join('');
      } else {
        inner = `<div class="pd-grid">${list.map(productCard).join('')}</div>`;
      }
      sections += `<section class="pd-group" id="${ty}" data-group="${ty}">
        <h2 class="pd-group-title"><span class="pd-group-ico">${icon(ty)}</span>${esc(typePlural(ty, lang))}<span class="pd-count">${list.length}</span></h2>
        ${inner}
      </section>`;
    }

    const filters = single ? '' : ['all', ...TYPE_ORDER].map((x, i) =>
      `<button class="pd-filter${i === 0 ? ' active' : ''}" data-filter="${x}" type="button">${esc(x === 'all' ? L.all : typePlural(x, lang))}${x === 'all' ? '' : `<span class="pd-count">${mine.filter((i2) => i2.type === x).length}</span>`}</button>`).join('');

    const content = `
    <div class="pd-cat-head">
      <h1>${esc(single ? typePlural(type, lang) : L.catalog)}</h1>
      <p class="pd-cat-sub">${esc(L.byTypeSub)}</p>
    </div>
    <div class="pd-toolbar">
      <div class="pd-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="pdSearch" placeholder="${esc(L.search)}" autocomplete="off" aria-label="${esc(L.search)}">
      </div>
      ${filters ? `<div class="pd-filters">${filters}</div>` : ''}
      <div class="pd-result-n" id="pdCount">${list.length} ${esc(L.results)}</div>
    </div>
    <div id="pdSections">${sections}</div>
    <p class="pd-empty" id="pdEmpty" hidden>${esc(L.noResult)}</p>
    <script>
    (function(){
      var cards=[].slice.call(document.querySelectorAll('.pd-card'));
      var input=document.getElementById('pdSearch');
      var countEl=document.getElementById('pdCount');
      var emptyEl=document.getElementById('pdEmpty');
      var TYPES=['all','host','camera','accessory'];
      var state={type:${single ? JSON.stringify(type) : "'all'"},q:''};
      function apply(){
        var q=state.q.trim().toLowerCase();
        var shown=0;
        cards.forEach(function(c){
          var okT=state.type==='all'||c.getAttribute('data-type')===state.type;
          var okQ=!q||(c.getAttribute('data-hay')||'').indexOf(q)>=0;
          var ok=okT&&okQ;
          c.hidden=!ok; if(ok)shown++;
        });
        // 空分组隐藏
        [].forEach.call(document.querySelectorAll('.pd-subgroup'),function(g){
          g.hidden=!g.querySelector('.pd-card:not([hidden])');
        });
        [].forEach.call(document.querySelectorAll('.pd-group'),function(g){
          g.hidden=!g.querySelector('.pd-card:not([hidden])');
        });
        countEl.textContent=shown+' '+${JSON.stringify(L.results)};
        emptyEl.hidden=shown>0;
        [].forEach.call(document.querySelectorAll('.pd-filter'),function(b){
          b.classList.toggle('active',b.getAttribute('data-filter')===state.type);
        });
      }
      var bar=document.querySelector('.pd-filters');
      if(bar)bar.addEventListener('click',function(e){
        var b=e.target.closest('.pd-filter'); if(!b)return;
        state.type=b.getAttribute('data-filter');
        if(location.hash.replace('#','')!==state.type){
          history.replaceState(null,'',state.type==='all'?location.pathname:'#'+state.type);
        }
        apply();
      });
      if(input){
        var tmr;
        input.addEventListener('input',function(){
          clearTimeout(tmr);
          tmr=setTimeout(function(){state.q=input.value;apply();},120);
        });
      }
      function fromHash(){
        var h=location.hash.replace('#','');
        state.type=TYPES.indexOf(h)>=0?h:${single ? JSON.stringify(type) : "'all'"};
        apply();
      }
      fromHash();
      window.addEventListener('hashchange',fromHash);
    })();
    </script>`;

    const title = single ? typePlural(type, lang) : L.catalog;
    const desc = single ? typePlural(type, lang) + ' — ' + L.byTypeSub : L.byTypeSub;
    const canonical = single ? catUrl(lang, type) : BASE + '/' + lang + '/';
    const other = lang === 'zh' ? 'en' : 'zh';
    const jsonld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + BASE + '/item/' + it.id + '/', name: it.name })),
    });
    return shell({
      lang, title, desc,
      active: single ? 'cat-' + type + '-' + lang : 'catalog-' + lang,
      canonical, jsonld,
      alternates: single ? [{ lang: other, href: other === 'en' ? '/en/' + type + '/' : '/zh/' + type + '/' }] : [{ lang: other, href: other === 'en' ? '/en/' : '/zh/' }],
      xDefault: single ? '/en/' + type + '/' : '/en/',
      bodyClass: 'pd-catalog',
      breadcrumb: breadcrumb(single
        ? [{ label: L.section, href: BASE + '/' }, { label: typePlural(type, lang) }]
        : [{ label: L.section, href: BASE + '/' }, { label: L.catalog }]),
      content,
    });
  }

  /* ---------------- 3. 产品详情（两栏 PDP） ---------------- */
  function renderItem(it) {
    const lang = it.lang;
    const L = t(lang);
    claim(it);
    const spec = specHtml(it);

    const imgs = (it.gallery || []).map(mediaUrl);
    const main = it.cover ? mediaUrl(it.cover) : (imgs[0] || '');
    const thumbs = imgs.length > 1
      ? `<div class="pd-thumbs">${imgs.map((g, i) =>
        `<button class="pd-thumb${i === 0 ? ' active' : ''}" type="button" data-full="${esc(g)}" aria-label="image ${i + 1}"><img loading="lazy" src="${esc(g)}" alt="${esc(it.name)}"></button>`).join('')}</div>`
      : '';

    // 关键参数表
    const ks = (it.keySpecs || []).slice(0, 8);
    const specTable = ks.length
      ? `<div class="pd-keyspec">
          <h2>${esc(L.keySpec)}</h2>
          <table><tbody>${ks.map((s) =>
        `<tr><th>${esc(s.k)}</th><td>${esc(s.v)}</td></tr>`).join('')}</tbody></table>
        </div>`
      : '';

    const dl = it.specDocx
      ? `<a class="pd-btn pd-btn-primary" href="${esc(mediaUrl(it.specDocx))}" download>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ${esc(L.download)}</a>`
      : '';
    const mailSubject = encodeURIComponent(`[${lang === 'zh' ? '产品咨询' : 'Product enquiry'}] ${it.name}${it.modelCode ? ' / ' + it.modelCode : ''}`);
    const inquiry = `<a class="pd-btn" href="mailto:${esc((deps.CONTACT_EMAIL || 'sales@mdvrfaq.com'))}?subject=${mailSubject}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
      ${esc(L.inquiry)}</a>`;

    const kits = kitsOf(it.id);
    const kitBlock = kits.length
      ? `<div class="pd-usedin"><span class="pd-usedin-label">${esc(L.usedIn)}</span>
          ${kits.map((b) => `<a class="pd-chip-link" href="${BASE}/bundle/${esc(b.id)}/">${esc(kitName(b, lang))}</a>`).join('')}</div>`
      : '';

    const fullSpec = spec
      ? `<section class="pd-sec pd-fullspec">
          <h2>${esc(L.fullSpec)}</h2>
          <div class="article-content pd-spec-body">${spec}</div>
        </section>`
      : (it.specDocx ? '' : `<section class="pd-sec"><p class="pd-nospec">${esc(L.noSpec)}</p></section>`);

    const related = ITEMS.filter((r) => r.lang === lang && r.type === it.type && r.id !== it.id).slice(0, 6);
    const relBlock = related.length
      ? `<section class="pd-sec">
          <div class="pd-sec-head"><h2>${esc(L.related)}</h2></div>
          <div class="pd-grid pd-grid-sm">${related.map(productCard).join('')}</div>
        </section>`
      : '';

    const relDocs = (docsForProduct[it.id] || []).slice(0, 8);
    const docBlock = relDocs.length
      ? `<section class="pd-sec pd-rel-docs">
          <div class="pd-sec-head"><h2>${esc(L.relDocs)}</h2></div>
          <ul class="pd-doc-list">${relDocs.map((d) => `<li><a href="${esc(d.url)}">${esc(d.title)}</a></li>`).join('')}</ul>
        </section>`
      : '';

    const peers = ITEMS.filter((r) => r.lang === lang && r.type === it.type);
    const pIdx = peers.findIndex((r) => r.id === it.id);
    const prevIt = pIdx > 0 ? peers[pIdx - 1] : null;
    const nextIt = (pIdx >= 0 && pIdx < peers.length - 1) ? peers[pIdx + 1] : null;
    const navLink = (r, dir) => r
      ? `<a class="pd-pn-link pd-pn-${dir}" href="${BASE}/item/${esc(r.id)}/">
          <span class="pd-pn-dir">${dir === 'prev' ? '← ' + L.prev : L.next + ' →'}</span>
          <span class="pd-pn-name">${esc(r.name)}</span>
        </a>`
      : `<span class="pd-pn-link pd-pn-empty"></span>`;
    const pnBlock = (prevIt || nextIt)
      ? `<nav class="pd-prevnext" aria-label="product navigation">${navLink(prevIt, 'prev')}${navLink(nextIt, 'next')}</nav>`
      : '';

    const jsonld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product',
      name: it.name + (it.modelCode ? ' ' + it.modelCode : ''),
      category: typeLabel(it.type, lang),
      ...(it.modelCode ? { model: it.modelCode } : {}),
      ...(it.summary ? { description: it.summary } : {}),
      ...(main ? { image: SITE_URL + main } : {}),
      brand: { '@type': 'Brand', name: SITE_NAME },
    });

    const content = `
    <article class="pd-item">
      <div class="pd-pdp">
        <div class="pd-pdp-media">
          <div class="pd-main article-content">${main
        ? `<img id="pdMainImg" src="${esc(main)}" alt="${esc(it.name)}">`
        : `<span class="pd-noimg">${esc(it.name.slice(0, 2))}</span>`}</div>
          ${thumbs}
        </div>
        <div class="pd-pdp-info">
          <span class="pd-tag pd-tag-${esc(it.type)}">${esc(typeLabel(it.type, lang))}</span>
          ${it.line ? `<span class="pd-tag pd-tag-line">${esc(it.line)}</span>` : ''}
          <h1>${esc(it.name)}</h1>
          ${it.modelCode ? `<div class="pd-model"><span>${esc(L.model)}</span> ${esc(it.modelCode)}</div>` : ''}
          ${it.summary ? `<p class="pd-summary">${esc(it.summary)}</p>` : ''}
          ${specTable}
          <div class="pd-actions">${dl}${inquiry}</div>
          ${kitBlock}
        </div>
      </div>
      ${fullSpec}
      ${relBlock}
      ${docBlock}
      ${pnBlock}
    </article>
    <script>
    (function(){
      var m=document.getElementById('pdMainImg'); if(!m)return;
      [].forEach.call(document.querySelectorAll('.pd-thumb'),function(b){
        b.addEventListener('click',function(){
          [].forEach.call(document.querySelectorAll('.pd-thumb'),function(x){x.classList.remove('active');});
          b.classList.add('active'); m.src=b.getAttribute('data-full');
        });
      });
    })();
    </script>`;

    return shell({
      lang, title: it.name + (it.modelCode ? ' ' + it.modelCode : ''),
      desc: it.summary || `${typeLabel(it.type, lang)} ${it.name}`,
      active: it.id, canonical: BASE + '/item/' + it.id + '/',
      bodyClass: 'pd-item-page', jsonld,
      breadcrumb: breadcrumb([
        { label: L.section, href: BASE + '/' },
        { label: typePlural(it.type, lang), href: catUrl(lang, it.type) },
        { label: it.name },
      ]),
      content,
    });
  }

  /* ---------------- 4. 配置方案 ---------------- */
  function renderBundle(b) {
    const lang = b.lang || 'zh';
    const L = t(lang);
    const host = byId(b.host);
    const rows = [];
    if (host) { claim(host); rows.push({ it: host, qty: 1, role: L.hostRole, isHost: true }); }
    (b.parts || []).forEach((p) => {
      const it = byId(p.id);
      if (!it) return;
      claim(it);
      rows.push({ it, qty: p.qty || 1, role: p.role || '' });
    });
    const total = rows.reduce((a, r) => a + r.qty, 0);

    const tableRows = rows.map((r, i) => `<tr${r.isHost ? ' class="pd-row-host"' : ''}>
      <td class="pd-td-n">${i + 1}</td>
      <td class="pd-td-img"><a href="${BASE}/item/${esc(r.it.id)}/">${r.it.cover
      ? `<img loading="lazy" src="${esc(mediaUrl(r.it.cover))}" alt="${esc(r.it.name)}">`
      : `<span class="pd-noimg">${esc(r.it.name.slice(0, 2))}</span>`}</a></td>
      <td><span class="pd-tag pd-tag-${esc(r.it.type)}">${esc(typeLabel(r.it.type, lang))}</span></td>
      <td class="pd-td-name">
        <a href="${BASE}/item/${esc(r.it.id)}/">${esc(r.it.name)}</a>
        ${r.it.modelCode ? `<div class="pd-td-model">${esc(r.it.modelCode)}</div>` : ''}
      </td>
      <td class="pd-td-qty">×${r.qty}</td>
      <td class="pd-td-role">${esc(r.role)}</td>
    </tr>`).join('');

    const others = KITS.filter((k) => k.id !== b.id);
    const relatedHtml = others.length ? `
      <section class="pd-sec pd-related">
        <div class="pd-sec-head"><h2>${esc(L.otherKits)}</h2></div>
        <div class="pd-kit-grid">${others.map((k) => {
          const kh = byId(k.host);
          const kimg = kh && kh.cover ? mediaUrl(kh.cover) : '';
          return `<a class="pd-kit-card" href="${BASE}/bundle/${esc(k.id)}/">
            <div class="pd-kit-img">${kimg ? `<img loading="lazy" src="${esc(kimg)}" alt="${esc(kitName(k, lang))}">` : ''}</div>
            <div class="pd-kit-body">
              <h3>${esc(kitName(k, lang))}</h3>
              <p>${esc(kitSummary(k, lang))}</p>
              <span class="pd-kit-more">${esc(L.viewKit)} →</span>
            </div>
          </a>`;
        }).join('')}</div>
      </section>` : '';

    const content = `
    <article class="pd-bundle">
      <header class="pd-bundle-hero">
        <span class="pd-tag pd-tag-kit">${esc(L.kits)}</span>
        <h1>${esc(kitName(b, lang))}</h1>
        <p class="pd-bundle-sum">${esc(kitSummary(b, lang))}</p>
        <div class="pd-chips">${(b.highlights || []).map((x) => `<span class="pd-chip">${esc(x)}</span>`).join('')}</div>
      </header>

      <section class="pd-sec">
        <div class="pd-sec-head">
          <h2>${esc(L.config)}</h2>
          <p>${rows.length} ${esc(L.product)} · ${total} ${esc(L.items)}</p>
        </div>
        <div class="pd-table-wrap">
          <table class="pd-table">
            <thead><tr>
              <th>#</th><th></th><th>${esc(L.type)}</th><th>${esc(L.product)}</th>
              <th>${esc(L.qty)}</th><th>${esc(L.role)}</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </section>

      ${relatedHtml}

      <section class="pd-help">
        <h2>${esc(L.helpTitle)}</h2>
        <p>${esc(L.helpText)}</p>
      </section>
    </article>`;

    return shell({
      lang, title: kitName(b, lang), desc: kitSummary(b, lang),
      active: b.id, canonical: BASE + '/bundle/' + b.id + '/',
      bodyClass: 'pd-bundle-page',
      breadcrumb: breadcrumb([
        { label: L.section, href: BASE + '/' },
        { label: L.kits, href: BASE + '/' },
        { label: kitName(b, lang) },
      ]),
      content,
    });
  }

  return { BASE, WEB, MEDIA, ITEMS, KITS, COPY, T, t, typeLabel, typePlural, TYPE_ORDER, icon,
    kitName, kitSummary, breadcrumb, thumb, productCard, shell, sidebar, mediaUrl, specHtml,
    claim, byId, kitsOf, addRel, addWeb,
    renderLanding, renderCatalog, renderItem, renderBundle };
};
