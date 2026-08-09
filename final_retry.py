#!/usr/bin/env python3
"""Final retry for missing media files with 2 workers."""
import json, os, re, hashlib, subprocess, time
from concurrent.futures import ThreadPoolExecutor, as_completed

DATA_DIR = 'data'
ASSETS_DIR = 'assets'
MAPPING_FILE = 'data/url_mapping.json'

# Collect all media URLs
img_urls = set()
video_urls = set()
for section in ['zh_docs', 'en_docs', 'zh_videos', 'en_videos']:
    sec_dir = os.path.join(DATA_DIR, section)
    if not os.path.isdir(sec_dir):
        continue
    for fname in os.listdir(sec_dir):
        if not fname.startswith('page_') or not fname.endswith('.json'):
            continue
        with open(os.path.join(sec_dir, fname), 'r', encoding='utf-8') as f:
            page = json.load(f)
        content = page.get('page_content', '')
        decoded = content.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&amp;', '&')
        for m in re.finditer(r'!\[[^\]]*\]\(([^)]+)\)', content):
            url = m.group(1).replace('&amp;', '&').strip().replace('attach ment', 'attachment')
            if url:
                img_urls.add(url)
        for m in re.finditer(r'<img[^>]+src="([^"]+)"', decoded):
            url = m.group(1).replace('&amp;', '&').strip().replace('attach ment', 'attachment')
            if url:
                img_urls.add(url)
        for m in re.finditer(r'<(?:video|source)[^>]+src="([^"]+)"', decoded):
            url = m.group(1).strip()
            if url:
                video_urls.add(url)

def get_local_path(url, is_video=False):
    parsed_path = url.split('?')[0] if '?' in url else url
    if is_video:
        ext = '.mp4'
    else:
        if '.' in os.path.basename(parsed_path):
            ext = '.' + parsed_path.rsplit('.', 1)[-1].lower()
            ext = re.sub(r'[^a-z0-9.]', '', ext)
            if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']:
                ext = '.png'
        else:
            ext = '.png'
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
    return os.path.join(ASSETS_DIR, 'videos' if is_video else 'images', url_hash + ext)

# Load mapping
with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
    url_mapping = json.load(f)

# Find missing
all_media = [(url, False) for url in sorted(img_urls)] + [(url, True) for url in sorted(video_urls)]
missing = []
for url, is_video in all_media:
    local_path = get_local_path(url, is_video)
    url_mapping[url] = local_path.replace(os.sep, '/')
    if not (os.path.exists(local_path) and os.path.getsize(local_path) > 0):
        missing.append((url, is_video, local_path))

print(f'Missing: {len(missing)}', flush=True)

def download(url, local_path):
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    for attempt in range(3):
        try:
            r = subprocess.run(['curl', '-sL', '-o', local_path, '-A', 'Mozilla/5.0',
                '-H', 'Accept: */*', '--max-time', '30', '--connect-timeout', '15', url],
                capture_output=True, timeout=35)
            if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
                return True
        except:
            pass
        time.sleep(1)
    if os.path.exists(local_path) and os.path.getsize(local_path) == 0:
        os.remove(local_path)
    return False

success = 0
failed = 0
with ThreadPoolExecutor(max_workers=2) as executor:
    futures = {executor.submit(download, url, lp): url for url, _, lp in missing}
    for i, f in enumerate(as_completed(futures)):
        if f.result():
            success += 1
        else:
            failed += 1
        if (i + 1) % 50 == 0 or (i + 1) == len(missing):
            print(f'  {i+1}/{len(missing)} (OK:{success} Fail:{failed})', flush=True)

with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
    json.dump(url_mapping, f, ensure_ascii=False, indent=2)

total_exist = sum(1 for p in url_mapping.values() if os.path.exists(p) and os.path.getsize(p) > 0)
print(f'Done! Total on disk: {total_exist}/{len(url_mapping)}', flush=True)
