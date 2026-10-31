"""
Options Pricing & Greeks Engine for Nifty Short Strangles
Uses Black-Scholes-Merton model tailored for European index options.
"""

import math
from typing import Dict, List, Any, Tuple
from scipy.stats import norm

RISK_FREE_RATE = 0.068  # RBI Repo rate / 91-day T-Bill (~6.8%)
NIFTY_LOT_SIZE = 25     # Standard Nifty lot size


def calculate_d1_d2(spot: float, strike: float, time_to_expiry_years: float,
                    volatility: float, risk_free_rate: float = RISK_FREE_RATE) -> Tuple[float, float]:
    """Calculate d1 and d2 parameters for Black-Scholes."""
    if time_to_expiry_years <= 0.0001:
        time_to_expiry_years = 0.0001
    if volatility <= 0.001:
        volatility = 0.001

    sigma_sqrt_t = volatility * math.sqrt(time_to_expiry_years)
    d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry_years) / sigma_sqrt_t
    d2 = d1 - sigma_sqrt_t
    return d1, d2


def black_scholes_call(spot: float, strike: float, time_to_expiry_years: float,
                       volatility: float, risk_free_rate: float = RISK_FREE_RATE) -> float:
    """Calculate theoretical European Call option price."""
    if time_to_expiry_years <= 0:
        return max(0.0, spot - strike)
    d1, d2 = calculate_d1_d2(spot, strike, time_to_expiry_years, volatility, risk_free_rate)
    return spot * norm.cdf(d1) - strike * math.exp(-risk_free_rate * time_to_expiry_years) * norm.cdf(d2)


def black_scholes_put(spot: float, strike: float, time_to_expiry_years: float,
                      volatility: float, risk_free_rate: float = RISK_FREE_RATE) -> float:
    """Calculate theoretical European Put option price."""
    if time_to_expiry_years <= 0:
        return max(0.0, strike - spot)
    d1, d2 = calculate_d1_d2(spot, strike, time_to_expiry_years, volatility, risk_free_rate)
    return strike * math.exp(-risk_free_rate * time_to_expiry_years) * norm.cdf(-d2) - spot * norm.cdf(-d1)


def calculate_greeks(spot: float, strike: float, time_to_expiry_years: float,
                     volatility: float, option_type: str = "call",
                     risk_free_rate: float = RISK_FREE_RATE) -> Dict[str, float]:
    """
    Calculate Greeks: Delta, Gamma, Theta (per day), Vega (per 1% IV change).
    """
    if time_to_expiry_years <= 0.0001:
        time_to_expiry_years = 0.0001
    if volatility <= 0.001:
        volatility = 0.001

    d1, d2 = calculate_d1_d2(spot, strike, time_to_expiry_years, volatility, risk_free_rate)
    pdf_d1 = norm.pdf(d1)
    sqrt_t = math.sqrt(time_to_expiry_years)

    # Gamma is identical for Call and Put
    gamma = pdf_d1 / (spot * volatility * sqrt_t)

    # Vega is identical for Call and Put (expressed per 1% change in IV)
    vega = (spot * sqrt_t * pdf_d1) / 100.0

    if option_type.lower() == "call":
        delta = norm.cdf(d1)
        # Theta per day (annualized divided by 365)
        term1 = -(spot * pdf_d1 * volatility) / (2.0 * sqrt_t)
        term2 = -risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry_years) * norm.cdf(d2)
        theta_daily = (term1 + term2) / 365.0
    else:
        delta = norm.cdf(d1) - 1.0
        term1 = -(spot * pdf_d1 * volatility) / (2.0 * sqrt_t)
        term2 = risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry_years) * norm.cdf(-d2)
        theta_daily = (term1 + term2) / 365.0

    return {
        "delta": round(float(delta), 4),
        "gamma": round(float(gamma), 6),
        "theta_daily": round(float(theta_daily), 2),
        "vega_1pct": round(float(vega), 2)
    }


