# GoFly

Automatisierte Flugwetter-Prüfung für Gleitschirmflieger mit Telegram-Benachrichtigung.

<img width="562" height="466" alt="image" src="https://github.com/user-attachments/assets/1eeddeff-264c-4121-a4c9-04c593b267b6" />

## Was es macht

Prüft für die nächsten 7 Tage die Wetterbedingungen an konfigurierten Spots und zeigt geeignete Zeitfenster an. 

- Windrichtung
- Windgeschwindigkeit
- Böen
- Niederschlag / Gewitter

Wetterdaten kommen von [Open-Meteo](https://open-meteo.com/) (DWD ICON-D2 + globales Modell):

## Voraussetzungen

- Node.js 18+
- Telegram-Bot (via [@BotFather](https://t.me/BotFather))

## Installation

```bash
npm install
```

`.env` anlegen:

```
TELEGRAM_TOKEN=dein_bot_token
TELEGRAM_CHAT_ID=deine_chat_id
```

**In GitHub einrichten:**  
Repository → Settings → Secrets and variables → Actions → folgende Secrets anlegen:

- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`

## Spots konfigurieren (`spots.json`)

```json
[
  {
    "name": "Laucha Westhang",
    "lat": 51.24727,
    "lon": 11.68682,
    "windDirectionMin": 210,
    "windDirectionMax": 290,
    "windSpeedMin": 10, // soaring
    "windSpeedMax": 30
  }
]
```

## Ausführen

```bash
# Web (http://localhost:5000)
npm run dev

# CLI
node check.js
```

## Automatisierung

Prüft automatisch täglich via GitHub Actions und versendet Telegram-Nachricht (`.github/workflows/daily-check.yml`).


