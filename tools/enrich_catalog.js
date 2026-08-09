/**
 * 数据富化：从已转换的 spec.html 中提取结构化信息，输出 catalog.enriched.json
 *  - modelCode : 真实产品型号（如 MX-AHDH-110B-ANP-015）
 *  - summary   : 产品简介/特点摘要
 *  - keySpecs  : 按品类白名单挑选的关键参数（用于卡片 chips 与详情页参数表）
 *  - name      : 清洗后的展示名（去掉源文件夹的 A/B/C 字母前缀）
 *  - line      : 清洗后的产品线（去掉 "1 " 数字前缀）
 * 不修改原 catalog.json。
 */
const fs = require('fs');
const path = require('path');

const ACC_DIR = path.resolve(__dirname, '../data/accessories');
const catalog = JSON.parse(fs.readFileSync(path.join(ACC_DIR, 'catalog.json'), 'utf8'));

/* ---------- 工具 ---------- */
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

function tableRows(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((m) => stripTags(m[1])));
}

// 表头行 / 无意义键
const SKIP_KEYS = new Set(['项目', '参数说明', '参数', 'item', 'items', 'project', 'parameter',
  'parameters', 'description', 'no', 'no.', '序号', '功能码', '备注']);

function specMap(html) {
  const map = new Map();
  for (const cells of tableRows(html)) {
    if (cells.length < 2) continue;
    // 三列及以上：最后两列是 键/值（首列多为分组名）
    const k = cells[cells.length - 2];
    const v = cells[cells.length - 1];
    if (!k || !v) continue;
    if (k.length > 16 || v.length > 90) continue;
    if (SKIP_KEYS.has(k.toLowerCase())) continue;
    if (k === v) continue;
    if (!map.has(k)) map.set(k, v);
  }
  return map;
}

/* ---------- 关键参数白名单（按顺序取） ---------- */
const KEY_SPECS = {
  camera: {
    zh: ['解析度', '视频分辨率', '像素', '图像传感器', '镜头', '水平角度', '最低照度',
      '红外灯照射距离', '防护等级', '插口', '电源', '工作温度'],
    en: ['Resolution', 'Pixel', 'Image sensor', 'Lens', 'Angle', 'Horizontal angle',
      'Minimum illumination', 'Protection level', 'Interface', 'Power', 'Working temperature'],
  },
  host: {
    zh: ['AHD输入', '音视频输入', '视频编码', '视频分辨率', 'SD卡', 'TF卡', '硬盘', '存储',
      '4G无线', 'WIFI', '北斗/GPS', 'RS232', 'RS485', '尺寸', '外观尺寸', '工作温度'],
    en: ['AHD input', 'Video input', 'Video Encoding', 'Video encoding', 'Resolution',
      'SD card', 'TF card', 'Hard disk', 'WIFI', '4G', 'GPS', 'RS232', 'RS485',
      'Size', 'Working temperature'],
  },
  accessory: {
    zh: ['型号', '解析度', '电源', '工作电压', '通讯方式', '接口', '插口', '防护等级',
      '尺寸', '外观尺寸', '工作温度', '功率消耗'],
    en: ['Model', 'Resolution', 'Power', 'Voltage', 'Interface', 'Protection level',
      'Size', 'Working temperature', 'Power consumption'],
  },
};

// 卡片 chips 优先展示的"卖点型"参数（短、可比较）
const CHIP_KEYS = {
  camera: {
    zh: ['解析度', '视频分辨率', '镜头', '水平角度', '防护等级'],
    en: ['Resolution', 'Lens', 'Angle', 'Protection level'],
  },
  host: {
    zh: ['AHD输入', '视频编码', 'SD卡', 'TF卡', '硬盘', 'WIFI'],
    en: ['AHD input', 'Video Encoding', 'SD card', 'TF card', 'WIFI'],
  },
  accessory: {
    zh: ['电源', '工作电压', '接口', '通讯方式', '防护等级'],
    en: ['Power', 'Voltage', 'Interface', 'Protection level'],
  },
};

/* ---------- 型号提取 ---------- */
function pickModel(text, map) {
  for (const k of ['型号', '产品型号', 'Model', 'MODEL', 'Model No.']) {
    if (map.has(k)) {
      const v = map.get(k);
      if (v && v.length <= 60 && !/^[/\-—\s]*$/.test(v)) return v;
    }
  }
  const m = text.match(/(?:产品型号|型号)\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9\-_.,&×*\s]{2,50})/);
  if (m) return m[1].trim().replace(/[,，]\s*$/, '');
  return '';
}

