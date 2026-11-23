import { createClient, type Client, type InValue } from '@libsql/client';
import fs from 'fs';
import { createRequire } from 'module';
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
import { mergeProtectedWithOfficialResults } from '../utils/resultProtection';
import { getTodayDateString } from '../utils/dateUtils';
import {
  normalizeShogiPlayerNameForMatch,
  isPlayerRetired,
  isPlayerOnLeave,
  mergePreservingManualFields,
} from '../utils/playerUtils';

let tursoClient: Client | null = null;
let initPromise: Promise<void> | null = null;
let tursoDispatcher: unknown | null | undefined = undefined;

interface BootstrapBundle {
  players: Player[];
  matches: Match[];
  fiscalResults: Record<string, ShogiMonthlyResult[]>;
  nameHistory: PlayerNameHistoryItem[];
  overview: DbOverview;
  fallback?: boolean;
}

let memoryBootstrapCache: BootstrapBundle | null = null;
let cacheWriteInProgress = false;

const requireFromHere = createRequire(import.meta.url);

function getTursoUndiciDispatcher(): unknown | undefined {
  if (tursoDispatcher !== undefined) {
    return tursoDispatcher || undefined;
  }
  try {
    const undici = requireFromHere('undici') as {
      Agent?: new (opts: Record<string, unknown>) => unknown;
    };
    if (undici && typeof undici.Agent === 'function') {
      tursoDispatcher = new undici.Agent({
        connect: {
          timeout: 12_000,
          autoSelectFamily: true,
          autoSelectFamilyAttemptTimeout: 1000,
        },
        connections: 6,
        keepAliveTimeout: 30_000,
        keepAliveMaxTimeout: 60_000,
      });
      return tursoDispatcher;
    }
  } catch {
    // Ignore if undici dispatcher is unavailable in runtime
  }
  tursoDispatcher = null;
  return undefined;
}

function collectErrorSignals(err: unknown): { codes: Set<string>; text: string } {
  const codes = new Set<string>();
  const parts: string[] = [];
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur && typeof cur === 'object'; depth++) {
    const obj = cur as Record<string, unknown>;
    if (typeof obj.code === 'string') codes.add(obj.code);
    if (typeof obj.name === 'string') parts.push(obj.name);
    if (typeof obj.message === 'string') parts.push(obj.message);
    cur = obj.cause;
  }
  if (typeof err === 'string') parts.push(err);
  return { codes, text: parts.join(' | ') };
}

function isConnectStageError(err: unknown): boolean {
  const { codes, text } = collectErrorSignals(err);
  if (
    codes.has('UND_ERR_CONNECT_TIMEOUT') ||
    codes.has('ECONNREFUSED') ||
    codes.has('ENOTFOUND') ||
    codes.has('EAI_AGAIN')
  ) {
    return true;
  }
  const lower = text.toLowerCase();
  return (
    lower.includes('connecttimeouterror') ||
    lower.includes('connect timeout') ||
    lower.includes('und_err_connect_timeout')
  );
}

