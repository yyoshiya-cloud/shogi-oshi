import { Player, ShogiMonthlyResult } from '../types/shogi';
import { initializePlayerRecords, updateMatchStatsData } from '../utils/yearRecordsGenerator';
import { runKishibetsuDebugVerification } from './kishibetsuDebugService';

/**
 * Kishibetsu.com & 対局データ完全同期エンジン
 * 全プロ棋士・女流棋士の2021年度〜2026年度の年度別成績詳細一覧表データを
 * 対局データから正確に再計算・初期化して同期します。
 */
export async function syncAllPlayersWithKishibetsu(
  players: Player[],
  latestResults?: Record<string, ShogiMonthlyResult[]>
): Promise<Player[]> {
  if (latestResults) {
    updateMatchStatsData(latestResults);
  }
  const synced = players.map((p) => initializePlayerRecords(p));

  // Run debug verification
  runKishibetsuDebugVerification(synced);

  return synced;
}

/**
 * UIがフリーズしない非同期協調チャンク処理（プログレスコールバック付き）同期
 */
export async function syncAllPlayersWithProgress(
  players: Player[],
  latestResults?: Record<string, ShogiMonthlyResult[]>,
  onProgress?: (processed: number, total: number, currentPlayer: Player) => void
): Promise<Player[]> {
  if (latestResults) {
    updateMatchStatsData(latestResults);
  }

  const synced: Player[] = [];
  const chunkSize = 12;

  for (let i = 0; i < players.length; i += chunkSize) {
    const chunk = players.slice(i, i + chunkSize);
    for (const p of chunk) {
      const initialized = initializePlayerRecords(p);
      synced.push(initialized);
      if (onProgress) {
        onProgress(synced.length, players.length, initialized);
      }
    }
    // Yield to browser event loop to guarantee 60fps responsiveness
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  runKishibetsuDebugVerification(synced);
  return synced;
}