/* ---------- 简介提取 ---------- */
function pickSummary(html) {
  // 段落文本（排除表格内的）
  const noTables = html.replace(/<table[\s\S]*?<\/table>/gi, ' ');
  const paras = [...noTables.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t && t.length >= 18)
    // 排除「型号：xxx」「Model: xxx」这类非描述性行
    .filter((t) => !/^(产品型号|型号|(Product\s+)?Model(\s+No\.?)?|Type)\s*[:：]/i.test(t))
    .filter((t) => !/^(参数规格|规格参数|核心参数|尺寸规格|型号注释|Specification|Dimension)/i.test(t));

  // 优先「产品简介」之后的段落
  const idx = paras.findIndex((t) => /^(产品简介|产品介绍|Product\s+(Introduction|Description))/i.test(t));
  if (idx >= 0) {
    for (let i = idx; i < Math.min(idx + 3, paras.length); i++) {
      const t = paras[i].replace(/^(产品简介|产品介绍|Product\s+(Introduction|Description))\s*[:：]?\s*/i, '');
      if (t.length >= 24) return clip(t);
    }
  }
  // 其次「产品特点/优势」列表首条
  const feat = paras.find((t) => /^[◎●※•*]/.test(t) && t.length >= 20);
  if (feat) return clip(feat.replace(/^[◎●※•*]\s*/, ''));

  const first = paras.find((t) => t.length >= 28 && !/^(参数规格|规格参数|核心参数|尺寸规格)/.test(t));
  return first ? clip(first) : '';
}
function clip(s, n = 140) {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n).replace(/[，,、;；]$/, '') + '…' : s;
}

/* ---------- 名称与产品线清洗 ---------- */
function cleanName(item) {
  let n = String(item.name || '').replace(/\s+/g, ' ').trim();
  // 源文件夹的字母分组前缀： "A AI提醒器" -> "AI提醒器"、"J  机芯" -> "机芯"
  if (item.group && /^[A-Za-z]$/.test(item.group)) {
    const re = new RegExp('^' + item.group + '\\s+', 'i');
    n = n.replace(re, '').trim();
  }
  n = n.replace(/^[A-Z]\s{1,3}(?=[\u4e00-\u9fa5])/, '').trim();
  return n;
}
function cleanLine(line) {
  return String(line || '').replace(/^\d+[\s.、]*/, '').trim();
}

// 英文产品线本地化（源目录命名较随意，统一为清晰叫法）
const LINE_ALIAS = {
  '布控球': '布控球 / 应急球机',
  'Emergency deployment ptz cameras': 'Emergency PTZ',
  'Drone image transmission': 'Body-worn / Image Transmission',
  '单兵': '单兵 / 图传',
  '4G摄像头': '4G 一体机',
  '4G Camera': '4G All-in-one',
  '车载': '车载 MDVR',
  'MDVR': 'Vehicle MDVR',
};

/* ---------- 主流程 ---------- */
let nModel = 0; let nSummary = 0; let nSpecs = 0; let nSpecFiles = 0;

const items = catalog.items.map((raw) => {
  const it = { ...raw };
  it.name = cleanName(raw);
  const lineRaw = cleanLine(raw.line);
  it.line = LINE_ALIAS[lineRaw] || lineRaw;
  it.lineKey = lineRaw; // 用于分组归类

  const specPath = path.join(ACC_DIR, 'media', raw.lang, raw.type, raw.id, 'spec.html');
  if (fs.existsSync(specPath)) {
    nSpecFiles++;
    const html = fs.readFileSync(specPath, 'utf8');
    const text = stripTags(html.slice(0, 6000));
    const map = specMap(html);

    const model = pickModel(text, map);
    if (model) { it.modelCode = model; nModel++; }

    const sum = pickSummary(html);
    if (sum) { it.summary = sum; nSummary++; }

    const wl = (KEY_SPECS[raw.type] || KEY_SPECS.accessory)[raw.lang] || [];
    const specs = [];
    for (const k of wl) {
      if (map.has(k)) {
        const v = map.get(k);
        if (v && !/^[/\-—\s]*$/.test(v)) specs.push({ k, v: clip(v, 46) });
      }
      if (specs.length >= 8) break;
    }
    if (specs.length) { it.keySpecs = specs; nSpecs++; }

    const ck = (CHIP_KEYS[raw.type] || CHIP_KEYS.accessory)[raw.lang] || [];
    const chips = [];
    for (const k of ck) {
      if (map.has(k)) {
        const v = map.get(k);
        if (v && v.length <= 22 && !/^[/\-—\s]*$/.test(v)) chips.push(v);
      }
      if (chips.length >= 3) break;
    }
    if (chips.length) it.chips = chips;
  }
  return it;
});

// 分类修正：布控球「附件」不是主机
for (const it of items) {
  if (it.type === 'host' && /附件|accessor/i.test(it.name)) {
    it.type = 'accessory';
    it.reclassified = true;
  }
}

const out = { generatedAt: new Date().toISOString(), items };
fs.writeFileSync(path.join(ACC_DIR, 'catalog.enriched.json'), JSON.stringify(out, null, 1), 'utf8');

const byType = items.reduce((a, i) => { a[i.type] = (a[i.type] || 0) + 1; return a; }, {});
const lines = [...new Set(items.filter((i) => i.type === 'host').map((i) => i.lang + ':' + i.line))];
console.log('items:', items.length, '| byType:', JSON.stringify(byType));
console.log('spec.html found:', nSpecFiles, '| modelCode:', nModel, '| summary:', nSummary, '| keySpecs:', nSpecs);
console.log('host lines:', lines.join(' , '));
console.log('reclassified:', items.filter((i) => i.reclassified).map((i) => i.id).join(', ') || 'none');
