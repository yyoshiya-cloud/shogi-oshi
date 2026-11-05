import { Player } from '../types/shogi';

/**
 * 日本将棋連盟およびLPSA公式記録に基づく
 * 歴代・現役棋士および女流棋士の通算主要タイトル獲得期数完全マスター
 */
const KNOWN_CAREER_TITLES: Record<string, number> = {
  // --- 棋士（男性プロ） ---
  '羽生善治': 99,
  '渡辺明': 31,
  '藤井聡太': 28,
  '谷川浩司': 27,
  '佐藤康光': 13,
  '森内俊之': 12,
  '加藤一二三': 8,
  '久保利明': 7,
  '南芳一': 7,
  '豊島将之': 6,
  '郷田真隆': 6,
  '高橋道雄': 5,
  '永瀬拓矢': 5,
  '内藤國雄': 4,
  '丸山忠久': 3,
  '深浦康市': 3,
  '屋敷伸之': 3,
  '藤井猛': 3,
  '広瀬章人': 2,
  '中村修': 2,
  '福崎文吾': 2,
  '森けい二': 2,
  '森雞二': 2,
  '島朗': 1,
  '塚田泰明': 1,
  '田中寅彦': 1,
  '木村一基': 1,
  '菅井竜也': 1,
  '中村太地': 1,
  '斎藤慎太郎': 1,
  '高見泰地': 1,
  '伊藤匠': 1,

  // --- 女流棋士 ---
  '福間香奈': 61,
  '里見香奈': 61,
  '清水市代': 43,
  '中井広恵': 19,
  '西山朋佳': 19,
  '加藤桃子': 9,
  '甲斐智美': 7,
  '矢内理絵子': 6,
  '蛸島彰子': 7,
  '斎田晴子': 4,
  '香川愛生': 2,
  '伊藤沙恵': 1,
  '渡部愛': 1,
  '山下カズ子': 1,
};

/**
 * 棋士番号・女流棋士番号による通算タイトル獲得期数マスター
 */
const KNOWN_CAREER_TITLES_BY_NUMBER: Record<number, number> = {
  // 棋士
  1307: 28, // 藤井聡太
  175: 99,  // 羽生善治
  235: 31,  // 渡辺明
  131: 27,  // 谷川浩司
  182: 13,  // 佐藤康光
  183: 12,  // 森内俊之
  147: 7,   // 南芳一
  207: 7,   // 久保利明
  264: 6,   // 豊島将之
  195: 6,   // 郷田真隆
  142: 5,   // 高橋道雄
  276: 5,   // 永瀬拓矢
  194: 3,   // 丸山忠久
  201: 3,   // 深浦康市
  189: 3,   // 屋敷伸之
  198: 3,   // 藤井猛
  255: 2,   // 広瀬章人
  143: 2,   // 中村修
  135: 2,   // 福崎文吾
  146: 1,   // 島朗
  148: 1,   // 塚田泰明
  222: 1,   // 木村一基
  278: 1,   // 菅井竜也
  261: 1,   // 中村太地
  286: 1,   // 斎藤慎太郎
  284: 1,   // 高見泰地
  324: 1,   // 伊藤匠
};

/**
 * 棋士・女流棋士の通算タイトル獲得期数を即座に確定して取得
 */
export function getPlayerTotalTitles(player?: Partial<Player> | null): number {
  if (!player) return 0;
  const explicit = player.totalTitles && player.totalTitles > 0 ? player.totalTitles : 0;

  const cleanName = (player.name || '').replace(/\s+/g, '').replace(/[※＊\*\(\)（）]/g, '');
  if (KNOWN_CAREER_TITLES[cleanName] !== undefined) {
    return Math.max(explicit, KNOWN_CAREER_TITLES[cleanName]);
  }
  if (player.id && KNOWN_CAREER_TITLES[player.id] !== undefined) {
    return Math.max(explicit, KNOWN_CAREER_TITLES[player.id]);
  }
  if (player.playerNumber && KNOWN_CAREER_TITLES_BY_NUMBER[player.playerNumber] !== undefined) {
    return Math.max(explicit, KNOWN_CAREER_TITLES_BY_NUMBER[player.playerNumber]);
  }
  return explicit;
}

