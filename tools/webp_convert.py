#!/usr/bin/env python3
# WebP pipeline: convert raster images (png/jpg/jpeg) -> webp, rewrite references, delete originals.
# Idempotent: skips if .webp sibling exists; only deletes originals once a valid .webp exists.
import os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # D:/Web/MdvrFAQ
IMG_RE = re.compile(r'(/?)assets/([^\s\x00-\x1f"\'()>]+\.)(png|jpe?g)', re.I)

def convert_file(src):
    base, _ = os.path.splitext(src)
    dst = base + '.webp'
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return 'skip'
    try:
        im = Image.open(src)
        mode = im.mode
        if mode in ('P', 'LA', 'RGBA', 'PA'):
            im = im.convert('RGBA')
        elif mode in ('CMYK', 'YCbCr'):
            im = im.convert('RGB')
        elif mode == 'L':
            im = im.convert('RGB')
        im.save(dst, 'WEBP', quality=82, method=4)
        with Image.open(dst) as v:
            v.verify()
        return 'ok'
    except Exception as e:
        return 'err:' + str(e)

def convert_tree(root):
    n = ok = skip = err = 0
    for dp, _, fs in os.walk(root):
        for f in fs:
            e = f.lower()
            if e.endswith(('.png', '.jpg', '.jpeg')):
                n += 1
                r = convert_file(os.path.join(dp, f))
                if r == 'ok':
                    ok += 1
                elif r == 'skip':
                    skip += 1
                else:
                    err += 1
                    print('  CONVERT ERR', os.path.join(dp, f), r)
    return n, ok, skip, err

def rewrite_refs(paths):
    total = 0
    for p in paths:
        if not os.path.isfile(p):
            continue
        try:
            t = open(p, encoding='utf-8', errors='ignore').read()
        except Exception:
            continue
        nt = IMG_RE.sub(lambda m: m.group(1) + 'assets/' + m.group(2) + 'webp', t)
        if nt != t:
            open(p, 'w', encoding='utf-8').write(nt)
            total += 1
    return total

def delete_originals(root):
    n = 0
    for dp, _, fs in os.walk(root):
        for f in fs:
            e = f.lower()
            if e.endswith(('.png', '.jpg', '.jpeg')):
                p = os.path.join(dp, f)
                if os.path.exists(os.path.splitext(p)[0] + '.webp'):
                    os.remove(p)
                    n += 1
    return n

def dirsize(r):
    tot = 0
    for dp, _, fs in os.walk(r):
        for f in fs:
            tot += os.path.getsize(os.path.join(dp, f))
    return tot

if __name__ == '__main__':
    targets = ['assets/images', 'data/accessories', 'dist/assets/images']
    for d in targets:
        full = os.path.join(ROOT, d)
        if os.path.isdir(full):
            print('[convert]', d)
            n, ok, skip, err = convert_tree(full)
            print(f'   scanned={n} converted={ok} skipped={skip} errors={err}')

    print('[rewrite] references -> .webp')
    rew = [os.path.join(ROOT, 'dist', 'content.json')]
    for base in [os.path.join(ROOT, 'dist'), os.path.join(ROOT, 'data', 'accessories')]:
        for dp, _, fs in os.walk(base):
            for f in fs:
                if f.endswith(('.html', '.css', '.js', '.json')):
                    rew.append(os.path.join(dp, f))
    c = rewrite_refs(rew)
    print('   files rewritten:', c)

    print('[delete] originals where .webp exists')
    for d in targets:
        full = os.path.join(ROOT, d)
        if os.path.isdir(full):
            print('  ', d, 'deleted', delete_originals(full))

    print('[size] dist/assets/images : %.1f MB' % (dirsize(os.path.join(ROOT, 'dist', 'assets', 'images')) / 1048576))
    print('[size] assets/images       : %.1f MB' % (dirsize(os.path.join(ROOT, 'assets', 'images')) / 1048576))
    print('[size] data/accessories    : %.1f MB' % (dirsize(os.path.join(ROOT, 'data', 'accessories')) / 1048576))
