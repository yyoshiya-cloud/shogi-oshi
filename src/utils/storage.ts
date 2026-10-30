import { FollowedPlayerConfig, PushNotificationItem, Match, Player } from '../types/shogi';
import { PLAYERS_DATA } from '../data/shogiDatabase';
import { applyPlayerOverrides } from './playerUtils';
import { filterBulletinNotifications } from './notificationFilter';
import { getTodayDateString, getTodayInfo } from './dateUtils';

const STORAGE_KEYS = {
  FOLLOWED: 'shogi_oshi_followed_v2',
  NOTIFICATIONS: 'shogi_oshi_notifications_v2',
  SETTINGS: 'shogi_oshi_settings_v2',
  PLAYERS: 'shogi_oshi_all_players_v3',
  LAST_SYNC: 'shogi_oshi_players_last_sync_v3',
  MATCHES: 'shogi_oshi_all_matches_v1',
  MATCH_LAST_SYNC: 'shogi_oshi_matches_last_sync_v1',
};

const DEFAULT_FOLLOWED: FollowedPlayerConfig[] = [
  {
    playerId: 'fujii-sota',
    badge: '本命',
    color: '#6366f1',
    cheeringNote: '全冠防衛＆永世称号獲得を全力応援！',
    notificationsEnabled: true,
    notifyTiming: {
      dayBefore: true,
      morningOf: true,
      matchStart: true,
      resultImmediately: true,
    },
    cheerCount: 88,
    followedAt: '2026-09-01T10:00:00.000Z',
    fanComments: [
      { id: 'c1', text: '今日の順位戦A級も応援しています！頑張れ藤井名人！', createdAt: '2026-10-18 08:30' },
      { id: 'c2', text: '仁和寺の竜王戦第3局も見守ります！', createdAt: '2026-10-15 19:40' }
    ]
  },
  {
    playerId: 'fukuma-kana',
    badge: '神推し',
    color: '#ec4899',
    cheeringNote: '出雲のイナズマ！タイトル60期へ向かって応援！',
    notificationsEnabled: true,
    notifyTiming: {
      dayBefore: true,
      morningOf: true,
      matchStart: true,
      resultImmediately: true,
    },
    cheerCount: 52,
    followedAt: '2026-09-05T12:00:00.000Z',
    fanComments: [
      { id: 'c3', text: '女流名人戦開幕戦、箱根での対局楽しみにしています！', createdAt: '2026-10-16 11:20' }
    ]
  }
];

export function getDefaultNotifications(): PushNotificationItem[] {
  const todayStr = getTodayDateString();
  const todayInfo = getTodayInfo();

  return [
    {
      id: 'notif-1',
      title: '【本日対局】藤本 渚 五段の対局日です！',
      body: `本日 ${todayInfo.shortDisplay} 09:00〜 ALSOK杯王将戦 挑決リーグ (vs 西田拓也 五段)。関西将棋会館にて対局中！`,
      type: 'match_day',
      matchId: 'shogiorjp-2026-10-24-pro-nagisa_fujimoto-pro-takuya_nishida',
      playerId: 'pro-nagisa_fujimoto',
      timestamp: `${todayStr}T08:00:00`,
      read: false,
    },
    {
      id: 'notif-2',
      title: '【対局結果】西山 朋佳 白玲が防衛を果たしました！',
      body: '第4期 白玲戦 七番勝負 第6局にて、西山白玲が福間女流四冠に127手で勝利し白玲を防衛！棋譜速報が公開されました。',
      type: 'match_result',
      matchId: 'match-fin-02',
      playerId: 'nishiyama-tomoka',
      timestamp: `${todayStr}T17:45:00`,
      read: true,
    },
    {
      id: 'notif-3',
      title: '【対局結果】藤井 聡太 竜王が第2局を制しました！',
      body: '第39期 竜王戦 第2局にて、藤井竜王が伊藤匠叡王に115手で勝利（2連勝）。棋譜をアプリ内で再生できます。',
      type: 'match_result',
      matchId: 'match-fin-01',
      playerId: 'fujii-sota',
      timestamp: `${todayStr}T18:10:00`,
      read: true,
    },
    {
      id: 'notif-4',
      title: '【対局結果】中井 広恵 女流六段が112手で勝利！',
      body: '第18期 マイナビ女子オープン本戦 2回戦にて、中井女流六段が渡部愛女流四段に勝利。終局までの112手棋譜を再生できます。',
      type: 'match_result',
      matchId: 'match-fin-04',
      playerId: 'nakai-hiroe',
      timestamp: '2026-10-18T18:30:00',
      read: true,
    }
  ];
}