const KNOWN_EISEI_PLAYERS = new Set([
  '藤井聡太',
  '羽生善治',
  '渡辺明',
  '谷川浩司',
  '佐藤康光',
  '森内俊之',
  '中原誠',
  '加藤一二三',
  '米長邦雄',
  '大山康晴',
  '木村義雄',
  '塚田正夫',
  '清水市代',
  '中井広恵',
  '福間香奈',
  '里見香奈',
  '西山朋佳',
]);

export interface EiseiCriterion {
  eiseiName: string;
  tournamentName: string;
  titleName: string;
  conditionText: string;
  minTotal?: number;
  minConsecutive?: number;
}

/**
 * 棋士（男性プロ）の永世称号獲得規定（全主要タイトル）
 */
export const MEN_EISEI_TITLES_CRITERIA: EiseiCriterion[] = [
  {
    eiseiName: '永世竜王',
    tournamentName: '竜王戦',
    titleName: '竜王',
    conditionText: '連続5期もしくは通算7期',
    minConsecutive: 5,
    minTotal: 7,
  },
  {
    eiseiName: '永世名人',
    tournamentName: '名人戦',
    titleName: '名人',
    conditionText: '通算5期',
    minTotal: 5,
  },
  {
    eiseiName: '永世十段',
    tournamentName: '十段戦',
    titleName: '十段',
    conditionText: '通算10期',
    minTotal: 10,
  },
  {
    eiseiName: '永世王位',
    tournamentName: '王位戦',
    titleName: '王位',
    conditionText: '連続5期もしくは通算10期',
    minConsecutive: 5,
    minTotal: 10,
  },
  {
    eiseiName: '永世叡王',
    tournamentName: '叡王戦',
    titleName: '叡王',
    conditionText: '通算5期',
    minTotal: 5,
  },
  {
    eiseiName: '名誉王座',
    tournamentName: '王座戦',
    titleName: '王座',
    conditionText: '連続5期もしくは通算10期',
    minConsecutive: 5,
    minTotal: 10,
  },
  {
    eiseiName: '永世棋王',
    tournamentName: '棋王戦',
    titleName: '棋王',
    conditionText: '連続5期',
    minConsecutive: 5,
  },
  {
    eiseiName: '永世王将',
    tournamentName: '王将戦',
    titleName: '王将',
    conditionText: '通算10期',
    minTotal: 10,
  },
  {
    eiseiName: '永世棋聖',
    tournamentName: '棋聖戦',
    titleName: '棋聖',
    conditionText: '通算5期',
    minTotal: 5,
  },
];

export interface WomenEiseiCriterion {
  eiseiName: string;
  tournamentName: string;
  titleName: string;
  conditionText: string;
  minTotal: number;
  minConsecutive?: number;
}

/**
 * 女流棋士の永世称号獲得規定（全8主要女流タイトル）
 */
export const WOMEN_EISEI_TITLES_CRITERIA: WomenEiseiCriterion[] = [
  {
    eiseiName: 'クイーン白玲',
    tournamentName: 'ヒューリック杯白玲戦',
    titleName: '白玲',
    conditionText: '白玲 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: 'クイーン清麗',
    tournamentName: '大成建設杯清麗戦',
    titleName: '清麗',
    conditionText: '清麗 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: '永世女王',
    tournamentName: 'マイナビ女子オープン',
    titleName: '女王',
    conditionText: 'マイナビ女子オープン 女王 連続5期または通算7期',
    minTotal: 7,
    minConsecutive: 5,
  },
  {
    eiseiName: 'クイーン王座',
    tournamentName: 'リコー杯女流王座戦',
    titleName: '女流王座',
    conditionText: '女流王座 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: 'クイーン名人',
    tournamentName: '岡田美術館杯女流名人戦',
    titleName: '女流名人',
    conditionText: '女流名人 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: 'クイーン王位',
    tournamentName: '大島眼科グループ杯女流王位戦',
    titleName: '女流王位',
    conditionText: '女流王位 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: 'クイーン倉敷藤花',
    tournamentName: '大山名人杯倉敷藤花戦',
    titleName: '倉敷藤花',
    conditionText: '倉敷藤花戦 通算5期',
    minTotal: 5,
  },
  {
    eiseiName: 'クイーン王将',
    tournamentName: '霧島酒造杯女流王将戦',
    titleName: '女流王将',
    conditionText: '女流王将 通算5期',
    minTotal: 5,
  },
];

