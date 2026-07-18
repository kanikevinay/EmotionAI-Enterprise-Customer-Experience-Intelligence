/**
 * EmotionAI — Real-Time Dual-Panel Customer Experience Intelligence
 * app.js — Client Application Logic
 *
 * This file drives the customer chat UI and the live intelligence panel.
 * All emotion/risk analysis is powered by a real backend API call to
 * /api/analyze which proxies to the Anthropic Claude API server-side.
 * The API key is NEVER exposed in this client-side file.
 */

'use strict';

// ============================================================
// STATE
// ============================================================
const state = {
  conversationHistory: [],   // {role: 'user'|'agent', content: string}[]
  pulsePoints: [],           // sentiment_score values per turn (0–100)
  totalMessages: 0,
  totalRisk: 0,
  highRiskCount: 0,
  isAnalyzing: false,
  lastAnalysis: null,
  currentRecommendation: null,
};

// ============================================================
// EMOTION CONFIG
// ============================================================
const EMOTION_CONFIG = {
  Happy:      { emoji: '😊', label: 'Happy',      cssClass: 'happy',      pulseColor: '#22C55E' },
  Neutral:    { emoji: '😐', label: 'Neutral',    cssClass: 'neutral',    pulseColor: '#14B8A6' },
  Frustrated: { emoji: '😤', label: 'Frustrated', cssClass: 'frustrated', pulseColor: '#F59E0B' },
  Angry:      { emoji: '😡', label: 'Angry',      cssClass: 'angry',      pulseColor: '#EF4444' },
  Confused:   { emoji: '😕', label: 'Confused',   cssClass: 'confused',   pulseColor: '#A78BFA' },
  Urgent:     { emoji: '🚨', label: 'Urgent',     cssClass: 'urgent',     pulseColor: '#EF4444' },
};

const URGENCY_CLASS = {
  Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical',
};

// ============================================================
// DOM HELPERS
// ============================================================
function $(id) { return document.getElementById(id); }

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function showToast(message, type = 'teal') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast ${type === 'error' ? 'error-toast' : 'teal-toast'} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// ============================================================
// STATUS PILL
// ============================================================
function setStatus(status, text) {
  const pill = $('api-status-pill');
  const statusText = $('api-status-text');
  statusText.textContent = text;
  if (status === 'ready') {
    pill.className = 'status-pill';
  } else if (status === 'loading') {
    pill.className = 'status-pill';
    statusText.textContent = '⏳ Analyzing…';
  } else if (status === 'error') {
    pill.className = 'status-pill error';
  }
}

// ============================================================
// CHAT BUBBLE RENDERING
// ============================================================
function appendBubble(role, text) {
  const feed = $('chat-feed');
  const time = formatTime();

  const wrapper = document.createElement('div');
  wrapper.className = `chat-bubble-wrapper ${role}`;

  const avatarEl = document.createElement('div');
  avatarEl.className = `bubble-avatar ${role === 'agent' ? 'agent-av' : 'customer-av'}`;
  avatarEl.textContent = role === 'agent' ? 'AI' : 'C';

  const contentEl = document.createElement('div');
  contentEl.className = 'bubble-content';

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'bubble';
  bubbleEl.textContent = text;

  const timeEl = document.createElement('div');
  timeEl.className = 'bubble-time';
  timeEl.textContent = time;

  contentEl.appendChild(bubbleEl);
  contentEl.appendChild(timeEl);

  if (role === 'customer') {
    wrapper.appendChild(contentEl);
    wrapper.appendChild(avatarEl);
  } else {
    wrapper.appendChild(avatarEl);
    wrapper.appendChild(contentEl);
  }

  feed.appendChild(wrapper);
  feed.scrollTop = feed.scrollHeight;
}

// ============================================================
// TYPING INDICATOR
// ============================================================
function showTyping(visible) {
  $('typing-indicator').style.display = visible ? 'flex' : 'none';
  if (visible) {
    const feed = $('chat-feed');
    feed.scrollTop = feed.scrollHeight;
  }
}

