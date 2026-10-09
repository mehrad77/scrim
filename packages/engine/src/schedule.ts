import type { Schedule } from '@scrim/format';

const DAY = 24 * 60;

/**
 * The value opening hours give at a moment: the first period that covers it, else `otherwise`.
 * `day` is 0 (Sunday) to 6, `minute` the minutes since midnight, both in the venue's local time.
 * A period that ends before it starts runs past midnight into the next day; one that ends when
 * it starts lasts the whole day.
 */
export function scheduleValue(schedule: Schedule, day: number, minute: number): string {
  for (const p of schedule.periods) {
    // The same start and end: all day.
    if (p.from === p.to) {
      if (p.days.includes(day)) return p.value;
    } else if (p.from < p.to) {
      if (p.days.includes(day) && minute >= p.from && minute < p.to) return p.value;
    } else {
      // Late on the day it starts, or early on the day after.
      if (p.days.includes(day) && minute >= p.from) return p.value;
      if (p.days.includes((day + 6) % 7) && minute < p.to) return p.value;
    }
  }
  return schedule.otherwise;
}

/** The day and minute of a date, in this machine's time zone, for the `clock` input. */
export function clockOf(date: Date): { day: number; minute: number } {
  return { day: date.getDay(), minute: date.getHours() * 60 + date.getMinutes() };
}

/** "14:30" for 870 minutes. */
export const timeText = (minute: number) =>
  `${String(Math.floor((minute % DAY) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
