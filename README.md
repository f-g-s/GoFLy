# GoFly

*Automated flying weather check for paraglider pilots with Telegram notifications*

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

    [
      {
        "name": "Laucha West Slope", // launch site name
        "lat": 51.24727,             // coordinates
        "lon": 11.68682,
        "windDirectionMin": 210,     // wind direction range in degrees
        "windDirectionMax": 290,
        "windSpeedMin": 10,          // wind speed in km/h, e.g. for soaring
        "windSpeedMax": 30
      }
    ]

## Usage

- Runs automatically every day via GitHub Actions and sends matches as a Telegram message (`.github/workflows/daily-check.yml`).

- Alternatively, run locally for testing

      # Send telegram message via CLI now
      npm run script

      # Send and view results via web UI now (http://localhost:5000)
      npm run dev