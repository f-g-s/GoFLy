import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DEBUG = process.env.DEBUG === "true";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const { data: spots, error } = await supabase.from("spots").select("*");

const DRY_RUN = false;

function isWindDirectionOk(direction, min, max) {
  if (min <= max) {
    return direction >= min && direction <= max;
  } else {
    return direction >= min || direction <= max;
  }
}

// Korrekter Kreisdurchschnitt für Windrichtung
function avgWindDirection(hours) {
  const sinSum = hours.reduce((s, h) => s + Math.sin(h.windDirection80m * Math.PI / 180), 0);
  const cosSum = hours.reduce((s, h) => s + Math.cos(h.windDirection80m * Math.PI / 180), 0);
  const avg = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
  return (avg + 360) % 360;
}

// Maximale Abweichung vom Kreisdurchschnitt
function windDirectionSpread(hours) {
  const avg = avgWindDirection(hours);
  const diffs = hours.map(h => {
    const diff = Math.abs(h.windDirection80m - avg);
    return diff > 180 ? 360 - diff : diff;
  });
  return Math.max(...diffs);
}

// Aufteilen in stabile Windrichtungsblöcke
function splitByWindStability(hours, maxSpread = 30) {
  if (hours.length === 0) return [];
  const blocks = [];
  let block = [hours[0]];

  for (let i = 1; i < hours.length; i++) {
    const candidate = [...block, hours[i]];
    if (windDirectionSpread(candidate) <= maxSpread) {
      block.push(hours[i]);
    } else {
      blocks.push(block);
      block = [hours[i]];
    }
  }
  blocks.push(block);
  return blocks;
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
    fetchForecast(lat, lon, 4),
  ]);

  const iconDates = new Set(shortTerm.daily.time);
  const mergedDailyTime = longTerm.daily.time;
  const mergedHourlyTime = longTerm.hourly.time;

  // Map für schnellen Index-Zugriff
  const iconTimeIndex = new Map(shortTerm.hourly.time.map((t, i) => [t, i]));

  const hourlyKeys = Object.keys(longTerm.hourly);
  const merged = { daily: { ...longTerm.daily }, hourly: {} };

  for (const key of hourlyKeys) {
    merged.hourly[key] = mergedHourlyTime.map((t, i) => {
      const date = t.slice(0, 10);
      if (iconDates.has(date)) {
        const j = iconTimeIndex.get(t);
        return j !== undefined ? shortTerm.hourly[key][j] : longTerm.hourly[key][i];
      }
      return longTerm.hourly[key][i];
    });
  }

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
  if (DEBUG) {
    console.log(`=== Rohdaten Stunden (${dateStr}, Fenster ${windowStart}–${windowEnd} Uhr) ===`);
    console.log(JSON.stringify(result, null, 2));
  }
  return result;
}

