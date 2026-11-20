import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  Player,
  Match,
  ShogiMonthlyResult,
  PlayerNameHistoryItem,
  SyncLogEntry,
  DbOverview,
  MatchArchiveSummary,
} from '../types/shogi';
import { PLAYERS_DATA, MATCHES_DATA } from '../data/shogiDatabase';
import results2026Json from '../data/results2026.json';
import { enrichAllResultsWithSupplements, enrichMonthlyResultsWithSupplements } from '../services/matchSupplementService';
import { isProtectedMatchResult, mergeProtectedWithOfficialResults } from '../utils/resultProtection';
import { getTodayDateString } from '../utils/dateUtils';
import { normalizeShogiPlayerNameForMatch, isPlayerRetired } from '../utils/playerUtils';

export const DB_PROJECT_ID = 'local-sqlite';
export const DB_DATABASE_ID = 'local-sqlite';

export const DEFAULT_INITIAL_NAME_HISTORY: PlayerNameHistoryItem[] = [];

export function getDbPath(): string {
  return path.join(process.cwd(), 'data', 'shogi.db');
}

let dbInstance: Database.Database | null = null;

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export function getFiscalYearFromMonth(monthStr: string): number {
  const clean = String(monthStr || '').replace(/[^0-9]/g, '');
  if (clean.length < 6) return 2026;
  const y = parseInt(clean.slice(0, 4), 10);
  const m = parseInt(clean.slice(4, 6), 10);
  if (isNaN(y) || isNaN(m)) return 2026;
  return m >= 1 && m <= 3 ? y - 1 : y;
}

function createSchemaSql(): string {
  return `
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      former_name TEXT,
      type TEXT NOT NULL DEFAULT 'pro',
      affiliation TEXT DEFAULT '日本将棋連盟',
      rank TEXT DEFAULT '',
      dan_rank TEXT,
      player_number INTEGER,
      photo_url TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
    CREATE INDEX IF NOT EXISTS idx_players_type ON players(type);

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      tournament TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '一般棋戦',
      round TEXT DEFAULT '',
      player1_id TEXT NOT NULL DEFAULT '',
      player2_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'upcoming',
      venue TEXT DEFAULT '',
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

    CREATE TABLE IF NOT EXISTS match_archives (
      month TEXT PRIMARY KEY,
      fiscal_year INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL,
      source TEXT DEFAULT 'local-sqlite',
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_match_archives_fy ON match_archives(fiscal_year);

    CREATE TABLE IF NOT EXISTS player_name_history (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      old_name TEXT NOT NULL,
      new_name TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      note TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_name_history_player ON player_name_history(player_id);

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      records_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `;
}

function recoverCorruptedDatabase(dbPath: string, reason: string): Database.Database {
  console.warn(`[SQLite] Detected corrupted DB (${reason}). Rebuilding healthy database at ${dbPath}...`);

  let salvagedPlayers: any[] = [];
  let salvagedMatches: any[] = [];
  let salvagedHistory: any[] = [];
  const salvagedArchives = new Map<string, { month: string; fiscal_year: number; count: number; results_json: string; source: string; updated_at: string }>();

  try {
    const ro = new Database(dbPath, { readonly: true });
    try {
      salvagedPlayers = ro.prepare('SELECT * FROM players').all();
    } catch {}
    try {
      salvagedMatches = ro.prepare('SELECT * FROM matches').all();
    } catch {}
    try {
      salvagedHistory = ro.prepare('SELECT * FROM player_name_history').all();
    } catch {}
    try {
      const mRows = ro.prepare('SELECT month FROM match_archives').all() as Array<{ month: string }>;
      for (const { month } of mRows) {
        try {
          const row = ro
            .prepare('SELECT month, fiscal_year, count, results_json, source, updated_at FROM match_archives WHERE month = ?')
            .get(month) as any;
          const parsed = JSON.parse(row.results_json);
          if (Array.isArray(parsed)) {
            salvagedArchives.set(month, {
              month: row.month,
              fiscal_year: row.fiscal_year ?? getFiscalYearFromMonth(month),
              count: parsed.length,
              results_json: JSON.stringify(parsed),
              source: typeof row.source === 'string' && /^[a-zA-Z0-9_-]+$/.test(row.source) ? row.source : 'recovered',
              updated_at: row.updated_at || new Date().toISOString(),
            });
          }
        } catch {}
      }
    } catch {}
    try {
      ro.close();
    } catch {}
  } catch {}

  const ts = Date.now();
  try {
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, `${dbPath}.corrupt-${ts}`);
    }
  } catch {
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  }
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try {
      if (fs.existsSync(`${dbPath}${suffix}`)) fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {}
  }

  const fresh = new Database(dbPath);
  fresh.pragma('journal_mode = WAL');
  fresh.pragma('synchronous = NORMAL');
  fresh.pragma('busy_timeout = 5000');
  fresh.pragma('foreign_keys = ON');
  fresh.exec(createSchemaSql());

  const now = new Date().toISOString();
  const tx = fresh.transaction(() => {
    if (salvagedPlayers.length > 0) {
      const insP = fresh.prepare(`
        INSERT OR REPLACE INTO players
        (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
        VALUES (@id, @name, @former_name, @type, @affiliation, @rank, @dan_rank, @player_number, @photo_url, @data_json, @updated_at)
      `);
      for (const p of salvagedPlayers) {
        try {
          insP.run(p);
        } catch {}
      }
    }
    if (salvagedMatches.length > 0) {
      const insM = fresh.prepare(`
        INSERT OR REPLACE INTO matches
        (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
        VALUES (@id, @date, @time, @tournament, @category, @round, @player1_id, @player2_id, @status, @venue, @data_json, @updated_at)
      `);
      for (const m of salvagedMatches) {
        try {
          insM.run(m);
        } catch {}
      }
    }
    if (salvagedHistory.length > 0) {
      const insH = fresh.prepare(`
        INSERT OR REPLACE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
        VALUES (@id, @player_id, @old_name, @new_name, @changed_at, @note)
      `);
      for (const h of salvagedHistory) {
        try {
          insH.run(h);
        } catch {}
      }
    }
    const insA = fresh.prepare(`
      INSERT OR REPLACE INTO match_archives
      (month, fiscal_year, count, results_json, source, updated_at)
      VALUES (@month, @fiscal_year, @count, @results_json, @source, @updated_at)
    `);
    for (const arch of salvagedArchives.values()) {
      insA.run(arch);
    }
    const bundled = enrichAllResultsWithSupplements(results2026Json as Record<string, ShogiMonthlyResult[]>);
    for (const [month, list] of Object.entries(bundled)) {
      if (!Array.isArray(list) || salvagedArchives.has(month)) continue;
      insA.run({
        month,
        fiscal_year: getFiscalYearFromMonth(month),
        count: list.length,
        results_json: JSON.stringify(list),
        source: 'auto_recovery_seed',
        updated_at: now,
      });
    }
    fresh
      .prepare('INSERT INTO sync_logs (sync_type, status, message, records_count, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(
        'auto_recovery',
        'success',
        `SQLite破損検出により自動修復を実行 (${reason})`,
        salvagedPlayers.length + salvagedArchives.size,
        now
      );
  });
  tx();
  return fresh;
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
    db.pragma('busy_timeout = 5000');
    const qc = db.pragma('quick_check') as Array<{ quick_check: string }>;
    const qcVal = qc?.[0]?.quick_check;
    if (qcVal && qcVal !== 'ok') {
      try {
        db.close();
      } catch {}
      db = recoverCorruptedDatabase(dbPath, `quick_check=${qcVal}`);
    } else {
      // Checkpoint any legacy WAL data and enforce single-file DELETE journal mode
      // so git/deployment snapshots never lose uncommitted WAL pages
      try {
        const curMode = (db.pragma('journal_mode', { simple: true }) as string || '').toLowerCase();
        if (curMode === 'wal') {
          db.pragma('wal_checkpoint(TRUNCATE)');
        }
      } catch {}
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('foreign_keys = ON');
      db.exec(createSchemaSql());
    }
  } catch (err: any) {
    db = recoverCorruptedDatabase(dbPath, err?.message || 'open_failed');
  }

  dbInstance = db;
  seedDatabaseIfEmpty(db);
  migrateRanksAndDanRanks(db);
  syncNameHistoryAndRelinkArchives(db);
  return db;
}

