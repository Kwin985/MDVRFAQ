#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性清理 data/accessories/media 下的残留文件与失效文件夹（不在 catalog 中的 id）。"""
import os, json

MEDIA = "data/accessories/media"

def main():
    c = json.load(open(os.path.join("data/accessories", "catalog.json"), encoding="utf-8"))
    ids = set(i["id"] for i in c["items"])
    for lang in ("zh", "en"):
        for typ in ("host", "accessory", "camera"):
            base = os.path.join(MEDIA, lang, typ)
            if not os.path.isdir(base):
                continue
            for item in os.listdir(base):
                d = os.path.join(base, item)
                if not os.path.isdir(d):
                    continue
                if item in ids:
                    # 清掉当前物料里残留的非 webp 旧图
                    img = os.path.join(d, "images")
                    if os.path.isdir(img):
                        for f in os.listdir(img):
                            if not f.endswith(".webp"):
                                try: os.remove(os.path.join(img, f))
                                except Exception: pass
                else:
                    # 失效文件夹：删文件后删空目录
                    for root, dirs, files in os.walk(d, topdown=False):
                        for f in files:
                            try: os.remove(os.path.join(root, f))
                            except Exception: pass
                        for dd in dirs:
                            try: os.rmdir(os.path.join(root, dd))
                            except Exception: pass
                    try: os.rmdir(d)
                    except Exception: pass
    print("purge done")

if __name__ == "__main__":
    main()