function isTransientNetworkError(err: unknown): boolean {
  if (isConnectStageError(err)) return true;
  const { codes, text } = collectErrorSignals(err);
  if (
    codes.has('ECONNRESET') ||
    codes.has('ETIMEDOUT') ||
    codes.has('EPIPE') ||
    codes.has('UND_ERR_SOCKET') ||
    codes.has('UND_ERR_HEADERS_TIMEOUT') ||
    codes.has('UND_ERR_BODY_TIMEOUT')
  ) {
    return true;
  }
  const lower = text.toLowerCase();
  return (
    lower.includes('fetch failed') ||
    lower.includes('socket hang up') ||
    lower.includes('network timeout') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again')
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tursoResilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const dispatcher = getTursoUndiciDispatcher();
  const method = (input instanceof Request ? input.method : init?.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = 2;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const reqInput = input instanceof Request ? input.clone() : input;
      const reqInit: RequestInit & { dispatcher?: unknown } = {
        ...(init || {}),
        ...(dispatcher ? { dispatcher } : {}),
      };
      const res = await globalThis.fetch(reqInput, reqInit);
      if (isIdempotent && (res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts) {
        try {
          await res.body?.cancel();
        } catch {}
        await sleepMs(300 * attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const canRetry =
        attempt < maxAttempts && (isConnectStageError(err) || (isIdempotent && isTransientNetworkError(err)));
      if (!canRetry) {
        throw err;
      }
      console.warn(`[Turso fetch] attempt ${attempt}/${maxAttempts} transient error, retrying:`, (err as Error)?.message || err);
      await sleepMs(350 * attempt);
    }
  }

  throw lastErr;
}

async function withTursoReadRetry<T>(fn: () => Promise<T>, label = 'read'): Promise<T> {
  const maxAttempts = 2;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Avoid stacking outer retries when tursoResilientFetch already retried connect timeouts
      if (attempt < maxAttempts && isTransientNetworkError(err) && !isConnectStageError(err)) {
        console.warn(`[Turso ${label}] attempt ${attempt}/${maxAttempts} failed (${(err as Error)?.message || err}), retrying...`);
        await sleepMs(400 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function isRemoteTursoConfigured(): boolean {
  const raw = (process.env.TURSO_DATABASE_URL || '').trim();
  return Boolean(raw && !raw.startsWith('file:'));
}

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function getFiscalYearFromMonth(monthStr: string): number {
  const clean = String(monthStr || '').replace(/[^0-9]/g, '');
  if (clean.length < 6) return 2026;
  const y = parseInt(clean.slice(0, 4), 10);
  const m = parseInt(clean.slice(4, 6), 10);
  if (isNaN(y) || isNaN(m)) return 2026;
  return m >= 1 && m <= 3 ? y - 1 : y;
}

function getJstTimestampString(): string {
  const d = new Date();
  const jstMs = d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60 * 1000;
  const jstDate = new Date(jstMs);
  return jstDate.toISOString().replace('T', ' ').slice(0, 19);
}

function extractRetirementDateFromTexts(texts: unknown[]): string | undefined {
  for (const rawTxt of texts) {
    if (!rawTxt) continue;
    const cleanTxt = String(rawTxt).replace(/就位は原則引退後|引退後に就位|引退後/g, '');
    const m = cleanTxt.match(
      /((?:19|20)\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?(?:付で)?\s*引退/
    );
    if (m) {
      const yyyy = m[1];
      const mm = m[2].padStart(2, '0');
      const dd = m[3].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return undefined;
}

const KNOWN_WOMEN_PLAYER_IDS = new Set([
  'shimai-saori',
  'watanabe-mana',
  'nakakura-hiromi',
  'uekawa-kaori',
  'nakai-hiroe',
]);

function repairLegacyPlayerFields(src: any): Player {
  const idStr = String(src.id || '');
  const manualList = Array.isArray(src.manualFields) ? src.manualFields : undefined;
  const manualSet = new Set<string>(manualList || []);

  const legacyCategory = String(src.category || '').trim().toLowerCase();
  const legacyTitle = String(src.title || '').trim();
  const legacyBio = String(src.bio || '').trim();
  const legacyTitleHighlight = String(src.title_highlight || src.titleHighlight || '').trim();
  const legacyStatus = String(src.status || '').trim().toLowerCase();

  let rawRank = String(src.rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
  let rawDan = String(src.danRank || src.dan_rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');

  const isFemaleHint =
    src.type === 'women' ||
    legacyCategory === 'female' ||
    idStr.startsWith('lady-') ||
    KNOWN_WOMEN_PLAYER_IDS.has(idStr) ||
    /女流/.test(`${rawRank} ${rawDan} ${legacyTitle}`);

  const resolvedType: 'pro' | 'women' = isFemaleHint ? 'women' : 'pro';
  const isPro = resolvedType !== 'women';

  const womenDanRegex = /(女流[1-2]級|女流[初一二三四五六七八]段)/;
  const proDanRegex = /([四五六七八九]段)/;

  if (!isPro) {
    if (!rawDan || !rawDan.includes('女流')) {
      const womenDanMatch = `${legacyTitle} ${rawRank} ${rawDan}`.match(womenDanRegex);
      if (womenDanMatch) {
        rawDan = womenDanMatch[1];
      } else if (/^([初一二三四五六七八]段|[1-2]級)$/.test(rawDan)) {
        rawDan = `女流${rawDan}`;
      }
    }
    if (!rawDan && rawRank) {
      const m = rawRank.match(womenDanRegex);
      if (m) rawDan = m[1];
    }
  } else if (!rawDan) {
    const m = `${rawRank} ${legacyTitle}`.match(proDanRegex);
    if (m) rawDan = m[1];
  }

  let rank = rawRank;
  if (!rank && legacyTitle && !manualSet.has('rank')) {
    rank = legacyTitle.split('（')[0].trim() || legacyTitle;
  }
  if (!rank && rawDan) {
    rank = rawDan;
  }

  const photoUrl =
    String(src.photoUrl || src.photo_url || src.avatar_url || src.avatarUrl || '').trim() ||
    undefined;

  let shortBio = String(src.shortBio || '').trim();
  if (!shortBio && legacyBio && !manualSet.has('shortBio')) {
    shortBio = legacyBio;
  }

  let highlights: string[] = Array.isArray(src.highlights) ? [...src.highlights] : [];
  if (highlights.length === 0 && legacyTitleHighlight && !manualSet.has('highlights')) {
    highlights = Array.from(
      new Set(
        legacyTitleHighlight
          .split('・')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  }

  let retirementDate = src.retirementDate ? String(src.retirementDate).trim() : undefined;
  if (!retirementDate && !manualSet.has('retirementDate')) {
    retirementDate = extractRetirementDateFromTexts([
      shortBio,
      legacyBio,
      legacyTitleHighlight,
      ...highlights,
    ]);
  }
  if (
    legacyStatus === 'retired' &&
    !retirementDate &&
    !shortBio.includes('引退') &&
    !rank.includes('引退') &&
    !highlights.some((h) => h.includes('引退'))
  ) {
    shortBio = shortBio ? `${shortBio}（現役引退）` : '現役引退';
  }

  let leaveInfo = src.leaveInfo as Player['leaveInfo'] | undefined;
  if (legacyStatus === 'on_leave' && !manualSet.has('leaveInfo')) {
    if (!leaveInfo) {
      leaveInfo = { isOnLeave: true };
    } else if (leaveInfo.isOnLeave === undefined) {
      leaveInfo = { ...leaveInfo, isOnLeave: true };
    }
  }

  const playerObj: Player = {
    ...src,
    id: idStr,
    name: String(src.name),
    formerName: src.formerName || src.former_name || undefined,
    type: resolvedType as any,
    affiliation: src.affiliation || '日本将棋連盟',
    rank,
    danRank: rawDan || undefined,
    playerNumber: src.playerNumber ?? src.player_number ?? undefined,
    photoUrl,
    birthDate: String(src.birthDate || src.birth_date || '1970-01-01'),
    birthPlace: String(src.birthPlace || src.birth_place || src.hometown || ''),
    master: String(src.master || ''),
    style: (src.style || src.favorite_strategy || '居飛車') as any,
    ryuoClass: String(src.ryuoClass || src.ryuo_class || ''),
    junisenClass: String(src.junisenClass || src.junisen_class || src.meijin_class || ''),
    heldTitles: Array.isArray(src.heldTitles) ? src.heldTitles : [],
    totalTitles: Number(src.totalTitles ?? 0),
    titleHistory: String(src.titleHistory || ''),
    eiseiTitles: Array.isArray(src.eiseiTitles) ? src.eiseiTitles : undefined,
    careerWins: Number(src.careerWins ?? src.win_count ?? 0),
    careerLosses: Number(src.careerLosses ?? src.loss_count ?? 0),
    careerWinRate: Number(src.careerWinRate ?? 0),
    currentYearWins: Number(src.currentYearWins ?? src.fy2026_wins ?? 0),
    currentYearLosses: Number(src.currentYearLosses ?? src.fy2026_losses ?? 0),
    currentYearWinRate: Number(src.currentYearWinRate ?? 0),
    currentYearStreak: Number(src.currentYearStreak ?? 0),
    rankingInFederation: src.rankingInFederation || {},
    colorAccent: String(src.colorAccent || '#f59e0b'),
    avatarBg: String(src.avatarBg || '#27272a'),
    shortBio,
    highlights,
    yearRecords: Array.isArray(src.yearRecords) ? src.yearRecords : [],
    senteWinRate: Number(src.senteWinRate || 0.5),
    goteWinRate: Number(src.goteWinRate || 0.5),
    openingStats: Array.isArray(src.openingStats) ? src.openingStats : [],
    headToHead: Array.isArray(src.headToHead) ? src.headToHead : [],
    externalLinks: src.externalLinks || { officialProfile: src.source_url || '', kifuDatabase: '' },
    manualFields: manualList,
    retirementDate,
    ...(leaveInfo ? { leaveInfo } : {}),
  };

  if (playerObj.type === 'women' || isPlayerRetired(playerObj)) {
    playerObj.ryuoClass = '';
  }
  if (isPlayerRetired(playerObj)) {
    playerObj.junisenClass = '';
  }

  return playerObj;
}

export function normalizePlayerRecord(raw: any): Player | null {
  if (!raw) return null;
  const parsed = parseJsonSafe<Partial<Player>>(raw.data_json, {});
  const id = raw.id ?? raw.player_id ?? raw.playerId ?? parsed.id;
  const name = raw.name ?? raw.player_name ?? raw.playerName ?? parsed.name;
  if (!id || !name) return null;

  // Prefer non-empty data_json fields over stale/default SQL columns
  const merged: Record<string, any> = { ...raw };
  for (const [k, v] of Object.entries(parsed || {})) {
    if (v !== undefined) {
      merged[k] = v;
    }
  }
  merged.id = id;
  merged.name = name;
  delete merged.data_json;

  return repairLegacyPlayerFields(merged);
}

export function normalizeMatchRecord(raw: any): Match | null {
  if (!raw || !raw.id) return null;
  const parsed = parseJsonSafe<Match>(raw.data_json, {} as Match);
  return {
    ...parsed,
    id: String(raw.id),
    date: String(raw.date || parsed.date || '2026-01-01'),
    time: String(raw.time || parsed.time || '10:00'),
    tournament: String(raw.tournament || parsed.tournament || ''),
    category: (raw.category || parsed.category || '一般棋戦') as any,
    round: String(raw.round || parsed.round || ''),
    player1Id: String(raw.player1_id || raw.player1Id || parsed.player1Id || ''),
    player2Id: String(raw.player2_id || raw.player2Id || parsed.player2Id || ''),
    status: (raw.status || parsed.status || 'upcoming') as any,
    venue: String(raw.venue || parsed.venue || ''),
    timeControl: String(parsed.timeControl || '各5時間'),
    broadcast: Array.isArray(parsed.broadcast) ? parsed.broadcast : [],
    kifuUrl: String(parsed.kifuUrl || ''),
    kifuMoves: Array.isArray(parsed.kifuMoves) ? parsed.kifuMoves : [],
    highlights: String(parsed.highlights || ''),
  };
}

export function normalizeResultRow(raw: any): ShogiMonthlyResult | null {
  if (!raw || !raw.id) return null;
  return {
    id: String(raw.id),
    date: String(raw.date || '2026-01-01'),
    month: String(raw.month || raw.date?.replace(/[^0-9]/g, '').slice(0, 6) || '202601'),
    sente: String(raw.sente || ''),
    gote: String(raw.gote || ''),
    senteRaw: String(raw.senteRaw || raw.sente || ''),
    goteRaw: String(raw.goteRaw || raw.gote || ''),
    sentePlayerId: raw.sentePlayerId || raw.sente_player_id || undefined,
    gotePlayerId: raw.gotePlayerId || raw.gote_player_id || undefined,
    senteMark: String(raw.senteMark || raw.sente_mark || ''),
    goteMark: String(raw.goteMark || raw.gote_mark || ''),
    winner: String(raw.winner || ''),
    loser: String(raw.loser || ''),
    winnerId: raw.winnerId || raw.winner_id || undefined,
    loserId: raw.loserId || raw.loser_id || undefined,
    resultType: (raw.resultType || raw.result_type || 'normal') as any,
    tournament: String(raw.tournament || ''),
    note: String(raw.note || ''),
    venue: raw.venue || undefined,
    isWomen: Boolean(raw.isWomen || raw.is_women),
    category: (raw.category || '一般棋戦') as any,
    links: Array.isArray(raw.links) ? raw.links : [],
    sourceUrl: String(raw.sourceUrl || raw.source_url || ''),
    entrySource: (raw.entrySource || raw.entry_source || 'official') as any,
    isProtected: Boolean(raw.isProtected || raw.is_protected),
  };
}

export function getTursoSafeTargetLabel(): { host: string; dbName: string } {
  const defaultFileUrl = `file:${path.join(process.cwd(), 'data', 'shogi.db')}`;
  const raw = (process.env.TURSO_DATABASE_URL || '').trim() || defaultFileUrl;
  if (raw.startsWith('file:')) {
    return { host: 'local-libsql-file', dbName: path.basename(raw.slice(5)) || 'shogi.db' };
  }
  try {
    const normalized = raw.replace(/^(libsql|wss?):/i, 'https:');
    const parsed = new URL(normalized);
    const host = parsed.hostname || 'turso.io';
    const dbName = host.split('.')[0] || 'turso-db';
    return { host, dbName };
  } catch {
    return { host: 'turso-cloud', dbName: 'turso-db' };
  }
}

function requiresRemoteAuthToken(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith('file:')) return false;
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  return (
    lower.startsWith('libsql://') ||
    lower.startsWith('https://') ||
    lower.startsWith('wss://') ||
    lower.includes('.turso.io')
  );
}

export function getTursoClient(): Client {
  if (tursoClient) return tursoClient;
  const defaultFileUrl = `file:${path.join(process.cwd(), 'data', 'shogi.db')}`;
  const url = (process.env.TURSO_DATABASE_URL || '').trim() || defaultFileUrl;
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim() || undefined;
  if (requiresRemoteAuthToken(url) && !authToken) {
    throw new Error(
      'TURSO_AUTH_TOKEN 環境変数が設定されていません（Turso Cloud への認証接続にはトークンが必要です）'
    );
  }
  const isRemote = !url.startsWith('file:');
  tursoClient = createClient({
    url,
    ...(authToken ? { authToken } : {}),
    ...(isRemote ? { fetch: tursoResilientFetch as typeof globalThis.fetch, concurrency: 4 } : {}),
  });
  return tursoClient;
}

export function closeTurso(): void {
  if (!tursoClient) return;
  try {
    tursoClient.close();
  } catch {}
  tursoClient = null;
  initPromise = null;
}

interface CanonicalTableSpec {
  name: 'players' | 'matches' | 'match_archives' | 'player_name_history' | 'sync_logs';
  pk: string;
  columns: string[];
  createBody: string;
}

const CANONICAL_TABLES: CanonicalTableSpec[] = [
  {
    name: 'players',
    pk: 'id',
    columns: [
      'id',
      'name',
      'former_name',
      'type',
      'affiliation',
      'rank',
      'dan_rank',
      'player_number',
      'photo_url',
      'data_json',
      'updated_at',
    ],
    createBody: `(
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
    )`,
  },
  {
    name: 'matches',
    pk: 'id',
    columns: [
      'id',
      'date',
      'time',
      'tournament',
      'category',
      'round',
      'player1_id',
      'player2_id',
      'status',
      'venue',
      'data_json',
      'updated_at',
    ],
    createBody: `(
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
    )`,
  },
  {
    name: 'match_archives',
    pk: 'month',
    columns: ['month', 'fiscal_year', 'count', 'results_json', 'source', 'updated_at'],
    createBody: `(
      month TEXT PRIMARY KEY,
      fiscal_year INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL,
      source TEXT DEFAULT 'turso-libsql',
      updated_at TEXT NOT NULL
    )`,
  },
  {
    name: 'player_name_history',
    pk: 'id',
    columns: ['id', 'player_id', 'old_name', 'new_name', 'changed_at', 'note'],
    createBody: `(
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      old_name TEXT NOT NULL,
      new_name TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      note TEXT DEFAULT ''
    )`,
  },
  {
    name: 'sync_logs',
    pk: 'id',
    columns: ['id', 'sync_type', 'status', 'message', 'records_count', 'created_at'],
    createBody: `(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      records_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  },
];

const TABLE_STATEMENTS: string[] = CANONICAL_TABLES.map(
  (t) => `CREATE TABLE IF NOT EXISTS ${t.name} ${t.createBody}`
);

const INDEX_STATEMENTS: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)`,
  `CREATE INDEX IF NOT EXISTS idx_players_type ON players(type)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`,
  `CREATE INDEX IF NOT EXISTS idx_match_archives_fy ON match_archives(fiscal_year)`,
  `CREATE INDEX IF NOT EXISTS idx_name_history_player ON player_name_history(player_id)`,
];

function extractNormalizedMonth(candidate: unknown): string {
  if (candidate === null || candidate === undefined) return '';
  const str = String(candidate).trim();
  const sepMatch = str.match(/((?:19|20|21)\d{2})[-/年.](\d{1,2})(?:[-/月.\s]|$)/);
  if (sepMatch) {
    const y = Number(sepMatch[1]);
    const m = Number(sepMatch[2]);
    if (y >= 1900 && y <= 2200 && m >= 1 && m <= 12) {
      return `${sepMatch[1]}${String(m).padStart(2, '0')}`;
    }
  }
  const digits = str.replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    const ym = digits.slice(0, 6);
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(4, 6));
    if (y >= 1900 && y <= 2200 && m >= 1 && m <= 12) {
      return ym;
    }
  }
  return '';
}

async function migrateRowsToTable(
  client: Client,
  tableName: CanonicalTableSpec['name'],
  targetTable: string,
  rows: any[]
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();

  if (tableName === 'players') {
    const stmts: Array<{ sql: string; args: InValue[] }> = [];
    for (const rawRow of rows) {
      const parsed = parseJsonSafe<Partial<Player>>(
        rawRow.data_json ?? rawRow.dataJson ?? rawRow.json ?? rawRow.value,
        {}
      );
      const p = normalizePlayerRecord({
        ...rawRow,
        ...parsed,
        data_json: undefined,
        id: parsed.id ?? rawRow.id ?? rawRow.player_id ?? rawRow.playerId,
        name: parsed.name ?? rawRow.name ?? rawRow.player_name ?? rawRow.playerName,
      });
      if (!p) continue;
      stmts.push({
        sql: `INSERT OR REPLACE INTO ${targetTable}
          (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.name,
          p.formerName || null,
          p.type || 'pro',
          p.affiliation || '日本将棋連盟',
          p.rank || '',
          p.danRank || null,
          p.playerNumber ?? null,
          p.photoUrl || null,
          JSON.stringify(p),
          String(rawRow.updated_at || rawRow.updatedAt || now),
        ],
      });
    }
    await runBatchChunked(client, stmts, 40);
    return;
  }

  if (tableName === 'matches') {
    const stmts: Array<{ sql: string; args: InValue[] }> = [];
    for (const rawRow of rows) {
      const parsed = parseJsonSafe<Partial<Match>>(
        rawRow.data_json ?? rawRow.dataJson ?? rawRow.json ?? rawRow.value,
        {}
      );
      const fallbackId = String(
        rawRow.id ?? rawRow.match_id ?? rawRow.matchId ?? parsed.id ?? ''
      ).trim();
      const fallbackDate = String(
        rawRow.date ?? rawRow.match_date ?? rawRow.matchDate ?? parsed.date ?? ''
      ).trim();
      const m = normalizeMatchRecord({
        ...rawRow,
        ...parsed,
        data_json: undefined,
        id: fallbackId,
        date: fallbackDate || '2026-01-01',
      });
      if (!m) continue;
      const persistedDate = fallbackDate || '';
      if (!fallbackDate) {
        m.date = '';
      }
      stmts.push({
        sql: `INSERT OR REPLACE INTO ${targetTable}
          (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          m.id,
          persistedDate,
          m.time || '',
          m.tournament || '',
          m.category || '一般棋戦',
          m.round || '',
          m.player1Id || '',
          m.player2Id || '',
          m.status || 'upcoming',
          m.venue || '',
          JSON.stringify(m),
          String(rawRow.updated_at || rawRow.updatedAt || now),
        ],
      });
    }
    await runBatchChunked(client, stmts, 50);
    return;
  }

  if (tableName === 'match_archives') {
    let currentBatch: Array<{ sql: string; args: InValue[] }> = [];
    let currentBytes = 0;

    for (const rawRow of rows) {
      const rawJson =
        rawRow.results_json ??
        rawRow.resultsJson ??
        rawRow.data_json ??
        rawRow.dataJson ??
        rawRow.results ??
        rawRow.json ??
        rawRow.value ??
        '[]';
      const parsedPayload = parseJsonSafe<unknown>(rawJson, []);
      let results: ShogiMonthlyResult[] = [];
      let objMonth = '';
      if (Array.isArray(parsedPayload)) {
        results = parsedPayload as ShogiMonthlyResult[];
      } else if (parsedPayload && typeof parsedPayload === 'object') {
        const obj = parsedPayload as Record<string, unknown>;
        objMonth = extractNormalizedMonth(obj.month ?? obj.yearMonth ?? obj.year_month);
        if (Array.isArray(obj.results)) {
          results = obj.results as ShogiMonthlyResult[];
        } else if (Array.isArray(obj.items)) {
          results = obj.items as ShogiMonthlyResult[];
        }
      }

      let month =
        extractNormalizedMonth(rawRow.month) ||
        extractNormalizedMonth(rawRow.year_month) ||
        extractNormalizedMonth(rawRow.yearMonth) ||
        extractNormalizedMonth(rawRow.ym) ||
        extractNormalizedMonth(rawRow.archive_month) ||
        extractNormalizedMonth(rawRow.archiveMonth) ||
        extractNormalizedMonth(rawRow.month_key) ||
        extractNormalizedMonth(rawRow.monthKey) ||
        extractNormalizedMonth(rawRow.period) ||
        extractNormalizedMonth(rawRow.yyyymm) ||
        extractNormalizedMonth(rawRow.id) ||
        extractNormalizedMonth(rawRow.key) ||
        objMonth;

      if (!month && rawRow.year && (rawRow.month_num ?? rawRow.monthNum ?? rawRow.m)) {
        const y = String(rawRow.year).replace(/[^0-9]/g, '');
        const mNum = String(rawRow.month_num ?? rawRow.monthNum ?? rawRow.m)
          .replace(/[^0-9]/g, '')
          .padStart(2, '0');
        month = extractNormalizedMonth(`${y}${mNum}`);
      }

      if (!month && results.length > 0) {
        for (const item of results) {
          month = extractNormalizedMonth(item?.month ?? item?.date);
          if (month) break;
        }
      }

      if (!month) continue;

      const jsonStr = JSON.stringify(results);
      const fiscalYear = Number(
        rawRow.fiscal_year ?? rawRow.fiscalYear ?? getFiscalYearFromMonth(month)
      );
      const count = Number(rawRow.count ?? results.length);
      const source = String(rawRow.source || 'turso-migrated');
      const updatedAt = String(rawRow.updated_at || rawRow.updatedAt || now);

      const stmt = {
        sql: `INSERT OR REPLACE INTO ${targetTable}
          (month, fiscal_year, count, results_json, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          month,
          Number.isFinite(fiscalYear) ? fiscalYear : getFiscalYearFromMonth(month),
          Number.isFinite(count) ? count : results.length,
          jsonStr,
          source,
          updatedAt,
        ] as InValue[],
      };

      if (currentBatch.length > 0 && (currentBytes + jsonStr.length > 450_000 || currentBatch.length >= 4)) {
        await client.batch(currentBatch, 'write');
        currentBatch = [];
        currentBytes = 0;
      }
      currentBatch.push(stmt);
      currentBytes += jsonStr.length;
    }

    if (currentBatch.length > 0) {
      await client.batch(currentBatch, 'write');
    }
    return;
  }

  if (tableName === 'player_name_history') {
    const stmts: Array<{ sql: string; args: InValue[] }> = [];
    for (const rawRow of rows) {
      const parsed = parseJsonSafe<Record<string, unknown>>(
        rawRow.data_json ?? rawRow.json ?? rawRow.value,
        {}
      );
      const id = String(rawRow.id ?? parsed.id ?? '').trim();
      const playerId = String(rawRow.player_id ?? rawRow.playerId ?? parsed.playerId ?? '').trim();
      const oldName = String(rawRow.old_name ?? rawRow.oldName ?? parsed.oldName ?? '').trim();
      const newName = String(rawRow.new_name ?? rawRow.newName ?? parsed.newName ?? '').trim();
      const changedAt = String(rawRow.changed_at ?? rawRow.changedAt ?? parsed.changedAt ?? now);
      const note = String(rawRow.note ?? parsed.note ?? '');
      if (!id || !playerId) continue;
      stmts.push({
        sql: `INSERT OR REPLACE INTO ${targetTable}
          (id, player_id, old_name, new_name, changed_at, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, playerId, oldName, newName, changedAt, note],
      });
    }
    await runBatchChunked(client, stmts, 50);
    return;
  }

  if (tableName === 'sync_logs') {
    const stmts: Array<{ sql: string; args: InValue[] }> = [];
    for (const rawRow of rows) {
      stmts.push({
        sql: `INSERT INTO ${targetTable}
          (sync_type, status, message, records_count, created_at)
          VALUES (?, ?, ?, ?, ?)`,
        args: [
          String(rawRow.sync_type ?? rawRow.syncType ?? 'legacy'),
          String(rawRow.status ?? 'success'),
          String(rawRow.message ?? ''),
          Number(rawRow.records_count ?? rawRow.recordsCount ?? 0),
          String(rawRow.created_at ?? rawRow.createdAt ?? now),
        ],
      });
    }
    await runBatchChunked(client, stmts, 50);
  }
}

async function ensureSchemaMigrations(client: Client): Promise<void> {
  const rebuiltTables = new Set<string>();

  for (const table of CANONICAL_TABLES) {
    const infoRes = await client.execute(`PRAGMA table_info(${table.name})`);
    if (infoRes.rows.length === 0) continue;

    const existingMap = new Map<
      string,
      { name: string; notnull: number; dflt_value: unknown; pk: number }
    >();
    const pkCols: string[] = [];

    for (const r of infoRes.rows) {
      const colName = String(r.name || '').toLowerCase();
      if (!colName) continue;
      const pkVal = Number(r.pk ?? 0);
      existingMap.set(colName, {
        name: colName,
        notnull: Number(r.notnull ?? 0),
        dflt_value: r.dflt_value ?? null,
        pk: pkVal,
      });
      if (pkVal > 0) {
        pkCols.push(colName);
      }
    }

    const canonicalSet = new Set(table.columns.map((c) => c.toLowerCase()));
    const missingColumn = table.columns.some((c) => !existingMap.has(c.toLowerCase()));
    const pkMismatch = pkCols.length !== 1 || pkCols[0] !== table.pk.toLowerCase();
    const blockingLegacyNotNull = Array.from(existingMap.values()).some(
      (col) => !canonicalSet.has(col.name) && col.notnull === 1 && col.dflt_value === null
    );

    if (!missingColumn && !pkMismatch && !blockingLegacyNotNull) {
      continue;
    }

    const existingNames = Array.from(existingMap.keys()).join(', ');
    console.log(
      `[Turso Migration] Rebuilding table "${table.name}" (existing cols: [${existingNames}], missing=${missingColumn}, pkMismatch=${pkMismatch}, blockingLegacyNotNull=${blockingLegacyNotNull})`
    );

    const migratingName = `${table.name}__migrating`;
    await client.execute(`DROP TABLE IF EXISTS ${migratingName}`);
    await client.execute(`CREATE TABLE ${migratingName} ${table.createBody}`);

    const existingRowsRes = await client.execute(`SELECT * FROM ${table.name}`);
    await migrateRowsToTable(client, table.name, migratingName, existingRowsRes.rows as any[]);

    await client.batch(
      [`DROP TABLE ${table.name}`, `ALTER TABLE ${migratingName} RENAME TO ${table.name}`],
      'write'
    );
    rebuiltTables.add(table.name);
    console.log(
      `[Turso Migration] Rebuilt table "${table.name}" successfully (${existingRowsRes.rows.length} rows checked)`
    );
  }

  // Ensure any remaining matches rows with empty date get backfilled from data_json
  if (!rebuiltTables.has('matches')) {
    const emptyDateRes = await client.execute(
      `SELECT COUNT(*) AS cnt FROM matches WHERE date = '' AND data_json != '{}'`
    );
    if (Number(emptyDateRes.rows[0]?.cnt ?? 0) > 0) {
      const rowsRes = await client.execute(`SELECT * FROM matches WHERE date = ''`);
      await migrateRowsToTable(client, 'matches', 'matches', rowsRes.rows as any[]);
    }
  }

  // Repair legacy player fields (avatar_url, category='female', title/danRank, status='retired'/'on_leave') in existing DB rows
  if (!rebuiltTables.has('players')) {
    const pRowsRes = await client.execute(
      `SELECT id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json FROM players`
    );
    const now = new Date().toISOString();
    const repairStmts: Array<{ sql: string; args: InValue[] }> = [];

    for (const rawRow of pRowsRes.rows as any[]) {
      const parsed = parseJsonSafe<Record<string, any>>(rawRow.data_json, {});
      const repaired = normalizePlayerRecord({
        ...rawRow,
        ...parsed,
        data_json: undefined,
        id: parsed.id || rawRow.id,
        name: parsed.name || rawRow.name,
      });
      if (!repaired) continue;

      const needsSqlOrJsonRepair =
        String(rawRow.type || '') !== String(repaired.type || '') ||
        String(rawRow.photo_url || '') !== String(repaired.photoUrl || '') ||
        String(rawRow.rank || '') !== String(repaired.rank || '') ||
        String(rawRow.dan_rank || '') !== String(repaired.danRank || '') ||
        String(parsed.type || '') !== String(repaired.type || '') ||
        String(parsed.photoUrl || '') !== String(repaired.photoUrl || '') ||
        String(parsed.rank || '') !== String(repaired.rank || '') ||
        String(parsed.danRank || '') !== String(repaired.danRank || '') ||
        String(parsed.retirementDate || '') !== String(repaired.retirementDate || '') ||
        String(parsed.shortBio || '') !== String(repaired.shortBio || '') ||
        Boolean(parsed.leaveInfo?.isOnLeave) !== Boolean(repaired.leaveInfo?.isOnLeave);

      if (needsSqlOrJsonRepair) {
        repairStmts.push({
          sql: `UPDATE players
            SET former_name = ?, type = ?, affiliation = ?, rank = ?, dan_rank = ?,
                player_number = ?, photo_url = ?, data_json = ?, updated_at = ?
            WHERE id = ?`,
          args: [
            repaired.formerName || null,
            repaired.type || 'pro',
            repaired.affiliation || '日本将棋連盟',
            repaired.rank || '',
            repaired.danRank || null,
            repaired.playerNumber ?? null,
            repaired.photoUrl || null,
            JSON.stringify(repaired),
            now,
            repaired.id,
          ],
        });
      }
    }

    if (repairStmts.length > 0) {
      console.log(`[Turso Migration] Repairing legacy fields on ${repairStmts.length} player rows`);
      await runBatchChunked(client, repairStmts, 40);
    }
  }
}

function readLocalSeedSnapshot(): {
  sourceLabel: string;
  players: Player[];
  matches: Match[];
  archives: Map<string, { month: string; fiscalYear: number; results: ShogiMonthlyResult[]; source: string }>;
  history: PlayerNameHistoryItem[];
} {
  const archives = new Map<
    string,
    { month: string; fiscalYear: number; results: ShogiMonthlyResult[]; source: string }
  >();
  const bundled = enrichAllResultsWithSupplements(results2026Json as Record<string, ShogiMonthlyResult[]>);
  for (const [month, list] of Object.entries(bundled)) {
    if (!Array.isArray(list)) continue;
    const normMonth = month.replace(/[^0-9]/g, '');
    if (normMonth.length !== 6) continue;
    archives.set(normMonth, {
      month: normMonth,
      fiscalYear: getFiscalYearFromMonth(normMonth),
      results: list,
      source: 'bundled-seed',
    });
  }

  return {
    sourceLabel: 'bundled-static',
    players: PLAYERS_DATA,
    matches: MATCHES_DATA,
    archives,
    history: [],
  };
}

async function runBatchChunked(
  client: Client,
  statements: Array<{ sql: string; args: InValue[] }>,
  chunkSize = 40
): Promise<void> {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await client.batch(chunk, 'write');
    }
  }
}

async function writeFullDatasetToTurso(
  client: Client,
  dataset: {
    players: Player[];
    matches: Match[];
    archives: Map<string, { month: string; fiscalYear: number; results: ShogiMonthlyResult[]; source: string }>;
    history: PlayerNameHistoryItem[];
  },
  options: {
    replaceExisting?: boolean;
    onlyMissingPlayers?: boolean;
    onlyMissingMatches?: boolean;
    onlyMissingArchives?: boolean;
  } = {}
): Promise<{
  playersWritten: number;
  matchesWritten: number;
  archivesMonthsWritten: number;
  archivesResultsWritten: number;
  historyWritten: number;
}> {
  const now = new Date().toISOString();
  let playersWritten = 0;
  let matchesWritten = 0;
  let archivesMonthsWritten = 0;
  let archivesResultsWritten = 0;
  let historyWritten = 0;

  if (options.replaceExisting) {
    const clearStmts: Array<{ sql: string; args: InValue[] }> = [];
    if (dataset.players.length > 0) clearStmts.push({ sql: 'DELETE FROM players', args: [] });
    if (dataset.matches.length > 0) clearStmts.push({ sql: 'DELETE FROM matches', args: [] });
    if (dataset.archives.size > 0) clearStmts.push({ sql: 'DELETE FROM match_archives', args: [] });
    if (dataset.history.length > 0) clearStmts.push({ sql: 'DELETE FROM player_name_history', args: [] });
    if (clearStmts.length > 0) {
      await client.batch(clearStmts, 'write');
    }
  }

  if (dataset.players.length > 0 && !options.onlyMissingPlayers) {
    const playerStmts = dataset.players.map((p) => {
      const cleanP = { ...p };
      if (cleanP.type === 'women' || isPlayerRetired(cleanP)) cleanP.ryuoClass = '';
      if (isPlayerRetired(cleanP)) cleanP.junisenClass = '';
      return {
        sql: `INSERT OR REPLACE INTO players
          (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          cleanP.id,
          cleanP.name,
          cleanP.formerName || null,
          cleanP.type || 'pro',
          cleanP.affiliation || '日本将棋連盟',
          cleanP.rank || '',
          cleanP.danRank || null,
          cleanP.playerNumber ?? null,
          cleanP.photoUrl || null,
          JSON.stringify(cleanP),
          now,
        ] as InValue[],
      };
    });
    await runBatchChunked(client, playerStmts, 40);
    playersWritten = playerStmts.length;
  }

  if (dataset.matches.length > 0 && !options.onlyMissingMatches) {
    const matchStmts = dataset.matches.map((m) => ({
      sql: `INSERT OR REPLACE INTO matches
        (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.id,
        m.date || '',
        m.time || '',
        m.tournament || '',
        m.category || '一般棋戦',
        m.round || '',
        m.player1Id || '',
        m.player2Id || '',
        m.status || 'upcoming',
        m.venue || '',
        JSON.stringify(m),
        now,
      ] as InValue[],
    }));
    await runBatchChunked(client, matchStmts, 50);
    matchesWritten = matchStmts.length;
  }

  if (dataset.archives.size > 0 && !options.onlyMissingArchives) {
    // Batch small groups by byte size (~500KB) to stay well within HTTP payload limits
    let currentBatch: Array<{ sql: string; args: InValue[] }> = [];
    let currentBytes = 0;

    for (const arch of dataset.archives.values()) {
      const jsonStr = JSON.stringify(arch.results);
      const stmt = {
        sql: `INSERT OR REPLACE INTO match_archives
          (month, fiscal_year, count, results_json, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          arch.month,
          arch.fiscalYear,
          arch.results.length,
          jsonStr,
          arch.source || 'turso-migration',
          now,
        ] as InValue[],
      };
      if (currentBatch.length > 0 && (currentBytes + jsonStr.length > 450_000 || currentBatch.length >= 4)) {
        await client.batch(currentBatch, 'write');
        currentBatch = [];
        currentBytes = 0;
      }
      currentBatch.push(stmt);
      currentBytes += jsonStr.length;
      archivesMonthsWritten++;
      archivesResultsWritten += arch.results.length;
    }
    if (currentBatch.length > 0) {
      await client.batch(currentBatch, 'write');
    }
  }

  if (dataset.history.length > 0) {
    const histStmts = dataset.history.map((h) => ({
      sql: `INSERT OR REPLACE INTO player_name_history
        (id, player_id, old_name, new_name, changed_at, note)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [h.id, h.playerId, h.oldName, h.newName, h.changedAt, h.note || ''] as InValue[],
    }));
    await runBatchChunked(client, histStmts, 50);
    historyWritten = histStmts.length;
  }

  return {
    playersWritten,
    matchesWritten,
    archivesMonthsWritten,
    archivesResultsWritten,
    historyWritten,
  };
}

export async function ensureTursoInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = getTursoClient();
    if (!isRemoteTursoConfigured()) {
      await client.execute('PRAGMA journal_mode = DELETE');
    }
    await client.batch(TABLE_STATEMENTS, 'write');
    await ensureSchemaMigrations(client);
    await client.batch(INDEX_STATEMENTS, 'write');

    const today = getTodayDateString();
    await client.execute({
      sql: `DELETE FROM matches WHERE date != '' AND date < ?`,
      args: [today],
    });

    const [pCountRes, mCountRes, aCountRes] = await Promise.all([
      client.execute('SELECT COUNT(*) AS cnt FROM players'),
      client.execute('SELECT COUNT(*) AS cnt FROM matches'),
      client.execute('SELECT COUNT(*) AS cnt FROM match_archives'),
    ]);

    const playersCount = Number(pCountRes.rows[0]?.cnt ?? 0);
    const matchesCount = Number(mCountRes.rows[0]?.cnt ?? 0);
    const archivesCount = Number(aCountRes.rows[0]?.cnt ?? 0);

    if (playersCount === 0 || matchesCount === 0 || archivesCount === 0) {
      const localSeed = readLocalSeedSnapshot();
      const summary = await writeFullDatasetToTurso(client, localSeed, {
        onlyMissingPlayers: playersCount > 0,
        onlyMissingMatches: matchesCount > 0,
        onlyMissingArchives: archivesCount > 0,
      });

      const target = getTursoSafeTargetLabel();
      await client.execute({
        sql: `INSERT INTO sync_logs (sync_type, status, message, records_count, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [
          'turso_initial_seed',
          'success',
          `Turso (${target.dbName}) 初期シード完了 (${localSeed.sourceLabel} から移行: players=${summary.playersWritten}, matches=${summary.matchesWritten}, archives=${summary.archivesMonthsWritten}ヶ月/${summary.archivesResultsWritten}局)`,
          summary.playersWritten + summary.matchesWritten + summary.archivesResultsWritten,
          getJstTimestampString(),
        ],
      });
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}



export async function addSyncLog(
  syncType: string,
  status: 'success' | 'error' | 'partial',
  message: string,
  recordsCount = 0
): Promise<SyncLogEntry> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const createdAt = getJstTimestampString();
  const res = await client.execute({
    sql: `INSERT INTO sync_logs (sync_type, status, message, records_count, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [syncType, status, message, recordsCount, createdAt],
  });
  return {
    id: Number(res.lastInsertRowid || Date.now()),
    syncType,
    status,
    message,
    recordsCount,
    createdAt,
  };
}

async function getSyncLogs(limit = 50): Promise<SyncLogEntry[]> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT id, sync_type, status, message, records_count, created_at FROM sync_logs ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });

  return res.rows.map((r) => ({
    id: Number(r.id),
    syncType: String(r.sync_type || ''),
    status: (r.status === 'error' || r.status === 'partial' ? r.status : 'success') as SyncLogEntry['status'],
    message: String(r.message || ''),
    recordsCount: Number(r.records_count ?? 0),
    createdAt: String(r.created_at || ''),
  }));
}

export async function getNameHistory(): Promise<PlayerNameHistoryItem[]> {
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const res = await client.execute(
        `SELECT id, player_id, old_name, new_name, changed_at, note FROM player_name_history ORDER BY changed_at DESC, id DESC`
      );

      return res.rows.map((r) => ({
        id: String(r.id),
        playerId: String(r.player_id),
        oldName: String(r.old_name),
        newName: String(r.new_name),
        changedAt: String(r.changed_at),
        note: r.note ? String(r.note) : undefined,
      }));
    }, 'getNameHistory');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getNameHistory failed; serving cached fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle().nameHistory;
    }
    throw err;
  }
}

function hydratePlayersFromRows(
  rows: Array<{ id?: unknown; name?: unknown; former_name?: unknown; data_json?: unknown }>,
  history: PlayerNameHistoryItem[]
): Player[] {
  const historyByPlayer = new Map<string, PlayerNameHistoryItem[]>();
  for (const h of history) {
    if (!historyByPlayer.has(h.playerId)) historyByPlayer.set(h.playerId, []);
    historyByPlayer.get(h.playerId)!.push(h);
  }

  return rows.map((row) => {
    const id = String(row.id);
    const name = String(row.name);
    const parsed = parseJsonSafe<Player>(row.data_json, {
      id,
      name,
      type: 'pro',
    } as Player);
    const hist = historyByPlayer.get(id);
    const formerName =
      (row.former_name ? String(row.former_name) : '') || parsed.formerName || hist?.[0]?.oldName || undefined;

    return repairLegacyPlayerFields({
      ...parsed,
      id: parsed.id || id,
      name: parsed.name || name,
      ...(formerName ? { formerName } : {}),
    });
  });
}

export async function getPlayerById(id: string): Promise<Player | null> {
  if (!id) return null;
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const [rowsRes, histRes] = await client.batch(
        [
          {
            sql: `SELECT id, name, former_name, data_json FROM players WHERE id = ? LIMIT 1`,
            args: [id],
          },
          {
            sql: `SELECT id, player_id, old_name, new_name, changed_at, note FROM player_name_history WHERE player_id = ? ORDER BY changed_at DESC, id DESC`,
            args: [id],
          },
        ],
        'read'
      );
      if (rowsRes.rows.length === 0) return null;
      const history: PlayerNameHistoryItem[] = histRes.rows.map((r) => ({
        id: String(r.id),
        playerId: String(r.player_id),
        oldName: String(r.old_name),
        newName: String(r.new_name),
        changedAt: String(r.changed_at),
        note: r.note ? String(r.note) : undefined,
      }));
      return hydratePlayersFromRows(rowsRes.rows as any[], history)[0] || null;
    }, 'getPlayerById');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getPlayerById failed; serving cached fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle().players.find((p) => p.id === id) || null;
    }
    throw err;
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const [rowsRes, histRes] = await client.batch(
        [
          `SELECT id, name, former_name, data_json FROM players ORDER BY COALESCE(player_number, 9999) ASC, name ASC`,
          `SELECT id, player_id, old_name, new_name, changed_at, note FROM player_name_history ORDER BY changed_at DESC, id DESC`,
        ],
        'read'
      );
      const history: PlayerNameHistoryItem[] = histRes.rows.map((r) => ({
        id: String(r.id),
        playerId: String(r.player_id),
        oldName: String(r.old_name),
        newName: String(r.new_name),
        changedAt: String(r.changed_at),
        note: r.note ? String(r.note) : undefined,
      }));
      return hydratePlayersFromRows(rowsRes.rows as any[], history);
    }, 'getAllPlayers');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getAllPlayers failed; serving cached fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle().players;
    }
    throw err;
  }
}

