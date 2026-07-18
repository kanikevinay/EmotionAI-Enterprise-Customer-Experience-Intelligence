/**
 * EmotionAI — Support Ops Console
 * app.js — Client Application Logic
 *
 * All analysis is done via POST /api/analyze (server-side proxy to Anthropic Claude).
 * The ANTHROPIC_API_KEY is NEVER in this file or any client code.
 */
'use strict';

// ─────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────
const appState = {
  history: [],        // [{role:'user'|'agent', content:string}]
  pulseScores: [],    // sentiment_score 0–100 per turn
  totalMsgs:    0,
  totalRisk:    0,
  highRiskCount: 0,
  busy:         false,
  currentRec:   null,
};

// ─────────────────────────────────────────────────────────
// EMOTION CONFIG
// ─────────────────────────────────────────────────────────
const EMOTIONS = {
  Happy:      { emoji: '\u{1F60A}' },
  Neutral:    { emoji: '\u{1F610}' },
  Frustrated: { emoji: '\u{1F624}' },
  Angry:      { emoji: '\u{1F621}' },
  Confused:   { emoji: '\u{1F615}' },
  Urgent:     { emoji: '\u{1F6A8}' },
};

const URGENCY_LEVEL = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' };

// ─────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function nowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─────────────────────────────────────────────────────────
// STATUS PILL  (note: parameter renamed to avoid shadowing appState)
// ─────────────────────────────────────────────────────────
function setApiStatus(statusKey, label) {
  console.log('[STATUS]', statusKey, label);
  const pill = el('api-status');
  el('status-text').textContent = label;
  pill.setAttribute('data-state', statusKey);
}

// ─────────────────────────────────────────────────────────
// ERROR BANNER
// ─────────────────────────────────────────────────────────
function showError(msg) {
  console.error('[ERROR]', msg);
  el('error-banner-text').textContent = msg;
  el('error-banner').style.display = 'flex';
  setApiStatus('error', 'Error');
}

function dismissError() {
  el('error-banner').style.display = 'none';
  setApiStatus('ready', 'Ready');
}

// ─────────────────────────────────────────────────────────
// CHAT RENDERING
// ─────────────────────────────────────────────────────────
function appendBubble(role, text) {
  const feed = el('chat-feed');
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
  t.textContent = nowTime();

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
  const feed = el('chat-feed');
  const note = document.createElement('div');
  note.className = 'sys-note';
  note.textContent = text;
  feed.appendChild(note);
  feed.scrollTop = feed.scrollHeight;
}

// ─────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────
function showTyping(visible) {
  el('typing-row').style.display = visible ? 'flex' : 'none';
  if (visible) el('chat-feed').scrollTop = el('chat-feed').scrollHeight;
}

// ─────────────────────────────────────────────────────────
// TEXTAREA AUTO-RESIZE
// ─────────────────────────────────────────────────────────
function autoResize(elem) {
  elem.style.height = 'auto';
  elem.style.height = Math.min(elem.scrollHeight, 100) + 'px';
}

// ─────────────────────────────────────────────────────────
// KEYBOARD HANDLER
// ─────────────────────────────────────────────────────────
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ─────────────────────────────────────────────────────────
// QUICK SEND
// ─────────────────────────────────────────────────────────
function sendQuickMessage(text) {
  el('cust-input').value = text;
  autoResize(el('cust-input'));
  sendMessage();
}

