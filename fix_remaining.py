import json, os, subprocess, time
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
REF = 'http://pug2.4000329988.com/'

with open(os.path.join(ROOT, 'broken_images.json'), 'r', encoding='utf-8') as f:
    broken = json.load(f)

def is_valid_image(path):
    try:
        with open(path, 'rb') as fh:
            head = fh.read(8)
    except Exception:
        return False
    return (head[:8] == b'\x89PNG\r\n\x1a\n'
            or head[:3] == b'\xff\xd8\xff'
            or head[:6] in (b'GIF87a', b'GIF89a')
            or (head[:4] == b'RIFF' and head[8:12] == b'WEBP'))

def alt_prefix(url):
    if '/fqa/server/' in url:
        return url.replace('/fqa/server/', '/server/', 1)
    elif '/server/' in url:
        return url.replace('/server/', '/fqa/server/', 1)
    return None

def enc(u):
    if ' ' in u:
        p = u.split('?', 1)
        p[0] = quote(p[0])
        return '?'.join(p)
    return u

ok = 0
for it in broken:
    url = it['url']
    target = os.path.join(ROOT, it['path']) if it['path'].startswith('dist/') else os.path.join(ROOT, 'dist', it['path'])
    cands = [enc(url)]
    ap = alt_prefix(url)
    if ap:
        cands.append(enc(ap))
    done = False
    for c in cands:
        for attempt in range(3):
            try:
                r = subprocess.run(['curl', '-sL', '-A', 'Mozilla/5.0', '-e', REF,
                                    '--max-time', '40', '-o', target, c],
                                   capture_output=True, timeout=45)
            except Exception:
                time.sleep(2); continue
            if os.path.exists(target) and os.path.getsize(target) > 0 and is_valid_image(target):
                done = True
                break
            time.sleep(2.5)
        if done:
            break
    status = 'OK' if done else 'FAIL'
    print('  ' + os.path.basename(target) + ': ' + status, flush=True)
    if done:
        ok += 1

print(f'DONE {ok}/{len(broken)} 修复成功', flush=True)
