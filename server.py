"""
EmotionAI — Python Local Dev Server (Google Gemini backend)
Serves static files and proxies /api/analyze to the Google Gemini API.

Usage (PowerShell):
    $env:GEMINI_API_KEY="AQ.Ab8RN6..."
    python server.py

Usage (CMD):
    set GEMINI_API_KEY=AQ.Ab8RN6...
    python server.py

Requires Python 3.8+  (stdlib only — no pip installs needed).
"""

import http.server
import socketserver
import json
import os
import urllib.request
import urllib.error
import datetime

PORT = int(os.environ.get("PORT", 8000))

GEMINI_MODEL = "gemini-2.0-flash-lite"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    + GEMINI_MODEL
    + ":generateContent"
)

SYSTEM_PROMPT = (
    "You are an expert customer experience analyzer. "
    "Analyze the customer conversation and return ONLY a strict JSON object. "
    "Do NOT include markdown fences, backticks, or any text outside the JSON. "
    "The JSON object must contain exactly these fields:\n"
    "- emotion: string, one of: Happy, Neutral, Frustrated, Angry, Confused, Urgent\n"
    "- emotion_score: integer 0-100\n"
    "- sentiment: string, one of: Positive, Neutral, Negative\n"
    "- sentiment_score: integer 0-100 (100=most positive, 0=most negative)\n"
    "- risk_score: integer 0-100 (churn risk; >70 high, 30-70 moderate, <30 low)\n"
    "- urgency: string, one of: Low, Medium, High, Critical\n"
    "- confidence: integer 0-100\n"
    "- recommendation: string action for the support agent\n"
    "- reply: string empathetic agent reply, max 2 sentences\n"
    "Return raw JSON only. No explanation, no markdown."
)


def log(level, msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}", flush=True)


class EmotionAIHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # suppress default access log

    def do_OPTIONS(self):
        self._send_cors(204)
        self.end_headers()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/analyze":
            self._handle_analyze()
        else:
            self.send_error(404, "Not Found")

    def _handle_analyze(self):
        log("REQ", "POST /api/analyze received")

        # Parse body
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception as exc:
            log("ERR", f"Bad request body: {exc}")
            self._json(400, {"error": f"Invalid request body: {exc}"})
            return

        messages = payload.get("messages")
        if not messages or not isinstance(messages, list):
            log("ERR", "Missing or invalid 'messages' field")
            self._json(400, {"error": "Request must include a non-empty 'messages' array."})
            return

        # Read API key at request time
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            log("ERR", "GEMINI_API_KEY not set in environment")
            self._json(400, {
                "error": (
                    "GEMINI_API_KEY is not set. Start the server with:\n"
                    "  PowerShell: $env:GEMINI_API_KEY='AQ.Ab8...'\n"
                    "  CMD:        set GEMINI_API_KEY=AQ.Ab8..."
                )
            })
            return

        log("OK", f"API key present (ends ...{api_key[-4:]}), calling Gemini")

        try:
            result = self._call_gemini(api_key, messages)
            log("OK", f"Analysis complete: emotion={result.get('emotion')}, risk={result.get('risk_score')}")
            self._json(200, result)
        except Exception as exc:
            log("ERR", f"Gemini call failed: {exc}")
            self._json(500, {"error": str(exc)})

    def _call_gemini(self, api_key, messages):
        # Build Gemini contents array
        # Gemini uses role "user" / "model" (not "assistant")
        contents = []
        for m in messages:
            role = "model" if m.get("role") in ("agent", "assistant", "model") else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m.get("content", "")}]
            })

        body = json.dumps({
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": 512,
                "temperature": 0.2,
                "responseMimeType": "application/json"
            }
        }).encode("utf-8")

        url = GEMINI_API_URL + "?key=" + api_key
        log("REQ", f"Sending {len(contents)} turn(s) to Gemini ({GEMINI_MODEL})")

        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")
                log("OK", f"Gemini responded HTTP {status}")
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            log("ERR", f"Gemini HTTP {exc.code}: {err_body[:300]}")
            raise Exception(f"Gemini API error {exc.code}: {err_body[:300]}")
        except urllib.error.URLError as exc:
            log("ERR", f"Network error: {exc.reason}")
            raise Exception(f"Network error reaching Gemini: {exc.reason}")

        envelope = json.loads(raw)
        log("RAW", f"Gemini envelope keys: {list(envelope.keys())}")

        # Extract text from Gemini response format
        try:
            text = envelope["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError) as exc:
            raise Exception(f"Unexpected Gemini response shape: {raw[:300]}")

        log("RAW", f"LLM text (first 120 chars): {text[:120]}")

        # Strip optional markdown fences (even though we requested JSON MIME)
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) >= 3:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise Exception(f"LLM returned non-JSON: {text[:200]} ({exc})")

        log("OK", f"JSON parsed: keys={list(parsed.keys())}")
        return parsed

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=True).encode("utf-8")
        self._send_cors(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors(self, status):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("\n[WARNING] GEMINI_API_KEY is not set.")
        print("  PowerShell: $env:GEMINI_API_KEY='AQ.Ab8...'")
        print("  CMD:        set GEMINI_API_KEY=AQ.Ab8...\n")
    else:
        print(f"\n[OK] GEMINI_API_KEY detected (ends ...{api_key[-4:]})")

    print(f"[SERVER] Starting on http://localhost:{PORT}/")
    print("[SERVER] Press Ctrl+C to stop.\n")

    with ThreadedHTTPServer(("", PORT), EmotionAIHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[SERVER] Stopped.")


if __name__ == "__main__":
    main()
