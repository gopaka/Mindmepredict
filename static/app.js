/**
 * MindMePredict - StrangleCopilot Frontend Controller
 * Canvas Payoff Visualizer, Real-Time Market & News Sync,
 * AI Decision Copilot, and Statistical Range Generator
 */

// Auth & Session State
let authToken = localStorage.getItem("mmp_auth_token") || sessionStorage.getItem("mmp_auth_token") || null;
let currentUser = null;
let activeSSE = null;

/**
 * Centralized API Fetcher with automatic Bearer Token injection & 401 interceptor.
 */
async function apiFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const mergedOptions = { ...options, headers };
  const resp = await fetch(url, mergedOptions);

  if (resp.status === 401) {
    console.warn("[AUTH] 401 Unauthorized encountered from:", url);
    clearAuthSession("Your desk session has expired or is unauthorized. Please re-authenticate.");
    throw new Error("401 Unauthorized");
  }
  return resp;
}

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
  marketSynced: false,
  // Dynamic 1-Minute Live Auto-Sync State
  autoSyncActive: true,
  syncSecondsLeft: 60,
  syncTimer: null,
  isSyncing: false,
  lastUpdatedTimestamp: null
};

// DOM Elements
const elements = {
  // Auth Gateway & Operator Profile
  authOverlay: document.getElementById("auth-overlay"),
  authForm: document.getElementById("auth-login-form"),
  authUsername: document.getElementById("auth-username"),
  authPassword: document.getElementById("auth-password"),
  authRemember: document.getElementById("auth-remember"),
  btnAuthSubmit: document.getElementById("btn-auth-submit"),
  authBtnLabel: document.getElementById("auth-btn-label"),
  authBtnIcon: document.getElementById("auth-btn-icon"),
  authSpinner: document.getElementById("auth-spinner"),
  authAlert: document.getElementById("auth-alert"),
  authAlertText: document.getElementById("auth-alert-text"),
  authPwdToggle: document.getElementById("auth-pwd-toggle"),
  eyeIconShow: document.getElementById("eye-icon-show"),
  eyeIconHide: document.getElementById("eye-icon-hide"),
  authQuickFill: document.getElementById("auth-quick-fill"),
  userProfilePill: document.getElementById("user-profile-pill"),
  userAvatarBadge: document.getElementById("user-avatar-badge"),
  userDisplayName: document.getElementById("user-display-name"),
  userDisplayRole: document.getElementById("user-display-role"),
  btnLogout: document.getElementById("btn-logout"),

  // Dynamic Auto-Sync Controls
  dynamicSyncPill: document.getElementById("dynamic-sync-pill"),
  syncDot: document.getElementById("sync-dot"),
  syncCountdown: document.getElementById("sync-countdown"),
  btnQuickSync: document.getElementById("btn-quick-sync"),
  toggleAutoSync: document.getElementById("toggle-auto-sync"),

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

  // News Scanner & Predictions
  threatScorePill: document.getElementById("threat-score-pill"),
  threatScoreNum: document.getElementById("threat-score-num"),
  threatStatusBar: document.getElementById("threat-status-bar"),
  threatMsg: document.getElementById("threat-msg"),
  confidencePill: document.getElementById("confidence-pill"),
  confidenceVal: document.getElementById("confidence-val"),
  newsDirBias: document.getElementById("news-dir-bias"),
  newsPutThreat: document.getElementById("news-put-threat"),
  newsCallThreat: document.getElementById("news-call-threat"),
  newsVolForecast: document.getElementById("news-vol-forecast"),
  verifiedSourcesList: document.getElementById("verified-sources-list"),
  newsFreshnessClock: document.getElementById("news-freshness-clock"),
  macroBrent: document.getElementById("macro-brent"),
  macroBrentSub: document.getElementById("macro-brent-sub"),
  macro10y: document.getElementById("macro-10y"),
  macro10ySub: document.getElementById("macro-10y-sub"),
  macroDxy: document.getElementById("macro-dxy"),
  macroDxySub: document.getElementById("macro-dxy-sub"),
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
// INITIALIZATION & AUTH LIFECYCLE
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  initAuth();

  // Set initial canvas dimension & resize listener
  handleCanvasResize();
  window.addEventListener("resize", () => {
    handleCanvasResize();
    renderPayoffChart();
  });
});

