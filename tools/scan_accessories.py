#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扫描 X: 盘 Citops 对外产品资料 下的 主机/配件/摄像头 资料夹，
提取每个物料的元数据，并将图片与规格书 docx 复制到项目内，
输出 data/accessories/catalog.json，供后续 build.js 渲染配件选型板块。

- 配件/摄像头：depth=1（每个文件夹即一个物料）
- 主机：depth=2（产品线文件夹 → 具体型号文件夹，型号才是有意义的物料）
"""
import os
import re
import json
import shutil
from PIL import Image

SRC_ROOT = "X:/Citops 对外产品资料"
OUT_ROOT = "data/accessories"
MEDIA_ROOT = os.path.join(OUT_ROOT, "media")

# (语言, 类型, 源目录, 下钻深度)
SOURCES = [
    ("zh", "accessory", "1 中文/3 配件", 1),
    ("en", "accessory", "2 English/3 External accessories", 1),
    ("zh", "camera",   "1 中文/2 摄像头", 1),
    ("en", "camera",   "2 English/2 Cameras", 1),
    ("zh", "host",     "1 中文/1 主机", 2),
    ("en", "host",     "2 English/1 Host", 2),
]

TYPE_ABBR = {"accessory": "acc", "camera": "cam", "host": "host"}
IMG_KEYWORDS = ("图片", "imge", "image", "picture", "pic")
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")
SPEC_KEYWORDS = ("规格书", "specification", "spec", "datasheet", "specifications")

SKIP_RE = re.compile(r"^(z\s|.*备份|.*使用指南|.*指南|.*guide|.*backup)", re.IGNORECASE)


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.strip().lower())
    return s.strip("-")


def cat_letter(name):
    m = re.match(r"^([A-Za-z])\s", name.strip())
    return m.group(1) if m else ""


def make_id(lang, typ, foldername, used, seq):
    abbr = TYPE_ABBR[typ]
    fm = foldername.strip()
    md = re.match(r"^(\d{2,})$", fm)
    if md:
        cand = md.group(1)
    else:
        cl = cat_letter(fm)
        if cl:
            cand = f"{cl}{seq:02d}"
        else:
            sl = slugify(fm)
            cand = sl if sl else f"{seq:03d}"
    base = f"{abbr}-{lang}-{cand}"
    if base in used:
        base = f"{base}-{seq:03d}"
    return base


def find_docx(folder):
    docs = []
    for f in os.listdir(folder):
        p = os.path.join(folder, f)
        if os.path.isfile(p) and f.lower().endswith(".docx"):
            docs.append(p)
    if not docs:
        return None, []
    for p in docs:
        if any(k in os.path.basename(p).lower() for k in SPEC_KEYWORDS):
            return p, docs
    return max(docs, key=lambda p: os.path.getsize(p)), docs


def compress_image(src, dst, max_side=1280, quality=82):
    im = Image.open(src)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality)


def find_images(folder):
    imgs = []
    for name in os.listdir(folder):
        sub = os.path.join(folder, name)
        if os.path.isdir(sub) and any(k in name.lower() for k in IMG_KEYWORDS):
            for root, _, files in os.walk(sub):
                for ff in files:
                    if ff.lower().endswith(IMG_EXTS):
                        imgs.append(os.path.join(root, ff))
    if not imgs:
        for f in os.listdir(folder):
            p = os.path.join(folder, f)
            if os.path.isfile(p) and f.lower().endswith(IMG_EXTS):
                imgs.append(p)
    return imgs


def collect_items(src, lang, typ, depth):
    """返回该源下所有物料文件夹的 (folder, line) 列表。"""
    res = []
    if not os.path.isdir(src):
        return res
    for name in sorted(os.listdir(src)):
        g = os.path.join(src, name)
        if not os.path.isdir(g) or SKIP_RE.match(name):
            continue
        if depth == 1:
            res.append((g, ""))
        else:
            for mname in sorted(os.listdir(g)):
                m = os.path.join(g, mname)
                if os.path.isdir(m) and not SKIP_RE.match(mname):
                    res.append((m, name.strip()))
    return res


def main():
    os.makedirs(MEDIA_ROOT, exist_ok=True)

    items, used = [], set()
    stats = {t: {"zh": 0, "en": 0} for t in ("host", "accessory", "camera")}

    for lang, typ, rel, depth in SOURCES:
        src = os.path.join(SRC_ROOT, rel)
        for folder, line in collect_items(src, lang, typ, depth):
            seq = stats[typ][lang] + 1
            item_id = make_id(lang, typ, os.path.basename(folder), used, seq)
            used.add(item_id)
            stats[typ][lang] += 1

            spec_src, all_docs = find_docx(folder)
            imgs = find_images(folder)

            dest = os.path.join(MEDIA_ROOT, lang, typ, item_id)
            os.makedirs(dest, exist_ok=True)

            spec_rel = None
            if spec_src:
                dst = os.path.join(dest, "spec.docx")
                shutil.copy2(spec_src, dst)
                spec_rel = os.path.relpath(dst, OUT_ROOT).replace("\\", "/")

            img_dir = os.path.join(dest, "images")
            os.makedirs(img_dir, exist_ok=True)
            for ef in os.listdir(img_dir):  # 清理上一轮残留的非 webp 旧图
                if not ef.endswith(".webp"):
                    try:
                        os.remove(os.path.join(img_dir, ef))
                    except Exception:
                        pass
            gallery, cover = [], None
            for i, ip in enumerate(sorted(imgs)):
                if i >= 12:  # 每物料最多 12 张图，控制页面体积
                    break
                dst = os.path.join(img_dir, f"{i+1:02d}.webp")
                try:
                    compress_image(ip, dst)
                except Exception:
                    shutil.copy2(ip, os.path.join(img_dir, f"{i+1:02d}{os.path.splitext(ip)[1].lower()}"))
                    dst = os.path.join(img_dir, f"{i+1:02d}{os.path.splitext(ip)[1].lower()}")
                relp = os.path.relpath(dst, OUT_ROOT).replace("\\", "/")
                gallery.append(relp)
                if i == 0:
                    cover = relp

            fm = os.path.basename(folder).strip()
            mm = re.match(r"^(\d{2,})$", fm)
            items.append({
                "id": item_id,
                "type": typ,
                "lang": lang,
                "name": fm,
                "line": line,
                "model": mm.group(1) if mm else "",
                "group": cat_letter(fm),
                "specDocx": spec_rel,
                "docCount": len(all_docs),
                "cover": cover,
                "gallery": gallery,
                "imageCount": len(gallery),
            })

    json.dump({"generatedFrom": SRC_ROOT, "items": items},
              open(os.path.join(OUT_ROOT, "catalog.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    print("=== 扫描完成 ===")
    for t in ("host", "accessory", "camera"):
        print(f"  {t:9s} zh={stats[t]['zh']:3d}  en={stats[t]['en']:3d}")
    print(f"  总计物料: {len(items)}")
    print(f"  有规格书: {sum(1 for i in items if i['specDocx'])}")
    print(f"  有图片:   {sum(1 for i in items if i['gallery'])}")


if __name__ == "__main__":
    main()
