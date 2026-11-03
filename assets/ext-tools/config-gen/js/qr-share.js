/* 配置生成器「二维码」弹窗增强：亮码 + 分享（2026-11-03）
   移植自 /tools/qrconfig-zh.html|qrconfig-en.html 的同名功能。
   - 自包含、双语（按 <html lang> 选择文案），不改 mdvr-config.min.js，
     上游升级后由 tools/import-config-gen.js 重新注入本 <script> 标签。
   - qrcodejs 实例被主脚本闭包吞掉，这里从弹窗画布像素反解模块矩阵
     （对 21,25,…,177 逐个验证三点定位图案 + 校正图案，唯一确定规格）。 */
(function () {
  'use strict';

  var ZH = /^zh/i.test(document.documentElement.lang || 'zh-CN');
  var T = ZH ? {
    bright: '亮码',
    share: '分享',
    bright_hint: '点击任意处或按 Esc 退出 · 建议把屏幕亮度调到最高',
    no_qr: '还没有可扫码的内容，请先在左侧填写字段',
    copied: '二维码图片已复制 — 去微信 / 企业微信聊天窗口 Ctrl+V 发送',
    downloaded: '二维码图片已下载（MDVR-Config-QR.png），可直接发送',
    fallback: '微信内无法直接分享，请长按二维码图片保存后再发送',
    share_title: 'MDVR 配置二维码',
    share_desc: '用设备摄像头扫码即可导入配置',
    aria_bright: '全屏亮码，方便设备扫描',
    aria_share: '分享二维码图片'
  } : {
    bright: 'Show code',
    share: 'Share',
    bright_hint: 'Tap anywhere or press Esc to close · Turn screen brightness up',
    no_qr: 'Nothing to encode yet — fill in a field first',
    copied: 'QR image copied — paste it (Ctrl+V) into a WeChat / WhatsApp chat',
    downloaded: 'QR image downloaded (MDVR-Config-QR.png) — send it via chat',
    fallback: 'In-app browsers cannot share directly. Long-press the QR image to save it, then send it.',
    share_title: 'MDVR config QR code',
    share_desc: 'Scan with the device camera to import the config',
    aria_bright: 'Show QR fullscreen for reliable scanning',
    aria_share: 'Share QR image'
  };

  function $(id) { return document.getElementById(id); }

  var matrix = null; /* 弹窗当前二维码的模块矩阵 { n, dark(y,x) } */

  /* ── 从画布像素反解模块矩阵 ───────────────────────────── */
  function extractMatrix() {
    var box = $('qr-box');
    if (!box) return null;
    var cv = box.querySelector('canvas');
    if (cv && cv.width && cv.height) return fromCanvas(cv);
    var img = box.querySelector('img');
    if (img && img.complete && img.naturalWidth) {
      var t = document.createElement('canvas');
      t.width = img.naturalWidth;
      t.height = img.naturalHeight;
      t.getContext('2d').drawImage(img, 0, 0);
      return fromCanvas(t);
    }
    return null;
  }

  function fromCanvas(cv) {
    var w = cv.width, h = cv.height, ctx;
    if (!w || w !== h) return null;
    try { ctx = cv.getContext('2d'); } catch (e) { return null; }
    if (!ctx) return null;
    var d;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    /* 上游 qrcodejs 满幅绘制（模块宽 = 画布宽/n，可能带小数），
       包围盒恒为整张画布，因此直接枚举规格 n，
       按浮点步长采样模块中心，再用定位/校正图案验证。 */
    for (var n = 21; n <= 177; n += 4) {
      var dark = sampler(d, w, 0, 0, w / n);
      if (valid(dark, n)) return { n: n, dark: dark };
    }
    return null;
  }

  function sampler(d, w, minX, minY, cell) {
    return function (y, x) {
      var px = minX + ((x + 0.5) * cell | 0);
      var py = minY + ((y + 0.5) * cell | 0);
      var i = (py * w + px) * 4;
      return d[i] + d[i + 1] + d[i + 2] < 384;
    };
  }

  /* 定位图案 + 校正图案双重验证，排除错误规格 */
  var FINDER = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];

  function valid(dark, n) {
    function finder(ox, oy) {
      for (var y = 0; y < 7; y++) {
        for (var x = 0; x < 7; x++) {
          if (!!dark(oy + y, ox + x) !== !!FINDER[y][x]) return false;
        }
      }
      return true;
    }
    if (!finder(0, 0) || !finder(n - 7, 0) || !finder(0, n - 7)) return false;
    for (var i = 8; i < n - 8; i++) {
      if (!!dark(6, i) !== (i % 2 === 0)) return false;
      if (!!dark(i, 6) !== (i % 2 === 0)) return false;
    }
    return true;
  }

  /* ── 纯黑白大图：整数倍放大 + 4 模块静默区，转发后依然好扫 ── */
  function buildPng(m, target) {
    var quiet = 4;
    var cell = Math.max(4, Math.floor(target / (m.n + quiet * 2)));
    var side = (m.n + quiet * 2) * cell;
    var cv = document.createElement('canvas');
    cv.width = side;
    cv.height = side;
    var c = cv.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, side, side);
    c.fillStyle = '#000000';
    for (var y = 0; y < m.n; y++) {
      for (var x = 0; x < m.n; x++) {
        if (m.dark(y, x)) c.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
      }
    }
    return cv.toDataURL('image/png');
  }

  /* ── 亮码模式：全屏纯白 + 超大二维码，屏幕常亮 ─────────── */
  var wakeLock = null;

  function requestWakeLock() {
    if (!(navigator.wakeLock && navigator.wakeLock.request)) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  function ensureBright() {
    var el = $('qrs-bright');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'qrs-bright';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:1200;background:#fff;flex-direction:column;align-items:center;justify-content:center;gap:18px;cursor:pointer';
    var img = document.createElement('img');
    img.id = 'qrs-bright-img';
    img.alt = 'QR';
    img.style.cssText = 'display:block;image-rendering:pixelated;max-width:82vw;max-height:74vh';
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12.5px;color:#8f959e;line-height:1.7;text-align:center;padding:0 24px';
    hint.textContent = T.bright_hint;
    el.appendChild(img);
    el.appendChild(hint);
    el.addEventListener('click', hideBright);
    document.body.appendChild(el);
    return el;
  }

  function showBright() {
    if (!matrix) { toast(T.no_qr); return; }
    var side = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.80);
    var du = buildPng(matrix, side);
    ensureBright().querySelector('img').src = du;
    $('qrs-bright').style.display = 'flex';
    document.addEventListener('keydown', onEsc);
    var req = $('qrs-bright').requestFullscreen || $('qrs-bright').webkitRequestFullscreen;
    if (req) {
      try {
        var p = req.call($('qrs-bright'));
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
    requestWakeLock();
    if (window.__QRS) { window.__QRS.bright = true; window.__QRS.pngLen = du.length; }
  }

  function hideBright() {
    var el = $('qrs-bright');
    if (!el || el.style.display === 'none') return;
    el.style.display = 'none';
    el.querySelector('img').src = '';
    document.removeEventListener('keydown', onEsc);
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        var p = document.exitFullscreen();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
    releaseWakeLock();
  }

  function onEsc(e) {
    if (e.key === 'Escape') hideBright();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      releaseWakeLock();
    } else if ($('qrs-bright') && $('qrs-bright').style.display !== 'none') {
      requestWakeLock();
    }
  });

  /* ── 分享：手机走系统分享面板，电脑复制图片到剪贴板 ───── */
  function inAppBrowser() {
    return /MicroMessenger|MQQBrowser|QQ\//i.test(navigator.userAgent);
  }

  function isMobileUA() {
    return /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent);
  }

  function download(du) {
    var a = document.createElement('a');
    a.href = du;
    a.download = 'MDVR-Config-QR.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copyImage(blob, done) {
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      try {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(function () { done(true); })
          .catch(function () { done(false); });
        return;
      } catch (e) {}
    }
    done(false);
  }

  function shareQr() {
    if (!matrix) { toast(T.no_qr); return; }
    var du = buildPng(matrix, 640);
    if (window.__QRS) window.__QRS.pngLen = du.length;
    if (inAppBrowser()) { toast(T.fallback, 4200); return; }
    var blob = null, file = null;
    try {
      var bin = atob(du.split(',')[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: 'image/png' });
      file = new File([arr], 'MDVR-Config-QR.png', { type: 'image/png' });
    } catch (e) { blob = null; file = null; }
    /* 手机：系统分享面板可直接选微信 / 企业微信 */
    if (isMobileUA() && file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      var p = navigator.share({ files: [file], title: T.share_title, text: T.share_desc });
      if (p && p.catch) p.catch(function () {});
      return;
    }
    /* 电脑：不走 navigator.share（微信 PC 版接不住），改为复制图片，
       聊天窗口 Ctrl+V 即可发送；写不进剪贴板就退回下载 PNG */
    if (blob) {
      copyImage(blob, function (ok) {
        if (window.__QRS) window.__QRS.shared = ok ? 'copied' : 'downloaded';
        if (ok) { toast(T.copied, 4200); return; }
        download(du);
        toast(T.downloaded, 4200);
      });
      return;
    }
    if (window.__QRS) window.__QRS.shared = 'downloaded';
    download(du);
    toast(T.downloaded, 4200);
  }

  /* ── 往弹窗里注入「亮码 / 分享」按钮行 ─────────────────── */
  function ensureButtons() {
    if ($('qrs-row')) return;
    var warn = $('qr-warn');
    if (!warn || !warn.parentNode) return;
    var row = document.createElement('div');
    row.id = 'qrs-row';
    row.style.cssText = 'display:flex;gap:8px;margin-top:12px';
    var b1 = document.createElement('button');
    b1.id = 'qrs-bright-btn';
    b1.type = 'button';
    b1.title = T.aria_bright;
    b1.style.cssText = 'flex:1;height:32px;border:none;border-radius:8px;background:#103048;color:#fff;font-size:12.5px;font-weight:500;cursor:pointer;transition:.15s';
    b1.textContent = T.bright;
    b1.addEventListener('click', showBright);
    var b2 = document.createElement('button');
    b2.id = 'qrs-share-btn';
    b2.type = 'button';
    b2.title = T.aria_share;
    b2.style.cssText = 'flex:1;height:32px;border:1px solid #dae0e7;border-radius:8px;background:#fff;color:#103048;font-size:12.5px;font-weight:500;cursor:pointer;transition:.15s';
    b2.textContent = T.share;
    b2.addEventListener('click', shareQr);
    row.appendChild(b1);
    row.appendChild(b2);
    warn.insertAdjacentElement('afterend', row);
  }

  /* ── 轻量 toast ───────────────────────────────────────── */
  var toastTimer = null;

  function toast(msg, ms) {
    var el = $('qrs-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'qrs-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:1300;max-width:86vw;background:rgba(15,23,43,.92);color:#fff;font-size:12.5px;line-height:1.6;padding:10px 16px;border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .18s;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, ms || 3200);
  }

  /* ── 挂钩：弹窗每次打开时重新取矩阵 ───────────────────── */
  function boot() {
    var mask = $('qr-mask');
    if (!mask) return;
    window.__QRS = { v: 1, lang: ZH ? 'zh' : 'en', n: 0, ok: false };
    new MutationObserver(function () {
      if (mask.style.display !== 'none') {
        ensureButtons();
        matrix = extractMatrix();
        window.__QRS.n = matrix ? matrix.n : 0;
        window.__QRS.ok = !!matrix;
      }
    }).observe(mask, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
