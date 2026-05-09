# GoFly

Automatisierte Flugwetter-Prüfung für Gleitschirmflieger – mit Telegram-Benachrichtigung.

## Was es macht

Das Script prüft für die nächsten 7 Tage die Windbedingungen an konfigurierten Spots. Wenn die Bedingungen gut sind, wird eine Telegram-Nachricht gesendet mit

- Startplatz
- Datum
- Zeitfenster
- Wind /-Richtung
- Böen

Die Wetterdaten kommen von [Open-Meteo API](https://open-meteo.com/).

## Voraussetzungen

- Node.js 18+
- Ein Telegram-Bot (erstellt via [@BotFather](https://t.me/BotFather))

## Installation

    npm install

`.env`-Datei anlegen:

    TELEGRAM_TOKEN=dein_bot_token
    TELEGRAM_CHAT_ID=deine_chat_id

## Spots konfigurieren

In `spots.json` können beliebig viele Spots eingetragen werden:

    [
        {
            "name": "Laucha Westhang",
            "lat": 51.24727,
            "lon": 11.68682,
            "windDirectionMin": 240,
            "windDirectionMax": 300,
            "windSpeedMax": 25
        }
    ]

## Ausführen

```bash
node check.js
```

Zum Testen ohne echten Telegram-Versand `DRY_RUN = true` in `check.js` lassen.

## Automatisierung

Das Script läuft automatisch täglich um **17:00 UTC** (18/19 Uhr MEZ/MESZ) via GitHub Actions (`.github/workflows/daily-check.yml`). Es kann auch manuell im GitHub-Tab „Actions" gestartet werden.

**Einmalig in GitHub einrichten:**  
Repository → Settings → Secrets and variables → Actions → folgende Secrets anlegen:

- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`
