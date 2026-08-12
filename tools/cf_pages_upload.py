#!/usr/bin/env python3
# 直接调用 Cloudflare Pages Direct Upload API 部署 dist/（无需 wrangler / npm）
# 用法: CLOUDFLARE_API_TOKEN=xxx python tools/cf_pages_upload.py [project_name]
import os, sys, io, gzip, tarfile, json, urllib.request, urllib.error

ACCOUNT_ID = os.environ.get('CF_ACCOUNT_ID') or 'bb9499d5c98fe8e7fc802e702e1ed244'
TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN') or (sys.argv[2] if len(sys.argv) > 2 else '')
# Global API Key 认证（upload-tarball 端点只接受这种或 OAuth，不接受 API Token）
KEY = os.environ.get('CF_API_KEY') or ''
EMAIL = os.environ.get('CF_API_EMAIL') or ''
PROJECT = sys.argv[1] if len(sys.argv) > 1 else 'mdvrfaq'
DIST = 'dist'
BASE = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects'


def add_auth(req):
    # 优先用 Global API Key（X-Auth-Email + X-Auth-Key）；否则用 Bearer Token
    if KEY and EMAIL:
        req.add_header('X-Auth-Email', EMAIL)
        req.add_header('X-Auth-Key', KEY)
    else:
        req.add_header('Authorization', 'Bearer ' + TOKEN)


def make_tarball():
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb', mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w', format=tarfile.GNU_FORMAT) as tar:
            n = 0
            for root, _, files in os.walk(DIST):
                for f in files:
                    fp = os.path.join(root, f)
                    arc = os.path.relpath(fp, DIST)  # 文件置于 tar 根，不嵌套 dist/
                    tar.add(fp, arcname=arc)
                    n += 1
            print(f'  tarball: {n} files, {round(len(buf.getvalue())/1024/1024,1)} MB')
    return buf.getvalue()


def api(method, url, body=None, ctype=None):
    req = urllib.request.Request(url, data=body, method=method)
    add_auth(req)
    if ctype:
        req.add_header('Content-Type', ctype)
    try:
        r = urllib.request.urlopen(req, timeout=300)
        return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')


def upload_multipart(url, data, token):
    # Cloudflare upload-tarball 需要 multipart/form-data，字段名为 file
    boundary = '----cfpbndry7MA4YWxkTrZu0gW'
    crlf = '\r\n'
    head = (f'--{boundary}{crlf}'
            f'Content-Disposition: form-data; name="file"; filename="dist.tar.gz"{crlf}'
            f'Content-Type: application/gzip{crlf}{crlf}').encode('utf-8')
    tail = f'{crlf}--{boundary}--{crlf}'.encode('utf-8')
    body = head + data + tail
    req = urllib.request.Request(url, data=body, method='POST')
    add_auth(req)
    req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)
    try:
        r = urllib.request.urlopen(req, timeout=600)
        return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')


def main():
    if not TOKEN:
        print('ERROR: 需要 CLOUDFLARE_API_TOKEN（环境变量或第2个参数）')
        sys.exit(2)
    print(f'[1/3] 打包 {DIST}/ ...')
    data = make_tarball()
    print(f'[2/3] 确保项目 {PROJECT} 存在 ...')
    st, resp = api('POST', BASE, json.dumps({'name': PROJECT, 'production_branch': 'main'}).encode(), 'application/json')
    print(f'  create project -> HTTP {st} {resp[:160]}')
    print(f'[3/3] 上传 tarball 到 {PROJECT} (multipart) ...')
    st, resp = upload_multipart(f'{BASE}/{PROJECT}/upload-tarball', data, TOKEN)
    print(f'  upload -> HTTP {st}')
    try:
        j = json.loads(resp)
        if j.get('success'):
            print('  SUCCESS:', j.get('result', {}).get('latest_upload', {}).get('url') or '已提交部署')
        else:
            print('  Cloudflare 返回错误:', json.dumps(j.get('errors', []), ensure_ascii=False)[:400])
    except Exception:
        print('  raw:', resp[:300])


if __name__ == '__main__':
    main()
