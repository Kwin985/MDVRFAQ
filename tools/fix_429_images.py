#!/usr/bin/env python3
"""修复 429 污染图：content.json 引用了 .webp 但 dist/assets/images 缺失的图片。

历史遗留：download_media.py 曾以 12 并发抓取，部分文件存下的是 162 字节 429 错误页，
webp_convert 又把引用重写为 .webp，导致线上裂图。本脚本:
  1. 从 dist/content.json 收集缺失的 webp 引用
  2. 经 data/url_mapping.json 反查上游 URL
  3. 低并发(3)重下，magic-byte 校验，429 指数退避
  4. PIL 转 webp(q82+verify) 后删除源 png
用法: 仓库根目录运行  python tools/fix_429_images.py
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VALID_HEADS = (
    lambda h: h[:8] == b'\x89PNG\r\n\x1a\n',
    lambda h: h[:3] == b'\xff\xd8\xff',
    lambda h: h[:6] in (b'GIF87a', b'GIF89a'),
    lambda h: h[:4] == b'RIFF' and h[8:12] == b'WEBP',
    lambda h: h[:2] == b'BM',
)


def is_valid(data):
    if len(data) < 500 or data.lstrip()[:5].lower() == b'<html' or data.lstrip()[:1] == b'<':
        return False
    head = data[:16]
    return any(f(head) for f in VALID_HEADS)


def fetch(url, retries=6):
    delay = 1.0
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'http://pug2.4000329988.com/',
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if is_valid(data):
                return data, None
            return None, f'bad content {len(data)}B: {data[:40]!r}'
        except Exception as e:
            if '429' in str(e):
                time.sleep(delay)
                delay = min(delay * 2, 30)
            else:
                time.sleep(0.5)
    return None, 'retries exhausted'


def to_webp(png_path):
    from PIL import Image
    webp = png_path[:-4] + '.webp'
    im = Image.open(png_path)
    if im.mode in ('P', 'LA', 'RGBA', 'PA'):
        im = im.convert('RGBA')
    elif im.mode != 'RGBA':
        im = im.convert('RGB')
    im.save(webp, 'WEBP', quality=82, method=4)
    with Image.open(webp) as v:
        v.verify()
    os.remove(png_path)
    return webp


def main():
    c = json.load(open(os.path.join(ROOT, 'dist', 'content.json'), encoding='utf-8'))
    mapping = json.load(open(os.path.join(ROOT, 'data', 'url_mapping.json'), encoding='utf-8'))
    rev = {}
    for k, v in mapping.items():
        rev.setdefault(os.path.basename(v).rsplit('.', 1)[0], k)

    refs = set()
    for p in c['pages'].values():
        import re
        for a, b in re.findall(r'(?:!\[[^\]]*\]\(([^)]+)\)|<img[^>]+src="([^"]+)")', p['content']):
            u = (a or b).strip()
            if not u.startswith('http') and 'assets/images/' in u and u.endswith('.webp'):
                refs.add(u if u.startswith('/') else '/' + u)
    missing = [u for u in refs if not os.path.exists(os.path.join(ROOT, 'dist', u.lstrip('/')))]
    print(f'引用 {len(refs)} 张, dist 缺失 {len(missing)}')

    jobs = []
    for u in sorted(missing):
        h = os.path.basename(u).rsplit('.', 1)[0]
        url = rev.get(h)
        if not url:
            print('  无映射键:', u)
            continue
        jobs.append((h, url))
    print(f'待重下: {len(jobs)}')

    ok = fail = 0
    fails = []

    def work(job):
        h, url = job
        data, err = fetch(url)
        if data is None:
            return h, False, err
        png = os.path.join(ROOT, 'assets', 'images', h + '.png')
        with open(png, 'wb') as f:
            f.write(data)
        try:
            to_webp(png)
            return h, True, None
        except Exception as e:
            return h, False, 'webp: ' + str(e)

    with ThreadPoolExecutor(max_workers=3) as ex:
        for i, fut in enumerate(as_completed([ex.submit(work, j) for j in jobs]), 1):
            h, good, err = fut.result()
            if good:
                ok += 1
            else:
                fail += 1
                fails.append((h, err))
                print(f'  FAIL {h}: {err}')
            if i % 50 == 0:
                print(f'  进度 {i}/{len(jobs)} (OK {ok})')

    json.dump(sorted(fails), open(os.path.join(ROOT, '.tmpup', 'fix429_fails.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'完成: 成功 {ok}, 失败 {fail} (清单 .tmpup/fix429_fails.json)')
    print('下一步: python build_data.py && node tools/build.js')


if __name__ == '__main__':
    sys.exit(main())
