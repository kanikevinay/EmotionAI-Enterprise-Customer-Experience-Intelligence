"""
EmotionAI — Python Local Dev Server
Serves static files and proxies /api/analyze to the Anthropic Claude API.

Usage (PowerShell):
    $env:ANTHROPIC_API_KEY="sk-ant-..."
    python server.py

Usage (CMD):
    set ANTHROPIC_API_KEY=sk-ant-...
    python server.py

Requires Python 3.8+  (stdlib only — no pip installs needed).
"""

import http.server
import socketserver
import json
import os
import sys
import urllib.request
import urllib.error
import datetime

PORT = int(os.environ.get("PORT", 8000))

SYSTEM_PROMPT = (
    "You are an expert customer experience analyzer.\n"
    "Analyze the customer conversation and return ONLY a strict JSON object.\n"
    "Do NOT include markdown fences, backticks, or any text outside the JSON.\n"
    "The JSON object must contain exactly these fields:\n"
    '- emotion: string, one of: Happy, Neutral, Frustrated, Angry, Confused, Urgent\n'
    "- emotion_score: integer 0-100\n"
    '- sentiment: string, one of: Positive, Neutral, Negative\n'
    "- sentiment_score: integer 0-100 (100=most positive, 0=most negative)\n"
    "- risk_score: integer 0-100 (churn risk; >70 high, 30-70 moderate, <30 low)\n"
    '- urgency: string, one of: Low, Medium, High, Critical\n'
    "- confidence: integer 0-100\n"
    "- recommendation: string action for the support agent\n"
    "- reply: string empathetic agent reply, max 2 sentences\n"
    "Return raw JSON only. No explanation, no markdown."
)


def log(level, msg):
    """Timestamped log to stdout."""
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}", flush=True)


class EmotionAIHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler: serves static files + proxies /api/analyze."""

    # Silence the default access log — we print our own
    def log_message(self, fmt, *args):
        pass

    # ------------------------------------------------------------------ #
    #  CORS pre-flight
    # ------------------------------------------------------------------ #
    def do_OPTIONS(self):
        self._send_cors(204)
        self.end_headers()

    # ------------------------------------------------------------------ #
    #  POST  /api/analyze
    # ------------------------------------------------------------------ #
    def do_POST(self):
        if self.path.split("?")[0] == "/api/analyze":
            self._handle_analyze()
        else:
            self.send_error(404, "Not Found")

    # ------------------------------------------------------------------ #
    #  Main analysis handler
    # ------------------------------------------------------------------ #
    def _handle_analyze(self):
        log("REQ", "POST /api/analyze received")

        # --- Read and parse body ---
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except Exception as exc:
            log("ERR", f"Bad request body: {exc}")
            self._json(400, {"error": f"Invalid request body: {exc}"})
            return

        messages = payload.get("messages")
        if not messages or not isinstance(messages, list):
            log("ERR", "Missing or invalid 'messages' field")
            self._json(400, {"error": "Request must include a non-empty 'messages' array."})
            return

        # --- Read API key at REQUEST TIME (not module load) ---
        api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            log("ERR", "ANTHROPIC_API_KEY not set in environment")
            self._json(400, {
                "error": (
                    "ANTHROPIC_API_KEY is not configured. "
                    "Set it as an environment variable and restart the server.\n"
                    "  PowerShell: $env:ANTHROPIC_API_KEY='sk-ant-...'\n"
                    "  CMD:        set ANTHROPIC_API_KEY=sk-ant-..."
                )
            })
            return

        log("OK", f"API key present (ends ...{api_key[-4:]}), calling Anthropic")

        # --- Call Anthropic ---
        try:
            result = self._call_anthropic(api_key, messages)
            log("OK", f"Analysis complete: emotion={result.get('emotion')}, risk={result.get('risk_score')}")
            self._json(200, result)
        except Exception as exc:
            log("ERR", f"Anthropic call failed: {exc}")
            self._json(500, {"error": str(exc)})

    # ------------------------------------------------------------------ #
    #  Anthropic API call
    # ------------------------------------------------------------------ #
    def _call_anthropic(self, api_key, messages):
        # Map roles: our 'agent' → Anthropic 'assistant', everything else → 'user'
        api_messages = []
        for m in messages:
            role = "assistant" if m.get("role") in ("agent", "assistant") else "user"
            api_messages.append({"role": role, "content": m.get("content", "")})

        body_bytes = json.dumps({
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 512,
            "system": SYSTEM_PROMPT,
            "messages": api_messages,
        }).encode("utf-8")

        log("REQ", f"Sending {len(api_messages)} message(s) to Anthropic (model: claude-3-5-sonnet-20241022)")

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body_bytes,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")
                log("OK", f"Anthropic responded HTTP {status}")
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            log("ERR", f"Anthropic HTTP {exc.code}: {err_body[:300]}")
            raise Exception(f"Anthropic API error {exc.code}: {err_body[:300]}")
        except urllib.error.URLError as exc:
            log("ERR", f"Network error: {exc.reason}")
            raise Exception(f"Network error reaching Anthropic: {exc.reason}")

        # Parse Anthropic response envelope
        try:
            envelope = json.loads(raw)
        except json.JSONDecodeError:
            raise Exception(f"Anthropic returned non-JSON: {raw[:200]}")

        if "error" in envelope:
            raise Exception(f"Anthropic error: {envelope['error'].get('message', envelope['error'])}")

        content_blocks = envelope.get("content", [])
        if not content_blocks:
            raise Exception("Anthropic returned empty content block")

        text = content_blocks[0].get("text", "").strip()
        log("RAW", f"LLM text (first 120 chars): {text[:120]}")

        # Strip optional markdown fences
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
            raise Exception(f"LLM returned non-JSON text: {text[:200]} ({exc})")

        log("OK", f"JSON parsed successfully: keys={list(parsed.keys())}")
        return parsed

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #
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


# ------------------------------------------------------------------ #
#  Threaded server
# ------------------------------------------------------------------ #
class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        print("\n[WARNING] ANTHROPIC_API_KEY is not set in the environment.")
        print("  Live analysis will return an error. Set the key and restart:")
        print("  PowerShell: $env:ANTHROPIC_API_KEY='sk-ant-...'")
        print("  CMD:        set ANTHROPIC_API_KEY=sk-ant-...\n")
    else:
        print(f"\n[OK] ANTHROPIC_API_KEY detected (ends ...{api_key[-4:]})")

    print(f"[SERVER] Starting on http://localhost:{PORT}/")
    print("[SERVER] Press Ctrl+C to stop.\n")

    with ThreadedHTTPServer(("", PORT), EmotionAIHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[SERVER] Stopped.")


if __name__ == "__main__":
    main()
