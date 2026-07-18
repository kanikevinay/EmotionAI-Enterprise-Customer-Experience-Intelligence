exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const SYSTEM_PROMPT = `You are an expert customer experience analyzer.
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
- reply: (string - a short empathetic agent reply, max 2 sentences)`;

  try {
    const { messages } = JSON.parse(event.body || '{}');
    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }) };
    }

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
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errText }) };
    }

    const data = await response.json();
    const raw = data.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    try {
      const parsed = JSON.parse(raw);
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse LLM JSON', raw }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
