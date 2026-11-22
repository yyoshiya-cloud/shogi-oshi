import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Player, Match, FollowedPlayerConfig, PushNotificationItem, ShogiMonthlyResult } from './types/shogi';
import { PLAYERS_DATA, MATCHES_DATA } from './data/shogiDatabase';
import {
  getStoredFollowed,
  saveStoredFollowed,
  getStoredNotifications,
  saveStoredNotifications,
  deleteStoredNotification,
  clearStoredNotifications,
  getStoredPlayers,
  saveStoredPlayers,
  getStoredLastSync,
  saveStoredLastSync,
  getStoredMatches,
  saveStoredMatches,
  getStoredMatchLastSync,
  saveStoredMatchLastSync,
  triggerPushNotification,
  deduplicateMatches,
  getStoredFiscalResults,
  replaceStoredFiscalResults
} from './utils/storage';
import { AndroidFrame } from './components/AndroidFrame';
import { isTodayOrResultNotification } from './utils/notificationFilter';
import { getTodayDateString } from './utils/dateUtils';
import { normalizeAndCleanPlayersList, registerDynamicNameHistory } from './utils/playerUtils';
import { initializePlayerRecords, updateMatchStatsData } from './utils/yearRecordsGenerator';
import { clearPlayerMatchCache } from './services/shogiDbMatchEnrichment';
import { OshiDashboard } from './components/OshiDashboard';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { PlayerDirectory } from './components/PlayerDirectory';
import { NotificationCenter } from './components/NotificationCenter';
import { MatchDetailModal } from './components/MatchDetailModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { AppInfoModal } from './components/AppInfoModal';
import { AdminDbModal } from './components/AdminDbModal';
import {
  Heart,
  Calendar,
  Users,
  Bell,
  Sparkles,
  X,
  RefreshCw,
  Database
} from 'lucide-react';

