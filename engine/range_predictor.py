"""
Range Predictor & Strangle Strategy Generator
Computes statistical expected move cones (1-Sigma, 1.5-Sigma, 2-Sigma) based on Implied Volatility
and recommends optimal strike pairs for new investments.
"""

import math
from typing import Dict, Any, List
from engine.options_math import black_scholes_call, black_scholes_put, NIFTY_LOT_SIZE

# Typical approximate SPAN + Exposure margin for 1 lot unhedged Nifty short strangle
ESTIMATED_STRANGLE_MARGIN_INR = 125000.0


def round_to_strike(value: float, step: int = 100) -> int:
    """Round to nearest standard Nifty option strike (typically 50 or 100)."""
    return int(round(value / step) * step)


def calculate_expected_ranges(
    spot: float,
    dte_days: float,
    vix: float,
    lot_size: int = NIFTY_LOT_SIZE,
    lots: int = 1
) -> Dict[str, Any]:
    """
    Calculate statistical expected ranges and generate 3 short strangle strategies:
    Conservative (2.0-Sigma), Moderate (1.5-Sigma), and Aggressive (1.0-Sigma).
    """
    t_years = max(dte_days / 365.0, 0.0001)
    sigma = max(vix / 100.0, 0.05)

    # 1-Standard-Deviation Expected Move
    expected_move_1sd = spot * sigma * math.sqrt(t_years)
    expected_move_1_5sd = 1.5 * expected_move_1sd
    expected_move_2sd = 2.0 * expected_move_1sd

    tiers = [
        {
            "name": "Conservative (Wide Moat)",
            "sigma_multiplier": 2.0,
            "win_probability": "95.4% (2-Sigma Confidence)",
            "pop_value": 95.4,
            "risk_profile": "Ultra-Low Risk",
            "style_badge": "safe",
            "desc": "Similar to the 21,000 - 24,300 range. Maximizes win probability with wide breathing room.",
            "move_pts": expected_move_2sd
        },
        {
            "name": "Institutional Standard",
            "sigma_multiplier": 1.5,
            "win_probability": "86.6% (1.5-Sigma Confidence)",
            "pop_value": 86.6,
            "risk_profile": "Balanced Decay & Cushion",
            "style_badge": "balanced",
            "desc": "Standard institutional strangle. Healthy theta burn with ~1.5x expected move buffer.",
            "move_pts": expected_move_1_5sd
        },
        {
            "name": "High Yield (Active Seller)",
            "sigma_multiplier": 1.0,
            "win_probability": "68.3% (1-Sigma Confidence)",
            "pop_value": 68.3,
            "risk_profile": "Higher Yield / Active Adjustments",
            "style_badge": "aggressive",
            "desc": "High premium collection (~0.16 Delta). Best when market is in confirmed tight consolidation.",
            "move_pts": expected_move_1sd
        }
    ]

    total_qty = lot_size * lots
    capital_req = ESTIMATED_STRANGLE_MARGIN_INR * lots

    recommended_strategies = []

    for tier in tiers:
        move = tier["move_pts"]
        put_strike = round_to_strike(spot - move, 100)
        call_strike = round_to_strike(spot + move, 100)

        # Theoretical premium estimate for these strikes
        put_premium = round(black_scholes_put(spot, put_strike, t_years, sigma), 1)
        call_premium = round(black_scholes_call(spot, call_strike, t_years, sigma), 1)

        # Ensure realistic minimum bid-ask value
        put_premium = max(put_premium, 18.0)
        call_premium = max(call_premium, 18.0)

        total_credit_pts = round(put_premium + call_premium, 1)
        total_credit_inr = round(total_credit_pts * total_qty, 0)

        lower_be = put_strike - total_credit_pts
        upper_be = call_strike + total_credit_pts

        # Return on Capital (ROC)
        roc_pct = round((total_credit_inr / capital_req) * 100.0, 2)
        annualized_roc = round(roc_pct * (365.0 / max(dte_days, 1.0)), 1)

        recommended_strategies.append({
            "tier_name": tier["name"],
            "sigma_multiplier": tier["sigma_multiplier"],
            "win_probability": tier["win_probability"],
            "pop_value": tier["pop_value"],
            "risk_profile": tier["risk_profile"],
            "style_badge": tier["style_badge"],
            "desc": tier["desc"],
            "put_strike": put_strike,
            "call_strike": call_strike,
            "put_premium": put_premium,
            "call_premium": call_premium,
            "total_credit_pts": total_credit_pts,
            "total_credit_inr": total_credit_inr,
            "lower_breakeven": lower_be,
            "upper_breakeven": upper_be,
            "range_corridor_pts": round(upper_be - lower_be, 0),
            "lower_buffer_pct": round(((spot - put_strike) / spot) * 100.0, 2),
            "upper_buffer_pct": round(((call_strike - spot) / spot) * 100.0, 2),
            "capital_required_inr": capital_req,
            "roc_pct": roc_pct,
            "annualized_roc_pct": annualized_roc
        })

    return {
        "spot": spot,
        "dte_days": dte_days,
        "vix": vix,
        "expected_move_1sd_pts": round(expected_move_1sd, 1),
        "expected_move_1sd_pct": round((expected_move_1sd / spot) * 100.0, 2),
        "strategies": recommended_strategies
    }
