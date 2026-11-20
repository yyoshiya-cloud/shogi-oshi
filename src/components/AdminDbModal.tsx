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
  Eye,
  EyeOff,
  FileJson,
  HardDrive,
  UserCheck,
  Pencil,
  PlusCircle,
  FileSpreadsheet,
  Eraser,
  Save,
  PauseCircle,
  ArrowLeft,
} from 'lucide-react';
import { PlayerDirectory } from './PlayerDirectory';
import {
  normalizeShogiPlayerNameForMatch,
  isPlayerOnLeave,
  formatPlayerLeavePeriod,
  isPlayerRetired,
  formatPlayerRetirementDate,
  formatPlayerName,
  formatPlayerRankAndDan,
  autoFormatDateOnChange,
  normalizeDateToYyyyMmDd,
  isValidYyyyMmDd,
  calculateAgeFromBirthDateString,
  PRO_DAN_RANKS,
  WOMEN_DAN_RANKS,
} from '../utils/playerUtils';
import { isProtectedMatchResult } from '../utils/resultProtection';
import type {
  Player,
  Match,
  ShogiMonthlyResult,
  PlayerNameHistoryItem,
  DbOverview,
  FollowedPlayerConfig,
} from '../types/shogi';

interface AdminDbModalProps {
  onClose: () => void;
  onDatabaseUpdated: () => Promise<void> | void;
  followedList?: FollowedPlayerConfig[];
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
  followedList = [],
}) => {
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [usingDefaultPassword, setUsingDefaultPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'players' | 'archives' | 'manual_input' | 'csv_import' | 'matches' | 'logs'
  >('overview');
  const [overview, setOverview] = useState<DbOverview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [nameHistory, setNameHistory] = useState<PlayerNameHistoryItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Players tab state
  const [editingProfile, setEditingProfile] = useState<Player | null>(null);
  const [profileAge, setProfileAge] = useState('');
  const [profileHeldTitlesInput, setProfileHeldTitlesInput] = useState('');
  const [profileLeaveEnabled, setProfileLeaveEnabled] = useState(false);
  const [profileLeaveStart, setProfileLeaveStart] = useState('');
  const [profileLeaveEnd, setProfileLeaveEnd] = useState('');
  const [profileLeaveReason, setProfileLeaveReason] = useState('');
  const [profileOldName, setProfileOldName] = useState('');
  const [profileNewName, setProfileNewName] = useState('');
  const [profileNameChangeDate, setProfileNameChangeDate] = useState('');
  const [profileNameChangeNote, setProfileNameChangeNote] = useState('');
  const [profileClearNameHistory, setProfileClearNameHistory] = useState(false);
  const [profileRetirementDate, setProfileRetirementDate] = useState('');

  // Archives tab state (FY2021-2026) - initial period derived from system date
  const [selectedArchiveFY, setSelectedArchiveFY] = useState<number>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthNum = now.getMonth() + 1;
    const fy = monthNum >= 4 ? year : year - 1;
    if (fy > 2026) return 2026;
    if (fy < 2021) return 2021;
    return fy;
  });
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthNum = now.getMonth() + 1;
    const fy = monthNum >= 4 ? year : year - 1;
    if (fy > 2026) return '202703';
    if (fy < 2021) return '202104';
    return `${year}${String(monthNum).padStart(2, '0')}`;
  });
  const [archiveMonthResults, setArchiveMonthResults] = useState<ShogiMonthlyResult[]>([]);
  const [editingArchiveResult, setEditingArchiveResult] = useState<ShogiMonthlyResult | null>(null);
  const [editingArchiveOrigMonth, setEditingArchiveOrigMonth] = useState<string | null>(null);
  const [confirmDeleteResultId, setConfirmDeleteResultId] = useState<string | null>(null);
  const [newResDate, setNewResDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newResTournament, setNewResTournament] = useState('公式戦');
  const [newResSente, setNewResSente] = useState('');
  const [newResGote, setNewResGote] = useState('');
  const [newResWinner, setNewResWinner] = useState<'sente' | 'gote' | 'undecided'>('sente');
  const [newResNote, setNewResNote] = useState('');

  // 対局手動入力機能 state (all fields initialized empty / un-entered)
  const [manualDate, setManualDate] = useState('');
  const [manualTournament, setManualTournament] = useState('');
  const [manualSente, setManualSente] = useState('');
  const [manualGote, setManualGote] = useState('');
  const [manualWinner, setManualWinner] = useState<'' | 'sente' | 'gote' | 'undecided'>('');
  const [manualNote, setManualNote] = useState('');

  // CSVインポート機能 state
  const [csvInputText, setCsvInputText] = useState('');
  const [csvImportSummary, setCsvImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Matches tab state
  const [matchQuery, setMatchQuery] = useState('');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<string | null>(null);
  const [newMatchDate, setNewMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newMatchTime, setNewMatchTime] = useState('10:00');
  const [newMatchTournament, setNewMatchTournament] = useState('');
  const [newMatchRound, setNewMatchRound] = useState('');
  const [newMatchP1, setNewMatchP1] = useState('');
  const [newMatchP2, setNewMatchP2] = useState('');
  const [newMatchVenue, setNewMatchVenue] = useState('東京・将棋会館');
  const [newMatchStatus, setNewMatchStatus] = useState<'upcoming' | 'live' | 'finished'>('upcoming');
  const [newMatchWinnerSide, setNewMatchWinnerSide] = useState<'none' | 'p1' | 'p2'>('none');

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

  const handleRebuildAllArchives = async (years: number[] = [2021, 2022, 2023, 2024, 2025, 2026]) => {
    try {
      setIsBusy(true);
      showStatus(
        'success',
        `${years[0]}〜${years[years.length - 1]}年度の公式対局アーカイブ（手動・CSV保護データは維持）を再構築中...（30〜60秒程度かかります）`
      );
      const res = await adminFetch('/api/admin/rebuild-archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years, includePlayersAndMatches: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await loadAdminData();
      if (activeTab === 'archives') {
        await loadArchiveMonth(selectedArchiveMonth);
      }
      await onDatabaseUpdated();
      const s = json.summary;
      showStatus(
        'success',
        `2021〜2026年度 対局情報再構築完了！（${s.monthsUpdatedCount}ヶ月更新 / 収録合計 ${s.totalResults}局）`
      );
    } catch (err: any) {
      showStatus('error', `対局情報再構築エラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncPlayersOnly = async () => {
    try {
      setIsBusy(true);
      showStatus('success', '日本将棋連盟・LPSAから最新棋士・女流棋士プロフィールを取得中...');
      const res = await adminFetch('/api/players/sync?force=true');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `棋士・女流棋士プロフィールをSQLite DBへ更新しました（${json.players?.length || 0}名）`);
    } catch (err: any) {
      showStatus('error', `プロフィール更新エラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncMatchesOnly = async () => {
    try {
      setIsBusy(true);
      showStatus('success', '日本将棋連盟から最新の公式対局予定を取得中...');
      const res = await adminFetch('/api/matches/sync?force=true');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `公式対局予定をSQLite DBへ更新しました（${json.matches?.length || 0}件）`);
    } catch (err: any) {
      showStatus('error', `対局予定更新エラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncArchiveMonth = async (monthStr: string) => {
    try {
      setIsBusy(true);
      showStatus('success', `${monthStr.slice(0, 4)}年${parseInt(monthStr.slice(4), 10)}月の公式対局結果を取得中...`);
      const res = await adminFetch(`/api/matches/results?month=${encodeURIComponent(monthStr)}&force=true`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      await loadArchiveMonth(monthStr);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `${monthStr} の公式対局結果をSQLite DBへ同期しました（${json.count || 0}局・保護データ維持）`);
    } catch (err: any) {
      showStatus('error', `月別対局結果同期エラー: ${err?.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  const selectPlayerForProfileEdit = (p: Player) => {
    const normalizedBirthDate = normalizeDateToYyyyMmDd(p.birthDate || '');
    const computedAge = calculateAgeFromBirthDateString(normalizedBirthDate);
    const retired = isPlayerRetired(p);

    let initialDan = (p.danRank || '').trim().replace(/１/g, '1').replace(/２/g, '2');
    let initialRank = (p.rank || '').trim().replace(/１/g, '1').replace(/２/g, '2');

    const isPro = p.type !== 'women';
    const danRegex = isPro
      ? /([四五六七八九]段)/
      : /(女流[1-2]級|女流[初一二三四五六七八]段)/;

    if (!initialDan) {
      const match = initialRank.match(danRegex);
      if (match) {
        initialDan = match[1];
      }
    }

    if (/^[一二三四五六七八九]段$|^女流[1-2]級$|^女流[初一二三四五六七八]段$/.test(initialRank)) {
      initialRank = '';
    } else if (initialRank.includes('(永世称号有資格者)')) {
      initialRank = '永世称号有資格者';
    } else if (initialRank.includes('(クイーン称号有資格者)')) {
      initialRank = 'クイーン称号有資格者';
    }

    setEditingProfile({
      ...p,
      rank: initialRank,
      danRank: initialDan,
      birthDate: normalizedBirthDate,
      ...(p.type === 'women' ? { ryuoClass: '' } : {}),
      ...(retired ? { junisenClass: '', ryuoClass: '' } : {}),
    });
    setProfileAge(computedAge !== null ? String(computedAge) : '');
    setProfileHeldTitlesInput((p.heldTitles || []).join('、'));
    const activeLeave = isPlayerOnLeave(p);
    setProfileLeaveEnabled(p.leaveInfo?.isOnLeave ?? activeLeave);
    setProfileLeaveStart(normalizeDateToYyyyMmDd(p.leaveInfo?.startDate || ''));
    setProfileLeaveEnd(normalizeDateToYyyyMmDd(p.leaveInfo?.endDate || ''));
    setProfileLeaveReason(p.leaveInfo?.reason || '');
    setProfileOldName('');
    setProfileNewName('');
    setProfileNameChangeDate('');
    setProfileNameChangeNote('');
    setProfileClearNameHistory(false);
    setProfileRetirementDate(normalizeDateToYyyyMmDd(p.retirementDate || ''));
  };

  const clearProfileSelection = () => {
    setEditingProfile(null);
    setProfileAge('');
    setProfileHeldTitlesInput('');
    setProfileLeaveEnabled(false);
    setProfileLeaveStart('');
    setProfileLeaveEnd('');
    setProfileLeaveReason('');
    setProfileOldName('');
    setProfileNewName('');
    setProfileNameChangeDate('');
    setProfileNameChangeNote('');
    setProfileClearNameHistory(false);
    setProfileRetirementDate('');
  };

  const handleClearEditingNameChange = async () => {
    if (!editingProfile) return;
    setProfileOldName('');
    setProfileNewName('');
    setProfileNameChangeDate('');
    setProfileNameChangeNote('');
    setProfileClearNameHistory(true);

    const hasExistingInDb =
      Boolean(editingProfile.formerName) ||
      nameHistory.some((h) => h.playerId === editingProfile.id);

    if (hasExistingInDb) {
      try {
        setIsBusy(true);
        const res = await adminFetch(`/api/admin/name-history/${encodeURIComponent(editingProfile.id)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || '氏名変更情報の消去に失敗しました');
        const nextEditing: Player = { ...(json.player || editingProfile) };
        delete nextEditing.formerName;
        setEditingProfile(nextEditing);
        setProfileClearNameHistory(false);
        await loadAdminData();
        await onDatabaseUpdated();
        showStatus('success', `${nextEditing.name} の旧氏名・新氏名・改正年月日を消去しました`);
      } catch (err: any) {
        showStatus('error', err?.message || '氏名変更情報消去エラー');
      } finally {
        setIsBusy(false);
      }
    } else {
      const nextEditing = { ...editingProfile };
      delete nextEditing.formerName;
      setEditingProfile(nextEditing);
    }
  };

  const handleSaveProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editingProfile.name.trim()) {
      showStatus('error', '更新対象の棋士・女流棋士を検索して選択してください');
      return;
    }

    const birthDateNorm = normalizeDateToYyyyMmDd(editingProfile.birthDate || '');
    const leaveStartNorm = normalizeDateToYyyyMmDd(profileLeaveStart);
    const leaveEndNorm = normalizeDateToYyyyMmDd(profileLeaveEnd);
    const nameChangeDateNorm = normalizeDateToYyyyMmDd(profileNameChangeDate);
    const retirementDateNorm = normalizeDateToYyyyMmDd(profileRetirementDate);

    if (birthDateNorm && (/^\d{4}/.test(birthDateNorm) || /^\d{8}$/.test(birthDateNorm)) && !isValidYyyyMmDd(birthDateNorm)) {
      showStatus('error', '生年月日は YYYY-MM-DD 形式で正しい日付を入力してください');
      return;
    }
    if (leaveStartNorm && !isValidYyyyMmDd(leaveStartNorm)) {
      showStatus('error', '休場開始日は YYYY-MM-DD 形式で正しい日付を入力してください');
      return;
    }
    if (leaveEndNorm && !isValidYyyyMmDd(leaveEndNorm)) {
      showStatus('error', '休場終了日は YYYY-MM-DD 形式で正しい日付を入力してください');
      return;
    }
    if (leaveStartNorm && leaveEndNorm && leaveStartNorm > leaveEndNorm) {
      showStatus('error', '休場開始日は休場終了日以前の日付を指定してください');
      return;
    }
    if (nameChangeDateNorm && !isValidYyyyMmDd(nameChangeDateNorm)) {
      showStatus('error', '改正年月日は YYYY-MM-DD 形式で正しい日付を入力してください');
      return;
    }
    if (retirementDateNorm && !isValidYyyyMmDd(retirementDateNorm)) {
      showStatus('error', '引退年月日は YYYY-MM-DD 形式で正しい日付を入力してください');
      return;
    }

    const trimmedOld = profileOldName.trim();
    const trimmedNew = profileNewName.trim();
    if ((trimmedOld && !trimmedNew) || (!trimmedOld && trimmedNew)) {
      showStatus('error', '氏名変更記録を登録する場合は「旧氏名」と「新氏名」の両方を入力してください');
      return;
    }

    const trimmedRank = (editingProfile.rank || '').trim();
    if (/^[一二三四五六七八九]段$|^女流[1-2１-２]級$|^女流[初一二三四五六七八]段$/.test(trimmedRank)) {
      showStatus(
        'error',
        '「称号」には永世・名誉資格など段位以外の称号を登録してください（段位は「公式段位」で選択してください）'
      );
      return;
    }

    if (!editingProfile.danRank) {
      showStatus('error', '公式段位を選択してください');
      return;
    }

    try {
      setIsBusy(true);
      const calcRate = (w: number, l: number) =>
        w + l > 0 ? Math.round((w / (w + l)) * 10000) / 10000 : 0;

      const parsedTitles = profileHeldTitlesInput
        .split(/[,、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const cw = Number(editingProfile.careerWins) || 0;
      const cl = Number(editingProfile.careerLosses) || 0;
      const yw = Number(editingProfile.currentYearWins) || 0;
      const yl = Number(editingProfile.currentYearLosses) || 0;

      const hasLeaveInput =
        profileLeaveEnabled ||
        Boolean(leaveStartNorm) ||
        Boolean(leaveEndNorm) ||
        Boolean(profileLeaveReason.trim());

      const leaveInfo: Player['leaveInfo'] = hasLeaveInput
        ? {
            isOnLeave: profileLeaveEnabled,
            ...(leaveStartNorm ? { startDate: leaveStartNorm } : {}),
            ...(leaveEndNorm ? { endDate: leaveEndNorm } : {}),
            ...(profileLeaveReason.trim() ? { reason: profileLeaveReason.trim() } : {}),
          }
        : { isOnLeave: false };

      const cleanedHighlights = (editingProfile.highlights || []).filter(
        (h) => !h.includes('休場')
      );
      const cleanedShortBio = (editingProfile.shortBio || '')
        .replace(/現在は休場中。?/g, '')
        .trim();

      const effectiveName = trimmedNew || editingProfile.name.trim();
      const effectiveFormerName =
        trimmedOld || (profileClearNameHistory ? '' : editingProfile.formerName || '');

      const payload: Record<string, any> = {
        ...editingProfile,
        name: effectiveName,
        formerName: effectiveFormerName,
        birthDate: birthDateNorm,
        retirementDate: retirementDateNorm,
        heldTitles: parsedTitles,
        careerWins: cw,
        careerLosses: cl,
        careerWinRate: calcRate(cw, cl),
        currentYearWins: yw,
        currentYearLosses: yl,
        currentYearWinRate: calcRate(yw, yl),
        highlights: cleanedHighlights,
        shortBio: cleanedShortBio,
        leaveInfo,
      };
      if (editingProfile.type === 'women' || isPlayerRetired(payload as Player)) {
        payload.ryuoClass = '';
      }
      if (isPlayerRetired(payload as Player)) {
        payload.junisenClass = '';
      }

      if (trimmedOld && trimmedNew) {
        payload.nameChange = {
          oldName: trimmedOld,
          newName: trimmedNew,
          changedAt: nameChangeDateNorm || new Date().toISOString().slice(0, 10),
          note: profileNameChangeNote.trim() || undefined,
        };
      } else if (profileClearNameHistory) {
        payload.nameChange = { clear: true };
      }

      const res = await adminFetch(`/api/admin/players/${encodeURIComponent(payload.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'プロフィール更新に失敗しました');

      const savedPlayer: Player = json.player;
      const savedBirthDateNorm = normalizeDateToYyyyMmDd(savedPlayer.birthDate || '');
      const savedAge = calculateAgeFromBirthDateString(savedBirthDateNorm);
      setEditingProfile({ ...savedPlayer, birthDate: savedBirthDateNorm });
      setProfileAge(savedAge !== null ? String(savedAge) : '');
      setProfileLeaveStart(normalizeDateToYyyyMmDd(savedPlayer.leaveInfo?.startDate || ''));
      setProfileLeaveEnd(normalizeDateToYyyyMmDd(savedPlayer.leaveInfo?.endDate || ''));
      setProfileRetirementDate(normalizeDateToYyyyMmDd(savedPlayer.retirementDate || ''));
      if (trimmedOld && trimmedNew) {
        setProfileOldName('');
        setProfileNewName('');
        setProfileNameChangeDate('');
        setProfileNameChangeNote('');
      }
      setProfileClearNameHistory(false);
      await loadAdminData();
      await onDatabaseUpdated();
      const currentlyOnLeave = isPlayerOnLeave(savedPlayer);
      const currentlyRetired = isPlayerRetired(savedPlayer);
      const statusBadges: string[] = [];
      if (savedPlayer.danRank) statusBadges.push(`段位: ${savedPlayer.danRank}`);
      if (savedPlayer.rank) statusBadges.push(`称号: ${savedPlayer.rank}`);
      if (json.validated) statusBadges.push('SQLiteテーブル反映検証済');
      if (currentlyRetired) statusBadges.push('引退バッジ適用中');
      if (currentlyOnLeave) statusBadges.push('休場バッジ適用中');
      if (trimmedOld && trimmedNew) statusBadges.push(`氏名変更記録: ${trimmedOld} → ${trimmedNew}`);
      showStatus(
        'success',
        `${savedPlayer.name} のプロフィールを更新しました${
          statusBadges.length > 0 ? `（${statusBadges.join(' / ')}）` : ''
        }`
      );
    } catch (err: any) {
      showStatus('error', err?.message || 'プロフィール更新エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRelinkNames = async () => {
    try {
      setIsBusy(true);
      const res = await adminFetch('/api/admin/relink-names', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '再紐付けに失敗しました');
      await loadAdminData();
      await onDatabaseUpdated();
      const s = json.summary;
      showStatus(
        'success',
        `改姓・旧姓データの反映と過去対局IDの再紐付けが完了しました（アーカイブ対局: ${s.relinkedArchiveMatchesCount}局, 公式対局予定: ${s.relinkedUpcomingMatchesCount}件）`
      );
    } catch (err: any) {
      showStatus('error', err?.message || '再紐付けエラー');
    } finally {
      setIsBusy(false);
    }
  };

  const startEditArchiveResult = (r: ShogiMonthlyResult) => {
    setEditingArchiveResult(r);
    setEditingArchiveOrigMonth(r.month || selectedArchiveMonth);
    setNewResDate(r.date);
    setNewResTournament(r.tournament || '公式戦');
    setNewResSente(r.sente);
    setNewResGote(r.gote);
    if (r.senteMark === '○' || r.senteMark === '□' || r.winner === r.sente) {
      setNewResWinner('sente');
    } else if (r.goteMark === '○' || r.goteMark === '□' || r.winner === r.gote) {
      setNewResWinner('gote');
    } else {
      setNewResWinner('undecided');
    }
    setNewResNote(r.note || '');
  };

  const resetArchiveResultForm = () => {
    setEditingArchiveResult(null);
    setEditingArchiveOrigMonth(null);
    setNewResSente('');
    setNewResGote('');
    setNewResNote('');
    setNewResWinner('sente');
  };

  const handleSaveArchiveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResDate || !newResSente.trim() || !newResGote.trim()) return;
    try {
      setIsBusy(true);
      const month = newResDate.replace(/[^0-9]/g, '').slice(0, 6);
      const senteClean = newResSente.trim();
      const goteClean = newResGote.trim();
      const senteP = players.find((p) => p.name.replace(/\s+/g, '') === senteClean.replace(/\s+/g, ''));
      const goteP = players.find((p) => p.name.replace(/\s+/g, '') === goteClean.replace(/\s+/g, ''));
      const winner =
        newResWinner === 'sente' ? senteClean : newResWinner === 'gote' ? goteClean : '';
      const loser =
        newResWinner === 'sente' ? goteClean : newResWinner === 'gote' ? senteClean : '';
      const isWomen = senteP?.type === 'women' || goteP?.type === 'women' || newResTournament.includes('女流');

      const resultObj: ShogiMonthlyResult = {
        ...(editingArchiveResult || {}),
        id: editingArchiveResult?.id || `db-res-${Date.now()}`,
        date: newResDate,
        month,
        sente: senteClean,
        gote: goteClean,
        senteRaw: senteClean,
        goteRaw: goteClean,
        sentePlayerId: senteP?.id,
        gotePlayerId: goteP?.id,
        senteMark: newResWinner === 'sente' ? '○' : newResWinner === 'gote' ? '●' : '',
        goteMark: newResWinner === 'gote' ? '○' : newResWinner === 'sente' ? '●' : '',
        winner,
        loser,
        winnerId: newResWinner === 'sente' ? senteP?.id : newResWinner === 'gote' ? goteP?.id : undefined,
        loserId: newResWinner === 'sente' ? goteP?.id : newResWinner === 'gote' ? senteP?.id : undefined,
        resultType: editingArchiveResult?.resultType || 'normal',
        tournament: newResTournament.trim() || '公式戦',
        note: newResNote.trim(),
        isWomen,
        category: isWomen ? '女流棋戦' : '一般棋戦',
        links: editingArchiveResult?.links?.length
          ? editingArchiveResult.links
          : [{ title: '日本将棋連盟公式', url: `https://www.shogi.or.jp/game/?month=${month}` }],
        sourceUrl: editingArchiveResult?.sourceUrl || `https://www.shogi.or.jp/game/?month=${month}`,
      };

      // If edited result moved to a different month, remove from old month first
      if (editingArchiveResult && editingArchiveOrigMonth && editingArchiveOrigMonth !== month) {
        await adminFetch(
          `/api/admin/results/${encodeURIComponent(editingArchiveOrigMonth)}/${encodeURIComponent(editingArchiveResult.id)}`,
          { method: 'DELETE' }
        );
      }

      const res = await adminFetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultObj),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録失敗');

      const wasEditing = Boolean(editingArchiveResult);
      resetArchiveResultForm();
      setSelectedArchiveMonth(month);
      await loadArchiveMonth(month);
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `${month} の対局結果を${wasEditing ? '更新' : '追加'}しました`);
    } catch (err: any) {
      showStatus('error', err?.message || '対局結果保存エラー');
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
      setConfirmDeleteResultId(null);
      if (editingArchiveResult?.id === id) resetArchiveResultForm();
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

  const startEditMatch = (m: Match) => {
    setEditingMatch(m);
    setNewMatchDate(m.date);
    setNewMatchTime(m.time || '10:00');
    setNewMatchTournament(m.tournament || '');
    setNewMatchRound(m.round || '');
    setNewMatchVenue(m.venue || '東京・将棋会館');
    setNewMatchP1(playerMap.get(m.player1Id)?.name || m.player1Id);
    setNewMatchP2(playerMap.get(m.player2Id)?.name || m.player2Id);
    setNewMatchStatus(m.status || 'upcoming');
    if (m.winnerId && m.winnerId === m.player1Id) {
      setNewMatchWinnerSide('p1');
    } else if (m.winnerId && m.winnerId === m.player2Id) {
      setNewMatchWinnerSide('p2');
    } else {
      setNewMatchWinnerSide('none');
    }
  };

  const resetMatchForm = () => {
    setEditingMatch(null);
    setNewMatchDate(new Date().toISOString().slice(0, 10));
    setNewMatchTime('10:00');
    setNewMatchTournament('');
    setNewMatchRound('');
    setNewMatchP1('');
    setNewMatchP2('');
    setNewMatchVenue('東京・将棋会館');
    setNewMatchStatus('upcoming');
    setNewMatchWinnerSide('none');
  };

  const handleSaveMatchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchDate || !newMatchTournament.trim() || !newMatchP1.trim() || !newMatchP2.trim()) return;
    try {
      setIsBusy(true);
      const p1Clean = newMatchP1.trim();
      const p2Clean = newMatchP2.trim();
      const p1 = players.find((p) => p.name.replace(/\s+/g, '') === p1Clean.replace(/\s+/g, '') || p.id === p1Clean);
      const p2 = players.find((p) => p.name.replace(/\s+/g, '') === p2Clean.replace(/\s+/g, '') || p.id === p2Clean);
      const isWomen = p1?.type === 'women' || p2?.type === 'women' || newMatchTournament.includes('女流');

      const p1Id = p1?.id || p1Clean;
      const p2Id = p2?.id || p2Clean;
      const winnerId =
        newMatchWinnerSide === 'p1' ? p1Id : newMatchWinnerSide === 'p2' ? p2Id : undefined;
      const resolvedStatus = winnerId ? 'finished' : newMatchStatus;

      const matchObj: Match = {
        ...(editingMatch || {}),
        id: editingMatch?.id || `db-match-${Date.now()}`,
        tournament: newMatchTournament.trim(),
        category: isWomen ? '女流棋戦' : (editingMatch?.category || '一般棋戦'),
        round: newMatchRound.trim() || '公式戦',
        date: newMatchDate,
        time: newMatchTime || '10:00',
        player1Id: p1Id,
        player2Id: p2Id,
        sentePlayerId: p1?.id || editingMatch?.sentePlayerId,
        gotePlayerId: p2?.id || editingMatch?.gotePlayerId,
        status: resolvedStatus,
        winnerId,
        venue: newMatchVenue.trim() || '東京・将棋会館',
        timeControl: editingMatch?.timeControl || '',
        broadcast: editingMatch?.broadcast || [],
        kifuUrl: editingMatch?.kifuUrl || `https://shogidb2.com/search?q=${encodeURIComponent(`${p1Clean} ${p2Clean}`)}`,
        kifuMoves: editingMatch?.kifuMoves || [],
        highlights: `${p1?.name || p1Clean} 対 ${p2?.name || p2Clean}（${newMatchTournament.trim()}）`,
      };

      const res = await adminFetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchObj),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録失敗');

      const wasEditing = Boolean(editingMatch);
      resetMatchForm();
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `公式対局予定をSQLite DBに${wasEditing ? '更新' : '追加'}しました`);
    } catch (err: any) {
      showStatus('error', err?.message || '予定保存エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteMatchSchedule = async (id: string) => {
    try {
      setIsBusy(true);
      const res = await adminFetch(`/api/admin/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('削除失敗');
      setConfirmDeleteMatchId(null);
      if (editingMatch?.id === id) resetMatchForm();
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', '対局予定を削除しました');
    } catch (err: any) {
      showStatus('error', err?.message || '削除エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const findPlayerByName = (rawName: string): Player | undefined => {
    const cleaned = rawName.trim().replace(/\s+/g, '');
    if (!cleaned) return undefined;
    const norm = normalizeShogiPlayerNameForMatch(cleaned);
    return (
      players.find((p) => p.name.replace(/\s+/g, '') === cleaned) ||
      players.find((p) => p.formerName && p.formerName.replace(/\s+/g, '') === cleaned) ||
      players.find((p) => normalizeShogiPlayerNameForMatch(p.name) === norm) ||
      players.find((p) => p.formerName && normalizeShogiPlayerNameForMatch(p.formerName) === norm)
    );
  };

  const classifyMatchResult = (
    tournament: string,
    senteP?: Player,
    goteP?: Player
  ): { isWomen: boolean; category: ShogiMonthlyResult['category'] } => {
    let category: ShogiMonthlyResult['category'] = '一般棋戦';
    if (
      tournament.includes('女流王座') ||
      tournament.includes('白玲') ||
      tournament.includes('女流名人') ||
      tournament.includes('女流王将') ||
      tournament.includes('女流王位') ||
      tournament.includes('清麗') ||
      tournament.includes('女王') ||
      tournament.includes('倉敷藤花')
    ) {
      category = '女流タイトル戦';
    } else if (tournament.includes('女流') || senteP?.type === 'women' || goteP?.type === 'women') {
      category = '女流棋戦';
    } else if (
      tournament.includes('竜王戦') ||
      tournament.includes('名人戦') ||
      tournament.includes('王位戦') ||
      tournament.includes('叡王戦') ||
      tournament.includes('王座戦') ||
      tournament.includes('棋王戦') ||
      tournament.includes('王将戦') ||
      tournament.includes('棋聖戦')
    ) {
      category = 'タイトル戦';
    } else if (tournament.includes('順位戦')) {
      category = '順位戦';
    }
    const isWomen =
      category === '女流タイトル戦' ||
      category === '女流棋戦' ||
      senteP?.type === 'women' ||
      goteP?.type === 'women' ||
      tournament.includes('女流');
    return { isWomen, category };
  };

  const handleClearManualInput = () => {
    setManualDate('');
    setManualTournament('');
    setManualSente('');
    setManualGote('');
    setManualWinner('');
    setManualNote('');
  };

  const handleSubmitManualInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate || !manualTournament.trim() || !manualSente.trim() || !manualGote.trim() || !manualWinner) {
      showStatus('error', '対局日・棋戦名・先手・後手・勝者をすべて入力してください');
      return;
    }
    try {
      setIsBusy(true);
      const month = manualDate.replace(/[^0-9]/g, '').slice(0, 6);
      const senteP = findPlayerByName(manualSente);
      const goteP = findPlayerByName(manualGote);
      const senteName = senteP?.name || manualSente.trim();
      const goteName = goteP?.name || manualGote.trim();
      const tournamentName = manualTournament.trim();
      const { isWomen, category } = classifyMatchResult(tournamentName, senteP, goteP);

      const winner =
        manualWinner === 'sente' ? senteName : manualWinner === 'gote' ? goteName : '';
      const loser =
        manualWinner === 'sente' ? goteName : manualWinner === 'gote' ? senteName : '';

      const newResult: ShogiMonthlyResult = {
        id: `db-manual-${Date.now()}`,
        date: manualDate,
        month,
        sente: senteName,
        gote: goteName,
        senteRaw: senteName,
        goteRaw: goteName,
        sentePlayerId: senteP?.id,
        gotePlayerId: goteP?.id,
        senteMark: manualWinner === 'sente' ? '○' : manualWinner === 'gote' ? '●' : '',
        goteMark: manualWinner === 'gote' ? '○' : manualWinner === 'sente' ? '●' : '',
        winner,
        loser,
        winnerId: manualWinner === 'sente' ? senteP?.id : manualWinner === 'gote' ? goteP?.id : undefined,
        loserId: manualWinner === 'sente' ? goteP?.id : manualWinner === 'gote' ? senteP?.id : undefined,
        resultType: 'normal',
        tournament: tournamentName,
        note: manualNote.trim(),
        isWomen,
        category,
        links: [{ title: '日本将棋連盟公式', url: `https://www.shogi.or.jp/game/?month=${month}` }],
        sourceUrl: `https://www.shogi.or.jp/game/?month=${month}`,
        entrySource: 'manual',
        isProtected: true,
      };

      const res = await adminFetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResult),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '登録に失敗しました');

      handleClearManualInput();
      if (activeTab === 'archives' || selectedArchiveMonth === month) {
        await loadArchiveMonth(month);
      }
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus('success', `${manualDate}「${senteName} vs ${goteName}」をSQLite DBへ手動登録しました`);
    } catch (err: any) {
      showStatus('error', err?.message || '対局手動登録エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let decoded = '';
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        decoded = new TextDecoder('shift-jis').decode(bytes);
      }
      decoded = decoded.replace(/^\uFEFF/, '');
      setCsvInputText(decoded);
      setCsvImportSummary(null);
      showStatus('success', `CSVファイル「${file.name}」を読み込みました`);
    } catch (err: any) {
      showStatus('error', `CSV読み込みエラー: ${err?.message || err}`);
    }
  };

  const parseCsvRowFields = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const normalizeCsvDate = (raw: string): string | null => {
    const s = raw.trim();
    const m = s.match(/^(\d{4})[\/\-年\.](\d{1,2})[\/\-月\.](\d{1,2})日?$/);
    if (!m) return null;
    const yyyy = m[1];
    const mm = String(parseInt(m[2], 10)).padStart(2, '0');
    const dd = String(parseInt(m[3], 10)).padStart(2, '0');
    const monthNum = parseInt(mm, 10);
    const dayNum = parseInt(dd, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvInputText.trim()) return;
    try {
      setIsBusy(true);
      const lines = csvInputText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const parsedResults: ShogiMonthlyResult[] = [];
      const errors: string[] = [];
      let skipped = 0;
      const seenCsvKeys = new Map<string, number>();

      lines.forEach((line, idx) => {
        const cols = parseCsvRowFields(line);
        // Skip header row
        if (
          idx === 0 &&
          (cols[0]?.includes('年月日') || cols[0]?.includes('対局日') || cols[0]?.toLowerCase() === 'date')
        ) {
          return;
        }
        if (cols.length < 5) {
          skipped++;
          errors.push(`${idx + 1}行目: 列数が不足しています（最低5列必要）`);
          return;
        }

        const [dateRaw, tournamentRaw, senteRaw, goteRaw, winnerRaw, ...noteParts] = cols;
        const isoDate = normalizeCsvDate(dateRaw);
        if (!isoDate) {
          skipped++;
          errors.push(`${idx + 1}行目: 日付形式が不正です (${dateRaw})`);
          return;
        }

        const tournament = (tournamentRaw || '公式戦').trim();
        const senteP = findPlayerByName(senteRaw);
        const goteP = findPlayerByName(goteRaw);
        const senteName = senteP?.name || senteRaw.trim();
        const goteName = goteP?.name || goteRaw.trim();

        if (!senteName || !goteName) {
          skipped++;
          errors.push(`${idx + 1}行目: 先手または後手の棋士名が空です`);
          return;
        }

        const normSente = normalizeShogiPlayerNameForMatch(senteName);
        const normGote = normalizeShogiPlayerNameForMatch(goteName);
        const normWinner = normalizeShogiPlayerNameForMatch(winnerRaw || '');

        let side: 'sente' | 'gote' | 'undecided' = 'undecided';
        if (!winnerRaw || winnerRaw === '未定' || winnerRaw === '-') {
          side = 'undecided';
        } else if (
          normWinner === normSente ||
          (senteRaw.trim() && normWinner === normalizeShogiPlayerNameForMatch(senteRaw))
        ) {
          side = 'sente';
        } else if (
          normWinner === normGote ||
          (goteRaw.trim() && normWinner === normalizeShogiPlayerNameForMatch(goteRaw))
        ) {
          side = 'gote';
        } else {
          skipped++;
          errors.push(`${idx + 1}行目: 勝者名「${winnerRaw}」が先手(${senteName})・後手(${goteName})と一致しません`);
          return;
        }

        const month = isoDate.replace(/[^0-9]/g, '').slice(0, 6);
        const note = noteParts.join(',').trim();
        const { isWomen, category } = classifyMatchResult(tournament, senteP, goteP);
        const winner = side === 'sente' ? senteName : side === 'gote' ? goteName : '';
        const loser = side === 'sente' ? goteName : side === 'gote' ? senteName : '';

        const baseKey = `csv-${isoDate}-${normSente}-${normGote}`;
        const occ = (seenCsvKeys.get(baseKey) || 0) + 1;
        seenCsvKeys.set(baseKey, occ);
        const stableCsvId = occ === 1 ? baseKey : `${baseKey}-${occ}`;

        parsedResults.push({
          id: stableCsvId,
          date: isoDate,
          month,
          sente: senteName,
          gote: goteName,
          senteRaw: senteRaw.trim(),
          goteRaw: goteRaw.trim(),
          sentePlayerId: senteP?.id,
          gotePlayerId: goteP?.id,
          senteMark: side === 'sente' ? '○' : side === 'gote' ? '●' : '',
          goteMark: side === 'gote' ? '○' : side === 'sente' ? '●' : '',
          winner,
          loser,
          winnerId: side === 'sente' ? senteP?.id : side === 'gote' ? goteP?.id : undefined,
          loserId: side === 'sente' ? goteP?.id : side === 'gote' ? senteP?.id : undefined,
          resultType: 'normal',
          tournament,
          note,
          isWomen,
          category,
          links: [{ title: '日本将棋連盟公式', url: `https://www.shogi.or.jp/game/?month=${month}` }],
          sourceUrl: `https://www.shogi.or.jp/game/?month=${month}`,
          entrySource: 'csv',
          isProtected: true,
        });
      });

      if (parsedResults.length === 0) {
        setCsvImportSummary({ imported: 0, skipped, errors });
        showStatus('error', '有効なCSV対局データが見つかりませんでした');
        return;
      }

      const res = await adminFetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: parsedResults }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'CSV一括登録に失敗しました');

      setCsvImportSummary({ imported: parsedResults.length, skipped, errors });
      await loadAdminData();
      await onDatabaseUpdated();
      showStatus(
        'success',
        `CSVから ${parsedResults.length}件 の対局結果をSQLite DBへ一括登録しました${skipped > 0 ? `（スキップ: ${skipped}件）` : ''}`
      );
    } catch (err: any) {
      showStatus('error', err?.message || 'CSV一括登録エラー');
    } finally {
      setIsBusy(false);
    }
  };

  const filteredMatches = useMemo(() => {
    const q = matchQuery.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return matches;
    return matches.filter((m) => {
      const p1Name = players.find((p) => p.id === m.player1Id)?.name || m.player1Id;
      const p2Name = players.find((p) => p.id === m.player2Id)?.name || m.player2Id;
      const str = `${m.date} ${m.tournament} ${m.round || ''} ${p1Name} ${p2Name} ${m.venue || ''}`
        .toLowerCase()
        .replace(/\s+/g, '');
      return str.includes(q);
    });
  }, [matches, matchQuery, players]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-5 touch-none"
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100 touch-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
                { id: 'players', label: '棋士プロフィール・改姓', icon: Users },
                { id: 'archives', label: '2021-2026 対局結果', icon: Trophy },
                { id: 'manual_input', label: '対局手動入力', icon: PlusCircle },
                { id: 'csv_import', label: 'CSVインポート', icon: FileSpreadsheet },
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
              <datalist id="admin-players-datalist">
                {players.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>

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

                  {/* FY2021-2026 Breakdown & Rebuild Actions */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-100">
                          年度別 対局アーカイブ収録状況（2021年度〜2026年度）
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          手動入力・CSVインポート登録対局（保護済み）を保持したまま、連盟公式データを再構築・個別更新できます。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRebuildAllArchives([2021, 2022, 2023, 2024, 2025, 2026])}
                        disabled={isBusy}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-md"
                      >
                        <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
                        <span>2021〜2026年度 対局情報を再構築</span>
                      </button>
                    </div>

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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleSyncPlayersOnly}
                        disabled={isBusy}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-700 hover:border-amber-400 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                      >
                        <Users size={14} className="text-amber-400" />
                        <span>棋士・女流プロフィール更新</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
                          handleSyncArchiveMonth(ym);
                        }}
                        disabled={isBusy}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                      >
                        <Trophy size={14} className="text-emerald-400" />
                        <span>今月の最新対局結果を更新</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSyncMatchesOnly}
                        disabled={isBusy}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-700 hover:border-sky-400 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                      >
                        <Calendar size={14} className="text-sky-400" />
                        <span>公式対局予定を更新</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PLAYERS & NAME HISTORY */}
              {activeTab === 'players' && (
                <div className="space-y-5 min-h-[340px]">
                  {/* Player Profile & Leave Update Tool */}
                  <div className="bg-zinc-900/80 border border-sky-500/30 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2">
                          <Pencil size={15} />
                          <span>棋士・女流棋士プロフィール更新処理（改名・休場・引退情報設定）</span>
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {editingProfile
                            ? 'プロフィール・改名記録（旧氏名・新氏名・改正年月日）・休場期間・引退年月日を編集して保存できます'
                            : '更新対象の棋士・女流棋士を全棋士・女流棋士名鑑と同じ検索・絞り込み画面から選択してください'}
                        </p>
                      </div>
                      {editingProfile && (
                        <button
                          type="button"
                          onClick={clearProfileSelection}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 cursor-pointer transition"
                        >
                          <ArrowLeft size={13} />
                          <span>棋士一覧（名鑑）に戻る</span>
                        </button>
                      )}
                    </div>

                    {!editingProfile && (
                      <PlayerDirectory
                        players={players}
                        followedList={followedList}
                        mode="select"
                        onSelectPlayer={selectPlayerForProfileEdit}
                      />
                    )}

                    {editingProfile && (
                      <form onSubmit={handleSaveProfileUpdate} className="space-y-4 pt-3 border-t border-zinc-800">
                        {/* Selected Player Summary Header */}
                        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black font-serif-jp shadow border border-white/20 text-amber-400 shrink-0 overflow-hidden"
                              style={{ backgroundColor: editingProfile.type === 'women' ? '#ec4899' : '#3b82f6' }}
                            >
                              {editingProfile.photoUrl ? (
                                <img
                                  src={editingProfile.photoUrl}
                                  alt={editingProfile.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                editingProfile.name[0]
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    editingProfile.type === 'women'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {editingProfile.type === 'women' ? '女流棋士' : '棋士'} No.{editingProfile.playerNumber ?? '-'}
                                </span>
                                {isPlayerRetired(editingProfile) && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-200 border border-zinc-500/80">
                                    引退
                                  </span>
                                )}
                                {isPlayerOnLeave(editingProfile) && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    休場
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                                <span className="text-base font-black text-zinc-100 font-serif-jp">
                                  {formatPlayerName(editingProfile.name)}
                                </span>
                                <span className="text-xs font-bold text-amber-400 font-serif-jp">
                                  {formatPlayerRankAndDan(editingProfile)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Basic Profile Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">氏名 *</label>
                            <input
                              type="text"
                              required
                              value={editingProfile.name}
                              onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">区分</label>
                            <select
                              value={editingProfile.type}
                              onChange={(e) => {
                                const nextType = e.target.value as 'pro' | 'women';
                                let nextDan = editingProfile.danRank || '';
                                if (nextType === 'pro' && !PRO_DAN_RANKS.includes(nextDan as any)) {
                                  nextDan = '四段';
                                } else if (nextType === 'women' && !WOMEN_DAN_RANKS.includes(nextDan as any)) {
                                  nextDan = '女流初段';
                                }
                                setEditingProfile({
                                  ...editingProfile,
                                  type: nextType,
                                  danRank: nextDan,
                                  ...(nextType === 'women' ? { ryuoClass: '' } : {}),
                                });
                              }}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            >
                              <option value="pro">棋士</option>
                              <option value="women">女流棋士</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">所属</label>
                            <select
                              value={editingProfile.affiliation || '日本将棋連盟'}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  affiliation: e.target.value as any,
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            >
                              <option value="日本将棋連盟">日本将棋連盟</option>
                              <option value="LPSA">LPSA</option>
                              <option value="無所属">無所属</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">称号</label>
                            <input
                              type="text"
                              placeholder="例: 永世名人、名誉王座 など"
                              value={editingProfile.rank || ''}
                              onChange={(e) => setEditingProfile({ ...editingProfile, rank: e.target.value })}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">公式段位</label>
                            <select
                              value={editingProfile.danRank || ''}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, danRank: e.target.value })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none font-medium"
                            >
                              <option value="">段位を選択</option>
                              {((editingProfile.type === 'women' ? WOMEN_DAN_RANKS : PRO_DAN_RANKS) as readonly string[]).map((rank) => (
                                <option key={rank} value={rank}>
                                  {rank}
                                </option>
                              ))}
                              {editingProfile.danRank &&
                                !((editingProfile.type === 'women' ? WOMEN_DAN_RANKS : PRO_DAN_RANKS) as readonly string[]).includes(
                                  editingProfile.danRank
                                ) && (
                                  <option value={editingProfile.danRank}>
                                    {editingProfile.danRank}
                                  </option>
                                )}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">棋士番号 / 女流番号</label>
                            <input
                              type="number"
                              value={editingProfile.playerNumber ?? ''}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  playerNumber: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">戦型</label>
                            <select
                              value={editingProfile.style || '居飛車'}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, style: e.target.value as any })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            >
                              <option value="居飛車">居飛車</option>
                              <option value="振り飛車">振り飛車</option>
                              <option value="オールラウンダー">オールラウンダー</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              {editingProfile.type === 'women' ? '女流順位戦クラス' : '順位戦クラス'}
                            </label>
                            <input
                              type="text"
                              value={
                                isPlayerRetired({
                                  ...editingProfile,
                                  retirementDate: profileRetirementDate.trim() || editingProfile.retirementDate,
                                })
                                  ? ''
                                  : editingProfile.junisenClass
                              }
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, junisenClass: e.target.value })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">竜王戦クラス</label>
                            <input
                              type="text"
                              disabled={
                                editingProfile.type === 'women' ||
                                isPlayerRetired({
                                  ...editingProfile,
                                  retirementDate: profileRetirementDate.trim() || editingProfile.retirementDate,
                                })
                              }
                              value={
                                editingProfile.type === 'women' ||
                                isPlayerRetired({
                                  ...editingProfile,
                                  retirementDate: profileRetirementDate.trim() || editingProfile.retirementDate,
                                })
                                  ? ''
                                  : editingProfile.ryuoClass || ''
                              }
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, ryuoClass: e.target.value })
                              }
                              placeholder={editingProfile.type === 'women' ? '（女流棋士は対象外）' : '例: 1組〜6組'}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none disabled:bg-zinc-900/80 disabled:text-zinc-500 disabled:border-zinc-800 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">保持タイトル (読点区切り)</label>
                            <input
                              type="text"
                              value={profileHeldTitlesInput}
                              onChange={(e) => setProfileHeldTitlesInput(e.target.value)}
                              placeholder="例: 竜王、名人"
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">タイトル獲得合計</label>
                            <input
                              type="number"
                              value={editingProfile.totalTitles}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  totalTitles: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">今年度 勝</label>
                            <input
                              type="number"
                              value={editingProfile.currentYearWins}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  currentYearWins: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">今年度 敗</label>
                            <input
                              type="number"
                              value={editingProfile.currentYearLosses}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  currentYearLosses: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">通算 勝</label>
                            <input
                              type="number"
                              value={editingProfile.careerWins}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  careerWins: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">通算 敗</label>
                            <input
                              type="number"
                              value={editingProfile.careerLosses}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  careerLosses: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">生年月日 (YYYY-MM-DD)</label>
                            <input
                              type="text"
                              value={editingProfile.birthDate || ''}
                              placeholder="YYYY-MM-DD"
                              onChange={(e) => {
                                const formatted = autoFormatDateOnChange(e.target.value);
                                setEditingProfile({ ...editingProfile, birthDate: formatted });
                                if (!formatted.trim()) {
                                  setProfileAge('');
                                } else {
                                  const computed = calculateAgeFromBirthDateString(formatted);
                                  if (computed !== null) {
                                    setProfileAge(String(computed));
                                  }
                                }
                              }}
                              onBlur={() => {
                                const normalized = normalizeDateToYyyyMmDd(editingProfile.birthDate || '');
                                if (normalized !== (editingProfile.birthDate || '')) {
                                  setEditingProfile({ ...editingProfile, birthDate: normalized });
                                }
                                const computed = calculateAgeFromBirthDateString(normalized);
                                setProfileAge(computed !== null ? String(computed) : '');
                              }}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">年齢</label>
                            <input
                              type="text"
                              readOnly
                              value={profileAge ? `${profileAge}歳` : ''}
                              placeholder="-"
                              title="生年月日から自動計算されます"
                              className="w-full bg-zinc-950/70 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none cursor-default"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">出身地</label>
                            <input
                              type="text"
                              value={editingProfile.birthPlace || ''}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, birthPlace: e.target.value })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">師匠</label>
                            <input
                              type="text"
                              value={editingProfile.master || ''}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, master: e.target.value })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">顔写真URL (photoUrl)</label>
                            <input
                              type="text"
                              value={editingProfile.photoUrl || ''}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  photoUrl: e.target.value || undefined,
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">短評・プロフィール紹介</label>
                          <input
                            type="text"
                            value={editingProfile.shortBio}
                            onChange={(e) =>
                              setEditingProfile({ ...editingProfile, shortBio: e.target.value })
                            }
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
                          />
                        </div>

                        {/* Leave Period Settings (休場情報) */}
                        <div className="bg-zinc-950/90 border border-amber-500/35 rounded-xl p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <PauseCircle size={15} />
                              <span>休場情報設定（休場期間中はプロフィールに「休場」バッジを表示）</span>
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileLeaveEnabled(false);
                                setProfileLeaveStart('');
                                setProfileLeaveEnd('');
                                setProfileLeaveReason('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Eraser size={12} />
                              <span>休場情報をクリア</span>
                            </button>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={profileLeaveEnabled}
                              onChange={(e) => setProfileLeaveEnabled(e.target.checked)}
                              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                            />
                            <span className="font-semibold">休場設定を有効にする</span>
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">休場開始日 (YYYY-MM-DD)</label>
                              <input
                                type="text"
                                value={profileLeaveStart}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => {
                                  const v = autoFormatDateOnChange(e.target.value);
                                  setProfileLeaveStart(v);
                                  if (v.trim()) setProfileLeaveEnabled(true);
                                }}
                                onBlur={() => setProfileLeaveStart((prev) => normalizeDateToYyyyMmDd(prev))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                休場終了日 (YYYY-MM-DD・未入力で継続中扱い)
                              </label>
                              <input
                                type="text"
                                value={profileLeaveEnd}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => {
                                  const v = autoFormatDateOnChange(e.target.value);
                                  setProfileLeaveEnd(v);
                                  if (v.trim()) setProfileLeaveEnabled(true);
                                }}
                                onBlur={() => setProfileLeaveEnd((prev) => normalizeDateToYyyyMmDd(prev))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">休場理由・備考（任意）</label>
                              <input
                                type="text"
                                value={profileLeaveReason}
                                onChange={(e) => setProfileLeaveReason(e.target.value)}
                                placeholder="例: 体調不良のため公式戦休場"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {(() => {
                            const previewPlayer: Player = {
                              ...editingProfile,
                              leaveInfo:
                                profileLeaveEnabled ||
                                profileLeaveStart ||
                                profileLeaveEnd ||
                                profileLeaveReason.trim()
                                  ? {
                                      isOnLeave: profileLeaveEnabled,
                                      startDate: profileLeaveStart || undefined,
                                      endDate: profileLeaveEnd || undefined,
                                      reason: profileLeaveReason.trim() || undefined,
                                    }
                                  : { isOnLeave: false },
                            };
                            const willShowBadge = isPlayerOnLeave(previewPlayer);
                            return (
                              <div className="flex items-center gap-2 text-[11px] pt-1">
                                <span className="text-zinc-400">現在の表示判定:</span>
                                {willShowBadge ? (
                                  <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/40 text-[10px] font-black">
                                      休場
                                    </span>
                                    <span>バッジを表示（{formatPlayerLeavePeriod(previewPlayer)}）</span>
                                  </span>
                                ) : profileLeaveEnabled && (profileLeaveStart || profileLeaveEnd) ? (
                                  <span className="text-zinc-400">
                                    指定期間外のため現在は通常表示（期間中のみ「休場」バッジ表示）
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">通常表示（休場バッジなし）</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Name Change History Settings (旧氏名・新氏名・改正年月日) */}
                        <div className="bg-zinc-950/90 border border-sky-500/35 rounded-xl p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                              <UserCheck size={15} />
                              <span>氏名変更記録（旧氏名・新氏名・改正年月日／過去対局との紐付け維持）</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleRelinkNames}
                                disabled={isBusy}
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-sky-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="改姓前の旧氏名による過去対局記録を現在の棋士IDへ再紐付けします"
                              >
                                <RefreshCw size={11} className={isBusy ? 'animate-spin' : ''} />
                                <span>過去対局ID紐付け再実行</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleClearEditingNameChange}
                                disabled={isBusy}
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-zinc-700 hover:border-rose-500/40 text-[11px] text-zinc-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Eraser size={12} />
                                <span>氏名変更情報を消去</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">旧氏名</label>
                              <input
                                type="text"
                                value={profileOldName}
                                onChange={(e) => {
                                  setProfileOldName(e.target.value);
                                  setProfileClearNameHistory(false);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">新氏名</label>
                              <input
                                type="text"
                                value={profileNewName}
                                onChange={(e) => {
                                  setProfileNewName(e.target.value);
                                  setProfileClearNameHistory(false);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">改正年月日 (YYYY-MM-DD)</label>
                              <input
                                type="text"
                                value={profileNameChangeDate}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => setProfileNameChangeDate(autoFormatDateOnChange(e.target.value))}
                                onBlur={() => setProfileNameChangeDate((prev) => normalizeDateToYyyyMmDd(prev))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">備考（任意）</label>
                              <input
                                type="text"
                                value={profileNameChangeNote}
                                onChange={(e) => setProfileNameChangeNote(e.target.value)}
                                placeholder="例: 結婚による改姓"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {(() => {
                            const playerHist = nameHistory.filter((h) => h.playerId === editingProfile.id);
                            if (playerHist.length === 0) {
                              return (
                                <div className="text-[11px] text-zinc-500">
                                  登録済みの氏名変更履歴なし（旧氏名・新氏名・改正年月日を入力して保存すると履歴に記録されます）
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="text-zinc-400 font-bold">登録済み履歴:</span>
                                {playerHist.map((h) => (
                                  <span
                                    key={h.id}
                                    className="px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300"
                                  >
                                    <strong className="text-zinc-400">{h.oldName}</strong> →{' '}
                                    <strong className="text-sky-300">{h.newName}</strong>（改正日: {h.changedAt}）
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Retirement Settings (引退年月日) */}
                        <div className="bg-zinc-950/90 border border-zinc-600/60 rounded-xl p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                              <History size={15} className="text-zinc-400" />
                              <span>引退情報設定（年度途中の引退・プロフィールに「引退」バッジを表示）</span>
                            </h4>
                            <button
                              type="button"
                              onClick={() => setProfileRetirementDate('')}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Eraser size={12} />
                              <span>引退情報をクリア</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end text-xs">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">引退年月日 (YYYY-MM-DD)</label>
                              <input
                                type="text"
                                value={profileRetirementDate}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => setProfileRetirementDate(autoFormatDateOnChange(e.target.value))}
                                onBlur={() => setProfileRetirementDate((prev) => normalizeDateToYyyyMmDd(prev))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-zinc-400 focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-2 flex items-center gap-2 text-[11px] pb-1.5">
                              <span className="text-zinc-400">現在の表示判定:</span>
                              {(() => {
                                const previewRetiredPlayer: Player = {
                                  ...editingProfile,
                                  retirementDate: profileRetirementDate.trim() || undefined,
                                };
                                const willShowRetired = isPlayerRetired(previewRetiredPlayer);
                                if (willShowRetired) {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 text-zinc-200 font-bold">
                                      <span className="px-2 py-0.5 rounded-full bg-zinc-700 border border-zinc-500/80 text-[10px] font-black text-zinc-200">
                                        引退
                                      </span>
                                      <span>バッジを表示（{formatPlayerRetirementDate(previewRetiredPlayer)}）</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-zinc-400">
                                    {profileRetirementDate.trim()
                                      ? `指定日（${profileRetirementDate.trim().replace(/-/g, '/')}）以降に「引退」バッジを表示`
                                      : '現役表示（引退バッジなし）'}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Save size={14} />
                            <span>プロフィールをSQLite DBに更新保存</span>
                          </button>
                        </div>
                      </form>
                    )}
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

                    <div className="flex items-center gap-2 flex-wrap">
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
                      <button
                        type="button"
                        onClick={() => handleSyncArchiveMonth(selectedArchiveMonth)}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={isBusy ? 'animate-spin' : ''} />
                        <span>選択月を公式同期</span>
                      </button>
                    </div>
                  </div>

                  {/* Edit Existing Match Result (only shown when editing a row) */}
                  {editingArchiveResult && (
                    <form
                      onSubmit={handleSaveArchiveResult}
                      className="bg-zinc-900/80 border border-sky-500/50 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold flex items-center gap-1.5 text-sky-300">
                          <Pencil size={14} />
                          <span>
                            {`対局結果を編集中 (${editingArchiveResult.date} ${editingArchiveResult.sente} vs ${editingArchiveResult.gote})`}
                          </span>
                        </h4>
                        <button
                          type="button"
                          onClick={resetArchiveResultForm}
                          className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          キャンセル
                        </button>
                      </div>
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
                          list="admin-players-datalist"
                          value={newResSente}
                          onChange={(e) => setNewResSente(e.target.value)}
                          placeholder="先手氏名"
                          required
                          className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          list="admin-players-datalist"
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
                          <option value="undecided">勝敗未定</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="font-bold rounded-xl px-3 py-1.5 cursor-pointer disabled:opacity-50 bg-sky-500 hover:bg-sky-400 text-zinc-950"
                        >
                          更新保存
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newResNote}
                        onChange={(e) => setNewResNote(e.target.value)}
                        placeholder="備考・手数・千日手・詳細メモ（任意）"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </form>
                  )}

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
                      <div className="divide-y divide-zinc-800/70 max-h-[460px] overflow-y-auto">
                        {archiveMonthResults.map((r) => (
                          <div
                            key={r.id}
                            className="px-4 py-2 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900/60"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono text-zinc-400 mr-2">{r.date}</span>
                              {isProtectedMatchResult(r) && (
                                <span
                                  className="mr-2 px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                                  title="公式データ更新時も削除・上書きされません"
                                >
                                  {r.entrySource === 'csv' || String(r.id).startsWith('csv-') ? 'CSV保護' : '手動保護'}
                                </span>
                              )}
                              <span className="text-amber-300 font-bold mr-2">{r.tournament}</span>
                              <span className="text-zinc-100">
                                {r.senteMark} {r.sente} vs {r.gote} {r.goteMark}
                              </span>
                              {r.note && (
                                <span className="ml-2 text-zinc-500 text-[11px]">({r.note})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditArchiveResult(r)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <Pencil size={12} />
                                <span>編集</span>
                              </button>
                              {confirmDeleteResultId === r.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteArchiveResult(selectedArchiveMonth, r.id)}
                                    disabled={isBusy}
                                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer text-[11px]"
                                  >
                                    削除
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteResultId(null)}
                                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 cursor-pointer text-[11px]"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteResultId(r.id)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MANUAL MATCH INPUT TAB (対局手動入力機能) */}
              {activeTab === 'manual_input' && (
                <form
                  onSubmit={handleSubmitManualInput}
                  className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <PlusCircle size={16} />
                        <span>対局手動入力機能</span>
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        未登録の過去対局・公式対局結果を直接入力して SQLite データベースへ登録します
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearManualInput}
                      disabled={isBusy}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/70 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <Eraser size={14} />
                      <span>全項目削除</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1.5">対局日</label>
                      <input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1.5">棋戦名</label>
                      <input
                        type="text"
                        value={manualTournament}
                        onChange={(e) => setManualTournament(e.target.value)}
                        placeholder="例: NHK杯 / 銀河戦 / 順位戦"
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1.5">先手 棋士名</label>
                      <input
                        type="text"
                        list="admin-players-datalist"
                        value={manualSente}
                        onChange={(e) => setManualSente(e.target.value)}
                        placeholder="先手棋士名を入力"
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1.5">後手 棋士名</label>
                      <input
                        type="text"
                        list="admin-players-datalist"
                        value={manualGote}
                        onChange={(e) => setManualGote(e.target.value)}
                        placeholder="後手棋士名を入力"
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-2">勝者</label>
                      <div className="flex flex-wrap items-center gap-4 py-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
                          <input
                            type="radio"
                            name="manualWinner"
                            value="sente"
                            checked={manualWinner === 'sente'}
                            onChange={() => setManualWinner('sente')}
                            className="accent-amber-500"
                          />
                          <span>先手 ({manualSente.trim() || '先手'}) の勝利</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
                          <input
                            type="radio"
                            name="manualWinner"
                            value="gote"
                            checked={manualWinner === 'gote'}
                            onChange={() => setManualWinner('gote')}
                            className="accent-amber-500"
                          />
                          <span>後手 ({manualGote.trim() || '後手'}) の勝利</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
                          <input
                            type="radio"
                            name="manualWinner"
                            value="undecided"
                            checked={manualWinner === 'undecided'}
                            onChange={() => setManualWinner('undecided')}
                            className="accent-amber-500"
                          />
                          <span>勝敗未定</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1.5">対局詳細・備考</label>
                      <input
                        type="text"
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder="例: 本戦 1回戦 第17局 101手"
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleClearManualInput}
                      disabled={isBusy}
                      className="sm:w-44 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <Eraser size={14} />
                      <span>全項目削除</span>
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isBusy ||
                        !manualDate ||
                        !manualTournament.trim() ||
                        !manualSente.trim() ||
                        !manualGote.trim() ||
                        !manualWinner
                      }
                      className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm transition shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      この対局をデータベースに手動登録
                    </button>
                  </div>
                </form>
              )}

              {/* CSV IMPORT TAB (公式対局 CSV一括インポート機能) */}
              {activeTab === 'csv_import' && (
                <form
                  onSubmit={handleImportCsv}
                  className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4"
                >
                  <div>
                    <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <FileSpreadsheet size={16} />
                      <span>対局結果 CSV一括インポート機能</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      CSVデータの形式:{' '}
                      <strong className="text-amber-300">
                        年月日, 棋戦名, 先手棋士名, 後手棋士名, 勝者棋士名, 備考
                      </strong>{' '}
                      の順で貼り付けるか、CSVファイルを選択してください。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 hover:border-amber-400 text-xs font-bold text-zinc-200 cursor-pointer transition">
                      <Upload size={14} className="text-sky-400" />
                      <span>CSVファイルを選択 (Shift-JIS / UTF-8 自動判別)</span>
                      <input
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        onChange={handleSelectCsvFile}
                        disabled={isBusy}
                        className="hidden"
                      />
                    </label>
                    {csvInputText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCsvInputText('');
                          setCsvImportSummary(null);
                        }}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-semibold cursor-pointer"
                      >
                        入力クリア
                      </button>
                    )}
                  </div>

                  <textarea
                    value={csvInputText}
                    onChange={(e) => setCsvInputText(e.target.value)}
                    rows={8}
                    placeholder={
                      '2025/4/1,銀河戦,佐藤慎一,藤本渚,藤本渚,Bブロック\n2025/4/3,銀河戦,岡部怜央,野月浩貴,岡部怜央,Cブロック'
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl p-3.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none leading-relaxed"
                  />

                  <button
                    type="submit"
                    disabled={isBusy || !csvInputText.trim()}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm transition cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                  >
                    CSVデータを解析してデータベースへ一括登録
                  </button>

                  {csvImportSummary && (
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
                      <div className="flex items-center gap-4 font-bold">
                        <span className="text-emerald-400">登録成功: {csvImportSummary.imported}件</span>
                        {csvImportSummary.skipped > 0 && (
                          <span className="text-amber-400">スキップ: {csvImportSummary.skipped}件</span>
                        )}
                      </div>
                      {csvImportSummary.errors.length > 0 && (
                        <ul className="text-[11px] text-rose-300 space-y-0.5 max-h-28 overflow-y-auto pt-1">
                          {csvImportSummary.errors.slice(0, 15).map((err, i) => (
                            <li key={i}>・{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </form>
              )}

              {/* OFFICIAL MATCH SCHEDULES */}
              {activeTab === 'matches' && (
                <div className="space-y-4">

                  <form
                    onSubmit={handleSaveMatchSchedule}
                    className={`bg-zinc-900/80 border rounded-2xl p-4 space-y-3 ${
                      editingMatch ? 'border-amber-500/50' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold flex items-center gap-1.5 ${editingMatch ? 'text-amber-300' : 'text-sky-300'}`}>
                        {editingMatch ? <Pencil size={14} /> : <Plus size={14} />}
                        <span>
                          {editingMatch
                            ? `公式対局予定を編集 (${editingMatch.date} ${editingMatch.tournament})`
                            : '公式対局予定を追加 (matches テーブル)'}
                        </span>
                      </h4>
                      {editingMatch && (
                        <button
                          type="button"
                          onClick={resetMatchForm}
                          className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          キャンセル
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                        value={newMatchRound}
                        onChange={(e) => setNewMatchRound(e.target.value)}
                        placeholder="回戦・第○局"
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        list="admin-players-datalist"
                        value={newMatchP1}
                        onChange={(e) => setNewMatchP1(e.target.value)}
                        placeholder="対局者1氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        list="admin-players-datalist"
                        value={newMatchP2}
                        onChange={(e) => setNewMatchP2(e.target.value)}
                        placeholder="対局者2氏名"
                        required
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        value={newMatchVenue}
                        onChange={(e) => setNewMatchVenue(e.target.value)}
                        placeholder="対局場所"
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5"
                      />
                      <div className="flex gap-1.5">
                        <select
                          value={newMatchStatus}
                          onChange={(e) => setNewMatchStatus(e.target.value as any)}
                          className="w-1/2 bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5"
                        >
                          <option value="upcoming">予定</option>
                          <option value="live">対局中</option>
                          <option value="finished">終局</option>
                        </select>
                        <select
                          value={newMatchWinnerSide}
                          onChange={(e) => {
                            const val = e.target.value as 'none' | 'p1' | 'p2';
                            setNewMatchWinnerSide(val);
                            if (val !== 'none') setNewMatchStatus('finished');
                          }}
                          className="w-1/2 bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5"
                        >
                          <option value="none">勝者未定</option>
                          <option value="p1">1勝ち</option>
                          <option value="p2">2勝ち</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isBusy}
                        className={`font-bold rounded-xl px-4 py-1.5 text-xs cursor-pointer disabled:opacity-50 ${
                          editingMatch
                            ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                            : 'bg-sky-500 hover:bg-sky-400 text-zinc-950'
                        }`}
                      >
                        {editingMatch ? '対局予定を更新' : '予定登録'}
                      </button>
                    </div>
                  </form>

                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-200">
                        登録済み 公式対局予定 ({filteredMatches.length} / {matches.length}件)
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSyncMatchesOnly}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-sky-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isBusy ? 'animate-spin' : ''} />
                          <span>対局予定を公式更新</span>
                        </button>
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs">
                          <Search size={13} className="text-zinc-500" />
                          <input
                            type="text"
                            value={matchQuery}
                            onChange={(e) => setMatchQuery(e.target.value)}
                            placeholder="棋戦・対局者・日付で検索"
                            className="bg-transparent text-zinc-100 focus:outline-none w-44"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="divide-y divide-zinc-800/70 max-h-[340px] overflow-y-auto">
                      {filteredMatches.map((m) => {
                        const p1 = playerMap.get(m.player1Id)?.name || m.player1Id;
                        const p2 = playerMap.get(m.player2Id)?.name || m.player2Id;
                        const winnerName = m.winnerId
                          ? playerMap.get(m.winnerId)?.name || m.winnerId
                          : null;
                        return (
                          <div
                            key={m.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900/60"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono text-zinc-400 mr-2">
                                {m.date} {m.time}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold mr-2 ${
                                  m.status === 'finished'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : m.status === 'live'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                                    : 'bg-zinc-800 text-zinc-300'
                                }`}
                              >
                                {m.status === 'finished' ? '終局' : m.status === 'live' ? '対局中' : '予定'}
                              </span>
                              <span className="text-sky-300 font-bold mr-2">{m.tournament}</span>
                              <span className="text-zinc-100">
                                {p1} vs {p2}
                              </span>
                              {winnerName && (
                                <span className="ml-2 text-amber-300 text-[11px] font-bold">
                                  (勝: {winnerName})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditMatch(m)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <Pencil size={12} />
                                <span>編集</span>
                              </button>
                              {confirmDeleteMatchId === m.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMatchSchedule(m.id)}
                                    disabled={isBusy}
                                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer text-[11px]"
                                  >
                                    削除
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteMatchId(null)}
                                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 cursor-pointer text-[11px]"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMatchId(m.id)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
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
