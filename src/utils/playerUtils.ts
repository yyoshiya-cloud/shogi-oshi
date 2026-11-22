import { getTodayDateString } from './dateUtils';
import { getPlayerTotalTitles } from './titleUtils';
import { initializePlayerRecords } from './yearRecordsGenerator';

const KNOWN_NO_SPACE_NAMES: Record<string, string> = {
  // Active / notable players whose names on official sites lack spaces
  '岩村凛太朗': '岩村 凛太朗',
  '山川泰熙': '山川 泰熙',
  '山川泰煕': '山川 泰煕',
  '高橋佑二郎': '高橋 佑二郎',
  '炭崎俊毅': '炭崎 俊毅',
  '炭﨑俊毅': '炭﨑 俊毅',
  '斎藤慎太郎': '斎藤 慎太郎',
  '堀口一史座': '堀口 一史座',
  '佐々木勇気': '佐々木 勇気',
  '阿部健治郎': '阿部 健治郎',
  '三枚堂達也': '三枚堂 達也',
  '安用寺孝功': '安用寺 孝功',
  '石井健太郎': '石井 健太郎',
  '長谷部浩平': '長谷部 浩平',
  '矢内理絵子': '矢内 理絵子',
  '長沢千和子': '長沢 千和子',
  '中村真梨花': '中村 真梨花',
  '本田小百合': '本田 小百合',
  '山根ことみ': '山根 ことみ',
  '山口恵梨子': '山口 恵梨子',
  '長谷川優貴': '長谷川 優貴',
  '石本さくら': '石本 さくら',
  '松下舞琳': '松下 舞琳',
  '梅津美琴': '梅津 美琴',
  '崎原知宙': '崎原 知宙',
  '砂原奏': '砂原 奏',
  '藤井聡太': '藤井 聡太',
  '伊藤匠': '伊藤 匠',
  '羽生善治': '羽生 善治',
  '渡辺明': '渡辺 明',
  '永瀬拓矢': '永瀬 拓矢',
  '豊島将之': '豊島 将之',
  '佐藤天彦': '佐藤 天彦',
  '菅井竜也': '菅井 竜也',
  '広瀬章人': '広瀬 章人',
  '稲葉陽': '稲葉 陽',
  '増田康宏': '増田 康宏',
  '佐々木大地': '佐々木 大地',
  '服部慎一郎': '服部 慎一郎',
  '西山朋佳': '西山 朋佳',
  '福間香奈': '福間 香奈',
  '加藤桃子': '加藤 桃子',
  '伊藤沙恵': '伊藤 沙恵',
  '鈴木環那': '鈴木 環那',
  '香川愛生': '香川 愛生',
  '室田伊緒': '室田 伊緒',
  '野原未蘭': '野原 未蘭',
  '中井広恵': '中井 広恵',
  '清水市代': '清水 市代',
  '竹部さゆり': '竹部 さゆり',
  '中澤沙耶': '中澤 沙耶',
};

// Common 3-character Japanese surnames in Shogi
const THREE_CHAR_SURNAMES = ['佐々木', '長谷部', '長谷川', '三枚堂', '安用寺'];

/**
 * Formats a player's full name by ensuring exactly one half-width space between surname and given name.
 */
export function formatPlayerName(name: string): string {
  if (!name) return '';
  const trimmed = name.replace(/[※＊\*\+]/g, '').trim();

  // If already contains whitespace (full-width or half-width)
  if (/[\s\u3000]/.test(trimmed)) {
    return trimmed.replace(/[\s\u3000]+/g, ' ');
  }

  // Check known mapping dictionary
  if (KNOWN_NO_SPACE_NAMES[trimmed]) {
    return KNOWN_NO_SPACE_NAMES[trimmed];
  }

  // 3-character surname check
  for (const surname of THREE_CHAR_SURNAMES) {
    if (trimmed.startsWith(surname) && trimmed.length > surname.length) {
      return `${surname} ${trimmed.slice(surname.length)}`;
    }
  }

  // 1-character surname check (e.g. 谷, 辻, 乾, 森, etc. followed by 2+ characters given name)
  // Usually rare, let us check common single-kanji surnames
  const singleCharSurnames = ['森', '谷', '辻', '乾', '林', '原'];
  for (const s of singleCharSurnames) {
    if (trimmed.startsWith(s) && trimmed.length === 3) {
      // e.g. 森下 -> wait, 森下 is 2-char surname. Only if given name is 2 char e.g. 森けい二?
      // Better to check if given name is known
    }
  }

  // Default heuristic for 4-character names (almost always 2-character surname + 2-character given name)
  if (trimmed.length === 4) {
    return `${trimmed.slice(0, 2)} ${trimmed.slice(2)}`;
  }

  // 5-character names (usually 2-character surname + 3-character given name e.g. 阿部健治郎, or 3+2)
  if (trimmed.length === 5) {
    return `${trimmed.slice(0, 2)} ${trimmed.slice(2)}`;
  }

  // 3-character names (usually 2-character surname + 1-character given name e.g. 渡辺明, 稲葉陽)
  if (trimmed.length === 3) {
    return `${trimmed.slice(0, 2)} ${trimmed.slice(2)}`;
  }

  return trimmed;
}

