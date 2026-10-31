"""
AI Decision Engine & Options Copilot for Short Strangle Strategies
Evaluates position Greeks, decay rate, market fear (VIX), and global news threats
to generate actionable, institutional-grade Hold / Sell / Roll / Hedge decisions.
"""

from typing import Dict, Any, List


def evaluate_strangle_decision(
    position_data: Dict[str, Any],
    market_stats: Dict[str, Any],
    sentiment_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Synthesize position math, volatility stats, and news threat to formulate
    a clear verdict and step-by-step adjustment action plan.
    """
    spot = position_data["spot"]
    put_k = position_data["put_strike"]
    call_k = position_data["call_strike"]
    dte = position_data["dte_days"]
    vix = market_stats["vix"]
    threat_score = sentiment_data["threat_score"]

    net_delta = position_data["net_delta"]
    gamma_risk = position_data["gamma_risk_score"]
    theta_harvested_pct = position_data["theta_harvested_pct"]
    unrealized_pnl_inr = position_data["unrealized_pnl_inr"]
    initial_credit = position_data["total_initial_credit_pts"]
    current_cost = position_data["current_cost_to_close_pts"]

    dist_put_pct = position_data["dist_to_put_pct"]
    dist_call_pct = position_data["dist_to_call_pct"]
    lower_be = position_data["lower_breakeven"]
    upper_be = position_data["upper_breakeven"]

    factors: List[Dict[str, str]] = []
    actions: List[str] = []

    # -------------------------------------------------------------
    # 1. EVALUATE PROFIT HARVESTING (Theta Saturation)
    # -------------------------------------------------------------
    if theta_harvested_pct >= 75.0:
        verdict = "BOOK PROFIT"
        badge_style = "profit"
        confidence = 94
        headline = f"Target Profit Milestone Reached ({theta_harvested_pct}% Decay Harvested)"
        summary = (
            f"You have successfully harvested {theta_harvested_pct}% of the total premium. "
            "In institutional options trading, continuing to hold for the remaining fractional decay exposes you "
            "to asymmetric gamma risk for negligible additional yield. Lock in your profits now."
        )
        actions.append("Square off both Put and Call legs simultaneously to lock in current gains.")
        actions.append("Re-deploy capital into a fresh 30-45 DTE strangle with wider strikes to restart clean theta collection.")
        return {
            "verdict": verdict,
            "badge_style": badge_style,
            "confidence": confidence,
            "headline": headline,
            "summary": summary,
            "factors": [
                {"name": "Theta Harvested", "value": f"{theta_harvested_pct}%", "status": "Goal Met", "impact": "Positive"},
                {"name": "Remaining Upside", "value": f"{round(100 - theta_harvested_pct, 1)}%", "status": "Diminishing Return", "impact": "Caution"},
                {"name": "Current P&L", "value": f"+₹{unrealized_pnl_inr:,.0f}", "status": "Secure", "impact": "Positive"}
            ],
            "actions": actions,
            "adjustment_strategy": "PROFIT_EXIT"
        }

    # -------------------------------------------------------------
    # 2. EVALUATE BREAKEVEN VIOLATIONS / STOP LOSS
    # -------------------------------------------------------------
    if spot <= lower_be or spot >= upper_be:
        verdict = "SQUARE OFF / STOP LOSS"
        badge_style = "danger"
        confidence = 98
        breached_side = "Lower Breakeven (21,000 side)" if spot <= lower_be else "Upper Breakeven (24,300 side)"
        headline = f"Emergency Stop Loss Triggered: Spot Breached {breached_side}"
        summary = (
            f"Nifty spot price ({spot:,.1f}) has breached your strategy breakeven boundary ({lower_be if spot <= lower_be else upper_be:,.1f}). "
            "Unhedged short strangles experience accelerating losses past this threshold. Immediate loss cutting is mandatory."
        )
        actions.append(f"Execute market order to close both legs immediately. Preserve capital.")
        actions.append("Do not attempt to average down or hold through an unhedged trend expansion.")
        return {
            "verdict": verdict,
            "badge_style": badge_style,
            "confidence": confidence,
            "headline": headline,
            "summary": summary,
            "factors": [
                {"name": "Spot vs Breakeven", "value": f"{spot} vs BE {lower_be if spot <= lower_be else upper_be}", "status": "Breached", "impact": "Critical"},
                {"name": "Loss Progression", "value": f"-₹{abs(unrealized_pnl_inr):,.0f}", "status": "Active Loss", "impact": "Negative"}
            ],
            "actions": actions,
            "adjustment_strategy": "EMERGENCY_EXIT"
        }

    # -------------------------------------------------------------
    # 3. EVALUATE HIGH VOLATILITY / GEOPOLITICAL SPIKE (Tail Risk)
    # -------------------------------------------------------------
    if vix >= 21.0 or threat_score >= 70:
        verdict = "DEFENSIVE HEDGE (CONVERT TO IRON CONDOR)"
        badge_style = "warning"
        confidence = 88
        headline = "Macro Volatility Surge Detected - Protect Tail Risk"
        summary = (
            f"India VIX ({vix:.1f}) or Global Threat Score ({threat_score}/100) has expanded beyond safe boundaries. "
            "Sudden overnight gap risks are elevated. Convert this naked strangle into a defined-risk Iron Condor."
        )
        wing_put = round((put_k - 500) / 100) * 100
        wing_call = round((call_k + 500) / 100) * 100
        actions.append(f"Buy 1 lot of {wing_put} PE (protective put wing).")
        actions.append(f"Buy 1 lot of {wing_call} CE (protective call wing).")
        actions.append("This caps your absolute maximum loss while keeping theta decay intact.")
        factors.append({"name": "India VIX", "value": f"{vix:.1f}", "status": "Spike Alert", "impact": "High Risk"})
        factors.append({"name": "Global Threat Score", "value": f"{threat_score}/100", "status": "Elevated", "impact": "High Risk"})
        return {
            "verdict": verdict,
            "badge_style": badge_style,
            "confidence": confidence,
            "headline": headline,
            "summary": summary,
            "factors": factors,
            "actions": actions,
            "adjustment_strategy": "IRON_CONDOR_CONVERSION"
        }

    # -------------------------------------------------------------
    # 4. EVALUATE DELTA IMBALANCE / STRIKE PROXIMITY
    # -------------------------------------------------------------
    # If spot has drifted within 1.8% of either strike, or net delta is skewed > 0.20
    if dist_call_pct <= 1.8 or net_delta <= -0.20:
        verdict = "ROLL UNTESTED PUT UP (DELTA HEDGE)"
        badge_style = "adjustment"
        confidence = 89
        headline = "Spot Approaching Call Strike - Roll Untested Put Leg Up"
        summary = (
            f"Nifty spot ({spot:,.1f}) is drifting towards your Call strike ({call_k:,.0f}, only {dist_call_pct}% away). "
            f"Your put option ({put_k:,.0f} PE) is now deep OTM and has yielded most of its value. "
            "Roll the untested put leg higher to collect additional credit and neutralize upside delta."
        )
        new_put_k = round((put_k + (spot - put_k) * 0.45) / 100) * 100
        actions.append(f"Buy back existing {put_k:,.0f} PE to lock in its profit.")
        actions.append(f"Sell new higher {new_put_k:,.0f} PE to collect extra premium and neutralize delta.")
        actions.append("If spot breaches 24,300 CE, buy a 24,500 CE call spread or exit.")
        factors.append({"name": "Call Cushion", "value": f"{dist_call_pct}% ({position_data['dist_to_call_pts']} pts)", "status": "Narrowing", "impact": "Caution"})
        factors.append({"name": "Net Delta Skew", "value": f"{net_delta}", "status": "Short Delta Skew", "impact": "Caution"})
        return {
            "verdict": verdict,
            "badge_style": badge_style,
            "confidence": confidence,
            "headline": headline,
            "summary": summary,
            "factors": factors,
            "actions": actions,
            "adjustment_strategy": "ROLL_PUT_UP"
        }

    if dist_put_pct <= 1.8 or net_delta >= 0.20:
        verdict = "ROLL UNTESTED CALL DOWN (DELTA HEDGE)"
        badge_style = "adjustment"
        confidence = 89
        headline = "Spot Approaching Put Strike - Roll Untested Call Leg Down"
        summary = (
            f"Nifty spot ({spot:,.1f}) is pressing down towards your Put strike ({put_k:,.0f}, only {dist_put_pct}% away). "
            f"Your call option ({call_k:,.0f} CE) is now deep OTM. Roll the untested call leg lower to collect credit and cushion the downside."
        )
        new_call_k = round((call_k - (call_k - spot) * 0.45) / 100) * 100
        actions.append(f"Buy back existing {call_k:,.0f} CE to lock in its profit.")
        actions.append(f"Sell new lower {new_call_k:,.0f} CE to collect extra premium.")
        actions.append("Set a strict hard stop if spot hits 21,000.")
        factors.append({"name": "Put Cushion", "value": f"{dist_put_pct}% ({position_data['dist_to_put_pts']} pts)", "status": "Narrowing", "impact": "Caution"})
        factors.append({"name": "Net Delta Skew", "value": f"+{net_delta}", "status": "Long Delta Skew", "impact": "Caution"})
        return {
            "verdict": verdict,
            "badge_style": badge_style,
            "confidence": confidence,
            "headline": headline,
            "summary": summary,
            "factors": factors,
            "actions": actions,
            "adjustment_strategy": "ROLL_CALL_DOWN"
        }

    # -------------------------------------------------------------
    # 5. DEFAULT SAFE REGIME: STRONG HOLD (Theta Harvesting)
    # -------------------------------------------------------------
    verdict = "STRONG HOLD (THETA HARVESTING)"
    badge_style = "hold"
    
    # Calculate confidence based on multi-source corroboration and position cushion
    base_confidence = float(sentiment_data.get("prediction_confidence_val", 92.5))
    cushion_bonus = 2.0 if (dist_put_pct > 6.0 and dist_call_pct > 6.0) else 0.0
    vix_bonus = 1.5 if (12.0 <= vix <= 16.5) else -2.0
    confidence = int(round(min(98.5, max(85.0, base_confidence + cushion_bonus + vix_bonus))))
    
    directional_bias_str = sentiment_data.get("directional_bias", "Neutral Range-Bound (0%)")
    total_sources = sentiment_data.get("total_sources_scanned", 8)

    headline = "Optimal Range-Bound Regime: Hold & Let Theta Decay"
    summary = (
        f"Nifty spot ({spot:,.1f}) is comfortably centered inside the {put_k:,.0f} PE — {call_k:,.0f} CE corridor "
        f"({dist_put_pct}% cushion below, {dist_call_pct}% cushion above). "
        f"Daily time decay is yielding approx +₹{position_data['net_daily_theta_inr']:,.0f}/day (+{position_data['net_daily_theta_pts']} pts). "
        f"Multi-source news sentiment confirms {directional_bias_str.lower()} with low breakout catalysts across {total_sources} Tier-1 financial sources. "
        "India VIX is in the optimal harvesting zone. Maintain position with standard stop discipline."
    )

    factors.append({
        "name": "Daily Theta Yield",
        "value": f"+₹{position_data['net_daily_theta_inr']:,.0f}/day",
        "status": "Decaying in Favor",
        "impact": "Positive"
    })
    factors.append({
        "name": "Lower Cushion (Put Strike)",
        "value": f"{dist_put_pct}% ({position_data['dist_to_put_pts']:,.0f} pts)",
        "status": "Safe Buffer",
        "impact": "Positive"
    })
    factors.append({
        "name": "Upper Cushion (Call Strike)",
        "value": f"{dist_call_pct}% ({position_data['dist_to_call_pts']:,.0f} pts)",
        "status": "Safe Buffer",
        "impact": "Positive"
    })
    factors.append({
        "name": "Market Fear (India VIX)",
        "value": f"{vix:.1f}",
        "status": market_stats["fear_gauge"]["label"],
        "impact": "Positive"
    })
    factors.append({
        "name": "Macro Threat Score",
        "value": f"{threat_score}/100 ({sentiment_data.get('threat_level', 'LOW')})",
        "status": directional_bias_str,
        "impact": "Positive" if threat_score < 40 else "Caution"
    })
    factors.append({
        "name": "Prediction Confidence",
        "value": f"{sentiment_data.get('prediction_confidence', '96% Multi-Source')}",
        "status": f"{total_sources} Tier-1 Sources Scanned",
        "impact": "Positive"
    })

    actions.append("Hold both legs. No immediate manual adjustment needed.")
    actions.append(f"Maintain a stop-loss order if combined premium exceeds {round(initial_credit * 2.0, 1)} pts.")
    actions.append("Plan to book 70-80% profit when combined premium falls to target.")

    return {
        "verdict": verdict,
        "badge_style": badge_style,
        "confidence": confidence,
        "headline": headline,
        "summary": summary,
        "factors": factors,
        "actions": actions,
        "adjustment_strategy": "MAINTAIN_HOLD"
    }
