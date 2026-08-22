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
  python tools/transcribe_videos.py                # 全部视频
  python tools/transcribe_videos.py --model small
  python tools/transcribe_videos.py --limit 3      # 先试 3 个看效果

网络问题（中国大陆常见）：
  faster-whisper 默认从 huggingface.co 下载模型，若你的网络连不上会报
  ConnectTimeout / LocalEntryNotFoundError。解决方式（任选其一）：

  1) 国内镜像（推荐先试）：运行前设置环境变量，让下载走 hf-mirror.com
       PowerShell:  $env:HF_ENDPOINT="https://hf-mirror.com"
       然后照常 python tools/transcribe_videos.py
     （若你本机走代理，也可先 $env:HTTPS_PROXY="http://代理地址:端口" 再试方式 1）

  2) 完全离线（推荐用 curl 断点续传，比浏览器稳）：先用 curl 把模型文件拉到本地，
     再指定本地路径，全程不再走 huggingface_hub 的易断 API。
       a. 在 PowerShell 运行（<模型名> 取 tiny/base/small/medium，中文建议 small）：
            $base = "https://hf-mirror.com/Systran/faster-whisper-<模型名>/resolve/main"
            $dest = "D:/models/faster-whisper-<模型名>"
            New-Item -ItemType Directory -Force -Path $dest | Out-Null
            foreach ($f in @("config.json","model.bin","preprocessor_config.json","tokenizer.json","vocabulary.txt")) {
              curl.exe -L -C - --retry 8 --retry-delay 3 --retry-all-errors -o "$dest/$f" "$base/$f"
            }
       b. 运行：python tools/transcribe_videos.py --model-path "D:/models/faster-whisper-<模型名>"
     （也可浏览器手动下：打开 https://hf-mirror.com/Systran/faster-whisper-<模型名>，
      把页面全部文件存到 D:/models/faster-whisper-<模型名>/，再同样用 --model-path。）

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
    ap.add_argument("--model-path", default="", help="本地 CT2 模型目录（离线用，跳过下载）")
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
            if args.model_path:
                print("[模型] 加载本地路径 %s ..." % args.model_path)
                model_cache[lang] = WhisperModel(args.model_path, device="cpu", compute_type="int8")
            else:
                print("[模型] 加载 %s (%s) ..." % (args.model, lang))
                try:
                    model_cache[lang] = WhisperModel(args.model, device="cpu", compute_type="int8")
                except Exception as e:  # noqa
                    sys.stderr.write(
                        "\n❌ 无法从 HuggingFace 下载模型：%s\n\n"
                        "原因：你的网络连不上 huggingface.co（常见于中国大陆网络），或镜像 hf-mirror.com 中途断流。\n\n"
                        "解决方式（详见脚本顶部「网络问题」说明）：\n"
                        "1) 镜像重试：先 $env:HF_ENDPOINT=\"https://hf-mirror.com\" 再跑（断流可多试几次）。\n"
                        "2) 完全离线（最稳）：用 curl 断点续传把模型拉到本地，再 --model-path 指定目录，\n"
                        "   不再走 huggingface_hub 易断的 API。示例见脚本顶部说明。\n\n"
                        % (e,)
                    )
                    sys.exit(3)
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
        fpath = os.path.join(SRC, h + ".mp4")
        if not os.path.exists(fpath):
            alt = os.path.join(SRC, h)
            if os.path.exists(alt):
                fpath = alt
        lang = "zh" if v.get("section", "").startswith("zh") else "en"
        print("[识别] %s (%s) %s" % (v.get("title", ""), lang, h))
        model = model_for(lang)
        try:
            segs, _ = model.transcribe(fpath, language=lang, vad_filter=True)
        except Exception as e:  # noqa
            sys.stderr.write(
                "        ⚠️ 跳过：音频解码失败（视频可能无音轨）：%s\n"
                "            保留原有 doc-derived 稿，不中断批处理。\n" % e
            )
            continue
        segments = []
        for s in segs:
            t = s.text.strip()
            if t:
                segments.append({"start": round(s.start, 1), "end": round(s.end, 1), "text": t})
        if not segments:
            sys.stderr.write("        ⚠️ 跳过：未识别到语音内容，保留原有稿。\n")
            continue
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