// ─────────────────────────────────────────────────────────
// SEND MESSAGE — MAIN FLOW
// ─────────────────────────────────────────────────────────
async function sendMessage() {
  const input = el('cust-input');
  const text = (input.value || '').trim();

  console.log('[SEND] sendMessage called, text length:', text.length, 'busy:', appState.busy);

  if (!text) {
    console.warn('[SEND] Empty message, ignoring');
    return;
  }
  if (appState.busy) {
    console.warn('[SEND] Already busy, ignoring');
    return;
  }

  // Dismiss any previous error
  el('error-banner').style.display = 'none';

  // Clear input immediately
  input.value = '';
  input.style.height = 'auto';

  // Lock UI
  el('send-btn').disabled = true;
  appState.busy = true;

  // Render customer bubble first
  appendBubble('customer', text);
  appState.history.push({ role: 'user', content: text });
  console.log('[SEND] Customer bubble appended, history length:', appState.history.length);

  // Show loading state
  showTyping(true);
  setApiStatus('loading', 'Analyzing\u2026');

  try {
    console.log('[SEND] Calling /api/analyze...');
    const data = await callAnalyzeAPI(appState.history);
    console.log('[SEND] Response received:', data);

    showTyping(false);

    // Render agent reply
    appendBubble('agent', data.reply);
    appState.history.push({ role: 'agent', content: data.reply });

    // Update ops panel
    updateOpsPanel(data);

    // Stats
    appState.totalMsgs++;
    appState.totalRisk += data.risk_score;
    if (data.risk_score > 70) appState.highRiskCount++;
    updateStats();

    // Sparkline
    appState.pulseScores.push(data.sentiment_score);
    renderSparkline();

    setApiStatus('ready', 'Ready');

  } catch (err) {
    console.error('[SEND] Error:', err);
    showTyping(false);
    appendSysNote('Analysis error: ' + err.message);
    showError(err.message.length > 150 ? err.message.slice(0, 150) + '\u2026' : err.message);

  } finally {
    // ALWAYS re-enable, regardless of success or failure
    appState.busy = false;
    el('send-btn').disabled = false;
    input.focus();
    console.log('[SEND] Done. busy=false, button re-enabled');
  }
}

// ─────────────────────────────────────────────────────────
// API CALL  /api/analyze
// ─────────────────────────────────────────────────────────
async function callAnalyzeAPI(messages) {
  let resp;
  try {
    resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    console.log('[API] fetch returned status:', resp.status);
  } catch (netErr) {
    throw new Error('Network error — could not reach /api/analyze. Is the server running?');
  }

  let data;
  try {
    data = await resp.json();
  } catch (_) {
    throw new Error(`Server returned non-JSON (HTTP ${resp.status})`);
  }

  if (!resp.ok) {
    throw new Error(data?.error || `Server error ${resp.status}`);
  }

  // Validate required fields
  const required = ['emotion','emotion_score','sentiment','sentiment_score',
                     'risk_score','urgency','confidence','recommendation','reply'];
  for (const f of required) {
    if (data[f] == null) {
      throw new Error(`LLM response missing required field: "${f}"`);
    }
  }

  return data;
}

// ─────────────────────────────────────────────────────────
// UPDATE OPS PANEL
// ─────────────────────────────────────────────────────────
function updateOpsPanel(d) {
  const emotionKey = d.emotion || 'Neutral';
  const cfg = EMOTIONS[emotionKey] || EMOTIONS['Neutral'];
  const sentiment = Math.max(0, Math.min(100, Number(d.sentiment_score)));
  const risk      = Math.max(0, Math.min(100, Number(d.risk_score)));
  const urgency   = (d.urgency || 'Low');

  // ── Emotion ──
  el('emotion-glyph').textContent = cfg.emoji;
  el('emotion-name').textContent  = emotionKey;
  el('emotion-score-val').textContent = Math.round(Number(d.confidence)) + '%';

  // ── Sentiment bar ──
  el('sentiment-name').textContent    = d.sentiment || '\u2014';
  el('sentiment-fill').style.width    = sentiment + '%';
  el('sentiment-pin').style.left      = sentiment + '%';

  // ── Risk score ──
  const riskNumEl = el('risk-num');
  animateInt(riskNumEl, parseInt(riskNumEl.textContent) || 0, Math.round(risk));
  el('risk-fill').style.width = risk + '%';

  if (risk > 70) {
    el('risk-fill').style.background = '#B03030';
    riskNumEl.style.color = 'var(--risk-high)';
    el('risk-card').style.background = 'var(--risk-high-bg)';
  } else if (risk > 30) {
    el('risk-fill').style.background = '#C8860A';
    riskNumEl.style.color = 'var(--risk-mid)';
    el('risk-card').style.background = 'var(--risk-mid-bg)';
  } else {
    el('risk-fill').style.background = '#2A7A40';
    riskNumEl.style.color = 'var(--risk-low)';
    el('risk-card').style.background = 'var(--risk-low-bg)';
  }

  // ── Urgency tag ──
  const uTag = el('urgency-tag');
  uTag.textContent = urgency;
  uTag.setAttribute('data-level', URGENCY_LEVEL[urgency] || 'low');

  // ── Recommendation ──
  el('rec-text').textContent = d.recommendation || '\u2014';
  appState.currentRec = d.recommendation;
  el('apply-btn').disabled = false;
}

