# MindMePredict — Nifty StrangleCopilot ⚡

Institutional-grade quantitative decision-support agent and interactive web terminal designed for **Nifty Short Strangle** options sellers.

---

## 🎯 What it Solves

If you are running a **Nifty Short Strangle** (e.g. **Short 21,000 PE + Short 24,300 CE** for the Nov 23 expiry, where you profit if Nifty stays within this band), **MindMePredict StrangleCopilot** continuously evaluates:

1. **Daily Theta Decay**: Tracks real rupee earnings (+₹/day) as time decay works in your favor.
2. **Market Fear & India VIX Radar**: Semicircular speedometer measuring whether VIX is in the optimal theta harvesting zone (12–16) or warning of tail risk spikes.
3. **Global News & Geopolitical Risk**: Scans macro catalysts (Brent Crude, US 10Y Yields, Dollar Index, Geopolitical news headlines) to compute a **Macro Threat Score (0–100)**.
4. **Autonomous AI Copilot Verdict**:
   - `STRONG HOLD`: Spot is comfortably inside the corridor; theta decay is optimal.
   - `ROLL UNTESTED LEG`: Spot has drifted towards one side, leaving the opposite leg >75% decayed. Rebalances delta and collects fresh credit.
   - `DELTA HEDGE REQUIRED`: Spot is pressing within 1.8% of a strike; provides immediate strike adjustment playbook.
   - `CONVERT TO IRON CONDOR`: Global or VIX shock; guides purchasing protective wings.
   - `BOOK PROFIT`: 75–80% of total credit has decayed; prevents holding through late-stage gamma risk.
   - `EMERGENCY CUT / STOP LOSS`: Hard stop if breakeven is breached.
5. **Statistical Range Predictor (Invest Accordingly)**:
   - Uses the Implied Volatility expected move formula:
     $$\text{Expected Move} = \text{Spot} \times \frac{\text{IV}}{100} \times \sqrt{\frac{\text{DTE}}{365}}$$
   - Generates **Conservative (2-Sigma / ~95% Win Rate)**, **Institutional (1.5-Sigma / ~86% Win Rate)**, and **High Yield (1-Sigma / ~68% Win Rate)** strike pairs for any target expiry date (e.g. 24 DTE, Nov 23).
6. **Indian Broker Integration**:
   - Built-in connection support for **Zerodha Kite Connect**, **Upstox**, and **Angel One SmartAPI**, alongside seamless live market public data streaming.

---

## 🛠️ Architecture

```
Mindmepredict/
├── engine/
│   ├── options_math.py        # Black-Scholes-Merton model, Greeks (Theta/Delta/Gamma/Vega), POP & Payoffs
│   ├── volatility_stats.py    # India VIX, US VIX, HV-20 vs IV Spread (VRP), PCR, Max Pain
│   ├── sentiment_scanner.py   # Global macro cues (Crude, Yields, DXY), financial RSS news threat scorer
│   ├── decision_agent.py      # Institutional rules & probability matrix for Hold/Sell/Roll/Hedge decisions
│   ├── range_predictor.py     # 1-Sigma, 1.5-Sigma, 2-Sigma expected move & strike recommender
│   └── broker_client.py       # Zerodha Kite, Upstox, Angel One connector + simulated mode
├── static/
│   ├── index.html             # Terminal UI with Canvas payoff graph & interactive sliders
│   ├── style.css              # Custom dark Bloomberg/TradingView aesthetic, glassmorphism, responsive grid
│   └── app.js                 # Frontend event bus, crosshair tooltip, dynamic scenario tester
├── main.py                    # FastAPI server exposing REST endpoints and serving the web dashboard
├── requirements.txt
└── README.md
```

---

## 🚀 Running the Platform

The server runs on `http://127.0.0.1:8000`:

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

- **Interactive Payoff Canvas**: Hover anywhere on the chart to inspect theoretical T+0 P&L and Expiry P&L at any prospective Nifty level.
- **Scenario Stress Testing**: Test how your 21,000 / 24,300 strangle behaves under a `-2% Crash`, `+2% Rally`, `VIX +25% Spike`, or `+7 Days of Decay` with one click.
- **One-Click Range Deployment**: In the Range Predictor section, pick any DTE and click **Apply to Simulator ⚡** on any of the 3 recommended tiers to load those strikes directly into the live copilot.
- **Broker Sync**: Click the **Broker Connect** button in the top navigation to add Zerodha Kite API keys or switch to Live Market feed.