def analyze_short_strangle(
    spot: float,
    put_strike: float,
    call_strike: float,
    dte_days: float,
    vix: float,
    put_entry_premium: float,
    call_entry_premium: float,
    put_current_premium: float = None,
    call_current_premium: float = None,
    lot_size: int = NIFTY_LOT_SIZE,
    lots: int = 1
) -> Dict[str, Any]:
    """
    Comprehensive quantitative analysis of a Short Strangle position on Nifty.
    """
    total_qty = lot_size * lots
    t_years = max(dte_days / 365.0, 0.0001)
    sigma = max(vix / 100.0, 0.05)

    # Calculate theoretical current prices if not provided
    if put_current_premium is None:
        put_current_premium = black_scholes_put(spot, put_strike, t_years, sigma)
    if call_current_premium is None:
        call_current_premium = black_scholes_call(spot, call_strike, t_years, sigma)

    # Breakevens based on entry premium
    initial_total_credit = put_entry_premium + call_entry_premium
    lower_breakeven = put_strike - initial_total_credit
    upper_breakeven = call_strike + initial_total_credit
    profitable_range_width = upper_breakeven - lower_breakeven

    # Max Profit (achieved if Spot expires between Put Strike and Call Strike)
    max_profit_points = initial_total_credit
    max_profit_inr = round(max_profit_points * total_qty, 2)

    # Current P&L
    current_cost_to_close = put_current_premium + call_current_premium
    unrealized_pnl_points = initial_total_credit - current_cost_to_close
    unrealized_pnl_inr = round(unrealized_pnl_points * total_qty, 2)
    theta_harvested_pct = round(max(0.0, (unrealized_pnl_points / initial_total_credit) * 100.0), 1) if initial_total_credit > 0 else 0.0

    # Individual leg Greeks
    put_greeks = calculate_greeks(spot, put_strike, t_years, sigma, "put")
    call_greeks = calculate_greeks(spot, call_strike, t_years, sigma, "call")

    # Short Strangle net Greeks:
    # Short Put: Delta is -(-|delta|) = +|delta|
    # Short Call: Delta is -(+|delta|) = -|delta|
    # Net Delta = -put_delta - call_delta
    net_delta = round((-put_greeks["delta"] - call_greeks["delta"]), 4)
    # Seller is short Gamma (negative)
    net_gamma = round((-put_greeks["gamma"] - call_greeks["gamma"]), 6)
    # Seller collects Theta (positive daily income in points)
    net_daily_theta_pts = round((-put_greeks["theta_daily"] - call_greeks["theta_daily"]), 2)
    net_daily_theta_inr = round(net_daily_theta_pts * total_qty, 2)
    # Seller is short Vega (negative)
    net_vega_pts = round((-put_greeks["vega_1pct"] - call_greeks["vega_1pct"]), 2)
    net_vega_inr = round(net_vega_pts * total_qty, 2)

    # Distances to strikes
    dist_to_put_pts = spot - put_strike
    dist_to_put_pct = round((dist_to_put_pts / spot) * 100.0, 2)
    dist_to_call_pts = call_strike - spot
    dist_to_call_pct = round((dist_to_call_pts / spot) * 100.0, 2)

    # Probability of Profit (POP)
    # P(lower_breakeven <= S_T <= upper_breakeven)
    mu = RISK_FREE_RATE - 0.5 * (sigma ** 2)
    vol_sqrt_t = sigma * math.sqrt(t_years)
    d_upper = (math.log(upper_breakeven / spot) - mu * t_years) / vol_sqrt_t
    d_lower = (math.log(lower_breakeven / spot) - mu * t_years) / vol_sqrt_t
    pop_pct = round(float(norm.cdf(d_upper) - norm.cdf(d_lower)) * 100.0, 1)
    pop_pct = min(max(pop_pct, 1.0), 99.0)

    # Gamma explosion risk score (0 to 100)
    # Gamma escalates rapidly when DTE < 7 and spot approaches either strike
    days_penalty = max(0.0, (14.0 - dte_days) / 14.0) * 50.0 if dte_days < 14 else 0.0
    min_dist_pct = min(dist_to_put_pct, dist_to_call_pct)
    proximity_penalty = max(0.0, (4.0 - min_dist_pct) / 4.0) * 50.0 if min_dist_pct < 4.0 else 0.0
    gamma_risk_score = round(min(100.0, days_penalty + proximity_penalty), 1)

    return {
        "spot": spot,
        "put_strike": put_strike,
        "call_strike": call_strike,
        "dte_days": dte_days,
        "vix": vix,
        "lot_size": lot_size,
        "lots": lots,
        "total_quantity": total_qty,
        "put_entry_premium": put_entry_premium,
        "call_entry_premium": call_entry_premium,
        "total_initial_credit_pts": initial_total_credit,
        "put_current_premium": round(put_current_premium, 2),
        "call_current_premium": round(call_current_premium, 2),
        "current_cost_to_close_pts": round(current_cost_to_close, 2),
        "unrealized_pnl_pts": round(unrealized_pnl_points, 2),
        "unrealized_pnl_inr": unrealized_pnl_inr,
        "theta_harvested_pct": theta_harvested_pct,
        "max_profit_inr": max_profit_inr,
        "lower_breakeven": round(lower_breakeven, 1),
        "upper_breakeven": round(upper_breakeven, 1),
        "profitable_range_width": round(profitable_range_width, 1),
        "dist_to_put_pts": round(dist_to_put_pts, 1),
        "dist_to_put_pct": dist_to_put_pct,
        "dist_to_call_pts": round(dist_to_call_pts, 1),
        "dist_to_call_pct": dist_to_call_pct,
        "pop_pct": pop_pct,
        "net_delta": net_delta,
        "net_gamma": net_gamma,
        "net_daily_theta_pts": net_daily_theta_pts,
        "net_daily_theta_inr": net_daily_theta_inr,
        "net_vega_pts": net_vega_pts,
        "net_vega_inr": net_vega_inr,
        "gamma_risk_score": gamma_risk_score,
        "put_greeks": put_greeks,
        "call_greeks": call_greeks
    }


