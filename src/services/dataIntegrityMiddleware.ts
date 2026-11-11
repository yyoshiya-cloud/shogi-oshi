import { Match, Player, ShogiMonthlyResult } from '../types/shogi';
import { PLAYERS_DATA, MATCHES_DATA } from '../data/shogiDatabase';
import results2026Json from '../data/results2026.json';
import {
  getStoredMatches,
  saveStoredMatches,
  getStoredPlayers,
  saveStoredPlayers,
  getStoredFiscalResults,
  saveStoredFiscalResults,
  deduplicateMatches,
} from '../utils/storage';
import { enrichAllResultsWithSupplements } from './matchSupplementService';

const BACKUP_STORAGE_KEY = 'shogi_oshi_backup_snapshot_v1';
const IDB_DB_NAME = 'ShogiOshiBackupDB';
const IDB_STORE_NAME = 'snapshots';

function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB unavailable'));
    }
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface DataBackupSnapshot {
  timestamp: string;
  players: Player[];
  matches: Match[];
  fiscalResults: Record<string, ShogiMonthlyResult[]>;
}

export interface DataIntegrityReport {
  isValid: boolean;
  isRestored: boolean;
  playersCount: number;
  matchesCount: number;
  resultsCount: number;
  restoredFrom: 'backup_snapshot' | 'bundled_fallback' | 'cloud' | 'none';
  reason?: string;
}

/**
 * Calculates total match result count in fiscalResults record.
 */
export function countTotalFiscalResults(results: Record<string, ShogiMonthlyResult[]>): number {
  if (!results) return 0;
  let total = 0;
  for (const k of Object.keys(results)) {
    if (Array.isArray(results[k])) {
      total += results[k].length;
    }
  }
  return total;
}

/**
 * Validates whether the dataset contains a healthy amount of records.
 * Prevents treating transient network timeouts or empty scrapes as valid data.
 */
export function validateDatasetHealth(
  players: Player[] | null | undefined,
  matches: Match[] | null | undefined,
  results: Record<string, ShogiMonthlyResult[]> | null | undefined
): { isValid: boolean; reason?: string } {
  const pCount = players?.length || 0;
  const mCount = matches?.length || 0;
  const rCount = countTotalFiscalResults(results || {});

  // Expected minimal baseline limits
  if (pCount < 50) {
    return { isValid: false, reason: `不審な棋士データ不整合を検出 (件数: ${pCount})` };
  }
  if (mCount < 5) {
    return { isValid: false, reason: `不審な対局予定データ空化を検出 (件数: ${mCount})` };
  }
  if (rCount < 100) {
    return { isValid: false, reason: `不審な月間対局結果データ消失を検出 (件数: ${rCount})` };
  }

  return { isValid: true };
}

/**
 * Asynchronously saves a known healthy snapshot to IndexedDB (bypassing localStorage 5MB quota limit).
 */