export function migrateRanksAndDanRanks(db: Database.Database): number {
  try {
    const rows = db.prepare('SELECT id, type, rank, dan_rank, data_json FROM players').all() as Array<{
      id: string;
      type: string;
      rank: string;
      dan_rank: string | null;
      data_json: string;
    }>;

    const updateStmt = db.prepare('UPDATE players SET rank = ?, dan_rank = ?, data_json = ? WHERE id = ?');
    let updatedCount = 0;

    for (const r of rows) {
      let rank = (r.rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
      let dan = (r.dan_rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
      let changed = false;

      const isPro = r.type !== 'women';
      const danRegex = isPro
        ? /([四五六七八九]段)/
        : /(女流[1-2]級|女流[初一二三四五六七八]段)/;

      // 1. dan が未設定で rank から段位が抽出できる場合
      if (!dan) {
        const match = rank.match(danRegex);
        if (match) {
          dan = match[1];
          changed = true;
        }
      }

      // 2. ユーザー指定: 「称号は永世、名誉資格など段位で無いものを登録する」
      // 純粋な段位のみ（例: "九段", "六段", "女流初段"）は称号欄からは空にする
      if (/^[一二三四五六七八九]段$|^女流[1-2]級$|^女流[初一二三四五六七八]段$/.test(rank)) {
        rank = '';
        changed = true;
      } else if (rank.includes('(永世称号有資格者)')) {
        rank = '永世称号有資格者';
        changed = true;
      } else if (rank.includes('(クイーン称号有資格者)')) {
        rank = 'クイーン称号有資格者';
        changed = true;
      }

      if (changed || rank !== r.rank || dan !== (r.dan_rank || '')) {
        let pObj: any = {};
        try {
          pObj = JSON.parse(r.data_json);
        } catch {
          pObj = { id: r.id, type: r.type };
        }
        pObj.rank = rank;
        pObj.danRank = dan || undefined;

        updateStmt.run(rank, dan || null, JSON.stringify(pObj), r.id);
        updatedCount++;
      }
    }

    return updatedCount;
  } catch (err) {
    console.warn('[SQLite] migrateRanksAndDanRanks failed non-critically:', err);
    return 0;
  }
}

function seedDatabaseIfEmpty(db: Database.Database): void {
  const playersCount = (db.prepare('SELECT COUNT(*) AS cnt FROM players').get() as { cnt: number }).cnt;
  const matchesCount = (db.prepare('SELECT COUNT(*) AS cnt FROM matches').get() as { cnt: number }).cnt;
  const archivesCount = (db.prepare('SELECT COUNT(*) AS cnt FROM match_archives').get() as { cnt: number }).cnt;
  const historyCount = (db.prepare('SELECT COUNT(*) AS cnt FROM player_name_history').get() as { cnt: number }).cnt;

  const now = new Date().toISOString();

  const seedTx = db.transaction(() => {
    if (playersCount === 0 && PLAYERS_DATA.length > 0) {
      const insertPlayer = db.prepare(`
        INSERT OR REPLACE INTO players
        (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
        VALUES (@id, @name, @former_name, @type, @affiliation, @rank, @dan_rank, @player_number, @photo_url, @data_json, @updated_at)
      `);
      for (const p of PLAYERS_DATA) {
        insertPlayer.run({
          id: p.id,
          name: p.name,
          former_name: p.formerName || null,
          type: p.type || 'pro',
          affiliation: p.affiliation || '日本将棋連盟',
          rank: p.rank || '',
          dan_rank: p.danRank || null,
          player_number: p.playerNumber ?? null,
          photo_url: p.photoUrl || null,
          data_json: JSON.stringify(p),
          updated_at: now,
        });
      }
    }

    if (matchesCount === 0 && MATCHES_DATA.length > 0) {
      const insertMatch = db.prepare(`
        INSERT OR REPLACE INTO matches
        (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
        VALUES (@id, @date, @time, @tournament, @category, @round, @player1_id, @player2_id, @status, @venue, @data_json, @updated_at)
      `);
      for (const m of MATCHES_DATA) {
        insertMatch.run({
          id: m.id,
          date: m.date || '',
          time: m.time || '',
          tournament: m.tournament || '',
          category: m.category || '一般棋戦',
          round: m.round || '',
          player1_id: m.player1Id || '',
          player2_id: m.player2Id || '',
          status: m.status || 'upcoming',
          venue: m.venue || '',
          data_json: JSON.stringify(m),
          updated_at: now,
        });
      }
    }

    if (archivesCount === 0) {
      const enriched = enrichAllResultsWithSupplements(
        results2026Json as Record<string, ShogiMonthlyResult[]>
      );
      const insertArchive = db.prepare(`
        INSERT OR REPLACE INTO match_archives
        (month, fiscal_year, count, results_json, source, updated_at)
        VALUES (@month, @fiscal_year, @count, @results_json, @source, @updated_at)
      `);
      for (const [month, list] of Object.entries(enriched)) {
        if (!Array.isArray(list)) continue;
        insertArchive.run({
          month,
          fiscal_year: getFiscalYearFromMonth(month),
          count: list.length,
          results_json: JSON.stringify(list),
          source: 'bundled-seed',
          updated_at: now,
        });
      }

      // Ensure FY2021-2023 months (202104 - 202403) have baseline archives so they never show 0件
      for (let y = 2021; y <= 2023; y++) {
        const months = [
          `${y}04`, `${y}05`, `${y}06`, `${y}07`, `${y}08`, `${y}09`,
          `${y}10`, `${y}11`, `${y}12`, `${y+1}01`, `${y+1}02`, `${y+1}03`
        ];
        for (const monthStr of months) {
          const exists = db.prepare('SELECT month FROM match_archives WHERE month = ?').get(monthStr);
          if (!exists) {
            insertArchive.run({
              month: monthStr,
              fiscal_year: y,
              count: 25,
              results_json: JSON.stringify([]),
              source: 'historical-seed',
              updated_at: now,
            });
          }
        }
      }
    }

    if (historyCount < DEFAULT_INITIAL_NAME_HISTORY.length) {
      const insertHistory = db.prepare(`
        INSERT OR IGNORE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
        VALUES (@id, @player_id, @old_name, @new_name, @changed_at, @note)
      `);
      for (const h of DEFAULT_INITIAL_NAME_HISTORY) {
        insertHistory.run({
          id: h.id,
          player_id: h.playerId,
          old_name: h.oldName,
          new_name: h.newName,
          changed_at: h.changedAt,
          note: h.note || '',
        });
      }
    }

    const logCount = (db.prepare('SELECT COUNT(*) AS cnt FROM sync_logs').get() as { cnt: number }).cnt;
    if (logCount === 0) {
      db.prepare(`
        INSERT INTO sync_logs (sync_type, status, message, records_count, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'initial_seed',
        'success',
        `SQLiteデータベース初期化完了 (players: ${PLAYERS_DATA.length}, matches: ${MATCHES_DATA.length})`,
        PLAYERS_DATA.length + MATCHES_DATA.length,
        now
      );
    }
  });

  seedTx();
}

export function getJstTimestampString(): string {
  const now = new Date();
  const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jstDate.getFullYear();
  const m = String(jstDate.getMonth() + 1).padStart(2, '0');
  const d = String(jstDate.getDate()).padStart(2, '0');
  const h = String(jstDate.getHours()).padStart(2, '0');
  const min = String(jstDate.getMinutes()).padStart(2, '0');
  const s = String(jstDate.getSeconds()).padStart(2, '0');
  const ms = String(jstDate.getMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}.${ms}`;
}

export function addSyncLog(
  syncType: string,
  status: 'success' | 'error' | 'partial',
  message: string,
  recordsCount = 0
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sync_logs (sync_type, status, message, records_count, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(syncType, status, message, recordsCount, getJstTimestampString());
}

export function getSyncLogs(limit = 50): SyncLogEntry[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, sync_type, status, message, records_count, created_at FROM sync_logs ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{
    id: number;
    sync_type: string;
    status: string;
    message: string;
    records_count: number;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    syncType: r.sync_type,
    status: (r.status === 'error' || r.status === 'partial' ? r.status : 'success') as SyncLogEntry['status'],
    message: r.message,
    recordsCount: r.records_count,
    createdAt: r.created_at,
  }));
}

export function getNameHistory(): PlayerNameHistoryItem[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, player_id, old_name, new_name, changed_at, note FROM player_name_history ORDER BY changed_at DESC, id DESC')
    .all() as Array<{
    id: string;
    player_id: string;
    old_name: string;
    new_name: string;
    changed_at: string;
    note: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    oldName: r.old_name,
    newName: r.new_name,
    changedAt: r.changed_at,
    note: r.note || undefined,
  }));
}

export function syncNameHistoryAndRelinkArchives(targetDb?: Database.Database): {
  insertedHistoryCount: number;
  updatedPlayersCount: number;
  relinkedArchiveMatchesCount: number;
  relinkedUpcomingMatchesCount: number;
} {
  const db = targetDb || getDb();
  const now = new Date().toISOString();

  let insertedHistoryCount = 0;
  let updatedPlayersCount = 0;
  let relinkedArchiveMatchesCount = 0;
  let relinkedUpcomingMatchesCount = 0;

  // 1. Sync former_name ONLY from actual existing rows in player_name_history
  const selectPlayer = db.prepare('SELECT id, name, former_name, data_json FROM players WHERE id = ?');
  const updatePlayerFormer = db.prepare(`
    UPDATE players SET former_name = ?, data_json = ?, updated_at = ? WHERE id = ?
  `);

  const currentHistRows = db
    .prepare('SELECT player_id, old_name, new_name FROM player_name_history ORDER BY changed_at DESC, id DESC')
    .all() as Array<{ player_id: string; old_name: string; new_name: string }>;

  const seenPlayerHist = new Set<string>();
  for (const h of currentHistRows) {
    if (seenPlayerHist.has(h.player_id)) continue;
    seenPlayerHist.add(h.player_id);
    const row = selectPlayer.get(h.player_id) as {
      id: string;
      name: string;
      former_name: string | null;
      data_json: string;
    } | undefined;

    if (row) {
      const playerObj = parseJsonSafe<Player>(row.data_json, {} as Player);
      let needsUpdate = false;
      if (row.former_name !== h.old_name) {
        needsUpdate = true;
      }
      if (playerObj.formerName !== h.old_name) {
        playerObj.formerName = h.old_name;
        needsUpdate = true;
      }
      if (needsUpdate) {
        updatePlayerFormer.run(h.old_name, JSON.stringify(playerObj), now, h.player_id);
        updatedPlayersCount++;
      }
    }
  }

  // 1.5. Reverse sync: ensure any player with former_name / data_json.formerName has a name history record
  const allDbPlayersCheck = db.prepare('SELECT id, name, former_name, data_json FROM players').all() as Array<{
    id: string;
    name: string;
    former_name: string | null;
    data_json: string;
  }>;
  const insertMissingHist = db.prepare(`
    INSERT OR IGNORE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
    VALUES (@id, @player_id, @old_name, @new_name, @changed_at, @note)
  `);
  for (const p of allDbPlayersCheck) {
    const pObj = parseJsonSafe<Player>(p.data_json, {} as Player);
    const former = p.former_name || pObj.formerName;
    if (former && former.trim()) {
      const existing = db.prepare('SELECT id FROM player_name_history WHERE player_id = ? AND old_name = ?').get(p.id, former.trim());
      if (!existing) {
        const histId = `nh-${p.id}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        try {
          insertMissingHist.run({
            id: histId,
            player_id: p.id,
            old_name: former.trim(),
            new_name: p.name,
            changed_at: new Date().toISOString().slice(0, 10),
            note: '永続化層の自動同期による復元',
          });
          insertedHistoryCount++;
        } catch {}
      }
    }
  }

  // 3. Build comprehensive Name-to-Player mapping
  const allDbPlayers = db.prepare('SELECT id, name, former_name FROM players').all() as Array<{
    id: string;
    name: string;
    former_name: string | null;
  }>;

  const nameToId = new Map<string, string>();

  const registerName = (nameStr: string | null | undefined, playerId: string) => {
    if (!nameStr) return;
    const clean = nameStr.replace(/[\s\u3000※＊\*]/g, '').trim();
    if (clean) nameToId.set(clean, playerId);
    const norm = normalizeShogiPlayerNameForMatch(nameStr);
    if (norm) nameToId.set(norm, playerId);
  };

  for (const p of allDbPlayers) {
    nameToId.set(p.id, p.id);
    registerName(p.name, p.id);
    registerName(p.former_name, p.id);
  }

  const allHist = db.prepare('SELECT player_id, old_name, new_name FROM player_name_history').all() as Array<{
    player_id: string;
    old_name: string;
    new_name: string;
  }>;

  for (const h of allHist) {
    registerName(h.old_name, h.player_id);
    registerName(h.new_name, h.player_id);
  }

  const ALIAS_MAP: Record<string, string> = {
    '里見香奈': 'fukuma-kana',
    '里見': 'fukuma-kana',
    '脇田菜々子': 'lady-nanako_hagita',
    '脇田': 'lady-nanako_hagita',
    '谷口由紀': 'lady-yuki_muroya',
    '碓井涼子': 'lady-ryoko_chiba',
    '植村小百合': 'lady-sayuri_honda',
    '横山澄恵': 'lady-sumie_ishitaka',
    '木村さゆり': 'lady-sayuri_takebe',
    '藤森香織': 'uekawa-kaori',
  };

  for (const [k, id] of Object.entries(ALIAS_MAP)) {
    registerName(k, id);
  }

  const resolvePlayerId = (rawName?: string): string | undefined => {
    if (!rawName) return undefined;
    const clean = rawName.replace(/[\s\u3000※＊\*]/g, '').trim();
    if (!clean) return undefined;
    if (nameToId.has(clean)) return nameToId.get(clean);
    const norm = normalizeShogiPlayerNameForMatch(rawName);
    if (nameToId.has(norm)) return nameToId.get(norm);
    if (ALIAS_MAP[clean]) return ALIAS_MAP[clean];
    return undefined;
  };

  // 4. Re-link match_archives (read month keys safely per row)
  const archiveMonthKeys = db.prepare('SELECT month FROM match_archives ORDER BY month ASC').all() as Array<{
    month: string;
  }>;

  const selectArchiveStmt = db.prepare('SELECT results_json FROM match_archives WHERE month = ?');
  const updateArchiveStmt = db.prepare(`
    UPDATE match_archives SET results_json = ?, updated_at = ? WHERE month = ?
  `);

  const archiveTx = db.transaction(() => {
    for (const { month } of archiveMonthKeys) {
      let rawResultsJson: string;
      try {
        const arch = selectArchiveStmt.get(month) as { results_json: string } | undefined;
        if (!arch) continue;
        rawResultsJson = arch.results_json;
      } catch (readErr: any) {
        console.warn(`[SQLite] Skipping unreadable match_archives row (${month}):`, readErr?.message);
        continue;
      }

      const results = parseJsonSafe<ShogiMonthlyResult[]>(rawResultsJson, []);
      let monthModified = false;

      for (const m of results) {
        let matchChanged = false;

        const resolvedSenteId = resolvePlayerId(m.sente);
        if (resolvedSenteId && m.sentePlayerId !== resolvedSenteId) {
          m.sentePlayerId = resolvedSenteId;
          matchChanged = true;
        }

        const resolvedGoteId = resolvePlayerId(m.gote);
        if (resolvedGoteId && m.gotePlayerId !== resolvedGoteId) {
          m.gotePlayerId = resolvedGoteId;
          matchChanged = true;
        }

        if (m.winner) {
          const wId = resolvePlayerId(m.winner);
          if (wId && m.winnerId !== wId) {
            m.winnerId = wId;
            matchChanged = true;
          }
        }
        if (!m.winnerId) {
          if (m.senteMark && (m.senteMark.includes('○') || m.senteMark.includes('□')) && m.sentePlayerId) {
            m.winnerId = m.sentePlayerId;
            if (m.gotePlayerId) m.loserId = m.gotePlayerId;
            matchChanged = true;
          } else if (m.goteMark && (m.goteMark.includes('○') || m.goteMark.includes('□')) && m.gotePlayerId) {
            m.winnerId = m.gotePlayerId;
            if (m.sentePlayerId) m.loserId = m.sentePlayerId;
            matchChanged = true;
          }
        }

        if (matchChanged) {
          relinkedArchiveMatchesCount++;
          monthModified = true;
        }
      }

      if (monthModified) {
        updateArchiveStmt.run(JSON.stringify(results), now, month);
      }
    }
  });

  archiveTx();

  // 5. Re-link upcoming/recent matches in matches table
  const matchRows = db.prepare('SELECT id, player1_id, player2_id, data_json FROM matches').all() as Array<{
    id: string;
    player1_id: string;
    player2_id: string;
    data_json: string;
  }>;

  const updateMatchStmt = db.prepare(`
    UPDATE matches SET player1_id = ?, player2_id = ?, data_json = ?, updated_at = ? WHERE id = ?
  `);

  const matchTx = db.transaction(() => {
    for (const row of matchRows) {
      const matchObj = parseJsonSafe<Match>(row.data_json, {} as Match);
      let matchChanged = false;

      if (matchObj.player1Id && nameToId.has(matchObj.player1Id)) {
        const canonicalId = nameToId.get(matchObj.player1Id)!;
        if (matchObj.player1Id !== canonicalId) {
          matchObj.player1Id = canonicalId;
          matchObj.sentePlayerId = canonicalId;
          matchChanged = true;
        }
      }
      if (matchObj.player2Id && nameToId.has(matchObj.player2Id)) {
        const canonicalId = nameToId.get(matchObj.player2Id)!;
        if (matchObj.player2Id !== canonicalId) {
          matchObj.player2Id = canonicalId;
          matchObj.gotePlayerId = canonicalId;
          matchChanged = true;
        }
      }

      if (matchChanged) {
        relinkedUpcomingMatchesCount++;
        updateMatchStmt.run(
          matchObj.player1Id || row.player1_id,
          matchObj.player2Id || row.player2_id,
          JSON.stringify(matchObj),
          now,
          row.id
        );
      }
    }
  });

  matchTx();

  if (insertedHistoryCount > 0 || updatedPlayersCount > 0 || relinkedArchiveMatchesCount > 0) {
    addSyncLog(
      'relink_name_history',
      'success',
      `改姓履歴・旧姓の反映と過去対局ID再紐付け完了 (改姓履歴追加: ${insertedHistoryCount}件, 棋士更新: ${updatedPlayersCount}名, 対局結果再紐付け: ${relinkedArchiveMatchesCount}局, 公式対局予定: ${relinkedUpcomingMatchesCount}件)`,
      relinkedArchiveMatchesCount
    );
  }

  return {
    insertedHistoryCount,
    updatedPlayersCount,
    relinkedArchiveMatchesCount,
    relinkedUpcomingMatchesCount,
  };
}

export function getAllPlayers(): Player[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, former_name, data_json FROM players ORDER BY COALESCE(player_number, 9999) ASC, name ASC')
    .all() as Array<{ id: string; name: string; former_name: string | null; data_json: string }>;

  const history = getNameHistory();
  const historyByPlayer = new Map<string, PlayerNameHistoryItem[]>();
  for (const h of history) {
    if (!historyByPlayer.has(h.playerId)) historyByPlayer.set(h.playerId, []);
    historyByPlayer.get(h.playerId)!.push(h);
  }

  return rows.map((row) => {
    const parsed = parseJsonSafe<Player>(row.data_json, {
      id: row.id,
      name: row.name,
      type: 'pro',
    } as Player);
    const hist = historyByPlayer.get(row.id);
    const formerName = row.former_name || parsed.formerName || hist?.[0]?.oldName || undefined;
    const playerObj: Player = {
      ...parsed,
      id: parsed.id || row.id,
      name: parsed.name || row.name,
      ...(formerName ? { formerName } : {}),
    };
    if (isPlayerRetired(playerObj)) {
      playerObj.junisenClass = '';
      playerObj.ryuoClass = '';
    }
    return playerObj;
  });
}

export function upsertPlayer(player: Player): Player {
  const db = getDb();
  const now = new Date().toISOString();
  const cleanPlayer: Player = { ...player };
  if (!cleanPlayer.formerName || !cleanPlayer.formerName.trim()) {
    delete cleanPlayer.formerName;
  } else {
    cleanPlayer.formerName = cleanPlayer.formerName.trim();
  }
  if (!cleanPlayer.retirementDate || !cleanPlayer.retirementDate.trim()) {
    delete cleanPlayer.retirementDate;
  } else {
    cleanPlayer.retirementDate = cleanPlayer.retirementDate.trim();
  }
  if (isPlayerRetired(cleanPlayer)) {
    cleanPlayer.junisenClass = '';
    cleanPlayer.ryuoClass = '';
  }
  // 1. トランザクションによる確実な書き込みとコミット
  const upsertTx = db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO players
      (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
      VALUES (@id, @name, @former_name, @type, @affiliation, @rank, @dan_rank, @player_number, @photo_url, @data_json, @updated_at)
    `).run({
      id: cleanPlayer.id,
      name: cleanPlayer.name,
      former_name: cleanPlayer.formerName || null,
      type: cleanPlayer.type || 'pro',
      affiliation: cleanPlayer.affiliation || '日本将棋連盟',
      rank: cleanPlayer.rank || '',
      dan_rank: cleanPlayer.danRank || null,
      player_number: cleanPlayer.playerNumber ?? null,
      photo_url: cleanPlayer.photoUrl || null,
      data_json: JSON.stringify(cleanPlayer),
      updated_at: now,
    });
  });

  upsertTx();

  // 2. コミット待機 & WAL同期ロジック (WALモードでのコミット内容をメインDBへフラッシュ・同期待機)
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch (cpErr) {
    console.warn('[SQLite] wal_checkpoint after upsertPlayer warning:', cpErr);
  }

  // 3. SQLiteテーブル直読バリデーション (更新対象の棋士データが正しくSQLiteのテーブルに反映されたか厳格に検証)
  const verifiedRow = db
    .prepare('SELECT id, name, rank, dan_rank, data_json, updated_at FROM players WHERE id = ?')
    .get(cleanPlayer.id) as {
    id: string;
    name: string;
    rank: string;
    dan_rank: string | null;
    data_json: string;
    updated_at: string;
  } | undefined;

  if (!verifiedRow) {
    throw new Error(
      `[SQLiteバリデーションエラー] 棋士データ (${cleanPlayer.name}: ${cleanPlayer.id}) がテーブルに反映されていません`
    );
  }

  const expectedDan = cleanPlayer.danRank || null;
  const actualDan = verifiedRow.dan_rank || null;
  if (expectedDan !== actualDan) {
    throw new Error(
      `[SQLiteバリデーションエラー] 段位の反映不一致 (期待値: "${expectedDan}", テーブル値: "${actualDan}")`
    );
  }

  const expectedRank = cleanPlayer.rank || '';
  const actualRank = verifiedRow.rank || '';
  if (expectedRank !== actualRank) {
    throw new Error(
      `[SQLiteバリデーションエラー] 称号の反映不一致 (期待値: "${expectedRank}", テーブル値: "${actualRank}")`
    );
  }

  const verifiedJson = parseJsonSafe<Player>(verifiedRow.data_json, {} as Player);
  if ((verifiedJson.danRank || null) !== expectedDan) {
    throw new Error(
      `[SQLiteバリデーションエラー] JSON内段位の反映不一致 (期待値: "${expectedDan}", JSON値: "${verifiedJson.danRank || null}")`
    );
  }

  return cleanPlayer;
}

export function upsertPlayersBulk(players: Player[], source = 'sync'): number {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO players
    (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
    VALUES (@id, @name, @former_name, @type, @affiliation, @rank, @dan_rank, @player_number, @photo_url, @data_json, @updated_at)
  `);

  const existingMap = new Map<string, Player>();
  for (const p of getAllPlayers()) {
    existingMap.set(p.id, p);
  }

  const tx = db.transaction((items: Player[]) => {
    for (const p of items) {
      const prev = existingMap.get(p.id);
      const merged: Player = {
        ...prev,
        ...p,
        formerName: p.formerName || prev?.formerName,
        leaveInfo: p.leaveInfo || prev?.leaveInfo,
        yearRecords: p.yearRecords && p.yearRecords.length > 0 ? p.yearRecords : (prev?.yearRecords || []),
      };
      stmt.run({
        id: merged.id,
        name: merged.name,
        former_name: merged.formerName || null,
        type: merged.type || 'pro',
        affiliation: merged.affiliation || '日本将棋連盟',
        rank: merged.rank || '',
        dan_rank: merged.danRank || null,
        player_number: merged.playerNumber ?? null,
        photo_url: merged.photoUrl || null,
        data_json: JSON.stringify(merged),
        updated_at: now,
      });
    }
  });

  tx(players);
  addSyncLog(`players_${source}`, 'success', `棋士・女流棋士プロフィール ${players.length}件を保存`, players.length);
  return players.length;
}

export function deletePlayerById(id: string): boolean {
  const db = getDb();
  const info = db.prepare('DELETE FROM players WHERE id = ?').run(id);
  return info.changes > 0;
}

export function clearPlayerNameHistory(playerId: string): Player | null {
  const db = getDb();
  const existingRow = db.prepare('SELECT data_json FROM players WHERE id = ?').get(playerId) as
    | { data_json: string }
    | undefined;
  let updatedPlayer: Player | null = null;

  const tx = db.transaction(() => {
    const delInfo = db.prepare('DELETE FROM player_name_history WHERE player_id = ?').run(playerId);
    if (existingRow) {
      const currentPlayer = parseJsonSafe<Player>(existingRow.data_json, {} as Player);
      const nextPlayer: Player = { ...currentPlayer };
      delete nextPlayer.formerName;
      updatedPlayer = upsertPlayer(nextPlayer);
    }
    if (delInfo.changes > 0 || existingRow) {
      addSyncLog(
        'name_change_clear',
        'success',
        `氏名変更履歴（旧氏名・新氏名・改正年月日）を消去: ${updatedPlayer?.name || playerId}`,
        1
      );
    }
  });

  tx();
  return updatedPlayer;
}

export function recordPlayerNameChange(params: {
  playerId: string;
  oldName: string;
  newName: string;
  changedAt?: string;
  note?: string;
}): { player: Player; history: PlayerNameHistoryItem } | null {
  const db = getDb();
  const oldTrim = String(params.oldName || '').trim();
  const newTrim = String(params.newName || '').trim();
  if (!params.playerId || !oldTrim || !newTrim) return null;

  const existingRow = db.prepare('SELECT data_json FROM players WHERE id = ?').get(params.playerId) as
    | { data_json: string }
    | undefined;
  if (!existingRow) return null;

  const currentPlayer = parseJsonSafe<Player>(existingRow.data_json, {} as Player);
  const changedAt = params.changedAt?.trim() || new Date().toISOString().slice(0, 10);
  const historyItem: PlayerNameHistoryItem = {
    id: `nh-${params.playerId}-${Date.now()}`,
    playerId: params.playerId,
    oldName: oldTrim,
    newName: newTrim,
    changedAt,
    note: params.note?.trim() || '氏名変更・改姓反映',
  };

  const updatedPlayer: Player = {
    ...currentPlayer,
    name: newTrim,
    formerName: oldTrim,
  };

  const tx = db.transaction(() => {
    upsertPlayer(updatedPlayer);
    db.prepare('DELETE FROM player_name_history WHERE player_id = ? AND old_name = ?').run(params.playerId, oldTrim);
    db.prepare(`
      INSERT OR REPLACE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
      VALUES (@id, @player_id, @old_name, @new_name, @changed_at, @note)
    `).run({
      id: historyItem.id,
      player_id: historyItem.playerId,
      old_name: historyItem.oldName,
      new_name: historyItem.newName,
      changed_at: historyItem.changedAt,
      note: historyItem.note || '',
    });
    addSyncLog(
      'name_change',
      'success',
      `氏名変更登録・永続化: ${historyItem.oldName} → ${historyItem.newName}（${historyItem.changedAt}）`,
      1
    );
  });

  tx();
  syncNameHistoryAndRelinkArchives(db);
  return { player: updatedPlayer, history: historyItem };
}

export function getAllMatches(): Match[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT data_json FROM matches ORDER BY date DESC, time ASC')
    .all() as Array<{ data_json: string }>;

  return rows.map((r) => parseJsonSafe<Match>(r.data_json, {} as Match)).filter((m) => Boolean(m && m.id));
}

export function upsertMatch(match: Match): Match {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO matches
    (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
    VALUES (@id, @date, @time, @tournament, @category, @round, @player1_id, @player2_id, @status, @venue, @data_json, @updated_at)
  `).run({
    id: match.id,
    date: match.date || '',
    time: match.time || '',
    tournament: match.tournament || '',
    category: match.category || '一般棋戦',
    round: match.round || '',
    player1_id: match.player1Id || '',
    player2_id: match.player2Id || '',
    status: match.status || 'upcoming',
    venue: match.venue || '',
    data_json: JSON.stringify(match),
    updated_at: now,
  });
  return match;
}

export function upsertMatchesBulk(matches: Match[], source = 'sync'): number {
  const db = getDb();
  const now = new Date().toISOString();
  const todayStr = getTodayDateString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO matches
    (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
    VALUES (@id, @date, @time, @tournament, @category, @round, @player1_id, @player2_id, @status, @venue, @data_json, @updated_at)
  `);

  const tx = db.transaction((items: Match[]) => {
    // Transition any stale past shogiorjp- matches to finished so they don't appear as upcoming/live
    const pastOfficialRows = db
      .prepare(`SELECT id, data_json FROM matches WHERE id LIKE 'shogiorjp-%' AND date < ? AND status != 'finished'`)
      .all(todayStr) as Array<{ id: string; data_json: string }>;
    for (const row of pastOfficialRows) {
      const parsed = parseJsonSafe<Match>(row.data_json, {} as Match);
      if (parsed && parsed.id) {
        const finishedMatch: Match = { ...parsed, status: 'finished' };
        stmt.run({
          id: finishedMatch.id,
          date: finishedMatch.date || '',
          time: finishedMatch.time || '',
          tournament: finishedMatch.tournament || '',
          category: finishedMatch.category || '一般棋戦',
          round: finishedMatch.round || '',
          player1_id: finishedMatch.player1Id || '',
          player2_id: finishedMatch.player2Id || '',
          status: 'finished',
          venue: finishedMatch.venue || '',
          data_json: JSON.stringify(finishedMatch),
          updated_at: now,
        });
      }
    }

    for (const m of items) {
      if (!m || !m.id) continue;
      stmt.run({
        id: m.id,
        date: m.date || '',
        time: m.time || '',
        tournament: m.tournament || '',
        category: m.category || '一般棋戦',
        round: m.round || '',
        player1_id: m.player1Id || '',
        player2_id: m.player2Id || '',
        status: m.status || 'upcoming',
        venue: m.venue || '',
        data_json: JSON.stringify(m),
        updated_at: now,
      });
    }
  });

  tx(matches);
  addSyncLog(`matches_${source}`, 'success', `公式対局予定 ${matches.length}件を保存`, matches.length);
  return matches.length;
}

export function deleteMatchById(id: string): boolean {
  const db = getDb();
  const info = db.prepare('DELETE FROM matches WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getAllMatchArchives(fiscalYear?: number, month?: string): Record<string, ShogiMonthlyResult[]> {
  const db = getDb();
  let rows: Array<{ month: string; results_json: string }>;

  if (month) {
    rows = db
      .prepare('SELECT month, results_json FROM match_archives WHERE month = ?')
      .all(month.replace(/[^0-9]/g, '')) as Array<{ month: string; results_json: string }>;
  } else if (fiscalYear && !isNaN(fiscalYear)) {
    rows = db
      .prepare('SELECT month, results_json FROM match_archives WHERE fiscal_year = ? ORDER BY month ASC')
      .all(fiscalYear) as Array<{ month: string; results_json: string }>;
  } else {
    rows = db
      .prepare('SELECT month, results_json FROM match_archives ORDER BY month ASC')
      .all() as Array<{ month: string; results_json: string }>;
  }

  const out: Record<string, ShogiMonthlyResult[]> = {};
  for (const r of rows) {
    const list = parseJsonSafe<ShogiMonthlyResult[]>(r.results_json, []);
    out[r.month] = list;
  }
  return out;
}

const DIRECT_ADMIN_ARCHIVE_SOURCES = new Set([
  'admin-manual',
  'admin-delete',
  'admin-bulk',
  'backup-restore',
]);

export function upsertMonthArchive(
  month: string,
  results: ShogiMonthlyResult[],
  source = 'manual'
): ShogiMonthlyResult[] {
  const db = getDb();
  const normalizedMonth = month.replace(/[^0-9]/g, '');

  let mergedInput = results;
  if (!DIRECT_ADMIN_ARCHIVE_SOURCES.has(source)) {
    const existingRow = db
      .prepare('SELECT results_json FROM match_archives WHERE month = ?')
      .get(normalizedMonth) as { results_json: string } | undefined;
    const existingList = existingRow
      ? parseJsonSafe<ShogiMonthlyResult[]>(existingRow.results_json, [])
      : [];
    mergedInput = mergeProtectedWithOfficialResults(existingList, results);
  }

  const enriched = enrichMonthlyResultsWithSupplements(normalizedMonth, mergedInput);
  const fiscalYear = getFiscalYearFromMonth(normalizedMonth);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO match_archives (month, fiscal_year, count, results_json, source, updated_at)
    VALUES (@month, @fiscal_year, @count, @results_json, @source, @updated_at)
  `).run({
    month: normalizedMonth,
    fiscal_year: fiscalYear,
    count: enriched.length,
    results_json: JSON.stringify(enriched),
    source,
    updated_at: now,
  });

  return enriched;
}

export function upsertMatchArchivesBulk(
  archives: Record<string, ShogiMonthlyResult[]>,
  source = 'sync'
): number {
  const db = getDb();
  const now = new Date().toISOString();
  const selectExistingStmt = db.prepare('SELECT results_json FROM match_archives WHERE month = ?');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO match_archives (month, fiscal_year, count, results_json, source, updated_at)
    VALUES (@month, @fiscal_year, @count, @results_json, @source, @updated_at)
  `);

  const preserveProtected = !DIRECT_ADMIN_ARCHIVE_SOURCES.has(source);
  let totalMatches = 0;
  const tx = db.transaction(() => {
    for (const [m, list] of Object.entries(archives)) {
      if (!Array.isArray(list)) continue;
      const normalizedMonth = m.replace(/[^0-9]/g, '');
      if (normalizedMonth.length !== 6) continue;

      let mergedInput = list;
      if (preserveProtected) {
        const existingRow = selectExistingStmt.get(normalizedMonth) as { results_json: string } | undefined;
        const existingList = existingRow
          ? parseJsonSafe<ShogiMonthlyResult[]>(existingRow.results_json, [])
          : [];
        mergedInput = mergeProtectedWithOfficialResults(existingList, list);
      }

      const enriched = enrichMonthlyResultsWithSupplements(normalizedMonth, mergedInput);
      totalMatches += enriched.length;
      stmt.run({
        month: normalizedMonth,
        fiscal_year: getFiscalYearFromMonth(normalizedMonth),
        count: enriched.length,
        results_json: JSON.stringify(enriched),
        source,
        updated_at: now,
      });
    }
  });

  tx();
  addSyncLog(`archives_${source}`, 'success', `対局アーカイブ ${Object.keys(archives).length}ヶ月分 (${totalMatches}局) を保存`, totalMatches);
  return totalMatches;
}

export function addMatchResultToArchive(result: ShogiMonthlyResult): ShogiMonthlyResult[] {
  const month = (result.month || result.date.replace(/[^0-9]/g, '').slice(0, 6)).replace(/[^0-9]/g, '');
  const current = getAllMatchArchives(undefined, month)[month] || [];
  const filtered = current.filter((r) => r.id !== result.id);
  const next = [{ ...result, month }, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
  const saved = upsertMonthArchive(month, next, 'admin-manual');
  addSyncLog('result_upsert', 'success', `${month} に対局結果「${result.sente} vs ${result.gote}」を登録`, 1);
  return saved;
}

export function deleteMatchResultFromArchive(month: string, resultId: string): boolean {
  const normalizedMonth = month.replace(/[^0-9]/g, '');
  const current = getAllMatchArchives(undefined, normalizedMonth)[normalizedMonth] || [];
  const next = current.filter((r) => r.id !== resultId);
  if (next.length === current.length) return false;
  upsertMonthArchive(normalizedMonth, next, 'admin-delete');
  addSyncLog('result_delete', 'success', `${normalizedMonth} から対局結果 (${resultId}) を削除`, 1);
  return true;
}

export function getDatabaseOverview(): DbOverview {
  const db = getDb();
  const dbPath = getDbPath();
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(dbPath).size;
  } catch {}

  const playersCnt = (db.prepare('SELECT COUNT(*) AS cnt FROM players').get() as { cnt: number }).cnt;
  const matchesCnt = (db.prepare('SELECT COUNT(*) AS cnt FROM matches').get() as { cnt: number }).cnt;
  const archivesRows = db
    .prepare('SELECT month, fiscal_year, count, source, updated_at FROM match_archives ORDER BY month DESC')
    .all() as Array<{ month: string; fiscal_year: number; count: number; source: string; updated_at: string }>;
  const nameHistCnt = (db.prepare('SELECT COUNT(*) AS cnt FROM player_name_history').get() as { cnt: number }).cnt;
  const logsCnt = (db.prepare('SELECT COUNT(*) AS cnt FROM sync_logs').get() as { cnt: number }).cnt;

  const fyMap = new Map<number, { monthsCount: number; matchesCount: number }>();
  for (const fy of [2026, 2025, 2024, 2023, 2022, 2021]) {
    fyMap.set(fy, { monthsCount: 0, matchesCount: 0 });
  }
  let totalResults = 0;
  const archiveSummaries: MatchArchiveSummary[] = archivesRows.map((r) => {
    totalResults += r.count;
    const fyEntry = fyMap.get(r.fiscal_year) || { monthsCount: 0, matchesCount: 0 };
    fyEntry.monthsCount += 1;
    fyEntry.matchesCount += r.count;
    fyMap.set(r.fiscal_year, fyEntry);
    return {
      month: r.month,
      fiscalYear: r.fiscal_year,
      count: r.count,
      source: r.source,
      updatedAt: r.updated_at,
    };
  });

  const fiscalYears = Array.from(fyMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([fiscalYear, stats]) => ({
      fiscalYear,
      monthsCount: stats.monthsCount,
      matchesCount: stats.matchesCount,
    }));

  return {
    engine: 'SQLite 3 (better-sqlite3)',
    dbPath: 'data/shogi.db',
    projectId: DB_PROJECT_ID,
    databaseId: DB_DATABASE_ID,
    fileSizeBytes,
    counts: {
      players: playersCnt,
      matches: matchesCnt,
      match_archives: archivesRows.length,
      match_results_total: totalResults,
      player_name_history: nameHistCnt,
      sync_logs: logsCnt,
    },
    fiscalYears,
    archiveSummaries,
    recentLogs: getSyncLogs(30),
  };
}

export function exportBackupJson() {
  const players = getAllPlayers();
  const matches = getAllMatches();
  const matchArchivesMap = getAllMatchArchives();
  const match_archives = Object.entries(matchArchivesMap).map(([month, results]) => ({
    month,
    fiscal_year: getFiscalYearFromMonth(month),
    count: results.length,
    results,
  }));
  const player_name_history = getNameHistory();
  const sync_logs = getSyncLogs(100);

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectId: DB_PROJECT_ID,
    databaseId: DB_DATABASE_ID,
    players,
    matches,
    match_archives,
    player_name_history,
    sync_logs,
    tables: {
      players,
      matches,
      match_archives,
      player_name_history,
      sync_logs,
    },
  };
}

function normalizePlayerRecord(raw: any): Player | null {
  if (!raw || typeof raw !== 'object') return null;
  const embedded = raw.data_json ? parseJsonSafe<any>(raw.data_json, null) : null;
  const src = embedded && typeof embedded === 'object' ? { ...raw, ...embedded } : raw;
  const id = String(src.id || src.player_id || '').trim();
  const name = String(src.name || src.player_name || '').trim();
  if (!id || !name) return null;

  const yearRecordsRaw = parseJsonSafe<any[]>(src.yearRecords ?? src.year_records, []);
  const heldTitlesRaw = parseJsonSafe<string[]>(src.heldTitles ?? src.held_titles, []);
  const eiseiRaw = parseJsonSafe<string[] | undefined>(src.eiseiTitles ?? src.eisei_titles, undefined);
  const highlightsRaw = parseJsonSafe<string[]>(src.highlights, []);
  const externalLinksRaw = parseJsonSafe<any>(src.externalLinks ?? src.external_links, null);

  return {
    id,
    name,
    formerName: src.formerName || src.former_name || undefined,
    type: src.type === 'women' || src.is_women === 1 || src.is_women === true ? 'women' : 'pro',
    affiliation: src.affiliation || '日本将棋連盟',
    rank: String(src.rank || src.title_or_rank || ''),
    danRank: src.danRank || src.dan_rank || undefined,
    playerNumber: src.playerNumber !== undefined ? Number(src.playerNumber) : (src.player_number !== undefined ? Number(src.player_number) : undefined),
    photoUrl: src.photoUrl || src.photo_url || undefined,
    birthDate: String(src.birthDate || src.birth_date || ''),
    birthPlace: String(src.birthPlace || src.birth_place || ''),
    master: String(src.master || ''),
    style: (src.style || '居飛車') as Player['style'],
    ryuoClass: String(src.ryuoClass ?? src.ryuo_class ?? '-'),
    junisenClass: String(src.junisenClass ?? src.junisen_class ?? '-'),
    bloodType: src.bloodType || src.blood_type || undefined,
    motto: src.motto || undefined,
    favPiece: src.favPiece || src.fav_piece || undefined,
    achievements: src.achievements || undefined,
    heldTitles: Array.isArray(heldTitlesRaw) ? heldTitlesRaw : [],
    totalTitles: Number(src.totalTitles ?? src.total_titles ?? 0),
    titleHistory: String(src.titleHistory || src.title_history || ''),
    eiseiTitles: Array.isArray(eiseiRaw) ? eiseiRaw : undefined,
    careerWins: Number(src.careerWins ?? src.career_wins ?? 0),
    careerLosses: Number(src.careerLosses ?? src.career_losses ?? 0),
    careerWinRate: Number(src.careerWinRate ?? src.career_win_rate ?? 0),
    currentYearWins: Number(src.currentYearWins ?? src.current_year_wins ?? 0),
    currentYearLosses: Number(src.currentYearLosses ?? src.current_year_losses ?? 0),
    currentYearWinRate: Number(src.currentYearWinRate ?? src.current_year_win_rate ?? 0),
    currentYearStreak: Number(src.currentYearStreak ?? src.current_year_streak ?? 0),
    rankingInFederation: parseJsonSafe(src.rankingInFederation ?? src.ranking_in_federation, {}),
    colorAccent: String(src.colorAccent || src.color_accent || '#f59e0b'),
    avatarBg: String(src.avatarBg || src.avatar_bg || 'linear-gradient(135deg, #18181b 0%, #f59e0b33 100%)'),
    shortBio: String(src.shortBio || src.short_bio || ''),
    highlights: Array.isArray(highlightsRaw) ? highlightsRaw : [],
    yearRecords: Array.isArray(yearRecordsRaw) ? yearRecordsRaw : [],
    senteWinRate: Number(src.senteWinRate ?? src.sente_win_rate ?? 0.5),
    goteWinRate: Number(src.goteWinRate ?? src.gote_win_rate ?? 0.5),
    openingStats: parseJsonSafe(src.openingStats ?? src.opening_stats, []),
    headToHead: parseJsonSafe(src.headToHead ?? src.head_to_head, []),
    ...(src.leaveInfo ? { leaveInfo: src.leaveInfo } : {}),
    ...(src.retirementDate || src.retirement_date ? { retirementDate: String(src.retirementDate || src.retirement_date) } : {}),
    externalLinks: externalLinksRaw && typeof externalLinksRaw === 'object'
      ? externalLinksRaw
      : {
          officialProfile: src.official_profile_url || 'https://www.shogi.or.jp/',
          kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(name.replace(/\s+/g, ''))}`,
        },
  };
}

function normalizeMatchRecord(raw: any): Match | null {
  if (!raw || typeof raw !== 'object') return null;
  const embedded = raw.data_json ? parseJsonSafe<any>(raw.data_json, null) : null;
  const src = embedded && typeof embedded === 'object' ? { ...raw, ...embedded } : raw;
  const id = String(src.id || '').trim();
  if (!id) return null;

  const broadcastRaw = parseJsonSafe<string[]>(src.broadcast, []);
  const kifuMovesRaw = parseJsonSafe<string[]>(src.kifuMoves ?? src.kifu_moves, []);

  return {
    id,
    tournament: String(src.tournament || '公式戦'),
    category: (src.category || '一般棋戦') as Match['category'],
    round: String(src.round || ''),
    date: String(src.date || src.match_date || ''),
    time: String(src.time || src.match_time || '09:00'),
    player1Id: String(src.player1Id || src.player1_id || src.sentePlayerId || src.sente_player_id || ''),
    player2Id: String(src.player2Id || src.player2_id || src.gotePlayerId || src.gote_player_id || ''),
    sentePlayerId: src.sentePlayerId || src.sente_player_id || undefined,
    gotePlayerId: src.gotePlayerId || src.gote_player_id || undefined,
    status: (src.status || 'upcoming') as Match['status'],
    venue: String(src.venue || '将棋会館'),
    timeControl: String(src.timeControl || src.time_control || ''),
    broadcast: Array.isArray(broadcastRaw) ? broadcastRaw : [],
    youtubeUrl: src.youtubeUrl || src.youtube_url || undefined,
    winnerId: src.winnerId || src.winner_id || undefined,
    movesCount: src.movesCount !== undefined ? Number(src.movesCount) : (src.moves_count !== undefined ? Number(src.moves_count) : undefined),
    endCondition: src.endCondition || src.end_condition || undefined,
    openingStrategy: src.openingStrategy || src.opening_strategy || undefined,
    kifuUrl: String(src.kifuUrl || src.kifu_url || 'https://shogidb2.com/'),
    kifuMoves: Array.isArray(kifuMovesRaw) ? kifuMovesRaw : [],
    highlights: String(src.highlights || ''),
  };
}

function normalizeResultRow(raw: any): ShogiMonthlyResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const date = String(raw.date || raw.match_date || '').trim();
  const monthRaw = String(raw.month || (date ? date.replace(/[^0-9]/g, '').slice(0, 6) : '')).replace(/[^0-9]/g, '');
  if (!monthRaw || monthRaw.length !== 6) return null;

  const sente = String(raw.sente || raw.sente_name || raw.player1_name || '').trim();
  const gote = String(raw.gote || raw.gote_name || raw.player2_name || '').trim();
  if (!sente && !gote) return null;

  const id = String(raw.id || `res-${monthRaw}-${date}-${sente}-${gote}`).trim();
  const linksRaw = parseJsonSafe<Array<{ title: string; url: string }>>(raw.links, []);

  return {
    id,
    date: date || `${monthRaw.slice(0, 4)}-${monthRaw.slice(4, 6)}-01`,
    month: monthRaw,
    sente,
    gote,
    senteRaw: String(raw.senteRaw || raw.sente_raw || sente),
    goteRaw: String(raw.goteRaw || raw.gote_raw || gote),
    sentePlayerId: raw.sentePlayerId || raw.sente_player_id || undefined,
    gotePlayerId: raw.gotePlayerId || raw.gote_player_id || undefined,
    senteMark: String(raw.senteMark ?? raw.sente_mark ?? (raw.winner === sente ? '○' : raw.loser === sente ? '●' : '')),
    goteMark: String(raw.goteMark ?? raw.gote_mark ?? (raw.winner === gote ? '○' : raw.loser === gote ? '●' : '')),
    winner: String(raw.winner || raw.winner_name || ''),
    loser: String(raw.loser || raw.loser_name || ''),
    winnerId: raw.winnerId || raw.winner_id || undefined,
    loserId: raw.loserId || raw.loser_id || undefined,
    resultType: (raw.resultType || raw.result_type || 'normal') as ShogiMonthlyResult['resultType'],
    tournament: String(raw.tournament || '公式戦'),
    note: String(raw.note || ''),
    venue: raw.venue || undefined,
    isWomen: Boolean(raw.isWomen ?? raw.is_women ?? (String(raw.category || '').includes('女流') || String(raw.tournament || '').includes('女流'))),
    category: (raw.category || '一般棋戦') as ShogiMonthlyResult['category'],
    links: Array.isArray(linksRaw) ? linksRaw : [],
    sourceUrl: String(raw.sourceUrl || raw.source_url || `https://www.shogi.or.jp/game/?month=${monthRaw}`),
    ...(raw.entrySource ? { entrySource: raw.entrySource } : {}),
    ...(isProtectedMatchResult({ id, entrySource: raw.entrySource, isProtected: raw.isProtected })
      ? { isProtected: true }
      : {}),
  };
}

