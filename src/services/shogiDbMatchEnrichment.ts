import { Player, ShogiMonthlyResult } from '../types/shogi';
import { getHistoricalNamesForPlayer, normalizeShogiPlayerNameForMatch } from '../utils/playerUtils';

export interface EnrichedPlayerMatch extends ShogiMonthlyResult {
  isPlayerWinner: boolean;
  hasResult: boolean;
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
 * 実際の公式・DB対局データのみを抽出して返す。
 * 旧姓・氏名変更履歴（formerName / player_name_history）も紐付けて過去年度対局を取得します。
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

  const targetNames = new Set<string>();
  const addAlias = (n?: string) => {
    if (!n) return;
    const c = n.replace(/[\s\u3000※＊\*]/g, '');
    const norm = normalizeShogiPlayerNameForMatch(n);
    if (c) targetNames.add(c);
    if (norm) targetNames.add(norm);
  };
  addAlias(player.name);
  addAlias(player.formerName);
  for (const histName of getHistoricalNamesForPlayer(player.id)) {
    addAlias(histName);
  }

  const realMatches: EnrichedPlayerMatch[] = [];

  for (const r of existingResults) {
    const sClean = r.sente.replace(/[\s\u3000※＊\*]/g, '');
    const gClean = r.gote.replace(/[\s\u3000※＊\*]/g, '');
    const sNorm = normalizeShogiPlayerNameForMatch(r.sente);
    const gNorm = normalizeShogiPlayerNameForMatch(r.gote);

    const isSente =
      targetNames.has(sClean) || targetNames.has(sNorm) || r.sentePlayerId === player.id;
    const isGote =
      targetNames.has(gClean) || targetNames.has(gNorm) || r.gotePlayerId === player.id;

    if (isSente || isGote) {
      const winnerClean = (r.winner || '').replace(/[\s\u3000※＊\*]/g, '');
      const winnerNorm = normalizeShogiPlayerNameForMatch(r.winner || '');
      const isPlayerWinner =
        (Boolean(winnerClean) && (targetNames.has(winnerClean) || targetNames.has(winnerNorm))) ||
        r.winnerId === player.id ||
        (isSente && (r.senteMark.includes('○') || r.senteMark.includes('□'))) ||
        (isGote && (r.goteMark.includes('○') || r.goteMark.includes('□')));
      const isPlayerLoser =
        (Boolean(winnerClean) && !targetNames.has(winnerClean) && !targetNames.has(winnerNorm) && r.winnerId !== player.id) ||
        r.loserId === player.id ||
        (isSente && (r.senteMark.includes('●') || r.senteMark.includes('■'))) ||
        (isGote && (r.goteMark.includes('●') || r.goteMark.includes('■')));
      const hasResult = isPlayerWinner || isPlayerLoser;
      const opponentName = isSente ? r.gote : r.sente;

      realMatches.push({
        ...r,
        isPlayerWinner,
        hasResult,
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