export async function upsertPlayer(player: Player): Promise<Player> {
  await ensureTursoInitialized();
  const client = getTursoClient();
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
  if (Array.isArray(cleanPlayer.manualFields)) {
    const dedupManual = Array.from(
      new Set(cleanPlayer.manualFields.filter((f) => typeof f === 'string' && f.trim()))
    );
    if (dedupManual.length > 0) {
      cleanPlayer.manualFields = dedupManual;
    } else {
      delete cleanPlayer.manualFields;
    }
  }
  if (cleanPlayer.type === 'women' || isPlayerRetired(cleanPlayer)) {
    cleanPlayer.ryuoClass = '';
  }
  if (isPlayerRetired(cleanPlayer)) {
    cleanPlayer.junisenClass = '';
  }

  // Write and verify in a single HTTP round-trip
  const [, verifyRes] = await client.batch(
    [
      {
        sql: `INSERT OR REPLACE INTO players
          (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          cleanPlayer.id,
          cleanPlayer.name,
          cleanPlayer.formerName || null,
          cleanPlayer.type || 'pro',
          cleanPlayer.affiliation || '日本将棋連盟',
          cleanPlayer.rank || '',
          cleanPlayer.danRank || null,
          cleanPlayer.playerNumber ?? null,
          cleanPlayer.photoUrl || null,
          JSON.stringify(cleanPlayer),
          now,
        ],
      },
      {
        sql: `SELECT id, name, rank, dan_rank, data_json FROM players WHERE id = ?`,
        args: [cleanPlayer.id],
      },
    ],
    'write'
  );

  const verifiedRow = verifyRes.rows[0];
  if (!verifiedRow) {
    throw new Error(`[Tursoバリデーションエラー] 棋士データ (${cleanPlayer.name}: ${cleanPlayer.id}) が反映されていません`);
  }
  if (String(verifiedRow.name) !== cleanPlayer.name) {
    throw new Error(`[Tursoバリデーションエラー] 氏名の反映不一致 (${cleanPlayer.name} != ${verifiedRow.name})`);
  }

  return cleanPlayer;
}

export async function upsertPlayersBulk(players: Player[], source = 'sync'): Promise<number> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const now = new Date().toISOString();

  const existingList = await getAllPlayers();
  const existingMap = new Map<string, Player>(existingList.map((p) => [p.id, p]));

  const stmts: Array<{ sql: string; args: InValue[] }> = [];
  for (const p of players) {
    const prev = existingMap.get(p.id);
    const merged: Player = prev ? mergePreservingManualFields(prev, p) : { ...p };

    const manualSet = new Set(Array.isArray(merged.manualFields) ? merged.manualFields : []);
    if (prev) {
      if (!manualSet.has('birthDate') && !merged.birthDate && prev.birthDate) merged.birthDate = prev.birthDate;
      if (!manualSet.has('birthPlace') && !merged.birthPlace && prev.birthPlace) merged.birthPlace = prev.birthPlace;
      if (!manualSet.has('master') && !merged.master && prev.master) merged.master = prev.master;
      if (!manualSet.has('retirementDate') && !merged.retirementDate && prev.retirementDate) {
        merged.retirementDate = prev.retirementDate;
      }
    }

    if (merged.type === 'women' || isPlayerRetired(merged)) {
      merged.ryuoClass = '';
    }
    if (isPlayerRetired(merged)) {
      merged.junisenClass = '';
    }

    stmts.push({
      sql: `INSERT OR REPLACE INTO players
        (id, name, former_name, type, affiliation, rank, dan_rank, player_number, photo_url, data_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        merged.id,
        merged.name,
        merged.formerName || null,
        merged.type || 'pro',
        merged.affiliation || '日本将棋連盟',
        merged.rank || '',
        merged.danRank || null,
        merged.playerNumber ?? null,
        merged.photoUrl || null,
        JSON.stringify(merged),
        now,
      ],
    });
  }

  await runBatchChunked(client, stmts, 40);
  await addSyncLog(`players_${source}`, 'success', `棋士・女流棋士プロフィール ${players.length}件をTursoへ保存`, players.length);
  return players.length;
}

