import { Player } from '../types/shogi';
import { initializePlayerRecords } from '../utils/yearRecordsGenerator';
import { runKishibetsuDebugVerification } from './kishibetsuDebugService';

/**
 * Kishibetsu.com & 対局データ完全同期エンジン
 * 全プロ棋士・女流棋士の2021年度〜2026年度の年度別成績詳細一覧表データを
 * 対局データから正確に再計算・初期化して同期します。
 */
export async function syncAllPlayersWithKishibetsu(players: Player[]): Promise<Player[]> {
  const synced = players.map((p) => initializePlayerRecords(p));

  // Run debug verification
  runKishibetsuDebugVerification(synced);

  return synced;
}
