const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

// Simple mime-type mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif'
};

const SYSTEM_PROMPT = `You are an expert customer experience analyzer.
Analyze the customer conversation and return ONLY a strict JSON object.
Do not include any markdown formatting, code block backticks (like \`\`\`json), or trailing commas. It must be valid raw JSON.
The JSON object must contain these fields:
- emotion: (string - one of Happy, Neutral, Frustrated, Angry, Confused, Urgent)
- emotion_score: (number, 0 to 100)
- sentiment: (string - one of Positive, Neutral, Negative)
- sentiment_score: (number, 0 to 100, where 100 is highly positive and 0 is highly negative)
- risk_score: (number, 0 to 100, churn risk rating where >70 is high, 30-70 is amber, <30 is low)
- urgency: (string - one of Low, Medium, High, Critical)
- confidence: (number, 0 to 100)
- recommendation: (string - action recommendation for the agent, e.g., 'Offer 15% discount', 'Escalate to billing team manager')
- reply: (string - a short, empathetic agent reply to send back to the customer, max 2 sentences)

Example Output:
{
  "emotion": "Frustrated",
  "emotion_score": 85,
  "sentiment": "Negative",
  "sentiment_score": 15,
  "risk_score": 80,
  "urgency": "High",
  "confidence": 95,
  "recommendation": "Escalate to senior manager and offer 15% discount coupon",
  "reply": "I'm very sorry for the frustration this billing issue has caused. I have escalated this to our senior manager and am applying a 15% discount to your next invoice immediately while we investigate."
}`;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoint for analysis
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

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server. Please set this environment variable.' }));
          return;
        }

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: messages.map(msg => ({
              role: msg.role === 'agent' || msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            }))
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Anthropic API error: ${errText}` }));
          return;
        }

        const data = await response.json();
        const assistantMessage = data.content[0].text;

        let parsedData;
        try {
          const cleanedMessage = assistantMessage.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          parsedData = JSON.parse(cleanedMessage);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to parse JSON response from LLM', raw: assistantMessage }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parsedData));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : reqUrl);

  // Prevent directory traversal
  const relative = path.relative(__dirname, filePath);
  if (relative && relative.startsWith('..') && !path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Fallback to index.html for SPA behavior or return 404
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
  console.log(`EmotionAI Server running at http://localhost:${PORT}/`);
  console.log(`To use real analysis, start with: set ANTHROPIC_API_KEY=your_key && node server.js`);
});
