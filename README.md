# GoFly

*Automated weather checks for paraglider launch sites with Telegram notifications and a web-based spot manager.*

## What it does

Checks your launch sites for the next 5 days for suitable flying conditions:

- Wind direction
- Wind speed
- Maximum gusts
- Cloud cover
- Precipitation / thunderstorm risk

Weather data is sourced from [Open-Meteo](https://open-meteo.com/en/docs) (DWD ICON-D2 + global model). Matching days are sent as a Telegram message.

## Tech Stack

- **Node.js** – weather check script (`check.js`) and Express web server (`server.js`)
- **Supabase** – stores user-defined weather alerts / spots (`spots` table)
- **Leaflet** – interactive map in the web UI
- **GitHub Actions** – runs the weather check daily at 17:00 UTC

## Installation

1. Get your Telegram bot token and chat ID via [@BotFather](https://t.me/BotFather)
2. Set up the repo locally:

       npm install

3. Create a `.env` file with your credentials:

       TELEGRAM_TOKEN=your_bot_token
       TELEGRAM_CHAT_ID=your_chat_id
       SUPABASE_URL=your_supabase_url
       SUPABASE_ANON_KEY=your_supabase_anon_key

4. Set up GitHub secrets:  
   Repository → Settings → Secrets and variables → Actions → create secrets:  
   `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Web UI

Start the development server:

    npm run dev

Then open **http://localhost:5000** in your browser.

### Spot management (`/spots.html`)

The spot manager lets you configure which launch sites to monitor. It features:

- **Interactive map** (Leaflet) showing two layers:
  - 🔘 **Grey markers** – 800+ known launch sites from the built-in DHV database (`all_spots.json`). Hover or click to see site details and a button to add a weather alert.
  - 🔵 **Blue markers** – your saved weather alert spots from Supabase. Click to zoom in and show a popup.
- **Spot cards** – list of your active alerts in the sidebar. Click to fly to the location on the map.
- **Add / Edit / Delete** alerts via a modal form.
- **Wind direction compass** – interactive 16-sector SVG rose (N, NNO, NO, … NNW) to visually select the acceptable wind direction range. Synced bidirectionally with the degree inputs.
- **Template search** – search the built-in DHV database by name, city, or federal state to pre-fill the form. Navigate with arrow keys, confirm with Enter.
- **Verified badge** – spots manually reviewed for accuracy show a ✔ geprüft badge.

### Spot fields

| Field | Description |
|---|---|
| `name` | Name of the launch site |
| `lat` / `lon` | GPS coordinates |
| `windDirectionMin` / `windDirectionMax` | Acceptable wind direction range in degrees (0–360, supports wrap-around e.g. 315°–45°) |
| `windSpeedMin` / `windSpeedMax` | Acceptable wind speed range in km/h |
| `city` | Nearest city or village |
| `state` | Federal state (Bundesland) |
| `verified` | Whether the data has been manually checked |

## Usage

- Runs automatically every day via GitHub Actions and sends matches as a Telegram message (`.github/workflows/daily-check.yml`).

- Alternatively, run locally for testing:

      # Send Telegram message now
      npm run script

      # Start web UI at http://localhost:5000
      npm run dev