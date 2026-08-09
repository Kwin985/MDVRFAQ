import json, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
BROKEN = os.path.join(ROOT, 'broken_images.json')
REF = 'http://pug2.4000329988.com/'

with open(BROKEN, 'r', encoding='utf-8') as f:
    broken = json.load(f)

def is_valid_image(path):
    try:
        with open(path, 'rb') as fh:
            head = fh.read(16)
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

def encode_url(url):
    if ' ' in url:
        parts = url.split('?', 1)
        parts[0] = quote(parts[0])
        return '?'.join(parts)
    return url

def resolve_target(relpath):
    # relpath like 'assets/images/xxx.png' relative to dist/
    if relpath.startswith('dist/'):
        return os.path.join(ROOT, relpath)
    return os.path.join(ROOT, 'dist', relpath)

def download_one(item):
    url = item['url']
    target = resolve_target(item['path'])
    tmp = target + '.tmp'
    candidates = [encode_url(url)]
    ap = alt_prefix(url)
    if ap:
        candidates.append(encode_url(ap))
    for cand in candidates:
        for attempt in range(3):
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
                r = subprocess.run(
                    ['curl', '-sL', '-A', 'Mozilla/5.0', '-e', REF,
                     '--max-time', '40', '-o', tmp, cand],
                    capture_output=True, timeout=45)
            except Exception:
                time.sleep(2)
                continue
            if os.path.exists(tmp) and os.path.getsize(tmp) > 0 and is_valid_image(tmp):
                os.replace(tmp, target)
                return True
            # not valid -> maybe 429, back off
            time.sleep(2.5)
    if os.path.exists(tmp):
        os.remove(tmp)
    return False

print(f'待修复坏图: {len(broken)}', flush=True)
ok = 0
fail_list = []
with ThreadPoolExecutor(max_workers=3) as ex:
    futs = {ex.submit(download_one, it): it for it in broken}
    done = 0
    for f in as_completed(futs):
        done += 1
        if f.result():
            ok += 1
        else:
            fail_list.append(futs[f]['path'])
        if done % 40 == 0 or done == len(broken):
            print(f'  {done}/{len(broken)}  OK:{ok}  FAIL:{len(fail_list)}', flush=True)

print(f'DONE total:{len(broken)} OK:{ok} FAIL:{len(fail_list)}', flush=True)
if fail_list:
    with open(os.path.join(ROOT, 'still_broken.json'), 'w', encoding='utf-8') as f:
        json.dump(fail_list, f, ensure_ascii=False, indent=2)
    print('失败清单已写入 still_broken.json', flush=True)
