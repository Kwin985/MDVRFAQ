#!/usr/bin/env python3
"""Download all video files with URL encoding."""
import json, re, os, subprocess, hashlib, urllib.parse, time

with open('data/url_mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

video_urls = []
for section in ['zh_docs', 'en_docs', 'zh_videos', 'en_videos']:
    sec_dir = os.path.join('data', section)
    for fname in os.listdir(sec_dir):
        if not fname.startswith('page_') or not fname.endswith('.json'):
            continue
        with open(os.path.join(sec_dir, fname), 'r', encoding='utf-8') as f:
            page = json.load(f)
        content = page.get('page_content', '')
        decoded = content.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&amp;', '&')
        for m in re.finditer(r'<(?:video|source)[^>]+src="([^"]+)"', decoded):
            url = m.group(1).strip()
            video_urls.append(url)

video_urls = list(set(video_urls))
os.makedirs('assets/videos', exist_ok=True)

ok = 0
fail = 0
for i, url in enumerate(video_urls):
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
    local_path = f'assets/videos/{url_hash}.mp4'

    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        mapping[url] = local_path.replace(os.sep, '/')
        ok += 1
        continue

    parsed = urllib.parse.urlparse(url)
    encoded_path = urllib.parse.quote(parsed.path)
    encoded_url = parsed.scheme + '://' + parsed.netloc + encoded_path
    if parsed.query:
        encoded_url += '?' + parsed.query

    print(f'  [{i+1}/{len(video_urls)}] {url[:70]}...', end=' ', flush=True)
    try:
        subprocess.run(['curl', '-sL', '-o', local_path, '-A', 'Mozilla/5.0',
            '--max-time', '120', encoded_url], capture_output=True, timeout=125)
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            size_mb = os.path.getsize(local_path) // (1024*1024)
            print(f'OK ({size_mb}MB)')
            mapping[url] = local_path.replace(os.sep, '/')
            ok += 1
        else:
            print('FAILED (empty)')
            fail += 1
    except Exception as e:
        print(f'FAILED ({e})')
        fail += 1

    time.sleep(0.5)

with open('data/url_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)

print(f'\nDone! OK: {ok}, Failed: {fail}')
