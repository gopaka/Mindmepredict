/**
 * MindMePredict - StrangleCopilot Frontend Controller
 * Canvas Payoff Visualizer, Real-Time Market & News Sync,
 * AI Decision Copilot, and Statistical Range Generator
 */

// Application State
const STATE = {
  spot: 23070.05,
  vix: 15.28,
  usVix: 16.5,
  pcr: 1.04,
  maxPain: 23100,
  putStrike: 21000,
  callStrike: 24300,
  dte: 24,
  putPrem: 45.0,
  callPrem: 40.0,
  lots: 2,
  lotSize: 25,
  payoffData: [],
  selectedBroker: "zerodha",
  marketSynced: false
};

// DOM Elements
const elements = {
  // Tickers
  tickerNiftySpot: document.getElementById("ticker-nifty-spot"),
  tickerNiftyChange: document.getElementById("ticker-nifty-change"),
  tickerVixVal: document.getElementById("ticker-vix-val"),
  tickerVixChange: document.getElementById("ticker-vix-change"),
  tickerPcrVal: document.getElementById("ticker-pcr-val"),
  tickerPcrTag: document.getElementById("ticker-pcr-tag"),
  tickerMaxPain: document.getElementById("ticker-max-pain"),
  tickerCrudeVal: document.getElementById("ticker-crude-val"),
  marketStatusLabel: document.getElementById("market-status-label"),

  // Copilot Hero Card
  verdictHeadline: document.getElementById("verdict-headline"),
  verdictBadge: document.getElementById("verdict-badge"),
  verdictConfidence: document.getElementById("verdict-confidence"),
  verdictSummary: document.getElementById("verdict-summary"),
  decisionFactorsGrid: document.getElementById("decision-factors-grid"),
  playbookList: document.getElementById("playbook-list"),

  // Position KPI Strip
  dispPutK: document.getElementById("disp-put-k"),
  dispPutCushion: document.getElementById("disp-put-cushion"),
  dispSpotK: document.getElementById("disp-spot-k"),
  dispSpotChange: document.getElementById("disp-spot-change"),
  dispCallK: document.getElementById("disp-call-k"),
  dispCallCushion: document.getElementById("disp-call-cushion"),
  dispPopVal: document.getElementById("disp-pop-val"),
  dispMaxProfit: document.getElementById("disp-max-profit"),
  dispTotalCredit: document.getElementById("disp-total-credit"),
  dispUnrealizedPnl: document.getElementById("disp-unrealized-pnl"),
  dispThetaHarvested: document.getElementById("disp-theta-harvested"),

  // Breakeven Bar
  dispLowerBe: document.getElementById("disp-lower-be"),
  dispUpperBe: document.getElementById("disp-upper-be"),
  spotMarkerPin: document.getElementById("spot-marker-pin"),

  // Canvas
  payoffCanvas: document.getElementById("payoffCanvas"),
  canvasTooltip: document.getElementById("canvas-tooltip"),

  // Range Predictor
  rangeDteInput: document.getElementById("range-dte-input"),
  btnDteMinus: document.getElementById("btn-dte-minus"),
  btnDtePlus: document.getElementById("btn-dte-plus"),
  btnCalcRanges: document.getElementById("btn-calc-ranges"),
  expMovePts: document.getElementById("exp-move-pts"),
  expVixVal: document.getElementById("exp-vix-val"),
  strategyCardsGrid: document.getElementById("strategy-cards-grid"),

  // Parameter Form
  paramsForm: document.getElementById("strangle-params-form"),
  paramSpot: document.getElementById("param-spot"),
  paramDte: document.getElementById("param-dte"),
  paramPutK: document.getElementById("param-put-k"),
  paramCallK: document.getElementById("param-call-k"),
  paramPutPrem: document.getElementById("param-put-prem"),
  paramCallPrem: document.getElementById("param-call-prem"),
  paramLots: document.getElementById("param-lots"),
  paramVix: document.getElementById("param-vix"),
  btnResetParams: document.getElementById("btn-reset-params"),

  // Greeks & Fear Radar
  gaugeNeedle: document.getElementById("gauge-needle"),
  gaugeVixNum: document.getElementById("gauge-vix-num"),
  gaugeVixLabel: document.getElementById("gauge-vix-label"),
  gaugeCommentary: document.getElementById("gauge-commentary"),
  greekThetaVal: document.getElementById("greek-theta-val"),
  greekThetaPts: document.getElementById("greek-theta-pts"),
  greekDeltaVal: document.getElementById("greek-delta-val"),
  greekDeltaBadge: document.getElementById("greek-delta-badge"),
  greekGammaScore: document.getElementById("greek-gamma-score"),
  greekGammaBadge: document.getElementById("greek-gamma-badge"),
  greekVrpVal: document.getElementById("greek-vrp-val"),

  // News Scanner
  threatScorePill: document.getElementById("threat-score-pill"),
  threatScoreNum: document.getElementById("threat-score-num"),
  threatStatusBar: document.getElementById("threat-status-bar"),
  threatMsg: document.getElementById("threat-msg"),
  macroBrent: document.getElementById("macro-brent"),
  macro10y: document.getElementById("macro-10y"),
  macroDxy: document.getElementById("macro-dxy"),
  newsFeedList: document.getElementById("news-feed-list"),

  // Broker Modal
  brokerModal: document.getElementById("broker-modal"),
  btnOpenBroker: document.getElementById("btn-open-broker"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  btnCancelModal: document.getElementById("btn-cancel-modal"),
  brokerTabs: document.querySelectorAll(".broker-tabs .tab-btn"),
  brokerForm: document.getElementById("broker-config-form"),
  brokerStatusMsg: document.getElementById("broker-status-msg"),
  brokerPip: document.getElementById("broker-pip"),
  brokerBtnLabel: document.getElementById("broker-btn-label"),

  // Global Actions
  btnRefreshAll: document.getElementById("btn-refresh-all")
};

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  refreshAllData();

  // Set initial canvas dimension & resize listener
  handleCanvasResize();
  window.addEventListener("resize", () => {
    handleCanvasResize();
    renderPayoffChart();
  });
});

