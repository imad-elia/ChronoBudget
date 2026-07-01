// Pure, RN-free date math for recurring rules — mirrors the testable style of
// lib/detectCategory.ts. `advance` moves a timestamp forward by exactly one
// period, preserving the original day-of-month / weekday / month-day. Monthly
// and yearly steps clamp to the end of a shorter target month (e.g. Jan 31 →
// Feb 28, or Feb 29 → Feb 28 next year) so we never overflow into the next month.

export type Frequency = 'weekly' | 'monthly' | 'yearly';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, month: number): number {
  // month is 0-indexed; day 0 of month+1 is the last day of `month`.
  return new Date(year, month + 1, 0).getDate();
}

export function advance(ts: number, freq: Frequency): number {
  const d = new Date(ts);

  if (freq === 'weekly') {
    return ts + 7 * DAY_MS;
  }

  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ms = d.getMilliseconds();

  let year = d.getFullYear();
  let month = d.getMonth();

  if (freq === 'monthly') {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  } else {
    // yearly
    year += 1;
  }

  const clampedDay = Math.min(day, daysInMonth(year, month));
  return new Date(year, month, clampedDay, hours, minutes, seconds, ms).getTime();
}
