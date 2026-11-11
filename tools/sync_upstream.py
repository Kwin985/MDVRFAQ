#!/usr/bin/env python3
"""上游同步：把 pug2 showdoc 的新增/改名页面同步进本地数据管线。

流程:
  1. 拉取 4 个 item/info（11=zh文档 13=en文档 8=zh视频 12=en视频）刷新根目录菜单文件
  2. 菜单里有而本地缺的 page → 拉 /api/page/info 存 data/<sec>/page_<id>.json
     - page/info 不返回 cat_name，从菜单按 cat_id 回填
     - 内容里的 /server/index.php 附件链接改写为 /fqa/server/index.php（与存量 url_mapping 键一致且更稳定）
  3. 两边都有的页面若标题变更 → 写回 page_<id>.json 的 page_title
  4. 打印摘要，供后续 download_media.py / webp_convert.py / build_data.py / build.js 使用

用法:
  python tools/sync_upstream.py                          # 菜单级同步：新增页 / 标题变更 / 刷新菜单文件
  python tools/sync_upstream.py --check-content 683,684  # 正文级检查指定页：上游正文有更新则覆盖本地

注意: 菜单级同步只能发现「新增页 / 标题变更」。上游若只优化正文而标题不变，
必须用 --check-content 指定页 ID 才会比对正文（会还原本地 /fqa/server/ 规范化后逐字节比对）。
"""
import json
import os
import re
import sys
import urllib.request

BASE = "http://pug2.4000329988.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

SECTIONS = [
    ("zh_docs", "11", "zh_item.json"),
    ("en_docs", "13", "en_item.json"),
    ("zh_videos", "8", "zh_video.json"),
    ("en_videos", "12", "en_video.json"),
]

SERVER_RE = re.compile(
    r"(https?://pug2\.4000329988\.com)/server/index\.php\?s=/api/attachment/visitFile"
)


def fetch_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Referer": BASE + "/",
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                raise
            print(f"  retry {url}: {e}")


def flatten_menu(menu):
    """递归展开菜单: 返回 {page_id: {title, cat_id, cat_name, order}}, 以及 {cat_id: cat_name}"""
    pages, cats = {}, {}

    def walk(node, cat_id, cat_name):
        if node.get("page_id"):
            pages[str(node["page_id"])] = {
                "title": (node.get("page_title") or "").strip(),
                "cat_id": cat_id,
                "cat_name": cat_name,
            }
            return
        cid = node.get("cat_id", cat_id)
        cname = node.get("cat_name", cat_name)
        if cid is not None and cname:
            cats[str(cid)] = cname
        for p in node.get("pages", []) or []:
            pages[str(p["page_id"])] = {
                "title": (p.get("page_title") or "").strip(),
                "cat_id": cid,
                "cat_name": cname,
            }
        for sub in (node.get("catalogs", []) or []) + (node.get("child", []) or []):
            walk(sub, cid, cname)

    walk(menu, None, None)
    return pages, cats


def find_section(pid):
    for sec, _item, _menu in SECTIONS:
        if os.path.exists(os.path.join(DATA, sec, f"page_{pid}.json")):
            return sec
    return None


def check_content_updates(ids):
    """对指定页做正文级比对：上游正文与本地(还原规范化后)不同则覆盖本地。"""
    changed, same = [], []
    for pid in ids:
        sec = find_section(pid)
        if not sec:
            print(f"   ! page {pid} 本地不存在，跳过")
            continue
        fp = os.path.join(DATA, sec, f"page_{pid}.json")
        with open(fp, "r", encoding="utf-8") as f:
            page = json.load(f)
        pr = fetch_json(f"{BASE}/server/index.php?s=/api/page/info&page_id={pid}")
        up = pr.get("data")
        if not up or str(up.get("is_del", "0")) == "1":
            print(f"   ! page {pid} 上游不可用或已删除，跳过")
            continue
        up_content = up.get("page_content", "") or ""
        old_content = page.get("page_content", "") or ""
        local_normalized = old_content.replace("/fqa/server/", "/server/").replace("attach ment", "attachment")
        if local_normalized == up_content:
            same.append(pid)
            print(f"   = page {pid} 正文与上游逐字节一致（无更新）")
            continue
        # 用上游最新数据覆盖，保留本地 cat_name，并把附件 URL 统一到 /fqa/server/ 前缀
        new = dict(up)
        new["page_title"] = (new.get("page_title") or "").strip()
        new["cat_name"] = page.get("cat_name", "")
        new["page_content"] = SERVER_RE.sub(
            r"\1/fqa/server/index.php?s=/api/attachment/visitFile", up_content
        )
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(new, f, ensure_ascii=False)
        changed.append(pid)
        print(f"   * page {pid} 正文已更新: {len(old_content)} -> {len(new['page_content'])} 字符 "
              f"| addtime {page.get('addtime')} -> {up.get('addtime')}")
        if page.get("page_title") != up.get("page_title"):
            print(f"     标题同步: {page.get('page_title')!r} -> {up.get('page_title')!r}")
    print(f"   正文检查摘要: 更新 {len(changed)} 页 {changed}, 一致 {len(same)} 页 {same}")
    return changed


