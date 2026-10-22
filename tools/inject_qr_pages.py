#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把原站新增的两篇「扫码快速上线配置」指南(zh 674 / en 675)并入本站。
- 下载两页引用的签名图片与附件到 dist/assets/{images,files}/
- 图片转 WebP；附件按链接文本扩展名保存
- 修正内容中的图片/附件/跨站帮助文档链接为本地或本站路径
- 注入 dist/content.json 的 pages + nav（配置工具目录）
幂等：已下载的 sign 会缓存；已注入的页面会被覆盖更新。
"""
import json, os, re, shutil, hashlib, time, urllib.request
from PIL import Image
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
CONTENT = os.path.join(DIST, 'content.json')
IMG_DIR = os.path.join(DIST, 'assets', 'images')
FILE_DIR = os.path.join(DIST, 'assets', 'files')
os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(FILE_DIR, exist_ok=True)

API_BASE = "http://pug2.4000329988.com/server/index.php?s=/api/attachment/visitFile&sign="
UA = {"User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*;q=0.8"}

# zh 674 -> 配置工具(33) / en 675 -> Function--Configuration Tool(65)
PAGES = [
    {"pid": 674, "sec": "zh_docs", "cat_id": "33", "cat_name": "功能使用--配置工具"},
    {"pid": 675, "sec": "en_docs", "cat_id": "65", "cat_name": "Function--Configuration Tool"},
]

sign_map = {}   # sign -> {"local","kind"}
RAW = {}        # sign -> bytes
done_dl = set()

def download(sign):
    if sign in done_dl:
        return sign_map.get(sign)
    url = API_BASE + sign
    data = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            break
        except Exception as e:
            if attempt < 3:
                time.sleep(1)
            else:
                print("  !! 下载失败 sign=%s : %s" % (sign, e))
                return None
    if not data:
        return None
    done_dl.add(sign)
    RAW[sign] = data
    h = hashlib.sha1(sign.encode()).hexdigest()[:10]
    is_img = False
    try:
        Image.open(BytesIO(data)).verify(); is_img = True
    except Exception:
        is_img = False
    if is_img:
        im = Image.open(BytesIO(data)).convert('RGB')
        out = os.path.join(IMG_DIR, 'qr_%s.webp' % h)
        im.save(out, 'WEBP', quality=82)
        local = 'assets/images/qr_%s.webp' % h   # 相对，preprocess 转绝对
        kind = 'image'
    else:
        local = '/assets/files/qr_%s.bin' % h     # 占位，附件落盘时改扩展名
        kind = 'file'
    sign_map[sign] = {"local": local, "kind": kind}
    print("  下载 %s -> %s (%d bytes, %s)" % (sign, local, len(data), kind))
    return sign_map[sign]

IMG_RE = re.compile(r'!\[[^\]]*\]\(http://pug2\.4000329988\.com/server/index\.php\?s=/api/attachment/visitFile(?:&amp;)+sign=([0-9a-fA-F]+)[^)]*\)')
ATT_RE = re.compile(r'\[([^\]]*)\]\(http://pug2\.4000329988\.com/server/index\.php\?s=/api/attachment/visitFile(?:&amp;)+sign=([0-9a-fA-F]+)[^)]*\)')

def save_attachment(sign, target, ext):
    raw = RAW.get(sign)
    if raw is None:
        download(sign); raw = RAW.get(sign)
    if raw is None:
        return False
    os.makedirs(os.path.dirname(target), exist_ok=True)
    try:
        if ext in ('png', 'jpg', 'jpeg'):
            Image.open(BytesIO(raw)).convert('RGB').save(target, 'PNG' if ext == 'png' else 'JPEG')
        else:
            open(target, 'wb').write(raw)
        return True
    except Exception as e:
        print("  !! 附件保存失败 %s : %s" % (sign, e))
        return False

def transform(c, sec):
    # 0) 归一化 HTML 实体：双重转义 &amp;amp; -> &amp;（en 附件链接），&quot; -> "（原站导出的链接标题用了转义引号）
    c = c.replace('&amp;amp;', '&amp;')
    c = c.replace('&quot;', '"')
    # 1) 图片
    def img_repl(m):
        info = download(m.group(1))
        if not info:
            return m.group(0)
        return '![](assets/images/' + os.path.basename(info['local']) + ')'
    c = IMG_RE.sub(img_repl, c)
    # 2) 附件
    def att_repl(m):
        text = m.group(1).strip(); sign = m.group(2)
        info = download(sign)
        if not info:
            return m.group(0)
        ext = os.path.splitext(text)[1].lower().lstrip('.') or 'bin'
        h = hashlib.sha1(sign.encode()).hexdigest()[:10]
        if ext in ('png', 'jpg', 'jpeg') and info.get('kind') == 'image':
            # 图片型附件（如可打印贴纸 PNG）直接复用已生成的 webp，避免重复文件
            newlocal = 'assets/images/qr_%s.webp' % h
        else:
            newlocal = '/assets/files/qr_%s.%s' % (h, ext)
            target = os.path.join(DIST, newlocal.lstrip('/'))
            if not os.path.exists(target):
                if save_attachment(sign, target, ext):
                    print("  附件落盘 %s" % newlocal)
        return '[%s](%s)' % (text, newlocal)
    c = ATT_RE.sub(att_repl, c)
    # 3) 跨站帮助文档链接 -> 本站（仅替换裸根链接，避免误伤 qrconfig 工具外链）
    if sec == 'en_docs':
        c = c.replace('http://pug2.4000329988.com/fqa/web/#/13/64', '/en/docs/64/')
    if sec == 'zh_docs':
        c = re.sub(r'http://pug2\.4000329988\.com/fqa/(?=\))', '/zh/docs/', c)
    # 3.5) 二维码生成工具外链 -> 本站本地托管（/tools/，由 build.js 从 assets/ext-tools 同步）
    c = re.sub(r'http://pug2\.4000329988\.com/fqa/web/tools/', '/tools/', c)
    # 4) 修复转义块引用 &gt; -> >
    c = re.sub(r'(?m)^(\s*)&gt;', r'\1>', c)
    return c

def fetch_raw(pid):
    fp = os.path.join(ROOT, 'data', '_newpage_%d.json' % pid)
    if not os.path.exists(fp):
        raise SystemExit("缺少 %s，请先抓取原站页面" % fp)
    return json.load(open(fp, encoding='utf-8'))

# 备份
if not os.path.exists(CONTENT + '.bak-qr'):
    shutil.copy2(CONTENT, CONTENT + '.bak-qr')
    print("已备份 content.json -> content.json.bak-qr")

content = json.load(open(CONTENT, encoding='utf-8'))
pages = content['pages']
nav = content['nav']

for p in PAGES:
    raw = fetch_raw(p['pid'])
    title = raw['page_title']
    newc = transform(raw['page_content'], p['sec'])
    pid = str(p['pid'])
    pages[pid] = {
        "id": pid, "title": title, "content": newc,
        "section": p['sec'], "cat_id": p['cat_id'], "cat_name": p['cat_name'],
    }
    navsec = nav[p['sec']]
    cat = next((x for x in navsec['catalogs'] if x['id'] == p['cat_id']), None)
    if cat is None:
        print("  !! 未找到目录 id=%s" % p['cat_id']); continue
    if not any(x['id'] == pid for x in cat['pages']):
        cat['pages'].append({"id": pid, "title": title, "section": p['sec']})
    print("  注入页面 %s [%s] -> %s (%d chars)" % (pid, p['sec'], p['cat_name'], len(newc)))

json.dump(content, open(CONTENT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print("✅ content.json 已更新并保存")
