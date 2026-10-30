import { Player, ShogiMonthlyResult } from '../types/shogi';
import resultsData from '../data/results2026.json';

export interface DirectHeadToHeadMatch {
  id: string;
  date: string;
  tournament: string;
  senteName: string;
  goteName: string;
  winnerName: string;
  sentePlayerId?: string;
  gotePlayerId?: string;
  winnerPlayerId?: string;
  resultType?: string;
  links?: { title: string; url: string }[];
}

export interface DirectHeadToHeadSummary {
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalMatches: number;
  recentMatches: DirectHeadToHeadMatch[];
  shogiDbSearchUrl: string;
}

function normalizeName(name: string): string {
  if (!name) return '';
  return name.replace(/[※＊\*\s\u3000\u00A0+]/g, '').trim();
}

/**
 * Retrieves direct head-to-head match records between two players from official match results.
 */
export function getDirectHeadToHead(player1: Player, player2: Player): DirectHeadToHeadSummary {
  const n1 = normalizeName(player1.name);
  const n2 = normalizeName(player2.name);

  const matchedList: DirectHeadToHeadMatch[] = [];

  // Search across all monthly results stored in results2026.json
  const allMonths = Object.values(resultsData as Record<string, ShogiMonthlyResult[]>);
  for (const monthMatches of allMonths) {
    if (!Array.isArray(monthMatches)) continue;
    for (const m of monthMatches) {
      const senteNorm = normalizeName(m.sente);
      const goteNorm = normalizeName(m.gote);

      const isP1Sente = senteNorm.includes(n1) || (n1.length >= 2 && senteNorm.includes(n1.slice(0, 2)) && senteNorm.includes(n1.slice(-2)));
      const isP2Gote = goteNorm.includes(n2) || (n2.length >= 2 && goteNorm.includes(n2.slice(0, 2)) && goteNorm.includes(n2.slice(-2)));

      const isP2Sente = senteNorm.includes(n2) || (n2.length >= 2 && senteNorm.includes(n2.slice(0, 2)) && senteNorm.includes(n2.slice(-2)));
      const isP1Gote = goteNorm.includes(n1) || (n1.length >= 2 && goteNorm.includes(n1.slice(0, 2)) && goteNorm.includes(n1.slice(-2)));

      if ((isP1Sente && isP2Gote) || (isP2Sente && isP1Gote)) {
        // Direct match found
        let winnerName = m.winner || '';
        let winnerPlayerId: string | undefined;

        if (winnerName) {
          const winNorm = normalizeName(winnerName);
          if (winNorm.includes(n1)) {
            winnerName = player1.name;
            winnerPlayerId = player1.id;
          } else if (winNorm.includes(n2)) {
            winnerName = player2.name;
            winnerPlayerId = player2.id;
          }
        }

        matchedList.push({
          id: m.id,
          date: m.date,
          tournament: m.tournament,
          senteName: isP1Sente ? player1.name : player2.name,
          goteName: isP1Sente ? player2.name : player1.name,
          winnerName,
          sentePlayerId: isP1Sente ? player1.id : player2.id,
          gotePlayerId: isP1Sente ? player2.id : player1.id,
          winnerPlayerId,
          resultType: m.resultType,
          links: m.links,
        });
      }
    }
  }

  // Sort by date descending (most recent first)
  matchedList.sort((a, b) => b.date.localeCompare(a.date));

  // Count wins
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;

  for (const m of matchedList) {
    if (m.winnerPlayerId === player1.id) {
      p1Wins++;
    } else if (m.winnerPlayerId === player2.id) {
      p2Wins++;
    } else if (m.winnerName === player1.name) {
      p1Wins++;
    } else if (m.winnerName === player2.name) {
      p2Wins++;
    } else {
      draws++;
    }
  }

  // Check if player1.headToHead has record with player2
  if (player1.headToHead && player1.headToHead.length > 0) {
    const existingH2h = player1.headToHead.find(
      (h) => h.opponentId === player2.id || normalizeName(h.opponentName).includes(n2)
    );
    if (existingH2h && (existingH2h.wins > p1Wins || existingH2h.losses > p2Wins)) {
      p1Wins = Math.max(p1Wins, existingH2h.wins);
      p2Wins = Math.max(p2Wins, existingH2h.losses);
    }
  }

  const shogiDbSearchUrl = `https://shogidb2.com/search?q=${encodeURIComponent(`${player1.name} ${player2.name}`)}`;

  return {
    player1Name: player1.name,
    player2Name: player2.name,
    player1Wins: p1Wins,
    player2Wins: p2Wins,
    draws,
    totalMatches: p1Wins + p2Wins + draws,
    recentMatches: matchedList,
    shogiDbSearchUrl,
  };
}
