# -*- coding: utf-8 -*-
"""统一摄像头条目封面为主视图（纯 catalog 元数据方案，规避 /assets/* 一年 immutable 缓存）。

规则：
- 不改任何图片文件的内容/文件名（同名 URL 内容不变 → 无缓存失效问题）。
- cover 指向目检选定的主视图文件；gallery 重排把主视图放首位。
- cam-en-113 图片目录为空：从中文目录拷贝（产品外观图与语言无关）。
- 同时更新 catalog.json 与 catalog.enriched.json（写前自动备份）。
"""
import json
import os
import shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'data', 'accessories')
ZH_IMG = os.path.join(DATA, 'media', 'zh', 'camera')
EN_IMG = os.path.join(DATA, 'media', 'en', 'camera')

# 目检结论：model 后缀 -> (语言 -> 主视图文件名)
COVER_FIX = {
    '110': {'zh': '03.webp'},                      # 01 是带红色尺寸标注图 → 03 正面实拍
    '113': {'zh': '03.webp'},                      # 01 工程线稿 → 03 正面实拍
    '115': {'zh': '02.webp', 'en': '02.webp'},     # 01 线稿 → 02 实拍
    '260': {'zh': '03.webp'},                      # 01 线稿 → 03 正面实拍
    '301': {'en': '03.webp'},
    '610': {'en': '02.webp'},                      # en 01 线稿 → 02 实拍
    '701': {'en': '03.webp'},                      # en 01 线稿 → 03 实拍
    '705': {'zh': '03.webp', 'en': '02.webp'},     # 01 线稿 → 正面实拍
    '708': {'en': '02.webp'},                      # en 01 线稿 → 02 实拍
}

def backup(path):
    b = path + '.bak-coverfix'
    if not os.path.exists(b):
        shutil.copy2(path, b)
    return b

def rel(lang, model, fname):
    return 'media/%s/camera/cam-%s-%s/images/%s' % (lang, lang, model, fname)

# 1) 补齐 en-113 图片
en113 = os.path.join(EN_IMG, 'cam-en-113', 'images')
zh113 = os.path.join(ZH_IMG, 'cam-zh-113', 'images')
os.makedirs(en113, exist_ok=True)
copied = 0
for f in sorted(os.listdir(zh113)):
    dst = os.path.join(en113, f)
    if not os.path.exists(dst):
        shutil.copy2(os.path.join(zh113, f), dst)
        copied += 1
print('en-113 补图:', copied, '张 ->', sorted(os.listdir(en113)))

# 2) 更新两份 catalog
for name in ('catalog.json', 'catalog.enriched.json'):
    p = os.path.join(DATA, name)
    backup(p)
    cat = json.load(open(p, encoding='utf-8'))
    changed = 0
    for it in cat['items']:
        if it.get('type') != 'camera':
            continue
        parts = it['id'].split('-')  # cam-<lang>-<model>
        if len(parts) < 3:
            continue  # 跳过 dsm-independent / ptz 等 hub 条目
        lang, model = parts[1], '-'.join(parts[2:])
        if model not in COVER_FIX or lang not in COVER_FIX[model]:
            continue
        fname = COVER_FIX[model][lang]
        r = rel(lang, model, fname)
        # 校验文件存在
        fp = os.path.join(DATA, r.replace('/', os.sep))
        if not os.path.isfile(fp):
            print('!! 文件不存在，跳过', it['id'], r)
            continue
        g = it.get('gallery') or []
        if r in g:
            g = [x for x in g if x != r]
        else:
            g = list(g)
        g.insert(0, r)
        it['cover'] = r
        it['gallery'] = g
        changed += 1
    json.dump(cat, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(name, '更新条目:', changed)

# 3) 校验
for name in ('catalog.enriched.json',):
    cat = json.load(open(os.path.join(DATA, name), encoding='utf-8'))
    for it in cat['items']:
        if it.get('type') == 'camera' and it.get('cover'):
            print('%-16s cover=%s' % (it['id'], it['cover'].split('/')[-1]))
print('DONE')
