#!/usr/bin/env python3
"""Upload FAQ videos to Cloudflare R2 (S3-compatible).

Reads credentials from .r2.env (KEY=VALUE, one per line).
Uploads every *.mp4 under assets/videos/ to the bucket with a FLAT key
(== filename), so the site's VIDEO_BASE rewrite maps 1:1.

Usage:
  python tools/r2_upload.py --dry-run          # list files, no upload
  python tools/r2_upload.py                    # upload all
  python tools/r2_upload.py --delete-local     # delete local source after success
"""
import os
import sys
import glob
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, '.r2.env')
SRC_DIR = os.path.join(ROOT, 'assets', 'videos')

NEED = ('R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY')


def load_env():
    cfg = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            cfg[k.strip()] = v.strip()
    return cfg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='list files only')
    ap.add_argument('--delete-local', action='store_true', help='remove local after upload')
    args = ap.parse_args()

    cfg = load_env()
    endpoint = cfg.get('R2_ENDPOINT')
    bucket = cfg.get('R2_BUCKET')
    public_base = (cfg.get('R2_PUBLIC_BASE') or '').rstrip('/')

    files = sorted(glob.glob(os.path.join(SRC_DIR, '*.mp4')))
    print(f"源目录: {SRC_DIR}")
    print(f"待处理文件数: {len(files)}")
    if not files:
        print("无文件，退出")
        return

    if args.dry_run:
        for f in files:
            print("  (dry) ->", os.path.basename(f))
        return

    missing = [k for k in NEED if not cfg.get(k) or cfg.get(k) == '__FILL_ME__']
    if missing:
        print("缺少/未填凭据:", missing, "→ 请在 .r2.env 填写后重试")
        sys.exit(1)

    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=cfg['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=cfg['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
        config=Config(s3={'addressing_style': 'path'}),
    )

    ok = 0
    for f in files:
        key = os.path.basename(f)
        s3.upload_file(f, bucket, key)
        ok += 1
        url = f"{public_base}/{key}" if public_base else f"{endpoint}/{bucket}/{key}"
        print(f"  ok {key} -> {url}")
    print(f"上传完成: {ok}/{len(files)}")

    if args.delete_local:
        for f in files:
            os.remove(f)
        print("已删除本地源文件:", SRC_DIR)


if __name__ == '__main__':
    main()
