/**
 * 把 catalog.json 中全部 specDocx 转换为 spec.html，
 * 并将 docx 内嵌图片提取为独立文件（spec-images/），
 * 在 HTML 中以绝对 web 路径引用：
 *   /assets/products-media/<lang>/<type>/<id>/spec-images/img-N.<ext>
 *
 * 该脚本只负责“源 -> 中间产物”（写入 data/accessories/media/.../spec.html），
 * 真正拷入 dist 由 build.js 在生成页面时按引用清单拷贝。
 *
 * 用法:
 *   NODE_PATH='C:\Users\34492\.workbuddy\binaries\node\workspace\node_modules' node tools/convert_specs.js
 */
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const ACC_DATA = path.resolve(__dirname, '../data/accessories');
const CATALOG = path.join(ACC_DATA, 'catalog.json');
const MEDIA = path.join(ACC_DATA, 'media'); // data/accessories/media
const WEB_BASE = '/assets/products-media';

const CT_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
  'image/x-emf': 'emf', 'image/x-wmf': 'wmf', 'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

function extFromContentType(ct) {
  return CT_EXT[String(ct || '').toLowerCase()] || 'png';
}

async function convertItem(item) {
  if (!item.specDocx) return { id: item.id, ok: false, reason: 'no specDocx' };
  // specDocx 形如 media/zh/accessory/acc-zh-A01/spec.docx
  const docxPath = path.join(ACC_DATA, item.specDocx);
  if (!fs.existsSync(docxPath)) return { id: item.id, ok: false, reason: 'docx missing' };

  const itemDir = path.dirname(docxPath); // data/accessories/media/<lang>/<type>/<id>
  const relDir = path.relative(MEDIA, itemDir).replace(/\\/g, '/'); // <lang>/<type>/<id>
  const imgDir = path.join(itemDir, 'spec-images');
  fs.mkdirSync(imgDir, { recursive: true });

  let n = 0;
  const convertImage = mammoth.images.imgElement(function (image) {
    return image.read().then(function (buffer) {
      n++;
      const ext = extFromContentType(image.contentType);
      const fname = 'img-' + n + '.' + ext;
      fs.writeFileSync(path.join(imgDir, fname), buffer);
      return { src: WEB_BASE + '/' + relDir + '/spec-images/' + fname };
    });
  });

  try {
    const res = await mammoth.convertToHtml({ path: docxPath }, { convertImage });
    let html = res.value;
    // 懒加载 + 异步解码
    html = html.replace(/<img\s/g, '<img loading="lazy" decoding="async" ');
    fs.writeFileSync(path.join(itemDir, 'spec.html'), html, 'utf8');
    const imgs = (html.match(/<img/g) || []).length;
    const tables = (html.match(/<table/g) || []).length;
    const paras = (html.match(/<p/g) || []).length;
    return { id: item.id, ok: true, htmlKB: Math.round(Buffer.byteLength(html) / 1024), imgs, tables, paras, warns: res.messages.length };
  } catch (e) {
    return { id: item.id, ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

(async () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const items = catalog.items.filter(i => i.specDocx);
  console.log('待转换:', items.length);
  let done = 0, fail = 0;
  const fails = [];
  let totalImgKB = 0;
  for (const it of items) {
    const r = await convertItem(it);
    if (r.ok) {
      done++;
      totalImgKB += r.imgs * 0; // placeholder
      if (done % 20 === 0) console.log('  进度', done, '/', items.length);
    } else {
      fail++;
      fails.push(r);
      console.error('  ✗', r.id, r.reason);
    }
  }
  console.log('✅ 转换完成: 成功', done, '失败', fail);
  if (fails.length) console.log('失败明细:', JSON.stringify(fails, null, 2));

  // 统计 spec-images 体积
  let imgBytes = 0, imgCount = 0;
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      const s = fs.statSync(fp);
      if (s.isDirectory()) walk(fp);
      else if (path.basename(path.dirname(fp)) === 'spec-images') { imgBytes += s.size; imgCount++; }
    }
  })(MEDIA);
  console.log('spec-images 图片:', imgCount, '张,', (imgBytes / 1048576).toFixed(1), 'MB');
})();
