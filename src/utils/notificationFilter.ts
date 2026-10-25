import { PushNotificationItem, Match } from '../types/shogi';
import { getTodayDateString } from './dateUtils';

/**
 * Returns today's date in YYYY-MM-DD format using current JST/device date.
 */
export function getTodayDateStrings(): string[] {
  const jstToday = getTodayDateString();
  const localToday = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
  return Array.from(new Set([jstToday, localToday]));
}

/**
 * Determines if a notification is strictly a Match Result (対局結果).
 */
export function isNotificationMatchResult(
  notif: PushNotificationItem,
  match?: Match | null
): boolean {
  if (notif.type === 'match_result') return true;

  const title = notif.title || '';
  if (
    title.includes('対局結果') ||
    title.includes('勝敗速報') ||
    title.includes('終局速報') ||
    title.includes('が勝利') ||
    title.includes('防衛を果たしました') ||
    title.includes('防衛達成')
  ) {
    return true;
  }

  if (match && match.status === 'finished') {
    return true;
  }

  return false;
}

/**
 * Determines if a notification is strictly Today's Match (当日の対局).
 */
export function isNotificationTodayMatch(
  notif: PushNotificationItem,
  match?: Match | null
): boolean {
  // If it's a match result, don't categorize as today's match announcement
  if (isNotificationMatchResult(notif, match)) return false;

  const todayStrings = getTodayDateStrings();

  if (match) {
    // If the match is currently live, it is happening today
    if (match.status === 'live') return true;

    // If the match date is today
    if (todayStrings.includes(match.date)) return true;

    // If it's an upcoming match on another date, it is NOT today's match
    return false;
  }

  const title = notif.title || '';
  if (
    title.includes('本日対局') ||
    title.includes('当日対局') ||
    title.includes('本日 09:00') ||
    title.includes('本日 10:00') ||
    title.includes('対局開始')
  ) {
    return true;
  }

  if (notif.type === 'match_day' || notif.type === 'match_start') {
    const notifDate = (notif.timestamp || '').slice(0, 10);
    if (todayStrings.includes(notifDate)) return true;
  }

  return false;
}

/**
 * Check if a notification qualifies for the flash bulletin (通知速報):
 * Strictly ONLY today's matches (当日の対局) and match results (対局結果).
 */
export function isTodayOrResultNotification(
  notif: PushNotificationItem,
  matches: Match[] = []
): boolean {
  const match = notif.matchId ? matches.find((m) => m.id === notif.matchId) : null;
  return isNotificationMatchResult(notif, match) || isNotificationTodayMatch(notif, match);
}

/**
 * Filters a notification list so that ONLY today's matches and match results remain.
 */
export function filterBulletinNotifications(
  notifications: PushNotificationItem[],
  matches: Match[] = []
): PushNotificationItem[] {
  return notifications.filter((notif) => isTodayOrResultNotification(notif, matches));
}
