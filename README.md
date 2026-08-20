# School Carbon Emission Monitoring & Forecasting System

Automated web app for uploading historical school carbon-emission data
(electricity, transportation, waste), forecasting future emissions with
separate ETS models per source, evaluating accuracy (MAE/RMSE/MAPE), and
visualizing/reporting results.

## Architecture

```
React (Vite + TS + Tailwind)
        │  HTTP/JSON
        ▼
Node.js / Express (TS)  ──────►  Supabase PostgreSQL + Auth
        │  HTTP/JSON
        ▼
Python FastAPI (ETS forecasting + MAE/RMSE/MAPE)
```

React never talks to the Python service directly — Node is the
orchestration layer.

## Repo layout

```
carbon-emissions-app/
  frontend/              React + Vite + TS + Tailwind
  backend/                Node + Express + TS API
  forecasting-service/    Python FastAPI (ETS models)
```

## Current status — Phase 1–3 scaffold (~10%)

What's here so far:
- [x] Frontend scaffold: Vite + React + TS + Tailwind, sidebar layout,
      routing shell (Login, Dashboard placeholder pages)
- [x] Backend scaffold: Express + TS server, route stubs for
      emissions and forecast endpoints, Supabase client wiring
- [x] Forecasting service scaffold: FastAPI app with `/health` and a
      stub `/forecast` endpoint returning the JSON shape the spec
      defines (no real ETS logic yet)
- [ ] Supabase schema / migrations (not created yet)
- [ ] CSV/Excel upload + validation
- [ ] Real ETS forecasting logic
- [ ] MAE/RMSE/MAPE evaluation
- [ ] Dashboard charts wired to real data
- [ ] Reports

## Setup

### 1. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in Supabase URL/keys + Python service URL
npm run dev
```

### 3. Forecasting service
```bash
cd forecasting-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Next steps (in order)
1. Create Supabase project, run schema (users/emission_records/
   forecast_runs/forecast_results/forecast_metrics), wire Supabase Auth
   into the frontend Login page.
2. Build the Emission Data upload page + backend validation
   (`POST /api/emissions/upload`) — CSV/Excel parsing, column/value
   validation, preview, confirm, save.
3. Wire Dashboard cards + charts (Recharts) to real
   `GET /api/emissions/summary` / `/trends` data.
4. Implement real ETS models in `forecasting-service/app/` (per
   factor: electricity, transportation, waste) and MAE/RMSE/MAPE.
5. Connect Node → Python (`POST /forecast`) and persist results.
6. Build Forecast, Analytics, Model Accuracy, Reports pages.
