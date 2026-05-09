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

const HOURLY_PARAMS = `windspeed_80m,winddirection_80m,windgusts_10m,precipitation,precipitation_probability,weathercode,cape,cloudcover,visibility,lifted_index`;

async function fetchForecast(lat, lon, days, model = "") {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${HOURLY_PARAMS}` +
    `&daily=sunrise,sunset` +
    `&windspeed_unit=kmh` +
    `&forecast_days=${days}` +
    `&timezone=Europe%2FBerlin` +
    (model ? `&models=${model}` : "");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

async function getWeather(lat, lon) {
  const [shortTerm, longTerm] = await Promise.all([
    fetchForecast(lat, lon, 2, "dwd_icon_d2"),
    fetchForecast(lat, lon, 7),
  ]);

  // Merge: ICON-D2 dates override auto-model dates
  const iconDates = new Set(shortTerm.daily.time);
  const mergedDailyTime = longTerm.daily.time;
  const mergedHourlyTime = longTerm.hourly.time;

  // Build merged hourly data: use shortTerm for its dates, longTerm for the rest
  const hourlyKeys = Object.keys(longTerm.hourly);
  const merged = { daily: { ...longTerm.daily }, hourly: {} };

  for (const key of hourlyKeys) {
    merged.hourly[key] = mergedHourlyTime.map((t, i) => {
      const date = t.slice(0, 10);
      if (iconDates.has(date)) {
        const j = shortTerm.hourly.time.indexOf(t);
        return j !== -1 ? shortTerm.hourly[key][j] : longTerm.hourly[key][i];
      }
      return longTerm.hourly[key][i];
    });
  }

  // Merge daily sunrise/sunset: prefer shortTerm for its dates
  for (const key of ["sunrise", "sunset"]) {
    merged.daily[key] = mergedDailyTime.map((date, i) => {
      if (iconDates.has(date)) {
        const j = shortTerm.daily.time.indexOf(date);
        return j !== -1 ? shortTerm.daily[key][j] : longTerm.daily[key][i];
      }
      return longTerm.daily[key][i];
    });
  }

  return merged;
}

function getHoursForDate(data, dateStr) {
  const times = data.hourly.time;

  const dayIndex = data.daily.time.indexOf(dateStr);
  if (dayIndex === -1) return [];
  const sunrise = new Date(data.daily.sunrise[dayIndex]);
  const sunset = new Date(data.daily.sunset[dayIndex]);

  const windowStart = sunrise.getMinutes() > 0 ? sunrise.getHours() + 1 : sunrise.getHours();
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
      windSpeed80m: data.hourly.windspeed_80m[i],
      windDirection80m: data.hourly.winddirection_80m[i],
      windGusts10m: data.hourly.windgusts_10m[i],
      precipitation: data.hourly.precipitation[i],
      precipitationProbability: data.hourly.precipitation_probability[i],
      weatherCode: data.hourly.weathercode[i],
      cape: data.hourly.cape[i],
      cloudCover: data.hourly.cloudcover[i],
      visibility: data.hourly.visibility[i],
      liftedIndex: data.hourly.lifted_index[i],
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
      isWindDirectionOk(h.windDirection80m, spot.windDirectionMin, spot.windDirectionMax) &&
      h.windSpeed80m <= spot.windSpeedMax &&
      h.windSpeed80m >= spot.windSpeedMin &&
      h.windGusts10m <= h.windSpeed80m + 10 &&
      h.windGusts10m <= 30 &&
      h.cape < 1000 &&
      h.liftedIndex > 0 &&
      h.precipitationProbability <= 20
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
        goodHours.reduce((s, h) => s + h.windSpeed80m, 0) / goodHours.length
      );
      const avgDir = Math.round(
        goodHours.reduce((s, h) => s + h.windDirection80m, 0) / goodHours.length
      );

      const avgPrecip = (goodHours.reduce((s, h) => s + h.precipitation, 0) / goodHours.length).toFixed(1);
      const avgCape = Math.round(goodHours.reduce((s, h) => s + h.cape, 0) / goodHours.length);
      const avgCloud = Math.round(goodHours.reduce((s, h) => s + h.cloudCover, 0) / goodHours.length);
      const avgVis = Math.round(goodHours.reduce((s, h) => s + h.visibility, 0) / goodHours.length / 1000);
      const avgLi = (goodHours.reduce((s, h) => s + h.liftedIndex, 0) / goodHours.length).toFixed(1);

      const thunderRisk =
        avgCape > 1000 || avgLi < 0 ? "Hoch" :
        avgCape > 500  || avgLi < 1 ? "Mittel" :
                                       "Gering";

      messages.push(
        `🪂 <b>${spot.name}</b>\n` +
          `📅 ${dateLabel}\n` +
          `🕐 Zeitraum: ${hourLabels}\n` +
          `💨 Wind: Ø ${avgWind} km/h aus ${getCompassDir(avgDir)}\n` +
          `🌬️ Böen: bis ${Math.max(...goodHours.map(h => h.windGusts10m))} km/h\n` +
          `🌧️ Niederschlag: Ø ${avgPrecip} mm\n` +
          `☁️ Bewölkung: Ø ${avgCloud}%\n` +
          `👁️ Sicht: Ø ${avgVis} km\n` +
          `⛈️ Gewitterrisiko: ${thunderRisk}`
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