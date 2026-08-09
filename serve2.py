#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MDVR FAQ 本地预览服务器
- 多线程，能并发服务页面里的数百张图片，避免浏览器"转圈"
- HTML / 目录请求：Cache-Control: no-store（随时刷新看最新）
- 静态资源(图片/css/js/视频)：长缓存，提升加载速度
"""
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
PORT = 8090


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        # 静态资源(含扩展名)长缓存；HTML/目录请求不缓存
        has_ext = "." in os.path.basename(path)
        # 本地预览：CSS/JS 也不缓存，避免改样式后刷新看不到效果
        no_cache_ext = (".html", ".css", ".js", ".json", ".txt", ".xml")
        if has_ext and not path.endswith(no_cache_ext):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 静默日志，避免刷屏


def main():
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"MDVR FAQ 预览服务器已启动: http://localhost:{PORT}")
    print(f"根目录: {ROOT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        httpd.shutdown()


if __name__ == "__main__":
    main()
