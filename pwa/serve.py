"""Loopback-only preview host for the existing MIA runtime; no stored secrets."""
import argparse
import json
import mimetypes
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
ASSETS = {
    "index.html", "styles.css", "premium.css", "vedika-materials.css", "app.js",
    "sw.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
}
API = {("GET", "/api/energia"), ("GET", "/api/branches"), ("POST", "/api/chat")}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def handler_for(runtime):
    parsed = urlsplit(runtime)
    if (parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1")
            or parsed.username or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise ValueError("Runtime must be a loopback HTTP origin without credentials")
    upstream = runtime.rstrip("/")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Do not log private paths, tokens, prompts, or telemetry.

        def reply(self, status, data, content_type="application/json"):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def fail(self, status, message):
            self.reply(status, json.dumps({"ok": False, "error": message}).encode())

        def route(self):
            path = urlsplit(self.path).path
            if path.startswith("/mia/api/"):
                endpoint = path[len("/mia"):]
                if (self.command, endpoint) not in API:
                    return self.fail(404, "Operation unavailable")
                token = self.headers.get("x-sala-token", "")
                if not token:
                    return self.fail(401, "Access required")
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                except ValueError:
                    return self.fail(400, "Invalid body")
                if not 0 <= size <= 65536:
                    return self.fail(413, "Body too large")
                body = self.rfile.read(size) if self.command == "POST" else None
                req = urllib.request.Request(upstream + endpoint, data=body, method=self.command,
                    headers={"Content-Type": "application/json", "x-sala-token": token})
                try:
                    with opener.open(req, timeout=100) as response:
                        data = response.read(2_000_001)
                    if len(data) > 2_000_000:
                        return self.fail(502, "Response too large")
                    self.reply(200, data)
                except urllib.error.HTTPError as error:
                    self.fail(error.code if error.code in (400, 401, 403, 404, 413, 422, 429) else 502,
                              "Runtime could not complete the request")
                except (OSError, TimeoutError):
                    self.fail(502, "Runtime unavailable")
                return
            if self.command != "GET":
                return self.fail(404, "Operation unavailable")
            asset = path.removeprefix("/mia/") if path.startswith("/mia/") else path.lstrip("/")
            if not asset:
                asset = "index.html"
            if asset not in ASSETS:
                return self.fail(404, "File unavailable")
            mime = "application/manifest+json" if asset.endswith(".webmanifest") else mimetypes.guess_type(asset)[0]
            self.reply(200, (ROOT / asset).read_bytes(), mime or "application/octet-stream")

        do_GET = route
        do_POST = route

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--runtime", default="http://127.0.0.1:3212")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(args.runtime))
    print(f"Local preview: http://127.0.0.1:{server.server_port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
