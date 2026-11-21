import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

import fs from 'fs';
import path from 'path';
import {
  getTursoClient,
  getAllPlayers,
  getNameHistory,
  normalizePlayerRecord,
  upsertPlayersBulk,
  closeTurso,
  getTursoSafeTargetLabel,
} from '../src/db/turso';
import { mergePreservingManualFields, isPlayerRetired } from '../src/utils/playerUtils';
import type { Player } from '../src/types/shogi';

async function main() {
  const target = getTursoSafeTargetLabel();
  console.log(`[Player Restore] Connecting to Turso: ${target.host} (${target.dbName})...`);

  // 1. Load full pristine player database
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'allPlayers.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File not found: ${jsonPath}`);
  }
  const pristineList: Player[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`[Player Restore] Loaded ${pristineList.length} complete player records from allPlayers.json`);

  // 2. Fetch current DB state to preserve manual overrides and name history
  const currentDbPlayers = await getAllPlayers();
  const currentDbMap = new Map<string, Player>(currentDbPlayers.map((p) => [p.id, p]));
  const nameHistory = await getNameHistory();
  const historyMap = new Map<string, string>();
  for (const h of nameHistory) {
    if (!historyMap.has(h.playerId)) {
      historyMap.set(h.playerId, h.oldName);
    }
  }

  console.log(`[Player Restore] Current DB has ${currentDbPlayers.length} players, ${nameHistory.length} name history entries`);

  // 3. Merge pristine records while preserving manual fields, formerName, and honorary titles
  const playersToSave: Player[] = [];

  for (const pristine of pristineList) {
    const prev = currentDbMap.get(pristine.id);
    let merged: Player;

    if (prev) {
      // Base merge preserving user manual fields
      merged = mergePreservingManualFields(prev, pristine);

      // Preserve formerName from DB or name history if present
      if (!merged.formerName && (prev.formerName || historyMap.has(pristine.id))) {
        merged.formerName = prev.formerName || historyMap.get(pristine.id);
      }

      // Preserve user retirementDate if manually set
      if (prev.retirementDate && !merged.retirementDate) {
        merged.retirementDate = prev.retirementDate;
      }

      // If user had honorary qualification in rank (e.g. "九段(永世称号有資格者)"), preserve it
      if (prev.rank && prev.rank.includes('有資格者')) {
        merged.rank = prev.rank;
      }

      // Ensure danRank is not lost
      if (!merged.danRank && pristine.danRank) {
        merged.danRank = pristine.danRank;
      }
      if (!merged.danRank && prev.danRank) {
        merged.danRank = prev.danRank;
      }

      // Ensure photoUrl and playerNumber are never lost
      if (!merged.photoUrl && pristine.photoUrl) {
        merged.photoUrl = pristine.photoUrl;
      }
      if (merged.playerNumber === undefined && pristine.playerNumber !== undefined) {
        merged.playerNumber = pristine.playerNumber;
      }

      // Ensure stats and arrays are populated from pristine if prev was wiped (careerWins === 0)
      if (prev.careerWins === 0 && pristine.careerWins > 0) {
        merged.careerWins = pristine.careerWins;
        merged.careerLosses = pristine.careerLosses;
        merged.careerWinRate = pristine.careerWinRate;
        merged.currentYearWins = pristine.currentYearWins;
        merged.currentYearLosses = pristine.currentYearLosses;
        merged.currentYearWinRate = pristine.currentYearWinRate;
        merged.currentYearStreak = pristine.currentYearStreak;
        merged.totalTitles = pristine.totalTitles;
        merged.heldTitles = pristine.heldTitles;
        merged.eiseiTitles = pristine.eiseiTitles || merged.eiseiTitles;
        merged.titleHistory = pristine.titleHistory || merged.titleHistory;
        merged.highlights = pristine.highlights && pristine.highlights.length > 0 ? pristine.highlights : merged.highlights;
        merged.yearRecords = pristine.yearRecords && pristine.yearRecords.length > 0 ? pristine.yearRecords : merged.yearRecords;
        merged.openingStats = pristine.openingStats && pristine.openingStats.length > 0 ? pristine.openingStats : merged.openingStats;
        merged.headToHead = pristine.headToHead && pristine.headToHead.length > 0 ? pristine.headToHead : merged.headToHead;
        merged.shortBio = pristine.shortBio || merged.shortBio;
        merged.rankingInFederation = pristine.rankingInFederation || merged.rankingInFederation;
      }
    } else {
      merged = { ...pristine };
    }

    const normalized = normalizePlayerRecord(merged);
    if (normalized) {
      playersToSave.push(normalized);
    }
  }

  console.log(`[Player Restore] Prepared ${playersToSave.length} normalized players for Turso upsert...`);

  // 4. Upsert in batches to Turso
  const savedCount = await upsertPlayersBulk(playersToSave, 'full_profile_restore');
  console.log(`[Player Restore] Successfully updated ${savedCount} players in Turso!`);

  // 5. Verification check
  const verifiedList = await getAllPlayers();
  const habu = verifiedList.find((p) => p.name.includes('羽生'));
  const fujii = verifiedList.find((p) => p.name.includes('藤井 聡太'));
  const moriuchi = verifiedList.find((p) => p.name.includes('森内 俊之'));
  const kanna = verifiedList.find((p) => p.name.includes('環那') || p.id === 'suzuki-kanna');
  const fukuma = verifiedList.find((p) => p.name.includes('福間 香奈') || p.id === 'fukuma-kana');

  console.log('\n--- VERIFICATION SAMPLES ---');
  console.log('羽生 善治:', {
    rank: habu?.rank,
    danRank: habu?.danRank,
    playerNumber: habu?.playerNumber,
    photoUrl: habu?.photoUrl ? 'YES' : 'NO',
    careerWins: habu?.careerWins,
    careerLosses: habu?.careerLosses,
    totalTitles: habu?.totalTitles,
    yearRecords: habu?.yearRecords?.length,
  });
  console.log('森内 俊之:', {
    rank: moriuchi?.rank,
    danRank: moriuchi?.danRank,
    playerNumber: moriuchi?.playerNumber,
    photoUrl: moriuchi?.photoUrl ? 'YES' : 'NO',
    careerWins: moriuchi?.careerWins,
    totalTitles: moriuchi?.totalTitles,
  });
  console.log('鈴木 環那:', {
    rank: kanna?.rank,
    danRank: kanna?.danRank,
    playerNumber: kanna?.playerNumber,
    photoUrl: kanna?.photoUrl ? 'YES' : 'NO',
    careerWins: kanna?.careerWins,
    careerLosses: kanna?.careerLosses,
  });
  console.log('藤井 聡太:', {
    rank: fujii?.rank,
    danRank: fujii?.danRank,
    heldTitles: fujii?.heldTitles,
    totalTitles: fujii?.totalTitles,
    careerWins: fujii?.careerWins,
  });
  console.log('福間 香奈 (改名チェック):', {
    name: fukuma?.name,
    formerName: fukuma?.formerName,
    rank: fukuma?.rank,
    danRank: fukuma?.danRank,
    careerWins: fukuma?.careerWins,
  });

  closeTurso();
  console.log('\n[Player Restore] COMPLETED SUCCESSFULLY.');
}

main().catch((err) => {
  console.error('[Player Restore] Error:', err);
  closeTurso();
  process.exit(1);
});
