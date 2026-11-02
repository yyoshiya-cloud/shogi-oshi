import { FollowedPlayerConfig, PushNotificationItem, Match, Player, ShogiMonthlyResult } from '../types/shogi';
import { PLAYERS_DATA } from '../data/shogiDatabase';
import results2026Json from '../data/results2026.json';
import { applyPlayerOverrides } from './playerUtils';
import { initializePlayerRecords } from './yearRecordsGenerator';
import { filterBulletinNotifications } from './notificationFilter';
import { getTodayDateString, getTodayInfo } from './dateUtils';

const STORAGE_KEYS = {
  FOLLOWED: 'shogi_oshi_followed_v2',
  NOTIFICATIONS: 'shogi_oshi_notifications_v3',
  SETTINGS: 'shogi_oshi_settings_v2',
  PLAYERS: 'shogi_oshi_all_players_v16',
  LAST_SYNC: 'shogi_oshi_players_last_sync_v16',
  MATCHES: 'shogi_oshi_all_matches_v1',
  MATCH_LAST_SYNC: 'shogi_oshi_matches_last_sync_v1',
  RESULTS_2026: 'shogi_oshi_results_2026_v2',
};

/**
 * Automatically purges legacy storage keys from previous versions to keep
 * localStorage usage well under the browser's 5MB quota.
 */
export function pruneOldStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('shogi_oshi_all_players_') && k !== STORAGE_KEYS.PLAYERS) {
        keysToRemove.push(k);
      }
      if (k.startsWith('shogi_oshi_players_last_sync_') && k !== STORAGE_KEYS.LAST_SYNC) {
        keysToRemove.push(k);
      }
      if (k.startsWith('shogi_oshi_results_2026_') && k !== STORAGE_KEYS.RESULTS_2026) {
        keysToRemove.push(k);
      }
      if (k.startsWith('shogi_oshi_notifications_') && k !== STORAGE_KEYS.NOTIFICATIONS) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {}
}

// Proactive initial cleanup
pruneOldStorage();

const DEFAULT_FOLLOWED: FollowedPlayerConfig[] = [
  {
    playerId: 'fujii-sota',
    badge: '本命',
    color: '#6366f1',
    cheeringNote: '',
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
    cheeringNote: '',
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
      title: '【本日対局】藤井 聡太 竜王・名人の対局日です！',
      body: `本日 ${todayInfo.shortDisplay} 09:00〜 竜王戦 七番勝負 (vs 服部慎一郎 七段)。京都・仁和寺にて対局中！`,
      type: 'match_day',
      matchId: 'match-fin-01',
      playerId: 'fujii-sota',
      timestamp: `${todayStr}T08:00:00`,
      read: true,
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
      title: '【対局結果】福間 香奈 女流四冠が勝利しました！',
      body: '第18期 マイナビ女子オープン本戦 2回戦にて勝利。終局までの棋譜を再生できます。',
      type: 'match_result',
      matchId: 'match-fin-04',
      playerId: 'fukuma-kana',
      timestamp: `${todayStr}T18:30:00`,
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
    pruneOldStorage();
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    let players: Player[];
    if (!raw) {
      players = PLAYERS_DATA;
    } else {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length < 20) {
        players = PLAYERS_DATA;
      } else {
        // Merge stored overrides with PLAYERS_DATA base
        const staticMap = new Map<string, Player>(PLAYERS_DATA.map((p) => [p.id, p]));
        players = parsed.map((p: any) => {
          const base = staticMap.get(p.id) || p;
          return {
            ...base,
            ...p,
          };
        });
      }
    }
    return players.map(initializePlayerRecords);
  } catch {
    return PLAYERS_DATA.map(initializePlayerRecords);
  }
}

export function saveStoredPlayers(data: Player[]): void {
  try {
    pruneOldStorage();
    // Save lightweight delta containing only dynamic and stats fields to keep size under 25KB
    const slim = data.map((p) => ({
      id: p.id,
      name: p.name,
      currentYearWins: p.currentYearWins,
      currentYearLosses: p.currentYearLosses,
      currentYearWinRate: p.currentYearWinRate,
      careerWins: p.careerWins,
      careerLosses: p.careerLosses,
      careerWinRate: p.careerWinRate,
      yearRecords: p.yearRecords,
      rank: p.rank,
      heldTitles: p.heldTitles,
      totalTitles: p.totalTitles,
      junisenClass: p.junisenClass,
      ryuoClass: p.ryuoClass,
    }));
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(slim));
  } catch {
    // If quota is still somehow exceeded, attempt emergency prune and silently fail
    try {
      pruneOldStorage();
    } catch {}
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

export function getStoredFiscalResults(): Record<string, ShogiMonthlyResult[]> {
  const base = results2026Json as Record<string, ShogiMonthlyResult[]>;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESULTS_2026);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export function saveStoredFiscalResults(data: Record<string, ShogiMonthlyResult[]>): void {
  try {
    pruneOldStorage();
    const base = results2026Json as Record<string, ShogiMonthlyResult[]>;
    const delta: Record<string, ShogiMonthlyResult[]> = {};
    for (const key of Object.keys(data)) {
      if (!base[key] || base[key].length !== data[key]?.length) {
        delta[key] = data[key];
      }
    }
    // Only write if there are actual new months, staying well under quota
    if (Object.keys(delta).length > 0) {
      localStorage.setItem(STORAGE_KEYS.RESULTS_2026, JSON.stringify(delta));
    }
  } catch {}
}

