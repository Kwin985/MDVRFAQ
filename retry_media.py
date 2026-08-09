#!/usr/bin/env python3
"""Retry downloading missing media files with lower concurrency."""
import json
import os
import re
import time
import hashlib
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://pug2.4000329988.com"
DATA_DIR = "data"
ASSETS_DIR = "assets"
MAPPING_FILE = "data/url_mapping.json"
MAX_WORKERS = 4

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def collect_media_urls():
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
                url = m.group(1).replace('&amp;', '&').strip()
                url = url.replace('attach ment', 'attachment')
                if url:
                    img_urls.add(url)
            for m in re.finditer(r'<img[^>]+src="([^"]+)"', decoded):
                url = m.group(1).replace('&amp;', '&').strip()
                url = url.replace('attach ment', 'attachment')
                if url:
                    img_urls.add(url)
            for m in re.finditer(r"<img[^>]+src='([^']+)'", decoded):
                url = m.group(1).replace('&amp;', '&').strip()
                url = url.replace('attach ment', 'attachment')
                if url:
                    img_urls.add(url)
            for m in re.finditer(r'<(?:video|source)[^>]+src="([^"]+)"', decoded):
                url = m.group(1).strip()
                if url:
                    video_urls.add(url)
            for m in re.finditer(r"<(?:video|source)[^>]+src='([^']+)'", decoded):
                url = m.group(1).strip()
                if url:
                    video_urls.add(url)
    return img_urls, video_urls

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
    subdir = 'videos' if is_video else 'images'
    return os.path.join(ASSETS_DIR, subdir, url_hash + ext)

def download_with_curl(url, local_path, retries=2):
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return True
    ensure_dir(os.path.dirname(local_path))
    for attempt in range(retries):
        try:
            result = subprocess.run([
                'curl', '-sL', '-o', local_path,
                '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '-H', 'Accept: */*',
                '-H', f'Referer: {BASE_URL}/',
                '--max-time', '25',
                '--connect-timeout', '10',
                url
            ], capture_output=True, timeout=30)
            if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    if os.path.exists(local_path) and os.path.getsize(local_path) == 0:
        os.remove(local_path)
    return False

def main():
    ensure_dir(os.path.join(ASSETS_DIR, 'images'))
    ensure_dir(os.path.join(ASSETS_DIR, 'videos'))
    
    print("Collecting media URLs...", flush=True)
    img_urls, video_urls = collect_media_urls()
    print(f"Found {len(img_urls)} images, {len(video_urls)} videos", flush=True)
    
    # Load existing mapping
    url_mapping = {}
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            url_mapping = json.load(f)
    
    all_media = [(url, False) for url in sorted(img_urls)] + [(url, True) for url in sorted(video_urls)]
    
    # Only download files that don't exist
    to_download = []
    for url, is_video in all_media:
        local_path = get_local_path(url, is_video)
        url_mapping[url] = local_path.replace('\\', '/')
        if not (os.path.exists(local_path) and os.path.getsize(local_path) > 0):
            to_download.append((url, is_video, local_path))
    
    print(f"Need to download: {len(to_download)} (already have: {len(all_media) - len(to_download)})", flush=True)
    
    success = 0
    failed = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for url, is_video, local_path in to_download:
            futures[executor.submit(download_with_curl, url, local_path)] = (url, local_path)
        
        for i, future in enumerate(as_completed(futures)):
            url, local_path = futures[future]
            ok = future.result()
            if ok:
                success += 1
            else:
                failed += 1
            
            if (i + 1) % 50 == 0 or (i + 1) == len(to_download):
                print(f"  Progress: {i+1}/{len(to_download)} (OK: {success}, Failed: {failed})", flush=True)
                with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
                    json.dump(url_mapping, f, ensure_ascii=False, indent=2)
    
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(url_mapping, f, ensure_ascii=False, indent=2)
    
    total_exist = sum(1 for p in url_mapping.values() if os.path.exists(p) and os.path.getsize(p) > 0)
    print(f"\nDone! Downloaded: {success}, Failed: {failed}", flush=True)
    print(f"Total files on disk: {total_exist} / {len(url_mapping)}", flush=True)

if __name__ == "__main__":
    main()
