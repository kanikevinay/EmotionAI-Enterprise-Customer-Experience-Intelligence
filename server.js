/**
 * EmotionAI — Support Ops Console
 * server.js — Node.js HTTP server + Gemini API proxy
 *
 * Uses GEMINI_API_KEY from .env (never exposed to the client).
 */

'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');

// ── Load .env ──────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const PORT = process.env.PORT || 8000;

// ── MIME types ─────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
};

// ── Gemini system prompt ───────────────────────────────────
const SYSTEM_INSTRUCTION = `You are an expert customer experience analyzer.
Analyze the customer conversation and return ONLY a strict JSON object.
Do NOT include any markdown formatting, code block backticks, or trailing commas. Return raw valid JSON only.
The JSON object must contain these exact fields:
- emotion: (string — one of: Happy, Neutral, Frustrated, Angry, Confused, Urgent)
- emotion_score: (number 0–100)
- sentiment: (string — one of: Positive, Neutral, Negative)
- sentiment_score: (number 0–100, where 100 is highly positive and 0 is highly negative)
- risk_score: (number 0–100, churn risk; >70 is high, 30–70 is amber, <30 is low)
- urgency: (string — one of: Low, Medium, High, Critical)
- confidence: (number 0–100)
- recommendation: (string — action recommendation for the support agent, e.g. "Offer 15% discount")
- reply: (string — a short, empathetic agent reply to send to the customer, max 2 sentences)

Example output:
{
  "emotion": "Frustrated",
  "emotion_score": 85,
  "sentiment": "Negative",
  "sentiment_score": 15,
  "risk_score": 80,
  "urgency": "High",
  "confidence": 95,
  "recommendation": "Escalate to senior manager and offer 15% discount coupon",
  "reply": "I'm very sorry for the frustration this billing issue has caused. I have escalated this to our senior manager and am applying a 15% discount to your next invoice immediately."
}`;

// ── Build Gemini contents array from message history ───────
function buildGeminiContents(messages) {
  return messages.map(msg => ({
    role: (msg.role === 'agent' || msg.role === 'assistant') ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

// ── HTTP Server ────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── /api/analyze ──────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body || '{}');
        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid body: messages array is required.' }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server. Add it to your .env file.' }));
          return;
        }

        // Gemini 2.0 Flash endpoint
        const geminiUrl =
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const geminiBody = {
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: buildGeminiContents(messages),
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        };

        console.log('[GEMINI] Sending request to Gemini API...');
        const geminiResp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        if (!geminiResp.ok) {
          const errText = await geminiResp.text();
          console.error('[GEMINI] API error:', geminiResp.status, errText);
          res.writeHead(geminiResp.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Gemini API error (${geminiResp.status}): ${errText}` }));
          return;
        }

        const geminiData = await geminiResp.json();
        console.log('[GEMINI] Raw response received.');

        // Extract text from Gemini response
        const candidate = geminiData?.candidates?.[0];
        const rawText   = candidate?.content?.parts?.[0]?.text || '';

        let parsedData;
        try {
          const cleaned = rawText.trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/, '')
            .trim();
          parsedData = JSON.parse(cleaned);
        } catch (e) {
          console.error('[GEMINI] JSON parse error. Raw text:', rawText);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to parse JSON response from Gemini', raw: rawText }));
          return;
        }

        // Validate required fields
        const required = ['emotion','emotion_score','sentiment','sentiment_score',
                          'risk_score','urgency','confidence','recommendation','reply'];
        for (const f of required) {
          if (parsedData[f] == null) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Gemini response missing required field: "${f}"` }));
            return;
          }
        }

        console.log('[GEMINI] Sending parsed data to client:', JSON.stringify(parsedData, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parsedData));

      } catch (err) {
        console.error('[SERVER] Unexpected error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── Serve static files ────────────────────────────────────
  let reqUrl   = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : reqUrl);

  const relative = path.relative(__dirname, filePath);
  if (relative && relative.startsWith('..') && !path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname     = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, htmlContent) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 EmotionAI Server running at http://localhost:${PORT}/`);
  console.log(`✅ GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Loaded ✓' : '❌ MISSING — add to .env'}`);
});
