"""
MindMePredict - StrangleCopilot Backend Server
FastAPI application providing APIs for options mathematics, Greeks analysis,
market fear / India VIX radar, news threat evaluation, AI decision copilot, and broker sync.
"""

import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine.options_math import analyze_short_strangle, generate_payoff_curve, NIFTY_LOT_SIZE
from engine.volatility_stats import fetch_live_market_stats, compute_pcr_and_max_pain
from engine.sentiment_scanner import fetch_global_news_sentiment
from engine.decision_agent import evaluate_strangle_decision
from engine.range_predictor import calculate_expected_ranges
from engine.broker_client import IndianBrokerManager

app = FastAPI(
    title="MindMePredict - StrangleCopilot",
    description="Quantitative Decision-Support Agent for Nifty Short Strangle Strategies",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Request & Response Schemas
# -------------------------------------------------------------
class StrangleRequest(BaseModel):
    spot: Optional[float] = None
    put_strike: float = Field(21000.0, description="Short Put Strike (e.g. 21000)")
    call_strike: float = Field(24300.0, description="Short Call Strike (e.g. 24300)")
    dte_days: float = Field(24.0, description="Days to expiry (e.g. 24 for Nov 23)")
    vix: Optional[float] = None
    put_entry_premium: float = Field(42.0, description="Entry premium received for Put")
    call_entry_premium: float = Field(38.0, description="Entry premium received for Call")
    put_current_premium: Optional[float] = None
    call_current_premium: Optional[float] = None
    lot_size: int = Field(NIFTY_LOT_SIZE, description="Contract lot size (25 for Nifty)")
    lots: int = Field(2, description="Number of lots traded")


class RangePredictRequest(BaseModel):
    spot: Optional[float] = None
    dte_days: float = Field(24.0, description="Days to Expiry for new strangle")
    vix: Optional[float] = None
    lots: int = Field(2, description="Number of lots to invest")


class BrokerConfigRequest(BaseModel):
    broker_type: str = Field("zerodha", description="zerodha, upstox, angelone, or simulated")
    api_key: Optional[str] = ""
    api_secret: Optional[str] = ""
    access_token: Optional[str] = ""
    client_code: Optional[str] = ""
    pin: Optional[str] = ""
    totp_key: Optional[str] = ""


# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------
@app.get("/api/market")
def get_market_overview():
    """Live Nifty spot, India VIX, US VIX, 20-day HV, PCR, and Max Pain."""
    stats = fetch_live_market_stats()
    pcr_data = compute_pcr_and_max_pain(stats["spot"])
    return {
        **stats,
        **pcr_data
    }


@app.get("/api/news")
def get_news_and_catalysts():
    """Global macro news, threat score, crude oil, yields, and risk rating."""
    return fetch_global_news_sentiment()


@app.post("/api/analyze-strangle")
def analyze_strangle(req: StrangleRequest):
    """
    Run full quantitative analysis + AI Copilot Hold/Sell/Hedge decision.
    """
    market = fetch_live_market_stats()
    spot = req.spot if (req.spot and req.spot > 0) else market["spot"]
    vix = req.vix if (req.vix and req.vix > 0) else market["vix"]

    # Quantitative calculations
    position_data = analyze_short_strangle(
        spot=spot,
        put_strike=req.put_strike,
        call_strike=req.call_strike,
        dte_days=req.dte_days,
        vix=vix,
        put_entry_premium=req.put_entry_premium,
        call_entry_premium=req.call_entry_premium,
        put_current_premium=req.put_current_premium,
        call_current_premium=req.call_current_premium,
        lot_size=req.lot_size,
        lots=req.lots
    )

    # Sentiment & News
    sentiment = fetch_global_news_sentiment()

    # AI Decision Copilot
    decision = evaluate_strangle_decision(
        position_data=position_data,
        market_stats=market,
        sentiment_data=sentiment
    )

    return {
        "position": position_data,
        "market": market,
        "sentiment": sentiment,
        "copilot_decision": decision
    }


@app.post("/api/payoff-curve")
def get_payoff_data(req: StrangleRequest):
    """
    Generate coordinates for interactive Canvas payoff chart.
    """
    market = fetch_live_market_stats()
    spot = req.spot if (req.spot and req.spot > 0) else market["spot"]
    vix = req.vix if (req.vix and req.vix > 0) else market["vix"]

    curve = generate_payoff_curve(
        spot=spot,
        put_strike=req.put_strike,
        call_strike=req.call_strike,
        dte_days=req.dte_days,
        vix=vix,
        put_entry_premium=req.put_entry_premium,
        call_entry_premium=req.call_entry_premium,
        lot_size=req.lot_size * req.lots
    )
    return {"curve": curve}


@app.post("/api/range-predict")
def predict_ranges(req: RangePredictRequest):
    """
    Calculate 1-SD, 1.5-SD, and 2-SD expected moves and recommend strike corridors.
    """
    market = fetch_live_market_stats()
    spot = req.spot if (req.spot and req.spot > 0) else market["spot"]
    vix = req.vix if (req.vix and req.vix > 0) else market["vix"]

    return calculate_expected_ranges(
        spot=spot,
        dte_days=req.dte_days,
        vix=vix,
        lot_size=NIFTY_LOT_SIZE,
        lots=req.lots
    )


@app.get("/api/broker/status")
def get_broker_status():
    """Retrieve Indian broker connection status and synced positions."""
    status = IndianBrokerManager.get_status()
    active_pos = IndianBrokerManager.fetch_active_strangle_positions()
    return {
        "status": status,
        "active_positions": active_pos
    }


@app.post("/api/broker/configure")
def configure_broker(req: BrokerConfigRequest):
    """Configure Zerodha Kite Connect, Upstox, or Angel One credentials."""
    creds = {
        "api_key": req.api_key or "",
        "api_secret": req.api_secret or "",
        "access_token": req.access_token or "",
        "client_code": req.client_code or "",
        "pin": req.pin or "",
        "totp_key": req.totp_key or ""
    }
    result = IndianBrokerManager.configure_broker(req.broker_type, creds)
    return result


# -------------------------------------------------------------
# Mount Static Frontend
# -------------------------------------------------------------
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
