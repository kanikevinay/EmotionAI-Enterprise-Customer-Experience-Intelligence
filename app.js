/**
 * EmotionAI — Support Ops Console
 * app.js — Client Application Logic
 *
 * All emotion/risk analysis is powered by a real backend POST to /api/analyze,
 * which proxies server-side to the Anthropic Claude API.
 * The ANTHROPIC_API_KEY is NEVER in this file or any client-side code.
 */
'use strict';

// ============================================================
// STATE
// ============================================================
const state = {
  history: [],          // [{role, content}]
  pulseScores: [],      // sentiment_score 0–100 per turn
  totalMsgs: 0,
  totalRisk: 0,
  highRiskCount: 0,
  busy: false,
  currentRec: null,
};

// ============================================================
// EMOTION METADATA
// ============================================================
const EMOTIONS = {
  Happy:      { emoji: '😊' },
  Neutral:    { emoji: '😐' },
  Frustrated: { emoji: '😤' },
  Angry:      { emoji: '😡' },
  Confused:   { emoji: '😕' },
  Urgent:     { emoji: '🚨' },
};

const URGENCY_LEVEL = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' };

// ============================================================
// DOM HELPERS
// ============================================================
function $(id) { return document.getElementById(id); }

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// TOAST
// ============================================================
let _toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ============================================================
// STATUS INDICATOR
// ============================================================
function setStatus(state, label) {
  const el = $('api-status');
  $('status-text').textContent = label;
  el.setAttribute('data-state', state);
}

// ============================================================
// ERROR BANNER
// ============================================================
function showError(msg) {
  $('error-banner-text').textContent = msg;
  $('error-banner').style.display = 'flex';
  setStatus('error', 'Error');
}

function dismissError() {
  $('error-banner').style.display = 'none';
  setStatus('ready', 'Ready');
}

