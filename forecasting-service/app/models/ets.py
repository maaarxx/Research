# Real ETS (Exponential Smoothing) forecasting logic goes here.
#
# Planned shape (per factor: electricity, transportation, waste):
#   1. Convert historical series to a pandas Series indexed by year.
#   2. Fit statsmodels.tsa.holtwinters.ExponentialSmoothing
#      (trend='add', damped or not — decide based on the data).
#   3. Forecast the requested horizon.
#   4. Hold out the last N historical points (or use k-fold /
#      expanding-window CV) to compute MAE, RMSE, MAPE for that factor.
#
# Not implemented yet — see main.py's /forecast stub for the contract
# this module needs to satisfy.