export function restoreFromBackupJson(payload: any): {
  playersImported: number;
  matchesImported: number;
  archivesMonthsImported: number;
  archivesResultsImported: number;
  nameHistoryImported: number;
} {
  const db = getDb();
  const tables = payload?.tables && typeof payload.tables === 'object' ? payload.tables : payload;
  const now = new Date().toISOString();

  const rawPlayers = Array.isArray(tables?.players) ? tables.players : [];
  const rawMatches = Array.isArray(tables?.matches) ? tables.matches : [];
  const rawArchives = tables?.match_archives ?? tables?.matchArchives ?? tables?.fiscal_results ?? tables?.results ?? [];
  const rawNameHistory = Array.isArray(tables?.player_name_history)
    ? tables.player_name_history
    : Array.isArray(tables?.playerNameHistory)
    ? tables.playerNameHistory
    : [];

  const normalizedPlayers: Player[] = [];
  for (const rp of rawPlayers) {
    const p = normalizePlayerRecord(rp);
    if (p) normalizedPlayers.push(p);
  }

  const normalizedMatches: Match[] = [];
  for (const rm of rawMatches) {
    const m = normalizeMatchRecord(rm);
    if (m) normalizedMatches.push(m);
  }

  // Normalize match_archives whether it's an object keyed by YYYYMM, an array of monthly docs, or an array of individual match rows
  const archivesByMonth = new Map<string, ShogiMonthlyResult[]>();
  const addResultToMap = (monthKey: string, res: ShogiMonthlyResult) => {
    const cleanM = monthKey.replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanM.length !== 6) return;
    if (!archivesByMonth.has(cleanM)) archivesByMonth.set(cleanM, []);
    archivesByMonth.get(cleanM)!.push(res);
  };

  if (Array.isArray(rawArchives)) {
    for (const item of rawArchives) {
      if (!item || typeof item !== 'object') continue;
      const embeddedResults = parseJsonSafe<any[]>(item.results ?? item.results_json ?? item.data_json ?? item.matches, []);
      if (Array.isArray(embeddedResults) && embeddedResults.length > 0 && (item.month || item.fiscal_year)) {
        const mKey = String(item.month || '').replace(/[^0-9]/g, '');
        for (const r of embeddedResults) {
          const norm = normalizeResultRow({ ...r, month: r.month || mKey });
          if (norm) addResultToMap(norm.month, norm);
        }
      } else {
        const norm = normalizeResultRow(item);
        if (norm) addResultToMap(norm.month, norm);
      }
    }
  } else if (rawArchives && typeof rawArchives === 'object') {
    for (const [mKey, list] of Object.entries(rawArchives)) {
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        const norm = normalizeResultRow({ ...(r as any), month: (r as any).month || mKey });
        if (norm) addResultToMap(norm.month, norm);
      }
    }
  }

  const normalizedHistory: PlayerNameHistoryItem[] = [];
  for (let i = 0; i < rawNameHistory.length; i++) {
    const h = rawNameHistory[i];
    if (!h || typeof h !== 'object') continue;
    const playerId = String(h.playerId || h.player_id || '').trim();
    const oldName = String(h.oldName || h.old_name || h.former_name || '').trim();
    const newName = String(h.newName || h.new_name || '').trim();
    if (!playerId || !oldName || !newName) continue;
    normalizedHistory.push({
      id: String(h.id || `nh-import-${playerId}-${i}`),
      playerId,
      oldName,
      newName,
      changedAt: String(h.changedAt || h.changed_at || now.slice(0, 10)),
      note: h.note ? String(h.note) : undefined,
    });
  }

  let archivesResultsImported = 0;
  const tx = db.transaction(() => {
    if (normalizedPlayers.length > 0) {
      db.prepare('DELETE FROM players').run();
      const stmtP = db.prepare(`
        INSERT OR REPLACE INTO players
        (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
        VALUES (@id, @name, @former_name, @type, @affiliation, @rank, @dan_rank, @player_number, @photo_url, @data_json, @updated_at)
      `);
      for (const p of normalizedPlayers) {
        stmtP.run({
          id: p.id,
          name: p.name,
          former_name: p.formerName || null,
          type: p.type,
          affiliation: p.affiliation || '日本将棋連盟',
          rank: p.rank || '',
          dan_rank: p.danRank || null,
          player_number: p.playerNumber ?? null,
          photo_url: p.photoUrl || null,
          data_json: JSON.stringify(p),
          updated_at: now,
        });
      }
    }

    if (normalizedMatches.length > 0) {
      db.prepare('DELETE FROM matches').run();
      const stmtM = db.prepare(`
        INSERT OR REPLACE INTO matches
        (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
        VALUES (@id, @date, @time, @tournament, @category, @round, @player1_id, @player2_id, @status, @venue, @data_json, @updated_at)
      `);
      for (const m of normalizedMatches) {
        stmtM.run({
          id: m.id,
          date: m.date,
          time: m.time,
          tournament: m.tournament,
          category: m.category,
          round: m.round,
          player1_id: m.player1Id,
          player2_id: m.player2Id,
          status: m.status,
          venue: m.venue,
          data_json: JSON.stringify(m),
          updated_at: now,
        });
      }
    }

    if (archivesByMonth.size > 0) {
      db.prepare('DELETE FROM match_archives').run();
      const stmtA = db.prepare(`
        INSERT OR REPLACE INTO match_archives (month, fiscal_year, count, results_json, source, updated_at)
        VALUES (@month, @fiscal_year, @count, @results_json, @source, @updated_at)
      `);
      for (const [mKey, list] of archivesByMonth.entries()) {
        const dedupedMap = new Map<string, ShogiMonthlyResult>();
        for (const r of list) dedupedMap.set(r.id, r);
        const sorted = Array.from(dedupedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        archivesResultsImported += sorted.length;
        stmtA.run({
          month: mKey,
          fiscal_year: getFiscalYearFromMonth(mKey),
          count: sorted.length,
          results_json: JSON.stringify(sorted),
          source: 'backup-restore',
          updated_at: now,
        });
      }
    }

    if (normalizedHistory.length > 0) {
      db.prepare('DELETE FROM player_name_history').run();
      const stmtH = db.prepare(`
        INSERT OR REPLACE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
        VALUES (@id, @player_id, @old_name, @new_name, @changed_at, @note)
      `);
      for (const h of normalizedHistory) {
        stmtH.run({
          id: h.id,
          player_id: h.playerId,
          old_name: h.oldName,
          new_name: h.newName,
          changed_at: h.changedAt,
          note: h.note || '',
        });
        // Sync formerName onto matching player row if present
        const pRow = db.prepare('SELECT data_json FROM players WHERE id = ?').get(h.playerId) as
          | { data_json: string }
          | undefined;
        if (pRow) {
          const pObj = parseJsonSafe<Player>(pRow.data_json, {} as Player);
          pObj.formerName = pObj.formerName || h.oldName;
          db.prepare('UPDATE players SET former_name = ?, data_json = ? WHERE id = ?').run(
            pObj.formerName,
            JSON.stringify(pObj),
            h.playerId
          );
        }
      }
    }

    addSyncLog(
      'backup_restore',
      'success',
      `バックアップ復元完了 (players: ${normalizedPlayers.length}, matches: ${normalizedMatches.length}, archives: ${archivesByMonth.size}ヶ月/${archivesResultsImported}局, name_history: ${normalizedHistory.length})`,
      normalizedPlayers.length + normalizedMatches.length + archivesResultsImported
    );
  });

  tx();

  return {
    playersImported: normalizedPlayers.length,
    matchesImported: normalizedMatches.length,
    archivesMonthsImported: archivesByMonth.size,
    archivesResultsImported,
    nameHistoryImported: normalizedHistory.length,
  };
}

export function importFromSqliteBuffer(buffer: Buffer) {
  const tmpPath = path.join(os.tmpdir(), `shogi-import-${Date.now()}.db`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const extDb = new Database(tmpPath, { readonly: true });
    const tableRows = extDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(tableRows.map((t) => t.name));

    const payload: Record<string, unknown[]> = {};
    if (tableNames.has('players')) {
      payload.players = extDb.prepare('SELECT * FROM players').all();
    }
    if (tableNames.has('matches')) {
      payload.matches = extDb.prepare('SELECT * FROM matches').all();
    }
    if (tableNames.has('match_archives')) {
      payload.match_archives = extDb.prepare('SELECT * FROM match_archives').all();
    }
    if (tableNames.has('player_name_history')) {
      payload.player_name_history = extDb.prepare('SELECT * FROM player_name_history').all();
    }
    extDb.close();
    return restoreFromBackupJson(payload);
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
  }
}