// ============================================================
// CHAT RENDERING
// ============================================================
function appendBubble(role, text) {
  const feed = $('chat-feed');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const av = document.createElement('div');
  av.className = `msg-av ${role}-av`;
  av.textContent = role === 'agent' ? 'AI' : 'C';

  const content = document.createElement('div');
  content.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  const t = document.createElement('div');
  t.className = 'msg-time';
  t.textContent = now();

  content.appendChild(bubble);
  content.appendChild(t);

  if (role === 'customer') {
    row.appendChild(content);
    row.appendChild(av);
  } else {
    row.appendChild(av);
    row.appendChild(content);
  }

  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

function appendSysNote(text) {
  const feed = $('chat-feed');
  const el = document.createElement('div');
  el.className = 'sys-note';
  el.textContent = text;
  feed.appendChild(el);
  feed.scrollTop = feed.scrollHeight;
}

// ============================================================
// TYPING INDICATOR
// ============================================================
function showTyping(v) {
  $('typing-row').style.display = v ? 'flex' : 'none';
  if (v) { const f = $('chat-feed'); f.scrollTop = f.scrollHeight; }
}

// ============================================================
// TEXTAREA AUTO-RESIZE
// ============================================================
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ============================================================
// KEYBOARD HANDLER
// ============================================================
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ============================================================
// QUICK SEND
// ============================================================
function sendQuickMessage(text) {
  $('cust-input').value = text;
  autoResize($('cust-input'));
  sendMessage();
}

// ============================================================
// SEND MESSAGE — MAIN FLOW
// ============================================================
async function sendMessage() {
  const input = $('cust-input');
  const text = input.value.trim();
  if (!text || state.busy) return;

  // Clear any previous error
  $('error-banner').style.display = 'none';

  input.value = '';
  autoResize(input);
  $('send-btn').disabled = true;
  state.busy = true;

  // Show customer bubble
  appendBubble('customer', text);
  state.history.push({ role: 'user', content: text });

  // Loading states
  showTyping(true);
  setStatus('loading', 'Analyzing…');

  try {
    const data = await callAnalyzeAPI(state.history);

    showTyping(false);
    appendBubble('agent', data.reply);
    state.history.push({ role: 'agent', content: data.reply });

    updateOpsPanel(data);

    // Accumulate stats
    state.totalMsgs++;
    state.totalRisk += data.risk_score;
    if (data.risk_score > 70) state.highRiskCount++;
    updateStats();

    // Pulse chart
    state.pulseScores.push(data.sentiment_score);
    renderSparkline();

    setStatus('ready', 'Ready');

  } catch (err) {
    showTyping(false);
    appendSysNote('Analysis failed — ' + err.message);
    showError(err.message.length > 120 ? err.message.slice(0, 120) + '…' : err.message);
  } finally {
    state.busy = false;
    $('send-btn').disabled = false;
    input.focus();
  }
}

// ============================================================
// API CALL
// ============================================================
async function callAnalyzeAPI(messages) {
  let resp;
  try {
    resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
  } catch (netErr) {
    throw new Error('Network error: could not reach /api/analyze. Is the server running?');
  }

  let data;
  try { data = await resp.json(); }
  catch (_) { throw new Error(`Server returned non-JSON (status ${resp.status})`); }

  if (!resp.ok) {
    throw new Error(data?.error || `API error ${resp.status}`);
  }

  // Validate required fields
  for (const f of ['emotion','emotion_score','sentiment','sentiment_score','risk_score','urgency','confidence','recommendation','reply']) {
    if (data[f] == null) throw new Error(`LLM response missing field: ${f}`);
  }

  return data;
}

// ============================================================
// UPDATE OPS PANEL
// ============================================================
function updateOpsPanel(d) {
  const emotionKey = d.emotion || 'Neutral';
  const cfg = EMOTIONS[emotionKey] || EMOTIONS['Neutral'];
  const sentiment = Math.max(0, Math.min(100, d.sentiment_score));
  const risk = Math.max(0, Math.min(100, d.risk_score));
  const urgency = (d.urgency || 'Low').toLowerCase();

  // Emotion
  $('emotion-glyph').textContent = cfg.emoji;
  $('emotion-name').textContent = emotionKey;
  $('emotion-score-val').textContent = Math.round(d.confidence) + '%';

  // Sentiment bar
  $('sentiment-name').textContent = d.sentiment || '—';
  $('sentiment-fill').style.width = sentiment + '%';
  $('sentiment-pin').style.left = sentiment + '%';

  // Risk
  const riskEl = $('risk-num');
  animateInt(riskEl, parseInt(riskEl.textContent) || 0, Math.round(risk));
  const riskFill = $('risk-fill');
  riskFill.style.width = risk + '%';

  if (risk > 70) {
    riskFill.style.background = '#B03030';
    riskEl.style.color = 'var(--risk-high)';
    $('risk-card').style.background = 'var(--risk-high-bg)';
  } else if (risk > 30) {
    riskFill.style.background = '#C8860A';
    riskEl.style.color = 'var(--risk-mid)';
    $('risk-card').style.background = 'var(--risk-mid-bg)';
  } else {
    riskFill.style.background = '#2A7A40';
    riskEl.style.color = 'var(--risk-low)';
    $('risk-card').style.background = 'var(--risk-low-bg)';
  }

  // Urgency tag
  const uTag = $('urgency-tag');
  uTag.textContent = d.urgency || 'Low';
  uTag.setAttribute('data-level', URGENCY_LEVEL[d.urgency] || 'low');

  // Recommendation
  $('rec-text').textContent = d.recommendation || '—';
  state.currentRec = d.recommendation;
  $('apply-btn').disabled = false;
}

// ============================================================
// ANIMATE INTEGER
// ============================================================
function animateInt(el, from, to) {
  const dur = 500, start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

// ============================================================
// SPARKLINE (plain — no fill, no glow)
// ============================================================
function renderSparkline() {
  const pts = state.pulseScores;
  const n = pts.length;

  $('spark-turns').textContent = n;

  const placeholder = $('spark-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  // SVG coordinate space: viewBox="0 0 460 60"
  // Y axis: 5 (positive top) → 30 (neutral mid) → 55 (negative bottom)
  // sentiment 100 → y=5, 50 → y=30, 0 → y=55
  const W_START = 42;      // left margin after Y labels
  const W_END   = 456;
  const plotW   = W_END - W_START;

  function toY(score) {
    // score 0–100 → y 55..5
    return 55 - (score / 100) * 50;
  }

  function toX(i) {
    if (n === 1) return (W_START + W_END) / 2;
    return W_START + (i / (n - 1)) * plotW;
  }

  const coords = pts.map((s, i) => ({ x: toX(i), y: toY(s) }));

  // Build path (simple polyline, no curves — real sparkline style)
  let d = '';
  if (n === 1) {
    d = `M ${coords[0].x} ${coords[0].y}`;
  } else {
    d = coords.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  $('spark-line').setAttribute('d', d);

  // Dots
  const dotsG = $('spark-dots');
  dotsG.innerHTML = '';
  coords.forEach(({ x, y }, i) => {
    const isLast = i === n - 1;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', isLast ? '3.5' : '2');
    circle.setAttribute('fill', 'var(--ink-blue)');
    circle.setAttribute('opacity', isLast ? '1' : '0.45');
    dotsG.appendChild(circle);
  });
}

// ============================================================
// SESSION STATS
// ============================================================
function updateStats() {
  $('stat-msgs').textContent = state.totalMsgs;
  $('stat-avg-risk').textContent = state.totalMsgs > 0
    ? Math.round(state.totalRisk / state.totalMsgs)
    : '—';
  $('stat-highrisk').textContent = state.highRiskCount;
}

// ============================================================
// APPLY ACTION
// ============================================================
function applyAction() {
  if (!state.currentRec) return;
  const btn = $('apply-btn');
  btn.textContent = 'Applied ✓';
  btn.disabled = true;
  showToast('Action applied: ' + state.currentRec);
  setTimeout(() => {
    btn.textContent = 'Apply action';
    // Keep disabled until next analysis provides a new recommendation
  }, 3500);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Auto-resize on input
  $('cust-input').addEventListener('input', (e) => autoResize(e.target));

  // Set a randomised session ID
  const sid = 'SID-' + new Date().toISOString().slice(5, 10).replace('-', '') + '-' +
    Math.floor(Math.random() * 900 + 100);
  $('session-id').textContent = sid;

  appendSysNote('Session started. Use the quick-send buttons or type a message.');
});
