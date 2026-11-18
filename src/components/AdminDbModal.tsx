import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  Lock,
  Unlock,
  LogOut,
  X,
  RefreshCw,
  Upload,
  Download,
  Users,
  Calendar,
  Trophy,
  History,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  FileJson,
  HardDrive,
  UserCheck,
} from 'lucide-react';
import type {
  Player,
  Match,
  ShogiMonthlyResult,
  PlayerNameHistoryItem,
  DbOverview,
} from '../types/shogi';

interface AdminDbModalProps {
  onClose: () => void;
  onDatabaseUpdated: () => Promise<void> | void;
}

const ADMIN_TOKEN_STORAGE_KEY = 'shogi_admin_bearer_token_v1';

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {}
}

async function adminFetch(url: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export const AdminDbModal: React.FC<AdminDbModalProps> = ({
  onClose,
  onDatabaseUpdated,
}) => {
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [usingDefaultPassword, setUsingDefaultPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'archives' | 'matches' | 'logs'>('overview');
  const [overview, setOverview] = useState<DbOverview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [nameHistory, setNameHistory] = useState<PlayerNameHistoryItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Players tab state
  const [playerQuery, setPlayerQuery] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [nameChangePlayerId, setNameChangePlayerId] = useState('');
  const [nameChangeOld, setNameChangeOld] = useState('');
  const [nameChangeNew, setNameChangeNew] = useState('');
  const [nameChangeDate, setNameChangeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nameChangeNote, setNameChangeNote] = useState('結婚・改姓等による氏名変更');

  // Archives tab state (FY2021-2026)
  const [selectedArchiveFY, setSelectedArchiveFY] = useState<number>(2026);
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<string>('202610');
  const [archiveMonthResults, setArchiveMonthResults] = useState<ShogiMonthlyResult[]>([]);
  const [newResDate, setNewResDate] = useState('2026-10-15');
  const [newResTournament, setNewResTournament] = useState('公式戦');
  const [newResSente, setNewResSente] = useState('');
  const [newResGote, setNewResGote] = useState('');
  const [newResWinner, setNewResWinner] = useState<'sente' | 'gote'>('sente');
  const [newResNote, setNewResNote] = useState('');

  // Matches tab state
  const [newMatchDate, setNewMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newMatchTime, setNewMatchTime] = useState('10:00');
  const [newMatchTournament, setNewMatchTournament] = useState('');
  const [newMatchRound, setNewMatchRound] = useState('');
  const [newMatchP1, setNewMatchP1] = useState('');
  const [newMatchP2, setNewMatchP2] = useState('');
  const [newMatchVenue, setNewMatchVenue] = useState('東京・将棋会館');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((cur) => (cur?.text === text ? null : cur));
    }, 6000);
  };

  const loadAdminData = async () => {
    try {
      const [ovRes, bootRes] = await Promise.all([
        adminFetch('/api/admin/overview'),
        fetch('/api/db/bootstrap'),
      ]);
      if (ovRes.status === 401) {
        setAuthenticated(false);
        setStoredToken(null);
        return;
      }
      const ovJson = await ovRes.json();
      const bootJson = await bootRes.json();
      if (ovJson.success && ovJson.overview) setOverview(ovJson.overview);
      if (bootJson.success) {
        setPlayers(bootJson.players || []);
        setMatches(bootJson.matches || []);
        setNameHistory(bootJson.nameHistory || []);
      }
    } catch (e: any) {
      showStatus('error', `DBデータの読み込みに失敗しました: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/session');
        const json = await res.json();
        setUsingDefaultPassword(Boolean(json.usingDefaultPassword));
        if (json.authenticated) {
          setAuthenticated(true);
          await loadAdminData();
        }
      } catch {}
      setAuthChecking(false);
    })();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAuthError(json.error || '認証に失敗しました');
        return;
      }
      if (json.token) {
        setStoredToken(json.token);
      }
      setAuthenticated(true);
      setPasswordInput('');
      await loadAdminData();
    } catch (err: any) {
      setAuthError(err?.message || '通信エラーが発生しました');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminFetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setAuthenticated(false);
    setOverview(null);
  };

  const loadArchiveMonth = async (month: string) => {
    try {
      const res = await fetch(`/api/db/results?month=${encodeURIComponent(month)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.results)) {
        setArchiveMonthResults(json.results);
      } else {
        setArchiveMonthResults([]);
      }
    } catch {
      setArchiveMonthResults([]);
    }
  };

  useEffect(() => {
    if (authenticated && activeTab === 'archives') {
      loadArchiveMonth(selectedArchiveMonth);
    }
  }, [authenticated, activeTab, selectedArchiveMonth]);

  const fiscalYearMonthsList = useMemo(() => {
    const list: string[] = [];
    for (let m = 4; m <= 12; m++) list.push(`${selectedArchiveFY}${String(m).padStart(2, '0')}`);
    for (let m = 1; m <= 3; m++) list.push(`${selectedArchiveFY + 1}${String(m).padStart(2, '0')}`);
    return list;
  }, [selectedArchiveFY]);

  useEffect(() => {
    if (!fiscalYearMonthsList.includes(selectedArchiveMonth)) {
      setSelectedArchiveMonth(fiscalYearMonthsList[0]);
    }
  }, [fiscalYearMonthsList]);

  const handleExportBackup = async () => {
    try {
      setIsBusy(true);
      const res = await adminFetch('/api/backup/export');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shogi-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showStatus('success', 'SQLiteデータベースのバックアップJSONをエクスポートしました');
    } catch (e: any) {
      showStatus('error', `エクスポート失敗: ${e?.message || e}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setIsBusy(true);
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await adminFetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await loadAdminData();
      await onDatabaseUpdated();
      const s = json.summary;
      showStatus(
        'success',
        `JSONバックアップからDB復元完了（棋士: ${s.playersImported}名 / 予定: ${s.matchesImported}件 / 対局結果: ${s.archivesMonthsImported}ヶ月 ${s.archivesResultsImported}局 / 改姓履歴: ${s.nameHistoryImported}件）`
      );
    } catch (err: any) {
      showStatus('error', `JSONリストアエラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportSqliteDbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setIsBusy(true);
      const buffer = await file.arrayBuffer();
      const res = await adminFetch('/api/admin/import-sqlite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await loadAdminData();
      await onDatabaseUpdated();
      const s = json.summary;
      showStatus(
        'success',
        `SQLite(.db)取り込み完了（棋士: ${s.playersImported}名 / 予定: ${s.matchesImported}件 / 対局アーカイブ: ${s.archivesMonthsImported}ヶ月 ${s.archivesResultsImported}局）`
      );
    } catch (err: any) {
      showStatus('error', `SQLiteファイル取り込みエラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOfficialSyncToDb = async () => {
    try {
      setIsBusy(true);
      showStatus('success', '公式データ（棋士プロフィール・対局予定・最新結果）を取得してSQLite DBへ反映中...');
      const res = await adminFetch('/api/admin/sync/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `公式データをSQLite DB（data/shogi.db）へ同期完了しました！`);
    } catch (err: any) {
      showStatus('error', `公式同期エラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEditedPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    try {
      setIsBusy(true);
      const res = await adminFetch(`/api/admin/players/${encodeURIComponent(editingPlayer.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlayer),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '更新に失敗しました');
      setEditingPlayer(null);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `${json.player.name} のプロフィールをSQLite DBへ保存しました`);
    } catch (err: any) {
      showStatus('error', err?.message || '保存エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecordNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameChangePlayerId || !nameChangeOld.trim() || !nameChangeNew.trim()) return;
    try {
      setIsBusy(true);
      const res = await adminFetch('/api/admin/name-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: nameChangePlayerId,
          oldName: nameChangeOld.trim(),
          newName: nameChangeNew.trim(),
          changedAt: nameChangeDate,
          note: nameChangeNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録に失敗しました');
      setNameChangeNew('');
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `氏名変更を登録し過去対局との紐付けを維持しました（${nameChangeOld} → ${nameChangeNew}）`);
    } catch (err: any) {
      showStatus('error', err?.message || '氏名変更登録エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddArchiveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResDate || !newResSente.trim() || !newResGote.trim()) return;
    try {
      setIsBusy(true);
      const month = newResDate.replace(/[^0-9]/g, '').slice(0, 6);
      const senteClean = newResSente.trim();
      const goteClean = newResGote.trim();
      const senteP = players.find((p) => p.name.replace(/\s+/g, '') === senteClean.replace(/\s+/g, ''));
      const goteP = players.find((p) => p.name.replace(/\s+/g, '') === goteClean.replace(/\s+/g, ''));
      const winner = newResWinner === 'sente' ? senteClean : goteClean;
      const loser = newResWinner === 'sente' ? goteClean : senteClean;
      const isWomen = senteP?.type === 'women' || goteP?.type === 'women' || newResTournament.includes('女流');

      const newResult: ShogiMonthlyResult = {
        id: `db-res-${Date.now()}`,
        date: newResDate,
        month,
        sente: senteClean,
        gote: goteClean,
        senteRaw: senteClean,
        goteRaw: goteClean,
        sentePlayerId: senteP?.id,
        gotePlayerId: goteP?.id,
        senteMark: newResWinner === 'sente' ? '○' : '●',
        goteMark: newResWinner === 'gote' ? '○' : '●',
        winner,
        loser,
        winnerId: newResWinner === 'sente' ? senteP?.id : goteP?.id,
        loserId: newResWinner === 'sente' ? goteP?.id : senteP?.id,
        resultType: 'normal',
        tournament: newResTournament.trim() || '公式戦',
        note: newResNote.trim(),
        isWomen,
        category: isWomen ? '女流棋戦' : '一般棋戦',
        links: [{ title: '日本将棋連盟公式', url: `https://www.shogi.or.jp/game/?month=${month}` }],
        sourceUrl: `https://www.shogi.or.jp/game/?month=${month}`,
      };

      const res = await adminFetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResult),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録失敗');

      setNewResSente('');
      setNewResGote('');
      setNewResNote('');
      setSelectedArchiveMonth(month);
      await loadArchiveMonth(month);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `${month} に対局結果を追加しました`);
    } catch (err: any) {
      showStatus('error', err?.message || '対局結果追加エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteArchiveResult = async (month: string, id: string) => {
    try {
      setIsBusy(true);
      const res = await adminFetch(`/api/admin/results/${encodeURIComponent(month)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      await loadArchiveMonth(month);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', '対局結果を削除しました');
    } catch (err: any) {
      showStatus('error', err?.message || '削除エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddMatchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchDate || !newMatchTournament.trim() || !newMatchP1.trim() || !newMatchP2.trim()) return;
    try {
      setIsBusy(true);
      const p1 = players.find((p) => p.name.replace(/\s+/g, '') === newMatchP1.replace(/\s+/g, ''));
      const p2 = players.find((p) => p.name.replace(/\s+/g, '') === newMatchP2.replace(/\s+/g, ''));
      const isWomen = p1?.type === 'women' || p2?.type === 'women' || newMatchTournament.includes('女流');

      const matchObj: Match = {
        id: `db-match-${Date.now()}`,
        tournament: newMatchTournament.trim(),
        category: isWomen ? '女流棋戦' : '一般棋戦',
        round: newMatchRound.trim() || '公式戦',
        date: newMatchDate,
        time: newMatchTime || '10:00',
        player1Id: p1?.id || newMatchP1.trim(),
        player2Id: p2?.id || newMatchP2.trim(),
        sentePlayerId: p1?.id,
        gotePlayerId: p2?.id,
        status: 'upcoming',
        venue: newMatchVenue.trim() || '東京・将棋会館',
        timeControl: '',
        broadcast: [],
        kifuUrl: `https://shogidb2.com/search?q=${encodeURIComponent(`${newMatchP1.trim()} ${newMatchP2.trim()}`)}`,
        kifuMoves: [],
        highlights: `${newMatchP1.trim()} 対 ${newMatchP2.trim()}（${newMatchTournament.trim()}）`,
      };

      const res = await adminFetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchObj),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録失敗');

      setNewMatchTournament('');
      setNewMatchRound('');
      setNewMatchP1('');
      setNewMatchP2('');
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', '公式対局予定をSQLite DBに追加しました');
    } catch (err: any) {
      showStatus('error', err?.message || '予定追加エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteMatchSchedule = async (id: string) => {
    try {
      setIsBusy(true);
      const res = await adminFetch(`/api/admin/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('削除失敗');
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', '対局予定を削除しました');
    } catch (err: any) {
      showStatus('error', err?.message || '削除エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return players.slice(0, 60);
    return players
      .filter((p) => {
        const str = `${p.name} ${p.formerName || ''} ${p.id} ${p.rank} ${p.affiliation || ''}`
          .toLowerCase()
          .replace(/\s+/g, '');
        return str.includes(q);
      })
      .slice(0, 80);
  }, [players, playerQuery]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-5 touch-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100 touch-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl border shrink-0 ${authenticated ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {authenticated ? <Database size={20} /> : <Lock size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black font-serif-jp text-zinc-100 truncate">
                  棋士・女流棋士DB 管理画面
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 border border-zinc-700">
                  SQLite: data/shogi.db
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate">
                {authenticated
                  ? '全棋士プロフィール・2021〜2026年度対局情報・公式対局予定・改姓履歴の一元管理'
                  : 'データベース管理・インポート・編集を行うにはパスワード認証が必要です'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {authenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/70 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="管理画面をロックしてログアウト"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">ロック</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusBanner && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b shrink-0 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            }`}
          >
            {statusBanner.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={15} className="text-rose-400 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* Body */}
        {authChecking ? (
          <div className="p-12 flex items-center justify-center text-zinc-400 text-sm gap-2">
            <RefreshCw size={16} className="animate-spin text-amber-400" />
            <span>セッションを確認中...</span>
          </div>
        ) : !authenticated ? (
          <div className="p-6 sm:p-10 flex items-center justify-center flex-1 overflow-y-auto">
            <form
              onSubmit={handleLogin}
              className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock size={24} />
                </div>
                <h3 className="text-base font-black font-serif-jp text-zinc-100">
                  管理者パスワード入力
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  棋士・女流棋士DBの編集、2021〜2026年度データ取り込み、改姓履歴管理を行うにはパスワードを入力してください。
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="管理画面パスワードを入力"
                    autoFocus
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-zinc-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {usingDefaultPassword && (
                  <p className="text-[11px] text-zinc-500 pt-1">
                    ※ 環境変数 <code className="text-zinc-400">ADMIN_PASSWORD</code> 未設定時の初期パスワード: <code className="text-amber-400">shogi-admin</code>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !passwordInput}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Unlock size={16} />
                <span>{isLoggingIn ? '認証中...' : 'ロック解除して管理画面を開く'}</span>
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Navigation Sub-tabs */}
            <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-900/60 px-3 sm:px-5 pt-2 gap-1 shrink-0">
              {[
                { id: 'overview', label: 'DB概要・復元', icon: HardDrive },
                { id: 'players', label: '棋士・改姓履歴', icon: Users },
                { id: 'archives', label: '2021-2026 対局結果', icon: Trophy },
                { id: 'matches', label: '公式対局予定', icon: Calendar },
                { id: 'logs', label: '同期ログ', icon: History },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-amber-400 text-amber-300'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* OVERVIEW & BACKUP/RESTORE */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block">players (棋士)</span>
                      <span className="text-xl font-black text-amber-300 font-mono">
                        {overview?.counts.players ?? players.length}
                      </span>
                    </div>
                    <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block">matches (対局予定)</span>
                      <span className="text-xl font-black text-sky-300 font-mono">
                        {overview?.counts.matches ?? matches.length}
                      </span>
                    </div>
                    <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block">match_archives (月数)</span>
                      <span className="text-xl font-black text-emerald-300 font-mono">
                        {overview?.counts.match_archives ?? 0}
                      </span>
                    </div>
                    <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block">総収録対局数</span>
                      <span className="text-xl font-black text-purple-300 font-mono">
                        {overview?.counts.match_results_total ?? 0}
                      </span>
                    </div>
                    <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block">改姓履歴</span>
                      <span className="text-xl font-black text-rose-300 font-mono">
                        {overview?.counts.player_name_history ?? nameHistory.length}
                      </span>
                    </div>
                  </div>

                  {/* Backup / Restore / SQLite Import Actions */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <FileJson size={16} />
                        <span>「棋士・女流棋士DB」バックアップ取込・SQLite移行・エクスポート</span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        別アプリ版の「棋士・女流棋士DB」で生成された <code className="text-zinc-200">/api/backup/export</code> の JSON ファイル、または <code className="text-zinc-200">data/shogi.db</code> ファイルをそのまま取り込んで表画面（2021〜2026年度全対局・プロフィール・対局予定）へ反映できます。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="flex flex-col justify-between p-3.5 rounded-xl bg-zinc-950 border border-amber-500/40 hover:border-amber-400 cursor-pointer transition gap-2">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                          <Upload size={15} />
                          <span>JSON リストア取込</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          /api/backup/export 形式の JSON を選択してDBを復元
                        </span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleRestoreJsonFile}
                          disabled={isBusy}
                          className="hidden"
                        />
                      </label>

                      <label className="flex flex-col justify-between p-3.5 rounded-xl bg-zinc-950 border border-sky-500/40 hover:border-sky-400 cursor-pointer transition gap-2">
                        <div className="flex items-center gap-2 text-sky-300 font-bold text-xs">
                          <Database size={15} />
                          <span>SQLite (.db) 取込</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          shogi.db ファイルを直接読み込んで統合DBへ反映
                        </span>
                        <input
                          type="file"
                          accept=".db,.sqlite,.sqlite3"
                          onChange={handleImportSqliteDbFile}
                          disabled={isBusy}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleExportBackup}
                        disabled={isBusy}
                        className="flex flex-col justify-between p-3.5 rounded-xl bg-zinc-950 border border-emerald-500/40 hover:border-emerald-400 text-left transition gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <Download size={15} />
                          <span>バックアップ出力</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          現在の統合DBを JSON でダウンロード（/api/backup/export）
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOfficialSyncToDb}
                        disabled={isBusy}
                        className="flex flex-col justify-between p-3.5 rounded-xl bg-zinc-950 border border-purple-500/40 hover:border-purple-400 text-left transition gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                          <RefreshCw size={15} className={isBusy ? 'animate-spin' : ''} />
                          <span>連盟公式 → DB同期</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          連盟・LPSA最新情報を取得して data/shogi.db を更新
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* FY2021-2026 Breakdown */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-zinc-200">
                      年度別 対局アーカイブ収録状況（2021年度〜2026年度）
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                      {(overview?.fiscalYears || []).map((fy) => (
                        <div
                          key={fy.fiscalYear}
                          className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center"
                        >
                          <span className="text-xs font-bold text-amber-300 block">
                            {fy.fiscalYear}年度
                          </span>
                          <span className="text-sm font-mono font-bold text-zinc-100 block mt-1">
                            {fy.matchesCount} 局
                          </span>
                          <span className="text-[10px] text-zinc-500 block">
                            {fy.monthsCount} ヶ月分
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PLAYERS & NAME HISTORY */}
              {activeTab === 'players' && (
                <div className="space-y-5">
                  {/* Name Change History Registration Tool */}
                  <form
                    onSubmit={handleRecordNameChange}
                    className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-4 space-y-3"
                  >
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <UserCheck size={16} />
                      <span>氏名変更・旧姓履歴登録（過去対局との紐付け維持）</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                      <select
                        value={nameChangePlayerId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setNameChangePlayerId(pid);
                          const p = playerMap.get(pid);
                          if (p) setNameChangeOld(p.formerName || p.name);
                        }}
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none sm:col-span-2"
                      >
                        <option value="">対象棋士を選択...</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.rank})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={nameChangeOld}
                        onChange={(e) => setNameChangeOld(e.target.value)}
                        placeholder="旧姓・変更前氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={nameChangeNew}
                        onChange={(e) => setNameChangeNew(e.target.value)}
                        placeholder="新氏名（スペース有推奨）"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        改姓をDB反映
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <input
                        type="date"
                        value={nameChangeDate}
                        onChange={(e) => setNameChangeDate(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={nameChangeNote}
                        onChange={(e) => setNameChangeNote(e.target.value)}
                        placeholder="備考（結婚による改姓など）"
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none sm:col-span-2"
                      />
                    </div>

                    {nameHistory.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                        <span className="text-[11px] font-bold text-zinc-400 block">
                          登録済み 氏名変更履歴 ({nameHistory.length}件)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {nameHistory.map((h) => (
                            <span
                              key={h.id}
                              className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300"
                            >
                              <strong className="text-zinc-400">{h.oldName}</strong> →{' '}
                              <strong className="text-amber-300">{h.newName}</strong> ({h.changedAt})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Edit Player Modal/Form Inline */}
                  {editingPlayer && (
                    <form
                      onSubmit={handleSaveEditedPlayer}
                      className="bg-zinc-900 border border-sky-500/40 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-sky-300">
                          プロフィール編集: {editingPlayer.name} ({editingPlayer.id})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingPlayer(null)}
                          className="text-xs text-zinc-400 hover:text-white"
                        >
                          キャンセル
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">氏名</label>
                          <input
                            type="text"
                            value={editingPlayer.name}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">旧姓 (formerName)</label>
                          <input
                            type="text"
                            value={editingPlayer.formerName || ''}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, formerName: e.target.value || undefined })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">称号・段位</label>
                          <input
                            type="text"
                            value={editingPlayer.rank}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, rank: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">所属</label>
                          <input
                            type="text"
                            value={editingPlayer.affiliation || ''}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, affiliation: e.target.value as any })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">順位戦クラス</label>
                          <input
                            type="text"
                            value={editingPlayer.junisenClass}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, junisenClass: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">竜王戦クラス</label>
                          <input
                            type="text"
                            value={editingPlayer.ryuoClass}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, ryuoClass: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">今年度 勝</label>
                          <input
                            type="number"
                            value={editingPlayer.currentYearWins}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, currentYearWins: Number(e.target.value) })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">今年度 敗</label>
                          <input
                            type="number"
                            value={editingPlayer.currentYearLosses}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, currentYearLosses: Number(e.target.value) })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">短評・プロフィール紹介</label>
                        <input
                          type="text"
                          value={editingPlayer.shortBio}
                          onChange={(e) => setEditingPlayer({ ...editingPlayer, shortBio: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save size={14} />
                        <span>SQLite DBに保存</span>
                      </button>
                    </form>
                  )}

                  {/* Player Search & List */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                      <Search size={15} className="text-zinc-400" />
                      <input
                        type="text"
                        value={playerQuery}
                        onChange={(e) => setPlayerQuery(e.target.value)}
                        placeholder="棋士名・旧姓・ID・段位で検索..."
                        className="w-full bg-transparent text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div className="divide-y divide-zinc-800/70 max-h-[340px] overflow-y-auto">
                      {filteredPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-zinc-100">{p.name}</span>
                              {p.formerName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                  旧姓: {p.formerName}
                                </span>
                              )}
                              <span className="text-amber-300 text-[11px]">{p.rank}</span>
                              <span className="text-zinc-500 text-[10px] font-mono">
                                No.{p.playerNumber || '-'} ({p.affiliation || '連盟'})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingPlayer(p)}
                            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold shrink-0 cursor-pointer"
                          >
                            編集
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FY2021-2026 MATCH ARCHIVES */}
              {activeTab === 'archives' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[2026, 2025, 2024, 2023, 2022, 2021].map((fy) => (
                        <button
                          key={fy}
                          type="button"
                          onClick={() => setSelectedArchiveFY(fy)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            selectedArchiveFY === fy
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          {fy}年度
                        </button>
                      ))}
                    </div>

                    <select
                      value={selectedArchiveMonth}
                      onChange={(e) => setSelectedArchiveMonth(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100"
                    >
                      {fiscalYearMonthsList.map((m) => (
                        <option key={m} value={m}>
                          {m.slice(0, 4)}年{parseInt(m.slice(4), 10)}月
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Add Match Result */}
                  <form
                    onSubmit={handleAddArchiveResult}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3"
                  >
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Plus size={14} />
                      <span>対局結果を追加（2021〜2026年度対応）</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                      <input
                        type="date"
                        value={newResDate}
                        onChange={(e) => setNewResDate(e.target.value)}
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newResTournament}
                        onChange={(e) => setNewResTournament(e.target.value)}
                        placeholder="棋戦名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newResSente}
                        onChange={(e) => setNewResSente(e.target.value)}
                        placeholder="先手氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newResGote}
                        onChange={(e) => setNewResGote(e.target.value)}
                        placeholder="後手氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <select
                        value={newResWinner}
                        onChange={(e) => setNewResWinner(e.target.value as any)}
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      >
                        <option value="sente">先手勝ち</option>
                        <option value="gote">後手勝ち</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                      >
                        DB登録
                      </button>
                    </div>
                  </form>

                  {/* Month Archive List */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200">
                        {selectedArchiveMonth.slice(0, 4)}年{parseInt(selectedArchiveMonth.slice(4), 10)}月 の対局記録 ({archiveMonthResults.length}局)
                      </span>
                    </div>
                    {archiveMonthResults.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">
                        この月の対局データはまだDBに登録されていません
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/70 max-h-[300px] overflow-y-auto">
                        {archiveMonthResults.map((r) => (
                          <div
                            key={r.id}
                            className="px-4 py-2 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono text-zinc-400 mr-2">{r.date}</span>
                              <span className="text-amber-300 font-bold mr-2">{r.tournament}</span>
                              <span className="text-zinc-100">
                                {r.senteMark} {r.sente} vs {r.gote} {r.goteMark}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteArchiveResult(selectedArchiveMonth, r.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer shrink-0"
                              title="削除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* OFFICIAL MATCH SCHEDULES */}
              {activeTab === 'matches' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddMatchSchedule}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3"
                  >
                    <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Plus size={14} />
                      <span>公式対局予定を追加 (matches テーブル)</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                      <input
                        type="date"
                        value={newMatchDate}
                        onChange={(e) => setNewMatchDate(e.target.value)}
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newMatchTime}
                        onChange={(e) => setNewMatchTime(e.target.value)}
                        placeholder="時刻 (10:00)"
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newMatchTournament}
                        onChange={(e) => setNewMatchTournament(e.target.value)}
                        placeholder="棋戦名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newMatchP1}
                        onChange={(e) => setNewMatchP1(e.target.value)}
                        placeholder="対局者1氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newMatchP2}
                        onChange={(e) => setNewMatchP2(e.target.value)}
                        placeholder="対局者2氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                      >
                        予定登録
                      </button>
                    </div>
                  </form>

                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-800 text-xs font-bold text-zinc-200">
                      登録済み 公式対局予定 ({matches.length}件)
                    </div>
                    <div className="divide-y divide-zinc-800/70 max-h-[340px] overflow-y-auto">
                      {matches.map((m) => {
                        const p1 = playerMap.get(m.player1Id)?.name || m.player1Id;
                        const p2 = playerMap.get(m.player2Id)?.name || m.player2Id;
                        return (
                          <div
                            key={m.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono text-zinc-400 mr-2">
                                {m.date} {m.time}
                              </span>
                              <span className="text-sky-300 font-bold mr-2">{m.tournament}</span>
                              <span className="text-zinc-100">
                                {p1} vs {p2}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteMatchSchedule(m.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SYNC LOGS */}
              {activeTab === 'logs' && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-zinc-800 text-xs font-bold text-zinc-200">
                    データベース同期・更新ログ (sync_logs)
                  </div>
                  <div className="divide-y divide-zinc-800/70 max-h-[400px] overflow-y-auto">
                    {(overview?.recentLogs || []).map((log) => (
                      <div key={log.id} className="px-4 py-2.5 text-xs flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.status === 'success'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {log.syncType}
                            </span>
                            <span className="text-zinc-500 font-mono text-[10px]">
                              {log.createdAt}
                            </span>
                          </div>
                          <p className="text-zinc-200">{log.message}</p>
                        </div>
                        <span className="font-mono text-zinc-400 shrink-0">
                          {log.recordsCount} 件
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