function initEventListeners() {
  // Refresh button
  elements.btnRefreshAll.addEventListener("click", () => {
    refreshAllData();
  });

  // Params Form Submit
  elements.paramsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    readFormInputs();
    runStrangleAnalysis();
  });

  // Reset Params
  elements.btnResetParams.addEventListener("click", () => {
    elements.paramPutK.value = "21000";
    elements.paramCallK.value = "24300";
    elements.paramDte.value = "24";
    elements.paramPutPrem.value = "45.0";
    elements.paramCallPrem.value = "40.0";
    elements.paramLots.value = "2";
    readFormInputs();
    runStrangleAnalysis();
  });

  // DTE Stepper for Range Predictor
  elements.btnDteMinus.addEventListener("click", () => {
    let val = parseInt(elements.rangeDteInput.value) || 24;
    if (val > 1) {
      elements.rangeDteInput.value = val - 1;
      fetchRangePredictions();
    }
  });

  elements.btnDtePlus.addEventListener("click", () => {
    let val = parseInt(elements.rangeDteInput.value) || 24;
    elements.rangeDteInput.value = val + 1;
    fetchRangePredictions();
  });

  elements.btnCalcRanges.addEventListener("click", () => {
    fetchRangePredictions();
  });

  // Stress Test Scenarios
  document.querySelectorAll(".btn-scenario").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      applyScenario(action);
    });
  });

  // Canvas Mouse Move Crosshair
  elements.payoffCanvas.addEventListener("mousemove", handleCanvasMouseMove);
  elements.payoffCanvas.addEventListener("mouseleave", () => {
    elements.canvasTooltip.style.display = "none";
    renderPayoffChart();
  });

  // Broker Modal Handlers
  elements.btnOpenBroker.addEventListener("click", () => {
    elements.brokerModal.classList.add("open");
  });
  elements.btnCloseModal.addEventListener("click", () => {
    elements.brokerModal.classList.remove("open");
  });
  elements.btnCancelModal.addEventListener("click", () => {
    elements.brokerModal.classList.remove("open");
  });

  // Broker Tabs
  elements.brokerTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      elements.brokerTabs.forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      const broker = e.target.dataset.broker;
      STATE.selectedBroker = broker;

      document.querySelectorAll(".broker-fields-group").forEach(group => {
        group.classList.add("hidden");
      });
      const activeGroup = document.getElementById(`fields-${broker}`);
      if (activeGroup) activeGroup.classList.remove("hidden");
    });
  });

  // Broker Form Submit
  elements.brokerForm.addEventListener("submit", handleBrokerSubmit);
}

