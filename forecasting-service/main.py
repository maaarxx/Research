"""
Forecasting service (Python / FastAPI).

Responsibilities (per project spec):
- data preparation for forecasting
- separate ETS models per emission factor (electricity, transportation, waste)
- forecast evaluation (MAE, RMSE, MAPE)
- returning structured JSON to the Node.js backend

Node.js is the only caller of this service — the React frontend never
talks to it directly.
"""

from typing import Dict, List

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Carbon Emission Forecasting Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class ForecastRequest(BaseModel):
    dataStartPeriod: str
    dataEndPeriod: str
    forecastStartPeriod: str
    forecastEndPeriod: str
    # series will hold historical values per factor, e.g.
    # {"electricity": [...], "transportation": [...], "waste": [...]}
    series: Dict[str, List[float]] = {}


@app.post("/forecast")
def forecast(req: ForecastRequest):
    """
    STUB — does not run ETS yet. Returns the JSON shape defined in the
    spec (section 10) with null values, so the Node <-> Python contract
    can be wired and tested end-to-end before the real model is built.

    Next step: implement app/models/ets.py — run
    statsmodels.tsa.holtwinters.ExponentialSmoothing separately per
    factor, then compute MAE/RMSE/MAPE against a holdout split.
    """
    factors = ["electricity", "transportation", "waste"]
    return {
        "forecast": {factor: [] for factor in factors} | {"total": []},
        "metrics": {
            factor: {"mae": None, "rmse": None, "mape": None} for factor in factors
        },
        "note": "Stub response — real ETS forecasting not implemented yet.",
    }