function initAuth() {
  if (elements.authForm) {
    elements.authForm.addEventListener("submit", handleLoginSubmit);
  }
  if (elements.authPwdToggle) {
    elements.authPwdToggle.addEventListener("click", togglePasswordVisibility);
  }
  if (elements.authQuickFill) {
    elements.authQuickFill.addEventListener("click", handleQuickFill);
  }
  if (elements.btnLogout) {
    elements.btnLogout.addEventListener("click", handleLogout);
  }

  // Check existing session token
  if (authToken) {
    verifyActiveSession();
  } else {
    showLoginOverlay();
  }
}

async function verifyActiveSession() {
  try {
    const resp = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      currentUser = data.user;
      unlockTerminal(currentUser);
    } else {
      clearAuthSession("Session expired. Please sign in to access terminal.");
    }
  } catch (err) {
    clearAuthSession("Session verification failed. Please authenticate.");
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = elements.authUsername ? elements.authUsername.value.trim() : "";
  const password = elements.authPassword ? elements.authPassword.value.trim() : "";

  if (!username || !password) {
    showAuthAlert("Please provide both desk identifier and access key.");
    return;
  }

  setAuthLoading(true);
  hideAuthAlert();

  try {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();

    if (resp.ok && data.status === "authenticated") {
      authToken = data.token;
      currentUser = data.user;

      const remember = elements.authRemember && elements.authRemember.checked;
      if (remember) {
        localStorage.setItem("mmp_auth_token", authToken);
        sessionStorage.removeItem("mmp_auth_token");
      } else {
        sessionStorage.setItem("mmp_auth_token", authToken);
        localStorage.removeItem("mmp_auth_token");
      }

      unlockTerminal(currentUser);
    } else {
      showAuthAlert(data.detail || "Invalid desk credentials. Access denied.");
    }
  } catch (err) {
    showAuthAlert("Connection error during authentication. Check terminal server.");
  } finally {
    setAuthLoading(false);
  }
}

function unlockTerminal(user) {
  document.body.classList.remove("terminal-locked");
  if (elements.authOverlay) {
    elements.authOverlay.classList.add("hidden");
  }

  // Update header user badge
  if (user) {
    if (elements.userDisplayName) {
      elements.userDisplayName.textContent = user.name || user.username || "Quant Lead";
    }
    if (elements.userDisplayRole) {
      elements.userDisplayRole.textContent = user.desk || user.role || "Strangle Desk";
    }
    if (elements.userAvatarBadge) {
      const initials = (user.name || user.username || "QR")
        .split(" ")
        .map(w => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      elements.userAvatarBadge.textContent = initials || "QR";
    }
  }

  // Initialize live background worker & SSE, then fetch initial market data
  initDynamicSync();
  refreshAllData({ isBackground: false });
}

function showLoginOverlay(alertMsg = null) {
  document.body.classList.add("terminal-locked");
  if (elements.authOverlay) {
    elements.authOverlay.classList.remove("hidden");
  }
  if (alertMsg) {
    showAuthAlert(alertMsg);
  } else {
    hideAuthAlert();
  }
  if (elements.authPassword) {
    elements.authPassword.focus();
  }
}

function clearAuthSession(reason = null) {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("mmp_auth_token");
  sessionStorage.removeItem("mmp_auth_token");
  disconnectSSE();
  showLoginOverlay(reason);
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: authToken ? { "Authorization": `Bearer ${authToken}` } : {}
    });
  } catch (e) {
    // Ignore network error on logout
  }
  clearAuthSession("Quant Desk terminal locked. Session ended.");
}

