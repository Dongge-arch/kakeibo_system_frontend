# SPDX-License-Identifier: MIT

import json
import os
import posixpath
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


APP_TITLE = "Home Kakeibo"
DEFAULT_PORT = 32178


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def resource_dir() -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).resolve().parent


BASE_DIR = app_dir()
STATIC_DIR = resource_dir() / "frontend-react" / "dist"


def load_json_config() -> dict:
    candidates = [
        BASE_DIR / "frontend-config.json",
        Path.cwd() / "frontend-config.json",
        Path(__file__).resolve().parent / "frontend-config.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8-sig") as file:
                return json.load(file) or {}
        except json.JSONDecodeError as error:
            print(f"[ERROR] frontend-config.json の形式が正しくありません: {path}")
            print(f"[ERROR] {error}")
            return {}
    return {}


def load_frontend_config() -> dict:
    config = load_json_config()
    api_base_url = (
        os.environ.get("KAKEIBO_API_BASE_URL")
        or os.environ.get("VITE_API_BASE_URL")
        or config.get("apiBaseUrl")
        or config.get("VITE_API_BASE_URL")
        or ""
    ).rstrip("/")
    api_key = (
        os.environ.get("KAKEIBO_API_KEY")
        or os.environ.get("VITE_API_KEY")
        or config.get("apiKey")
        or config.get("VITE_API_KEY")
        or ""
    )
    return {
        "apiBaseUrl": api_base_url,
        "apiKey": api_key,
    }


def preferred_port() -> int:
    config = load_json_config()
    raw_port = (
        os.environ.get("KAKEIBO_FRONTEND_PORT")
        or config.get("port")
        or DEFAULT_PORT
    )
    try:
        return int(raw_port)
    except (TypeError, ValueError):
        return DEFAULT_PORT


def find_available_port(start_port: int) -> int:
    for port in range(start_port, start_port + 30):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), FrontendHandler)
            server.server_close()
            return port
        except OSError:
            continue
    return start_port


class FrontendHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, _format, *_args):
        return

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        request_path = urlparse(self.path).path
        if request_path == "/config.js":
            self.send_runtime_config()
            return

        if request_path not in ("", "/") and not self.static_file_exists(request_path):
            self.path = "/index.html"
        super().do_GET()

    def static_file_exists(self, request_path: str) -> bool:
        relative_path = posixpath.normpath(unquote(request_path)).lstrip("/")
        if relative_path.startswith("../"):
            return False
        target = (STATIC_DIR / relative_path).resolve()
        try:
            target.relative_to(STATIC_DIR.resolve())
        except ValueError:
            return False
        return target.is_file()

    def send_runtime_config(self):
        body = (
            "window.__KAKEIBO_CONFIG__ = "
            + json.dumps(load_frontend_config(), ensure_ascii=False)
            + ";\n"
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def keep_alive():
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        return


def open_window(url: str):
    try:
        import webview

        webview.create_window(APP_TITLE, url, width=1400, height=900, resizable=True)
        webview.start()
    except Exception:
        webbrowser.open(url)
        keep_alive()


def main():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        print(f"[ERROR] フロントエンドのビルドが見つかりません: {index_file}")
        print("[INFO] 先に build_frontend_exe.bat を実行してください。")
        return 1

    port = find_available_port(preferred_port())
    server = ThreadingHTTPServer(("127.0.0.1", port), FrontendHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{port}"
    print(f"[Frontend] URL: {url}", flush=True)
    try:
        open_window(url)
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
