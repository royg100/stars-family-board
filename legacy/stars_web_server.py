"""
שרת לאפליקציית index.html (לוח כוכבים) — נתונים משותפים לכל המכשירים שנכנסים לקישור.

התקנה:  pip install -r requirements.txt
הרצה:    python stars_web_server.py

קישור מקומי (ברשת הביתית): כתובת המחשב בפורט 8765, למשל http://192.168.1.10:8765/

קישור מהאינטרנט (אופציונלי):
  • Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
  • או ngrok: ngrok http 8765

אבטחה (מומלץ אם הפורט פתוי לאינטרנט):
  set STARS_ACCESS_TOKEN=סיסמה_משפחתית_ארוכה
  ואז לפתיחה: http://...:8765/?token=סיסמה_משפחתית_ארוכה
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / "stars_web_state.json"
TOKEN = os.environ.get("STARS_ACCESS_TOKEN", "").strip()

app = Flask(__name__, static_folder=None)


def _check_token() -> None:
    if not TOKEN:
        return
    got = (
        request.headers.get("X-Stars-Token", "")
        or request.args.get("token", "")
    ).strip()
    if got != TOKEN:
        abort(403)


@app.route("/")
def index():
    _check_token()
    return send_from_directory(ROOT, "index.html")


@app.route("/index.html")
def index_html():
    _check_token()
    return send_from_directory(ROOT, "index.html")


@app.route("/login.html")
def login_html():
    _check_token()
    return send_from_directory(ROOT, "login.html")


@app.route("/api/state", methods=["GET"])
def get_state():
    _check_token()
    if not STATE_FILE.is_file():
        return jsonify({})
    try:
        with STATE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except (json.JSONDecodeError, OSError):
        return jsonify({}), 200


@app.route("/api/state", methods=["PUT"])
def put_state():
    _check_token()
    if not request.is_json:
        abort(400, description="Expected JSON body")
    data = request.get_json()
    if not isinstance(data, dict):
        abort(400, description="State must be a JSON object")
    try:
        with STATE_FILE.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        abort(500, description=str(e))
    return jsonify({"ok": True})


@app.route("/favicon.ico")
def favicon():
    return ("", 204)


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="Serve index.html with shared synced state.")
    p.add_argument("--host", default="0.0.0.0", help="Listen address (default: all interfaces)")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()

    print(f"Browser (this PC): http://127.0.0.1:{args.port}/")
    if args.host == "0.0.0.0":
        print(f"Same Wi-Fi (phone/other PC): http://<this-machine-LAN-ip>:{args.port}/")
    if TOKEN:
        print("Token required — open: ...?token=YOUR_SECRET")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"Failed to start server: {e}", file=sys.stderr)
        sys.exit(1)
