// EmotionAI - Enterprise Customer Experience Intelligence
// Application Controller & Mock Data Engine

// Global State
let activeCustomer = 'sarah';
let activeTab = 'executive';
let charts = {};
let chatSimulationTimer = null;
let voiceAITimer = null;
let voiceWaveformActive = false;
let voiceWaveformAnimationFrame = null;

// Mock Customer Dataset
const customerData = {
  sarah: {
    id: 'sarah',
    fullName: 'Sarah Jenkins',
    initial: 'S',
    membership: 'Enterprise Tier 2',
    location: 'San Francisco, CA',
    language: 'English (US)',
    ltv: '$12,400',
    riskLevel: 'HIGH RISK',
    riskClass: 'danger',
    commStyle: 'Direct & Urgent',
    currentEmotion: 'FRUSTRATED',
    emotionScore: 84,
    stressLevel: 86,
    sentimentState: 'FRUSTRATED',
    sentimentBadgeClass: 'emotion-frustrated',
    sentimentIcon: 'frown',
    detectedIntent: 'Subscription Cancel due to Billing Decline',
    purchases: [
      { date: '2026-06-10', item: 'Enterprise API License', amount: '$2,500/mo' },
      { date: '2026-01-15', item: 'Custom Models Training Addon', amount: '$5,000' },
      { date: '2026-06-10', item: 'Premium SLA Support Package', amount: '$400/mo' }
    ],
    supportHistory: [
      { date: '2026-06-11', subject: 'API Timeout Errors', status: 'SLA Met', agent: 'John Connor', csat: '4.8/5.0' },
      { date: '2026-04-18', subject: 'Billing Invoice Query', status: 'Resolved', agent: 'Alex Gray', csat: '5.0/5.0' },
      { date: '2026-03-12', subject: 'Performance Drop SLA Warning', status: 'Escalated', agent: 'Tier 3 Support', csat: '3.2/5.0' }
    ],
    chatScript: [
      { sender: 'customer', text: "Hi, I'm trying to renew our subscription but the credit card transaction keeps failing. I have tried three times now.", time: '14:14', tag: 'Anxious' },
      { sender: 'system-alert', text: "AI Alert: Mild customer stress detected. Stripe reports: velocity_limit_exceeded.", time: '14:14' },
      { sender: 'agent', text: "Hi Sarah! I see the transaction failures in our log. It looks like your card issuer blocked the charge due to security velocity limits. Let me help you bypass this.", time: '14:15' },
      { sender: 'customer', text: "This is blocking our production deployments. If this isn't fixed today, we're going to migrate to a competitor. We can't have our API license expire.", time: '14:15', tag: 'Frustrated' },
      { sender: 'system-alert', text: "AI Alert: Critical stress levels detected (86%). User Intent: Churn risk flagged.", time: '14:15' },
      { sender: 'agent', text: "I completely understand the urgency, Sarah. I have applied a 15% loyalty coupon to your account, and I've temporarily extended your API license for 14 days so your production isn't interrupted while we clear the payment query.", time: '14:16' },
      { sender: 'customer', text: "Oh, thank you! That is a huge relief. The license error cleared. Can you send me the discount verification?", time: '14:16', tag: 'Relieved' },
      { sender: 'system-alert', text: "AI Alert: Customer stress level dropped to 15%. Churn risk reduced to Low.", time: '14:16' }
    ],
    recommendations: [
      {
        id: 'rec-coupon',
        title: 'Offer Loyalty Coupon',
        desc: 'Generate a 15% discount coupon for the next billing cycle to compensate for checkout friction.',
        priority: 'medium',
        confidence: '94%',
        satisfactionGain: '+28%',
        ctaText: 'Generate Coupon Code',
        outputTitle: 'Loyalty Coupon Code applied',
        outputContent: 'Generated Code: EMOTIONAI15\nApplying 15% off next month invoice.\nResponse Script:\n"I have generated and applied code EMOTIONAI15 to your next billing cycle as an apology for this payment friction. You should see a confirmation email shortly."'
      },
      {
        id: 'rec-escalate',
        title: 'Escalate to Accounts Manager',
        desc: 'Direct routing to Senior Manager due to high LTV value ($12k) and active competitor migration threat.',
        priority: 'high',
        confidence: '99%',
        satisfactionGain: '+42%',
        ctaText: 'Route to Manager',
        outputTitle: 'Tier-2 Manager Routed',
        outputContent: 'Ticket assigned to: Johnathan Drake (Lead Account Manager)\nStatus: Priority SLA Escalation Active.\nInternal Context: "Customer Sarah Jenkins (LTV $12,400) flagged for payment failure and churn risk. Resolving on billing tier."'
      },
      {
        id: 'rec-refund',
        title: 'Issue Invoice Token Extension',
        desc: 'Override license expiration temporarily to prevent production service drop while bank clears billing locks.',
        priority: 'high',
        confidence: '96%',
        satisfactionGain: '+39%',
        ctaText: 'Grant Token Extension',
        outputTitle: 'License Token Extended',
        outputContent: 'API License expiration date pushed: +14 days\nTarget Domain: dev-api.jenkins-enterprise.com\nAudit Log: Token extension processed by agent Alex Gray via Copilot command override.'
      }
    ],
    timelineNodes: [
      { title: 'Website Visit', time: '14:02 UTC', log: 'Customer initialized session from desktop IP 192.168.1.1 (Chrome, macOS). Active session duration: 0 mins. Referral source: Direct.', badgeClass: 'emotion-neutral' },
      { title: 'Product View', time: '14:05 UTC', log: 'Viewed /billing/subscriptions. Spent 3 minutes reading billing rules and seat expansion guidelines.', badgeClass: 'emotion-neutral' },
      { title: 'Checkout', time: '14:10 UTC', log: 'Initialized checkout flow for Enterprise Tier 2 renewal ($2,500/mo). Auto-filled credit card details.', badgeClass: 'emotion-neutral' },
      { title: 'Payment Failed', time: '14:12 UTC', log: 'Stripe transaction status: DECLINED. Error code: card_velocity_exceeded. Retried billing three times within 90 seconds.', badgeClass: 'emotion-anxious' },
      { title: 'Customer Frustrated', time: '14:14 UTC', log: 'Opened support widget. Entered query: "Your payment system is broken but the credit card transaction keeps failing. I have tried three times now."', badgeClass: 'emotion-frustrated' },
      { title: 'Emotion Detected', time: '14:15 UTC', log: 'System scanned sentence syntax, keyword clusters, and transaction logs. Alerted Agent: Frustration Score 84%, High Churn Risk.', badgeClass: 'emotion-frustrated' },
      { title: 'AI Recommendation', time: '14:15 UTC', log: 'Automated Copilot center queued suggestions: 15% discount coupon code and 14-day token extension override.', badgeClass: 'emotion-satisfied' },
      { title: 'Issue Solved', time: '14:16 UTC', log: 'Agent applied coupon and pushed temporary token license. Customer verified service restoration. NPS survey rating predicted: 9/10.', badgeClass: 'emotion-satisfied' }
    ]
  },

  michael: {
    id: 'michael',
    fullName: 'Michael Chen',
    initial: 'M',
    membership: 'Growth Tier SaaS',
    location: 'New York, NY',
    language: 'English (US)',
    ltv: '$45,800',
    riskLevel: 'LOW RISK',
    riskClass: 'emotion-satisfied',
    commStyle: 'Technical & Analytical',
    currentEmotion: 'ANXIOUS',
    emotionScore: 65,
    stressLevel: 58,
    sentimentState: 'ANXIOUS',
    sentimentBadgeClass: 'emotion-anxious',
    sentimentIcon: 'smile',
    detectedIntent: 'Enterprise Rate Limit Upgrade Request',
    purchases: [
      { date: '2026-05-01', item: 'Growth Plan Subscription', amount: '$500/mo' },
      { date: '2026-05-02', item: 'Seat Expansion (50 developers)', amount: '$1,000/mo' }
    ],
    supportHistory: [
      { date: '2026-05-02', subject: 'Seat count limit expansion', status: 'Resolved', agent: 'John Connor', csat: '4.8/5.0' }
    ],
    chatScript: [
      { sender: 'customer', text: "Hello, we are expanding our engineering team by 150 developers next week. We need to upgrade our limits but I don't see an option to customize the rate limits on your self-serve portal.", time: '09:23', tag: 'Inquisitive' },
      { sender: 'system-alert', text: "AI Alert: Intent classification - Enterprise Contract Upsell. Opportunity Tier: Tier 1 Expansion.", time: '09:23' },
      { sender: 'agent', text: "Hi Michael, congratulations on the expansion! Custom developer rate limits above our Growth tier are available under our Enterprise contract models. I can assist in setting this contract outline up.", time: '09:24' },
      { sender: 'customer', text: "Okay, but I need this sorted by Friday. I am anxious that if we don't get the contract signed, our dev team will hit rate limits during our project launch.", time: '09:24', tag: 'Anxious' },
      { sender: 'system-alert', text: "AI Alert: Mild customer anxiety detected (Stress level: 58%). Urgency is high. Suggest Sales VP calendar integration.", time: '09:24' },
      { sender: 'agent', text: "I understand the urgency, Michael. To fast-track this, I have queued a calendar link to meet directly with our VP of Sales. I have also manually raised your current rate limit ceiling by 200% for 7 days to buffer your developers in the meantime.", time: '09:25' },
      { sender: 'customer', text: "Wow, that is extremely helpful. I'll book the call now. Thank you so much!", time: '09:25', tag: 'Relieved' }
    ],
    recommendations: [
      {
        id: 'rec-schedule',
        title: 'Schedule Sales VP Call',
        desc: 'Direct calendar integration to setup a custom Enterprise rate limit contract with Sales leadership.',
        priority: 'high',
        confidence: '96%',
        satisfactionGain: '+34%',
        ctaText: 'Schedule Zoom Call',
        outputTitle: 'Sales VP Meeting Scheduled',
        outputContent: 'Meeting Link: zoom.us/j/emotionai-chen-enterprise\nTime Slot Requested: Friday 10:00 AM EST\nNotification: Sales executive notified of upcoming engineering limit upsell opportunity.'
      },
      {
        id: 'rec-buffer',
        title: 'Temporary Limit Buffer',
        desc: 'Courteously expand active development rate limit caps by 200% for 7 days during upsell negotiations.',
        priority: 'medium',
        confidence: '92%',
        satisfactionGain: '+32%',
        ctaText: 'Apply 200% Buffer',
        outputTitle: 'Rate Limit Buffer Active',
        outputContent: 'Rate Limit Ceiling: Updated from 10,000 req/min to 30,000 req/min.\nDuration: 7 Days (Expiring next Friday).\nAudit Code: ENT-UPGRADE-BUFFER-CHEN'
      }
    ],
    timelineNodes: [
      { title: 'Website Visit', time: '09:12 UTC', log: 'Customer initialized session from corporate headquarters. Device: Chrome OS. Active session: 10 mins.', badgeClass: 'emotion-neutral' },
      { title: 'Product View', time: '09:15 UTC', log: 'Spent 5 minutes evaluating rate limits API documentation and quotas.', badgeClass: 'emotion-neutral' },
      { title: 'Checkout', time: '09:20 UTC', log: 'Visited /billing/upgrade. Self-serve options limited to 50 developers limit. Limit warning prompted.', badgeClass: 'emotion-neutral' },
      { title: 'Payment Failed', time: '09:22 UTC', log: 'Billing: Success (No failures). Block encountered is rate-limit capability ceiling.', badgeClass: 'emotion-neutral' },
      { title: 'Customer Frustrated', time: '09:23 UTC', log: 'Opened conversation with agent. Expressed concern that developer team will hit rates during Friday launch.', badgeClass: 'emotion-anxious' },
      { title: 'Emotion Detected', time: '09:24 UTC', log: 'AI scanned dialogue. Anxiety markers detected (58% stress). Flagged as high value upsell (LTV $45k).', badgeClass: 'emotion-anxious' },
      { title: 'AI Recommendation', time: '09:24 UTC', log: 'Copilot system queued rate limit override extension and Calendly VP Sales route.', badgeClass: 'emotion-satisfied' },
      { title: 'Issue Solved', time: '09:25 UTC', log: 'Agent granted temporary rate buffer. Customer booked contract Zoom call. Satisfaction predicted: 4.8/5.0.', badgeClass: 'emotion-satisfied' }
    ]
  },

  elena: {
    id: 'elena',
    fullName: 'Elena Rostova',
    initial: 'E',
    membership: 'Startup Tier SaaS',
    location: 'London, UK',
    language: 'English (UK)',
    ltv: '$3,600',
    riskLevel: 'LOW RISK',
    riskClass: 'emotion-satisfied',
    commStyle: 'Polite & Collaborative',
    currentEmotion: 'SATISFIED',
    emotionScore: 92,
    stressLevel: 12,
    sentimentState: 'SATISFIED',
    sentimentBadgeClass: 'emotion-satisfied',
    sentimentIcon: 'smile',
    detectedIntent: 'Apply Retroactive Startup Discount Code',
    purchases: [
      { date: '2026-07-01', item: 'Startup Tier License', amount: '$150/mo' }
    ],
    supportHistory: [
      { date: '2026-06-11', subject: 'Feature Request: Webhooks', status: 'Answered', agent: 'Alex Gray', csat: '5.0/5.0' },
      { date: '2026-05-02', subject: 'API Key Generation UI', status: 'Resolved', agent: 'John Connor', csat: '4.7/5.0' }
    ],
    chatScript: [
      { sender: 'customer', text: "Hello, I just received our invoice for July but it looks like our startup discount code was not applied. Could you take a look?", time: '11:02', tag: 'Polite' },
      { sender: 'system-alert', text: "AI Alert: Routine billing query. Low stress level (12%). Opportunity: Apply coupon retroactively.", time: '11:02' },
      { sender: 'agent', text: "Hi Elena! Let me check the invoice. It looks like the discount code was scheduled to activate next billing cycle. I can apply it to this invoice manually for you.", time: '11:03' },
      { sender: 'customer', text: "That would be brilliant, thank you very much for sorting that so quickly.", time: '11:03', tag: 'Satisfied' },
      { sender: 'system-alert', text: "AI Alert: High customer satisfaction index verified (92%).", time: '11:03' },
      { sender: 'agent', text: "All done! I have applied a $45.00 credit to your balance. Your receipt should update in your billing panel shortly.", time: '11:04' }
    ],
    recommendations: [
      {
        id: 'rec-coupon-apply',
        title: 'Retroactive Startup Discount',
        desc: 'Apply startup discount coupon code manual override to credit customer account balance.',
        priority: 'medium',
        confidence: '98%',
        satisfactionGain: '+25%',
        ctaText: 'Credit Account Balance',
        outputTitle: 'Account Credit Processed',
        outputContent: 'Account Balance Credited: $45.00 USD\nReason: Coupon manual override.\nBilling status: Active/Paid. Invoice reference code: INV-2026-JUL-ROSTOVA'
      }
    ],
    timelineNodes: [
      { title: 'Website Visit', time: '10:55 UTC', log: 'Elena logged in from London, UK. Session: Mobile browser.', badgeClass: 'emotion-neutral' },
      { title: 'Product View', time: '10:57 UTC', log: 'Navigated to Billing tab. Reviewed July invoice.', badgeClass: 'emotion-neutral' },
      { title: 'Checkout', time: '10:58 UTC', log: 'No checkout. Routine monthly card billing occurred automatically.', badgeClass: 'emotion-neutral' },
      { title: 'Payment Failed', time: '10:58 UTC', log: 'Billing status: Successful ($150 paid). Customer noticed discount missing.', badgeClass: 'emotion-neutral' },
      { title: 'Customer Frustrated', time: '11:02 UTC', log: 'Customer opened ticket asking: "Looks like our startup discount code was not applied. Could you take a look?"', badgeClass: 'emotion-neutral' },
      { title: 'Emotion Detected', time: '11:02 UTC', log: 'AI analysis: Sentiment is Neutral/Polite. Stress is extremely low (12%).', badgeClass: 'emotion-neutral' },
      { title: 'AI Recommendation', time: '11:03 UTC', log: 'Copilot recommends immediate account credit refund of $45.00.', badgeClass: 'emotion-satisfied' },
      { title: 'Issue Solved', time: '11:04 UTC', log: 'Agent applied credit override. Elena verified resolution. Sentiment: 92% Satisfied.', badgeClass: 'emotion-satisfied' }
    ]
  }
};

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Setup icons
  lucide.createIcons();
  
  // Render current tab & customer
  switchTab(activeTab);
  onCustomerChange(activeCustomer);
  
  // Create all dynamic charts
  initCharts();
});