export async function deletePlayerById(id: string): Promise<boolean> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `DELETE FROM players WHERE id = ?`,
    args: [id],
  });
  return (res.rowsAffected || 0) > 0;
}

export async function clearPlayerNameHistory(
  playerId: string,
  options?: { preSavedPlayer?: Player }
): Promise<Player | null> {
  await ensureTursoInitialized();
  const client = getTursoClient();

  if (options?.preSavedPlayer) {
    const delRes = await client.execute({
      sql: `DELETE FROM player_name_history WHERE player_id = ?`,
      args: [playerId],
    });
    if ((delRes.rowsAffected || 0) > 0) {
      await addSyncLog(
        'name_change_clear',
        'success',
        `氏名変更履歴（旧氏名・新氏名・改正年月日）を消去: ${options.preSavedPlayer.name || playerId}`,
        1
      );
    }
    return options.preSavedPlayer;
  }

  const existingRes = await client.execute({
    sql: `SELECT data_json FROM players WHERE id = ?`,
    args: [playerId],
  });
  const delRes = await client.execute({
    sql: `DELETE FROM player_name_history WHERE player_id = ?`,
    args: [playerId],
  });

  let updatedPlayer: Player | null = null;
  const row = existingRes.rows[0];
  if (row) {
    const currentPlayer = parseJsonSafe<Player>(row.data_json, {} as Player);
    const nextPlayer: Player = { ...currentPlayer };
    delete nextPlayer.formerName;
    if (Array.isArray(nextPlayer.manualFields)) {
      nextPlayer.manualFields = nextPlayer.manualFields.filter((f) => f !== 'formerName');
    }
    updatedPlayer = await upsertPlayer(nextPlayer);
  }

  if ((delRes.rowsAffected || 0) > 0 || Boolean(row)) {
    await addSyncLog(
      'name_change_clear',
      'success',
      `氏名変更履歴（旧氏名・新氏名・改正年月日）を消去: ${updatedPlayer?.name || playerId}`,
      1
    );
  }
  return updatedPlayer;
}

