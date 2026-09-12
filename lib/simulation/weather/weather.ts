import { advanceDay, isColdMonth, monthDayFromDoy, weekdayOf } from "@/lib/city/calendar";
import { hash2 } from "@/lib/city/rng";
import type { CityClock, CityWeather, WeatherKind } from "@/lib/city/types";

const WET_CHANCE = 0.1;
const CLOUDY_CHANCE = 0.22;
const NOON_TEMP = [31, 34, 42, 54, 64, 73, 78, 76, 68, 56, 45, 36];
/** Matches `tickCity` — used to convert a clock window into event lifetime. */
export const SIM_MINUTES_PER_SECOND = 7.5;

export function isWetDay(year: number, dayOfYear: number) {
  return hash2(year, dayOfYear, 9041) < WET_CHANCE;
}

/** Rain/snow on a wet day lasts about 2–5 hours, not the whole day. */
export function wetWindow(year: number, dayOfYear: number) {
  if (!isWetDay(year, dayOfYear)) return null;
  const startMin = 7 * 60 + Math.floor(hash2(year, dayOfYear, 3311) * 10 * 60);
  const duration = 2 * 60 + Math.floor(hash2(year, dayOfYear, 772) * 3 * 60);
  const endMin = Math.min(21 * 60, startMin + duration);
  return { startMin, endMin };
}

export function inWetWindow(clock: CityClock) {
  const window = wetWindow(clock.year, clock.dayOfYear);
  if (!window) return false;
  return clock.minuteOfDay >= window.startMin && clock.minuteOfDay < window.endMin;
}

export function weatherKindFor(year: number, dayOfYear: number, minuteOfDay = 12 * 60): WeatherKind {
  const { month } = monthDayFromDoy(dayOfYear);
  const window = wetWindow(year, dayOfYear);
  if (window && minuteOfDay >= window.startMin && minuteOfDay < window.endMin) {
    return isColdMonth(month) ? "snow" : "rain";
  }
  if (window && minuteOfDay >= window.endMin && minuteOfDay < window.endMin + 75) {
    return "cloudy";
  }
  if (hash2(year, dayOfYear, 2207) < CLOUDY_CHANCE) return "cloudy";
  return "clear";
}

export function dayOutlook(year: number, dayOfYear: number): WeatherKind {
  const { month } = monthDayFromDoy(dayOfYear);
  if (isWetDay(year, dayOfYear)) return isColdMonth(month) ? "snow" : "rain";
  if (hash2(year, dayOfYear, 2207) < CLOUDY_CHANCE) return "cloudy";
  return "clear";
}

export function weatherLabel(kind: WeatherKind) {
  switch (kind) {
    case "snow":
      return "Snow";
    case "rain":
      return "Rain";
    case "cloudy":
      return "Cloudy";
    default:
      return "Clear";
  }
}

export function weatherEmoji(kind: WeatherKind) {
  switch (kind) {
    case "snow":
      return "❄️";
    case "rain":
      return "🌧️";
    case "cloudy":
      return "☁️";
    default:
      return "☀️";
  }
}

export function temperatureF(year: number, dayOfYear: number, minuteOfDay: number, kind: WeatherKind) {
  const { month } = monthDayFromDoy(dayOfYear);
  const hour = minuteOfDay / 60;
  const swing = Math.sin(((hour - 5) / 24) * Math.PI * 2) * 7;
  const noise = (hash2(year, dayOfYear, 611) - 0.5) * 6;
  let temp = NOON_TEMP[month - 1] + swing + noise;
  if (kind === "rain") temp -= 5;
  if (kind === "snow") temp -= 10;
  if (kind === "cloudy") temp -= 2;
  if (kind === "snow") temp = Math.min(temp, 33);
  return Math.round(temp);
}

export function weatherFor(clock: CityClock): CityWeather {
  const kind = weatherKindFor(clock.year, clock.dayOfYear, clock.minuteOfDay);
  return {
    kind,
    label: weatherLabel(kind),
    tempF: temperatureF(clock.year, clock.dayOfYear, clock.minuteOfDay, kind),
    wet: kind === "rain" || kind === "snow",
  };
}

export function refreshWeather(clock: CityClock, previous?: CityWeather): CityWeather {
  const next = weatherFor(clock);
  if (previous && previous.kind === next.kind) {
    return { ...next, tempF: temperatureF(clock.year, clock.dayOfYear, clock.minuteOfDay, next.kind) };
  }
  return next;
}

export function forecastFor(clock: CityClock, days = 5): CityWeather[] {
  const out: CityWeather[] = [];
  let year = clock.year;
  let doy = clock.dayOfYear;
  for (let i = 0; i < days; i++) {
    if (i > 0) {
      const next = advanceDay(year, doy);
      year = next.year;
      doy = next.dayOfYear;
    }
    const kind = dayOutlook(year, doy);
    out.push({
      kind,
      label: weatherLabel(kind),
      tempF: temperatureF(year, doy, 14 * 60, kind),
      wet: kind === "rain" || kind === "snow",
    });
  }
  return out;
}

/** Monday, 7 September 2026 at 7:18 — weather follows the 10% wet-day roll. */
export function openingClock(): CityClock {
  const year = 2026;
  const dayOfYear = 249;
  return {
    year,
    dayOfYear,
    dayIndex: weekdayOf(year, dayOfYear),
    minuteOfDay: 7 * 60 + 18,
  };
}

export function formatClockMinutes(minuteOfDay: number) {
  const hour24 = Math.floor(minuteOfDay / 60) % 24;
  const minute = Math.floor(minuteOfDay % 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

export function stormRemainingSeconds(clock: CityClock) {
  const window = wetWindow(clock.year, clock.dayOfYear);
  if (!window || clock.minuteOfDay >= window.endMin) return 0;
  return Math.max(0.25, (window.endMin - clock.minuteOfDay) / SIM_MINUTES_PER_SECOND);
}

export function weatherSpeedScale(weather: CityWeather) {
  if (weather.kind === "snow") return 0.58;
  if (weather.kind === "rain") return 0.72;
  return 1;
}
