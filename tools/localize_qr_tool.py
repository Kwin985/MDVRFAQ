#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把原站的「扫码快速上线配置」交互工具(qrconfig-zh.html / qrconfig-en.html)
本地化托管到本站，彻底摆脱对 pug2.4000329988.com 的依赖。

输入：data/_qrconfig/qrconfig-{zh,en}.html（由 inject 流程的原站抓取产出，自包含：内联 JS/CSS，无运行时外链）
输出：assets/ext-tools/qrconfig-{zh,en}.html（源文件，随仓库版本管理）
      build.js 会把 assets/ext-tools/ 同步到 dist/tools/

处理：
- 回指文档页的链接 -> 本站 /zh/docs/674/ 与 /en/docs/675/
- 语言切换链接(qrconfig-zh.html / qrconfig-en.html)保持相对，两页同处 /tools/ 即可互跳
- w3.org 等 SVG 命名空间声明保留（无害）
幂等：重复运行结果稳定。
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'data', '_qrconfig')
DST_DIR = os.path.join(ROOT, 'assets', 'ext-tools')
os.makedirs(DST_DIR, exist_ok=True)

# (源文件, 回链原地址, 回链本站地址)
JOBS = [
    ("qrconfig-zh.html", "http://pug2.4000329988.com/fqa/web/#/11/674", "/zh/docs/674/"),
    ("qrconfig-en.html", "http://pug2.4000329988.com/fqa/web/#/13/675", "/en/docs/675/"),
]

for fname, old_back, new_back in JOBS:
    src = os.path.join(SRC_DIR, fname)
    if not os.path.exists(src):
        raise SystemExit("缺少 %s，请先抓取原站工具页到 data/_qrconfig/" % src)
    html = open(src, encoding='utf-8').read()
    n = html.count(old_back)
    html = html.replace(old_back, new_back)
    # 语言切换链接保持相对（qrconfig-zh.html / qrconfig-en.html）—— 无需改动
    out = os.path.join(DST_DIR, fname)
    open(out, 'w', encoding='utf-8').write(html)
    print("✅ %s -> %s  (回链替换 %d 处; 语言切换链接保持相对)" % (fname, out, n))

print("完成。下一步：build.js 会将其同步到 dist/tools/。")
