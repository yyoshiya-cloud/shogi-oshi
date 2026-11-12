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

export function isPlayerOnLeave(player: { highlights?: string[]; shortBio?: string; name?: string }): boolean {
  if (player.highlights && player.highlights.some(h => h.includes('休場'))) return true;
  if (player.shortBio && player.shortBio.includes('休場中')) return true;
  const nameClean = player.name ? player.name.replace(/[\s\u3000※＊\*]/g, '') : '';
  if (nameClean.includes('山田朱未') || nameClean.includes('早水千紗') || nameClean.includes('井道千尋')) return true;
  return false;
}

/**
 * Checks if a player is officially retired.
 * Correctly ignores lifetime title notes like "就位は原則引退後" or "引退後に就位".
 */
export function isPlayerRetired(player: { rank?: string; shortBio?: string; titleHistory?: string; highlights?: string[] }): boolean {
  if (!player) return false;

  // 1. Explicit rank check (e.g. "引退", "引退九段", "引退棋士", "引退女流...")
  if (player.rank && player.rank.includes('引退')) {
    return true;
  }

  // 2. ShortBio check: look for explicit retirement statements, excluding "就位は原則引退後" / "引退後"
  if (player.shortBio) {
    const cleanBio = player.shortBio.replace(/就位は原則引退後|引退後に就位|引退後/g, '');
    if (cleanBio.includes('引退棋士') || cleanBio.includes('引退女流棋士') || cleanBio.includes('現役引退') || cleanBio.includes('引退発表') || cleanBio.includes('正式に引退')) {
      return true;
    }
  }

  // 3. Highlights check
  if (player.highlights && player.highlights.length > 0) {
    for (const h of player.highlights) {
      const cleanH = h.replace(/就位は原則引退後|引退後に就位|引退後/g, '');
      if (cleanH.includes('現役引退') || cleanH.includes('引退決定') || cleanH.includes('引退表明')) {
        return true;
      }
    }
  }

  return false;
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
  const nameClean = p.name ? p.name.replace(/[\s\u3000※＊\*]/g, '') : '';
  if (nameClean.includes('山田朱未')) {
    return {
      ...p,
      careerWins: 104,
      careerLosses: 117,
      careerWinRate: 0.471,
      currentYearWins: 0,
      currentYearLosses: 0,
      currentYearWinRate: 0,
      yearRecords: (p.yearRecords || []).map(yr => ({ ...yr, wins: 0, losses: 0, rate: 0 })),
      highlights: ['休場中'],
      shortBio: '現在は休場中。',
    };
  }
  if (nameClean.includes('早水千紗')) {
    return {
      ...p,
      careerWins: 195,
      careerLosses: 182,
      careerWinRate: 0.517,
      currentYearWins: 0,
      currentYearLosses: 0,
      currentYearWinRate: 0,
      yearRecords: (p.yearRecords || []).map(yr => ({ ...yr, wins: 0, losses: 0, rate: 0 })),
      highlights: ['休場中'],
      shortBio: '現在は休場中。',
    };
  }
  if (nameClean.includes('井道千尋')) {
    return {
      ...p,
      careerWins: 125,
      careerLosses: 149,
      careerWinRate: 0.456,
      currentYearWins: 0,
      currentYearLosses: 0,
      currentYearWinRate: 0,
      yearRecords: (p.yearRecords || []).map(yr => ({ ...yr, wins: 0, losses: 0, rate: 0 })),
      highlights: ['休場中'],
      shortBio: '現在は休場中。',
    };
  }
  if (nameClean.includes('中倉宏美')) {
    return {
      ...p,
      junisenClass: 'フリークラス',
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
      return {
        ...p,
        junisenClass: p.junisenClass || val.junisenClass,
        ryuoClass: p.ryuoClass || val.ryuoClass,
        ...(isFurui ? { currentYearWins: 5, currentYearLosses: 5, currentYearWinRate: 0.5, careerWins: 5, careerLosses: 5, careerWinRate: 0.5 } : {}),
        ...(isSumisaki ? { currentYearWins: 13, currentYearLosses: 7, currentYearWinRate: 0.65, careerWins: 13, careerLosses: 7, careerWinRate: 0.65 } : {}),
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

/**
 * 棋士・女流棋士の肩書・段位を整形表示する。
 * 「現役棋士」「女流棋士」などの不要なシステム分類語句を除去し、
 * タイトル保持者であれば「竜王・名人 (九段)」のようにタイトルと段位を併記、
 * タイトル保持者でなければ純粋な段位・称号（例: 「九段」「九段(永世称号有資格者)」「女流三段」）のみを表示する。
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

  // rankがタイトル（竜王、名人、王位、叡王、白玲、女王など）でdanが有効な段位（九段、女流五段など）の場合のみ「タイトル (段位)」と併記
  const isTitleRank =
    rank.includes('竜王') ||
    rank.includes('名人') ||
    rank.includes('王') ||
    rank.includes('棋') ||
    rank.includes('白玲') ||
    rank.includes('清麗') ||
    rank.includes('女王') ||
    rank.includes('倉敷藤花');

  const isValidDan = /([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級)/.test(dan);

  if (isTitleRank && isValidDan) {
    return `${rank} (${dan})`;
  }

  return rank;
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

  if (dan && /([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級)/.test(dan)) {
    return dan;
  }
  const match = rank.match(/([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級)/);
  if (match) return match[1];

  return rank || dan || (player.type === 'women' ? '女流棋士' : '棋士');
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
  }

  // 5. Fallback safe Player object
  return createFallbackPlayer(targetId);
}

import { getPlayerTotalTitles } from './titleUtils';
import { initializePlayerRecords } from './yearRecordsGenerator';
import { saveStoredPlayers } from './storage';

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

  const storedIds = new Set(stored.map((p) => p.id));
  const missingStatic = staticData.filter((p) => !storedIds.has(p.id));
  const staticMap = new Map(staticData.map((p) => [p.id, p]));

  const needsLpsaOrNakaiUpdate = stored.some((p) => {
    if (p.id === 'nakai-hiroe' && (p.careerWins < 780 || p.currentYearWins !== 9)) return true;
    if (p.id === 'watanabe-mana' && (p.careerWins < 240 || p.currentYearWins !== 2)) return true;
    if (p.affiliation === 'LPSA' && (p.careerWins === 0 || !p.careerWins)) return true;
    if (p.name && (p.name.includes('※') || p.name.includes('＊') || p.name.includes('*'))) return true;
    return false;
  });

  const needsTitleUpdate = stored.some((p) => {
    const verified = getPlayerTotalTitles(p);
    return verified > 0 && p.totalTitles !== verified;
  });

  const needs2025Restore = stored.some((p) => {
    const r2025 = (p.yearRecords || []).find((r) => r.year === 2025);
    return (
      (p.id === 'fujii-sota' || p.id === 'ito-takumi' || p.id === 'habu-yoshiharu') &&
      (!r2025 || (r2025.wins === 0 && r2025.losses === 0))
    );
  });

  const needsLeaveStatsUpdate = stored.some((p) => {
    if (p.name && p.name.includes('山田朱未') && p.careerWins < 104) return true;
    if (p.name && p.name.includes('早水千紗') && p.careerWins < 195) return true;
    if (p.name && p.name.includes('井道千尋') && p.careerWins < 125) return true;
    return false;
  });

  const needsClassUpdate = stored.some((p) => {
    const staticP = staticMap.get(p.id);
    if (!staticP) return false;
    return (
      p.junisenClass === '順位戦参加' ||
      p.ryuoClass === '竜王戦参加' ||
      (p.id === 'pro-koji_tanigawa' && p.junisenClass === '名人') ||
      (staticP.junisenClass && p.junisenClass !== staticP.junisenClass) ||
      (staticP.ryuoClass && p.ryuoClass !== staticP.ryuoClass)
    );
  });

  const needsCleanup =
    missingStatic.length > 0 ||
    needsLpsaOrNakaiUpdate ||
    needsTitleUpdate ||
    needs2025Restore ||
    needsLeaveStatsUpdate ||
    needsClassUpdate ||
    stored.some(
      (p) =>
        (p.danRank && (p.danRank.includes('現役') || p.danRank === '棋士' || p.danRank === '女流棋士')) ||
        (p.rank && p.rank.includes('現役棋士')) ||
        (p.name && !p.name.includes(' ') && !p.name.includes('\u3000') && p.name.length >= 3) ||
        (p.rank && p.rank.length > 25) ||
        (p.rank && (p.rank.includes('１') || p.rank.includes('２'))) ||
        (p.heldTitles && p.heldTitles.some((t) => t.includes('段') || t.includes('級'))) ||
        (!p.danRank &&
          (p.id === 'fujii-sota' ||
            p.id === 'ito-takumi' ||
            p.id === 'nishiyama-tomoka' ||
            p.id === 'fukuma-kana' ||
            p.id === 'shimizu-ichiyo'))
    );

  if (needsCleanup) {
    const cleaned = [...stored, ...missingStatic].map((p) => {
      let name = p.name ? formatPlayerName(p.name) : p.name;
      let rank = p.rank || (p.type === 'women' ? '女流棋士' : '棋士');
      rank = rank.replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '').trim();
      rank = rank.replace(/１/g, '1').replace(/２/g, '2');
      if (rank.length > 25) {
        const m = rank.match(/([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級|竜王|名人)/);
        rank = m ? m[1].replace(/１/g, '1').replace(/２/g, '2') : p.type === 'women' ? '女流棋士' : '棋士';
      }
      if (rank === '現役棋士') {
        rank = p.type === 'women' ? '女流棋士' : '棋士';
      }
      const validHeldTitles = (p.heldTitles || []).filter((t) => !t.includes('段') && !t.includes('級'));
      let danRank = p.danRank;
      if (danRank) {
        danRank = danRank.replace(/[\(（](?:現役棋士|女流棋士|棋士)[\)）]/g, '').trim();
        if (danRank === '現役棋士' || danRank === '女流棋士' || danRank === '棋士') {
          danRank = undefined;
        }
      }
      if (p.id === 'habu-yoshiharu' || p.name.includes('羽生 善治')) {
        rank = '九段';
        danRank = '九段';
      }
      if (p.id === 'pro-toshiyuki_moriuchi' || p.name.includes('森内 俊之')) {
        rank = '九段(永世称号有資格者)';
        danRank = '九段';
      }
      if (!danRank) {
        if (p.id === 'fujii-sota' || p.name.includes('藤井 聡太')) danRank = '九段';
        else if (p.id === 'ito-takumi' || p.name.includes('伊藤 匠')) danRank = '九段';
        else if (p.id === 'nishiyama-tomoka' || p.name.includes('西山 朋佳')) danRank = '女流五段';
        else if (p.id === 'fukuma-kana' || p.name.includes('福間 香奈')) danRank = '女流六段';
        else if (p.id === 'shimizu-ichiyo' || p.name.includes('清水 市代')) danRank = '女流七段';
      }
      const verifiedTitles = getPlayerTotalTitles(p);
      const totalTitles = verifiedTitles > 0 ? verifiedTitles : p.totalTitles || 0;
      const staticP = staticMap.get(p.id);
      let careerWins = p.careerWins;
      let careerLosses = p.careerLosses;
      let careerWinRate = p.careerWinRate;
      let currentYearWins = p.currentYearWins;
      let currentYearLosses = p.currentYearLosses;
      let currentYearWinRate = p.currentYearWinRate;
      if (staticP && (p.id === 'nakai-hiroe' || p.affiliation === 'LPSA')) {
        if (p.id === 'nakai-hiroe' && (careerWins < 780 || currentYearWins !== 9)) {
          careerWins = staticP.careerWins;
          careerLosses = staticP.careerLosses;
          careerWinRate = staticP.careerWinRate;
          currentYearWins = staticP.currentYearWins;
          currentYearLosses = staticP.currentYearLosses;
          currentYearWinRate = staticP.currentYearWinRate;
        } else if (
          p.affiliation === 'LPSA' &&
          (!careerWins || careerWins < staticP.careerWins || currentYearWins !== staticP.currentYearWins)
        ) {
          careerWins = staticP.careerWins;
          careerLosses = staticP.careerLosses;
          careerWinRate = staticP.careerWinRate;
          currentYearWins = staticP.currentYearWins;
          currentYearLosses = staticP.currentYearLosses;
          currentYearWinRate = staticP.currentYearWinRate;
        }
      }
      let junisenClass = p.junisenClass;
      let ryuoClass = p.ryuoClass;
      if (staticP) {
        junisenClass = staticP.junisenClass || junisenClass;
        ryuoClass = staticP.ryuoClass || ryuoClass;
      }
      return {
        ...p,
        name,
        rank,
        danRank,
        heldTitles: validHeldTitles,
        totalTitles,
        careerWins,
        careerLosses,
        careerWinRate,
        currentYearWins,
        currentYearLosses,
        currentYearWinRate,
        junisenClass: junisenClass || p.junisenClass,
        ryuoClass: ryuoClass || p.ryuoClass,
      };
    });
    const fullyInitialized = cleaned.map(initializePlayerRecords);
    saveStoredPlayers(fullyInitialized);
    return fullyInitialized;
  }

  return stored.map((p) => {
    const v = getPlayerTotalTitles(p);
    const withTitles = v > 0 && p.totalTitles !== v ? { ...p, totalTitles: v } : p;
    return initializePlayerRecords(withTitles);
  });
}


