/**
 * Utility functions for formatting player names, birthdates, and calculating ages.
 */

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
export function calculateAge(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const mDiff = (today.getMonth() + 1) - month;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}

/**
 * Formats a birthdate string into "YYYY年MM月DD日\n（XX歳）".
 * Handles YYYY-MM-DD, YYYY/MM/DD, and YYYY年MM月DD日 formats.
 */
export function formatBirthDateWithAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return '公式名鑑参照';

  const clean = birthDateStr.trim();

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

import { Player } from '../types/shogi';

export function applyPlayerOverrides(p: Player): Player {
  const nameClean = p.name ? p.name.replace(/[\s\u3000※＊\*]/g, '') : '';
  if (nameClean.includes('早水千紗') || nameClean.includes('山田朱未')) {
    return {
      ...p,
      careerWins: 0,
      careerLosses: 0,
      careerWinRate: 0,
      currentYearWins: 0,
      currentYearLosses: 0,
      currentYearWinRate: 0,
      yearRecords: (p.yearRecords || []).map(yr => ({ ...yr, wins: 0, losses: 0, rate: 0 })),
      highlights: ['休場中'],
      shortBio: `${p.affiliation || '日本将棋連盟'}所属の女流棋士（${p.rank}）。現在は休場中。`,
    };
  }
  if (nameClean.includes('中倉宏美')) {
    return {
      ...p,
      junisenClass: 'フリークラス',
    };
  }
  if (nameClean.includes('島井咲緒里')) {
    return {
      ...p,
      junisenClass: '',
      highlights: [...(p.highlights || []), '2026年7月6日引退'],
      shortBio: `元日本女子プロ将棋協会（LPSA）所属の女流棋士（${p.rank}）。2026年7月6日付で引退。`,
    };
  }
  return p;
}