// Tab Router
function switchTab(tabId) {
  // Clear any active chat simulations
  if (chatSimulationTimer) {
    clearInterval(chatSimulationTimer);
    chatSimulationTimer = null;
    document.getElementById('btn-run-simulation').innerHTML = `<i data-lucide="play-circle"></i> Trigger Conversation Simulation`;
    lucide.createIcons();
  }

  // Update navbar items classes
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const selectedNavItem = document.getElementById(`nav-${tabId}`);
  if (selectedNavItem) {
    selectedNavItem.classList.add('active');
  }

  // Toggle active pane
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const selectedPane = document.getElementById(`view-${tabId}`);
  if (selectedPane) {
    selectedPane.classList.add('active');
  }

  // Update title in header
  const titleMap = {
    executive: { title: 'Executive Overview', icon: 'layout-dashboard', color: 'var(--accent-blue)' },
    conversation: { title: 'AI Live Workspace', icon: 'message-square', color: 'var(--accent-purple)' },
    recommendations: { title: 'AI Recommendation Center', icon: 'zap', color: 'var(--accent-purple)' },
    timeline: { title: 'Customer Journey Timeline', icon: 'git-commit', color: 'var(--accent-blue)' },
    analytics: { title: 'CX Analytics Dashboard', icon: 'bar-chart-3', color: 'var(--accent-blue)' },
    insights: { title: 'AI Insights Diagnostics', icon: 'lightbulb', color: 'var(--warning)' },
    profile: { title: 'Customer Profile Hub', icon: 'user', color: 'var(--accent-blue)' },
    'voice-ai': { title: 'Voice AI Voice Stream', icon: 'mic', color: 'var(--accent-purple)' }
  };

  const headerInfo = titleMap[tabId];
  if (headerInfo) {
    document.getElementById('header-view-title').innerHTML = `
      <i data-lucide="${headerInfo.icon}" style="color: ${headerInfo.color};"></i> 
      <span>${headerInfo.title}</span>
    `;
    lucide.createIcons();
  }

  activeTab = tabId;

  // Handle specific tab loading callbacks
  if (tabId === 'analytics') {
    // Redraw charts due to container dimensions
    setTimeout(renderAnalyticsCharts, 50);
  } else if (tabId === 'executive') {
    setTimeout(renderExecutiveCharts, 50);
  } else if (tabId === 'voice-ai') {
    initVoiceWaveformCanvas();
  }
}

