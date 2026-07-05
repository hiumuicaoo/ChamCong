import { Declaration } from "./types";

/**
 * Get number of days in a given month (1-indexed)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Format Date object to YYYY-MM-DD in local timezone
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format Date object to DD/MM
 */
export function formatDayMonth(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
}

/**
 * Parse YYYY-MM-DD safely in local timezone
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the 7 days of the week (Monday to Sunday) containing the given date
 */
export function getWeekDays(date: Date): Date[] {
  const result: Date[] = [];
  const currentDay = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // In JS, Sunday is 0. We want Monday (1) to be start of week.
  // Distance to Monday:
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + distanceToMonday);

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    result.push(day);
  }
  return result;
}

/**
 * Check if a date string is within any declared period
 */
export function isDateInPeriods(dateStr: string, periods: Declaration[]): boolean {
  if (!periods || !Array.isArray(periods)) return false;
  const targetTime = parseLocalDate(dateStr).getTime();

  return periods.some(period => {
    if (!period.startDate || !period.endDate) return false;
    const startTime = parseLocalDate(period.startDate).getTime();
    const endTime = parseLocalDate(period.endDate).getTime();
    return targetTime >= startTime && targetTime <= endTime;
  });
}

/**
 * Check if a date is Monday to Friday
 */
export function isDefaultWorkingDay(dateStr: string): boolean {
  const date = parseLocalDate(dateStr);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return day >= 1 && day <= 5;
}

/**
 * Get name of weekday in Vietnamese
 */
export function getWeekdayNameVN(date: Date): string {
  const day = date.getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
}
