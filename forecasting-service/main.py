"""
Forecasting service (Python / FastAPI).

Responsibilities:
- Accept historical series from the Node.js backend
- Run separate ETS models per emission factor (electricity, transportation, waste)
- Compute MAE, RMSE, MAPE against a holdout split
- Return structured forecast JSON to the backend (React never calls this directly)
"""

from typing import Dict, List

from fastapi import FastAPI
from pydantic import BaseModel

from app.models.ets import run_ets

app = FastAPI(title="Carbon Emission Forecasting Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class ForecastRequest(BaseModel):
    dataStartPeriod: int
    dataEndPeriod: int
    forecastStartPeriod: int
    forecastEndPeriod: int
    # Historical series per factor, in chronological order
    series: Dict[str, List[float]] = {}
    # years: historical year sequence sent by the Node backend
    years: List[int] = []
    # horizon can be computed from periods or passed explicitly
    horizon: int = 0


@app.post("/forecast")
def forecast(req: ForecastRequest):
    """
    Run real ETS forecasting for each emission factor.
    Returns forecast values + MAE/RMSE/MAPE metrics.
    """
    horizon = req.horizon if req.horizon > 0 else (
        req.forecastEndPeriod - req.forecastStartPeriod + 1
    )
    if horizon < 1:
        horizon = 1

    result = run_ets(
        series_dict=req.series,
        horizon=horizon,
        years=req.years if req.years else None,
        forecast_start_period=req.forecastStartPeriod,
    )
    return result