type TabType = 'dashboard' | 'calendar' | 'directory';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);

  useEffect(() => {
    if (showNotificationModal) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showNotificationModal]);
  const [playersList, setPlayersList] = useState<Player[]>(() => {
    // 起動時に2025・2026両年度の対局結果データをインデックス化
    updateMatchStatsData(getStoredFiscalResults());
    const stored = getStoredPlayers();
    return normalizeAndCleanPlayersList(stored, PLAYERS_DATA);
  });
  const [matchesList, setMatchesList] = useState<Match[]>(() => {
    const stored = getStoredMatches();
    if (stored && stored.length > 0) {
      const valid = stored.filter(
        (m) =>
          m &&
          m.id &&
          !m.id.startsWith('match-live-') &&
          !m.id.startsWith('match-up-') &&
          !m.id.startsWith('match-fin-')
      );
      if (valid.length > 0) return deduplicateMatches(valid);
    }
    return MATCHES_DATA;
  });
  const [followedList, setFollowedList] = useState<FollowedPlayerConfig[]>([]);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeHeadsUp, setActiveHeadsUp] = useState<PushNotificationItem | null>(null);
  const [calendarSubTab, setCalendarSubTab] = useState<'schedule' | 'results'>('schedule');

  const [showAppInfoModal, setShowAppInfoModal] = useState(false);
  const [showAdminDbModal, setShowAdminDbModal] = useState(false);

  // Integrated DB read-only sync state (Turso libSQL or local SQLite)
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getStoredLastSync());
  const [lastMatchSyncTime, setLastMatchSyncTime] = useState<string | null>(getStoredMatchLastSync());
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [dbBackendLabel, setDbBackendLabel] = useState<string>('統合DB');

  const hydrateFromSqliteDb = async (showToast = false): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/db/bootstrap', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data?.success) return { ok: false, error: data?.error || 'DB初期化に失敗しました' };

      const engineStr = String(data.overview?.engine || '');
      const resolvedLabel = engineStr.toLowerCase().includes('turso')
        ? 'Turso (libSQL)'
        : 'SQLite DB（data/shogi.db）';
      if (engineStr) {
        setDbBackendLabel(resolvedLabel);
      }

      if (Array.isArray(data.nameHistory)) {
        registerDynamicNameHistory(data.nameHistory);
      }

      if (data.fiscalResults && typeof data.fiscalResults === 'object' && Object.keys(data.fiscalResults).length > 0) {
        updateMatchStatsData(data.fiscalResults);
        replaceStoredFiscalResults(data.fiscalResults);
        clearPlayerMatchCache();
      }

      if (Array.isArray(data.matches)) {
        const dedupedMatches = deduplicateMatches(data.matches);
        setMatchesList(dedupedMatches);
        saveStoredMatches(dedupedMatches);
      }

      if (Array.isArray(data.players) && data.players.length > 0) {
        const initializedPlayers = data.players.map((p: Player) => initializePlayerRecords(p));
        setPlayersList(initializedPlayers);
        saveStoredPlayers(initializedPlayers);
        setSelectedPlayer((cur) => {
          if (!cur) return null;
          return initializedPlayers.find((p: Player) => p.id === cur.id) || cur;
        });

        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        saveStoredLastSync(timeStr);
        saveStoredMatchLastSync(timeStr);
        setLastSyncTime(timeStr);
        setLastMatchSyncTime(timeStr);

        if (showToast) {
          const mCount = Array.isArray(data.matches) ? data.matches.length : 0;
          setSyncToast(`${resolvedLabel}から最新データを読み込みました（棋士 ${initializedPlayers.length}名・対局予定 ${mCount}件）`);
          setTimeout(() => setSyncToast(null), 4000);
        }
        return { ok: true };
      }

      return { ok: false, error: '棋士データが空です' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn('Database bootstrap error:', err);
      return { ok: false, error: msg };
    }
  };

  const handleReloadFromSqlite = async () => {
    try {
      setIsSyncingAll(true);
      const res = await hydrateFromSqliteDb(true);
      if (!res.ok) {
        setSyncToast(`${dbBackendLabel}からの読み込みに失敗しました${res.error ? `（${res.error}）` : ''}`);
        setTimeout(() => setSyncToast(null), 5000);
      }
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Load local followed list & hydrate official data strictly from SQLite DB (data/shogi.db)
  useEffect(() => {
    const followed = getStoredFollowed();
    setFollowedList(followed);

    const followedIds = new Set(followed.map((f) => f.playerId));

    const rawNotifs = getStoredNotifications(matchesList);
    const validNotifs = rawNotifs.filter((n) => {
      if (n.playerId && !followedIds.has(n.playerId)) {
        return false;
      }
      return isTodayOrResultNotification(n, matchesList);
    });
    setNotifications(validNotifs);
    saveStoredNotifications(validNotifs);

    const unread = validNotifs.find((n) => !n.read);
    if (unread) {
      setActiveHeadsUp(unread);
    } else {
      setActiveHeadsUp(null);
    }

    // Read-only hydration from SQLite database (data/shogi.db)
    hydrateFromSqliteDb(false);
  }, []);

  const refreshNotifications = () => {
    const followedIds = new Set(followedList.map((f) => f.playerId));
    const rawNotifs = getStoredNotifications(matchesList);
    const validNotifs = rawNotifs.filter((n) => {
      if (n.playerId && !followedIds.has(n.playerId)) {
        return false;
      }
      return isTodayOrResultNotification(n, matchesList);
    });
    setNotifications(validNotifs);
    const unread = validNotifs.find((n) => !n.read);
    if (unread) {
      setActiveHeadsUp(unread);
    } else {
      setActiveHeadsUp(null);
    }
  };

  const handleDeleteNotification = (id: string) => {
    deleteStoredNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (activeHeadsUp?.id === id) {
      setActiveHeadsUp(null);
    }
  };

  const handleClearAllNotifications = () => {
    clearStoredNotifications();
    setNotifications([]);
    setActiveHeadsUp(null);
  };

  // Handler when monthly results are reloaded from SQLite
  const handleResultsReloaded = (
    updatedResults: Record<string, ShogiMonthlyResult[]>
  ) => {
    updateMatchStatsData(updatedResults);
    clearPlayerMatchCache();
    setPlayersList((prev) => {
      const updated = prev.map((p) => initializePlayerRecords(p));
      saveStoredPlayers(updated);
      return updated;
    });
    setSelectedPlayer((cur) => {
      if (!cur) return null;
      return initializePlayerRecords(cur);
    });
  };

  // Follow/unfollow handlers (saved locally without Google account requirement)
  const handleToggleFollow = (config: FollowedPlayerConfig) => {
    const idx = followedList.findIndex((f) => f.playerId === config.playerId);
    let updated: FollowedPlayerConfig[];
    if (idx >= 0) {
      updated = [...followedList];
      updated[idx] = config;
    } else {
      updated = [...followedList, config];
    }
    setFollowedList(updated);
    saveStoredFollowed(updated);

    const target = playersList.find((p) => p.id === config.playerId) || PLAYERS_DATA.find((p) => p.id === config.playerId);
    if (target) {
      setSyncToast(`【推し登録】${target.name} を登録しました。`);
      setTimeout(() => setSyncToast(null), 3500);

      // If the followed player happens to have a match today, push today's match notification
      const todayStr = getTodayDateString();
      const todayMatch = matchesList.find(
        (m) =>
          (m.player1Id === target.id || m.player2Id === target.id) &&
          (m.status === 'live' || m.date === todayStr)
      );
      if (todayMatch) {
        triggerPushNotification(
          `【本日対局】${target.name} ${target.rank}の対局日です！`,
          `本日 ${todayMatch.time}〜 ${todayMatch.tournament}。${todayMatch.venue}にて対局中！`,
          'match_day',
          todayMatch.id,
          target.id
        ).then(() => {
          refreshNotifications();
        });
      }
    }
  };

  const handleRemoveFollow = (playerId: string) => {
    const updated = followedList.filter((f) => f.playerId !== playerId);
    setFollowedList(updated);
    saveStoredFollowed(updated);

    setSyncToast(`推し登録を解除しました`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Add fan comment handler
  const handleAddComment = (playerId: string, text: string) => {
    const idx = followedList.findIndex((f) => f.playerId === playerId);
    if (idx >= 0) {
      const updated = [...followedList];
      const newComment = {
        id: `com-${Date.now()}`,
        text,
        createdAt: new Date().toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      const updatedConfig = {
        ...updated[idx],
        fanComments: [newComment, ...(updated[idx].fanComments || [])],
      };
      updated[idx] = updatedConfig;
      setFollowedList(updated);
      saveStoredFollowed(updated);
    }
  };

  // Unread notifications count (strictly today's matches & match results)
  const unreadCount = notifications.filter(
    (n) => !n.read && isTodayOrResultNotification(n, matchesList)
  ).length;

  return (
    <AndroidFrame
      activeNotification={activeHeadsUp}
      onDismissNotification={() => setActiveHeadsUp(null)}
      onSelectNotificationMatch={(matchId) => {
        const match = matchesList.find((m) => m.id === matchId);
        if (match) setSelectedMatch(match);
      }}
    >
      {/* Top Application Bar */}
      <header className="px-2.5 sm:px-6 py-2.5 bg-zinc-950/95 border-b border-zinc-800/80 sticky top-0 z-20 flex items-center justify-between gap-1.5 sm:gap-2.5 backdrop-blur-none">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Shogi Koma App Logo Icon */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 border border-amber-500/30 shadow-md bg-zinc-900 group">
            <img
              src="/icon-192.png"
              alt="将棋推し活アプリ"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-black text-zinc-100 font-serif-jp tracking-wide truncate flex items-center gap-1.5">
              <span>将棋推し活アプリ</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate hidden sm:block">
              棋士・女流棋士 応援ナビ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Reload all data strictly from active DB (read-only) */}
          <button
            onClick={handleReloadFromSqlite}
            disabled={isSyncingAll}
            aria-label="DB再読込"
            className={`h-9 w-9 rounded-xl border transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95 ${
              isSyncingAll
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-850 text-amber-400 hover:text-amber-300 border-amber-500/30 hover:border-amber-500/60'
            }`}
            title={`${dbBackendLabel}から最新データを再読み込み`}
          >
            <RefreshCw size={16} className={`text-amber-400 shrink-0 ${isSyncingAll ? 'animate-spin' : ''}`} />
          </button>

          {/* App Info & Features button */}
          <button
            onClick={() => setShowAppInfoModal(true)}
            aria-label="アプリ情報"
            className="h-9 px-2 sm:px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/60 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="機能一覧・アプリ情報・作者を表示"
          >
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold hidden md:inline">アプリ情報</span>
          </button>



          {/* Quick notification bell */}
          <button
            onClick={() => setShowNotificationModal(true)}
            className="h-9 w-9 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white transition border border-zinc-800 hover:border-zinc-700 flex items-center justify-center relative cursor-pointer active:scale-95 shadow-sm"
            title="通知速報を開く"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-zinc-950 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-3 sm:p-6 pb-24 overflow-y-auto relative">
        {syncToast && (
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{syncToast}</span>
            </div>
            <button
              onClick={() => setSyncToast(null)}
              className="text-emerald-400 hover:text-white text-xs ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <OshiDashboard
            followedList={followedList}
            players={playersList}
            matches={matchesList}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onSelectMatch={(m) => setSelectedMatch(m)}
            onOpenDirectory={() => setActiveTab('directory')}
            onOpenCalendar={() => {
              setCalendarSubTab('schedule');
              setActiveTab('calendar');
            }}
            onOpenResults={() => {
              setCalendarSubTab('results');
              setActiveTab('calendar');
            }}
            onOpenAdminDb={() => setShowAdminDbModal(true)}
            onRemoveFollow={handleRemoveFollow}
            onToggleFollow={handleToggleFollow}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarScheduleView
            matches={matchesList}
            players={playersList}
            followedList={followedList}
            onSelectMatch={(m) => setSelectedMatch(m)}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            isSyncingMatches={isSyncingAll}
            lastMatchSyncTime={lastMatchSyncTime}
            onRefreshMatches={handleReloadFromSqlite}
            activeSubTab={calendarSubTab}
            onChangeSubTab={(tab) => setCalendarSubTab(tab)}
            onUpdateResults={handleResultsReloaded}
          />
        )}

        {activeTab === 'directory' && (
          <PlayerDirectory
            players={playersList}
            followedList={followedList}
            onToggleFollow={handleToggleFollow}
            onRemoveFollow={handleRemoveFollow}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onRefreshMatches={handleReloadFromSqlite}
            isSyncingPlayers={isSyncingAll}
            lastSyncTime={lastSyncTime}
            onSyncPlayers={handleReloadFromSqlite}
            onOpenAdminDb={() => setShowAdminDbModal(true)}
          />
        )}

      </main>

      {/* Android Bottom Navigation Bar (Material 3 style) */}
      <nav className="fixed sm:sticky bottom-0 left-0 right-0 z-30 bg-zinc-950 border-t border-zinc-800/80 px-2 py-1.5">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition ${
              activeTab === 'dashboard'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'dashboard' ? 'bg-amber-500/20' : ''
              }`}
            >
              <Heart
                size={20}
                className={activeTab === 'dashboard' ? 'fill-amber-400' : ''}
              />
            </div>
            <span className="text-[10px] mt-0.5">推し活</span>
          </button>

          {/* Calendar Tab */}
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition ${
              activeTab === 'calendar'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'calendar' ? 'bg-amber-500/20' : ''
              }`}
            >
              <Calendar size={20} />
            </div>
            <span className="text-[10px] mt-0.5">
              {activeTab === 'calendar' && calendarSubTab === 'results' ? '対局結果' : '対局日程'}
            </span>
          </button>

          {/* Directory Tab */}
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition ${
              activeTab === 'directory'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'directory' ? 'bg-amber-500/20' : ''
              }`}
            >
              <Users size={20} />
            </div>
            <span className="text-[10px] mt-0.5">棋士名鑑</span>
          </button>

          {/* App Info & Features Button */}
          <button
            onClick={() => setShowAppInfoModal(true)}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition text-zinc-400 hover:text-amber-300"
            title="機能一覧と作者名を表示"
          >
            <div className="p-1 rounded-xl">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <span className="text-[10px] mt-0.5 font-bold text-amber-300">機能・作者</span>
          </button>
        </div>
      </nav>

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          players={playersList}
          onClose={() => setSelectedMatch(null)}
          onNotificationSent={refreshNotifications}
          onSelectPlayer={(p) => {
            setSelectedMatch(null);
            setSelectedPlayer(p);
          }}
          onOpenAdminDb={() => {
            setSelectedMatch(null);
            setShowAdminDbModal(true);
          }}
        />
      )}

      {/* Player Profile & Stats Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer}
          followedConfig={followedList.find((f) => f.playerId === selectedPlayer.id)}
          matches={matchesList}
          allPlayers={playersList}
          onClose={() => setSelectedPlayer(null)}
          onRemoveFollow={handleRemoveFollow}
          onToggleFollow={handleToggleFollow}
          onAddComment={handleAddComment}
          onSelectMatch={(m) => {
            setSelectedPlayer(null);
            setSelectedMatch(m);
          }}
        />
      )}

      {/* App Info & Features Modal */}
      {showAppInfoModal && (
        <AppInfoModal
          onClose={() => setShowAppInfoModal(false)}
          onOpenAdminDb={() => setShowAdminDbModal(true)}
        />
      )}

      {/* Password-Protected Integrated Shogi DB Management Portal */}
      {showAdminDbModal && (
        <AdminDbModal
          followedList={followedList}
          onClose={() => setShowAdminDbModal(false)}
          onDatabaseUpdated={async (partial) => {
            if (partial && (partial.players || partial.matches || partial.monthArchivePatch)) {
              if (partial.players && partial.players.length > 0) {
                const initializedPlayers = partial.players.map((p) => initializePlayerRecords(p));
                setPlayersList(initializedPlayers);
                saveStoredPlayers(initializedPlayers);
                setSelectedPlayer((cur) => {
                  if (!cur) return null;
                  return initializedPlayers.find((p) => p.id === cur.id) || cur;
                });
              }
              if (partial.matches) {
                const dedupedMatches = deduplicateMatches(partial.matches);
                setMatchesList(dedupedMatches);
                saveStoredMatches(dedupedMatches);
              }
              if (partial.monthArchivePatch) {
                const { month, results } = partial.monthArchivePatch;
                const mergedFiscal = {
                  ...getStoredFiscalResults(),
                  [month]: results,
                };
                replaceStoredFiscalResults(mergedFiscal);
                handleResultsReloaded(mergedFiscal);
              }
              return;
            }
            await hydrateFromSqliteDb(true);
          }}
        />
      )}



      {/* Notification Center Modal (triggered by top-right Bell button) */}
      {showNotificationModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 touch-none"
          style={{
            transform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
          }}
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
            className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden touch-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              transform: 'translateZ(0)',
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden',
              isolation: 'isolate',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/70 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Bell size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100 font-serif-jp flex items-center gap-2">
                    <span>推し棋士 速報通知</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-sans font-bold">
                        未読 {unreadCount}件
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    推し棋士の対局開始・勝敗結果速報
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                title="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <NotificationCenter
                notifications={notifications}
                matches={matchesList}
                players={playersList}
                onSelectMatch={(m) => {
                  setShowNotificationModal(false);
                  setSelectedMatch(m);
                }}
                onRefreshNotifications={refreshNotifications}
                onDeleteNotification={handleDeleteNotification}
                onClearAllNotifications={handleClearAllNotifications}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </AndroidFrame>
  );
}
