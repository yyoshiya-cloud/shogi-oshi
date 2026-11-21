import type {
  Player,
  Match,
  ShogiMonthlyResult,
  PlayerNameHistoryItem,
  SyncLogEntry,
  DbOverview,
} from '../types/shogi';
import * as sqlite from './sqlite';
import * as turso from './turso';

export function isTursoActive(): boolean {
  return turso.isTursoConfigured();
}

export function getStorageBackendInfo(): { mode: 'turso' | 'sqlite'; label: string } {
  if (turso.isTursoConfigured()) {
    const target = turso.getTursoSafeTargetLabel();
    return { mode: 'turso', label: `Turso libSQL (${target.host})` };
  }
  return { mode: 'sqlite', label: 'Local SQLite (data/shogi.db)' };
}

export async function initDatabase(): Promise<void> {
  if (turso.isTursoConfigured()) {
    await turso.ensureTursoInitialized();
    return;
  }
  sqlite.getDb();
}

export function closeDatabase(): void {
  if (turso.isTursoConfigured()) {
    turso.closeTurso();
  }
  sqlite.closeDb();
}

export async function getAllPlayers(): Promise<Player[]> {
  if (turso.isTursoConfigured()) return turso.getAllPlayers();
  return sqlite.getAllPlayers();
}

export async function upsertPlayer(player: Player): Promise<Player> {
  if (turso.isTursoConfigured()) return turso.upsertPlayer(player);
  return sqlite.upsertPlayer(player);
}

export async function upsertPlayersBulk(players: Player[], source = 'sync'): Promise<number> {
  if (turso.isTursoConfigured()) return turso.upsertPlayersBulk(players, source);
  return sqlite.upsertPlayersBulk(players, source);
}

export async function deletePlayerById(id: string): Promise<boolean> {
  if (turso.isTursoConfigured()) return turso.deletePlayerById(id);
  return sqlite.deletePlayerById(id);
}

export async function getAllMatches(): Promise<Match[]> {
  if (turso.isTursoConfigured()) return turso.getAllMatches();
  return sqlite.getAllMatches();
}

export async function upsertMatch(match: Match): Promise<Match> {
  if (turso.isTursoConfigured()) return turso.upsertMatch(match);
  return sqlite.upsertMatch(match);
}

export async function upsertMatchesBulk(matches: Match[], source = 'sync'): Promise<number> {
  if (turso.isTursoConfigured()) return turso.upsertMatchesBulk(matches, source);
  return sqlite.upsertMatchesBulk(matches, source);
}

export async function deleteMatchById(id: string): Promise<boolean> {
  if (turso.isTursoConfigured()) return turso.deleteMatchById(id);
  return sqlite.deleteMatchById(id);
}

export async function getAllMatchArchives(
  fiscalYear?: number,
  month?: string
): Promise<Record<string, ShogiMonthlyResult[]>> {
  if (turso.isTursoConfigured()) return turso.getAllMatchArchives(fiscalYear, month);
  return sqlite.getAllMatchArchives(fiscalYear, month);
}

export async function upsertMonthArchive(
  month: string,
  results: ShogiMonthlyResult[],
  source = 'manual'
): Promise<ShogiMonthlyResult[]> {
  if (turso.isTursoConfigured()) return turso.upsertMonthArchive(month, results, source);
  return sqlite.upsertMonthArchive(month, results, source);
}

export async function upsertMatchArchivesBulk(
  archives: Record<string, ShogiMonthlyResult[]>,
  source = 'sync'
): Promise<number> {
  if (turso.isTursoConfigured()) return turso.upsertMatchArchivesBulk(archives, source);
  return sqlite.upsertMatchArchivesBulk(archives, source);
}

export async function addMatchResultToArchive(result: ShogiMonthlyResult): Promise<ShogiMonthlyResult[]> {
  if (turso.isTursoConfigured()) return turso.addMatchResultToArchive(result);
  return sqlite.addMatchResultToArchive(result);
}

export async function deleteMatchResultFromArchive(month: string, resultId: string): Promise<boolean> {
  if (turso.isTursoConfigured()) return turso.deleteMatchResultFromArchive(month, resultId);
  return sqlite.deleteMatchResultFromArchive(month, resultId);
}

export async function getNameHistory(): Promise<PlayerNameHistoryItem[]> {
  if (turso.isTursoConfigured()) return turso.getNameHistory();
  return sqlite.getNameHistory();
}

export async function recordPlayerNameChange(params: {
  playerId: string;
  oldName: string;
  newName: string;
  changedAt?: string;
  note?: string;
}): Promise<{ player: Player; history: PlayerNameHistoryItem } | null> {
  if (turso.isTursoConfigured()) return turso.recordPlayerNameChange(params);
  return sqlite.recordPlayerNameChange(params);
}

export async function clearPlayerNameHistory(playerId: string): Promise<Player | null> {
  if (turso.isTursoConfigured()) return turso.clearPlayerNameHistory(playerId);
  return sqlite.clearPlayerNameHistory(playerId);
}

export async function getDatabaseOverview(): Promise<DbOverview> {
  if (turso.isTursoConfigured()) return turso.getDatabaseOverview();
  return sqlite.getDatabaseOverview();
}

export async function addSyncLog(
  syncType: string,
  status: 'success' | 'error' | 'partial',
  message: string,
  recordsCount = 0
): Promise<void> {
  if (turso.isTursoConfigured()) return turso.addSyncLog(syncType, status, message, recordsCount);
  sqlite.addSyncLog(syncType, status, message, recordsCount);
}

export async function getSyncLogs(limit = 50): Promise<SyncLogEntry[]> {
  if (turso.isTursoConfigured()) return turso.getSyncLogs(limit);
  return sqlite.getSyncLogs(limit);
}

export async function exportBackupJson() {
  if (turso.isTursoConfigured()) return turso.exportBackupJson();
  return sqlite.exportBackupJson();
}

export async function restoreFromBackupJson(payload: any) {
  if (turso.isTursoConfigured()) return turso.restoreFromBackupJson(payload);
  return sqlite.restoreFromBackupJson(payload);
}

export async function importFromSqliteBuffer(buffer: Buffer) {
  if (turso.isTursoConfigured()) return turso.importFromSqliteBuffer(buffer);
  return sqlite.importFromSqliteBuffer(buffer);
}

export async function syncNameHistoryAndRelinkArchives() {
  if (turso.isTursoConfigured()) return turso.syncNameHistoryAndRelinkArchives();
  return sqlite.syncNameHistoryAndRelinkArchives();
}

export async function pushLocalSqliteToTurso() {
  if (!turso.isTursoConfigured()) {
    throw new Error('TURSO_DATABASE_URL が設定されていないため Turso へ移行できません');
  }
  return turso.pushLocalSqliteToTurso();
}
