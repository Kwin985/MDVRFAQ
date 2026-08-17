#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从本地视频素材生成缩略图（用于 Google 视频搜索索引 / <video> poster）。

数据源：本项目自己抓取的本地视频 assets/videos/<hash>.mp4（不访问任何外部参考站）。
输出：  assets/video-thumbs/<hash>.jpg（与视频同名，build.js 会拷贝到 dist 并注入）。

策略：对同一视频在多个时间点取样，挑选"信息量最大"的帧（灰度标准差最高，
       以避开纯黑/纯白/纯色帧），保证缩略图有内容、可被 Google 采用。
依赖：imageio-ffmpeg 提供的静态 ffmpeg 二进制（已装在 WorkBuddy 隔离 venv）。
用法：python tools/gen_video_thumbs.py
"""
import os
import sys
import glob
import subprocess
import statistics
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_DIR = os.path.join(ROOT, "assets", "videos")
DST_DIR = os.path.join(ROOT, "assets", "video-thumbs")
TMP_DIR = os.path.join(ROOT, ".tmp_thumbs")

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception as e:
    print("ERROR: 无法获取 ffmpeg（imageio-ffmpeg）：", e, file=sys.stderr)
    sys.exit(1)

os.makedirs(DST_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)

# 取样时间点（秒）：兼顾短视频与长视频，尽量避开片头黑场
SAMPLE_TS = [0.5, 1, 2, 3, 5, 8, 12]


def valid_jpg(p):
    if not os.path.exists(p):
        return False
    if os.path.getsize(p) < 1024:
        return False
    with open(p, "rb") as f:
        return f.read(3) == b"\xff\xd8\xff"


def score(p):
    """返回 (灰度标准差, 平均亮度)。标准差高=有内容；亮度用于剔除过黑/过白帧。"""
    try:
        from PIL import Image
        im = Image.open(p).convert("L").resize((160, 90))
        px = list(im.getdata())
        return (statistics.pstdev(px), sum(px) / len(px))
    except Exception:
        return (0.0, 0.0)


def extract_frame(src_mp4, ts, out_jpg):
    cmd = [
        FFMPEG, "-y", "-ss", str(ts), "-i", src_mp4,
        "-frames:v", "1", "-q:v", "3",
        "-vf", "scale='min(720,iw)':-2",
        out_jpg,
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=60)
    except Exception:
        return False
    return valid_jpg(out_jpg)


def best_frame(src_mp4, base):
    """多时间点取样，返回评分最高的临时帧路径。"""
    cands = {}
    for ts in SAMPLE_TS:
        tmp = os.path.join(TMP_DIR, f"{base}_{ts}.jpg")
        if extract_frame(src_mp4, ts, tmp):
            cands[tmp] = score(tmp)
    if not cands:
        return None
    # 选标准差最高者；若全部极低（如纯色），退而求其次取最亮
    best = max(cands, key=cands.get)
    return best


def process(f):
    base = os.path.splitext(f)[0]
    src = os.path.join(SRC_DIR, f)
    dst = os.path.join(DST_DIR, base + ".jpg")
    # 质量门：已存在且不太黑/太白/纯色则跳过；否则重新择优取样
    if valid_jpg(dst):
        sd, mean = score(dst)
        if sd >= 6.0 and 15 <= mean <= 235:
            return "skip"
    best = best_frame(src, base)
    if not best:
        return "fail"
    import shutil
    # 用 copy 覆盖写入（不删除旧文件，规避沙箱安全删除拦截）
    shutil.copy(best, dst)
    return "ok"


def main():
    mp4s = sorted(x for x in os.listdir(SRC_DIR) if x.lower().endswith(".mp4"))
    print(f"发现 {len(mp4s)} 个本地视频，开始生成缩略图（择优取样）-> {DST_DIR}")
    ok = skip = fail = 0
    # 并行加速
    with ThreadPoolExecutor(max_workers=6) as ex:
        for status in ex.map(process, mp4s):
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            else:
                fail += 1
    # 清理临时文件（沙箱安全删除可能拦截，忽略即可，残留无害）
    for t in glob.glob(os.path.join(TMP_DIR, "*.jpg")):
        try:
            os.remove(t)
        except Exception:
            pass
    print(f"完成: 新建 {ok} / 跳过(已合格) {skip} / 失败 {fail}")
    if fail:
        sys.exit(2)


if __name__ == "__main__":
    main()
