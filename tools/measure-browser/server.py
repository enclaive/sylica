from http.server import HTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="static", **kwargs)

    def end_headers(self):
        if self.path.startswith("/npm/"):
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
        super().end_headers()

print("Server started at http://127.0.0.1:8080")
HTTPServer(("127.0.0.1", 8080), Handler).serve_forever()