export async function syncNameHistoryAndRelinkArchives(): Promise<{
  insertedHistoryCount: number;
  updatedPlayersCount: number;
  relinkedArchiveMatchesCount: number;
  relinkedUpcomingMatchesCount: number;
}> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const now = new Date().toISOString();

  let insertedHistoryCount = 0;
  let updatedPlayersCount = 0;
  let relinkedArchiveMatchesCount = 0;
  let relinkedUpcomingMatchesCount = 0;

  const [playersRes, histRes] = await Promise.all([
    client.execute(`SELECT id, name, former_name, data_json FROM players`),
    client.execute(`SELECT player_id, old_name, new_name FROM player_name_history ORDER BY changed_at DESC, id DESC`),
  ]);

  const playerMap = new Map<string, { id: string; name: string; former_name: string | null; data_json: string }>();
  for (const r of playersRes.rows) {
    playerMap.set(String(r.id), {
      id: String(r.id),
      name: String(r.name),
      former_name: r.former_name ? String(r.former_name) : null,
      data_json: String(r.data_json),
    });
  }

  const updatePlayerStmts: Array<{ sql: string; args: InValue[] }> = [];
  const seenPlayerHist = new Set<string>();

  for (const h of histRes.rows) {
    const pid = String(h.player_id);
    const oldName = String(h.old_name);
    if (seenPlayerHist.has(pid)) continue;
    seenPlayerHist.add(pid);

    const row = playerMap.get(pid);
    if (row) {
      const playerObj = parseJsonSafe<Player>(row.data_json, {} as Player);
      if (row.former_name !== oldName || playerObj.formerName !== oldName) {
        playerObj.formerName = oldName;
        row.former_name = oldName;
        row.data_json = JSON.stringify(playerObj);
        updatePlayerStmts.push({
          sql: `UPDATE players SET former_name = ?, data_json = ?, updated_at = ? WHERE id = ?`,
          args: [oldName, row.data_json, now, pid],
        });
        updatedPlayersCount++;
      }
    }
  }
  if (updatePlayerStmts.length > 0) {
    await runBatchChunked(client, updatePlayerStmts, 40);
  }

  // Build Name-to-ID map
  const nameToId = new Map<string, string>();
  const registerName = (nameStr: string | null | undefined, playerId: string) => {
    if (!nameStr) return;
    const clean = nameStr.replace(/[\s\u3000※＊\*]/g, '').trim();
    if (clean) nameToId.set(clean, playerId);
    const norm = normalizeShogiPlayerNameForMatch(nameStr);
    if (norm) nameToId.set(norm, playerId);
  };

  for (const p of playerMap.values()) {
    nameToId.set(p.id, p.id);
    registerName(p.name, p.id);
    registerName(p.former_name, p.id);
  }
  for (const h of histRes.rows) {
    registerName(String(h.old_name), String(h.player_id));
    registerName(String(h.new_name), String(h.player_id));
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

  // Re-link match_archives per month
  const monthRows = await client.execute(`SELECT month FROM match_archives ORDER BY month ASC`);
  for (const mr of monthRows.rows) {
    const month = String(mr.month);
    const archRes = await client.execute({
      sql: `SELECT results_json FROM match_archives WHERE month = ?`,
      args: [month],
    });
    const rawJson = archRes.rows[0]?.results_json;
    if (!rawJson) continue;
    const results = parseJsonSafe<ShogiMonthlyResult[]>(rawJson, []);
    let monthModified = false;

    for (const m of results) {
      let changed = false;
      const rs = resolvePlayerId(m.sente);
      if (rs && m.sentePlayerId !== rs) {
        m.sentePlayerId = rs;
        changed = true;
      }
      const rg = resolvePlayerId(m.gote);
      if (rg && m.gotePlayerId !== rg) {
        m.gotePlayerId = rg;
        changed = true;
      }
      if (m.winner) {
        const rw = resolvePlayerId(m.winner);
        if (rw && m.winnerId !== rw) {
          m.winnerId = rw;
          changed = true;
        }
      }
      if (!m.winnerId) {
        if (m.senteMark && (m.senteMark.includes('○') || m.senteMark.includes('□')) && m.sentePlayerId) {
          m.winnerId = m.sentePlayerId;
          if (m.gotePlayerId) m.loserId = m.gotePlayerId;
          changed = true;
        } else if (m.goteMark && (m.goteMark.includes('○') || m.goteMark.includes('□')) && m.gotePlayerId) {
          m.winnerId = m.gotePlayerId;
          if (m.sentePlayerId) m.loserId = m.sentePlayerId;
          changed = true;
        }
      }
      if (changed) {
        relinkedArchiveMatchesCount++;
        monthModified = true;
      }
    }

    if (monthModified) {
      await client.execute({
        sql: `UPDATE match_archives SET results_json = ?, updated_at = ? WHERE month = ?`,
        args: [JSON.stringify(results), now, month],
      });
    }
  }

  // Re-link matches table
  const matchRows = await client.execute(`SELECT id, player1_id, player2_id, data_json FROM matches`);
  const updateMatchStmts: Array<{ sql: string; args: InValue[] }> = [];
  for (const row of matchRows.rows) {
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
      updateMatchStmts.push({
        sql: `UPDATE matches SET player1_id = ?, player2_id = ?, data_json = ?, updated_at = ? WHERE id = ?`,
        args: [
          matchObj.player1Id || String(row.player1_id || ''),
          matchObj.player2Id || String(row.player2_id || ''),
          JSON.stringify(matchObj),
          now,
          String(row.id),
        ],
      });
    }
  }
  if (updateMatchStmts.length > 0) {
    await runBatchChunked(client, updateMatchStmts, 40);
  }

  if (insertedHistoryCount > 0 || updatedPlayersCount > 0 || relinkedArchiveMatchesCount > 0) {
    await addSyncLog(
      'relink_name_history',
      'success',
      `改名履歴・旧名の反映と過去対局ID再紐付け完了 (改名履歴追加: ${insertedHistoryCount}件, 棋士更新: ${updatedPlayersCount}名, 対局結果再紐付け: ${relinkedArchiveMatchesCount}局, 公式対局予定: ${relinkedUpcomingMatchesCount}件)`,
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

export async function recordPlayerNameChange(params: {
  playerId: string;
  oldName: string;
  newName: string;
  changedAt?: string;
  note?: string;
  preSavedPlayer?: Player;
}): Promise<{ player: Player; history: PlayerNameHistoryItem } | null> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const oldTrim = String(params.oldName || '').trim();
  const newTrim = String(params.newName || '').trim();
  if (!params.playerId || !oldTrim || !newTrim) return null;

  let updatedPlayer: Player;
  if (params.preSavedPlayer) {
    updatedPlayer = params.preSavedPlayer;
  } else {
    const existingRes = await client.execute({
      sql: `SELECT data_json FROM players WHERE id = ?`,
      args: [params.playerId],
    });
    const row = existingRes.rows[0];
    if (!row) return null;

    const currentPlayer = parseJsonSafe<Player>(row.data_json, {} as Player);
    const manualFields = Array.from(
      new Set([
        ...(Array.isArray(currentPlayer.manualFields) ? currentPlayer.manualFields : []),
        'name',
        'formerName',
      ])
    );

    updatedPlayer = await upsertPlayer({
      ...currentPlayer,
      name: newTrim,
      formerName: oldTrim,
      manualFields,
    });
  }

  const changedAt = params.changedAt?.trim() || new Date().toISOString().slice(0, 10);
  const historyItem: PlayerNameHistoryItem = {
    id: `nh-${params.playerId}-${Date.now()}`,
    playerId: params.playerId,
    oldName: oldTrim,
    newName: newTrim,
    changedAt,
    note: params.note?.trim() || '氏名変更・改名反映',
  };

  await client.batch(
    [
      {
        sql: `DELETE FROM player_name_history WHERE player_id = ? AND old_name = ?`,
        args: [params.playerId, oldTrim],
      },
      {
        sql: `INSERT OR REPLACE INTO player_name_history (id, player_id, old_name, new_name, changed_at, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          historyItem.id,
          historyItem.playerId,
          historyItem.oldName,
          historyItem.newName,
          historyItem.changedAt,
          historyItem.note || '',
        ],
      },
    ],
    'write'
  );

  await addSyncLog(
    'name_change',
    'success',
    `氏名変更登録・Turso永続化: ${historyItem.oldName} → ${historyItem.newName}（${historyItem.changedAt}）`,
    1
  );
  await syncNameHistoryAndRelinkArchives();
  return { player: updatedPlayer, history: historyItem };
}

export async function getAllMatches(): Promise<Match[]> {
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const res = await client.execute(`SELECT data_json FROM matches ORDER BY date DESC, time ASC`);
      return res.rows.map((r) => parseJsonSafe<Match>(r.data_json, {} as Match)).filter((m) => Boolean(m && m.id));
    }, 'getAllMatches');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getAllMatches failed; serving cached fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle().matches;
    }
    throw err;
  }
}

export async function upsertMatch(match: Match): Promise<Match> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT OR REPLACE INTO matches
      (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      match.id,
      match.date || '',
      match.time || '',
      match.tournament || '',
      match.category || '一般棋戦',
      match.round || '',
      match.player1Id || '',
      match.player2Id || '',
      match.status || 'upcoming',
      match.venue || '',
      JSON.stringify(match),
      now,
    ],
  });
  return match;
}

export async function upsertMatchesBulk(matches: Match[], source = 'sync'): Promise<number> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const now = new Date().toISOString();
  const todayStr = getTodayDateString();

  const pastRes = await client.execute({
    sql: `SELECT id, data_json FROM matches WHERE id LIKE 'shogiorjp-%' AND date < ? AND status != 'finished'`,
    args: [todayStr],
  });

  const stmts: Array<{ sql: string; args: InValue[] }> = [];
  for (const row of pastRes.rows) {
    const parsed = parseJsonSafe<Match>(row.data_json, {} as Match);
    if (parsed && parsed.id) {
      const finishedMatch: Match = { ...parsed, status: 'finished' };
      stmts.push({
        sql: `INSERT OR REPLACE INTO matches
          (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          finishedMatch.id,
          finishedMatch.date || '',
          finishedMatch.time || '',
          finishedMatch.tournament || '',
          finishedMatch.category || '一般棋戦',
          finishedMatch.round || '',
          finishedMatch.player1Id || '',
          finishedMatch.player2Id || '',
          'finished',
          finishedMatch.venue || '',
          JSON.stringify(finishedMatch),
          now,
        ],
      });
    }
  }

  for (const m of matches) {
    if (!m || !m.id) continue;
    stmts.push({
      sql: `INSERT OR REPLACE INTO matches
        (id, date, time, tournament, category, round, player1_id, player2_id, status, venue, data_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.id,
        m.date || '',
        m.time || '',
        m.tournament || '',
        m.category || '一般棋戦',
        m.round || '',
        m.player1Id || '',
        m.player2Id || '',
        m.status || 'upcoming',
        m.venue || '',
        JSON.stringify(m),
        now,
      ],
    });
  }

  await runBatchChunked(client, stmts, 50);
  await addSyncLog(`matches_${source}`, 'success', `公式対局予定 ${matches.length}件をTursoへ保存`, matches.length);
  return matches.length;
}

export async function deleteMatchById(id: string): Promise<boolean> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `DELETE FROM matches WHERE id = ?`,
    args: [id],
  });
  return (res.rowsAffected || 0) > 0;
}

export async function getAllMatchArchives(
  fiscalYear?: number,
  month?: string
): Promise<Record<string, ShogiMonthlyResult[]>> {
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();

      let res;
      if (month) {
        res = await client.execute({
          sql: `SELECT month, results_json FROM match_archives WHERE month = ?`,
          args: [month.replace(/[^0-9]/g, '')],
        });
      } else if (fiscalYear && !isNaN(fiscalYear)) {
        res = await client.execute({
          sql: `SELECT month, results_json FROM match_archives WHERE fiscal_year = ? ORDER BY month ASC`,
          args: [fiscalYear],
        });
      } else {
        res = await client.execute(`SELECT month, results_json FROM match_archives ORDER BY month ASC`);
      }

      const out: Record<string, ShogiMonthlyResult[]> = {};
      for (const r of res.rows) {
        out[String(r.month)] = parseJsonSafe<ShogiMonthlyResult[]>(r.results_json, []);
      }
      return out;
    }, 'getAllMatchArchives');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getAllMatchArchives failed; serving cached fallback:', (err as Error)?.message);
      const fallbackArchives = loadFallbackBootstrapBundle().fiscalResults;
      if (month) {
        const cleanM = month.replace(/[^0-9]/g, '');
        return fallbackArchives[cleanM] ? { [cleanM]: fallbackArchives[cleanM] } : {};
      }
      if (fiscalYear && !isNaN(fiscalYear)) {
        const filtered: Record<string, ShogiMonthlyResult[]> = {};
        for (const [m, list] of Object.entries(fallbackArchives)) {
          if (getFiscalYearFromMonth(m) === fiscalYear) filtered[m] = list;
        }
        return filtered;
      }
      return fallbackArchives;
    }
    throw err;
  }
}

const DIRECT_ADMIN_ARCHIVE_SOURCES = new Set([
  'admin-manual',
  'admin-delete',
  'admin-bulk',
  'backup-restore',
]);

export async function upsertMonthArchive(
  month: string,
  results: ShogiMonthlyResult[],
  source = 'manual'
): Promise<ShogiMonthlyResult[]> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const normalizedMonth = month.replace(/[^0-9]/g, '');

  let mergedInput = results;
  if (!DIRECT_ADMIN_ARCHIVE_SOURCES.has(source)) {
    const existingRes = await client.execute({
      sql: `SELECT results_json FROM match_archives WHERE month = ?`,
      args: [normalizedMonth],
    });
    const existingList = existingRes.rows[0]?.results_json
      ? parseJsonSafe<ShogiMonthlyResult[]>(existingRes.rows[0].results_json, [])
      : [];
    mergedInput = mergeProtectedWithOfficialResults(existingList, results);
  }

  const enriched = enrichMonthlyResultsWithSupplements(normalizedMonth, mergedInput);
  const fiscalYear = getFiscalYearFromMonth(normalizedMonth);
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT OR REPLACE INTO match_archives (month, fiscal_year, count, results_json, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [normalizedMonth, fiscalYear, enriched.length, JSON.stringify(enriched), source, now],
  });

  return enriched;
}

export async function upsertMatchArchivesBulk(
  archives: Record<string, ShogiMonthlyResult[]>,
  source = 'sync'
): Promise<number> {
  await ensureTursoInitialized();
  const client = getTursoClient();
  const now = new Date().toISOString();
  const preserveProtected = !DIRECT_ADMIN_ARCHIVE_SOURCES.has(source);

  const existingByMonth = new Map<string, ShogiMonthlyResult[]>();
  if (preserveProtected) {
    const existingAll = await getAllMatchArchives();
    for (const [k, v] of Object.entries(existingAll)) {
      existingByMonth.set(k, v);
    }
  }

  let totalMatches = 0;
  let currentBatch: Array<{ sql: string; args: InValue[] }> = [];
  let currentBytes = 0;

  for (const [m, list] of Object.entries(archives)) {
    if (!Array.isArray(list)) continue;
    const normalizedMonth = m.replace(/[^0-9]/g, '');
    if (normalizedMonth.length !== 6) continue;

    const mergedInput = preserveProtected
      ? mergeProtectedWithOfficialResults(existingByMonth.get(normalizedMonth) || [], list)
      : list;

    const enriched = enrichMonthlyResultsWithSupplements(normalizedMonth, mergedInput);
    totalMatches += enriched.length;
    const jsonStr = JSON.stringify(enriched);

    const stmt = {
      sql: `INSERT OR REPLACE INTO match_archives (month, fiscal_year, count, results_json, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        normalizedMonth,
        getFiscalYearFromMonth(normalizedMonth),
        enriched.length,
        jsonStr,
        source,
        now,
      ] as InValue[],
    };

    if (currentBatch.length > 0 && (currentBytes + jsonStr.length > 450_000 || currentBatch.length >= 4)) {
      await client.batch(currentBatch, 'write');
      currentBatch = [];
      currentBytes = 0;
    }
    currentBatch.push(stmt);
    currentBytes += jsonStr.length;
  }

  if (currentBatch.length > 0) {
    await client.batch(currentBatch, 'write');
  }

  await addSyncLog(
    `archives_${source}`,
    'success',
    `対局アーカイブ ${Object.keys(archives).length}ヶ月分 (${totalMatches}局) をTursoへ保存`,
    totalMatches
  );
  return totalMatches;
}

export async function addMatchResultToArchive(result: ShogiMonthlyResult): Promise<ShogiMonthlyResult[]> {
  const month = (result.month || result.date.replace(/[^0-9]/g, '').slice(0, 6)).replace(/[^0-9]/g, '');
  const current = (await getAllMatchArchives(undefined, month))[month] || [];
  const filtered = current.filter((r) => r.id !== result.id);
  const next = [{ ...result, month }, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
  const saved = await upsertMonthArchive(month, next, 'admin-manual');
  await addSyncLog('result_upsert', 'success', `${month} に対局結果「${result.sente} vs ${result.gote}」を登録`, 1);
  return saved;
}

export async function deleteMatchResultFromArchive(month: string, resultId: string): Promise<boolean> {
  const normalizedMonth = month.replace(/[^0-9]/g, '');
  const current = (await getAllMatchArchives(undefined, normalizedMonth))[normalizedMonth] || [];
  const next = current.filter((r) => r.id !== resultId);
  if (next.length === current.length) return false;
  await upsertMonthArchive(normalizedMonth, next, 'admin-delete');
  await addSyncLog('result_delete', 'success', `${normalizedMonth} から対局結果 (${resultId}) を削除`, 1);
  return true;
}

function getBootstrapCachePath(): string {
  return path.join(process.cwd(), 'data', 'turso-cache.json');
}

function saveBootstrapCache(bundle: BootstrapBundle): void {
  const cleanBundle: BootstrapBundle = {
    players: bundle.players,
    matches: bundle.matches,
    fiscalResults: bundle.fiscalResults,
    nameHistory: bundle.nameHistory,
    overview: bundle.overview,
  };
  memoryBootstrapCache = cleanBundle;
  if (cacheWriteInProgress) return;
  cacheWriteInProgress = true;
  const cachePath = getBootstrapCachePath();
  const tmpPath = `${cachePath}.tmp`;
  fs.promises
    .mkdir(path.dirname(cachePath), { recursive: true })
    .then(() => fs.promises.writeFile(tmpPath, JSON.stringify(cleanBundle), 'utf-8'))
    .then(() => fs.promises.rename(tmpPath, cachePath))
    .catch(() => {})
    .finally(() => {
      cacheWriteInProgress = false;
    });
}

function buildFiscalYearsSummary(archiveSummaries: MatchArchiveSummary[]) {
  const fyMap = new Map<number, { monthsCount: number; matchesCount: number }>();
  for (const fy of [2026, 2025, 2024, 2023, 2022, 2021]) {
    fyMap.set(fy, { monthsCount: 0, matchesCount: 0 });
  }
  for (const arch of archiveSummaries) {
    const fyEntry = fyMap.get(arch.fiscalYear) || { monthsCount: 0, matchesCount: 0 };
    fyEntry.monthsCount += 1;
    fyEntry.matchesCount += arch.count;
    fyMap.set(arch.fiscalYear, fyEntry);
  }
  return Array.from(fyMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([fiscalYear, stats]) => ({
      fiscalYear,
      monthsCount: stats.monthsCount,
      matchesCount: stats.matchesCount,
    }));
}

function loadFallbackBootstrapBundle(): BootstrapBundle {
  if (memoryBootstrapCache) {
    return { ...memoryBootstrapCache, fallback: true };
  }

  const cachePath = getBootstrapCachePath();
  if (fs.existsSync(cachePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as BootstrapBundle;
      if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
        memoryBootstrapCache = parsed;
        return { ...parsed, fallback: true };
      }
    } catch {}
  }

  const seed = readLocalSeedSnapshot();
  const target = getTursoSafeTargetLabel();
  const fiscalResults: Record<string, ShogiMonthlyResult[]> = {};
  const archiveSummaries: MatchArchiveSummary[] = [];
  let totalResults = 0;

  for (const arch of Array.from(seed.archives.values()).sort((a, b) => b.month.localeCompare(a.month))) {
    fiscalResults[arch.month] = arch.results;
    totalResults += arch.results.length;
    archiveSummaries.push({
      month: arch.month,
      fiscalYear: arch.fiscalYear,
      count: arch.results.length,
      source: 'local-fallback',
      updatedAt: '',
    });
  }

  return {
    players: seed.players,
    matches: seed.matches,
    fiscalResults,
    nameHistory: seed.history,
    overview: {
      engine: 'Turso (libSQL Cloud - Fallback)',
      dbPath: target.host,
      projectId: 'turso-cloud',
      databaseId: target.dbName,
      fileSizeBytes: 0,
      counts: {
        players: seed.players.length,
        matches: seed.matches.length,
        match_archives: archiveSummaries.length,
        match_results_total: totalResults,
        player_name_history: seed.history.length,
        on_leave_players: seed.players.filter((p) => isPlayerOnLeave(p)).length,
        sync_logs: 0,
      },
      fiscalYears: buildFiscalYearsSummary(archiveSummaries),
      archiveSummaries,
      recentLogs: [],
    },
    fallback: true,
  };
}

export async function getBootstrapBundle(): Promise<BootstrapBundle> {
  try {
    const bundle = await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const target = getTursoSafeTargetLabel();

      const [playersRes, matchesRes, histRes, logsRes, logsCntRes] = await client.batch(
        [
          `SELECT id, name, former_name, data_json FROM players ORDER BY COALESCE(player_number, 9999) ASC, name ASC`,
          `SELECT data_json FROM matches ORDER BY date DESC, time ASC`,
          `SELECT id, player_id, old_name, new_name, changed_at, note FROM player_name_history ORDER BY changed_at DESC, id DESC`,
          `SELECT id, sync_type, status, message, records_count, created_at FROM sync_logs ORDER BY id DESC LIMIT 30`,
          `SELECT COUNT(*) AS cnt FROM sync_logs`,
        ],
        'read'
      );

      const archivesRes = await client.execute(
        `SELECT month, fiscal_year, count, source, updated_at, results_json FROM match_archives ORDER BY month ASC`
      );

      const nameHistory: PlayerNameHistoryItem[] = histRes.rows.map((r) => ({
        id: String(r.id),
        playerId: String(r.player_id),
        oldName: String(r.old_name),
        newName: String(r.new_name),
        changedAt: String(r.changed_at),
        note: r.note ? String(r.note) : undefined,
      }));

      const players = hydratePlayersFromRows(playersRes.rows as any[], nameHistory);
      const matches = matchesRes.rows
        .map((r) => parseJsonSafe<Match>(r.data_json, {} as Match))
        .filter((m) => Boolean(m && m.id));

      const recentLogs: SyncLogEntry[] = logsRes.rows.map((r) => ({
        id: Number(r.id),
        syncType: String(r.sync_type || ''),
        status: (r.status === 'error' || r.status === 'partial' ? r.status : 'success') as SyncLogEntry['status'],
        message: String(r.message || ''),
        recordsCount: Number(r.records_count ?? 0),
        createdAt: String(r.created_at || ''),
      }));

      const fiscalResults: Record<string, ShogiMonthlyResult[]> = {};
      const archiveSummariesDesc: MatchArchiveSummary[] = [];
      let totalResults = 0;
      let totalBytes = 0;

      for (const r of playersRes.rows) {
        if (typeof r.data_json === 'string') totalBytes += r.data_json.length;
      }
      for (const r of matchesRes.rows) {
        if (typeof r.data_json === 'string') totalBytes += r.data_json.length;
      }

      for (const r of archivesRes.rows) {
        const month = String(r.month);
        const list = parseJsonSafe<ShogiMonthlyResult[]>(r.results_json, []);
        fiscalResults[month] = list;
        if (typeof r.results_json === 'string') totalBytes += r.results_json.length;
        const count = Number(r.count ?? list.length);
        const fy = Number(r.fiscal_year ?? getFiscalYearFromMonth(month));
        totalResults += count;
        archiveSummariesDesc.push({
          month,
          fiscalYear: fy,
          count,
          source: r.source ? String(r.source) : 'turso-libsql',
          updatedAt: String(r.updated_at || ''),
        });
      }
      archiveSummariesDesc.sort((a, b) => b.month.localeCompare(a.month));

      const overview: DbOverview = {
        engine: 'Turso (libSQL Cloud)',
        dbPath: target.host,
        projectId: 'turso-cloud',
        databaseId: target.dbName,
        fileSizeBytes: totalBytes,
        counts: {
          players: players.length,
          matches: matches.length,
          match_archives: archiveSummariesDesc.length,
          match_results_total: totalResults,
          player_name_history: nameHistory.length,
          on_leave_players: players.filter((p) => isPlayerOnLeave(p)).length,
          sync_logs: Number(logsCntRes.rows[0]?.cnt ?? recentLogs.length),
        },
        fiscalYears: buildFiscalYearsSummary(archiveSummariesDesc),
        archiveSummaries: archiveSummariesDesc,
        recentLogs,
      };

      return {
        players,
        matches,
        fiscalResults,
        nameHistory,
        overview,
      };
    }, 'getBootstrapBundle');

    saveBootstrapCache(bundle);
    return bundle;
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] /api/db/bootstrap failed after retries; serving cached/local fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle();
    }
    throw err;
  }
}