function togglePasswordVisibility() {
  if (!elements.authPassword) return;
  const isPwd = elements.authPassword.type === "password";
  elements.authPassword.type = isPwd ? "text" : "password";
  if (elements.eyeIconShow) elements.eyeIconShow.classList.toggle("hidden", isPwd);
  if (elements.eyeIconHide) elements.eyeIconHide.classList.toggle("hidden", !isPwd);
}

function handleQuickFill() {
  if (elements.authUsername) elements.authUsername.value = "admin";
  if (elements.authPassword) {
    elements.authPassword.value = "nifty2026";
    elements.authPassword.focus();
  }
  hideAuthAlert();
}

function setAuthLoading(isLoading) {
  if (elements.btnAuthSubmit) elements.btnAuthSubmit.disabled = isLoading;
  if (elements.authBtnLabel) elements.authBtnLabel.textContent = isLoading ? "Verifying Credentials..." : "Unlock Quant Terminal";
  if (elements.authBtnIcon) elements.authBtnIcon.classList.toggle("hidden", isLoading);
  if (elements.authSpinner) elements.authSpinner.classList.toggle("hidden", !isLoading);
}

function showAuthAlert(msg) {
  if (elements.authAlert) elements.authAlert.classList.remove("hidden");
  if (elements.authAlertText) elements.authAlertText.textContent = msg;
}

function hideAuthAlert() {
  if (elements.authAlert) elements.authAlert.classList.add("hidden");
}

function initEventListeners() {
  // Refresh button
  elements.btnRefreshAll.addEventListener("click", () => {
    STATE.syncSecondsLeft = 60;
    refreshAllData({ isBackground: false, forceRefresh: true });
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
// DYNAMIC 1-MINUTE LIVE AUTO-SYNC & SSE ENGINE
// -------------------------------------------------------------
let dynamicSyncListenersInitialized = false;

function initDynamicSync() {
  if (STATE.syncTimer) clearInterval(STATE.syncTimer);
  STATE.syncSecondsLeft = 60;

  STATE.syncTimer = setInterval(() => {
    if (!STATE.autoSyncActive || STATE.isSyncing || !authToken) return;

    STATE.syncSecondsLeft--;
    if (elements.syncCountdown) {
      elements.syncCountdown.textContent = `${STATE.syncSecondsLeft}s`;
    }

    if (STATE.syncSecondsLeft <= 0) {
      STATE.syncSecondsLeft = 60;
      refreshAllData({ isBackground: true });
    }
  }, 1000);

  if (!dynamicSyncListenersInitialized) {
    // Quick Sync button ⚡
    if (elements.btnQuickSync) {
      elements.btnQuickSync.addEventListener("click", () => {
        STATE.syncSecondsLeft = 60;
        refreshAllData({ isBackground: false, forceRefresh: true });
      });
    }

    // Auto-Sync Toggle Switch
    if (elements.toggleAutoSync) {
      elements.toggleAutoSync.addEventListener("change", (e) => {
        STATE.autoSyncActive = e.target.checked;
        if (elements.syncDot) {
          elements.syncDot.className = STATE.autoSyncActive ? "sync-dot live" : "sync-dot paused";
        }
        if (elements.syncCountdown) {
          elements.syncCountdown.textContent = STATE.autoSyncActive ? `${STATE.syncSecondsLeft}s` : "PAUSED";
        }
      });
    }
    dynamicSyncListenersInitialized = true;
  }

  // Connect Server-Sent Events (SSE) with active auth token
  connectSSE();
}

function connectSSE() {
  if (!authToken) return;
  if (activeSSE) {
    activeSSE.close();
    activeSSE = null;
  }

  try {
    const sseUrl = `/api/stream/events?token=${encodeURIComponent(authToken)}`;
    activeSSE = new EventSource(sseUrl);

    activeSSE.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "market_sync" && STATE.autoSyncActive) {
          STATE.syncSecondsLeft = 60;
          refreshAllData({ isBackground: true });
        }
      } catch (err) {
        // keepalive or non-json message
      }
    };

    activeSSE.onerror = () => {
      if (activeSSE) {
        activeSSE.close();
        activeSSE = null;
      }
      // Reconnect after 10s if still authenticated
      if (authToken) {
        setTimeout(connectSSE, 10000);
      }
    };
  } catch (e) {
    console.warn("SSE stream not available, falling back to 60s timer interval:", e);
  }
}

function disconnectSSE() {
  if (activeSSE) {
    activeSSE.close();
    activeSSE = null;
  }
}

// -------------------------------------------------------------
// REFRESH & DATA SYNC
// -------------------------------------------------------------
async function refreshAllData(options = {}) {
  const isBackground = options.isBackground || false;
  const forceRefresh = options.forceRefresh || false;
  if (STATE.isSyncing) return;
  STATE.isSyncing = true;

  if (elements.dynamicSyncPill) elements.dynamicSyncPill.classList.add("syncing");
  if (elements.syncDot) elements.syncDot.className = "sync-dot syncing";
  if (!isBackground) {
    elements.marketStatusLabel.textContent = "SYNCING MARKET DATA...";
  }

  try {
    if (forceRefresh) {
      await apiFetch("/api/sync-now", { method: "POST" });
    }
    await Promise.all([
      fetchMarketData(isBackground),
      fetchNewsData()
    ]);
    await runStrangleAnalysis();
    await fetchRangePredictions();

    elements.marketStatusLabel.textContent = "LIVE MARKET FEED";
    STATE.lastUpdatedTimestamp = new Date().toLocaleTimeString();
    if (elements.newsFreshnessClock) {
      elements.newsFreshnessClock.textContent = `Synced ${STATE.lastUpdatedTimestamp} (1m cycle)`;
    }

    triggerLivePulseEffects();
  } catch (err) {
    console.error("Error syncing data:", err);
    elements.marketStatusLabel.textContent = "SIMULATED MARKET";
  } finally {
    STATE.isSyncing = false;
    STATE.syncSecondsLeft = 60;
    if (elements.dynamicSyncPill) elements.dynamicSyncPill.classList.remove("syncing");
    if (elements.syncDot) {
      elements.syncDot.className = STATE.autoSyncActive ? "sync-dot live" : "sync-dot paused";
    }
    if (elements.syncCountdown) {
      elements.syncCountdown.textContent = STATE.autoSyncActive ? "60s" : "PAUSED";
    }
  }
}

function triggerLivePulseEffects() {
  const targets = [
    elements.tickerNiftySpot,
    elements.tickerVixVal,
    elements.threatScoreNum,
    elements.greekThetaVal,
    elements.dispPopVal,
    elements.dispUnrealizedPnl
  ];
  targets.forEach(el => {
    if (el) {
      el.classList.remove("data-updated-pulse");
      void el.offsetWidth;
      el.classList.add("data-updated-pulse");
      setTimeout(() => el.classList.remove("data-updated-pulse"), 1200);
    }
  });
}

async function fetchMarketData(isBackground = false) {
  const resp = await apiFetch("/api/market");
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

  // Sync Input fields on first load or if background sync is active and user is not actively editing inputs
  if (!STATE.marketSynced) {
    elements.paramSpot.value = data.spot;
    elements.paramVix.value = data.vix;
    STATE.marketSynced = true;
  } else if (isBackground && document.activeElement !== elements.paramSpot && document.activeElement !== elements.paramVix) {
    elements.paramSpot.value = data.spot;
    elements.paramVix.value = data.vix;
  }
}

