import http.server
import socketserver
import os

PORT = 8090
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # 强制不缓存，确保文件更新后浏览器立即拉取新内容
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        pass  # 静默日志


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT} (no-cache)")
        httpd.serve_forever()
