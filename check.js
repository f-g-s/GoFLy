import "dotenv/config";
import { readFileSync } from "fs";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const spots = JSON.parse(readFileSync("./spots.json", "utf-8"));

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
    `&forecast_days=2` +
    `&timezone=Europe%2FBerlin`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

function getTomorrowHours(data) {
  const times = data.hourly.time;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const dayIndex = data.daily.time.indexOf(dateStr);
  const sunrise = new Date(data.daily.sunrise[dayIndex]);
  const sunset = new Date(data.daily.sunset[dayIndex]);

  const windowStart = sunrise.getHours() + 2;
  const windowEnd = sunset.getHours() - 1;

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
  return result;
}

function checkSpot(spot, hours) {
  const goodHours = hours.filter(
    (h) =>
      isWindDirectionOk(h.windDirection, spot.windDirectionMin, spot.windDirectionMax) &&
      h.windSpeed <= spot.windSpeedMax &&
      h.windGusts <= spot.windSpeedMax * 1.3
  );
  return goodHours;
}

async function sendTelegram(message) {
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
  if (!res.ok) throw new Error(`Telegram error: ${res.status}`);
}

async function main() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateLabel = tomorrow.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const messages = [];

  for (const spot of spots) {
    const data = await getWeather(spot.lat, spot.lon);
    const hours = getTomorrowHours(data);
    const goodHours = checkSpot(spot, hours);

    if (goodHours.length === 0) continue;

    const hourLabels = goodHours.map((h) => `${h.hour}:00 Uhr`).join(", ");
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
        `💨 Wind: Ø ${avgWind} km/h aus ${avgDir}°\n` +
        `⚠️ Eigene Einschätzung vor Ort prüfen!`
    );
  }

  if (messages.length > 0) {
    await sendTelegram(messages.join("\n\n"));
    console.log("Nachricht gesendet.");
  } else {
    console.log("Keine geeigneten Bedingungen morgen – keine Nachricht gesendet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});