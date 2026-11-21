import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import http from 'http';
import { scrapeAllActivePlayers, fetchPlayerProfileDetail } from './src/services/playerSyncService';
import {
  scrapeMatchPlan,
  scrapeMonthlyResults,
  getAll2026Results,
  scrapeIncrementalResults,
  rebuildAllFiscalYearArchives,
} from './src/services/matchSyncService';
import {
  getDb,
  closeDb,
  getAllPlayers,
  upsertPlayer,
  upsertPlayersBulk,
  deletePlayerById,
  getAllMatches,
  upsertMatch,
  upsertMatchesBulk,
  deleteMatchById,
  getAllMatchArchives,
  upsertMonthArchive,
  upsertMatchArchivesBulk,
  addMatchResultToArchive,
  deleteMatchResultFromArchive,
  getNameHistory,
  recordPlayerNameChange,
  clearPlayerNameHistory,
  getDatabaseOverview,
  addSyncLog,
  exportBackupJson,
  restoreFromBackupJson,
  importFromSqliteBuffer,
  syncNameHistoryAndRelinkArchives,
} from './src/db/sqlite';
import { isPlayerRetired, detectManualFieldChanges } from './src/utils/playerUtils';
import type { Player, Match, ShogiMonthlyResult } from './src/types/shogi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure HMR is disabled in AI Studio dev server environment
process.env.DISABLE_HMR = 'true';

const ADMIN_COOKIE_NAME = 'shogi_admin_session';
const DEFAULT_DEV_ADMIN_PASSWORD = 'shogi-admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_DEV_ADMIN_PASSWORD;
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || EPHEMERAL_SECRET;
}

function createSessionToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token?: string | null): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin' || typeof payload.exp !== 'number') return false;
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        result[k] = decodeURIComponent(v);
      } catch {
        result[k] = v;
      }
    }
  }
  return result;
}

function extractAdminToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ADMIN_COOKIE_NAME] || null;
}

function isAdminAuthenticated(req: Request): boolean {
  return verifySessionToken(extractAdminToken(req));
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: '管理画面へのアクセスにはパスワード認証が必要です',
    });
  }
  next();
}

function setAdminCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    ...(isHttps ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearAdminCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${ADMIN_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    ...(isHttps ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

async function startServer() {
  // Initialize SQLite database (data/shogi.db) immediately on startup
  getDb();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Raw binary upload endpoint for importing SQLite .db file directly
  app.post(
    '/api/admin/import-sqlite',
    requireAdmin,
    express.raw({ type: 'application/octet-stream', limit: '60mb' }),
    (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || req.body.length < 100) {
          return res.status(400).json({ success: false, error: '有効なSQLiteデータベースファイルではありません' });
        }
        const summary = importFromSqliteBuffer(req.body);
        res.json({
          success: true,
          summary,
          overview: getDatabaseOverview(),
        });
      } catch (error: any) {
        console.error('SQLite import error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'SQLiteデータベースのインポートに失敗しました',
        });
      }
    }
  );

  app.use(express.json({ limit: '60mb' }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // =========================================================================
  // PUBLIC READ-ONLY DATABASE ENDPOINTS (将棋推し活アプリ 表画面データ取得元)
  // =========================================================================

  app.get('/api/db/bootstrap', (req, res) => {
    try {
      const players = getAllPlayers();
      const matches = getAllMatches();
      const fiscalResults = getAllMatchArchives();
      const nameHistory = getNameHistory();
      const overview = getDatabaseOverview();
      res.json({
        success: true,
        players,
        matches,
        fiscalResults,
        nameHistory,
        overview,
      });
    } catch (error: any) {
      console.error('Error in /api/db/bootstrap:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to load DB bootstrap' });
    }
  });

  app.get('/api/db/players', (req, res) => {
    try {
      const players = getAllPlayers();
      const nameHistory = getNameHistory();
      res.json({ success: true, count: players.length, players, nameHistory });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to query players' });
    }
  });

  app.get('/api/db/matches', (req, res) => {
    try {
      const matches = getAllMatches();
      res.json({ success: true, count: matches.length, matches });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to query matches' });
    }
  });

  app.get('/api/db/results', (req, res) => {
    try {
      const fiscalYear = req.query.fiscalYear ? parseInt(String(req.query.fiscalYear), 10) : undefined;
      const month = req.query.month ? String(req.query.month) : undefined;
      const data = getAllMatchArchives(fiscalYear, month);
      if (month) {
        return res.json({ success: true, month, results: data[month.replace(/[^0-9]/g, '')] || [] });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to query match archives' });
    }
  });

  app.get('/api/db/name-history', (req, res) => {
    try {
      const history = getNameHistory();
      res.json({ success: true, count: history.length, history });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to query name history' });
    }
  });

  // =========================================================================
  // ADMIN AUTHENTICATION ENDPOINTS (棋士・女流棋士DB 管理画面ログイン)
  // =========================================================================

  app.get('/api/admin/session', (req, res) => {
    res.json({
      success: true,
      authenticated: isAdminAuthenticated(req),
      usingDefaultPassword: !process.env.ADMIN_PASSWORD,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const password = String(req.body?.password || '');
    const expected = getAdminPassword();
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!matches) {
      return res.status(401).json({
        success: false,
        error: 'パスワードが正しくありません',
      });
    }
    const token = createSessionToken();
    setAdminCookie(req, res, token);
    res.json({
      success: true,
      authenticated: true,
      token,
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearAdminCookie(req, res);
    res.json({ success: true, authenticated: false });
  });

  // =========================================================================
  // PASSWORD-PROTECTED ADMIN DB MANAGEMENT ENDPOINTS (棋士・女流棋士DB 管理)
  // =========================================================================

  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    try {
      res.json({ success: true, overview: getDatabaseOverview() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to load DB overview' });
    }
  });

  app.post('/api/admin/players', requireAdmin, (req, res) => {
    try {
      const incoming = req.body as Player;
      if (!incoming || !incoming.id || !incoming.name) {
        return res.status(400).json({ success: false, error: 'player.id と player.name が必須です' });
      }
      const existing = getAllPlayers().find((p) => p.id === incoming.id);
      const manualFields = detectManualFieldChanges(existing, incoming);
      const player: Player = {
        ...existing,
        ...incoming,
        ...(manualFields.length > 0 ? { manualFields } : {}),
      };
      const saved = upsertPlayer(player);
      addSyncLog('player_upsert', 'success', `棋士プロフィール更新: ${saved.name} (${saved.id})`, 1);
      res.json({ success: true, player: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to save player' });
    }
  });

  app.put('/api/admin/players/:id', requireAdmin, (req, res) => {
    try {
      const existing = getAllPlayers().find((p) => p.id === req.params.id);
      const body = (req.body || {}) as Player & {
        nameChange?: {
          clear?: boolean;
          oldName?: string;
          newName?: string;
          changedAt?: string;
          note?: string;
        };
      };
      const nameChangePayload = body.nameChange;
      const bodyClean: Record<string, any> = { ...body };
      delete bodyClean.nameChange;

      const player: Player = existing
        ? {
            ...existing,
            ...(bodyClean as Partial<Player>),
            id: req.params.id,
          }
        : { ...(bodyClean as Player), id: req.params.id };

      if (!bodyClean.formerName || !String(bodyClean.formerName).trim()) {
        if (existing?.formerName && !body.nameChange?.clear) {
          player.formerName = existing.formerName;
        } else {
          delete player.formerName;
        }
      } else {
        player.formerName = String(bodyClean.formerName).trim();
      }
      if (!bodyClean.retirementDate || !String(bodyClean.retirementDate).trim()) {
        delete player.retirementDate;
      } else {
        player.retirementDate = String(bodyClean.retirementDate).trim();
      }

      if (!player.name) {
        return res.status(400).json({ success: false, error: 'player.name が必須です' });
      }
      if (player.type === 'women' || isPlayerRetired(player)) {
        player.ryuoClass = '';
      }
      if (isPlayerRetired(player)) {
        player.junisenClass = '';
      }

      let manualFields = detectManualFieldChanges(existing, player);
      if (nameChangePayload?.oldName?.trim() && nameChangePayload?.newName?.trim()) {
        manualFields = Array.from(new Set([...manualFields, 'name', 'formerName']));
      } else if (nameChangePayload?.clear) {
        manualFields = manualFields.filter((f) => f !== 'formerName');
      }
      if (manualFields.length > 0) {
        player.manualFields = manualFields;
      } else {
        delete player.manualFields;
      }

      let saved = upsertPlayer(player);
      addSyncLog(
        'player_update',
        'success',
        `棋士段位・プロフィール更新 [SQLiteテーブル反映検証済]: ${saved.name} (段位: ${saved.danRank || '未設定'}, 称号: ${saved.rank || 'なし'}${saved.manualFields?.length ? `, 手動保護: ${saved.manualFields.length}項目` : ''})`,
        1
      );

      if (nameChangePayload?.clear) {
        const cleared = clearPlayerNameHistory(req.params.id);
        if (cleared) saved = cleared;
      } else if (nameChangePayload?.oldName?.trim() && nameChangePayload?.newName?.trim()) {
        const ncRes = recordPlayerNameChange({
          playerId: req.params.id,
          oldName: nameChangePayload.oldName.trim(),
          newName: nameChangePayload.newName.trim(),
          changedAt: nameChangePayload.changedAt?.trim(),
          note: nameChangePayload.note?.trim(),
        });
        if (ncRes?.player) {
          saved = ncRes.player;
        }
      }

      const freshPlayer = getAllPlayers().find((p) => p.id === req.params.id) || saved;
      res.json({ success: true, player: freshPlayer, validated: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to update player' });
    }
  });

  app.delete('/api/admin/players/:id', requireAdmin, (req, res) => {
    try {
      const deleted = deletePlayerById(req.params.id);
      if (deleted) {
        addSyncLog('player_delete', 'success', `棋士削除: ${req.params.id}`, 1);
      }
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to delete player' });
    }
  });

  app.post('/api/admin/name-history', requireAdmin, (req, res) => {
    try {
      const { playerId, oldName, newName, changedAt, note } = req.body || {};
      if (!playerId || !oldName || !newName) {
        return res.status(400).json({ success: false, error: 'playerId, oldName, newName は必須です' });
      }
      const result = recordPlayerNameChange({ playerId, oldName, newName, changedAt, note });
      if (!result) {
        return res.status(404).json({ success: false, error: '対象の棋士が見つかりません' });
      }
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to record name change' });
    }
  });

  app.delete('/api/admin/name-history/:playerId', requireAdmin, (req, res) => {
    try {
      const updated = clearPlayerNameHistory(req.params.playerId);
      res.json({ success: true, player: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to clear name history' });
    }
  });

  app.post('/api/admin/relink-names', requireAdmin, (req, res) => {
    try {
      const summary = syncNameHistoryAndRelinkArchives();
      res.json({
        success: true,
        summary,
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      console.error('Error in /api/admin/relink-names:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to relink names' });
    }
  });

  app.post('/api/admin/matches', requireAdmin, (req, res) => {
    try {
      const match = req.body as Match;
      if (!match || !match.id || !match.date) {
        return res.status(400).json({ success: false, error: 'match.id と match.date は必須です' });
      }
      const saved = upsertMatch(match);
      addSyncLog('match_upsert', 'success', `公式対局予定を登録/更新: ${saved.date} ${saved.tournament}`, 1);
      res.json({ success: true, match: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to save match' });
    }
  });

  app.delete('/api/admin/matches/:id', requireAdmin, (req, res) => {
    try {
      const deleted = deleteMatchById(req.params.id);
      if (deleted) {
        addSyncLog('match_delete', 'success', `対局予定を削除: ${req.params.id}`, 1);
      }
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to delete match' });
    }
  });

  app.post('/api/admin/results', requireAdmin, (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body?.results)) {
        const grouped: Record<string, ShogiMonthlyResult[]> = {};
        for (const r of body.results as ShogiMonthlyResult[]) {
          const m = (r.month || r.date?.replace(/[^0-9]/g, '').slice(0, 6) || '').replace(/[^0-9]/g, '');
          if (m.length !== 6) continue;
          if (!grouped[m]) grouped[m] = [];
          grouped[m].push({ ...r, month: m });
        }
        const existing = getAllMatchArchives();
        for (const [m, newList] of Object.entries(grouped)) {
          const map = new Map<string, ShogiMonthlyResult>();
          for (const item of existing[m] || []) map.set(item.id, item);
          for (const item of newList) map.set(item.id, item);
          upsertMonthArchive(m, Array.from(map.values()), 'admin-bulk');
        }
        addSyncLog('results_bulk_import', 'success', `${body.results.length}件の対局結果を一括登録`, body.results.length);
        return res.json({ success: true, count: body.results.length, fiscalResults: getAllMatchArchives() });
      }

      const single = body as ShogiMonthlyResult;
      if (!single || !single.id || !single.date) {
        return res.status(400).json({ success: false, error: 'result.id と result.date は必須です' });
      }
      const updatedMonth = addMatchResultToArchive(single);
      res.json({ success: true, month: single.month, results: updatedMonth });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to save match result' });
    }
  });

  app.delete('/api/admin/results/:month/:id', requireAdmin, (req, res) => {
    try {
      const deleted = deleteMatchResultFromArchive(req.params.month, req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to delete result' });
    }
  });

  app.post('/api/admin/sync/official', requireAdmin, async (req, res) => {
    try {
      const force = req.body?.force !== false;
      const dbPlayersNow = getAllPlayers();
      const dbHistoryNow = getNameHistory();
      const [playersRes, matchesRes, incrementalResults] = await Promise.all([
        scrapeAllActivePlayers(force, dbPlayersNow, dbHistoryNow),
        scrapeMatchPlan(force, dbPlayersNow, dbHistoryNow),
        scrapeIncrementalResults(getAllMatchArchives(), force, dbPlayersNow, dbHistoryNow),
      ]);

      if (playersRes?.success && Array.isArray(playersRes.players) && playersRes.players.length >= 50) {
        upsertPlayersBulk(playersRes.players, 'official_scrape');
      }
      if (matchesRes?.success && Array.isArray(matchesRes.matches) && matchesRes.matches.length > 0) {
        upsertMatchesBulk(matchesRes.matches, 'official_scrape');
      }
      if (incrementalResults?.merged) {
        const toSave: Record<string, ShogiMonthlyResult[]> = {};
        for (const m of incrementalResults.updatedMonths || []) {
          if (incrementalResults.merged[m]) {
            toSave[m] = incrementalResults.merged[m];
          }
        }
        if (Object.keys(toSave).length > 0) {
          upsertMatchArchivesBulk(toSave, 'official_scrape');
        }
      }

      res.json({
        success: true,
        players: getAllPlayers(),
        matches: getAllMatches(),
        fiscalResults: getAllMatchArchives(),
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      addSyncLog('official_scrape', 'error', error?.message || 'Official sync failed', 0);
      res.status(500).json({ success: false, error: error?.message || 'Official sync failed' });
    }
  });

  app.post('/api/admin/rebuild-archives', requireAdmin, async (req, res) => {
    try {
      const years =
        Array.isArray(req.body?.years) && req.body.years.length > 0
          ? req.body.years.map(Number).filter((n: number) => !isNaN(n))
          : [2021, 2022, 2023, 2024, 2025, 2026];
      const includePlayersAndMatches = req.body?.includePlayersAndMatches !== false;

      if (includePlayersAndMatches) {
        const playersRes = await scrapeAllActivePlayers(true, getAllPlayers(), getNameHistory());
        if (playersRes?.success && Array.isArray(playersRes.players) && playersRes.players.length >= 50) {
          upsertPlayersBulk(playersRes.players, 'rebuild_2021_2026');
        }
      }

      const dbPlayers = getAllPlayers();
      const dbHistory = getNameHistory();
      const existingArchives = getAllMatchArchives();

      if (includePlayersAndMatches) {
        const matchesRes = await scrapeMatchPlan(true, dbPlayers, dbHistory);
        if (matchesRes?.success && Array.isArray(matchesRes.matches) && matchesRes.matches.length > 0) {
          upsertMatchesBulk(matchesRes.matches, 'rebuild_2021_2026');
        }
      }

      const rebuilt = await rebuildAllFiscalYearArchives({
        years,
        existingData: existingArchives,
        knownPlayers: dbPlayers,
        nameHistory: dbHistory,
        force: true,
        concurrency: 4,
      });

      upsertMatchArchivesBulk(rebuilt.archives, 'rebuild_2021_2026');

      res.json({
        success: true,
        summary: {
          years,
          monthsAttempted: rebuilt.monthsAttempted,
          monthsUpdatedCount: rebuilt.monthsUpdated.length,
          failedMonths: rebuilt.failedMonths,
          totalResults: rebuilt.totalResults,
          fiscalYearCounts: rebuilt.fiscalYearCounts,
        },
        players: getAllPlayers(),
        matches: getAllMatches(),
        fiscalResults: getAllMatchArchives(),
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      addSyncLog('rebuild_2021_2026', 'error', error?.message || 'Rebuild failed', 0);
      res.status(500).json({ success: false, error: error?.message || 'Failed to rebuild 2021-2026 archives' });
    }
  });

  // Backup Export & Restore (棋士・女流棋士DB 互換エンドポイント)
  app.get('/api/backup/export', requireAdmin, (req, res) => {
    try {
      const payload = exportBackupJson();
      res.setHeader('Content-Disposition', `attachment; filename="shogi-db-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      res.json(payload);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Backup export failed' });
    }
  });

  app.post('/api/backup/restore', requireAdmin, (req, res) => {
    try {
      const summary = restoreFromBackupJson(req.body);
      res.json({
        success: true,
        summary,
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      console.error('Backup restore error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Backup restore failed' });
    }
  });

  // =========================================================================
  // ADMIN-ONLY SCRAPING ROUTES (sync back into SQLite data/shogi.db)
  // =========================================================================

  app.get('/api/players/sync', requireAdmin, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await scrapeAllActivePlayers(force, getAllPlayers(), getNameHistory());
      if (result?.success && Array.isArray(result.players) && result.players.length >= 50) {
        upsertPlayersBulk(result.players, 'api_sync');
      }
      res.json({
        ...result,
        players: getAllPlayers(),
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      console.error('Error in /api/players/sync:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to sync players',
      });
    }
  });

  app.get('/api/matches/sync', requireAdmin, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await scrapeMatchPlan(force, getAllPlayers(), getNameHistory());
      if (result?.success && Array.isArray(result.matches) && result.matches.length > 0) {
        upsertMatchesBulk(result.matches, 'api_sync');
      }
      res.json({
        ...result,
        matches: getAllMatches(),
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      console.error('Error in /api/matches/sync:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to sync matches',
      });
    }
  });

  app.get('/api/matches/results', requireAdmin, async (req, res) => {
    try {
      const month = (req.query.month as string) || '202610';
      const force = req.query.force === 'true';
      const sinceDate = (req.query.sinceDate as string) || undefined;
      const all = req.query.all === 'true';
      const dbPlayers = getAllPlayers();
      const dbHistory = getNameHistory();
      if (all) {
        if (!force) {
          return res.json({ success: true, all: true, data: getAllMatchArchives(), overview: getDatabaseOverview() });
        }
        const results = await getAll2026Results(force, getAllMatchArchives(), dbPlayers, dbHistory);
        upsertMatchArchivesBulk(results, 'api_sync_all');
        return res.json({ success: true, all: true, data: getAllMatchArchives(), overview: getDatabaseOverview() });
      }
      const result = await scrapeMonthlyResults(month, force, sinceDate, dbPlayers, dbHistory);
      if (result?.success && Array.isArray(result.results) && result.results.length > 0) {
        const saved = upsertMonthArchive(month, result.results, 'api_sync_month');
        return res.json({ ...result, results: saved, count: saved.length, overview: getDatabaseOverview() });
      }
      res.json({ ...result, overview: getDatabaseOverview() });
    } catch (error: any) {
      console.error('Error in /api/matches/results:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch match results',
      });
    }
  });

  app.get('/api/sync/all', requireAdmin, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      console.log(`[Bulk Sync All] Starting data synchronization (force=${force})...`);

      const dbPlayersNow = getAllPlayers();
      const dbHistoryNow = getNameHistory();
      const [playersRes, matchesRes, incrementalResults] = await Promise.all([
        scrapeAllActivePlayers(force, dbPlayersNow, dbHistoryNow),
        scrapeMatchPlan(force, dbPlayersNow, dbHistoryNow),
        scrapeIncrementalResults(getAllMatchArchives(), force, dbPlayersNow, dbHistoryNow),
      ]);

      if (playersRes?.success && Array.isArray(playersRes.players) && playersRes.players.length >= 50) {
        upsertPlayersBulk(playersRes.players, 'bulk_sync');
      }
      if (matchesRes?.success && Array.isArray(matchesRes.matches) && matchesRes.matches.length > 0) {
        upsertMatchesBulk(matchesRes.matches, 'bulk_sync');
      }
      if (incrementalResults?.updatedMonths && incrementalResults.updatedMonths.length > 0) {
        const toSave: Record<string, ShogiMonthlyResult[]> = {};
        for (const m of incrementalResults.updatedMonths) {
          if (incrementalResults.merged[m]) toSave[m] = incrementalResults.merged[m];
        }
        if (Object.keys(toSave).length > 0) {
          upsertMatchArchivesBulk(toSave, 'bulk_sync');
        }
      }

      const dbPlayers = getAllPlayers();
      const dbMatches = getAllMatches();
      const dbArchives = getAllMatchArchives();

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        players: { ...playersRes, players: dbPlayers, count: dbPlayers.length },
        matches: { ...matchesRes, matches: dbMatches, count: dbMatches.length },
        results2026: dbArchives,
        updatedMonths: incrementalResults.updatedMonths,
        overview: getDatabaseOverview(),
      });
    } catch (error: any) {
      console.error('Error in /api/sync/all:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to bulk sync all data',
      });
    }
  });

  app.get('/api/players/profile-details', requireAdmin, async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ success: false, error: 'url parameter required' });
      }
      const name = req.query.name as string | undefined;
      const details = await fetchPlayerProfileDetail(url, name);
      res.json({ success: true, details });
    } catch (error: any) {
      console.error('Error in /api/players/profile-details:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch player details',
      });
    }
  });

  app.get('/api/shogidb/search', (req, res) => {
    const q = (req.query.q as string) || '';
    const cleanQ = q.replace(/[\s\u3000※＊\*]/g, ' ').trim();
    const targetUrl = `https://shogidb2.com/search?q=${encodeURIComponent(cleanQ)}`;
    res.json({ success: true, query: cleanQ, targetUrl });
  });

  // Secure Image Proxy for official Shogi Federation & LPSA player profile photos
  app.get('/api/proxy/image', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
      }
      const parsed = new URL(targetUrl);
      if (
        !parsed.hostname.endsWith('shogi.or.jp') &&
        !parsed.hostname.endsWith('joshi-shogi.com')
      ) {
        return res.status(403).send('Forbidden host');
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: `${parsed.protocol}//${parsed.hostname}/`,
        },
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Failed to fetch upstream image');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Error proxying image:', err);
      res.status(500).send('Error proxying image');
    }
  });

  // Explicit handlers for service workers: force immediate unregistration and cache clearing
  const selfDestroyingSw = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => { if (c.url && 'navigate' in c) c.navigate(c.url); }))
  );
});
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
`;
  app.get(['/sw.js', '/dev-sw.js', '/registerSW.js', /workbox-.*\.js$/], (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(selfDestroyingSw);
  });

  const httpServer = http.createServer(app);

  // Setup Vite in Dev mode or serve static files in Production
  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (SQLite: data/shogi.db)`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}, closing SQLite DB cleanly...`);
    closeDb();
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('beforeExit', () => {
    closeDb();
  });
}

startServer();