export function getStoredFollowed(userEmail?: string): FollowedPlayerConfig[] {
  try {
    if (userEmail) {
      const accountKey = `${STORAGE_KEYS.FOLLOWED}_${userEmail}`;
      const accountRaw = localStorage.getItem(accountKey);
      if (accountRaw) {
        return JSON.parse(accountRaw);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEYS.FOLLOWED);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.FOLLOWED, JSON.stringify(DEFAULT_FOLLOWED));
      if (userEmail) {
        localStorage.setItem(`${STORAGE_KEYS.FOLLOWED}_${userEmail}`, JSON.stringify(DEFAULT_FOLLOWED));
      }
      return DEFAULT_FOLLOWED;
    }
    const data = JSON.parse(raw);
    if (userEmail) {
      localStorage.setItem(`${STORAGE_KEYS.FOLLOWED}_${userEmail}`, JSON.stringify(data));
    }
    return data;
  } catch {
    return DEFAULT_FOLLOWED;
  }
}

export function saveStoredFollowed(data: FollowedPlayerConfig[], userEmail?: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLLOWED, JSON.stringify(data));
    if (userEmail) {
      localStorage.setItem(`${STORAGE_KEYS.FOLLOWED}_${userEmail}`, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Failed to save followed players', e);
  }
}

export function getStoredPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    if (!raw) return PLAYERS_DATA.map(applyPlayerOverrides);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 50) {
      return PLAYERS_DATA.map(applyPlayerOverrides);
    }
    return parsed.map(applyPlayerOverrides);
  } catch {
    return PLAYERS_DATA.map(applyPlayerOverrides);
  }
}

export function saveStoredPlayers(data: Player[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save players', e);
  }
}

export function getStoredLastSync(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export function saveStoredLastSync(timeString: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timeString);
  } catch (e) {
    console.error('Failed to save last sync time', e);
  }
}

export function deduplicateMatches(matches: Match[]): Match[] {
  if (!Array.isArray(matches)) return [];
  const map = new Map<string, Match>();
  const pairMap = new Map<string, Match>();

  for (const m of matches) {
    if (!m || !m.id) continue;

    let pairKey = '';
    if (m.date && m.player1Id && m.player2Id) {
      const sortedPlayers = [m.player1Id, m.player2Id].sort().join('_');
      pairKey = `${m.date}_${sortedPlayers}`;
    }

    const existingById = map.get(m.id);
    const existingByPair = pairKey ? pairMap.get(pairKey) : undefined;

    if (!existingById && !existingByPair) {
      map.set(m.id, m);
      if (pairKey) pairMap.set(pairKey, m);
    } else {
      const existing = existingById || existingByPair!;
      const isBetter =
        ((m.status === 'live' || m.status === 'finished') && existing.status === 'upcoming') ||
        (m.kifuMoves && m.kifuMoves.length > (existing.kifuMoves?.length || 0));

      if (isBetter) {
        if (existingById && existingById.id !== m.id) map.delete(existingById.id);
        map.set(m.id, m);
        if (pairKey) pairMap.set(pairKey, m);
      } else {
        if (pairKey && !existingByPair) {
          pairMap.set(pairKey, existing);
        }
      }
    }
  }
  return Array.from(map.values());
}

export function getStoredMatches(): Match[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MATCHES);
    if (!raw) return null;
    const parsed: Match[] = JSON.parse(raw);
    const filtered = parsed.filter(
      (m) =>
        m &&
        m.id &&
        !m.id.startsWith('match-live-') &&
        !m.id.startsWith('match-up-') &&
        !m.id.startsWith('match-fin-')
    );
    return deduplicateMatches(filtered);
  } catch {
    return null;
  }
}

export function saveStoredMatches(data: Match[]): void {
  try {
    const clean = deduplicateMatches(data);
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to save matches', e);
  }
}

export function getStoredMatchLastSync(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.MATCH_LAST_SYNC);
  } catch {
    return null;
  }
}

export function saveStoredMatchLastSync(timeString: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MATCH_LAST_SYNC, timeString);
  } catch (e) {
    console.error('Failed to save match last sync time', e);
  }
}

export function getStoredNotifications(matches?: Match[]): PushNotificationItem[] {
  const defaults = getDefaultNotifications();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(defaults));
      return defaults;
    }
    const parsed: PushNotificationItem[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return filterBulletinNotifications(parsed, matches || []);
  } catch {
    return defaults;
  }
}

export function saveStoredNotifications(data: PushNotificationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

export function deleteStoredNotification(id: string): PushNotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const current: PushNotificationItem[] = raw ? JSON.parse(raw) : [];
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete notification', e);
    return [];
  }
}

export function clearStoredNotifications(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  } catch (e) {
    console.error('Failed to clear notifications', e);
  }
}

/**
 * Trigger an actual Web Notification if browser allows, plus store to notification center
 */
export async function triggerPushNotification(
  title: string,
  body: string,
  type: PushNotificationItem['type'] = 'match_day',
  matchId?: string,
  playerId?: string
): Promise<PushNotificationItem> {
  const newItem: PushNotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    type,
    matchId,
    playerId,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const current = getStoredNotifications();
  const updated = [newItem, ...current];
  saveStoredNotifications(updated);

  // Attempt real browser notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: newItem.id,
        });
      } catch (e) {
        console.warn('Native notification call error', e);
      }
    }
  }

  return newItem;
}