export async function getDatabaseOverview(): Promise<DbOverview> {
  try {
    return await withTursoReadRetry(async () => {
      await ensureTursoInitialized();
      const client = getTursoClient();
      const target = getTursoSafeTargetLabel();

      const [pRes, mRes, aRes, hRes, lRes, sizeRes, recentLogsRes, allPlayersRes] = await client.batch(
        [
          'SELECT COUNT(*) AS cnt FROM players',
          'SELECT COUNT(*) AS cnt FROM matches',
          'SELECT month, fiscal_year, count, source, updated_at FROM match_archives ORDER BY month DESC',
          'SELECT COUNT(*) AS cnt FROM player_name_history',
          'SELECT COUNT(*) AS cnt FROM sync_logs',
          `SELECT
            (SELECT COALESCE(SUM(LENGTH(data_json)), 0) FROM players) +
            (SELECT COALESCE(SUM(LENGTH(data_json)), 0) FROM matches) +
            (SELECT COALESCE(SUM(LENGTH(results_json)), 0) FROM match_archives) AS total_bytes`,
          'SELECT id, sync_type, status, message, records_count, created_at FROM sync_logs ORDER BY id DESC LIMIT 30',
          'SELECT id, name, former_name, data_json FROM players',
        ],
        'read'
      );

      const recentLogs: SyncLogEntry[] = recentLogsRes.rows.map((r) => ({
        id: Number(r.id),
        syncType: String(r.sync_type || ''),
        status: (r.status === 'error' || r.status === 'partial' ? r.status : 'success') as SyncLogEntry['status'],
        message: String(r.message || ''),
        recordsCount: Number(r.records_count ?? 0),
        createdAt: String(r.created_at || ''),
      }));

      const overviewPlayers = hydratePlayersFromRows(allPlayersRes.rows as any[], []);
      const onLeaveCount = overviewPlayers.filter((p) => isPlayerOnLeave(p)).length;

      let totalResults = 0;
      const archiveSummaries: MatchArchiveSummary[] = aRes.rows.map((r) => {
        const count = Number(r.count ?? 0);
        const fy = Number(r.fiscal_year ?? 2026);
        totalResults += count;
        return {
          month: String(r.month),
          fiscalYear: fy,
          count,
          source: r.source ? String(r.source) : 'turso-libsql',
          updatedAt: String(r.updated_at || ''),
        };
      });

      return {
        engine: 'Turso (libSQL Cloud)',
        dbPath: target.host,
        projectId: 'turso-cloud',
        databaseId: target.dbName,
        fileSizeBytes: Number(sizeRes.rows[0]?.total_bytes ?? 0),
        counts: {
          players: Number(pRes.rows[0]?.cnt ?? 0),
          matches: Number(mRes.rows[0]?.cnt ?? 0),
          match_archives: aRes.rows.length,
          match_results_total: totalResults,
          player_name_history: Number(hRes.rows[0]?.cnt ?? 0),
          on_leave_players: onLeaveCount,
          sync_logs: Number(lRes.rows[0]?.cnt ?? 0),
        },
        fiscalYears: buildFiscalYearsSummary(archiveSummaries),
        archiveSummaries,
        recentLogs,
      };
    }, 'getDatabaseOverview');
  } catch (err) {
    if (isTransientNetworkError(err)) {
      console.warn('[Turso Fallback] getDatabaseOverview failed; serving cached fallback:', (err as Error)?.message);
      return loadFallbackBootstrapBundle().overview;
    }
    throw err;
  }
}

