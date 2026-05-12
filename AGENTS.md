# AGENTS.md

## Project Overview

GoFly is an automated weather checking service for paraglider pilots that sends Telegram notifications about suitable flying conditions.

## Key Components

- `check.js` - Main weather checking logic that fetches data from Open-Meteo and sends Telegram notifications
- `server.js` - Web server with REST API for managing launch sites and a /run endpoint to execute check.js
- `spots.json` - Configuration file storing launch site data
- `.env` - Environment variables for Telegram credentials

## Execution Commands

- `npm run script` - Run the main check script to send Telegram messages
- `npm run dev` - Start the development server with web UI at http://localhost:5000

## GitHub Actions

- Runs daily at 17:00 UTC via `.github/workflows/daily-check.yml`
- Uses Node.js 24 on ubuntu-latest
- Environment variables are set via GitHub secrets

## Important Notes

- The application requires valid Telegram API credentials in `.env`
- Launch sites are stored in `spots.json` with specific wind direction and speed parameters
- The server provides a web UI at `http://localhost:5000` when running with `npm run dev`
- Development server runs on port 5000
- Uses `npm ci` in GitHub Actions for dependency installation

## Web UI

- Web UI available at `http://localhost:5000` when running with `npm run dev`
- Includes CRUD operations for managing launch sites
- Live reload functionality
- Real-time execution of check script

## Weather Data Source

- Open-Meteo API (DWD ICON-D2 + global model)
- Retrieves data for the next 5 days
- Processes wind direction, speed, gusts, cloud cover, and precipitation

## Configuration

- `spots.json` contains GPS coordinates and wind parameters for each launch site
- Required fields: `name`, `lat`, `lon`, `windDirectionMin`, `windDirectionMax`, `windSpeedMin`, `windSpeedMax`, `city`, `state`

## Environment Requirements

- Node.js v24 (as per GitHub Actions)
- `.env` file with `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID`