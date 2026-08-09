#!/usr/bin/env python3
"""Batch download all page content from the MDVR FAQ API."""
import json
import os
import time
import urllib.request
import urllib.parse
import re

BASE_URL = "http://pug2.4000329988.com"
API_URL = BASE_URL + "/server/index.php?s=/api/page/info&page_id={}"
OUTPUT_DIR = "data"
SECTIONS = {
    "zh_docs": "zh_item.json",
    "en_docs": "en_item.json",
    "zh_videos": "zh_video.json",
    "en_videos": "en_video.json",
}

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def fetch_page(page_id, retries=3):
    url = API_URL.format(page_id)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("error_code") == 0:
                    return data["data"]
                else:
                    print(f"  API error for page {page_id}: {data.get('error_message')}")
                    return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                print(f"  Failed to fetch page {page_id}: {e}")
                return None

def extract_menu(json_file):
    """Extract all page_ids and titles from a menu JSON file."""
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    menu = data["data"]["menu"]
    pages = []
    # Top-level pages
    for p in menu.get("pages", []):
        pages.append({"page_id": p["page_id"], "title": p["page_title"], "cat_id": "0", "cat_name": ""})
    # Catalog pages (recursive)
    def walk(catalogs, parent_name=""):
        for c in catalogs:
            cat_name = c["cat_name"]
            for p in c.get("pages", []):
                pages.append({"page_id": p["page_id"], "title": p["page_title"], "cat_id": c["cat_id"], "cat_name": cat_name})
            if c.get("catalogs"):
                walk(c["catalogs"], cat_name)
    walk(menu.get("catalogs", []))
    return pages

def main():
    ensure_dir(OUTPUT_DIR)
    all_pages = {}
    for section, json_file in SECTIONS.items():
        if not os.path.exists(json_file):
            print(f"Skipping {section}: {json_file} not found")
            continue
        pages = extract_menu(json_file)
        print(f"\n=== {section}: {len(pages)} pages ===")
        section_dir = os.path.join(OUTPUT_DIR, section)
        ensure_dir(section_dir)
        section_data = {"section": section, "pages": []}
        for i, page_info in enumerate(pages):
            pid = page_info["page_id"]
            print(f"  [{i+1}/{len(pages)}] Fetching page {pid}: {page_info['title'][:50]}...", end=" ", flush=True)
            page_data = fetch_page(pid)
            if page_data:
                page_data["cat_id"] = page_info["cat_id"]
                page_data["cat_name"] = page_info["cat_name"]
                # Save individual page
                page_file = os.path.join(section_dir, f"page_{pid}.json")
                with open(page_file, "w", encoding="utf-8") as f:
                    json.dump(page_data, f, ensure_ascii=False, indent=2)
                section_data["pages"].append({
                    "page_id": pid,
                    "title": page_info["title"],
                    "cat_id": page_info["cat_id"],
                    "cat_name": page_info["cat_name"],
                })
                print("OK")
            else:
                print("FAILED")
            time.sleep(0.15)  # Be polite
        # Save section index
        index_file = os.path.join(section_dir, "index.json")
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(section_data, f, ensure_ascii=False, indent=2)
        all_pages[section] = section_data
    # Save master index
    with open(os.path.join(OUTPUT_DIR, "master_index.json"), "w", encoding="utf-8") as f:
        json.dump(all_pages, f, ensure_ascii=False, indent=2)
    total = sum(len(s["pages"]) for s in all_pages.values())
    print(f"\nDone! Total pages downloaded: {total}")

if __name__ == "__main__":
    main()
