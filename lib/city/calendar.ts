import { DAYS } from "./types";

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Monday, 7 September 2026 — opening weekday of the generated city. */
const REF_YEAR = 2026;
const REF_DOY = 249;
const REF_DOW = 0;

export function dayOfYearFromMonthDay(month: number, day: number) {
  let n = 0;
  for (let i = 0; i < month - 1; i++) n += MONTH_DAYS[i];
  return n + day - 1;
}

export function monthDayFromDoy(doy: number) {
  let left = ((doy % 365) + 365) % 365;
  for (let month = 0; month < 12; month++) {
    if (left < MONTH_DAYS[month]) return { month: month + 1, day: left + 1 };
    left -= MONTH_DAYS[month];
  }
  return { month: 12, day: 31 };
}

export function weekdayOf(year: number, doy: number) {
  const days = (year - REF_YEAR) * 365 + (doy - REF_DOY);
  return ((days % 7) + 7) % 7;
}

export function isColdMonth(month: number) {
  return month === 11 || month === 12 || month === 1 || month === 2;
}

export function formatDate(year: number, doy: number) {
  const { month, day } = monthDayFromDoy(doy);
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

export function formatLongDate(year: number, doy: number) {
  const { month, day } = monthDayFromDoy(doy);
  const weekday = DAYS[weekdayOf(year, doy)];
  return `${weekday}, ${MONTH_NAMES[month - 1]} ${day}`;
}

export function advanceDay(year: number, doy: number) {
  if (doy + 1 >= 365) return { year: year + 1, dayOfYear: 0 };
  return { year, dayOfYear: doy + 1 };
}