function readFormInputs() {
  STATE.spot = parseFloat(elements.paramSpot.value) || STATE.spot;
  STATE.dte = parseFloat(elements.paramDte.value) || 24;
  STATE.putStrike = parseFloat(elements.paramPutK.value) || 21000;
  STATE.callStrike = parseFloat(elements.paramCallK.value) || 24300;
  STATE.putPrem = parseFloat(elements.paramPutPrem.value) || 45.0;
  STATE.callPrem = parseFloat(elements.paramCallPrem.value) || 40.0;
  STATE.lots = parseInt(elements.paramLots.value) || 2;
  STATE.vix = parseFloat(elements.paramVix.value) || STATE.vix;
}

// -------------------------------------------------------------
// REFRESH & DATA SYNC
// -------------------------------------------------------------
async function refreshAllData() {
  elements.marketStatusLabel.textContent = "SYNCING MARKET DATA...";
  try {
    await Promise.all([
      fetchMarketData(),
      fetchNewsData()
    ]);
    await runStrangleAnalysis();
    await fetchRangePredictions();
    elements.marketStatusLabel.textContent = "LIVE MARKET FEED";
  } catch (err) {
    console.error("Error syncing data:", err);
    elements.marketStatusLabel.textContent = "SIMULATED MARKET";
  }
}

async function fetchMarketData() {
  const resp = await fetch("/api/market");
  if (!resp.ok) throw new Error("Failed to fetch market data");
  const data = await resp.json();

  STATE.spot = data.spot;
  STATE.vix = data.vix;
  STATE.usVix = data.us_vix;
  STATE.pcr = data.pcr;
  STATE.maxPain = data.max_pain_strike;

  // Update Ticker Ribbon
  elements.tickerNiftySpot.textContent = formatNumber(data.spot, 2);
  const changePrefix = data.spot_change >= 0 ? "+" : "";
  elements.tickerNiftyChange.textContent = `${changePrefix}${data.spot_change} (${changePrefix}${data.spot_change_pct}%)`;
  elements.tickerNiftyChange.className = `ticker-change ${data.spot_change >= 0 ? "up" : "down"}`;

  elements.tickerVixVal.textContent = formatNumber(data.vix, 2);
  const vixPrefix = data.vix_change >= 0 ? "+" : "";
  elements.tickerVixChange.textContent = `${vixPrefix}${data.vix_change}`;
  elements.tickerVixChange.className = `ticker-change ${data.vix_change <= 0 ? "down" : "up"}`;

  elements.tickerPcrVal.textContent = formatNumber(data.pcr, 2);
  elements.tickerPcrTag.textContent = data.pcr_sentiment.split(" ")[0];
  elements.tickerMaxPain.textContent = formatNumber(data.max_pain_strike, 0);

  // Sync Input fields on first load
  if (!STATE.marketSynced) {
    elements.paramSpot.value = data.spot;
    elements.paramVix.value = data.vix;
    STATE.marketSynced = true;
  }
}

async function fetchNewsData() {
  const resp = await fetch("/api/news");
  if (!resp.ok) return;
  const data = await resp.json();

  // Update Threat Score
  elements.threatScoreNum.textContent = `${data.threat_score}/100`;
  elements.threatMsg.textContent = `${data.threat_level} THREAT: ${data.threat_desc}`;
  elements.threatStatusBar.style.borderColor = data.threat_color;
  elements.threatStatusBar.style.background = `${data.threat_color}18`;

  // Update Macro strip
  if (data.macro_cues && data.macro_cues.brent_crude) {
    const brent = data.macro_cues.brent_crude;
    elements.tickerCrudeVal.textContent = `$${brent.price.toFixed(2)}`;
    elements.macroBrent.textContent = `$${brent.price.toFixed(2)}`;
  }
  if (data.macro_cues && data.macro_cues.us_10y_yield) {
    elements.macro10y.textContent = `${data.macro_cues.us_10y_yield.yield}%`;
  }
  if (data.macro_cues && data.macro_cues.dollar_index) {
    elements.macroDxy.textContent = `${data.macro_cues.dollar_index.price}`;
  }

  // Populate News List
  renderNewsList(data.news_items || []);
}

