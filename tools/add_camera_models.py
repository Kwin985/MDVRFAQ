#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增量导入摄像头型号到产品选型板块（不改既有条目）。

流程对齐 scan_accessories.py / enrich_catalog.js 的产物结构：
  data/accessories/media/{lang}/camera/{id}/spec.docx + images/NN.webp
  catalog.json        追加基础条目
  catalog.enriched.json 追加富化条目(modelCode/summary/keySpecs/chips)

新增型号数据来自 X:/Citops 对外产品资料（海报 Camera Family 2 的 4 个新型号）。
之后跑: node tools/convert_specs.js --missing-only && python tools/webp_convert.py && node tools/build.js
"""
import os
import json
import shutil
from PIL import Image

SRC_ROOT = "X:/Citops 对外产品资料"
ACC = os.path.join("data", "accessories")
MEDIA = os.path.join(ACC, "media")
CASE = os.path.join(SRC_ROOT, "1 中文/G 关于思拓/A 案例/云台安装效果（供应商提供）")

# (lang, model, spec_docx_src, [image_srcs in order], modelCode, summary, keySpecs, chips)
NEW_ITEMS = [
    ("zh", "B2",
     SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/MX-AHD-IR-B2 规格书.docx",
     [
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/底部强力磁铁款/外观图.jpg",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/强力吸盘款/外观图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/抗震款/外观图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/底部强力磁铁款/底座图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/底部强力磁铁款/尺寸图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/强力吸盘款/底座图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/B2/三款不同外观图片/抗震款/底座图.png",
         CASE + r"/MX-IPC-IR-B2-1.jpg",
     ],
     "MX-AHD-IR-B2",
     "智能红外云台摄像机，0.9°精密电机驱动、运行平滑无抖动，360°连续旋转并支持256个预置位；内置欧司朗高强度发光芯片，配强力磁铁可作便携式室外车载监控，支持正装、倒装、磁吸、吸盘、抗震多种安装形态。",
     [("水平角度", "360°连续旋转"), ("垂直角度", "90°（180°自动反转）"),
      ("预置位", "256个"), ("防护等级", "IP66"),
      ("电源", "DC11V-DC18V"), ("工作温度", "-35°~+55°"), ("重量", "2.5kg")],
     ["360°旋转", "IP66", "256预置位"]),

    ("zh", "TA4",
     SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/TA4/MX-AHDX-TA4 云台摄像机规格书.docx",
     [
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/TA4/图片/正视图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/TA4/图片/侧视图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/Y 云台/TA4/图片/TA4尺寸图.png",
         CASE + r"/MX-IPCAHD-IR-TA4-5.jpg",
         CASE + r"/MX-IPCAHD-IR-TA4-6.jpg",
         CASE + r"/MX-IPCAHD-IR-TA4-7.jpg",
     ],
     "MX-AHDX-TA4",
     "T型车载云台摄像机，镜头在安装固定过程中可任意调节角度，红外投射距离达100米；防水密封铝质护罩达IP66，一体化防震防松设计，适用于各种车载环境监控，可配合485控制键盘与继电器接入MDVR系统。",
     [("转动速度", "水平100°/S，上下60°/S"), ("预置位", "最多256个"),
      ("红外投射距离", "100米"), ("红外发光体", "高亮度阵列LED×7（850nm）"),
      ("防护等级", "IP66"), ("电源", "DC12V（Iin≥4A）"), ("工作温度", "-35℃~55℃")],
     ["100米红外", "IP66", "256预置位"]),

    ("zh", "D30",
     SRC_ROOT + r"/1 中文/2 摄像头/S 双目/D30/D30摄像头规格书.docx",
     [
         SRC_ROOT + r"/1 中文/2 摄像头/S 双目/D30/图片/正视图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/S 双目/D30/图片/D30-45度角视图.png",
         SRC_ROOT + r"/1 中文/2 摄像头/S 双目/D30/图片/D30-尺寸图.png",
     ],
     "MX-AHDL-D30-NNP-005H",
     "双目客流统计摄像头，自带双摄像头建模检测功能，满足大部分客运车辆的客流统计需求；图像支持正像/镜像，专用航空接口设计，镜头间距5cm（12cm可根据检测范围选择）。",
     [("图像传感器", "1/3\" CMOS"), ("水平清晰度", "700TVLines"),
      ("镜头", "960×576像素，2.8mm（2.1~8mm可选）"), ("视场角", "水平105°，垂直60°（2.8mm）"),
      ("镜头间距", "5cm（12cm可选）"), ("视频输出", "复合视频输出，航空头接口"),
      ("电源", "DC12V，≤2W"), ("工作温度", "-20~+70℃")],
     ["双目客流", "700TVL", "105°"]),

    ("zh", "M22",
     SRC_ROOT + r"/1 中文/2 摄像头/S 双目/M22/M22 规格书.docx",
     [
         SRC_ROOT + r"/1 中文/2 摄像头/S 双目/M22/图片/正视图.png",
     ],
     "M22-NNNN",
     "双目客流统计一体机，内置Linux系统独立完成客流分析，统计精确率＞95%；支持OSD客流信息图像叠加与超员报警，RS485对接MDVR，宽压8~36V直接取用车载电源。",
     [("图像传感器", "1/3\" CMOS"), ("分辨率", "D1（960×576像素）"),
      ("压缩格式", "H.264"), ("统计精确率", "＞95%"),
      ("通讯接口", "RS485×1，RJ45×1"), ("报警", "视频丢失/遮挡，超员报警"),
      ("电源", "DC8~36V，功耗＜4W"), ("工作温度", "-20~70℃")],
     ["客流统计＞95%", "宽压8~36V", "超员报警"]),

    ("en", "B2",
     SRC_ROOT + r"/2 English/2 Cameras/PTZ/B2/Smart IR PTZ Camera specification sheet.docx",
     [
         SRC_ROOT + r"/2 English/2 Cameras/PTZ/B2/Front View.jpg",
         SRC_ROOT + r"/2 English/2 Cameras/PTZ/B2/Front View（sucker）.png",
         SRC_ROOT + r"/2 English/2 Cameras/PTZ/B2/Front View（earthquake resistance）.png",
     ],
     "MX-AHD-IR-B2",
     "Smart IR PTZ camera driven by a 0.9° precision motor for smooth, jitter-free movement; 360° continuous pan rotation with 256 presets and Osram high-intensity IR chip. Mounts upright or inverted, with magnetic, sucker and vibration-proof bases for portable outdoor vehicle monitoring.",
     [("Pan range", "360° continuous rotation"), ("Tilt range", "90° (180° automatic reverse)"),
      ("Preset points", "256"), ("Protection level", "IP66"),
      ("Power", "DC11V-DC18V"), ("Working temperature", "-35°~+55°"), ("Weight", "2.5kg")],
     ["360° Pan", "IP66", "256 Presets"]),

    ("en", "TA4",
     SRC_ROOT + r"/2 English/2 Cameras/PTZ/TA4/MX-AHDX-TA4 specification sheet.docx",
     [
         SRC_ROOT + r"/2 English/2 Cameras/PTZ/TA4/Front View.png",
         SRC_ROOT + r"/2 English/2 Cameras/PTZ/TA4/TA4 Size.png",
         CASE + r"/MX-IPCAHD-IR-TA4-5.jpg",
         CASE + r"/MX-IPCAHD-IR-TA4-6.jpg",
         CASE + r"/MX-IPCAHD-IR-TA4-7.jpg",
     ],
     "MX-AHDX-TA4",
     "T-type vehicle PTZ camera with a freely adjustable lens angle and 100 m IR projection distance; waterproof sealed aluminum housing rated IP66 with integrated shockproof and anti-loosening design. Works with a 485 control keyboard and relay to integrate into MDVR systems.",
     [("Pan/Tilt speed", "100°/S pan, 60°/S tilt"), ("Preset positions", "Up to 256"),
      ("IR projection distance", "100 meters"), ("IR emitter", "High-brightness LED array ×7 (850nm)"),
      ("Waterproof grade", "IP66"), ("Power", "DC12V (Iin≥4A)"), ("Working temperature", "-35℃~55℃")],
     ["100 m IR", "IP66", "256 Presets"]),

    ("en", "D30",
     SRC_ROOT + r"/2 English/2 Cameras/Passenger Counting/D30/D30 specification sheet.docx",
     [
         SRC_ROOT + r"/1 中文/2 摄像头/S 双目/D30/图片/正视图.png",
         SRC_ROOT + r"/2 English/2 Cameras/Passenger Counting/D30/D30-side view.png",
         SRC_ROOT + r"/2 English/2 Cameras/Passenger Counting/D30/D30-dimension.png",
     ],
     "MX-AHDL-D30-NNP-005H",
     "Dual-lens passenger counting camera with built-in dual-camera modeling and detection, meeting the needs of most passenger vehicles; positive/mirror image, specialized aviation connector, 5 cm lens spacing (12 cm optional for wider detection ranges).",
     [("Image sensor", "1/3\" CMOS"), ("Horizontal resolution", "700 TV Lines"),
      ("Lens", "960×576 pixels, 2.8mm (2.1~8mm optional)"), ("Field of view", "105° horizontal, 60° vertical (2.8mm)"),
      ("Lens spacing", "5cm (12cm optional)"), ("Interface", "Composite video output, aviation connector"),
      ("Power", "DC12V, ≤2W"), ("Working temperature", "-20~+70℃")],
     ["Passenger Counting", "700TVL", "105°"]),

    ("en", "M22",
     SRC_ROOT + r"/2 English/2 Cameras/Passenger Counting/M22/M22 Specification sheet 2.01.docx",
     [
         SRC_ROOT + r"/2 English/2 Cameras/Passenger Counting/M22/Frant View.png",
     ],
     "M22-NNNN",
     "Dual-lens passenger counting camera with a built-in Linux system for on-device analysis, counting accuracy >95%; OSD overlay of time, date and passenger-flow information plus overload alarm. Integrates with MDVR via RS485 and runs on wide 8~36V vehicle power.",
     [("Image sensor", "1/3\" CMOS"), ("Resolution", "D1 (960×576 pixels)"),
      ("Compression", "H.264"), ("Counting accuracy", "＞95%"),
      ("Interfaces", "RS485 ×1, RJ45 ×1"), ("Alarms", "Video loss/obstruction, overload alarm"),
      ("Power", "DC8~36V, <4W"), ("Working temperature", "-20~70℃")],
     [">95% Accuracy", "8~36V", "Overload Alarm"]),
]


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


def main():
    # ---------- load catalogs ----------
    cat_path = os.path.join(ACC, "catalog.json")
    enr_path = os.path.join(ACC, "catalog.enriched.json")
    with open(cat_path, encoding="utf-8") as f:
        cat = json.load(f)
    with open(enr_path, encoding="utf-8") as f:
        enr = json.load(f)

    existing = {it["id"] for it in cat["items"]}
    assert {it["id"] for it in enr["items"]} == existing, "catalog/enriched id sets diverge!"

    # backup before writing
    for p in (cat_path, enr_path):
        b = p + ".bak-addcameras"
        if not os.path.exists(b):
            shutil.copy2(p, b)
            print("backup:", b)

    added = []
    for lang, model, spec_src, img_srcs, model_code, summary, key_specs, chips in NEW_ITEMS:
        item_id = "cam-%s-%s" % (lang, model)
        if item_id in existing:
            print("SKIP (already exists):", item_id)
            continue

        # source existence checks
        missing = [p for p in [spec_src] + img_srcs if not os.path.isfile(p)]
        if missing:
            raise SystemExit("MISSING SOURCES for %s:\n  %s" % (item_id, "\n  ".join(missing)))

        dest = os.path.join(MEDIA, lang, "camera", item_id)
        os.makedirs(os.path.join(dest, "images"), exist_ok=True)

        # spec docx
        spec_rel = "media/%s/camera/%s/spec.docx" % (lang, item_id)
        shutil.copy2(spec_src, os.path.join(dest, "spec.docx"))

        # images -> webp
        gallery, cover = [], None
        for i, ip in enumerate(img_srcs):
            dst = os.path.join(dest, "images", "%02d.webp" % (i + 1))
            try:
                compress_image(ip, dst)
            except Exception as e:
                raise SystemExit("IMAGE FAIL %s: %r" % (ip, e))
            relp = os.path.relpath(dst, ACC).replace("\\", "/")
            gallery.append(relp)
            if i == 0:
                cover = relp

        base_item = {
            "id": item_id, "type": "camera", "lang": lang, "name": model,
            "line": "", "model": model, "group": "",
            "specDocx": spec_rel, "docCount": 1,
            "cover": cover, "gallery": gallery, "imageCount": len(gallery),
        }
        rich_item = dict(base_item)
        rich_item.update({
            "modelCode": model_code, "summary": summary,
            "keySpecs": [{"k": k, "v": v} for k, v in key_specs],
            "chips": chips,
        })

        cat["items"].append(base_item)
        enr["items"].append(rich_item)
        existing.add(item_id)
        added.append(item_id)
        print("OK %s  images=%d  spec=docx" % (item_id, len(gallery)))

    if added:
        with open(cat_path, "w", encoding="utf-8") as f:
            json.dump(cat, f, ensure_ascii=False, indent=2)
        with open(enr_path, "w", encoding="utf-8") as f:
            json.dump(enr, f, ensure_ascii=False, indent=1)
        print("WROTE", cat_path, "items=%d" % len(cat["items"]))
        print("WROTE", enr_path, "items=%d" % len(enr["items"]))
    print("ADDED:", added if added else "(none)")


if __name__ == "__main__":
    main()