// Return back to Landing Page view
function returnToLanding() {
  document.getElementById('app-workspace').style.display = 'none';
  document.getElementById('landing-page').style.display = 'flex';
}

// Show the demo dashboard workspace
function showDemo(runSimulate = false) {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('app-workspace').style.display = 'flex';
  
  switchTab('conversation');
  
  if (runSimulate) {
    setTimeout(() => {
      triggerSimulation();
    }, 400);
  }
}

// Customer Select Trigger
function onCustomerChange(val) {
  activeCustomer = val;
  const custData = customerData[val];

  // Sync select dropdown in case it was triggered elsewhere
  document.getElementById('global-customer-select').value = val;

  // Update Chat Header & Profile details
  document.getElementById('chat-avatar-char').innerText = custData.initial;
  document.getElementById('chat-user-fullname').innerText = custData.fullName;
  
  // Render initial static chat logs
  renderChatMessages(custData.chatScript.slice(0, 1));
  
  // Update Live Telemetry
  updateTelemetry(custData.emotionScore, custData.stressLevel, custData.commStyle, custData.detectedIntent, custData.ltv, custData.riskLevel, custData.sentimentState);

  // Render Recommendations Cards
  renderRecommendations(custData.recommendations);
  
  // Render Timeline Nodes
  updateTimelineProgress(custData.timelineNodes);

  // Render Profile View
  renderCustomerProfile(custData);

  // Update Executive Summary Metrics in Real-Time
  updateExecutiveScores(custData);
}