function renderNewsList(items) {
  elements.newsFeedList.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "news-item-card";
    card.innerHTML = `
      <div class="news-top">
        <span class="news-source">${item.source} • ${item.time}</span>
        <span class="news-badge" style="background:${item.badge_color}25; color:${item.badge_color}">${item.impact_badge}</span>
      </div>
      <div class="news-title">${item.title}</div>
    `;
    elements.newsFeedList.appendChild(card);
  });
}

// -------------------------------------------------------------
// STRANGLE ANALYSIS & COPILOT DECISION
// -------------------------------------------------------------
async function runStrangleAnalysis() {
  const payload = {
    spot: STATE.spot,
    put_strike: STATE.putStrike,
    call_strike: STATE.callStrike,
    dte_days: STATE.dte,
    vix: STATE.vix,
    put_entry_premium: STATE.putPrem,
    call_entry_premium: STATE.callPrem,
    lots: STATE.lots,
    lot_size: STATE.lotSize
  };

  const [analyzeResp, payoffResp] = await Promise.all([
    fetch("/api/analyze-strangle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    fetch("/api/payoff-curve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  ]);

  if (!analyzeResp.ok) throw new Error("Analysis failed");
  const result = await analyzeResp.json();
  const payoffResult = await payoffResp.json();

  STATE.payoffData = payoffResult.curve || [];
  renderCopilotVerdict(result.copilot_decision);
  renderPositionKPIs(result.position);
  renderGreeksAndFear(result.position, result.market);
  renderPayoffChart();
}

function renderCopilotVerdict(decision) {
  elements.verdictHeadline.textContent = decision.headline;
  elements.verdictBadge.textContent = decision.verdict;
  elements.verdictBadge.className = `verdict-badge ${decision.badge_style}`;
  elements.verdictConfidence.textContent = `Confidence: ${decision.confidence}%`;
  elements.verdictSummary.textContent = decision.summary;

  // Render Decision Factors Grid
  elements.decisionFactorsGrid.innerHTML = "";
  (decision.factors || []).forEach(f => {
    const card = document.createElement("div");
    card.className = "factor-card";
    const statusColor = f.impact === "Positive" ? "var(--accent-green)" : (f.impact === "Caution" ? "var(--accent-amber)" : "var(--accent-red)");
    card.innerHTML = `
      <span class="factor-name">${f.name}</span>
      <span class="factor-val">${f.value}</span>
      <span class="factor-status" style="color: ${statusColor}">${f.status}</span>
    `;
    elements.decisionFactorsGrid.appendChild(card);
  });

  // Render Playbook list
  elements.playbookList.innerHTML = "";
  (decision.actions || []).forEach(actionText => {
    const li = document.createElement("li");
    li.textContent = actionText;
    elements.playbookList.appendChild(li);
  });
}

function renderPositionKPIs(pos) {
  elements.dispPutK.textContent = `${formatNumber(pos.put_strike, 0)} PE`;
  elements.dispPutCushion.textContent = `-${pos.dist_to_put_pct}% Cushion`;

  elements.dispSpotK.textContent = formatNumber(pos.spot, 2);
  const changePrefix = (pos.spot - 23024) >= 0 ? "+" : "";
  elements.dispSpotChange.textContent = `${changePrefix}${formatNumber(pos.dist_to_call_pts, 0)} to CE`;

  elements.dispCallK.textContent = `${formatNumber(pos.call_strike, 0)} CE`;
  elements.dispCallCushion.textContent = `+${pos.dist_to_call_pct}% Cushion`;

  elements.dispPopVal.textContent = `${pos.pop_pct}%`;
  elements.dispMaxProfit.textContent = `₹${formatNumber(pos.max_profit_inr, 0)}`;
  elements.dispTotalCredit.textContent = `${pos.total_initial_credit_pts} pts (${pos.lots} Lots)`;

  const pnlSign = pos.unrealized_pnl_inr >= 0 ? "+" : "";
  elements.dispUnrealizedPnl.textContent = `${pnlSign}₹${formatNumber(pos.unrealized_pnl_inr, 0)}`;
  elements.dispUnrealizedPnl.className = `stat-num ${pos.unrealized_pnl_inr >= 0 ? "color-green" : "color-red"}`;
  elements.dispThetaHarvested.textContent = `${pos.theta_harvested_pct}% Harvested`;

  // Breakevens
  elements.dispLowerBe.textContent = formatNumber(pos.lower_breakeven, 0);
  elements.dispUpperBe.textContent = formatNumber(pos.upper_breakeven, 0);

  // Spot pin position on bar
  const totalWidth = pos.upper_breakeven - pos.lower_breakeven;
  let spotRel = (pos.spot - pos.lower_breakeven) / totalWidth;
  spotRel = Math.max(0.05, Math.min(0.95, spotRel));
  elements.spotMarkerPin.style.left = `${(spotRel * 100).toFixed(1)}%`;
}

function renderGreeksAndFear(pos, market) {
  // Update Fear Speedometer Needle
  const vix = market.vix;
  elements.gaugeVixNum.textContent = vix.toFixed(2);
  elements.gaugeVixLabel.textContent = market.fear_gauge.label;
  elements.gaugeCommentary.textContent = market.fear_gauge.seller_edge;

  // Map VIX (8 to 32) to needle angle (-160 to 0 degrees approx)
  // Arc center: (100, 100), radius ~ 65
  const minVix = 8.0, maxVix = 30.0;
  const clampedVix = Math.max(minVix, Math.min(maxVix, vix));
  const fraction = (clampedVix - minVix) / (maxVix - minVix);
  const angleRad = Math.PI - (fraction * Math.PI); // PI (left) to 0 (right)

  const needleLen = 55;
  const targetX = 100 - needleLen * Math.cos(angleRad);
  const targetY = 100 - needleLen * Math.sin(angleRad);

  elements.gaugeNeedle.setAttribute("x2", targetX.toFixed(1));
  elements.gaugeNeedle.setAttribute("y2", targetY.toFixed(1));

  // Greeks
  elements.greekThetaVal.textContent = `+₹${formatNumber(pos.net_daily_theta_inr, 0)}/day`;
  elements.greekThetaPts.textContent = `+${pos.net_daily_theta_pts} pts/day`;

  elements.greekDeltaVal.textContent = pos.net_delta.toFixed(3);
  const deltaAbs = Math.abs(pos.net_delta);
  if (deltaAbs < 0.10) {
    elements.greekDeltaBadge.textContent = "Neutral";
    elements.greekDeltaBadge.className = "badge-mini neutral";
  } else if (deltaAbs < 0.20) {
    elements.greekDeltaBadge.textContent = "Mild Tilt";
    elements.greekDeltaBadge.className = "badge-mini pos";
  } else {
    elements.greekDeltaBadge.textContent = "Skew Alert";
    elements.greekDeltaBadge.className = "badge-mini safe";
  }

  elements.greekGammaScore.textContent = `${pos.gamma_risk_score} / 100`;
  elements.greekGammaBadge.textContent = pos.gamma_risk_score < 30 ? "Safe" : (pos.gamma_risk_score < 60 ? "Moderate" : "Danger");
  elements.greekGammaBadge.className = `badge-mini ${pos.gamma_risk_score < 30 ? "pos" : (pos.gamma_risk_score < 60 ? "safe" : "neutral")}`;

  const vrpPrefix = market.vrp_spread >= 0 ? "+" : "";
  elements.greekVrpVal.textContent = `${vrpPrefix}${market.vrp_spread.toFixed(2)}%`;
}

// -------------------------------------------------------------
// RANGE PREDICTOR & STRATEGY GENERATOR
// -------------------------------------------------------------
async function fetchRangePredictions() {
  const dte = parseFloat(elements.rangeDteInput.value) || 24;
  const resp = await fetch("/api/range-predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spot: STATE.spot,
      dte_days: dte,
      vix: STATE.vix,
      lots: STATE.lots
    })
  });

  if (!resp.ok) return;
  const data = await resp.json();

  elements.expMovePts.textContent = `±${data.expected_move_1sd_pts} pts (±${data.expected_move_1sd_pct}%)`;
  elements.expVixVal.textContent = `${data.vix}%`;

  renderStrategyCards(data.strategies || []);
}

