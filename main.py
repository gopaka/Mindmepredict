"""
MindMePredict - StrangleCopilot Backend Server
FastAPI application providing APIs for options mathematics, Greeks analysis,
market fear / India VIX radar, news threat evaluation, AI decision copilot, and broker sync.
Includes 1-minute periodic background news & macro worker and Server-Sent Events (SSE).
"""

import asyncio
from contextlib import asynccontextmanager
import json
import os
import time
from typing import Optional, Set
from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from engine.options_math import analyze_short_strangle, generate_payoff_curve, NIFTY_LOT_SIZE
from engine.volatility_stats import fetch_live_market_stats, compute_pcr_and_max_pain
from engine.sentiment_scanner import fetch_global_news_sentiment
from engine.decision_agent import evaluate_strangle_decision
from engine.range_predictor import calculate_expected_ranges
from engine.broker_client import IndianBrokerManager
from engine.auth import (
    authenticate_user,
    create_access_token,
    verify_access_token,
    get_current_user
)

# -------------------------------------------------------------
# Real-Time SSE Event Broadcasting & 1-Minute Background Worker
# -------------------------------------------------------------
_SSE_CLIENTS: Set[asyncio.Queue] = set()


async def broadcast_live_event(event_data: dict):
    """Notify all connected dashboard clients of fresh market & news data."""
    if not _SSE_CLIENTS:
        return
    msg = f"data: {json.dumps(event_data)}\n\n"
    for queue in list(_SSE_CLIENTS):
        try:
            await queue.put(msg)
        except Exception:
            _SSE_CLIENTS.discard(queue)


async def periodic_news_and_market_worker():
    """
    Background worker that runs every 60 seconds (1 minute).
    Fetches fresh news and market data, keeping caches primed and pushing
    real-time notifications to connected clients.
    """
    print("[MINDMEPREDICT] Starting 1-minute background news & market synchronization worker...")
    # Initial pre-heat
    try:
        fetch_live_market_stats(use_cache=False)
        fetch_global_news_sentiment(force_refresh=True)
    except Exception as e:
        print(f"[MINDMEPREDICT PREHEAT ERROR] {e}")

    while True:
        await asyncio.sleep(60)
        try:
            # Refresh market data and news sentiment
            market = fetch_live_market_stats(use_cache=False)
            news = fetch_global_news_sentiment(force_refresh=True)
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            print(
                f"[LIVE SYNC - 1m] Synced {len(news.get('news_items', []))} news items across "
                f"{news.get('total_sources_scanned', 0)} sources. Threat: {news.get('threat_score')}/100 "
                f"({news.get('threat_level')}) at {timestamp}"
            )

            # Broadcast to SSE subscribers
            await broadcast_live_event({
                "type": "market_sync",
                "timestamp": timestamp,
                "spot": market.get("spot"),
                "vix": market.get("vix"),
                "threat_score": news.get("threat_score"),
                "threat_level": news.get("threat_level"),
                "prediction_confidence": news.get("prediction_confidence")
            })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[LIVE SYNC ERROR] Error during periodic sync: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch 1-minute periodic background worker
    worker_task = asyncio.create_task(periodic_news_and_market_worker())
    yield
    # Shutdown: cancel task cleanly
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="MindMePredict - StrangleCopilot",
    description="Quantitative Decision-Support Agent for Nifty Short Strangle Strategies",
    version="1.0.0",
    lifespan=lifespan
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


class LoginRequest(BaseModel):
    username: str = Field(..., description="Quant Desk Username / Operator ID")
    password: str = Field(..., description="Access Key / Password")


# -------------------------------------------------------------
# Authentication Endpoints
# -------------------------------------------------------------
@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    """
    Authenticate quant desk operator and return a signed HMAC session token.
    Default credentials: admin / nifty2026 (configurable via env vars).
    """
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Access Denied: Invalid desk credentials. Please check operator ID and password."
        )
    token = create_access_token(user)
    return {
        "status": "authenticated",
        "token": token,
        "user": user,
        "expires_in_days": 7
    }


@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    """Verify active session token and return authorized operator profile."""
    return {
        "authenticated": True,
        "user": current_user
    }


@app.post("/api/auth/logout")
def auth_logout():
    """Terminate desk session and invalidate local client state."""
    return {
        "status": "logged_out",
        "message": "Desk session terminated. Terminal locked."
    }


# -------------------------------------------------------------
# Protected API Endpoints
# -------------------------------------------------------------
@app.get("/api/market")
def get_market_overview(user: dict = Depends(get_current_user)):
    """Live Nifty spot, India VIX, US VIX, 20-day HV, PCR, and Max Pain."""
    stats = fetch_live_market_stats()
    pcr_data = compute_pcr_and_max_pain(stats["spot"])
    return {
        **stats,
        **pcr_data
    }


@app.get("/api/news")
def get_news_and_catalysts(
    force_refresh: bool = Query(False),
    user: dict = Depends(get_current_user)
):
    """Global macro news, threat score, crude oil, yields, and risk rating (1-minute cache)."""
    return fetch_global_news_sentiment(force_refresh=force_refresh)


@app.post("/api/sync-now")
async def trigger_manual_sync(user: dict = Depends(get_current_user)):
    """Immediately triggers a live re-fetch across news feeds and market data."""
    market = fetch_live_market_stats(use_cache=False)
    news = fetch_global_news_sentiment(force_refresh=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    await broadcast_live_event({
        "type": "market_sync",
        "timestamp": timestamp,
        "spot": market.get("spot"),
        "vix": market.get("vix"),
        "threat_score": news.get("threat_score"),
        "threat_level": news.get("threat_level"),
        "prediction_confidence": news.get("prediction_confidence")
    })
    return {
        "status": "success",
        "timestamp": timestamp,
        "message": f"Synced {len(news.get('news_items', []))} news items across {news.get('total_sources_scanned', 0)} sources."
    }


@app.get("/api/stream/events")
async def stream_live_events(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """
    Server-Sent Events (SSE) stream delivering real-time 1-minute live updates.
    Secured via HMAC token check.
    """
    extracted_token = None
    if authorization and authorization.lower().startswith("bearer "):
        extracted_token = authorization[7:].strip()
    elif token:
        extracted_token = token.strip()

    payload = verify_access_token(extracted_token) if extracted_token else None
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Valid session token required for live event stream."
        )

    queue: asyncio.Queue = asyncio.Queue()
    _SSE_CLIENTS.add(queue)

    async def event_generator():
        try:
            init_data = json.dumps({"type": "connected", "message": "Live dynamic 1-minute stream connected", "interval": 60})
            yield f"data: {init_data}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _SSE_CLIENTS.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/analyze-strangle")
def analyze_strangle(req: StrangleRequest, user: dict = Depends(get_current_user)):
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
def get_payoff_data(req: StrangleRequest, user: dict = Depends(get_current_user)):
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
def predict_ranges(req: RangePredictRequest, user: dict = Depends(get_current_user)):
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
def get_broker_status(user: dict = Depends(get_current_user)):
    """Retrieve Indian broker connection status and synced positions."""
    status = IndianBrokerManager.get_status()
    active_pos = IndianBrokerManager.fetch_active_strangle_positions()
    return {
        "status": status,
        "active_positions": active_pos
    }


@app.post("/api/broker/configure")
def configure_broker(req: BrokerConfigRequest, user: dict = Depends(get_current_user)):
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