// Dynamic Telemetry Updater
function updateTelemetry(emotion, stress, comm, intent, ltv, risk, sentiment) {
  // Dial Animation
  const dashOffset = 251.2 - (251.2 * emotion) / 100;
  const progressCircle = document.getElementById('dial-emotion-progress');
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = dashOffset;
  }
  document.getElementById('dial-emotion-text').innerText = emotion;

  // Stress Level bar
  const stressVal = document.getElementById('telemetry-stress-value');
  const stressBar = document.getElementById('telemetry-stress-bar');
  if (stressVal && stressBar) {
    stressVal.innerText = `${stress}%`;
    stressBar.style.width = `${stress}%`;
  }

  // Sentiment state badge
  const badge = document.getElementById('telemetry-sentiment-badge');
  if (badge) {
    badge.className = `tel-badge emotion-${sentiment.toLowerCase()}`;
    
    // Swap icon
    const iconName = sentiment === 'FRUSTRATED' || sentiment === 'ANXIOUS' ? 'frown' : 'smile';
    badge.innerHTML = `<i data-lucide="${iconName}"></i> ${sentiment}`;
    lucide.createIcons();
  }

  // Buying Intent bar
  const intentVal = document.getElementById('telemetry-intent-value');
  const intentBar = document.getElementById('telemetry-intent-bar');
  if (intentVal && intentBar) {
    const isHigh = sentiment !== 'SATISFIED';
    intentVal.innerText = isHigh ? 'High (82%)' : 'Medium (54%)';
    intentBar.style.width = isHigh ? '82%' : '54%';
  }

  // Texts
  document.getElementById('telemetry-detected-intent').innerText = intent;
  document.getElementById('telemetry-ltv-value').innerText = `${ltv} (LTV)`;
  
  const riskBadge = document.getElementById('telemetry-risk-badge');
  if (riskBadge) {
    riskBadge.innerText = risk;
    riskBadge.style.color = risk === 'HIGH RISK' ? 'var(--danger)' : 'var(--success)';
  }
}