export const KNOWN_EISEI_TITLES_MAP: Record<string, string[]> = {
  '羽生善治': ['永世七冠', '十九世名人資格者', '永世竜王', '永世王位', '名誉王座', '永世棋聖', '永世棋王', '永世王将', '名誉NHK杯選手権者'],
  '藤井聡太': ['永世三冠有資格', '永世竜王', '永世王位', '永世棋聖'],
  '渡辺明': ['永世二冠', '永世竜王', '永世棋王'],
  '谷川浩司': ['十七世名人', '永世王位'],
  '森内俊之': ['十八世名人資格者'],
  '佐藤康光': ['永世棋聖'],
  '福間香奈': ['クイーン六冠', 'クイーン清麗', 'クイーン王座', 'クイーン名人', 'クイーン王位', 'クイーン王将', 'クイーン倉敷藤花'],
  '里見香奈': ['クイーン六冠', 'クイーン清麗', 'クイーン王座', 'クイーン名人', 'クイーン王位', 'クイーン王将', 'クイーン倉敷藤花'],
  '西山朋佳': ['クイーン白玲', '永世女王', 'クイーン王将'],
  '清水市代': ['クイーン四冠', 'クイーン名人', 'クイーン王将', 'クイーン王位', 'クイーン倉敷藤花'],
  '中井広恵': ['クイーン名人'],
};

/**
 * 棋士・女流棋士が永世称号（永世資格・クイーン称号・名誉称号）を保持・獲得しているかを判定
 */