async function fetchNewsData() {
  const resp = await apiFetch("/api/news");
  if (!resp.ok) return;
  const data = await resp.json();

  // Update Threat Score & Message
  elements.threatScoreNum.textContent = `${data.threat_score}/100`;
  elements.threatMsg.textContent = `${data.threat_level} THREAT: ${data.threat_desc}`;
  elements.threatStatusBar.style.borderColor = data.threat_color;
  elements.threatStatusBar.style.background = `${data.threat_color}18`;

  // Update Prediction Confidence & Accuracy
  if (elements.confidenceVal && data.prediction_confidence) {
    elements.confidenceVal.textContent = data.prediction_confidence;
  }

  // Update Strangle Risk Matrix (Directional bias, Put threat, Call threat, Volatility forecast)
  if (elements.newsDirBias && data.directional_bias) {
    elements.newsDirBias.textContent = data.directional_bias;
    if (data.directional_bias.includes("Bearish")) {
      elements.newsDirBias.className = "risk-val caution";
    } else if (data.directional_bias.includes("Bullish")) {
      elements.newsDirBias.className = "risk-val neutral";
    } else {
      elements.newsDirBias.className = "risk-val safe";
    }
  }

  if (elements.newsPutThreat && data.put_threat_level) {
    elements.newsPutThreat.textContent = data.put_threat_level;
    elements.newsPutThreat.className = `risk-val ${data.put_threat_level.toLowerCase()}`;
  }

  if (elements.newsCallThreat && data.call_threat_level) {
    elements.newsCallThreat.textContent = data.call_threat_level;
    elements.newsCallThreat.className = `risk-val ${data.call_threat_level.toLowerCase()}`;
  }

  if (elements.newsVolForecast && data.volatility_forecast) {
    elements.newsVolForecast.textContent = data.volatility_forecast.replace("_", " ");
    elements.newsVolForecast.className = data.volatility_forecast === "VOLATILITY_EXPANSION" ? "risk-val danger" : "risk-val safe";
  }

  // Update Verified Sources Strip
  if (elements.verifiedSourcesList && data.verified_sources) {
    renderVerifiedSources(data.verified_sources);
  }

  // Update Macro strip
  if (data.macro_cues && data.macro_cues.brent_crude) {
    const brent = data.macro_cues.brent_crude;
    elements.tickerCrudeVal.textContent = `$${brent.price.toFixed(2)}`;
    elements.macroBrent.textContent = `$${brent.price.toFixed(2)}`;
    if (elements.macroBrentSub && brent.change_pct !== undefined) {
      const chgP = brent.change_pct >= 0 ? "+" : "";
      elements.macroBrentSub.textContent = `${chgP}${brent.change_pct}%`;
      elements.macroBrentSub.className = `macro-sub ${brent.change_pct <= 0 ? "down" : "up"}`;
    }
  }
  if (data.macro_cues && data.macro_cues.us_10y_yield) {
    const y10 = data.macro_cues.us_10y_yield;
    elements.macro10y.textContent = `${y10.yield}%`;
    if (elements.macro10ySub && y10.change_bps !== undefined) {
      const chgB = y10.change_bps >= 0 ? "+" : "";
      elements.macro10ySub.textContent = `${chgB}${y10.change_bps} bps`;
      elements.macro10ySub.className = `macro-sub ${y10.change_bps <= 0 ? "down" : "up"}`;
    }
  }
  if (data.macro_cues && data.macro_cues.dollar_index) {
    const dxy = data.macro_cues.dollar_index;
    elements.macroDxy.textContent = `${dxy.price}`;
    if (elements.macroDxySub && dxy.change_pct !== undefined) {
      const chgD = dxy.change_pct >= 0 ? "+" : "";
      elements.macroDxySub.textContent = `${chgD}${dxy.change_pct}%`;
      elements.macroDxySub.className = `macro-sub ${dxy.change_pct <= 0 ? "down" : "up"}`;
    }
  }

  // Populate News List with source badges, categories, timestamps, and clickable links
  renderNewsList(data.news_items || []);
}

function renderVerifiedSources(sources) {
  if (!elements.verifiedSourcesList) return;
  elements.verifiedSourcesList.innerHTML = "";
  const brandColors = {
    "The Economic Times": "#ef4444",
    "Livemint": "#f97316",
    "Reuters": "#ff8000",
    "Bloomberg": "#3b82f6",
    "Moneycontrol": "#06b6d4",
    "CNBC": "#0284c7",
    "Business Standard": "#e11d48",
    "RBI Official": "#10b981",
    "SEBI Official": "#6366f1"
  };

  sources.forEach(src => {
    const pill = document.createElement("span");
    pill.className = "source-tag-pill";
    const color = brandColors[src] || "#38bdf8";
    pill.style.borderColor = color;
    pill.style.color = color;
    pill.textContent = src;
    elements.verifiedSourcesList.appendChild(pill);
  });
}

