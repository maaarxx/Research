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