function getCompassDir(deg) {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function checkSpot(spot, hours) {
  // Prüfe, ob irgendeine Stunde im Zeitraum Windböen über 35 km/h hat
  const hasGusts = hours.some(hour => hour.windGusts10m > 35);

  // Wenn ja, setze die Prüfung auf "nicht geeignet"
  if (hasGusts) {
    return [];
  }

  const goodHours = hours.filter(
    (h) =>
      // Windrichtung 
      isWindDirectionOk(h.windDirection80m, spot.windDirectionMin, spot.windDirectionMax) &&
      // Windgeschwindigkeit 
      h.windSpeed80m <= spot.windSpeedMax &&
      h.windSpeed80m >= spot.windSpeedMin &&
      // Windböen max. 10 km/h mehr als Windgeschwindigkeit
      h.windGusts10m <= h.windSpeed80m + 10 &&
      // Windböen max. 30 km/h
      h.windGusts10m <= 30 &&
      // CAPE-Wert muss unter 1000 sein (Stabilität)
      h.cape < 1000 &&
      // Lifted Index muss positiv sein (Stabilität)
      h.liftedIndex > 0 &&
      // Niederschlagswahrscheinlichkeit darf maximal 20% betragen
      h.precipitationProbability <= 20
  );
  if (DEBUG) {
    console.log(`=== ${spot.name}: ${goodHours.length} von ${hours.length} Stunden gut ===`);
    console.log(JSON.stringify(goodHours, null, 2));
  }
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

function formatBlock(block) {
  const start = block[0].hour;
  const end = block[block.length - 1].hour;
  const timeLabel = start === end ? `${start}:00 Uhr` : `${start}–${end} Uhr`;

  const avgWind = Math.round(block.reduce((s, h) => s + h.windSpeed80m, 0) / block.length);
  const avgDir = Math.round(avgWindDirection(block));
  const maxGusts = Math.max(...block.map(h => h.windGusts10m));
  const avgPrecip = (block.reduce((s, h) => s + h.precipitation, 0) / block.length).toFixed(1);
  const avgCape = Math.round(block.reduce((s, h) => s + h.cape, 0) / block.length);
  const avgCloud = Math.round(block.reduce((s, h) => s + h.cloudCover, 0) / block.length);
  const avgVis = Math.round(block.reduce((s, h) => s + h.visibility, 0) / block.length / 1000);
  const avgLi = (block.reduce((s, h) => s + h.liftedIndex, 0) / block.length).toFixed(1);

  return (
    `🕐 ${timeLabel} Ø ${avgWind} km/h 💨 ${getCompassDir(avgDir)}\n` +
    `🌬️ Böen: max ${maxGusts} km/h`
  );
}

function formatDaySummary(hours) {
  const avgPrecip = (hours.reduce((s, h) => s + h.precipitation, 0) / hours.length).toFixed(1);
  const avgCape = Math.round(hours.reduce((s, h) => s + h.cape, 0) / hours.length);
  const avgCloud = Math.round(hours.reduce((s, h) => s + h.cloudCover, 0) / hours.length);
  const avgLi = (hours.reduce((s, h) => s + h.liftedIndex, 0) / hours.length).toFixed(1);

  const rainRisk = avgPrecip > 0 ? `Niederschlag: Ø ${avgPrecip} mm` : "Kein Regen";

  const thunderRisk =
    avgCape > 1000 || avgLi < 0 ? "Achtung! Hohe Gewittergefahr" :
      avgCape > 500 || avgLi < 1 ? "Gewitter möglich" :
        "Kein Gewitter";

  return (
    `☁️ Bewölkung: Ø ${avgCloud}%\n` +
    `🌧️ ${rainRisk}\n` +
    `⛈️ ${thunderRisk}`
  );
}

async function main() {
  const messages = [];

  for (const spot of spots) {
    const data = await getWeather(spot.lat, spot.lon);

    for (let offset = 0; offset < 4; offset++) {
      const day = new Date();
      day.setDate(day.getDate() + offset);
      // Fix: Lokalzeit statt UTC verwenden
      const dateStr = day.toLocaleDateString("sv-SE");
      const dateLabel = day.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      const hours = getHoursForDate(data, dateStr);
      const goodHours = checkSpot(spot, hours);
      if (goodHours.length === 0) continue;

      // Aufteilen in stabile Windrichtungsblöcke
      const blocks = splitByWindStability(goodHours, 10);

      const blockLines = blocks.map(formatBlock).join("\n\n");
      const summary = formatDaySummary(goodHours);

      messages.push({
        dateStr,
        text:
          `🪂 <b>${spot.name}</b>\n` +
          `📅 ${dateLabel}\n` +
          blockLines + "\n\n" +
          summary,
      });
    }
  }

  messages.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  if (messages.length > 0) {
    await sendTelegram(messages.map(m => m.text).join("\n\n\n"));
    await supabase.from("check_results").upsert({ id: 1, messages, updated_at: new Date() });
    console.log("Nachricht gesendet.");
  } else {
    console.log("Keine geeigneten Bedingungen in den nächsten 4 Tagen – keine Nachricht gesendet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});