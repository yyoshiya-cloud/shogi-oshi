import { Player } from '../types/shogi';

/**
 * 日本将棋連盟およびLPSA公式記録に基づく
 * 歴代・現役棋士および女流棋士の通算主要タイトル獲得期数完全マスター
 */
export const KNOWN_CAREER_TITLES: Record<string, number> = {
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
export const KNOWN_CAREER_TITLES_BY_NUMBER: Record<number, number> = {
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
