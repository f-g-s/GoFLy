# GoFly

*Automatisierte Flugwetter-Prüfung für Gleitschirmflieger mit Telegram-Benachrichtigung*

## Was es macht

Prüft deine Startplätze für die nächsten 5 Tage auf passende

- Windrichtung
- Windgeschwindigkeit
- maximale Böen
- Bewölkung und
- Niederschlag / Gewitter.

Wetterdaten kommen von [Open-Meteo](https://open-meteo.com/en/docs) (DWD ICON-D2 + globales Modell):

## Installation

- persönlichen Telegram-Token und Chat-ID herausfinden via Telegram-Bot (via [@BotFather](https://t.me/BotFather))
- Repo lokal einrichten

      $ npm install

- `.env` anlegen und anpassen

      TELEGRAM_TOKEN=dein_bot_token
      TELEGRAM_CHAT_ID=deine_chat_id

- GitHub einrichten:
Repository → Settings → Secrets and variables → Actions → Secrets erstellen: `TELEGRAM_TOKEN` und `TELEGRAM_CHAT_ID`

## Startplatz konfigurieren (`spots.json`)

    [
      {
        "name": "Laucha Westhang", // Startplatz
        "lat": 51.24727, // Koordinaten 
        "lon": 11.68682, 
        "windDirectionMin": 210, // Startrichtung in Grad von - bis
        "windDirectionMax": 290,
        "windSpeedMin": 10, // Windgeschwindigkeit in km/h z.B. für Soaring von - bis
        "windSpeedMax": 30
      }
    ]

## Ausführen

    # Send telegram message via CLI
    npm run script

    # Send and view results via web UI (http://localhost:5000)
    npm run dev

### Automatisierung

Prüft automatisch täglich via GitHub Actions und versendet Telegram-Nachricht (`.github/workflows/daily-check.yml`).