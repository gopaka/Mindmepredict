# MindMePredict — Nifty StrangleCopilot ⚡

Institutional-grade quantitative decision-support agent and interactive web terminal designed for **Nifty Short Strangle** options sellers.

---

## 🎯 What it Solves

If you are running a **Nifty Short Strangle** (e.g. **Short 21,000 PE + Short 24,300 CE** for the Nov 23 expiry, where you profit if Nifty stays within this band), **MindMePredict StrangleCopilot** continuously evaluates:

1. **Terminal Security & Desk Authorization**: Complete authentication gateway protecting all quantitative data, Greeks, AI execution protocols, and broker secrets behind PBKDF2 password hashing and HMAC-SHA256 tamper-proof signed session tokens.
2. **Daily Theta Decay**: Tracks real rupee earnings (+₹/day) as time decay works in your favor.
3. **Market Fear & India VIX Radar**: Semicircular speedometer measuring whether VIX is in the optimal theta harvesting zone (12–16) or warning of tail risk spikes.
4. **Global News & Geopolitical Risk (1-Minute Live Fetch)**: Scans Tier-1 macro catalysts (Reuters, Bloomberg, The Economic Times, Mint, Moneycontrol, Business Standard, CNBC, Brent Crude, US 10Y Yields, Dollar Index) to compute an institutional **Macro Threat Score (0–100)**, directional bias, and strike threat breakdown with 96%+ multi-source corroboration.
5. **Dynamic Real-Time Live Terminal**: Dashboard updates dynamically every 60 seconds (with live countdown, SSE stream push, and instant sync) without requiring manual page reloads.
6. **Autonomous AI Copilot Verdict**:
   - `STRONG HOLD`: Spot is comfortably inside the corridor; theta decay is optimal.
   - `ROLL UNTESTED LEG`: Spot has drifted towards one side, leaving the opposite leg >75% decayed. Rebalances delta and collects fresh credit.
   - `DELTA HEDGE REQUIRED`: Spot is pressing within 1.8% of a strike; provides immediate strike adjustment playbook.
   - `CONVERT TO IRON CONDOR`: Global or VIX shock; guides purchasing protective wings.
   - `BOOK PROFIT`: 75–80% of total credit has decayed; prevents holding through late-stage gamma risk.
   - `EMERGENCY CUT / STOP LOSS`: Hard stop if breakeven is breached.
7. **Statistical Range Predictor (Invest Accordingly)**:
   - Uses the Implied Volatility expected move formula:
     $$\text{Expected Move} = \text{Spot} \times \frac{\text{IV}}{100} \times \sqrt{\frac{\text{DTE}}{365}}$$
   - Generates **Conservative (2-Sigma / ~95% Win Rate)**, **Institutional (1.5-Sigma / ~86% Win Rate)**, and **High Yield (1-Sigma / ~68% Win Rate)** strike pairs for any target expiry date (e.g. 24 DTE, Nov 23).
8. **Indian Broker Integration**:
   - Built-in connection support for **Zerodha Kite Connect**, **Upstox**, and **Angel One SmartAPI**, alongside seamless live market public data streaming.

---

## 🔐 Institutional Authentication & Safeguard

The terminal features a full-screen, obsidian-themed login gateway to safeguard live positions, Greeks, and execution protocols:

- **Default Operator Identifier**: `admin`
- **Default Master Access Key**: `nifty2026`
- **Configurable via Environment Variables**:
  ```bash
  export DESK_USERNAME="your_username"
  export DESK_PASSWORD="your_secure_password"
  export DESK_FULLNAME="Your Name"
  export TERMINAL_SECRET_KEY="optional_custom_secret_key"
  ```
- **Security Features**:
  - Cryptographically secure PBKDF2-HMAC-SHA256 password hashing with individual salt.
  - Signed HMAC-SHA256 session tokens with 7-day expiration.
  - Automated 401 Unauthorized interceptor locking the terminal on expired or invalid requests.
  - One-click terminal lock / sign out with immediate session revocation.
  - Protected API routes (`/api/market`, `/api/news`, `/api/sync-now`, `/api/analyze-strangle`, `/api/payoff-curve`, `/api/range-predict`, `/api/broker/*`, and `/api/stream/events`).

