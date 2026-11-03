import { Player, ShogiMonthlyResult } from '../types/shogi';

export interface EnrichedPlayerMatch extends ShogiMonthlyResult {
  isPlayerWinner: boolean;
  opponentName: string;
  isPlayerSente: boolean;
  kifuUrl: string;
  sourceType: 'official_scraped';
}

// In-memory cache for player matches
const playerMatchCache = new Map<string, { timestamp: number; matches: EnrichedPlayerMatch[] }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 mins

export function clearPlayerMatchCache(): void {
  playerMatchCache.clear();
}

/**
 * ShogiDB2 棋譜検索URLの生成
 */
export function getShogiDbSearchUrl(playerName: string, opponentName?: string): string {
  const cleanP = playerName.replace(/[\s\u3000※＊\*]/g, '');
  if (opponentName) {
    const cleanO = opponentName.replace(/[\s\u3000※＊\*]/g, '');
    return `https://shogidb2.com/search?q=${encodeURIComponent(`${cleanP} ${cleanO}`)}`;
  }
  return `https://shogidb2.com/search?q=${encodeURIComponent(cleanP)}`;
}

/**
 * 実際の公式スクレイピング対局データのみを抽出して返す。
 * ※ 架空対局の動的補完・シミュレーション生成は行わず、実対局記録のみを正確に表示します。
 */
export function enrichPlayerMatches(
  player: Player,
  fiscalYear: number,
  existingResults: ShogiMonthlyResult[] = []
): EnrichedPlayerMatch[] {
  const cacheKey = `${player.id}-${fiscalYear}`;
  const now = Date.now();
  const cached = playerMatchCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.matches;
  }

  const targetClean = player.name.replace(/[\s\u3000※＊\*]/g, '');

  // 実際の公式スクレイピング対局結果のみを抽出（架空対局の動的補完は一切行わない）
  const realMatches: EnrichedPlayerMatch[] = [];

  for (const r of existingResults) {
    const sClean = r.sente.replace(/[\s\u3000※＊\*]/g, '');
    const gClean = r.gote.replace(/[\s\u3000※＊\*]/g, '');
    const isSente = sClean === targetClean || r.sentePlayerId === player.id;
    const isGote = gClean === targetClean || r.gotePlayerId === player.id;

    if (isSente || isGote) {
      const isPlayerWinner =
        r.winner.replace(/[\s\u3000※＊\*]/g, '') === targetClean ||
        (isSente && (r.senteMark.includes('○') || r.senteMark.includes('□'))) ||
        (isGote && (r.goteMark.includes('○') || r.goteMark.includes('□')));
      const opponentName = isSente ? r.gote : r.sente;

      realMatches.push({
        ...r,
        isPlayerWinner,
        opponentName,
        isPlayerSente: isSente,
        kifuUrl: getShogiDbSearchUrl(player.name, opponentName),
        sourceType: 'official_scraped',
      });
    }
  }

  const sorted = realMatches.sort((a, b) => b.date.localeCompare(a.date));
  playerMatchCache.set(cacheKey, { timestamp: now, matches: sorted });
  return sorted;
}