def generate_payoff_curve(
    spot: float,
    put_strike: float,
    call_strike: float,
    dte_days: float,
    vix: float,
    put_entry_premium: float,
    call_entry_premium: float,
    lot_size: int = NIFTY_LOT_SIZE,
    num_points: int = 60
) -> List[Dict[str, float]]:
    """
    Generate coordinates for interactive payoff chart:
    Comparing Expiry P&L vs Current T+0 Theoretical P&L across a price spectrum.
    """
    total_credit = put_entry_premium + call_entry_premium
    min_x = put_strike * 0.90
    max_x = call_strike * 1.10
    step = (max_x - min_x) / (num_points - 1)

    t_years = max(dte_days / 365.0, 0.0001)
    sigma = max(vix / 100.0, 0.05)

    data = []
    for i in range(num_points):
        s = min_x + i * step

        # P&L at Expiry
        # Short Put payoff: -max(0, put_strike - s) + put_entry_premium
        # Short Call payoff: -max(0, s - call_strike) + call_entry_premium
        expiry_put_pnl = put_entry_premium - max(0.0, put_strike - s)
        expiry_call_pnl = call_entry_premium - max(0.0, s - call_strike)
        expiry_pnl_pts = expiry_put_pnl + expiry_call_pnl
        expiry_pnl_inr = expiry_pnl_pts * lot_size

        # P&L Today (T+0 Black-Scholes curve)
        t0_put_val = black_scholes_put(s, put_strike, t_years, sigma)
        t0_call_val = black_scholes_call(s, call_strike, t_years, sigma)
        t0_cost_to_close = t0_put_val + t0_call_val
        t0_pnl_pts = total_credit - t0_cost_to_close
        t0_pnl_inr = t0_pnl_pts * lot_size

        data.append({
            "spot": round(s, 1),
            "expiry_pnl_inr": round(expiry_pnl_inr, 1),
            "t0_pnl_inr": round(t0_pnl_inr, 1)
        })

    return data
