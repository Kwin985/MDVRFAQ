#!/usr/bin/env python3
"""Download all images and videos referenced in page content, and update content to use local paths."""
import json
import os
import re
import time
import hashlib
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://pug2.4000329988.com"
DATA_DIR = "data"
ASSETS_DIR = "assets"
MAPPING_FILE = "data/url_mapping.json"
MAX_WORKERS = 12

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def collect_media_urls():
    """Collect all unique media URLs from all page content."""
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
            
            # HTML entity decode for video tags
            decoded = content.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&amp;', '&')
            
            # Find markdown image URLs
            for m in re.finditer(r'!\[[^\]]*\]\(([^)]+)\)', content):
                url = m.group(1).replace('&amp;', '&').strip()
                # Fix typo in URLs
                url = url.replace('attach ment', 'attachment')
                if url:
                    img_urls.add(url)
            
            # Find HTML img src URLs
            for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', decoded):
                url = m.group(1).replace('&amp;', '&').strip()
                url = url.replace('attach ment', 'attachment')
                if url:
                    img_urls.add(url)
            
            # Find video URLs
            for m in re.finditer(r'<(?:video|source)[^>]+src=["\']([^"\']+)["\']', decoded):
                url = m.group(1).strip()
                if url:
                    video_urls.add(url)
    
    return img_urls, video_urls

def download_file(url, local_path, retries=3):
    """Download a file with retries."""
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return True, local_path
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*",
                "Referer": BASE_URL + "/",
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                if len(data) > 0:
                    ensure_dir(os.path.dirname(local_path))
                    with open(local_path, 'wb') as f:
                        f.write(data)
                    return True, local_path
        except Exception as e:
            if attempt == retries - 1:
                return False, str(e)
            time.sleep(0.5)
    return False, "unknown error"

def get_local_path(url, is_video=False):
    """Generate a local path for a media URL."""
    # Parse URL
    parsed = urllib.parse.urlparse(url)
    
    # Determine extension
    if is_video:
        ext = '.mp4'
    else:
        # Try to get extension from URL path
        path = parsed.path
        if '.' in os.path.basename(path):
            ext = '.' + path.rsplit('.', 1)[-1].lower()
            # Clean up query string artifacts
            ext = re.sub(r'[^a-z0-9.]', '', ext)
            if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']:
                ext = '.png'
        else:
            # Use sign parameter as identifier
            ext = '.png'
    
    # Create hash from URL for unique filename
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
    
    if is_video:
        return os.path.join(ASSETS_DIR, 'videos', url_hash + ext)
    else:
        return os.path.join(ASSETS_DIR, 'images', url_hash + ext)

def main():
    ensure_dir(os.path.join(ASSETS_DIR, 'images'))
    ensure_dir(os.path.join(ASSETS_DIR, 'videos'))
    
    print("Collecting media URLs...")
    img_urls, video_urls = collect_media_urls()
    print(f"Found {len(img_urls)} unique image URLs and {len(video_urls)} unique video URLs")
    
    # Load existing mapping if any
    url_mapping = {}
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            url_mapping = json.load(f)
    
    all_media = [(url, False) for url in sorted(img_urls)] + [(url, True) for url in sorted(video_urls)]
    to_download = [(url, is_video) for url, is_video in all_media if url not in url_mapping]
    print(f"Need to download: {len(to_download)} (already have: {len(all_media) - len(to_download)})")
    
    # Download with thread pool
    success_count = 0
    fail_count = 0
    failed_urls = []
    
    def do_download(item):
        url, is_video = item
        local_path = get_local_path(url, is_video)
        ok, result = download_file(url, local_path)
        return url, local_path, ok, result
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(do_download, item): item for item in to_download}
        for i, future in enumerate(as_completed(futures)):
            url, local_path, ok, result = future.result()
            if ok:
                url_mapping[url] = local_path.replace('\\', '/')
                success_count += 1
            else:
                failed_urls.append((url, result))
                fail_count += 1
                # Still map it to the local path even if download failed, so we don't retry
                url_mapping[url] = local_path.replace('\\', '/')
            
            if (i + 1) % 50 == 0 or (i + 1) == len(to_download):
                print(f"  Progress: {i+1}/{len(to_download)} (OK: {success_count}, Failed: {fail_count})")
                # Save mapping periodically
                with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
                    json.dump(url_mapping, f, ensure_ascii=False, indent=2)
    
    # Final save
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(url_mapping, f, ensure_ascii=False, indent=2)
    
    print(f"\nDownload complete: {success_count} succeeded, {fail_count} failed out of {len(to_download)}")
    if failed_urls:
        print("Failed URLs (first 10):")
        for url, err in failed_urls[:10]:
            print(f"  {url[:100]} -> {err}")

if __name__ == "__main__":
    main()
