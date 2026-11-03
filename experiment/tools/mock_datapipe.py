"""Tiny stand-in for DataPipe, for testing the end-of-study save screens.

    python mock_datapipe.py <port> <save_delay_seconds> [fail]

/api/condition/ answers at once with condition 1. /api/data/ waits <save_delay_seconds> before replying
(success, or an error if 'fail' is given), mimicking DataPipe writing the file but replying slowly.
Point the experiment at it with the pipe extension's base_url option (test copies only).
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, DELAY = int(sys.argv[1]), float(sys.argv[2])
FAIL = len(sys.argv) > 3 and sys.argv[3] == "fail"


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Content-Encoding, Accept")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        self.rfile.read(n)
        if self.path.startswith("/api/condition"):
            body = {"condition": 1}
        else:
            print(f"[mock] save request received ({n} bytes); replying in {DELAY}s", flush=True)
            time.sleep(DELAY)
            body = {"error": "MOCK_FAILURE"} if FAIL else {"message": "Success"}
        out = json.dumps(body).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