// ============================================================
// SEND MESSAGE — MAIN ENTRY
// ============================================================
async function sendMessage() {
  const input = $('customer-input');
  const text = input.value.trim();
  if (!text || state.isAnalyzing) return;

  input.value = '';
  autoResizeTextarea(input);

  // Show customer bubble
  appendBubble('customer', text);

  // Add to history
  state.conversationHistory.push({ role: 'user', content: text });

  // Disable send button & show loading
  $('send-btn').disabled = true;
  state.isAnalyzing = true;
  showTyping(true);
  setStatus('loading', '⏳ Analyzing…');

  try {
    const result = await callAnalyzeAPI(state.conversationHistory);

    // Hide typing, show agent reply
    showTyping(false);
    appendBubble('agent', result.reply);

    // Add agent reply to history
    state.conversationHistory.push({ role: 'agent', content: result.reply });

    // Update intelligence panel
    updateIntelPanel(result);

    // Update session stats
    state.totalMessages++;
    state.totalRisk += result.risk_score;
    if (result.risk_score > 70) state.highRiskCount++;
    updateSessionStats();

    // Push pulse point
    state.pulsePoints.push(result.sentiment_score);
    renderPulseChart(result);

    setStatus('ready', 'Live Analysis Ready');
    state.lastAnalysis = result;

  } catch (err) {
    showTyping(false);
    setStatus('error', 'Analysis failed — retry');
    showToast(`Analysis failed: ${err.message}`, 'error');
    // Don't crash UI — still allow retrying
  } finally {
    state.isAnalyzing = false;
    $('send-btn').disabled = false;
    $('customer-input').focus();
  }
}

// ============================================================
// QUICK SEND HELPER
// ============================================================
function sendQuickMessage(text) {
  const input = $('customer-input');
  input.value = text;
  sendMessage();
}

