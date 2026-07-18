/**
 * Netlify serverless function — /api/analyze
 * Proxies to Google Gemini API server-side.
 * GEMINI_API_KEY is read from process.env at request time.
 */

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Method Not Allowed' });

  let messages;
  try {
    const payload = JSON.parse(event.body || '{}');
    messages = payload.messages;
    if (!messages || !Array.isArray(messages)) throw new Error('missing messages');
  } catch (e) {
    return jsonResp(400, { error: `Invalid request body: ${e.message}` });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return jsonResp(400, { error: 'GEMINI_API_KEY is not configured as a Netlify environment variable.' });

  // Map to Gemini role format
  const contents = messages.map(m => ({
    role: m.role === 'agent' || m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  let resp;
  try {
    resp = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 512, temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
  } catch (netErr) {
    return jsonResp(502, { error: `Network error reaching Gemini: ${netErr.message}` });
  }

  const envelope = await resp.json();
  if (!resp.ok) {
    const msg = envelope?.error?.message || JSON.stringify(envelope);
    return jsonResp(resp.status, { error: `Gemini API error ${resp.status}: ${msg}` });
  }

  let text = '';
  try {
    text = envelope.candidates[0].content.parts[0].text.trim();
  } catch (_) {
    return jsonResp(500, { error: `Unexpected Gemini response: ${JSON.stringify(envelope).slice(0, 200)}` });
  }

  // Strip optional fences
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();

  try {
    return jsonResp(200, JSON.parse(text));
  } catch (e) {
    return jsonResp(500, { error: `LLM returned non-JSON: ${text.slice(0, 200)}` });
  }
};
