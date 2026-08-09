#!/usr/bin/env python3
"""Build the optimized static MDVR FAQ site from downloaded data."""
import json
import os
import re
import hashlib
import html

DATA_DIR = "data"
ASSETS_DIR = "assets"
BUILD_DIR = "dist"
MAPPING_FILE = "data/url_mapping.json"

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def load_mapping():
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_menu(section_file):
    with open(section_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['data']['menu']

def process_content(content, mapping, section, page_id):
    """Process page content: fix image URLs, video embeds, etc."""
    if not content:
        return ""
    
    # HTML entity decode
    decoded = content.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    
    # Fix image URLs in markdown syntax: ![alt](url)
    def replace_md_img(match):
        alt = match.group(1)
        url = match.group(2).replace('&amp;', '&').strip()
        url = url.replace('attach ment', 'attachment')
        local = mapping.get(url, '')
        if local and os.path.exists(local):
            return f'![{alt}]({local})'
        return f'![{alt}]({url})'
    
    decoded = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', replace_md_img, decoded)
    
    # Fix image URLs in HTML img tags
    def replace_html_img(match):
        full = match.group(0)
        url = match.group(1).replace('&amp;', '&').strip()
        url = url.replace('attach ment', 'attachment')
        local = mapping.get(url, '')
        if local and os.path.exists(local):
            return full.replace(match.group(1), local)
        return full
    
    decoded = re.sub(r'<img[^>]+src="([^"]+)"', replace_html_img, decoded)
    decoded = re.sub(r"<img[^>]+src='([^']+)'", replace_html_img, decoded)
    
    # Fix video embeds - convert HTML-encoded video tags to proper markdown/html
    # Use placeholder approach to avoid double-processing
    video_placeholders = []
    def replace_video(match):
        full_tag = match.group(0)
        src_match = re.search(r'src="([^"]+)"', full_tag) or re.search(r"src='([^']+)'", full_tag)
        if src_match:
            video_url = src_match.group(1).strip()
            local = mapping.get(video_url, '')
            if local and os.path.exists(local):
                video_url = local
            html = f'\n\n<video src="{video_url}" controls style="width:100%;max-width:800px;border-radius:8px;"></video>\n\n'
        else:
            html = full_tag
        placeholder = f'%%VIDEO_PLACEHOLDER_{len(video_placeholders)}%%'
        video_placeholders.append(html)
        return placeholder

    # Match full <video>...</video> tags first, then standalone <video ...> tags
    decoded = re.sub(r'<video[^>]*>.*?</video>', replace_video, decoded, flags=re.DOTALL)
    decoded = re.sub(r'<video[^>]+>', replace_video, decoded)
    # Restore placeholders
    for i, html in enumerate(video_placeholders):
        decoded = decoded.replace(f'%%VIDEO_PLACEHOLDER_{i}%%', html)
    
    # Fix any remaining &amp; in URLs
    decoded = decoded.replace('&amp;', '&')
    
    return decoded

def build_tree(menu, section):
    """Build a navigation tree from the menu structure."""
    tree = {
        "section": section,
        "top_pages": [],
        "catalogs": []
    }
    
    # Top-level pages (no catalog)
    for p in menu.get("pages", []):
        tree["top_pages"].append({
            "id": p["page_id"],
            "title": p["page_title"],
            "section": section,
        })
    
    # Catalogs (recursive)
    def process_catalogs(catalogs):
        result = []
        for c in catalogs:
            cat = {
                "id": c["cat_id"],
                "name": c["cat_name"],
                "pages": [],
                "subcatalogs": []
            }
            for p in c.get("pages", []):
                cat["pages"].append({
                    "id": p["page_id"],
                    "title": p["page_title"],
                    "section": section,
                })
            if c.get("catalogs"):
                cat["subcatalogs"] = process_catalogs(c["catalogs"])
            result.append(cat)
        return result
    
    tree["catalogs"] = process_catalogs(menu.get("catalogs", []))
    return tree

def load_all_pages(mapping):
    """Load all page content and build the content database."""
    pages = {}  # page_id -> {title, content, section, cat_name}
    
    sections = {
        "zh_docs": "zh_item.json",
        "en_docs": "en_item.json",
        "zh_videos": "zh_video.json",
        "en_videos": "en_video.json",
    }
    
    nav = {}
    
    for section, json_file in sections.items():
        menu = load_menu(json_file)
        nav[section] = build_tree(menu, section)
        
        sec_dir = os.path.join(DATA_DIR, section)
        if not os.path.isdir(sec_dir):
            continue
        
        for fname in os.listdir(sec_dir):
            if not fname.startswith('page_') or not fname.endswith('.json'):
                continue
            with open(os.path.join(sec_dir, fname), 'r', encoding='utf-8') as f:
                page = json.load(f)
            
            pid = page["page_id"]
            content = process_content(
                page.get("page_content", ""),
                mapping, section, pid
            )
            
            pages[pid] = {
                "id": pid,
                "title": page.get("page_title", ""),
                "content": content,
                "section": section,
                "cat_id": page.get("cat_id", "0"),
                "cat_name": page.get("cat_name", ""),
            }
    
    return pages, nav

def main():
    print("Loading URL mapping...", flush=True)
    mapping = load_mapping()
    
    print("Loading all pages...", flush=True)
    pages, nav = load_all_pages(mapping)
    print(f"Loaded {len(pages)} pages", flush=True)
    
    # Build content JSON
    ensure_dir(BUILD_DIR)
    
    content_data = {
        "pages": pages,
        "nav": nav,
    }
    
    # Save as content.json
    content_file = os.path.join(BUILD_DIR, "content.json")
    with open(content_file, 'w', encoding='utf-8') as f:
        json.dump(content_data, f, ensure_ascii=False)
    print(f"Saved content.json ({os.path.getsize(content_file) // 1024} KB)", flush=True)
    
    # Copy assets
    print("Copying assets...", flush=True)
    import shutil
    dest_assets = os.path.join(BUILD_DIR, "assets")
    if os.path.exists(dest_assets):
        shutil.rmtree(dest_assets)
    shutil.copytree(ASSETS_DIR, dest_assets)
    
    print("Build data complete!", flush=True)

if __name__ == "__main__":
    main()
