/**
 * Netlify serverless function — /api/analyze
 * Proxies to Anthropic Claude API server-side.
 * ANTHROPIC_API_KEY is read from process.env at request time.
 */

const SYSTEM_PROMPT = [
  'You are an expert customer experience analyzer.',
  'Analyze the customer conversation and return ONLY a strict JSON object.',
  'Do NOT include markdown fences, backticks, or any text outside the JSON.',
  'The JSON object must contain exactly these fields:',
  '- emotion: string, one of: Happy, Neutral, Frustrated, Angry, Confused, Urgent',
  '- emotion_score: integer 0-100',
  '- sentiment: string, one of: Positive, Neutral, Negative',
  '- sentiment_score: integer 0-100 (100=most positive, 0=most negative)',
  '- risk_score: integer 0-100 (churn risk; >70 high, 30-70 moderate, <30 low)',
  '- urgency: string, one of: Low, Medium, High, Critical',
  '- confidence: integer 0-100',
  '- recommendation: string action for the support agent',
  '- reply: string empathetic agent reply, max 2 sentences',
  'Return raw JSON only. No explanation, no markdown.',
].join('\n');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  // Pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method Not Allowed' });
  }

  // Parse body
  let messages;
  try {
    const payload = JSON.parse(event.body || '{}');
    messages = payload.messages;
    if (!messages || !Array.isArray(messages)) throw new Error('missing messages');
  } catch (e) {
    return jsonResp(400, { error: `Invalid request body: ${e.message}` });
  }

  // Read API key at request time
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResp(400, {
      error: 'ANTHROPIC_API_KEY is not configured as a Netlify environment variable.',
    });
  }

  // Map roles
  const apiMessages = messages.map(m => ({
    role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content || '',
  }));

  // Call Anthropic
  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });
  } catch (netErr) {
    return jsonResp(502, { error: `Network error reaching Anthropic: ${netErr.message}` });
  }

  const envelope = await resp.json();

  if (!resp.ok) {
    const msg = envelope?.error?.message || JSON.stringify(envelope);
    return jsonResp(resp.status, { error: `Anthropic API error ${resp.status}: ${msg}` });
  }

  const rawText = (envelope?.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(rawText);
    return jsonResp(200, parsed);
  } catch (e) {
    return jsonResp(500, { error: `LLM returned non-JSON: ${rawText.slice(0, 200)}` });
  }
};