export async function saveBackupSnapshotAsync(
  players: Player[],
  matches: Match[],
  fiscalResults: Record<string, ShogiMonthlyResult[]>
): Promise<void> {
  try {
    const health = validateDatasetHealth(players, matches, fiscalResults);
    if (!health.isValid) {
      console.warn('[DataIntegrity] Skip saving backup snapshot: dataset unhealthy', health.reason);
      return;
    }

    const snapshot: DataBackupSnapshot = {
      timestamp: new Date().toISOString(),
      players,
      matches,
      fiscalResults,
    };

    // Save to IndexedDB (50MB+ quota)
    try {
      const db = await openBackupDB();
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(snapshot, 'latest');
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch (idbErr) {
      console.warn('[DataIntegrity] IndexedDB save fallback:', idbErr);
    }
  } catch (e) {
    console.info('[DataIntegrity] Backup snapshot write skipped due to storage limits');
  }
}

/**
 * Synchronous wrapper for saveBackupSnapshot. Safely triggers async IndexedDB persistence
 * without throwing QuotaExceededError in localStorage.
 */
export function saveBackupSnapshot(
  players: Player[],
  matches: Match[],
  fiscalResults: Record<string, ShogiMonthlyResult[]>
): void {
  saveBackupSnapshotAsync(players, matches, fiscalResults).catch(() => {});
}

/**
 * Asynchronously retrieves the backup snapshot from IndexedDB or localStorage.
 */
export async function getBackupSnapshotAsync(): Promise<DataBackupSnapshot | null> {
  try {
    const db = await openBackupDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get('latest');
    const snapshot = await new Promise<DataBackupSnapshot | null>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (snapshot) {
      const health = validateDatasetHealth(snapshot.players, snapshot.matches, snapshot.fiscalResults);
      if (health.isValid) {
        return snapshot;
      }
    }
  } catch (err) {
    console.warn('[DataIntegrity] IndexedDB read fallback:', err);
  }

  return getBackupSnapshot();
}

/**
 * Retrieves the secondary backup snapshot if available and valid from localStorage.
 */
export function getBackupSnapshot(): DataBackupSnapshot | null {
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return null;
    const snapshot: DataBackupSnapshot = JSON.parse(raw);
    const health = validateDatasetHealth(snapshot.players, snapshot.matches, snapshot.fiscalResults);
    if (!health.isValid) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Bundled pristine baseline dataset (bundled static files).
 */
export function getBundledBaselineDataset(): DataBackupSnapshot {
  const baseResults = enrichAllResultsWithSupplements(results2026Json as Record<string, ShogiMonthlyResult[]>);
  return {
    timestamp: new Date().toISOString(),
    players: PLAYERS_DATA,
    matches: MATCHES_DATA,
    fiscalResults: baseResults,
  };
}

/**
 * Main Integrity Check Middleware on App Initialization.
 * Verifies local storage data health. If empty/corrupt, automatically restores from snapshot or bundled baseline.
 */
export function verifyAndRestoreDataIntegrity(): DataIntegrityReport {
  let currentPlayers = getStoredPlayers();
  let currentMatches = getStoredMatches();
  let currentResults = getStoredFiscalResults();

  const baseline = getBundledBaselineDataset();

  // If initial load returned null/empty, fallback to bundled baseline for missing parts
  if (!currentPlayers || currentPlayers.length === 0) {
    currentPlayers = baseline.players;
  }
  if (!currentMatches || currentMatches.length === 0) {
    currentMatches = baseline.matches;
  }
  if (!currentResults || countTotalFiscalResults(currentResults) === 0) {
    currentResults = baseline.fiscalResults;
  }

  const initialHealth = validateDatasetHealth(currentPlayers, currentMatches, currentResults);

  if (initialHealth.isValid) {
    // Current dataset is healthy. Ensure deduplication and update snapshot
    const cleanMatches = deduplicateMatches(currentMatches);
    saveStoredPlayers(currentPlayers);
    saveStoredMatches(cleanMatches);
    saveStoredFiscalResults(currentResults);
    saveBackupSnapshot(currentPlayers, cleanMatches, currentResults);

    return {
      isValid: true,
      isRestored: false,
      playersCount: currentPlayers.length,
      matchesCount: cleanMatches.length,
      resultsCount: countTotalFiscalResults(currentResults),
      restoredFrom: 'none',
    };
  }

  // Dataset is unhealthy or corrupt. Initiate automatic restoration!
  console.warn('[DataIntegrity Middleware] Unhealthy data detected on boot:', initialHealth.reason);

  const snapshot = getBackupSnapshot();
  let targetData: DataBackupSnapshot;
  let restoredFrom: DataIntegrityReport['restoredFrom'];

  if (snapshot) {
    targetData = snapshot;
    restoredFrom = 'backup_snapshot';
  } else {
    targetData = baseline;
    restoredFrom = 'bundled_fallback';
  }

  // Merge restored target data with any valid current fragments
  const restoredPlayers =
    currentPlayers && currentPlayers.length >= 100 ? currentPlayers : targetData.players;
  const restoredMatches = deduplicateMatches([
    ...targetData.matches,
    ...(currentMatches || []),
  ]);
  const mergedResults = enrichAllResultsWithSupplements({
    ...targetData.fiscalResults,
    ...(currentResults || {}),
  });

  // Persist restored pristine dataset to storage
  saveStoredPlayers(restoredPlayers);
  saveStoredMatches(restoredMatches);
  saveStoredFiscalResults(mergedResults);
  saveBackupSnapshot(restoredPlayers, restoredMatches, mergedResults);

  console.info(
    `[DataIntegrity Middleware] Successfully restored dataset from ${restoredFrom}. Players: ${restoredPlayers.length}, Matches: ${restoredMatches.length}, Results: ${countTotalFiscalResults(mergedResults)}`
  );

  return {
    isValid: true,
    isRestored: true,
    playersCount: restoredPlayers.length,
    matchesCount: restoredMatches.length,
    resultsCount: countTotalFiscalResults(mergedResults),
    restoredFrom,
    reason: initialHealth.reason,
  };
}
