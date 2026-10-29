import { Player, YearRecord } from '../types/shogi';

/**
 * Kishibetsu.com データのデバッグおよび不一致検証モード
 */
export interface KishibetsuDebugLog {
  playerId: string;
  playerName: string;
  year: number;
  dbWins: number;
  dbLosses: number;
  kishibetsuWins: number;
  kishibetsuLosses: number;
  isMatch: boolean;
  discrepancyMessage?: string;
}

// Kishibetsu.com official archive benchmarks for key players
const KISHIBETSU_BENCHMARKS: Record<string, Record<number, { wins: number; losses: number }>> = {
  'fujii-sota': {
    2021: { wins: 52, losses: 12 },
    2022: { wins: 53, losses: 11 },
    2023: { wins: 46, losses: 8 },
    2024: { wins: 40, losses: 12 },
    2025: { wins: 42, losses: 13 },
    2026: { wins: 17, losses: 4 },
  },
  'ito-takumi': {
    2021: { wins: 36, losses: 16 },
    2022: { wins: 41, losses: 12 },
    2023: { wins: 38, losses: 15 },
    2024: { wins: 42, losses: 14 },
    2025: { wins: 39, losses: 13 },
    2026: { wins: 31, losses: 9 },
  },
  'habu-yoshiharu': {
    2021: { wins: 31, losses: 26 },
    2022: { wins: 29, losses: 28 },
    2023: { wins: 26, losses: 27 },
    2024: { wins: 24, losses: 25 },
    2025: { wins: 22, losses: 24 },
    2026: { wins: 18, losses: 15 },
  },
};

/**
 * Run debug validation between current DB yearRecords and kishibetsu.com benchmarks
 */
export function runKishibetsuDebugVerification(players: Player[]): KishibetsuDebugLog[] {
  const logs: KishibetsuDebugLog[] = [];
  const years = [2021, 2022, 2023, 2024, 2025, 2026];

  console.group('%c[Kishibetsu Debug Mode] Starting Data Validation', 'color: #f59e0b; font-weight: bold;');

  for (const p of players) {
    const benchmark = KISHIBETSU_BENCHMARKS[p.id];
    if (!benchmark) continue;

    for (const year of years) {
      const expected = benchmark[year];
      if (!expected) continue;

      const record = (p.yearRecords || []).find((r) => r.year === year);
      const dbWins = record ? record.wins : 0;
      const dbLosses = record ? record.losses : 0;

      const isMatch = dbWins === expected.wins && dbLosses === expected.losses;

      const logEntry: KishibetsuDebugLog = {
        playerId: p.id,
        playerName: p.name,
        year,
        dbWins,
        dbLosses,
        kishibetsuWins: expected.wins,
        kishibetsuLosses: expected.losses,
        isMatch,
        discrepancyMessage: isMatch
          ? undefined
          : `[不一致検知] ${p.name} (${year}年度): DB記録(${dbWins}勝${dbLosses}敗) != kishibetsu.com公式記録(${expected.wins}勝${expected.losses}敗)`,
      };

      logs.push(logEntry);

      if (!isMatch) {
        console.warn(
          `%c[DISCREPANCY] ${p.name} ${year}年度: DB (${dbWins}勝${dbLosses}敗) vs Kishibetsu (${expected.wins}勝${expected.losses}敗)`,
          'color: #f43f5e; font-weight: bold;'
        );
      } else {
        console.log(
          `%c[MATCH] ${p.name} ${year}年度: ${dbWins}勝${dbLosses}敗 (一致)`,
          'color: #10b981;'
        );
      }
    }
  }

  const discrepanciesCount = logs.filter((l) => !l.isMatch).length;
  console.log(
    `%c[Kishibetsu Debug Mode] 検証完了: 総検証数=${logs.length}, 不一致件数=${discrepanciesCount}`,
    'color: #f59e0b; font-weight: bold;'
  );
  console.groupEnd();

  return logs;
}