// Conversation Simulator (Active Typing & Storytelling)
function triggerSimulation() {
  const custData = customerData[activeCustomer];
  const simulatorBtn = document.getElementById('btn-run-simulation');

  // If already running, cancel it
  if (chatSimulationTimer) {
    clearInterval(chatSimulationTimer);
    chatSimulationTimer = null;
    simulatorBtn.innerHTML = `<i data-lucide="play-circle"></i> Trigger Conversation Simulation`;
    lucide.createIcons();
    return;
  }

  simulatorBtn.innerHTML = `<i data-lucide="pause-circle"></i> Running Simulation...`;
  lucide.createIcons();

  let messageIdx = 1; // start from second message (first message already active)
  const totalMessages = custData.chatScript.length;

  chatSimulationTimer = setInterval(() => {
    if (messageIdx >= totalMessages) {
      clearInterval(chatSimulationTimer);
      chatSimulationTimer = null;
      simulatorBtn.innerHTML = `<i data-lucide="play-circle"></i> Simulation Completed`;
      lucide.createIcons();
      return;
    }

    const msg = custData.chatScript[messageIdx];
    
    // Show typing animation if customer is speaking next
    if (msg.sender === 'customer') {
      const typingIndicator = document.getElementById('chat-typing-indicator');
      typingIndicator.style.display = 'flex';

      setTimeout(() => {
        typingIndicator.style.display = 'none';
        appendChatMessage(msg);
        messageIdx++;
      }, 1500);
    } else {
      // System alert or agent message
      appendChatMessage(msg);
      messageIdx++;
    }

    // Dynamic telemetry changes during conversation flow
    simulateDynamicTelemetryFlow(msg);

  }, 3500);
}

// Simulated dynamic dials updating based on specific conversation timestamps
function simulateDynamicTelemetryFlow(msg) {
  if (msg.sender === 'system-alert') {
    if (msg.text.includes('Critical stress')) {
      updateTelemetry(91, 95, 'High Urgency', 'Subscription Cancel / Churn Threat', '$12,400', 'CRITICAL CHURN RISK', 'FRUSTRATED');
    } else if (msg.text.includes('dropped to 15%')) {
      updateTelemetry(22, 15, 'Collaborative', 'Issue Resolved', '$12,400', 'LOW RISK', 'SATISFIED');
    }
  } else if (msg.sender === 'customer') {
    if (msg.tag === 'Relieved') {
      updateTelemetry(45, 25, 'Direct', 'Applying discount validation', '$12,400', 'LOW RISK', 'SATISFIED');
    }
  }
}

