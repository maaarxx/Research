"""
Real ETS (Exponential Smoothing) forecasting logic.

Fits statsmodels.tsa.holtwinters.ExponentialSmoothing separately per
emission factor (electricity, transportation, waste).

Evaluation strategy:
- Hold out the last `holdout_size` points (default: min(3, n//3), at least 1).
- Fit on train split, forecast holdout length, compute MAE/RMSE/MAPE.
- Refit on the full series and produce the real forecast.
"""

from typing import Dict, List, Optional

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing


def forecast_factor(
    series: List[float],
    horizon: int,
    holdout_size: Optional[int] = None,
) -> Dict:
    """
    Fit ETS on a single historical series, evaluate on holdout, forecast.

    Args:
        series:       Historical values in chronological order.
        horizon:      Number of future periods to forecast.
        holdout_size: Override the automatic holdout split size.

    Returns::
        {
          "forecast": [float, ...],  # length == horizon
          "mae":  float | None,
          "rmse": float | None,
          "mape": float | None,
        }
    """
    arr = np.array(series, dtype=float)
    n = len(arr)

    # ── Edge case: too little data ──────────────────────────────────────────
    if n == 0:
        return {"forecast": [0.0] * horizon, "mae": None, "rmse": None, "mape": None}
    if n == 1:
        return {
            "forecast": [float(arr[0])] * horizon,
            "mae": None,
            "rmse": None,
            "mape": None,
        }

    # ── Holdout split ───────────────────────────────────────────────────────
    if holdout_size is None:
        holdout_size = max(1, min(3, n // 3))

    train_arr = arr[:-holdout_size]
    holdout_arr = arr[-holdout_size:]

    mae, rmse, mape = None, None, None

    if len(train_arr) >= 2:
        try:
            use_damping = len(train_arr) >= 4
            holdout_model = ExponentialSmoothing(
                train_arr,
                trend="add",
                damped_trend=use_damping,
                initialization_method="estimated",
            )
            holdout_fit = holdout_model.fit(optimized=True)
            holdout_pred = holdout_fit.forecast(holdout_size)

            residuals = holdout_pred - holdout_arr
            mae = float(np.mean(np.abs(residuals)))
            rmse = float(np.sqrt(np.mean(residuals**2)))

            # MAPE: skip zeros to avoid division by zero
            nonzero = holdout_arr != 0
            if nonzero.any():
                mape = float(
                    np.mean(np.abs(residuals[nonzero] / holdout_arr[nonzero])) * 100
                )
        except Exception:
            pass  # leave metrics as None

    # ── Full-series forecast ────────────────────────────────────────────────
    try:
        use_damping_full = n >= 4
        full_model = ExponentialSmoothing(
            arr,
            trend="add",
            damped_trend=use_damping_full,
            initialization_method="estimated",
        )
        full_fit = full_model.fit(optimized=True)
        forecast_values = list(map(float, full_fit.forecast(horizon)))
    except Exception:
        # Fallback: linear extrapolation from last two points
        if n >= 2:
            slope = float(arr[-1] - arr[-2])
            forecast_values = [float(arr[-1]) + slope * (i + 1) for i in range(horizon)]
        else:
            forecast_values = [float(arr[-1])] * horizon

    return {
        "forecast": forecast_values,
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
    }


def run_ets(
    series_dict: Dict[str, List[float]],
    horizon: int,
    years: Optional[List[int]] = None,
    forecast_start_period: Optional[int] = None,
) -> Dict:
    """
    Run ETS forecasting independently for each emission factor.

    Args:
        series_dict:           {"electricity": [...], "transportation": [...], "waste": [...]}
        horizon:               Forecast horizon (number of future periods).
        years:                 Historical year sequence; used to derive forecast_years.
        forecast_start_period: First forecast year if `years` is not provided.

    Returns::
        {
            "forecast": {
                "electricity":   [float, ...],
                "transportation": [float, ...],
                "waste":         [float, ...],
                "total":         [float, ...],
                "years":         [int, ...],
            },
            "metrics": {
                "electricity":   {"mae": float|None, "rmse": float|None, "mape": float|None},
                "transportation": {...},
                "waste":          {...},
            },
        }
    """
    factors = ["electricity", "transportation", "waste"]
    results: Dict[str, Dict] = {}

    for factor in factors:
        series = series_dict.get(factor, [])
        results[factor] = forecast_factor(series, horizon)

    # Total = sum of per-factor forecasts at each step
    total_forecast = [
        sum(results[f]["forecast"][i] if i < len(results[f]["forecast"]) else 0.0
            for f in factors)
        for i in range(horizon)
    ]

    # Derive forecast years
    if years and len(years) > 0:
        last_year = int(years[-1])
        forecast_years = list(range(last_year + 1, last_year + horizon + 1))
    elif forecast_start_period is not None:
        forecast_years = list(range(forecast_start_period, forecast_start_period + horizon))
    else:
        forecast_years = list(range(1, horizon + 1))

    return {
        "forecast": {
            "electricity": results["electricity"]["forecast"],
            "transportation": results["transportation"]["forecast"],
            "waste": results["waste"]["forecast"],
            "total": total_forecast,
            "years": forecast_years,
        },
        "metrics": {
            factor: {
                "mae": results[factor]["mae"],
                "rmse": results[factor]["rmse"],
                "mape": results[factor]["mape"],
            }
            for factor in factors
        },
    }