/**
 * Calculates current age based on birthdate.
 */
function calculateAge(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const mDiff = (today.getMonth() + 1) - month;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}

/**
 * Converts full-width ASCII digits/separators to half-width and automatically converts YYYYMMDD to YYYY-MM-DD on input.
 */
export function autoFormatDateOnChange(raw: string): string {
  if (!raw) return '';
  const half = raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[－ー−]/g, '-');
  const trimmed = half.trim();

  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const slashMatch = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  return half;
}

/**
 * Checks whether a string is a valid YYYY-MM-DD calendar date.
 */
export function isValidYyyyMmDd(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === d;
}

/**
 * Normalizes YYYYMMDD, YYYY/M/D, YYYY.M.D, YYYY-M-D, and YYYY年M月D日 strings into YYYY-MM-DD.
 * Keeps strings without a year (e.g. "6月26日(かに座)") or empty strings as-is (trimmed).
 */
export function normalizeDateToYyyyMmDd(raw?: string | null): string {
  if (!raw) return '';
  const clean = raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[－ー−]/g, '-')
    .trim();
  if (!clean) return '';

  const compact = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const isoLike = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[\s(（])/);
  if (isoLike) {
    const mm = isoLike[2].padStart(2, '0');
    const dd = isoLike[3].padStart(2, '0');
    return `${isoLike[1]}-${mm}-${dd}`;
  }

  const jp = clean.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) {
    const mm = jp[2].padStart(2, '0');
    const dd = jp[3].padStart(2, '0');
    return `${jp[1]}-${mm}-${dd}`;
  }

  return clean;
}

/**
 * Calculates age from any supported birthDate string (YYYY-MM-DD, YYYYMMDD, YYYY/M/D, YYYY年M月D日).
 * Returns null if no valid full date is present.
 */
export function calculateAgeFromBirthDateString(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null;
  const normalized = normalizeDateToYyyyMmDd(birthDateStr);
  if (!isValidYyyyMmDd(normalized)) return null;
  const [yStr, mStr, dStr] = normalized.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  const age = calculateAge(y, m, d);
  if (age < 0 || age > 130) return null;
  return age;
}

/**
 * Formats a birthdate string into "YYYY年MM月DD日\n（XX歳）".
 * Handles YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, and YYYY年MM月DD日 formats.
 */
export function formatBirthDateWithAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return '公式名鑑参照';

  const clean = birthDateStr.trim();

  // Pattern 0: YYYYMMDD
  const matchCompact = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (matchCompact) {
    const y = parseInt(matchCompact[1], 10);
    const m = parseInt(matchCompact[2], 10);
    const d = parseInt(matchCompact[3], 10);
    const age = calculateAge(y, m, d);
    return `${y}年${matchCompact[2]}月${matchCompact[3]}日\n（${age}歳）`;
  }

  // Pattern 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const matchIso = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchIso) {
    const y = parseInt(matchIso[1], 10);
    const m = parseInt(matchIso[2], 10);
    const d = parseInt(matchIso[3], 10);
    const age = calculateAge(y, m, d);
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}年${mm}月${dd}日\n（${age}歳）`;
  }

  // Pattern 2: YYYY年M月D日 or YYYY年MM月DD日
  const matchJp = clean.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (matchJp) {
    const y = parseInt(matchJp[1], 10);
    const m = parseInt(matchJp[2], 10);
    const d = parseInt(matchJp[3], 10);
    const age = calculateAge(y, m, d);
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}年${mm}月${dd}日\n（${age}歳）`;
  }

  return clean;
}

import { Player, PlayerNameHistoryItem } from '../types/shogi';

const dynamicNameToPlayerId = new Map<string, string>();
const dynamicPlayerToOldNames = new Map<string, Set<string>>();

export function registerDynamicNameHistory(history: PlayerNameHistoryItem[]): void {
  dynamicNameToPlayerId.clear();
  dynamicPlayerToOldNames.clear();
  if (!Array.isArray(history)) return;
  for (const h of history) {
    if (!h.playerId || !h.oldName) continue;
    const normOld = normalizeShogiPlayerNameForMatch(h.oldName);
    if (normOld) {
      dynamicNameToPlayerId.set(normOld, h.playerId);
    }
    if (!dynamicPlayerToOldNames.has(h.playerId)) {
      dynamicPlayerToOldNames.set(h.playerId, new Set());
    }
    dynamicPlayerToOldNames.get(h.playerId)!.add(h.oldName);
    if (normOld) dynamicPlayerToOldNames.get(h.playerId)!.add(normOld);
  }
}

export function getHistoricalNamesForPlayer(playerId: string): string[] {
  const set = dynamicPlayerToOldNames.get(playerId);
  return set ? Array.from(set) : [];
}