function renderNewsList(items) {
  elements.newsFeedList.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "news-item-card";
    const srcColor = item.source_color || "#38bdf8";
    const catTag = item.category_tag || "Macro Wire";
    const itemUrl = (item.url && item.url !== "#") ? item.url : "#";

    card.innerHTML = `
      <div class="news-top">
        <div class="news-badges-left">
          <span class="news-source-badge" style="border-left-color: ${srcColor}; color: ${srcColor};">${item.source}</span>
          <span class="news-category-badge">${catTag}</span>
        </div>
        <span class="news-badge" style="background:${item.badge_color}25; color:${item.badge_color}">${item.impact_badge}</span>
      </div>
      <div class="news-title">
        <a href="${itemUrl}" target="_blank" rel="noopener noreferrer" title="Read original dispatch on ${item.source}">${item.title} ↗</a>
      </div>
      <div class="news-time" style="margin-top: 5px;">${item.time}</div>
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
    apiFetch("/api/analyze-strangle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    apiFetch("/api/payoff-curve", {
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
      <span class="factor-status" style="color: ${statusColor}">● ${f.status}</span>
    `;
    elements.decisionFactorsGrid.appendChild(card);
  });

  // Render Numbered Execution Protocol
  elements.playbookList.innerHTML = "";
  (decision.actions || []).forEach((actionText, idx) => {
    const li = document.createElement("li");
    const stepNum = (idx + 1).toString().padStart(2, "0");
    li.innerHTML = `<span class="step-num">${stepNum}</span><span class="step-text">${actionText}</span>`;
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
  spotRel = Math.max(0.04, Math.min(0.96, spotRel));
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
  const resp = await apiFetch("/api/range-predict", {
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
    const isInstitutional = idx === 1;
    card.className = `strat-card ${isInstitutional ? "recommended" : ""}`;

    const bannerHtml = isInstitutional
      ? '<span class="strat-tag-banner">INSTITUTIONAL CHOICE</span>'
      : (idx === 0 ? '<span class="strat-tag-banner" style="background:var(--accent-green); color:#080c14;">WIDE MOAT 95%</span>' : '');

    card.innerHTML = `
      ${bannerHtml}
      <h4 class="strat-tier-name">${strat.tier_name}</h4>
      <span class="strat-pop-badge">${strat.win_probability}</span>

      <div class="strat-strikes-box">
        <div class="strike-row">
          <span class="leg-type pe">SHORT PUT</span>
          <span class="leg-val">${formatNumber(strat.put_strike, 0)} PE</span>
          <span class="leg-prem">~₹${strat.put_premium}</span>
        </div>
        <div class="strike-row">
          <span class="leg-type ce">SHORT CALL</span>
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
          <span>Breakeven Corridor:</span>
          <strong>${formatNumber(strat.lower_breakeven, 0)} — ${formatNumber(strat.upper_breakeven, 0)}</strong>
        </div>
        <div class="strat-metric-row">
          <span>Expected ROC:</span>
          <strong class="color-green">${strat.roc_pct}% (${strat.annualized_roc_pct}% Ann.)</strong>
        </div>
      </div>

      <p class="strat-desc">${strat.desc}</p>

      <button class="btn-apply-strat" data-put="${strat.put_strike}" data-call="${strat.call_strike}" data-putprem="${strat.put_premium}" data-callprem="${strat.call_premium}">
        Deploy Strategy Corridor
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

  const padding = { top: 38, right: 35, bottom: 42, left: 65 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  // Find min/max values
  const spots = STATE.payoffData.map(d => d.spot);
  const minSpot = Math.min(...spots);
  const maxSpot = Math.max(...spots);

  // Y-axis range
  const expiryPnls = STATE.payoffData.map(d => d.expiry_pnl_inr);
  const maxPnl = Math.max(...expiryPnls) * 1.35;
  const minPnl = -maxPnl * 1.75;

  const getX = (spot) => padding.left + ((spot - minSpot) / (maxSpot - minSpot)) * plotW;
  const getY = (pnl) => padding.top + ((maxPnl - pnl) / (maxPnl - minPnl)) * plotH;

  const yZero = getY(0);

  // 1. Draw Subtle Grid Lines & Y-Axis Labels
  ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const yVal = minPnl + (i / 5) * (maxPnl - minPnl);
    const yPx = getY(yVal);
    ctx.beginPath();
    ctx.moveTo(padding.left, yPx);
    ctx.lineTo(w - padding.right, yPx);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const prefix = yVal > 0 ? "+" : "";
    ctx.fillText(`${prefix}₹${(yVal / 1000).toFixed(1)}k`, padding.left - 8, yPx);
  }

  // 2. Draw Zero P&L Axis Line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, yZero);
  ctx.lineTo(w - padding.right, yZero);
  ctx.stroke();
  ctx.setLineDash([]);

  // Zero Label
  ctx.fillStyle = "#94a3b8";
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("₹0", w - padding.right + 6, yZero + 3);

  // 3. Profit Region Fill (Subtle Emerald Gradient)
  const gradProfit = ctx.createLinearGradient(0, padding.top, 0, yZero);
  gradProfit.addColorStop(0, "rgba(16, 185, 129, 0.22)");
  gradProfit.addColorStop(1, "rgba(16, 185, 129, 0.02)");

  ctx.fillStyle = gradProfit;
  ctx.beginPath();
  let inProfit = false;
  STATE.payoffData.forEach(d => {
    const x = getX(d.spot);
    const y = getY(d.expiry_pnl_inr);
    if (d.expiry_pnl_inr >= 0) {
      if (!inProfit) {
        ctx.moveTo(x, yZero);
        inProfit = true;
      }
      ctx.lineTo(x, y);
    } else if (inProfit) {
      ctx.lineTo(x, yZero);
      inProfit = false;
    }
  });
  if (inProfit) {
    ctx.lineTo(getX(STATE.payoffData[STATE.payoffData.length - 1].spot), yZero);
  }
  ctx.closePath();
  ctx.fill();

  // 4. Draw Expiry Payoff Line (Solid Emerald)
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  STATE.payoffData.forEach((d, i) => {
    const x = getX(d.spot);
    const y = getY(d.expiry_pnl_inr);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 5. Draw Today (T+0) Curve (Cobalt Sky with Soft Ambient Glow)
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(56, 189, 248, 0.35)";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  STATE.payoffData.forEach((d, i) => {
    const x = getX(d.spot);
    const y = getY(d.t0_pnl_inr);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0; // reset shadow

  // 6. Draw Strikes & Breakevens Vertical Lines with Top Badge Pills
  drawVerticalMarker(ctx, getX(STATE.putStrike), h, "#38bdf8", `PE ${STATE.putStrike}`);
  drawVerticalMarker(ctx, getX(STATE.callStrike), h, "#818cf8", `CE ${STATE.callStrike}`);

  const totalPremPts = STATE.putPrem + STATE.callPrem;
  const lowerBe = STATE.putStrike - totalPremPts;
  const upperBe = STATE.callStrike + totalPremPts;
  drawVerticalMarker(ctx, getX(lowerBe), h, "#f59e0b", `BE ${lowerBe.toFixed(0)}`, true);
  drawVerticalMarker(ctx, getX(upperBe), h, "#f59e0b", `BE ${upperBe.toFixed(0)}`, true);

  // 7. Draw Current Spot Line & Precision Dual-Ring Pin
  const spotX = getX(STATE.spot);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(spotX, 32);
  ctx.lineTo(spotX, h - padding.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Spot point on T0 curve
  const currentT0Pnl = calculateT0PnlAtSpot(STATE.spot);
  const spotY = getY(currentT0Pnl);

  // Outer ambient ring
  ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
  ctx.beginPath();
  ctx.arc(spotX, spotY, 7.5, 0, Math.PI * 2);
  ctx.fill();

  // Solid white center core
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(spotX, spotY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Spot pill badge at top
  const spotText = `Spot ${STATE.spot.toFixed(1)}`;
  ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
  const sWidth = ctx.measureText(spotText).width + 12;
  const sX = spotX - sWidth / 2;
  const sY = 12;
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(sX, sY, sWidth, 18, 4) : ctx.rect(sX, sY, sWidth, 18);
  ctx.fill();

  ctx.fillStyle = "#080c14";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spotText, spotX, sY + 9);

  // 8. Crosshair if hovered
  if (crosshairSpot !== null) {
    const chX = getX(crosshairSpot);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(chX, 32);
    ctx.lineTo(chX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawVerticalMarker(ctx, x, h, color, text, isDashed = false) {
  if (x < 65 || x > ctx.canvas.width / (window.devicePixelRatio || 1) - 40) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  if (isDashed) {
    ctx.setLineDash([4, 4]);
  }
  ctx.beginPath();
  ctx.moveTo(x, 32);
  ctx.lineTo(x, h - 42);
  ctx.stroke();

  // Draw clean rounded pill badge at top of marker
  ctx.setLineDash([]);
  ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
  const textWidth = ctx.measureText(text).width;
  const pillW = textWidth + 10;
  const pillH = 17;
  const pillX = x - pillW / 2;
  const pillY = 12;

  ctx.fillStyle = "rgba(14, 22, 38, 0.95)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, 4) : ctx.rect(pillX, pillY, pillW, pillH);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, pillY + pillH / 2 + 0.5);

  ctx.restore();
}

function calculateT0PnlAtSpot(targetSpot) {
  if (!STATE.payoffData || STATE.payoffData.length === 0) return 0;
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
  const plotW = rect.width - paddingLeft - 35;
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

  // Update Tooltip
  const tooltip = elements.canvasTooltip;
  tooltip.style.display = "block";
  tooltip.style.left = `${Math.min(mouseX + 14, rect.width - 210)}px`;
  tooltip.style.top = `55px`;

  const t0Sign = nearest.t0_pnl_inr >= 0 ? "+" : "";
  const expSign = nearest.expiry_pnl_inr >= 0 ? "+" : "";
  const t0Color = nearest.t0_pnl_inr >= 0 ? "#34d399" : "#f43f5e";
  const expColor = nearest.expiry_pnl_inr >= 0 ? "#34d399" : "#f43f5e";

  const distToPut = Math.round(nearest.spot - STATE.putStrike);
  const distToCall = Math.round(STATE.callStrike - nearest.spot);

  tooltip.innerHTML = `
    <div style="font-weight:700; color:#fff; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:3px; margin-bottom:5px;">
      Nifty ${formatNumber(nearest.spot, 1)}
    </div>
    <div style="color:${t0Color}; display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
      <span style="color:#94a3b8">Today (T+0):</span> <strong>${t0Sign}₹${formatNumber(nearest.t0_pnl_inr, 0)}</strong>
    </div>
    <div style="color:${expColor}; display:flex; justify-content:space-between; gap:12px;">
      <span style="color:#94a3b8">At Expiry:</span> <strong>${expSign}₹${formatNumber(nearest.expiry_pnl_inr, 0)}</strong>
    </div>
    <div style="font-size:9.5px; color:#64748b; margin-top:5px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06);">
      ${distToPut >= 0 ? `+${distToPut} pts above Put` : `${distToPut} pts below Put`} • 
      ${distToCall >= 0 ? `+${distToCall} pts below Call` : `${Math.abs(distToCall)} pts above Call`}
    </div>
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
    const resp = await apiFetch("/api/broker/configure", {
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
