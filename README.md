# GoFly

*Automated weather checks for selected launch sites for paragliders, with Telegram notifications*

## What it does

Checks your launch sites for the next 5 days for suitable

- wind direction
- wind speed
- maximum gusts
- cloud cover and
- precipitation / thunderstorm risk.

Weather data is sourced from [Open-Meteo](https://open-meteo.com/en/docs) (DWD ICON-D2 + global model).

## Installation

- Get your personal Telegram token and chat ID via ([@BotFather](https://t.me/BotFather))
- Set up the repo locally

      npm install

- Create a `.env` file and fill in your credentials

      TELEGRAM_TOKEN=your_bot_token
      TELEGRAM_CHAT_ID=your_chat_id

- Set up GitHub secrets:
Repository → Settings → Secrets and variables → Actions → create secrets: `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID`

## Configuring launch sites (`spots.json`)

Launch sites are stored in `spots.json` and can be managed either manually or via the web UI (see below).

Each entry supports the following fields:

| Field | Description |
|---|---|
| `name` | Name of the launch site |
| `lat` / `lon` | GPS coordinates |
| `windDirectionMin` / `windDirectionMax` | Acceptable wind direction range in degrees (0–360) |
| `windSpeedMin` / `windSpeedMax` | Acceptable wind speed range in km/h |
| `city` | Nearest city or village |
| `state` | Federal state (Bundesland) |

Example:

    [
      {
        "name": "Laucha West Slope",
        "lat": 51.24727,
        "lon": 11.68682,
        "windDirectionMin": 210,
        "windDirectionMax": 290,
        "windSpeedMin": 10,
        "windSpeedMax": 30,
        "city": "Laucha an der Unstrut",
        "state": "Sachsen-Anhalt"
      }
    ]

## Managing launch sites via the web UI

When running locally (`npm run dev`), the web UI at `http://localhost:5000` provides a dedicated page for managing your launch sites at `/spots.html`.

### Features

- **Add a new launch site** – click *+ Neuer Startplatz* to open the form
- **Edit a launch site** – click the ✏️ button on any site card
- **Delete a launch site** – click the 🗑️ button; a confirmation dialog prevents accidental deletion

### Template search

When adding a new site, the form includes a search field that lets you quickly pre-fill the form from a built-in database of known launch sites (`all_spots.json`). The search matches against **name**, **city**, and **federal state**, so you can find a site by typing any of these.

Use the arrow keys to navigate results and Enter to apply a template. All fields can be adjusted after applying.

## Usage

- Runs automatically every day via GitHub Actions and sends matches as a Telegram message (`.github/workflows/daily-check.yml`).

- Alternatively, run locally for testing

      # Send telegram message via CLI now
      npm run script

      # Send and view results via web UI now (http://localhost:5000)
      npm run dev