export function isPlayerOnLeave(
  player: {
    leaveInfo?: Player['leaveInfo'];
    highlights?: string[];
    shortBio?: string;
    name?: string;
  },
  referenceDate?: string
): boolean {
  if (!player) return false;

  if (player.leaveInfo) {
    if (player.leaveInfo.isOnLeave === false) {
      return false;
    }
    const start = (player.leaveInfo.startDate || '').trim();
    const end = (player.leaveInfo.endDate || '').trim();
    if (start || end) {
      const today = referenceDate || getTodayDateString();
      const afterStart = !start || today >= start;
      const beforeEnd = !end || today <= end;
      return afterStart && beforeEnd;
    }
    if (player.leaveInfo.isOnLeave === true) {
      return true;
    }
  }

  if (player.highlights && player.highlights.some((h) => h.includes('休場'))) return true;
  if (player.shortBio && player.shortBio.includes('休場中')) return true;
  return false;
}

export function formatPlayerLeavePeriod(player: Partial<Player>): string {
  const start = (player.leaveInfo?.startDate || '').trim();
  const end = (player.leaveInfo?.endDate || '').trim();
  const reason = (player.leaveInfo?.reason || '').trim();
  let period = '';
  if (start && end) {
    period = `${start.replace(/-/g, '/')} 〜 ${end.replace(/-/g, '/')}`;
  } else if (start) {
    period = `${start.replace(/-/g, '/')} 〜 継続中`;
  } else if (end) {
    period = `〜 ${end.replace(/-/g, '/')}`;
  } else {
    period = '公式戦休場中';
  }
  return reason ? `${period}（${reason}）` : period;
}

/**
 * Checks if a player is officially retired.
 * Correctly ignores lifetime title notes like "就位は原則引退後" or "引退後に就位".
 */
