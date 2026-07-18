"""
EmotionAI — Python Local Dev Server
Serves static files and proxies /api/analyze to the Anthropic Claude API.

Usage (PowerShell):
    $env:ANTHROPIC_API_KEY="sk-ant-..."
    python server.py

Usage (CMD):
    set ANTHROPIC_API_KEY=sk-ant-...
    python server.py

Requires Python 3.8+ (uses http.server + urllib).
"""

import http.server
import socketserver
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
import threading

PORT = int(os.environ.get("PORT", 8000))
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are an expert customer experience analyzer.
Analyze the customer conversation and return ONLY a strict JSON object.
Do not include any markdown formatting, code block backticks, or trailing commas. It must be valid raw JSON.
The JSON object must contain these fields:
- emotion: (string - one of Happy, Neutral, Frustrated, Angry, Confused, Urgent)
- emotion_score: (number, 0 to 100)
- sentiment: (string - one of Positive, Neutral, Negative)
- sentiment_score: (number, 0 to 100, where 100 is highly positive and 0 is highly negative)
- risk_score: (number, 0 to 100, churn risk rating where >70 is high, 30-70 is amber, <30 is low)
- urgency: (string - one of Low, Medium, High, Critical)
- confidence: (number, 0 to 100)
- recommendation: (string - action recommendation for the agent)
- reply: (string - a short empathetic agent reply, max 2 sentences)"""


class EmotionAIHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")

    def do_OPTIONS(self):
        self.send_cors_headers(204)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/analyze":
            self._handle_analyze()
        else:
            self.send_error(404, "Not Found")

    def _handle_analyze(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body or "{}")
        except Exception as e:
            self._json_response(400, {"error": f"Invalid request body: {e}"})
            return

        messages = payload.get("messages")
        if not messages or not isinstance(messages, list):
            self._json_response(400, {"error": "messages array is required"})
            return

        if not ANTHROPIC_API_KEY:
            self._json_response(400, {
                "error": "ANTHROPIC_API_KEY is not configured. Set it as an environment variable before starting the server."
            })
            return

        try:
            result = self._call_anthropic(messages)
            self._json_response(200, result)
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _call_anthropic(self, messages):
        api_messages = []
        for msg in messages:
            role = "assistant" if msg.get("role") in ("agent", "assistant") else "user"
            api_messages.append({"role": role, "content": msg.get("content", "")})

        request_body = json.dumps({
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": api_messages,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=request_body,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise Exception(f"Anthropic API error {e.code}: {err_body}")
        except urllib.error.URLError as e:
            raise Exception(f"Network error calling Anthropic API: {e.reason}")

        raw_text = data["content"][0]["text"].strip()
        # Strip potential markdown code fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            raise Exception(f"LLM returned invalid JSON: {raw_text[:200]}")

    def _json_response(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_cors_headers(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self, status):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    if not ANTHROPIC_API_KEY:
        print("\n[WARNING] ANTHROPIC_API_KEY is not set.")
        print("   Live analysis will fail. Set the env var and restart.")
        print("   Windows CMD:        set ANTHROPIC_API_KEY=sk-ant-...")
        print("   Windows PowerShell: $env:ANTHROPIC_API_KEY='sk-ant-...'\n")
    else:
        print(f"\n[OK] ANTHROPIC_API_KEY detected (ending in ...{ANTHROPIC_API_KEY[-4:]})")

    with ThreadedHTTPServer(("", PORT), EmotionAIHandler) as httpd:
        print(f"[SERVER] EmotionAI running at http://localhost:{PORT}/")
        print("   Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
