#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
transcribe_videos.py — 用 ASR 生成视频「逐字稿」（本机运行，需联网下载模型）

用途：
  本脚本在【你自己的机器】上运行（沙箱无外网、无法下载识别模型）。
  它读取本地 assets/videos/*.mp4，用 faster-whisper 逐字识别，
  输出 transcripts/<video_hash>.json（source=asr，含真实时间戳）。

  生成后，在沙箱执行 `node tools/build.js` 重建，视频页会自动用 ASR 逐字稿
  （带 [mm:ss] 时间戳）替换掉 doc-derived 说明稿，无需改任何代码。

依赖安装（本机）：
  pip install faster-whisper imageio-ffmpeg
  # 中文建议模型 small（~460MB），英文 base 即可；首次运行自动下载

运行：
  python tools/transcribe_videos.py            # 全部视频
  python tools/transcribe_videos.py --model small
  python tools/transcribe_videos.py --limit 3  # 先试 3 个看效果

注意：
  - 识别结果取决于音频质量，技术术语（ADAS/DSM/BSD 等）可能有误，属正常，
    生成后请人工校对关键步骤。
  - 已存在 transcripts/<hash>.json 会跳过（方便断点续跑）；可用 --force 覆盖。
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "dist", "content.json")
SRC = os.path.join(ROOT, "assets", "videos")
OUT = os.path.join(ROOT, "transcripts")


def video_hash(content):
    m = re.search(r"assets/videos/([0-9a-fA-F]+)\.mp4", content or "")
    return m.group(1) if m else None


def get_whisper():
    try:
        from faster_whisper import WhisperModel
        return WhisperModel
    except Exception as e:  # noqa
        sys.stderr.write(
            "未能加载 faster-whisper。请在本机执行：\n"
            "  pip install faster-whisper imageio-ffmpeg\n"
            "（沙箱无外网，无法下载模型，请在能联网的机器上运行本脚本）\n"
        )
        sys.exit(2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="small", help="whisper 模型大小 (tiny/base/small/medium)")
    ap.add_argument("--limit", type=int, default=0, help="仅处理前 N 个（调试用）")
    ap.add_argument("--force", action="store_true", help="覆盖已存在的稿子")
    args = ap.parse_args()

    WhisperModel = get_whisper()
    with open(CONTENT, encoding="utf-8") as f:
        pages = json.load(f).get("pages", {})
    videos = [p for p in pages.values() if p.get("section", "").endswith("videos")]

    os.makedirs(OUT, exist_ok=True)
    model_cache = {}

    def model_for(lang):
        if lang not in model_cache:
            print("[模型] 加载 %s (%s) ..." % (args.model, lang))
            model_cache[lang] = WhisperModel(args.model, device="cpu", compute_type="int8")
        return model_cache[lang]

    done = 0
    for v in videos:
        if args.limit and done >= args.limit:
            break
        h = video_hash(v.get("content", ""))
        if not h:
            continue
        dst = os.path.join(OUT, h + ".json")
        if os.path.exists(dst) and not args.force:
            continue
        fpath = os.path.join(SRC, h)
        if not os.path.exists(fpath + ".mp4"):
            fpath = fpath + ".mp4"
        lang = "zh" if v.get("section", "").startswith("zh") else "en"
        print("[识别] %s (%s) %s" % (v.get("title", ""), lang, h))
        model = model_for(lang)
        segs, _ = model.transcribe(fpath, language=lang, vad_filter=True)
        segments = []
        for s in segs:
            t = s.text.strip()
            if t:
                segments.append({"start": round(s.start, 1), "end": round(s.end, 1), "text": t})
        out = {
            "source": "asr",
            "lang": lang,
            "video_title": v.get("title", ""),
            "segments": segments,
        }
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        done += 1
        print("        -> %d 段" % len(segments))
    print("完成：生成 %d 个逐字稿到 transcripts/" % done)


if __name__ == "__main__":
    main()