function renderStrategyCards(strategies) {
  elements.strategyCardsGrid.innerHTML = "";

  strategies.forEach((strat, idx) => {
    const card = document.createElement("div");
    card.className = `strat-card ${idx === 0 ? "recommended" : ""}`;

    card.innerHTML = `
      ${idx === 0 ? '<span class="strat-tag-banner">HIGH CONFIDENCE</span>' : ''}
      <h4 class="strat-tier-name">${strat.tier_name}</h4>
      <span class="strat-pop-badge">${strat.win_probability}</span>

      <div class="strat-strikes-box">
        <div class="strike-row">
          <span class="leg-type pe">PUT STRIKE</span>
          <span class="leg-val">${formatNumber(strat.put_strike, 0)} PE</span>
          <span class="leg-prem">~₹${strat.put_premium}</span>
        </div>
        <div class="strike-row">
          <span class="leg-type ce">CALL STRIKE</span>
          <span class="leg-val">${formatNumber(strat.call_strike, 0)} CE</span>
          <span class="leg-prem">~₹${strat.call_premium}</span>
        </div>
      </div>

      <div class="strat-metrics-list">
        <div class="strat-metric-row">
          <span>Total Credit:</span>
          <strong>₹${formatNumber(strat.total_credit_inr, 0)} (${strat.total_credit_pts} pts)</strong>
        </div>
        <div class="strat-metric-row">
          <span>Safe Breakeven Band:</span>
          <strong>${formatNumber(strat.lower_breakeven, 0)} - ${formatNumber(strat.upper_breakeven, 0)}</strong>
        </div>
        <div class="strat-metric-row">
          <span>Expected ROC:</span>
          <strong class="color-green">${strat.roc_pct}% (${strat.annualized_roc_pct}% Ann.)</strong>
        </div>
      </div>

      <p class="strat-desc">${strat.desc}</p>

      <button class="btn-apply-strat" data-put="${strat.put_strike}" data-call="${strat.call_strike}" data-putprem="${strat.put_premium}" data-callprem="${strat.call_premium}">
        Apply to Simulator ⚡
      </button>
    `;

    // Apply button event
    card.querySelector(".btn-apply-strat").addEventListener("click", () => {
      elements.paramPutK.value = strat.put_strike;
      elements.paramCallK.value = strat.call_strike;
      elements.paramPutPrem.value = strat.put_premium;
      elements.paramCallPrem.value = strat.call_premium;
      elements.paramDte.value = elements.rangeDteInput.value;
      readFormInputs();
      runStrangleAnalysis();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    elements.strategyCardsGrid.appendChild(card);
  });
}

// -------------------------------------------------------------
// INTERACTIVE CANVAS PAYOFF CHART
// -------------------------------------------------------------
function handleCanvasResize() {
  const rect = elements.payoffCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  elements.payoffCanvas.width = rect.width * dpr;
  elements.payoffCanvas.height = rect.height * dpr;
}

function renderPayoffChart(crosshairSpot = null) {
  const canvas = elements.payoffCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!STATE.payoffData || STATE.payoffData.length === 0) {
    ctx.restore();
    return;
  }

  const padding = { top: 30, right: 40, bottom: 45, left: 65 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  // Find min/max values
  const spots = STATE.payoffData.map(d => d.spot);
  const minSpot = Math.min(...spots);
  const maxSpot = Math.max(...spots);

  // Y-axis range: symmetric around zero or capturing max profit and loss
  const expiryPnls = STATE.payoffData.map(d => d.expiry_pnl_inr);
  const maxPnl = Math.max(...expiryPnls) * 1.35;
  const minPnl = -maxPnl * 1.8; // Give space for downside

  const getX = (spot) => padding.left + ((spot - minSpot) / (maxSpot - minSpot)) * plotW;
  const getY = (pnl) => padding.top + ((maxPnl - pnl) / (maxPnl - minPnl)) * plotH;

  const yZero = getY(0);

  // 1. Draw Grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const yVal = minPnl + (i / 5) * (maxPnl - minPnl);
    const yPx = getY(yVal);
    ctx.beginPath();
    ctx.moveTo(padding.left, yPx);
    ctx.lineTo(w - padding.right, yPx);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "right";
    ctx.fillText(`₹${(yVal / 1000).toFixed(1)}k`, padding.left - 8, yPx + 3);
  }

  // 2. Draw Zero P&L Axis
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, yZero);
  ctx.lineTo(w - padding.right, yZero);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. Profit Region Fill (Green Glow)
  ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
  ctx.beginPath();
  let firstProfit = true;
  for (let i = 0; i < STATE.payoffData.length; i++) {
    const d = STATE.payoffData[i];
    const x = getX(d.spot);
    const y = getY(d.expiry_pnl_inr);

    if (d.expiry_pnl_inr >= 0) {
      if (firstProfit) {
        ctx.moveTo(x, yZero);
        firstProfit = false;
      }
      ctx.lineTo(x, y);
    } else if (!firstProfit) {
      ctx.lineTo(x, yZero);
      break;
    }
  }
  ctx.closePath();
  ctx.fill();

  // 4. Draw Expiry Payoff Line (Solid Emerald)
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  STATE.payoffData.forEach((d, i) => {
    const x = getX(d.spot);
    const y = getY(d.expiry_pnl_inr);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 5. Draw Today (T+0) Curve (Cyan Glowing)
  ctx.strokeStyle = "#00f2fe";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(0, 242, 254, 0.5)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  STATE.payoffData.forEach((d, i) => {
    const x = getX(d.spot);
    const y = getY(d.t0_pnl_inr);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // 6. Draw Strikes & Breakevens Vertical Lines
  drawVerticalMarker(ctx, getX(STATE.putStrike), h, "#00f2fe", `PE ${STATE.putStrike}`);
  drawVerticalMarker(ctx, getX(STATE.callStrike), h, "#a855f7", `CE ${STATE.callStrike}`);

  const totalPremPts = STATE.putPrem + STATE.callPrem;
  const lowerBe = STATE.putStrike - totalPremPts;
  const upperBe = STATE.callStrike + totalPremPts;
  drawVerticalMarker(ctx, getX(lowerBe), h, "#f59e0b", `BE ${lowerBe.toFixed(0)}`, true);
  drawVerticalMarker(ctx, getX(upperBe), h, "#f59e0b", `BE ${upperBe.toFixed(0)}`, true);

  // 7. Draw Current Spot Line & Glow Dot
  const spotX = getX(STATE.spot);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(spotX, padding.top);
  ctx.lineTo(spotX, h - padding.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Spot point on T0 curve
  const currentT0Pnl = calculateT0PnlAtSpot(STATE.spot);
  const spotY = getY(currentT0Pnl);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#00f2fe";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(spotX, spotY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Spot Label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px JetBrains Mono";
  ctx.textAlign = "center";
  ctx.fillText(`Spot: ${STATE.spot.toFixed(0)}`, spotX, padding.top - 10);

  // 8. Crosshair if hovered
  if (crosshairSpot !== null) {
    const chX = getX(crosshairSpot);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(chX, padding.top);
    ctx.lineTo(chX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawVerticalMarker(ctx, x, h, color, text, isDashed = false) {
  if (x < 65 || x > ctx.canvas.width - 40) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  if (isDashed) ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 30);
  ctx.lineTo(x, h - 45);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "10px JetBrains Mono";
  ctx.textAlign = "center";
  ctx.fillText(text, x, h - 30);
  ctx.restore();
}

function calculateT0PnlAtSpot(targetSpot) {
  if (!STATE.payoffData || STATE.payoffData.length === 0) return 0;
  // Linear interpolation
  for (let i = 0; i < STATE.payoffData.length - 1; i++) {
    const p1 = STATE.payoffData[i];
    const p2 = STATE.payoffData[i + 1];
    if (targetSpot >= p1.spot && targetSpot <= p2.spot) {
      const frac = (targetSpot - p1.spot) / (p2.spot - p1.spot);
      return p1.t0_pnl_inr + frac * (p2.t0_pnl_inr - p1.t0_pnl_inr);
    }
  }
  return STATE.payoffData[0].t0_pnl_inr;
}

function handleCanvasMouseMove(e) {
  if (!STATE.payoffData || STATE.payoffData.length === 0) return;
  const rect = elements.payoffCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;

  const paddingLeft = 65;
  const plotW = rect.width - paddingLeft - 40;
  if (mouseX < paddingLeft || mouseX > paddingLeft + plotW) {
    elements.canvasTooltip.style.display = "none";
    return;
  }

  const spots = STATE.payoffData.map(d => d.spot);
  const minSpot = Math.min(...spots);
  const maxSpot = Math.max(...spots);

  const hoveredSpot = minSpot + ((mouseX - paddingLeft) / plotW) * (maxSpot - minSpot);

  // Find nearest data point
  let nearest = STATE.payoffData[0];
  let minDiff = Infinity;
  for (const d of STATE.payoffData) {
    const diff = Math.abs(d.spot - hoveredSpot);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = d;
    }
  }

  // Update tooltip
  const tooltip = elements.canvasTooltip;
  tooltip.style.display = "block";
  tooltip.style.left = `${mouseX + 12}px`;
  tooltip.style.top = `60px`;

  const t0Sign = nearest.t0_pnl_inr >= 0 ? "+" : "";
  const expSign = nearest.expiry_pnl_inr >= 0 ? "+" : "";
  tooltip.innerHTML = `
    <div><strong>Nifty: ${nearest.spot.toFixed(0)}</strong></div>
    <div style="color: #00f2fe">P&L Today: ${t0Sign}₹${formatNumber(nearest.t0_pnl_inr, 0)}</div>
    <div style="color: #10b981">P&L Expiry: ${expSign}₹${formatNumber(nearest.expiry_pnl_inr, 0)}</div>
  `;

  renderPayoffChart(hoveredSpot);
}

// -------------------------------------------------------------
// STRESS TESTING SCENARIOS
// -------------------------------------------------------------
function applyScenario(action) {
  readFormInputs();
  switch (action) {
    case "crash":
      STATE.spot = Math.round(STATE.spot * 0.98);
      elements.paramSpot.value = STATE.spot;
      break;
    case "rally":
      STATE.spot = Math.round(STATE.spot * 1.02);
      elements.paramSpot.value = STATE.spot;
      break;
    case "vix-spike":
      STATE.vix = parseFloat((STATE.vix * 1.25).toFixed(2));
      elements.paramVix.value = STATE.vix;
      break;
    case "decay-7d":
      STATE.dte = Math.max(1, STATE.dte - 7);
      elements.paramDte.value = STATE.dte;
      break;
  }
  runStrangleAnalysis();
}

// -------------------------------------------------------------
// BROKER INTEGRATION HANDLER
// -------------------------------------------------------------
async function handleBrokerSubmit(e) {
  e.preventDefault();
  const broker = STATE.selectedBroker;
  const msgEl = elements.brokerStatusMsg;
  msgEl.className = "broker-status-msg";
  msgEl.classList.remove("hidden");
  msgEl.textContent = "Connecting to broker API...";

  let payload = { broker_type: broker };
  if (broker === "zerodha") {
    payload.api_key = document.getElementById("kite-api-key").value;
    payload.api_secret = document.getElementById("kite-api-secret").value;
    payload.access_token = document.getElementById("kite-access-token").value;
  } else if (broker === "upstox") {
    payload.api_key = document.getElementById("upstox-api-key").value;
    payload.access_token = document.getElementById("upstox-access-token").value;
  } else if (broker === "angelone") {
    payload.client_code = document.getElementById("angel-client-code").value;
    payload.api_key = document.getElementById("angel-api-key").value;
    payload.pin = document.getElementById("angel-pin").value;
  }

  try {
    const resp = await fetch("/api/broker/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const res = await resp.json();

    if (res.status === "success") {
      msgEl.classList.add("success");
      msgEl.textContent = res.message;
      elements.brokerPip.className = "broker-status-pip connected";
      elements.brokerBtnLabel.textContent = `${broker.toUpperCase()} Live`;
      setTimeout(() => elements.brokerModal.classList.remove("open"), 1500);
    } else if (res.status === "warning") {
      msgEl.classList.add("warning");
      msgEl.textContent = res.message;
      elements.brokerPip.className = "broker-status-pip connected";
      elements.brokerBtnLabel.textContent = `${broker.toUpperCase()} Active`;
    } else {
      msgEl.classList.add("error");
      msgEl.textContent = res.message || "Failed to configure broker credentials.";
    }
  } catch (err) {
    msgEl.classList.add("error");
    msgEl.textContent = "Connection error. Please check server status.";
  }
}

// Utility formatting
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
