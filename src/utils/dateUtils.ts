/**
 * Date Utility Module
 * Reliably obtains the current date in Asia/Tokyo (Japan Standard Time)
 * and formats it for calendar and push notifications.
 */

export interface TodayInfo {
  year: number;
  month: number; // 0-indexed (0 = Jan, 9 = Oct)
  day: number;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string; // 日, 月, 火, 水, 木, 金, 土
  formattedJp: string; // e.g. "2026年10月22日(木)"
  shortDisplay: string; // e.g. "10/22(木)"
}

const DOW_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Returns today's date formatted as YYYY-MM-DD in Japan Standard Time (Asia/Tokyo).
 */
export function getTodayDateString(): string {
  const now = new Date();
  const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jstDate.getFullYear();
  const m = String(jstDate.getMonth() + 1).padStart(2, '0');
  const d = String(jstDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns detailed today information for calendars, headers, and notification banners.
 */
export function getTodayInfo(): TodayInfo {
  const dateStr = getTodayDateString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  const dow = DOW_NAMES[parsed.getDay()] || '月';

  return {
    year: y,
    month: m - 1, // 0-indexed
    day: d,
    dateStr,
    dayOfWeek: dow,
    formattedJp: `${y}年${m}月${d}日(${dow})`,
    shortDisplay: `${m}/${d}(${dow})`,
  };
}

/**
 * Checks if a given date string is today.
 */
export function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === getTodayDateString();
}

/**
 * Formats a YYYY-MM-DD date string into Japanese display format.
 */
export function formatJapaneseDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const parsed = new Date(y, m - 1, d);
  const dow = DOW_NAMES[parsed.getDay()] || '';
  return `${m}月${d}日${dow ? `(${dow})` : ''}`;
}