export function isEiseiPlayer(player?: Partial<Player> | null): boolean {
  if (!player) return false;
  const cleanName = (player.name || '').replace(/\s+/g, '').replace(/[※＊\*\(\)（）]/g, '');

  // 永世資格を持たない棋士（師匠が永世称号保持者などの誤認防止）
  if (cleanName === '都成竜馬' || player.id === 'pro-ryuuma_tonari') return false;

  // 既知の永世称号保持者・有資格者マスター
  if (KNOWN_EISEI_PLAYERS.has(cleanName)) return true;

  // タイトル未獲得の棋士・女流棋士は永世資格を持ち得ない
  const totalTitles = getPlayerTotalTitles(player);
  if (totalTitles === 0 && (!player.rank || !player.rank.includes('世名人'))) return false;

  if (player.eiseiTitles && player.eiseiTitles.length > 0) {
    // 誤って師匠の称号が入っている場合は除外
    const valid = player.eiseiTitles.filter(t => !t.includes('師匠') && !t.includes('門下'));
    if (valid.length > 0) return true;
  }

  // 自身の段位・タイトル履歴のみ検査（師匠やバイオグラフィーは除外）
  const selfText = `${player.rank || ''} ${player.danRank || ''} ${player.titleHistory || ''}`;
  return /永世|クイーン|[十[一二三四五六七八九]世名人/.test(selfText);
}

/**
 * 棋士・女流棋士の永世資格・クイーン称号のリストを取得
 */
export function getPlayerEiseiTitles(player?: Partial<Player> | null): string[] {
  if (!player) return [];
  const cleanName = (player.name || '').replace(/\s+/g, '').replace(/[※＊\*\(\)（）]/g, '');

  // 永世資格を持たない棋士（師匠が永世称号保持者などの誤認防止）
  if (cleanName === '都成竜馬' || player.id === 'pro-ryuuma_tonari') return [];

  // 公式マスターマップに登録されている確実な称号
  if (KNOWN_EISEI_TITLES_MAP[cleanName]) {
    return KNOWN_EISEI_TITLES_MAP[cleanName];
  }

  // タイトル未獲得の棋士・女流棋士は永世資格を持ち得ない
  const totalTitles = getPlayerTotalTitles(player);
  if (totalTitles === 0 && (!player.rank || !player.rank.includes('世名人'))) return [];

  if (player.eiseiTitles && player.eiseiTitles.length > 0) {
    const valid = player.eiseiTitles.filter(t => !t.includes('師匠') && !t.includes('門下') && !t.includes('名誉九段'));
    if (valid.length > 0) return valid;
  }

  const found: string[] = [];
  // 自身の段位とタイトル獲得履歴のみを対象とし、師匠名が含まれうるshortBioやhighlightsを避ける
  const text = `${player.rank || ''} ${player.danRank || ''} ${player.titleHistory || ''}`;
  const matches = text.match(/(永世[^\s（(、。]+|[十[一二三四五六七八九]世名人(?:資格者)?|クイーン[^\s（(、。]+|名誉NHK杯選手権者)/g);
  if (matches) {
    for (const m of matches) {
      const clean = m.trim();
      if (!clean.includes('名誉九段') && !clean.includes('名誉会員') && !clean.includes('師匠') && !found.includes(clean)) {
        found.push(clean);
      }
    }
  }
  return found;
}

/**
 * タイトル獲得履歴・期数を規定に基づき自動検査し、獲得永世称号・クイーン称号のリストを返す
 */
export function evaluatePlayerEiseiTitles(player?: Partial<Player> | null): string[] {
  if (!player) return [];
  const cleanName = (player.name || '').replace(/\s+/g, '').replace(/[※＊\*\(\)（）]/g, '');

  if (cleanName === '都成竜馬' || player.id === 'pro-ryuuma_tonari') return [];

  const text = `${player.rank || ''} ${player.danRank || ''} ${player.titleHistory || ''}`;
  const criteriaList = player.type === 'women' ? WOMEN_EISEI_TITLES_CRITERIA : MEN_EISEI_TITLES_CRITERIA;
  const found: string[] = [];

  for (const item of criteriaList) {
    const regex = new RegExp(`${item.titleName}\\s*(\\d+)期`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const count = parseInt(match[1], 10);
      let qualified = false;
      if (item.minTotal !== undefined && count >= item.minTotal) {
        qualified = true;
      }
      const blockText = text.slice(match.index, match.index + 120);
      if (item.minConsecutive !== undefined && (blockText.includes('連続') || blockText.includes('〜') || blockText.includes('～'))) {
        if (count >= item.minConsecutive) {
          qualified = true;
        }
      }
      if (qualified && !found.includes(item.eiseiName)) {
        found.push(item.eiseiName);
      }
    }
  }

  if (player.eiseiTitles && player.eiseiTitles.length > 0) {
    player.eiseiTitles.forEach(t => {
      if (!t.includes('師匠') && !t.includes('門下') && !found.includes(t)) {
        found.push(t);
      }
    });
  }

  return found;
}

/**
 * 永世資格のサマリーバッジ表示用テキストを取得（例: "永世七冠", "永世三冠", "十七世名人", "クイーン六冠"）
 */
export function formatEiseiBadgeLabel(player?: Partial<Player> | null): string | null {
  if (!player) return null;
  const cleanName = (player.name || '').replace(/\s+/g, '').replace(/[※＊\*\(\)（）]/g, '');
  if (cleanName === '羽生善治') return '永世七冠';
  if (cleanName === '藤井聡太') return '永世三冠';
  if (cleanName === '谷川浩司') return '十七世名人・永世王位';
  if (cleanName === '森内俊之') return '十八世名人資格';
  if (cleanName === '佐藤康光') return '永世棋聖';
  if (cleanName === '渡辺明') return '永世二冠';
  if (cleanName === '福間香奈' || cleanName === '里見香奈') return 'クイーン六冠';
  if (cleanName === '西山朋佳') return 'クイーン白玲・永世女王・クイーン王将';
  if (cleanName === '清水市代') return 'クイーン四冠';
  if (cleanName === '中井広恵') return 'クイーン名人';

  const list = getPlayerEiseiTitles(player);
  if (list.length === 0) return null;
  const top = list[0];
  if (list.length > 1) {
    return `${top} 他`;
  }
  return top;
}