// ─────────────────────────────────────────────────────────
// ANIMATE INTEGER
// ─────────────────────────────────────────────────────────
function animateInt(elem, from, to) {
  const dur = 480;
  const start = performance.now();
  (function tick(now) {
    const pct = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - pct, 3);
    elem.textContent = Math.round(from + (to - from) * eased);
    if (pct < 1) requestAnimationFrame(tick);
  })(start);
}

// ─────────────────────────────────────────────────────────
// SPARKLINE
// ─────────────────────────────────────────────────────────
function renderSparkline() {
  const pts = appState.pulseScores;
  const n   = pts.length;

  el('spark-turns').textContent = n;

  const ph = el('spark-placeholder');
  if (ph) ph.style.display = 'none';

  // SVG viewBox="0 0 460 60"
  // Y: sentiment 100 → y=5, 50 → y=30, 0 → y=55
  const X0 = 42, X1 = 455, plotW = X1 - X0;

  const toY = s => 55 - (s / 100) * 50;
  const toX = i => n === 1 ? (X0 + X1) / 2 : X0 + (i / (n - 1)) * plotW;

  const coords = pts.map((s, i) => ({ x: toX(i), y: toY(s) }));

  const d = n === 0 ? '' :
    coords.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  el('spark-line').setAttribute('d', d);

  const dotsG = el('spark-dots');
  dotsG.innerHTML = '';
  coords.forEach(({ x, y }, i) => {
    const isLast = i === n - 1;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r',  isLast ? '3.5' : '2');
    c.setAttribute('fill', 'var(--ink-blue)');
    c.setAttribute('opacity', isLast ? '1' : '0.4');
    dotsG.appendChild(c);
  });
}

// ─────────────────────────────────────────────────────────
// SESSION STATS
// ─────────────────────────────────────────────────────────
function updateStats() {
  el('stat-msgs').textContent = appState.totalMsgs;
  el('stat-avg-risk').textContent = appState.totalMsgs > 0
    ? Math.round(appState.totalRisk / appState.totalMsgs)
    : '\u2014';
  el('stat-highrisk').textContent = appState.highRiskCount;
}

// ─────────────────────────────────────────────────────────
// APPLY ACTION
// ─────────────────────────────────────────────────────────
function applyAction() {
  if (!appState.currentRec) return;
  const btn = el('apply-btn');
  btn.textContent = 'Applied \u2713';
  btn.disabled = true;
  showToast('Action applied: ' + appState.currentRec);
  setTimeout(() => {
    btn.textContent = 'Apply action';
    btn.disabled = true; // stays disabled until next analysis
  }, 3500);
}

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] EmotionAI ops console loaded');

  el('cust-input').addEventListener('input', e => autoResize(e.target));

  // Randomise session ID
  const sid = 'SID-'
    + new Date().toISOString().slice(5, 10).replace('-', '')
    + '-'
    + String(Math.floor(Math.random() * 900) + 100);
  el('session-id').textContent = sid;

  appendSysNote('Session started. Use the quick-send buttons or type a message below.');
});