export async function exportBackupJson() {
  const [players, matches, matchArchivesMap, player_name_history, sync_logs] = await Promise.all([
    getAllPlayers(),
    getAllMatches(),
    getAllMatchArchives(),
    getNameHistory(),
    getSyncLogs(100),
  ]);

  const match_archives = Object.entries(matchArchivesMap).map(([month, results]) => ({
    month,
    fiscal_year: getFiscalYearFromMonth(month),
    count: results.length,
    results,
  }));

  const target = getTursoSafeTargetLabel();
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectId: 'turso-cloud',
    databaseId: target.dbName,
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

export async function restoreFromBackupJson(payload: any): Promise<{
  playersImported: number;
  matchesImported: number;
  archivesMonthsImported: number;
  archivesResultsImported: number;
  nameHistoryImported: number;
}> {
  await ensureTursoInitialized();
  const client = getTursoClient();
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

  const archivesByMonth = new Map<
    string,
    { month: string; fiscalYear: number; results: ShogiMonthlyResult[]; source: string }
  >();
  const addResultToMap = (monthKey: string, res: ShogiMonthlyResult) => {
    const cleanM = monthKey.replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanM.length !== 6) return;
    if (!archivesByMonth.has(cleanM)) {
      archivesByMonth.set(cleanM, {
        month: cleanM,
        fiscalYear: getFiscalYearFromMonth(cleanM),
        results: [],
        source: 'backup-restore',
      });
    }
    archivesByMonth.get(cleanM)!.results.push(res);
  };

  if (Array.isArray(rawArchives)) {
    for (const item of rawArchives) {
      if (!item || typeof item !== 'object') continue;
      const embeddedResults = parseJsonSafe<any[]>(
        item.results ?? item.results_json ?? item.data_json ?? item.matches,
        []
      );
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

  // Deduplicate and sort each month's results
  for (const entry of archivesByMonth.values()) {
    const dedup = new Map<string, ShogiMonthlyResult>();
    for (const r of entry.results) dedup.set(r.id, r);
    entry.results = Array.from(dedup.values()).sort((a, b) => b.date.localeCompare(a.date));
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

  const written = await writeFullDatasetToTurso(
    client,
    {
      players: normalizedPlayers,
      matches: normalizedMatches,
      archives: archivesByMonth,
      history: normalizedHistory,
    },
    { replaceExisting: true }
  );

  await addSyncLog(
    'backup_restore',
    'success',
    `Tursoバックアップ復元完了 (players: ${written.playersWritten}, matches: ${written.matchesWritten}, archives: ${written.archivesMonthsWritten}ヶ月/${written.archivesResultsWritten}局, name_history: ${written.historyWritten})`,
    written.playersWritten + written.matchesWritten + written.archivesResultsWritten
  );

  return {
    playersImported: written.playersWritten,
    matchesImported: written.matchesWritten,
    archivesMonthsImported: written.archivesMonthsWritten,
    archivesResultsImported: written.archivesResultsWritten,
    nameHistoryImported: written.historyWritten,
  };
}
