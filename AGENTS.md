# AGENTS.md

## Project Overview

GoFly is an automated weather checking service for paraglider pilots that sends Telegram notifications about suitable flying conditions.

## Key Components

- `check.js` - Main weather checking logic that fetches data from Open-Meteo and sends Telegram notifications; results are persisted to Supabase
- `server.js` - Web server with REST API for managing launch sites (backed by Supabase) and endpoints to execute check.js
- `public/` - Static web UI (HTML/CSS) served by the Express server
- `public/all_spots.json` - Reference list of all known launch sites (read-only reference data)
- `dhvgelaende_kml_de.kml` - DHV launch site geodata (KML format, reference data)
- `.env` - Environment variables for Telegram and Supabase credentials

## Execution Commands

- `npm run script` - Run the main check script to send Telegram messages
- `npm run dev` - Start the development server with web UI at http://localhost:5000

## GitHub Actions

- Runs daily at 17:00 UTC via `.github/workflows/daily-check.yml`
- Uses Node.js 24 on ubuntu-latest
- Environment variables are set via GitHub secrets (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)

## Important Notes

- The application requires valid Telegram and Supabase credentials in `.env`
- Launch sites are stored in the Supabase `spots` table (not a local JSON file)
- Check results are persisted to the Supabase `check_results` table (upserted as a single row with id=1)
- The server provides a web UI at `http://localhost:5000` when running with `npm run dev`
- Development server runs on port 5000
- Uses `npm ci` in GitHub Actions for dependency installation

## Web UI

- Web UI available at `http://localhost:5000` when running with `npm run dev`
- Includes CRUD operations for managing launch sites (backed by Supabase REST API)
- Live reload via SSE (`/livereload` endpoint) watches `.js`, `.html`, `.css` files
- Real-time streaming execution of check script via SSE (`/run` endpoint)

## REST API Endpoints

- `GET /api/spots` - List all launch sites (ordered by `created_at`)
- `POST /api/spots` - Create a new launch site
- `PUT /api/spots/:id` - Update a launch site
- `DELETE /api/spots/:id` - Delete a launch site
- `GET /api/results` - Get the latest check results from Supabase
- `GET /run` - SSE stream: execute `check.js` and stream stdout/stderr to browser
- `GET /livereload` - SSE stream for browser live-reload

## Weather Data Source

- Open-Meteo API: DWD ICON-D2 model for the first 2 days, global model for days 3–4; both are merged per hour
- Retrieves data for the next 4 days (daylight hours only, between sunrise and sunset)
- Parameters: wind speed (80 m), wind direction (80 m), wind gusts (10 m), precipitation, precipitation probability, weather code, CAPE, cloud cover, visibility, Lifted Index

## Flying Conditions Logic

- Wind direction must be within the configured range (supports wrap-around, e.g. 330°–30°)
- Wind speed must be within `windSpeedMin`–`windSpeedMax`
- Wind gusts ≤ wind speed + 10 km/h and ≤ 35 km/h absolute
- If any hour in the day has gusts > 40 km/h the entire day is discarded
- CAPE < 1000 J/kg (atmospheric stability)
- Lifted Index > 0 (no convective instability)
- Precipitation probability ≤ 20 %
- Good hours are grouped into stable wind-direction blocks (max. 10° spread within a block)

## Supabase Schema

### `spots` table
Required fields: `name`, `lat`, `lon`, `windDirectionMin`, `windDirectionMax`, `windSpeedMin`, `windSpeedMax`

### `check_results` table
Single row (id=1) with `messages` (array), `updated_at` (timestamp)

## Environment Requirements

- Node.js v24 (as per GitHub Actions)
- `.env` file with:
  - `TELEGRAM_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `DEBUG` (optional, set to `"true"` for verbose logging)
- ES modules (`"type": "module"` in package.json)