// Append message directly into Chat Container
function appendChatMessage(msg) {
  const container = document.getElementById('chat-conversation-feed');
  let html = '';

  if (msg.sender === 'system-alert') {
    html = `
      <div style="display:flex; justify-content:center; width:100%; margin: 0.5rem 0;">
        <div style="background: rgba(124, 58, 237, 0.1); border: 1px dashed rgba(124,58,237,0.3); color: #C084FC; font-size:0.8rem; padding: 0.35rem 0.85rem; border-radius:6px; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="bot" style="width:14px; height:14px;"></i> ${msg.text}
        </div>
      </div>
    `;
  } else {
    const isCustomer = msg.sender === 'customer';
    const alignClass = isCustomer ? 'customer' : 'agent';
    const tagHtml = isCustomer && msg.tag ? `<span class="message-emotion-tag emotion-${msg.tag.toLowerCase()}">${msg.tag}</span>` : '';
    const avatarChar = isCustomer ? customerData[activeCustomer].initial : 'A';
    const senderName = isCustomer ? customerData[activeCustomer].fullName : 'Agent Alex Grey (You)';

    html = `
      <div class="message-wrapper ${alignClass}">
        <div class="message-bubble">
          ${msg.text}
        </div>
        <div class="message-info">
          <span>${avatarChar}</span> • <span>${senderName}</span> • <span>${msg.time}</span>
          ${tagHtml}
        </div>
      </div>
    `;
  }

  container.insertAdjacentHTML('beforeend', html);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

// Initial full message render helper
function renderChatMessages(messages) {
  const container = document.getElementById('chat-conversation-feed');
  container.innerHTML = '';
  messages.forEach(msg => appendChatMessage(msg));
}

// Handle Manual input from support agent
function handleChatInput(e) {
  if (e.key === 'Enter') {
    sendCustomAgentMessage();
  }
}

function sendCustomAgentMessage() {
  const inputEl = document.getElementById('chat-user-input');
  const txt = inputEl.value.trim();
  if (!txt) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const customMsg = {
    sender: 'agent',
    text: txt,
    time: timeStr
  };
  
  appendChatMessage(customMsg);
  inputEl.value = '';
}

// AI Recommendations Card Renderer
function renderRecommendations(recs) {
  const container = document.getElementById('rec-container');
  container.innerHTML = '';

  recs.forEach(rec => {
    const pClass = rec.priority === 'high' || rec.priority === 'critical' ? 'high' : (rec.priority === 'medium' ? 'medium' : 'low');
    const priorityIcon = pClass === 'high' ? 'alert-octagon' : (pClass === 'medium' ? 'alert-circle' : 'info');

    const html = `
      <div class="rec-card glass glow-card">
        <div class="rec-badge-group">
          <span class="rec-priority ${pClass}">
            <i data-lucide="${priorityIcon}" style="width:12px; height:12px; vertical-align:middle; margin-right:2px;"></i> ${rec.priority}
          </span>
          <div class="rec-confidence">
            AI Confidence: <span>${rec.confidence}</span>
          </div>
        </div>
        <h3>${rec.title}</h3>
        <p>${rec.desc}</p>
        <div class="rec-stats">
          <div class="rec-stat-box">
            <h5>CSAT Improvement</h5>
            <p style="color: var(--success);">${rec.satisfactionGain}</p>
          </div>
          <div class="rec-stat-box">
            <h5>Suggested Protocol</h5>
            <p style="color: var(--text-secondary); font-size:0.9rem;">Automated System</p>
          </div>
        </div>
        <div class="rec-actions">
          <button class="btn btn-primary scale-hover" style="width:100%; font-size:0.85rem;" onclick="triggerRecommendationAction('${rec.id}')">
            <i data-lucide="play" style="width:14px;"></i> ${rec.ctaText}
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
  lucide.createIcons();
}

// Action button inside recommendation centers
function triggerRecommendationAction(recId) {
  const custData = customerData[activeCustomer];
  const selectedRec = custData.recommendations.find(r => r.id === recId);
  if (!selectedRec) return;

  const playPane = document.getElementById('recommendation-playground');
  playPane.classList.add('active');

  document.getElementById('playground-title').innerText = selectedRec.outputTitle;
  document.getElementById('playground-content').innerText = selectedRec.outputContent;
  
  // Smooth scroll to view action outputs
  playPane.scrollIntoView({ behavior: 'smooth' });
}

function copyPlaygroundCode() {
  const codeBox = document.getElementById('playground-content');
  navigator.clipboard.writeText(codeBox.innerText);
  
  // Quick temporary success feedback state
  const copyBtn = document.querySelector('#recommendation-playground .icon-btn');
  copyBtn.innerHTML = `<i data-lucide="check" style="color:var(--success);"></i>`;
  lucide.createIcons();
  
  setTimeout(() => {
    copyBtn.innerHTML = `<i data-lucide="copy"></i>`;
    lucide.createIcons();
  }, 1500);
}

function injectDraftToChat() {
  const codeText = document.getElementById('playground-content').innerText;
  
  // Extract response script portion if available
  let textToInject = codeText;
  const scriptMarker = 'Response Script:\n';
  if (codeText.includes(scriptMarker)) {
    textToInject = codeText.split(scriptMarker)[1].replace(/"/g, '');
  }

  // Router to conversation tab & fill input box
  switchTab('conversation');
  const inputBar = document.getElementById('chat-user-input');
  inputBar.value = textToInject;
  inputBar.focus();
}

// Timeline State controller
function updateTimelineProgress(nodes) {
  // Let's decide which node is currently active (e.g. state 5: Emotion Detected)
  const activeIdx = activeCustomer === 'sarah' ? 5 : (activeCustomer === 'michael' ? 6 : 7);
  
  // Set timeline progress line width percentage
  const total = nodes.length;
  const percentage = ((activeIdx) / (total - 1)) * 100;
  document.getElementById('timeline-progress-indicator').style.width = `${percentage}%`;

  // Draw node active states
  for (let i = 0; i < total; i++) {
    const nodeEl = document.getElementById(`node-${i}`);
    if (!nodeEl) continue;

    // Reset styles
    nodeEl.classList.remove('active', 'danger', 'success');

    if (i < activeIdx) {
      nodeEl.classList.add('active');
    } else if (i === activeIdx) {
      const bClass = nodes[i].badgeClass;
      if (bClass === 'emotion-frustrated') {
        nodeEl.classList.add('danger');
      } else if (bClass === 'emotion-satisfied') {
        nodeEl.classList.add('success');
      } else {
        nodeEl.classList.add('active');
      }
    }
  }

  // Load default detail for active node
  showTimelineNodeDetail(activeIdx);
}

function showTimelineNodeDetail(idx) {
  const custData = customerData[activeCustomer];
  const node = custData.timelineNodes[idx];
  if (!node) return;

  const detailArea = document.getElementById('timeline-details-area');
  
  let badgeHtml = '';
  if (node.badgeClass === 'emotion-frustrated') {
    badgeHtml = `<span class="tel-badge emotion-frustrated"><i data-lucide="frown"></i> FRUSTRATED ALERT</span>`;
  } else if (node.badgeClass === 'emotion-anxious') {
    badgeHtml = `<span class="tel-badge emotion-anxious"><i data-lucide="alert-circle"></i> ANXIETY FLAG</span>`;
  } else if (node.badgeClass === 'emotion-satisfied') {
    badgeHtml = `<span class="tel-badge emotion-satisfied"><i data-lucide="check-circle"></i> SYSTEM STABLE</span>`;
  } else {
    badgeHtml = `<span class="tel-badge emotion-neutral"><i data-lucide="activity"></i> NEUTRAL LOG</span>`;
  }

  document.getElementById('timeline-detail-badge').outerHTML = badgeHtml;
  document.getElementById('timeline-detail-title').innerText = node.title;
  document.getElementById('timeline-detail-time').innerText = `Logged Timestamp: ${node.time}`;
  document.getElementById('timeline-detail-log').innerText = node.log;
  lucide.createIcons();
}

// Profile Rendering
function renderCustomerProfile(cust) {
  document.getElementById('profile-avatar-char').innerText = cust.initial;
  document.getElementById('profile-fullname').innerText = cust.fullName;
  document.getElementById('profile-membership').innerText = cust.membership;
  document.getElementById('profile-meta-location').innerText = cust.location;
  document.getElementById('profile-meta-language').innerText = cust.language;
  document.getElementById('profile-meta-ltv').innerText = cust.ltv;
  document.getElementById('profile-meta-risk').innerText = cust.riskLevel;
  
  const riskColor = cust.riskLevel === 'HIGH RISK' ? 'var(--danger)' : 'var(--success)';
  document.getElementById('profile-meta-risk').style.color = riskColor;
  
  document.getElementById('profile-meta-style').innerText = cust.commStyle;
  document.getElementById('profile-sentiment-rating').innerText = cust.emotionScore;
  
  const ratingEl = document.getElementById('profile-sentiment-rating');
  ratingEl.style.color = cust.emotionScore > 75 ? 'var(--danger)' : (cust.emotionScore > 50 ? 'var(--warning)' : 'var(--success)');

  // Render purchases
  const purchaseContainer = document.getElementById('profile-purchase-list');
  purchaseContainer.innerHTML = '';
  cust.purchases.forEach(p => {
    purchaseContainer.insertAdjacentHTML('beforeend', `
      <div class="profile-history-item">
        <div>
          <strong style="display:block; font-size:0.85rem; color:white;">${p.item}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${p.date}</span>
        </div>
        <span style="color:var(--success);">${p.amount}</span>
      </div>
    `);
  });

  // Render support tickets
  const ticketContainer = document.getElementById('profile-support-list');
  ticketContainer.innerHTML = '';
  cust.supportHistory.forEach(t => {
    ticketContainer.insertAdjacentHTML('beforeend', `
      <div class="profile-history-item">
        <div>
          <strong style="display:block; font-size:0.85rem; color:white;">${t.subject}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${t.date} • Agent: ${t.agent}</span>
        </div>
        <span class="tel-badge emotion-satisfied" style="font-size: 0.7rem; padding: 0.15rem 0.4rem;">${t.csat}</span>
      </div>
    `);
  });
}

function updateExecutiveScores(cust) {
  // Simulating slightly different CEO aggregates depending on customer selected to show dynamic variations
  const trustScoreEl = document.getElementById('exec-trust-score');
  if (cust.id === 'sarah') {
    trustScoreEl.innerText = '94.2%';
  } else if (cust.id === 'michael') {
    trustScoreEl.innerText = '96.1%';
  } else {
    trustScoreEl.innerText = '98.4%';
  }
}

// Chart.js Configuration & Creation
function initCharts() {
  Chart.defaults.color = '#9CA3AF';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Create Executive Charts initially
  renderExecutiveCharts();
}

function renderExecutiveCharts() {
  if (charts.execRevenue) charts.execRevenue.destroy();
  if (charts.execRadar) charts.execRadar.destroy();

  const ctxRev = document.getElementById('chart-exec-revenue');
  if (ctxRev) {
    charts.execRevenue = new Chart(ctxRev.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
          label: 'Revenue Protected ($)',
          data: [18000, 32000, 48000, 64000, 85000, 110000, 142580],
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#7C3AED',
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { callback: value => '$' + value.toLocaleString() } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const ctxRadar = document.getElementById('chart-exec-radar');
  if (ctxRadar) {
    charts.execRadar = new Chart(ctxRadar.getContext('2d'), {
      type: 'radar',
      data: {
        labels: ['SLA Adherence', 'Response Rate', 'Trust Quotient', 'Emotional Stability', 'Revenue Protected', 'Agent Efficiency'],
        datasets: [{
          label: 'Target KPI',
          data: [90, 85, 92, 80, 85, 90],
          borderColor: 'rgba(255, 255, 255, 0.15)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderDash: [5, 5],
          borderWidth: 1
        }, {
          label: 'Current Metrics',
          data: [98, 92, 94, 88, 91, 95],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          pointBackgroundColor: '#3B82F6',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#F3F4F6' } } },
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            angleLines: { color: 'rgba(255,255,255,0.05)' },
            pointLabels: { color: '#9CA3AF', font: { size: 10 } },
            ticks: { display: false }
          }
        }
      }
    });
  }
}

function renderAnalyticsCharts() {
  if (charts.sentimentDist) charts.sentimentDist.destroy();
  if (charts.categories) charts.categories.destroy();
  if (charts.csatTrend) charts.csatTrend.destroy();

  const ctxSent = document.getElementById('chart-analytics-sentiment');
  if (ctxSent) {
    charts.sentimentDist = new Chart(ctxSent.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Satisfied', 'Neutral', 'Anxious', 'Frustrated'],
        datasets: [{
          data: [45, 32, 15, 8],
          backgroundColor: ['#22C55E', '#9CA3AF', '#F59E0B', '#EF4444'],
          borderColor: '#0F1422',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#F3F4F6', font: { size: 11 } } } }
      }
    });
  }

  const ctxCat = document.getElementById('chart-analytics-categories');
  if (ctxCat) {
    charts.categories = new Chart(ctxCat.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Billing Retries', 'Rate Limit Walls', 'API Timeout', 'Console UX', 'Webhook Fail'],
        datasets: [{
          data: [120, 84, 52, 41, 19],
          backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(59, 130, 246, 0.7)', '#7C3AED', 'rgba(255, 255, 255, 0.2)'],
          borderColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.03)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const ctxCsat = document.getElementById('chart-analytics-csat-history');
  if (ctxCsat) {
    charts.csatTrend = new Chart(ctxCsat.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
          label: 'With EmotionAI Copilot',
          data: [4.25, 4.42, 4.61, 4.75, 4.80, 4.82],
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointBackgroundColor: '#22C55E'
        }, {
          label: 'Without EmotionAI (Baseline)',
          data: [4.10, 4.08, 4.15, 4.12, 4.09, 4.11],
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.1,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#F3F4F6' } } },
        scales: {
          y: { min: 3.5, max: 5.0, grid: { color: 'rgba(255,255,255,0.03)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// -----------------------------------------------
// VOICE AI WAVEFORM CANVAS GENERATOR
// -----------------------------------------------
function initVoiceWaveformCanvas() {
  const canvas = document.getElementById('voice-canvas-render');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Set dimensions based on client bounds
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  let waveOffset = 0;

  function draw() {
    if (!voiceWaveformActive) {
      // Stream is offline - draw a flat line with micro noise
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      voiceWaveformAnimationFrame = requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine gradient/color depending on active client's stress
    const currentStress = customerData[activeCustomer].stressLevel;
    const isFrustrated = currentStress > 70;
    
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    if (isFrustrated) {
      // Fire red/yellow waves for angry customer
      grad.addColorStop(0, '#EF4444');
      grad.addColorStop(0.5, '#F59E0B');
      grad.addColorStop(1, '#EF4444');
    } else {
      // Purple/blue waves for neutral/satisfied
      grad.addColorStop(0, '#3B82F6');
      grad.addColorStop(0.5, '#7C3AED');
      grad.addColorStop(1, '#3B82F6');
    }

    // Draw 3 layers of overlapping sine waves
    drawSineWave(ctx, canvas.width, canvas.height, waveOffset, grad, 1.5, isFrustrated ? 30 : 15, 0.015);
    drawSineWave(ctx, canvas.width, canvas.height, waveOffset + 2, 'rgba(124, 58, 237, 0.25)', 1.0, isFrustrated ? 20 : 8, 0.025);
    drawSineWave(ctx, canvas.width, canvas.height, waveOffset + 4, 'rgba(59, 130, 246, 0.15)', 0.5, isFrustrated ? 45 : 22, 0.008);

    waveOffset += 0.08;
    voiceWaveformAnimationFrame = requestAnimationFrame(draw);
  }

  // Cancel previous frame loops before restarting
  if (voiceWaveformAnimationFrame) {
    cancelAnimationFrame(voiceWaveformAnimationFrame);
  }

  // Start rendering
  voiceWaveformAnimationFrame = requestAnimationFrame(draw);
}

function drawSineWave(ctx, width, height, offset, strokeStyle, lineWidth, amplitude, frequency) {
  ctx.beginPath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  
  for (let x = 0; x < width; x++) {
    const y = height / 2 + Math.sin(x * frequency + offset) * amplitude;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Voice Assistant Button Trigger
function toggleVoiceAIAssistant() {
  const card = document.getElementById('voice-assistant-card');
  const heading = document.getElementById('voice-status-heading');
  const subheading = document.getElementById('voice-status-subheading');
  const micIcon = document.getElementById('voice-mic-icon');
  
  if (voiceWaveformActive) {
    // Turn off
    voiceWaveformActive = false;
    card.classList.remove('active');
    heading.innerText = 'Voice Stream Offline';
    subheading.innerHTML = `<i data-lucide="info" style="width:16px;"></i> Click the microphone to simulate active voice integration`;
    micIcon.setAttribute('data-lucide', 'mic');
    lucide.createIcons();

    // Clear transcript timer
    if (voiceAITimer) {
      clearTimeout(voiceAITimer);
      voiceAITimer = null;
    }
    
    document.getElementById('voice-transcription-box').innerText = 'No active audio connection. Toggle the microphone stream above to simulate a live customer calling.';
    document.getElementById('voice-tone-val').innerText = 'Neutral';
    document.getElementById('voice-conf-val').innerText = '0.0%';
    document.getElementById('voice-rate-val').innerText = '0 WPM';
  } else {
    // Turn on
    voiceWaveformActive = true;
    card.classList.add('active');
    heading.innerText = 'Listening Voice Stream...';
    subheading.innerHTML = `<i class="pulse-dot"></i> Connected to Live customer voice network`;
    micIcon.setAttribute('data-lucide', 'square');
    lucide.createIcons();

    // Begin speech-to-text simulation
    simulateVoiceTranscription();
  }
}

function simulateVoiceTranscription() {
  const box = document.getElementById('voice-transcription-box');
  const cust = customerData[activeCustomer];
  
  box.innerText = 'Analyzing background vocal vibrations... Connection established.';

  voiceAITimer = setTimeout(() => {
    if (cust.id === 'sarah') {
      box.innerHTML = `<strong>Customer:</strong> "Yes, I am extremely frustrated. The billing code failed twice, and we are holding deployment pipelines. I need support immediately, is anyone there?"`;
      document.getElementById('voice-tone-val').innerText = 'Aggressive / Frustrated';
      document.getElementById('voice-conf-val').innerText = '98.8%';
      document.getElementById('voice-rate-val').innerText = '162 WPM (Rapid)';
    } else if (cust.id === 'michael') {
      box.innerHTML = `<strong>Customer:</strong> "Hello, we are expanding our dev headcount by 150 members next Monday. Need to scale limits but self-serve restricts it. Can we fast track this?"`;
      document.getElementById('voice-tone-val').innerText = 'Anxious / Urgent';
      document.getElementById('voice-conf-val').innerText = '97.2%';
      document.getElementById('voice-rate-val').innerText = '145 WPM';
    } else {
      box.innerHTML = `<strong>Customer:</strong> "Hi, just query on July discount codes application. It was resolved manually? Thank you for checking."`;
      document.getElementById('voice-tone-val').innerText = 'Satisfied / Polite';
      document.getElementById('voice-conf-val').innerText = '99.1%';
      document.getElementById('voice-rate-val').innerText = '112 WPM';
    }
  }, 2000);
}

// Simulates input from voice tool in live chat text box
function startSimulatedVoiceInput() {
  const inputBar = document.getElementById('chat-user-input');
  inputBar.value = 'Listening to agent voice overlay...';
  
  setTimeout(() => {
    inputBar.value = 'I am looking at your billing account now, and I can bypass the velocity block by applying a temporary extension license token.';
  }, 1200);
}