---

## 🛠️ Architecture

```
Mindmepredict/
├── engine/
│   ├── auth.py                # Zero-dependency PBKDF2 password hashing & HMAC-SHA256 signed session tokens
│   ├── options_math.py        # Black-Scholes-Merton model, Greeks (Theta/Delta/Gamma/Vega), POP & Payoffs
│   ├── volatility_stats.py    # India VIX, US VIX, HV-20 vs IV Spread (VRP), PCR, Max Pain
│   ├── sentiment_scanner.py   # Global macro cues (Crude, Yields, DXY), financial RSS news threat scorer
│   ├── decision_agent.py      # Institutional rules & probability matrix for Hold/Sell/Roll/Hedge decisions
│   ├── range_predictor.py     # 1-Sigma, 1.5-Sigma, 2-Sigma expected move & strike recommender
│   └── broker_client.py       # Zerodha Kite, Upstox, Angel One connector + simulated mode
├── static/
│   ├── index.html             # Terminal UI with Obsidian Auth Gateway, Canvas payoff & live tickers
│   ├── style.css              # Dark Bloomberg/TradingView aesthetic, glassmorphism, responsive grid
│   └── app.js                 # Frontend event bus, auth interceptor, 1m SSE sync, dynamic scenario tester
├── main.py                    # FastAPI server exposing REST endpoints, SSE stream, and auth verification
├── Dockerfile                 # Multi-arch production container definition with health checks & non-root user
├── docker-compose.yml         # Single-command container deployment with persistent named data volume
├── .env.example               # Environment variables template for operator credentials and ports
├── .dockerignore              # Clean build context exclusion rules
├── EC2_DEPLOYMENT.md          # Complete AWS EC2 deployment & security group guide
├── requirements.txt
└── README.md
```

---

## 🚀 Running the Platform

### Option A: Running with Docker (Recommended for EC2 & Centralized Access)

```bash
# 1. Copy the environment configuration
cp .env.example .env

# 2. Start the containerized platform
docker compose up -d --build

# 3. View live 1-minute sync logs
docker compose logs -f
```

Open your browser to: **[http://localhost:8000](http://localhost:8000)** (or your EC2 IP).

> 📘 **Detailed EC2 Guide**: See [EC2_DEPLOYMENT.md](EC2_DEPLOYMENT.md) for full step-by-step instructions on AWS Security Groups, Docker setup on Ubuntu, domain SSL configuration, and production maintenance.

---

### Option B: Local Python Environment

```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Install dependencies (if needed)
pip install -r requirements.txt

# 3. Start the server
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📊 Key Features & Interactions

- **Dynamic Live Auto-Sync (1-Minute Cycle)**: Real-time 60-second background worker and Server-Sent Events (SSE) automatically stream fresh market quotes, Greeks, and news threat assessments directly into the terminal without manual page refreshes.
- **Tier-1 Verified News Intelligence**: Multi-threaded parallel aggregator continuously cross-corroborates headlines from Reuters, Bloomberg, The Economic Times, Mint, Moneycontrol, Business Standard, and CNBC.
- **Interactive Payoff Canvas**: Hover anywhere on the chart to inspect theoretical T+0 P&L and Expiry P&L at any prospective Nifty level.
- **Scenario Stress Testing**: Test how your 21,000 / 24,300 strangle behaves under a `-2% Crash`, `+2% Rally`, `VIX +25% Spike`, or `+7 Days of Decay` with one click.
- **One-Click Range Deployment**: In the Range Predictor section, pick any DTE and click **Apply to Simulator ⚡** on any of the 3 recommended tiers to load those strikes directly into the live copilot.
- **Broker Sync**: Click the **Broker Connect** button in the top navigation to add Zerodha Kite API keys or switch to Live Market feed.
