import "dotenv/config";
import { readFileSync } from "fs";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const spots = JSON.parse(readFileSync("./spots.json", "utf-8"));

const DRY_RUN = false; // auf false setzen für echten Versand

function isWindDirectionOk(direction, min, max) {
  // Handle wrap-around (e.g. 350°–10°)
  if (min <= max) {
    return direction >= min && direction <= max;
  } else {
    return direction >= min || direction <= max;
  }
}

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=windspeed_10m,winddirection_10m,windgusts_10m` +
    `&daily=sunrise,sunset` +
    `&windspeed_unit=kmh` +
    `&forecast_days=7` +
    `&timezone=Europe%2FBerlin`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

function getHoursForDate(data, dateStr) {
  const times = data.hourly.time;

  const dayIndex = data.daily.time.indexOf(dateStr);
  if (dayIndex === -1) return [];
  const sunrise = new Date(data.daily.sunrise[dayIndex]);
  const sunset = new Date(data.daily.sunset[dayIndex]);

  const windowStart = sunrise.getHours();
  const windowEnd = sunset.getHours();

  const result = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (!t.startsWith(dateStr)) continue;
    const hour = parseInt(t.slice(11, 13));
    if (hour < windowStart || hour > windowEnd) continue;
    result.push({
      time: t,
      hour,
      windSpeed: data.hourly.windspeed_10m[i],
      windDirection: data.hourly.winddirection_10m[i],
      windGusts: data.hourly.windgusts_10m[i],
    });
  }
  console.log(`=== Rohdaten Stunden (${dateStr}, Fenster ${windowStart}–${windowEnd} Uhr) ===`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function getCompassDir(deg) {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function checkSpot(spot, hours) {
  const goodHours = hours.filter(
    (h) =>
      isWindDirectionOk(h.windDirection, spot.windDirectionMin, spot.windDirectionMax) &&
      h.windSpeed <= spot.windSpeedMax &&
      h.windGusts <= spot.windSpeedMax * 1.3
  );
  console.log(`=== ${spot.name}: ${goodHours.length} von ${hours.length} Stunden gut ===`);
  console.log(JSON.stringify(goodHours, null, 2));
  return goodHours;
}

async function sendTelegram(message) {
  console.log("=== Telegram-Nachricht ===");
  console.log(message);
  if (DRY_RUN) {
    console.log("[DRY RUN] Kein Versand.");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram error: ${res.status} – ${body}`);
  }
}

async function main() {
  const messages = [];

  for (const spot of spots) {
    const data = await getWeather(spot.lat, spot.lon);

    for (let offset = 0; offset < 7; offset++) {
      const day = new Date();
      day.setDate(day.getDate() + offset);
      const dateStr = day.toISOString().slice(0, 10);
      const dateLabel = day.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      const hours = getHoursForDate(data, dateStr);
      const goodHours = checkSpot(spot, hours);

      if (goodHours.length === 0) continue;

      const hourLabels = (() => {
        const ranges = [];
        let start = goodHours[0].hour;
        let end = goodHours[0].hour;
        for (let i = 1; i < goodHours.length; i++) {
          if (goodHours[i].hour === end + 1) {
            end = goodHours[i].hour;
          } else {
            ranges.push(start === end ? `${start}:00 Uhr` : `${start}–${end} Uhr`);
            start = end = goodHours[i].hour;
          }
        }
        ranges.push(start === end ? `${start}:00 Uhr` : `${start}–${end} Uhr`);
        return ranges.join(", ");
      })();
      const avgWind = Math.round(
        goodHours.reduce((s, h) => s + h.windSpeed, 0) / goodHours.length
      );
      const avgDir = Math.round(
        goodHours.reduce((s, h) => s + h.windDirection, 0) / goodHours.length
      );

      messages.push(
        `🪂 <b>${spot.name}</b>\n` +
          `📅 ${dateLabel}\n` +
          `🕐 Gute Fenster: ${hourLabels}\n` +
          `💨 Wind: Ø ${avgWind} km/h aus ${getCompassDir(avgDir)}\n` +
          `🌬️ Böen: bis ${Math.round(
            goodHours.reduce((s, h) => s + h.windGusts, 0) / goodHours.length
          )} km/h\n`
      );
    }
  }

  if (messages.length > 0) {
    await sendTelegram(messages.join("\n\n"));
    console.log("Nachricht gesendet.");
  } else {
    console.log("Keine geeigneten Bedingungen in den nächsten 7 Tagen – keine Nachricht gesendet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});