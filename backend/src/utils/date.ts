import { env } from "../config/env";

const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: env.BUSINESS_TIME_ZONE,
  year: "numeric"
});
const businessTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: env.BUSINESS_TIME_ZONE
});

function getBusinessDateParts(date: Date): { day: number; month: number; year: number } {
  const parts = businessDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    month: Number(values.month),
    year: Number(values.year)
  };
}

export function toDateOnlyFromDate(date: Date): Date {
  const parts = getBusinessDateParts(date);

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function toDateOnlyFromInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

export function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date);

  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

export function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getBusinessMinutesFromMidnight(date: Date): number {
  const parts = businessTimeFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Number(values.hour) * 60 + Number(values.minute);
}

export function getTrailingDateRange(days: number): { dateFrom: Date; dateTo: Date } {
  const dateTo = toDateOnlyFromDate(new Date());
  const dateFrom = addUtcDays(dateTo, -days);

  return { dateFrom, dateTo };
}

export function getMonthDateRange(date: Date): { dateFrom: Date; dateTo: Date } {
  const currentDate = toDateOnlyFromDate(date);
  const dateFrom = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));

  return { dateFrom, dateTo: currentDate };
}
