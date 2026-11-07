#!/usr/bin/env python3
"""
提交 sitemap 中的全部 URL 到 IndexNow（Bing / Yandex / Seznam 即时收录）。

用法:
    python tools/submit_indexnow.py            # 默认读 dist/sitemap.xml
    python tools/submit_indexnow.py --sitemap dist/sitemap.xml

说明:
    - key 必须与 tools/build.js 中的 INDEXNOW_KEY 完全一致（验证文件 <KEY>.txt 内容即 key）。
    - IndexNow 为幂等：重复提交相同 URL 无害；新增/变更页提交即触发重爬。
    - 建议在每次 `wrangler pages deploy` 之后运行一次。
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 与 tools/build.js 的 INDEXNOW_KEY 保持一致
INDEXNOW_KEY = "8f2c1a9b3e4d5f6a7b8c9d0e1f2a3b4c"
HOST = "mdvrfaq.com"
API = "https://api.indexnow.org/indexnow"


def load_urls(sitemap_path):
    with open(sitemap_path, "r", encoding="utf-8") as f:
        xml = f.read()
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def submit(urls, tries=4):
    payload = json.dumps({
        "host": HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }).encode("utf-8")
    req = urllib.request.Request(
        API, data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    last_err = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", "replace")
                print(f"  IndexNow 提交成功: HTTP {resp.status}, {len(urls)} 个 URL")
                if body:
                    print("   响应:", body[:200])
                return True
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:200]}"
            # 429/503 退避重试；403 SiteVerificationNotCompleted 为首次验证未完成，稍长等待后重试
            if e.code in (429, 503):
                wait = 5 * (attempt + 1)
                print(f"  限流/暂不可用({e.code})，{wait}s 后重试 ({attempt+1}/{tries})")
                time.sleep(wait)
                continue
            if e.code == 403:
                wait = 60 * (attempt + 1)
                print(f"  站点验证未完成(403)，{wait}s 后重试 ({attempt+1}/{tries})")
                time.sleep(wait)
                continue
            print(f"  IndexNow 提交失败: {last_err}")
            return False
        except Exception as e:  # noqa
            last_err = str(e)
            wait = 5 * (attempt + 1)
            print(f"  网络异常: {e}，{wait}s 后重试 ({attempt+1}/{tries})")
            time.sleep(wait)
    print(f"  IndexNow 提交最终失败: {last_err}")
    return False


def main():
    sitemap = sys.argv[sys.argv.index("--sitemap") + 1] if "--sitemap" in sys.argv else \
        os.path.join(ROOT, "dist", "sitemap.xml")
    if not os.path.exists(sitemap):
        print(f"找不到 sitemap: {sitemap}")
        sys.exit(1)
    urls = load_urls(sitemap)
    if not urls:
        print("sitemap 中没有 <loc>，跳过")
        return
    print(f"从 {sitemap} 读取 {len(urls)} 个 URL，提交 IndexNow…")
    ok = submit(urls)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
