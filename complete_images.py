"""
补全缺失图片：把 /server/ 前缀的缺失图片改写为稳定的 /fqa/server/ 前缀重新下载。
"""
import json
import os
import subprocess
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
MAPPING_FILE = os.path.join(ROOT, 'data', 'url_mapping.json')


def load_mapping():
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def exists(path):
    return os.path.exists(path) and os.path.getsize(path) > 0


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(3):
        try:
            r = subprocess.run(
                ['curl', '-sL', '-o', path,
                 '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                 '-e', 'http://pug2.4000329988.com/',
                 '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
                 '--max-time', '30', '--connect-timeout', '15', url],
                capture_output=True, timeout=35)
            if exists(path):
                return True
        except Exception:
            pass
        time.sleep(1)
    if os.path.exists(path) and os.path.getsize(path) == 0:
        os.remove(path)
    return False


def main():
    mapping = load_mapping()
    missing = [(url, path) for url, path in mapping.items()
               if 'videos' not in path and not exists(path)]
    print(f'缺失图片总数: {len(missing)}', flush=True)

    ok = 0
    fail = 0
    failed_list = []
    for i, (url, path) in enumerate(missing):
        # 生成候选 URL（优先 /fqa/server/ 前缀，再试原 URL）
        variants = []
        if '/server/' in url and '/fqa/server/' not in url:
            variants.append(url.replace('/server/', '/fqa/server/', 1))
        variants.append(url)
        # 含空格的先清理
        variants = [v.replace(' ', '%20') for v in variants]

        done = False
        for v in variants:
            if download(v, path):
                mapping[url] = path.replace(os.sep, '/')
                ok += 1
                done = True
                break
        if not done:
            fail += 1
            failed_list.append(url)

        if (i + 1) % 25 == 0 or (i + 1) == len(missing):
            print(f'  进度 {i+1}/{len(missing)}  成功 {ok}  失败 {fail}', flush=True)

    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f'\n补全完成! 本次新增成功 {ok} 张, 仍失败 {fail} 张', flush=True)
    if failed_list:
        print(f'仍失败样例:')
        for u in failed_list[:5]:
            print('  ', u)


if __name__ == '__main__':
    main()