export function isPlayerRetired(
  player: {
    rank?: string;
    shortBio?: string;
    titleHistory?: string;
    highlights?: string[];
    retirementDate?: string;
  },
  referenceDate?: string
): boolean {
  if (!player) return false;

  // 0. Explicit retirementDate check
  const retDate = (player.retirementDate || '').trim();
  if (retDate) {
    const today = referenceDate || getTodayDateString();
    if (today >= retDate) {
      const getFy = (dStr: string) => {
        const clean = String(dStr || '').replace(/[^0-9]/g, '');
        if (clean.length < 8) return 2026;
        const y = parseInt(clean.slice(0, 4), 10);
        const m = parseInt(clean.slice(4, 6), 10);
        if (isNaN(y) || isNaN(m)) return 2026;
        return m >= 1 && m <= 3 ? y - 1 : y;
      };
      const retFy = getFy(retDate);
      const todayFy = getFy(today);
      if (retFy === todayFy) {
        return false; // 当期（今年度内）に引退した場合、今年度内は引退扱いとせず表示する
      }
      return true;
    }
  }

  // 1. Explicit rank check (e.g. "引退", "引退九段", "引退棋士", "引退女流...")
  if (player.rank && player.rank.includes('引退')) {
    return true;
  }

  // 2. ShortBio check: look for explicit retirement statements, excluding "就位は原則引退後" / "引退後"
  if (player.shortBio) {
    const cleanBio = player.shortBio.replace(/就位は原則引退後|引退後に就位|引退後/g, '');
    if (
      cleanBio.includes('引退棋士') ||
      cleanBio.includes('引退女流棋士') ||
      cleanBio.includes('現役引退') ||
      cleanBio.includes('引退発表') ||
      cleanBio.includes('正式に引退') ||
      cleanBio.includes('日付で引退') ||
      cleanBio.includes('引退規定') ||
      /\d{4}年\d{1,2}月\d{1,2}日(?:付で)?引退/.test(cleanBio)
    ) {
      return true;
    }
  }

  // 3. Highlights check
  if (player.highlights && player.highlights.length > 0) {
    for (const h of player.highlights) {
      const cleanH = h.replace(/就位は原則引退後|引退後に就位|引退後/g, '');
      if (
        cleanH.includes('現役引退') ||
        cleanH.includes('引退決定') ||
        cleanH.includes('引退表明') ||
        /\d{4}年\d{1,2}月\d{1,2}日(?:付で)?引退/.test(cleanH)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 当期（今年度内）の引退日設定も含め、引退済みステータスかどうかを判定する（絞り込み・表示用）
 */
export function isPlayerRetiredStatus(
  player: {
    rank?: string;
    shortBio?: string;
    titleHistory?: string;
    highlights?: string[];
    retirementDate?: string;
  },
  referenceDate?: string
): boolean {
  if (!player) return false;
  const retDate = (player.retirementDate || '').trim();
  if (retDate) {
    const today = referenceDate || getTodayDateString();
    if (today >= retDate) {
      return true;
    }
  }
  return isPlayerRetired(player, referenceDate);
}

export function formatPlayerRetirementDate(player: Partial<Player>): string {
  const retDate = (player.retirementDate || '').trim();
  if (retDate) {
    return `${retDate.replace(/-/g, '/')} 引退`;
  }
  return '引退';
}

export function isBoilerplateBio(bio?: string | null): boolean {
  if (!bio) return true;
  const cleaned = bio.trim();
  if (!cleaned) return true;

  if (
    cleaned.includes('所属の現役棋士') ||
    cleaned.includes('所属の現役女流棋士') ||
    cleaned.includes('公式棋士番号') ||
    cleaned.includes('女流番号') ||
    cleaned.includes('LPSA番号') ||
    cleaned.includes('公式 棋士プロフィール') ||
    cleaned.includes('公式女流棋士プロフィール') ||
    cleaned.includes('日本将棋連盟公式 棋士プロフィール')
  ) {
    if (cleaned.includes('休場中')) return false;
    return true;
  }
  return false;
}

export function applyPlayerOverrides(p: Player): Player {
  const manualSet = new Set(Array.isArray(p.manualFields) ? p.manualFields : []);
  const nameClean = p.name ? p.name.replace(/[\s\u3000※＊\*]/g, '') : '';

  if (nameClean.includes('中倉宏美')) {
    return {
      ...p,
      junisenClass: manualSet.has('junisenClass')
        ? p.junisenClass
        : (p.junisenClass && p.junisenClass !== '-' ? p.junisenClass : 'フリークラス'),
    };
  }
  const PRO_CLASS_OVERRIDES: Record<string, { junisenClass: string; ryuoClass: string }> = {
    '山下数毅': { junisenClass: 'フリークラス', ryuoClass: '4組' },
    '岩村凛太朗': { junisenClass: 'フリークラス', ryuoClass: '6組' },
    '生垣寛人': { junisenClass: 'フリークラス', ryuoClass: '6組' },
    '片山史龍': { junisenClass: 'フリークラス', ryuoClass: '6組' },
    '小窪碧': { junisenClass: 'フリークラス', ryuoClass: '6組' },
    '川村悠人': { junisenClass: 'フリークラス', ryuoClass: '6組' },
    '古井丈大': { junisenClass: 'フリークラス', ryuoClass: '第40期より' },
    '渡邊晴磨': { junisenClass: '第86期より', ryuoClass: '第40期より' },
    '國井勝太': { junisenClass: '第86期より', ryuoClass: '第40期より' },
    '齊藤優希': { junisenClass: 'C級2組', ryuoClass: '6組' },
    '炭﨑俊毅': { junisenClass: 'C級2組', ryuoClass: '第40期より' },
    '炭崎俊毅': { junisenClass: 'C級2組', ryuoClass: '第40期より' },
  };

  for (const [key, val] of Object.entries(PRO_CLASS_OVERRIDES)) {
    if (nameClean.includes(key)) {
      const isFurui = key === '古井丈大';
      const isSumisaki = key === '炭﨑俊毅' || key === '炭崎俊毅';
      const hasStats = (p.careerWins || 0) > 0 || (p.careerLosses || 0) > 0;
      return {
        ...p,
        junisenClass: manualSet.has('junisenClass')
          ? p.junisenClass
          : (p.junisenClass && p.junisenClass !== '-' ? p.junisenClass : val.junisenClass),
        ryuoClass: manualSet.has('ryuoClass')
          ? p.ryuoClass
          : (p.ryuoClass && p.ryuoClass !== '-' ? p.ryuoClass : val.ryuoClass),
        ...(!hasStats && isFurui && !manualSet.has('careerWins')
          ? { currentYearWins: 5, currentYearLosses: 5, currentYearWinRate: 0.5, careerWins: 5, careerLosses: 5, careerWinRate: 0.5 }
          : {}),
        ...(!hasStats && isSumisaki && !manualSet.has('careerWins')
          ? { currentYearWins: 13, currentYearLosses: 7, currentYearWinRate: 0.65, careerWins: 13, careerLosses: 7, careerWinRate: 0.65 }
          : {}),
      };
    }
  }

  return p;
}

/**
 * 勝率を正確に 0.000 形式（例: 0.650, 0.000, 1.000）でフォーマットする
 */
export function formatWinRate(rate?: number | null): string {
  if (rate === undefined || rate === null || isNaN(rate)) return '0.000';
  const num = Math.max(0, Math.min(1, Number(rate)));
  return num.toFixed(3);
}

export const PRO_DAN_RANKS = ['四段', '五段', '六段', '七段', '八段', '九段'] as const;
export type ProDanRank = (typeof PRO_DAN_RANKS)[number];

export const WOMEN_DAN_RANKS = [
  '女流2級',
  '女流1級',
  '女流初段',
  '女流二段',
  '女流三段',
  '女流四段',
  '女流五段',
  '女流六段',
  '女流七段',
  '女流八段',
] as const;
export type WomenDanRank = (typeof WOMEN_DAN_RANKS)[number];

/**
 * 棋士・女流棋士の肩書・段位を整形表示する。
 * 「現役棋士」「女流棋士」などの不要なシステム分類語句を除去し、
 * タイトル保持者であれば「竜王・名人 (九段)」のようにタイトルと段位を併記、
 * 永世・名誉資格であれば「十七世名人 (九段)」「九段 (永世称号有資格者)」のように併記、
 * 段位のみであれば純粋な段位（例: 「九段」「女流三段」）を表示する。
 */
export function formatPlayerRankAndDan(player?: { rank?: string; danRank?: string; type?: string } | null): string {
  if (!player) return '';
  let rank = (player.rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
  let dan = (player.danRank || '').trim().replace(/１/g, '1').replace(/２/g, '2');

  // 「現役棋士」「女流棋士」「棋士」などの不要語句およびカッコ表記を除去
  rank = rank
    .replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '')
    .replace(/^(?:現役棋士|女流棋士|棋士)$/g, '')
    .trim();
  dan = dan
    .replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '')
    .replace(/^(?:現役棋士|女流棋士|棋士)$/g, '')
    .trim();

  if (!rank && !dan) {
    return player.type === 'women' ? '女流棋士' : '棋士';
  }
  if (!rank) return dan;
  if (!dan) return rank;

  // danがrankに既に含まれている場合（例: rank="九段", dan="九段" や rank="九段(永世称号有資格者)", dan="九段"）
  if (rank.includes(dan)) {
    return rank;
  }

  // 永世称号有資格者・クイーン称号有資格者の場合は「段位 (資格)」
  if (rank.includes('有資格者')) {
    return `${dan} (${rank})`;
  }

  // タイトルまたは永世・名誉称号と段位が両方存在する場合は「称号・タイトル (段位)」と併記
  const isTitleOrEisei =
    rank.includes('竜王') ||
    rank.includes('名人') ||
    rank.includes('王') ||
    rank.includes('棋') ||
    rank.includes('白玲') ||
    rank.includes('清麗') ||
    rank.includes('女王') ||
    rank.includes('倉敷藤花') ||
    rank.includes('永世') ||
    rank.includes('名誉') ||
    rank.includes('クイーン');

  const isValidDan = /([一二三四五六七八九]段|女流[初一二三四五六七八]段|女流[1-2１-２]級)/.test(dan);

  if (isTitleOrEisei && isValidDan) {
    return `${rank} (${dan})`;
  }

  return `${rank} (${dan})`;
}

/**
 * 段位のみを抽出して整形表示する（プロフィール表の「段位」行用）
 */
export function formatPlayerDanOnly(player?: { rank?: string; danRank?: string; type?: string } | null): string {
  if (!player) return '';
  let dan = (player.danRank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
  dan = dan
    .replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '')
    .replace(/^(?:現役棋士|女流棋士|棋士)$/g, '')
    .trim();

  let rank = (player.rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
  rank = rank
    .replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '')
    .replace(/^(?:現役棋士|女流棋士|棋士)$/g, '')
    .trim();

  if (dan && /([一二三四五六七八九]段|女流[初一二三四五六七八]段|女流[1-2１-２]級)/.test(dan)) {
    return dan;
  }
  const match = rank.match(/([一二三四五六七八九]段|女流[初一二三四五六七八]段|女流[1-2１-２]級)/);
  if (match) return match[1];

  return rank || dan || (player.type === 'women' ? '女流棋士' : '棋士');
}

/**
 * 棋士・女流棋士の番号プレフィックス（表示ラベル）を返す。
 * LPSA所属の女流棋士は "LPSA"、連盟等の女流棋士は "女流棋士"、棋士は "棋士"。
 * 例: "LPSA No.18"、"女流棋士 No.77"、"棋士 No.314"
 */
export function getPlayerNumberPrefix(player?: { type?: string; affiliation?: string } | null): string {
  if (!player) return '棋士';
  if (player.type === 'women') {
    return player.affiliation === 'LPSA' ? 'LPSA' : '女流棋士';
  }
  return '棋士';
}

/**
 * Normalizes shogi player name for fuzzy matching across scraped records,
 * taking into account variant kanji (e.g. 﨑 vs 崎, 齊/齋 vs 斉, 髙 vs 高, 德 vs 徳, 廣 vs 広).
 */
export function normalizeShogiPlayerNameForMatch(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFKC')
    .replace(/^pro-|^lady-|^player-/, '')
    .replace(/[※＊\*\+\(\)（）\d段級]/g, '')
    .replace(/[\s\u3000_]+/g, '')
    .replace(/[﨑嵜]/g, '崎')
    .replace(/[齊齋斉斎]/g, '斉')
    .replace(/[髙鬲]/g, '高')
    .replace(/[澤沢]/g, '沢')
    .replace(/[邊邉辺]/g, '辺')
    .replace(/[濱濵浜]/g, '浜')
    .replace(/[嶋島]/g, '島')
    .replace(/[德徳]/g, '徳')
    .replace(/[廣広]/g, '広')
    .replace(/[煕熙]/g, '熙')
    .replace(/[龍竜]/g, '竜')
    .replace(/[薗園]/g, '園')
    .replace(/[薮藪]/g, '薮')
    .replace(/[國国]/g, '国')
    .replace(/[塚塚]/g, '塚')
    .replace(/[櫻桜]/g, '桜')
    .replace(/[淸清]/g, '清')
    .replace(/[冨富]/g, '富')
    .replace(/[條条]/g, '条')
    .replace(/[眞真]/g, '真')
    .replace(/[莊荘]/g, '荘')
    .replace(/[惠恵]/g, '恵')
    .replace(/[禮礼]/g, '礼')
    .replace(/[關関]/g, '関')
    .replace(/[羽羽]/g, '羽')
    .replace(/[神神]/g, '神')
    .replace(/[福福]/g, '福')
    .replace(/[館館]/g, '館')
    .trim();
}

/**
 * Creates a safe fallback player object for unregistered players, amateurs,
 * or provisional tournament slots (e.g. '勝者', '〇〇戦の勝者', '〇〇アマ').
 */
export function createFallbackPlayer(rawIdOrName: string): Player {
  const cleanName = (rawIdOrName || '未定')
    .replace(/^pro-|^lady-|^player-/, '')
    .replace(/_/g, ' ')
    .trim();

  const isSumisaki =
    cleanName.includes('炭崎') ||
    cleanName.includes('炭﨑') ||
    rawIdOrName.includes('sumisaki') ||
    rawIdOrName.includes('346');
  const danMatch = cleanName.match(/([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級|アマ)/);
  const detectedDan = isSumisaki
    ? '四段'
    : danMatch
    ? danMatch[1]
    : cleanName.includes('アマ')
    ? 'アマ'
    : cleanName.includes('勝者')
    ? '進出枠'
    : '公式戦対局者';

  return {
    id: isSumisaki ? 'pro-toshiki_sumisaki' : rawIdOrName,
    name: isSumisaki ? '炭﨑 俊毅' : formatPlayerName(cleanName),
    type: cleanName.includes('女流') ? 'women' : 'pro',
    affiliation: cleanName.includes('LPSA') ? 'LPSA' : '日本将棋連盟',
    rank: detectedDan,
    danRank: detectedDan,
    playerNumber: isSumisaki ? 346 : 0,
    photoUrl: isSumisaki ? 'https://www.shogi.or.jp/images/pro/346.jpg' : undefined,
    birthDate: isSumisaki ? '2008年06月02日\n（18歳）' : '',
    birthPlace: isSumisaki ? '兵庫県姫路市' : '',
    master: isSumisaki ? '井上慶太九段' : '',
    style: '居飛車',
    ryuoClass: isSumisaki ? '第40期より' : '-',
    junisenClass: isSumisaki ? 'C級2組' : '-',
    heldTitles: [],
    totalTitles: 0,
    titleHistory: '',
    careerWins: isSumisaki ? 13 : 0,
    careerLosses: isSumisaki ? 7 : 0,
    careerWinRate: isSumisaki ? 0.65 : 0,
    currentYearWins: isSumisaki ? 12 : 0,
    currentYearLosses: isSumisaki ? 7 : 0,
    currentYearWinRate: isSumisaki ? 0.6316 : 0,
    currentYearStreak: 0,
    rankingInFederation: {},
    colorAccent: '#3b82f6',
    avatarBg: 'linear-gradient(135deg, #18181b 0%, #3b82f633 100%)',
    shortBio: isSumisaki
      ? '兵庫県姫路市出身。井上慶太九段門下。2024年に四段昇段（棋士番号346）。'
      : `${cleanName}（公式戦対局）`,
    highlights: isSumisaki ? ['日本将棋連盟所属 四段'] : [],
    yearRecords: isSumisaki ? [{ year: 2026, wins: 12, losses: 7, rate: 0.6316 }] : [],
    senteWinRate: 0.5,
    goteWinRate: 0.5,
    openingStats: [],
    headToHead: [],
    externalLinks: {
      officialProfile: isSumisaki
        ? 'https://www.shogi.or.jp/player/pro/346.html'
        : 'https://www.shogi.or.jp/',
      kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(
        isSumisaki ? '炭崎俊毅' : cleanName
      )}`,
    },
  };
}

/**
 * Resolves a player by ID or name against the players database.
 * If not found (e.g. amateur, provisional '勝者', student, etc.),
 * returns a safe, fully-typed Player object so modals and displays never crash or fail to open.
 */
export function resolvePlayer(id: string | undefined, players: Player[]): Player {
  const targetId = (id || '未定').trim();

  // 1. Direct ID match
  const byId = players.find((p) => p.id === targetId);
  if (byId) return byId;

  // 2. Direct name match (ignoring whitespace)
  const clean = targetId.replace(/^pro-|^lady-|^player-/, '').replace(/_/g, ' ').replace(/\s+/g, '');
  const byCleanName = players.find((p) => p.name.replace(/\s+/g, '') === clean);
  if (byCleanName) return byCleanName;

  // 3. Special check for Toshiki Sumizaki (pro-346 / sumisaki)
  if (
    targetId.includes('炭崎') ||
    targetId.includes('炭﨑') ||
    targetId.includes('sumisaki') ||
    targetId.includes('346')
  ) {
    const sumisaki = players.find(
      (p) =>
        p.playerNumber === 346 ||
        p.id === 'pro-toshiki_sumisaki' ||
        (p.name.includes('炭') && p.name.includes('俊毅'))
    );
    if (sumisaki) return sumisaki;
  }

  // 4. Normalized name match (fuzzy handling kanji variants like 﨑/崎, 齊/斉, 髙/高)
  const normTarget = normalizeShogiPlayerNameForMatch(clean);
  if (normTarget) {
    const byNorm = players.find((p) => {
      const pNorm = normalizeShogiPlayerNameForMatch(p.name);
      return pNorm === normTarget;
    });
    if (byNorm) return byNorm;

    // Former name match (e.g. 里見香奈 -> 福間香奈)
    const byFormerName = players.find((p) => p.formerName && normalizeShogiPlayerNameForMatch(p.formerName) === normTarget);
    if (byFormerName) return byFormerName;

    // Dynamic DB player_name_history lookup
    const mappedPlayerId = dynamicNameToPlayerId.get(normTarget);
    if (mappedPlayerId) {
      const byHistId = players.find((p) => p.id === mappedPlayerId);
      if (byHistId) return byHistId;
    }
  }

  const KNOWN_NAME_CHANGES: Record<string, string> = {
    '里見香奈': '福間香奈',
    '里見': '福間',
    '脇田菜々子': '萩田菜々子',
    '脇田': '萩田',
    '谷口由紀': '室谷由紀',
    '碓井涼子': '千葉涼子',
    '植村小百合': '本田小百合',
    '横山澄恵': '石高澄恵',
    '木村さゆり': '竹部さゆり',
    '藤森香織': '上川香織',
  };
  const mappedName = KNOWN_NAME_CHANGES[clean] || KNOWN_NAME_CHANGES[normTarget];
  if (mappedName) {
    const byMapped = players.find((p) => p.name.replace(/\s+/g, '') === mappedName || normalizeShogiPlayerNameForMatch(p.name) === normalizeShogiPlayerNameForMatch(mappedName));
    if (byMapped) return byMapped;
  }

  // 5. Fallback safe Player object
  return createFallbackPlayer(targetId);
}

/**
 * Normalizes, cleans, and initializes the player list on startup or sync.
 */
export function normalizeAndCleanPlayersList(stored: Player[] | null | undefined, staticData: Player[]): Player[] {
  if (!stored || stored.length === 0) {
    return staticData.map((p) => {
      const v = getPlayerTotalTitles(p);
      const withTitles = v > 0 && p.totalTitles !== v ? { ...p, totalTitles: v } : p;
      return initializePlayerRecords(withTitles);
    });
  }

  const storedMap = new Map(stored.map((p) => [p.id, p]));
  const result: Player[] = [];

  for (const s of stored) {
    const retired = isPlayerRetired(s);
    const cleaned: Player = {
      ...s,
      ...(retired ? { junisenClass: '', ryuoClass: '' } : {}),
    };
    result.push(initializePlayerRecords(cleaned));
  }

  for (const p of staticData) {
    if (!storedMap.has(p.id)) {
      const v = getPlayerTotalTitles(p);
      const withTitles = v > 0 && p.totalTitles !== v ? { ...p, totalTitles: v } : p;
      result.push(initializePlayerRecords(withTitles));
    }
  }

  return result;
}

export const EDITABLE_PLAYER_FIELDS = [
  'name',
  'formerName',
  'type',
  'affiliation',
  'rank',
  'danRank',
  'playerNumber',
  'style',
  'junisenClass',
  'ryuoClass',
  'heldTitles',
  'totalTitles',
  'currentYearWins',
  'currentYearLosses',
  'currentYearWinRate',
  'careerWins',
  'careerLosses',
  'careerWinRate',
  'birthDate',
  'birthPlace',
  'master',
  'photoUrl',
  'shortBio',
  'leaveInfo',
  'retirementDate',
  'bloodType',
  'motto',
  'favPiece',
  'achievements',
  'titleHistory',
  'eiseiTitles',
  'highlights',
] as const;

export const MANUAL_FIELD_LABELS: Record<string, string> = {
  name: '氏名',
  formerName: '旧氏名',
  type: '区分',
  affiliation: '所属',
  rank: '称号',
  danRank: '公式段位',
  playerNumber: '棋士/LPSA番号',
  style: '戦型',
  junisenClass: '順位戦クラス',
  ryuoClass: '竜王戦クラス',
  heldTitles: '保持タイトル',
  totalTitles: 'タイトル獲得合計',
  currentYearWins: '今年度勝',
  currentYearLosses: '今年度敗',
  currentYearWinRate: '今年度勝率',
  careerWins: '通算勝',
  careerLosses: '通算敗',
  careerWinRate: '通算勝率',
  birthDate: '生年月日',
  birthPlace: '出身地',
  master: '師匠',
  photoUrl: '顔写真URL',
  shortBio: '短評',
  leaveInfo: '休場情報',
  retirementDate: '引退年月日',
  bloodType: '血液型',
  motto: '座右の銘',
  favPiece: '好きな駒',
  achievements: '主な戦績',
  titleHistory: 'タイトル履歴',
  eiseiTitles: '永世・クイーン称号',
  highlights: '注目実績',
};

function normalizeRankForCompare(rank?: string | null): string {
  let clean = String(rank || '')
    .trim()
    .replace(/１/g, '1')
    .replace(/２/g, '2');
  if (/^[一二三四五六七八九]段$|^女流[1-2]級$|^女流[初一二三四五六七八]段$/.test(clean)) {
    return '';
  }
  if (clean.includes('(永世称号有資格者)')) return '永世称号有資格者';
  if (clean.includes('(クイーン称号有資格者)')) return 'クイーン称号有資格者';
  return clean;
}

function normalizeLeaveForCompare(leave?: Player['leaveInfo'] | null): string {
  if (!leave) return 'false|||';
  const isOn = Boolean(leave.isOnLeave);
  const start = normalizeDateToYyyyMmDd(leave.startDate || '');
  const end = normalizeDateToYyyyMmDd(leave.endDate || '');
  const reason = (leave.reason || '').trim();
  if (!isOn && !start && !end && !reason) return 'false|||';
  return `${isOn}|${start}|${end}|${reason}`;
}

function normalizeFieldForCompare(field: string, value: unknown): string {
  switch (field) {
    case 'birthDate':
    case 'retirementDate':
      return normalizeDateToYyyyMmDd(typeof value === 'string' ? value : '');
    case 'rank':
      return normalizeRankForCompare(typeof value === 'string' ? value : '');
    case 'danRank':
      return String(value || '').trim().replace(/１/g, '1').replace(/２/g, '2');
    case 'leaveInfo':
      return normalizeLeaveForCompare(value as Player['leaveInfo']);
    case 'heldTitles':
    case 'eiseiTitles':
    case 'highlights':
      return JSON.stringify(
        Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : []
      );
    case 'playerNumber':
      return value === undefined || value === null || value === '' ? '' : String(Number(value));
    case 'totalTitles':
    case 'currentYearWins':
    case 'currentYearLosses':
    case 'careerWins':
    case 'careerLosses':
      return String(Number(value) || 0);
    case 'currentYearWinRate':
    case 'careerWinRate':
      return String(Math.round((Number(value) || 0) * 10000));
    case 'shortBio':
      return String(value || '').replace(/現在は休場中。?/g, '').trim();
    default:
      return String(value ?? '').trim();
  }
}

/**
 * Detects which editable fields were manually modified compared to the previous persisted player record.
 */
export function detectManualFieldChanges(
  prev: Partial<Player> | undefined,
  next: Partial<Player>
): string[] {
  const changed = new Set<string>(Array.isArray(prev?.manualFields) ? prev!.manualFields! : []);
  if (Array.isArray(next.manualFields)) {
    for (const f of next.manualFields) {
      if (f) changed.add(f);
    }
  }

  if (!prev) {
    for (const field of EDITABLE_PLAYER_FIELDS) {
      const val = (next as any)[field];
      if (val !== undefined && val !== null && normalizeFieldForCompare(field, val) !== '') {
        changed.add(field);
      }
    }
    return Array.from(changed);
  }

  for (const field of EDITABLE_PLAYER_FIELDS) {
    if (!(field in next)) continue;
    const prevNorm = normalizeFieldForCompare(field, (prev as any)[field]);
    const nextNorm = normalizeFieldForCompare(field, (next as any)[field]);
    if (prevNorm !== nextNorm) {
      changed.add(field);
    }
  }

  // If user edited wins/losses manually, keep derived rates consistent as manual
  if (changed.has('careerWins') || changed.has('careerLosses')) {
    changed.add('careerWinRate');
  }
  if (changed.has('currentYearWins') || changed.has('currentYearLosses')) {
    changed.add('currentYearWinRate');
  }

  return Array.from(changed);
}

/**
 * Merges incoming (scraped or bulk-synced) player fields onto an existing player while strictly
 * preserving every field listed in existing.manualFields (never overwriting manual user edits).
 */
export function mergePreservingManualFields(prev: Player, incoming: Partial<Player>): Player {
  const manualList = Array.from(
    new Set([
      ...(Array.isArray(prev.manualFields) ? prev.manualFields : []),
      ...(Array.isArray(incoming.manualFields) ? incoming.manualFields : []),
    ])
  ).filter(Boolean);

  const merged: Player = {
    ...prev,
    ...incoming,
    id: prev.id || incoming.id || '',
    formerName:
      manualList.includes('formerName')
        ? prev.formerName
        : (incoming.formerName || prev.formerName),
    leaveInfo:
      manualList.includes('leaveInfo')
        ? prev.leaveInfo
        : (incoming.leaveInfo || prev.leaveInfo),
    yearRecords:
      incoming.yearRecords && incoming.yearRecords.length > 0
        ? incoming.yearRecords
        : (prev.yearRecords || []),
  };

  for (const field of manualList) {
    if (field in prev && (prev as any)[field] !== undefined) {
      (merged as any)[field] = (prev as any)[field];
    } else if (field === 'formerName' || field === 'retirementDate' || field === 'photoUrl') {
      delete (merged as any)[field];
    } else if (field === 'birthDate' || field === 'birthPlace' || field === 'master' || field === 'rank' || field === 'shortBio') {
      (merged as any)[field] = (prev as any)[field] ?? '';
    }
  }

  if (manualList.length > 0) {
    merged.manualFields = manualList;
  } else {
    delete merged.manualFields;
  }

  return merged;
}



