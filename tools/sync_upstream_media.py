#!/usr/bin/env python3
"""上游增量同步的媒体补齐工具。

与 download_media.py 的区别：
  - 会先用 URL 变体（视频 /mei/ <-> /mei/video/、图片 /fqa/server/ <-> /server/、
    上游手误空格）反查已有映射，避免同一份媒体重复下载、或视频 hash 变化导致 CDN 裂链。
  - 只下载真正缺的文件，并发 3 + magic-byte + PIL 像素级校验，不把失败页写进映射。
  - 图片直接落地 .webp（映射仍记 .png 路径，build_data.resolve_local 会回退），不产生待删中间文件。

用法: 仓库根目录运行 python tools/sync_upstream_media.py
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
IMAGES = os.path.join(ROOT, 'assets', 'images')
MAPPING = os.path.join(DATA, 'url_mapping.json')
BASE = 'http://pug2.4000329988.com'
VALID_HEADS = (
    lambda h: h[:8] == b'\x89PNG\r\n\x1a\n',
    lambda h: h[:3] == b'\xff\xd8\xff',
    lambda h: h[:6] in (b'GIF87a', b'GIF89a'),
    lambda h: h[:4] == b'RIFF' and h[8:12] == b'WEBP',
    lambda h: h[:2] == b'BM',
)


def collect_urls():
    imgs, vids = set(), set()
    for sec in ('zh_docs', 'en_docs', 'zh_videos', 'en_videos'):
        sec_dir = os.path.join(DATA, sec)
        for fname in os.listdir(sec_dir):
            if not (fname.startswith('page_') and fname.endswith('.json')):
                continue
            content = json.load(open(os.path.join(sec_dir, fname), encoding='utf-8')).get('page_content') or ''
            d = (content.replace('&lt;', '<').replace('&gt;', '>')
                 .replace('&quot;', '"').replace('&amp;', '&'))
            for m in re.finditer(r'!\[[^\]]*\]\(([^)]+)\)', d):
                imgs.add(m.group(1).strip())
            for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', d):
                imgs.add(m.group(1).strip())
            for m in re.finditer(r'<(?:video|source)[^>]+src=["\']([^"\']+)["\']', d):
                vids.add(m.group(1).strip())
    return sorted(imgs), sorted(vids)


def variants(url, is_video):
    """生成可能与已有映射匹配的 URL 变体（按优先级）。"""
    out = [url]
    if is_video:
        out.append(url.replace('/mei/', '/mei/video/'))
        out.append(url.replace('/mei/video/', '/mei/'))
    else:
        out.append(url.replace('/fqa/server/', '/server/'))
        out.append(url.replace('/server/', '/fqa/server/'))
        fixed = (url.replace('index.php? s=', 'index.php?s=')
                    .replace('& sign=', '&sign=')
                    .replace('attach ment', 'attachment'))
        out.extend([fixed, fixed.replace('/fqa/server/', '/server/'),
                    fixed.replace('/server/', '/fqa/server/')])
    seen, uniq = set(), []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def is_valid(data):
    if len(data) < 500 or data.lstrip()[:1] == b'<':
        return False
    return any(f(data[:16]) for f in VALID_HEADS)


def fetch(url, retries=6):
    delay = 1.0
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': BASE + '/',
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if is_valid(data):
                return data, None
            err = f'bad content {len(data)}B'
        except Exception as e:
            err = str(e)
            if '429' in err:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            time.sleep(0.5)
    return None, err


def local_exists(local):
    if not local:
        return False
    if os.path.exists(os.path.join(ROOT, local)):
        return True
    base, ext = os.path.splitext(local)
    return ext.lower() in ('.png', '.jpg', '.jpeg') and os.path.exists(os.path.join(ROOT, base + '.webp'))


def main():
    mapping = json.load(open(MAPPING, encoding='utf-8'))
    imgs, vids = collect_urls()
    print(f'正文引用: 图片 {len(imgs)}, 视频 {len(vids)}; 已有映射 {len(mapping)}')

    reused, jobs = 0, []
    for is_video, urls in ((True, vids), (False, imgs)):
        for url in urls:
            if url in mapping and local_exists(mapping[url]):
                continue
            hit = None
            for cand in variants(url, is_video):
                if cand in mapping and local_exists(mapping[cand]):
                    hit = mapping[cand]
                    break
            if hit:
                mapping[url] = hit
                reused += 1
            else:
                jobs.append((url, is_video))
    print(f'变体复用 {reused} 条, 待下载 {len(jobs)} 个 (视频 {sum(1 for _, v in jobs if v)})')

    ok, fails = 0, []
    os.makedirs(IMAGES, exist_ok=True)

    def work(job):
        url, is_video = job
        h = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
        if is_video:
            # 视频走外链 CDN 且文件巨大；新 URL 必须复用旧 hash 文件名，否则 CDN 上不存在
            return url, None, 'video URL has no reusable mapping (manual fix required)', None
        data, err = fetch(url)
        if data is None:
            return url, None, err, None
        from PIL import Image
        try:
            im = Image.open(io.BytesIO(data))
            im.verify()
            im = Image.open(io.BytesIO(data))
            if im.mode in ('P', 'LA', 'RGBA', 'PA'):
                im = im.convert('RGBA')
            elif im.mode != 'RGB':
                im = im.convert('RGB')
            out = os.path.join(IMAGES, h + '.webp')
            im.save(out, 'WEBP', quality=82, method=4)
            with Image.open(out) as v:
                v.verify()
        except Exception as e:
            return url, None, 'PIL: ' + str(e), None
        # 映射记 .png，由 build_data.resolve_local 回退到 .webp
        return url, f'assets/images/{h}.png', None, None

    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(work, j) for j in jobs]
        for i, fut in enumerate(as_completed(futs), 1):
            url, local, err, note = fut.result()
            if local:
                mapping[url] = local
                ok += 1
            else:
                fails.append([url, err])
                print(f'  FAIL {url[:100]} -> {err}')
            if i % 50 == 0 or i == len(jobs):
                print(f'  进度 {i}/{len(jobs)} (成功 {ok})')
                json.dump(mapping, open(MAPPING, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    json.dump(mapping, open(MAPPING, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    missing = [u for u in imgs + vids if u not in mapping or not local_exists(mapping[u])]
    print(f'\n完成: 新增映射 {ok}, 失败 {len(fails)}, 最终仍缺失 {len(missing)}')
    if missing:
        print('缺失样例:', missing[:10])
    json.dump({'fails': fails, 'missing': missing},
              open(os.path.join(ROOT, '.tmpup', 'media_sync_report.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print('下一步: python build_data.py && node tools/build.js')
    return 0 if not missing else 2


if __name__ == '__main__':
    sys.exit(main())
