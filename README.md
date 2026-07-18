# EmotionAI — Real-Time Customer Experience Intelligence

A dual-panel customer support intelligence demo powered by a **real LLM call** to Anthropic Claude. The left panel shows what the customer sees; the right panel shows the live emotion analysis, risk scores, and AI recommendations that the support agent sees — updating after every message.

---

## Screenshots

- **Left Panel (Customer View):** Clean, warm-toned chat with quick-send buttons for rapid demo scenarios.
- **Right Panel (Agent Intelligence):** Dark control-room with emotion badges, sentiment bars, churn risk scores, AI recommendation cards, and an emotional pulse line chart.

---

## ⚠️ Important: This Uses a Real Live API Call

Unlike traditional demos with mocked/hardcoded responses, **every customer message makes a real API call to Anthropic Claude** to analyze:

- **Emotion** (Happy / Neutral / Frustrated / Angry / Confused / Urgent)
- **Sentiment score** (0–100 scale)
- **Churn Risk score** (0–100, color-coded)
- **Urgency level** (Low / Medium / High / Critical)
- **AI Recommendation** for the agent
- **Agent reply** to display in chat

The analysis is done **server-side** — the API key is never exposed to the browser.

---

## 🔑 Setting the API Key

### Local Development

1. Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended for built-in `fetch`).
2. Get an Anthropic API key from [https://console.anthropic.com/](https://console.anthropic.com/).
3. Run the server with your key:

**On Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
node server.js
```

**On Windows (Command Prompt):**
```cmd
set ANTHROPIC_API_KEY=sk-ant-...
node server.js
```

**On Mac/Linux:**
```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

4. Open [http://localhost:8000](http://localhost:8000) in your browser.

---

### Netlify Deployment

1. Push this repo to GitHub.
2. Connect the repo to [Netlify](https://www.netlify.com/).
3. In your Netlify dashboard → **Site settings → Environment variables**, add:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key-here
   ```
4. Deploy. The `/api/analyze` endpoint is automatically handled by `netlify/functions/analyze.js` via the redirect in `netlify.toml`.

---

## 🗂 Project Structure

```
├── index.html              # Main dual-panel UI
├── style.css               # Design system (warm chat + dark control-room)
├── app.js                  # Client logic — chat, API calls, SVG pulse chart
├── server.js               # Local Node.js dev server (serves files + proxies API)
├── netlify.toml            # Netlify redirect: /api/analyze → serverless function
└── netlify/
    └── functions/
        └── analyze.js      # Netlify serverless function (calls Anthropic API)
```

---

## 🤝 Human-in-the-Loop Guidance

> **AI recommendations should always be reviewed by a human agent before being applied in a real deployment.**

The "Apply Action" button in the Intelligence panel is intentionally designed to require manual agent click — the AI suggests, the human decides. In production:

- An agent should review the recommendation text before acting on it.
- High-risk moments (risk score > 70) should trigger supervisor notification.
- The emotional pulse chart provides turn-by-turn context to help agents understand escalation patterns before responding.

---

## LLM Model

Uses `claude-3-5-sonnet-20241022` by default (configurable in `server.js` and `netlify/functions/analyze.js`). The system prompt instructs the model to return strict JSON only — no markdown, no prose.

---

## Running Locally Without an API Key

If no `ANTHROPIC_API_KEY` is set, the server will return an error response and the status pill in the top bar will show **"Analysis failed — retry"** in red. The UI will not crash — you can add the key and retry.
