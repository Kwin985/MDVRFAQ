#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_video_guides.py — 生成「视频配套文字说明」（doc-derived 兜底稿）

数据来源：仅使用本站点自有素材
  - dist/content.json      视频页与文档页（markdown 正文）
  - data/faq-video-map.json 视频 id -> 对应文档 id 列表（同语言）

逻辑：
  对每个视频页，取映射的首篇文档（主文档），用其 markdown 标题拆成章节，
  把每章正文清洗为纯文本，写入 transcripts/<video_hash>.json。
  视频页 <video src="assets/videos/<hash>.mp4"> 的 hash 即文件名。

说明：
  - 这是「整理自帮助文档」的说明稿，非逐字稿（无时间戳），明确标注来源。
  - 若 transcripts/<hash>.json 已存在（例如本机 ASR 生成的逐字稿），则跳过，
    保证 ASR 稿优先、不被覆盖。
  - 运行环境：沙箱 / 本机均可（纯 Python 标准库，无第三方依赖）。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "dist", "content.json")
MAP = os.path.join(ROOT, "data", "faq-video-map.json")
OUT = os.path.join(ROOT, "transcripts")
MAX_CHAPTER_TEXT = 600  # 单章正文截断长度（字符）
MAX_CHAPTERS = 15


def strip_md(text):
    """把 markdown 片段清洗为可读纯文本。"""
    if not text:
        return ""
    t = text
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)          # 图片
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)       # 链接 -> 文字
    t = re.sub(r"`([^`]+)`", r"\1", t)                   # 行内代码
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)             # 粗体
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", t)    # 斜体
    t = re.sub(r"^#{1,6}\s+", "", t, flags=re.M)          # 残留标题符
    t = re.sub(r"<[^>]+>", "", t)                        # 残留 HTML 标签
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t.strip()


def parse_chapters(md):
    """从 markdown 正文拆出 (标题, 正文) 章节列表。"""
    lines = md.split("\n")
    chapters = []
    cur = None
    buf = []
    for line in lines:
        m = re.match(r"^#{2,6}\s+(.+?)\s*#*\s*$", line)
        if m:
            if cur is not None:
                chapters.append((cur, "\n".join(buf)))
            cur = m.group(1).strip()
            buf = []
        else:
            if cur is not None:
                buf.append(line)
    if cur is not None:
        chapters.append((cur, "\n".join(buf)))
    return [(h, strip_md(b)) for h, b in chapters if strip_md(b)]


def video_hash(content):
    m = re.search(r"assets/videos/([0-9a-fA-F]+)\.mp4", content or "")
    return m.group(1) if m else None


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(CONTENT, encoding="utf-8") as f:
        data = json.load(f)
    pages = data.get("pages", {})
    with open(MAP, encoding="utf-8") as f:
        vmap = json.load(f)

    # 视频页：section 以 _videos 结尾
    videos = [p for p in pages.values() if p.get("section", "").endswith("videos")]
    made = skipped = 0
    for v in videos:
        vid = str(v.get("id"))
        h = video_hash(v.get("content", ""))
        if not h:
            continue
        dst = os.path.join(OUT, h + ".json")
        if os.path.exists(dst):
            skipped += 1
            continue
        doc_ids = vmap.get(vid)
        if not doc_ids:
            continue
        primary = str(doc_ids[0])
        doc = pages.get(primary)
        if not doc:
            continue
        lang = "zh" if v.get("section", "").startswith("zh") else "en"
        doc_sec = doc.get("section", "")
        doc_url = "/" + ("zh" if doc_sec.startswith("zh") else "en") + "/docs/" + primary + "/"
        md = doc.get("content", "")
        chapters = parse_chapters(md)
        if not chapters:
            # 无标题：整篇作为单章
            txt = strip_md(md)
            if txt:
                chapters = [(doc.get("title", ""), txt[:MAX_CHAPTER_TEXT])]
        if not chapters:
            continue
        chapters = chapters[:MAX_CHAPTERS]
        segments = []
        for heading, body in chapters:
            if len(body) > MAX_CHAPTER_TEXT:
                body = body[:MAX_CHAPTER_TEXT].rstrip() + "…"
            segments.append({"heading": heading, "text": body})
        out = {
            "source": "doc-derived",
            "lang": lang,
            "video_title": v.get("title", ""),
            "doc_title": doc.get("title", ""),
            "doc_url": doc_url,
            "segments": segments,
        }
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        made += 1
    print("doc-derived 说明稿: 新建 %d, 已存在跳过 %d, 视频页总数 %d" % (made, skipped, len(videos)))


if __name__ == "__main__":
    main()