// ============================================================
// KEYBOARD HANDLER
// ============================================================
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  autoResizeTextarea(e.target);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ============================================================
// API CALL TO /api/analyze
// ============================================================
async function callAnalyzeAPI(messages) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('Server returned an unparseable response.');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Server error ${response.status}`);
  }

  // Validate required fields
  const required = ['emotion','emotion_score','sentiment','sentiment_score','risk_score','urgency','confidence','recommendation','reply'];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`LLM response missing field: ${field}`);
    }
  }

  return data;
}

// ============================================================
// UPDATE INTELLIGENCE PANEL
// ============================================================
function updateIntelPanel(data) {
  const emotionKey = data.emotion;
  const cfg = EMOTION_CONFIG[emotionKey] || EMOTION_CONFIG['Neutral'];
  const sentimentScore = Math.max(0, Math.min(100, data.sentiment_score));
  const riskScore = Math.max(0, Math.min(100, data.risk_score));
  const urgencyKey = data.urgency;

  // ---- Emotion ----
  $('emotion-emoji').textContent = cfg.emoji;
  $('emotion-label').textContent = cfg.label;
  $('confidence-val').textContent = `${Math.round(data.confidence)}%`;
  const emotionBadge = $('emotion-badge');
  emotionBadge.textContent = emotionKey;
  emotionBadge.className = `intel-card-badge emotion-badge ${cfg.cssClass}`;

  // Glow effect on emotion card
  const emotionCard = $('emotion-card');
  emotionCard.className = 'intel-card' + (riskScore > 70 ? ' risk-high' : riskScore > 30 ? ' risk-amber' : '');

  // ---- Sentiment ----
  // Marker position: 0=fully negative, 50=neutral, 100=fully positive
  const markerPct = sentimentScore; // 0–100
  $('sentiment-marker').style.left = `${markerPct}%`;
  $('sentiment-bar').style.width = `${markerPct}%`;

  const sentimentBadge = $('sentiment-badge');
  sentimentBadge.textContent = data.sentiment;
  sentimentBadge.style.color = sentimentScore < 35 ? '#EF4444' : sentimentScore > 65 ? '#22C55E' : '#94A3B8';

  // ---- Risk ----
  const riskNum = $('risk-score-num');
  const riskBar = $('risk-bar');
  animateNumber(riskNum, parseInt(riskNum.textContent) || 0, Math.round(riskScore));
  riskBar.style.width = `${riskScore}%`;

  if (riskScore > 70) {
    riskBar.className = 'risk-bar-fill red';
    riskNum.style.color = '#EF4444';
  } else if (riskScore > 30) {
    riskBar.className = 'risk-bar-fill amber';
    riskNum.style.color = '#F59E0B';
  } else {
    riskBar.className = 'risk-bar-fill';
    riskNum.style.color = '#22C55E';
  }

  // ---- Urgency ----
  const urgBadge = $('urgency-badge');
  urgBadge.textContent = urgencyKey;
  urgBadge.className = `urgency-badge ${(URGENCY_CLASS[urgencyKey] || 'low')}`;

  // ---- Recommendation ----
  $('recommendation-text').textContent = data.recommendation;
  state.currentRecommendation = data.recommendation;
  const applyBtn = $('apply-action-btn');
  applyBtn.disabled = false;

  // Pulse chart color
  document.querySelector('.pulse-chart-svg').style.setProperty('--pulse-color', cfg.pulseColor);
}

// ============================================================
// ANIMATE NUMBER
// ============================================================
function animateNumber(el, from, to) {
  const duration = 600;
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ============================================================
// EMOTIONAL PULSE CHART (SVG)
// ============================================================
function renderPulseChart(latestData) {
  const points = state.pulsePoints;
  const n = points.length;

  // Update turn count
  $('pulse-turn-count').textContent = `${n} turn${n !== 1 ? 's' : ''}`;

  // Remove placeholder
  const placeholder = $('pulse-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  // SVG dimensions
  const W = 400;
  const H = 80;
  const paddingX = 16;
  const paddingY = 10;
  const plotW = W - paddingX * 2;
  const plotH = H - paddingY * 2;

  // Map sentiment_score (0–100) to y: 0 (top=very positive) or bottom (very negative)
  // We invert: high score → low y (top), low score → high y (bottom)
  function toY(score) {
    return paddingY + (1 - score / 100) * plotH;
  }

  function toX(index) {
    if (n === 1) return W / 2;
    return paddingX + (index / (n - 1)) * plotW;
  }

  // Build path
  let linePath = '';
  let areaPath = '';
  const coords = points.map((score, i) => ({ x: toX(i), y: toY(score) }));

  if (n === 1) {
    // Just a circle
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    areaPath = '';
  } else {
    // Smooth cubic bezier curves
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < n; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX = (prev.x + curr.x) / 2;
      linePath += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
    }

    // Area fill: same path but close down to bottom
    areaPath = linePath;
    areaPath += ` L ${coords[n-1].x} ${H} L ${coords[0].x} ${H} Z`;
  }

  $('pulse-line').setAttribute('d', linePath);
  $('pulse-area').setAttribute('d', areaPath);

  // Draw data points
  const pointsGroup = $('pulse-points');
  pointsGroup.innerHTML = '';

  const cfg = EMOTION_CONFIG[latestData.emotion] || EMOTION_CONFIG['Neutral'];
  coords.forEach((pt, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const isLatest = i === n - 1;
    circle.setAttribute('cx', pt.x);
    circle.setAttribute('cy', pt.y);
    circle.setAttribute('r', isLatest ? '5' : '3.5');
    circle.setAttribute('fill', isLatest ? cfg.pulseColor : 'rgba(255,255,255,0.5)');
    circle.setAttribute('stroke', isLatest ? 'white' : 'transparent');
    circle.setAttribute('stroke-width', isLatest ? '1.5' : '0');

    if (isLatest) {
      // Pulsing outer ring
      const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      outerCircle.setAttribute('cx', pt.x);
      outerCircle.setAttribute('cy', pt.y);
      outerCircle.setAttribute('r', '8');
      outerCircle.setAttribute('fill', 'none');
      outerCircle.setAttribute('stroke', cfg.pulseColor);
      outerCircle.setAttribute('stroke-width', '1');
      outerCircle.setAttribute('opacity', '0.4');
      pointsGroup.appendChild(outerCircle);
    }

    pointsGroup.appendChild(circle);
  });
}

// ============================================================
// SESSION STATS
// ============================================================
function updateSessionStats() {
  $('stat-messages').textContent = state.totalMessages;
  $('stat-avg-risk').textContent = state.totalMessages > 0
    ? Math.round(state.totalRisk / state.totalMessages)
    : '—';
  $('stat-high-risk').textContent = state.highRiskCount;
}

// ============================================================
// APPLY ACTION BUTTON
// ============================================================
function applyAction() {
  if (!state.currentRecommendation) return;
  const btn = $('apply-action-btn');
  btn.textContent = '✓ Action Applied';
  btn.disabled = true;
  btn.style.color = '#22C55E';
  btn.style.borderColor = 'rgba(34,197,94,0.4)';
  btn.style.background = 'rgba(34,197,94,0.1)';
  showToast(`Action applied: ${state.currentRecommendation}`, 'teal');

  // Reset button after 4 seconds if new recommendations come in
  setTimeout(() => {
    if (btn.disabled) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Apply Action`;
      btn.disabled = true;
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.style.background = '';
    }
  }, 4000);
}

// ============================================================
// INIT ON DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set textarea auto-resize
  const textarea = $('customer-input');
  textarea.addEventListener('input', () => autoResizeTextarea(textarea));

  // Initial status check — try a lightweight ping to confirm server is live
  setStatus('ready', 'Live Analysis Ready');

  // Add welcome system message in chat
  addSystemMessage('Session started. Type a customer message or use the quick-send buttons to begin emotion analysis.');
});

function addSystemMessage(text) {
  const feed = $('chat-feed');
  const msg = document.createElement('div');
  msg.style.cssText = `
    text-align: center;
    font-size: 0.72rem;
    color: #78716C;
    padding: 0.5rem 1rem;
    font-style: italic;
    animation: bubbleIn 0.4s ease;
  `;
  msg.textContent = text;
  feed.appendChild(msg);
}