def main():
    args = sys.argv[1:]
    if "--check-content" in args:
        idx = args.index("--check-content")
        ids = [x.strip() for x in args[idx + 1].split(",") if x.strip()] if idx + 1 < len(args) else []
        if not ids:
            print("用法: --check-content <id1,id2,...>")
            return 1
        print(f"== 正文级检查: {', '.join(ids)}")
        check_content_updates(ids)
        return 0

    added, renamed, skipped = [], [], []
    for sec, item_id, menu_file in SECTIONS:
        print(f"== {sec} (item {item_id})")
        resp = fetch_json(f"{BASE}/server/index.php?s=/api/item/info&item_id={item_id}")
        with open(os.path.join(ROOT, menu_file), "w", encoding="utf-8") as f:
            json.dump(resp, f, ensure_ascii=False)
        menu_pages, _ = flatten_menu(resp["data"]["menu"])
        print(f"   菜单已刷新: {len(menu_pages)} 页 -> {menu_file}")

        sec_dir = os.path.join(DATA, sec)
        os.makedirs(sec_dir, exist_ok=True)
        for pid, info in sorted(menu_pages.items(), key=lambda kv: int(kv[0])):
            fp = os.path.join(sec_dir, f"page_{pid}.json")
            if not os.path.exists(fp):
                pr = fetch_json(f"{BASE}/server/index.php?s=/api/page/info&page_id={pid}")
                page = pr["data"]
                # is_del 是字符串 "0"/"1"，不能用真值判断
                if not page or str(page.get("is_del", "0")) == "1":
                    print(f"   ! page {pid} 上游不可用或已删除, 跳过")
                    continue
                page["cat_name"] = info["cat_name"] or ""
                page["page_content"] = SERVER_RE.sub(
                    r"\1/fqa/server/index.php?s=/api/attachment/visitFile",
                    page.get("page_content", ""),
                )
                with open(fp, "w", encoding="utf-8") as f:
                    json.dump(page, f, ensure_ascii=False)
                added.append((sec, pid, page.get("page_title", "")))
                print(f"   + page_{pid}.json  {page.get('page_title','')}")
            else:
                with open(fp, "r", encoding="utf-8") as f:
                    page = json.load(f)
                if page.get("page_title") != info["title"] and info["title"]:
                    old = page.get("page_title")
                    page["page_title"] = info["title"]
                    with open(fp, "w", encoding="utf-8") as f:
                        json.dump(page, f, ensure_ascii=False)
                    renamed.append((sec, pid, old, info["title"]))
                    print(f"   ~ page_{pid}: {old!r} -> {info['title']!r}")
                else:
                    skipped.append(pid)

    print(f"\n摘要: 新增 {len(added)} 页, 标题变更 {len(ren)} 处" if False else
          f"\n摘要: 新增 {len(added)} 页, 标题变更 {len(renamed)} 处, 其余一致")
    for sec, pid, t in added:
        print(f"   [{sec}] +{pid} {t}")
    for sec, pid, a, b in renamed:
        print(f"   [{sec}] ~{pid}: {a} -> {b}")
    print("\n下一步: python download_media.py && python tools/webp_convert.py && python build_data.py && node tools/build.js")


if __name__ == "__main__":
    sys.exit(main())
