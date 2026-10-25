import React, { useState, useEffect } from 'react';
import { Player, Match, FollowedPlayerConfig, PushNotificationItem } from './types/shogi';
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
  deduplicateMatches
} from './utils/storage';
import { AndroidFrame } from './components/AndroidFrame';
import { isTodayOrResultNotification } from './utils/notificationFilter';
import { getTodayDateString, getTodayInfo } from './utils/dateUtils';
import { OshiDashboard } from './components/OshiDashboard';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { PlayerDirectory } from './components/PlayerDirectory';
import { NotificationCenter } from './components/NotificationCenter';
import { MatchDetailModal } from './components/MatchDetailModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { AppInfoModal } from './components/AppInfoModal';
import {
  Heart,
  Calendar,
  Users,
  Bell,
  Sparkles,
  Trophy,
  ExternalLink
} from 'lucide-react';

type TabType = 'dashboard' | 'calendar' | 'directory' | 'notifications';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [playersList, setPlayersList] = useState<Player[]>(() => {
    const stored = getStoredPlayers();
    if (stored && stored.length > 0) {
      // Check if any static player from PLAYERS_DATA is missing in stored, or if cleanup/normalization is needed
      const storedIds = new Set(stored.map((p) => p.id));
      const missingStatic = PLAYERS_DATA.filter((p) => !storedIds.has(p.id));

      const staticMap = new Map(PLAYERS_DATA.map((p) => [p.id, p]));
      const needsLpsaOrNakaiUpdate = stored.some((p) => {
        if (p.id === 'nakai-hiroe' && (p.careerWins < 780 || p.currentYearWins !== 9)) return true;
        if (p.id === 'watanabe-mana' && (p.careerWins < 240 || p.currentYearWins !== 2)) return true;
        if (p.affiliation === 'LPSA' && (p.careerWins === 0 || !p.careerWins)) return true;
        if (p.name && (p.name.includes('※') || p.name.includes('＊') || p.name.includes('*'))) return true;
        return false;
      });

      const needsCleanup =
        missingStatic.length > 0 ||
        needsLpsaOrNakaiUpdate ||
        stored.some(
          (p) =>
            (p.rank && p.rank.length > 25) ||
            (p.rank && (p.rank.includes('１') || p.rank.includes('２'))) ||
            (p.heldTitles && p.heldTitles.some((t) => t.includes('段') || t.includes('級'))) ||
            (!p.danRank && (p.id === 'fujii-sota' || p.id === 'ito-takumi' || p.id === 'nishiyama-tomoka' || p.id === 'fukuma-kana' || p.id === 'shimizu-ichiyo'))
        );

      if (needsCleanup) {
        const cleaned = [...stored, ...missingStatic].map((p) => {
          let name = p.name ? p.name.replace(/[※＊\*\s]/g, ' ').replace(/\s+/g, ' ').trim() : p.name;
          let rank = p.rank || '現役棋士';
          rank = rank.replace(/１/g, '1').replace(/２/g, '2');
          if (rank.length > 25) {
            const m = rank.match(/([一二三四五六七八九]段|女流[初一二三四五六七]段|女流[1-2１-２]級|竜王|名人)/);
            rank = m ? m[1].replace(/１/g, '1').replace(/２/g, '2') : '現役棋士';
          }
          const validHeldTitles = (p.heldTitles || []).filter(
            (t) => !t.includes('段') && !t.includes('級')
          );
          let danRank = p.danRank;
          if (!danRank) {
            if (p.id === 'fujii-sota' || p.name.includes('藤井 聡太')) danRank = '九段';
            else if (p.id === 'ito-takumi' || p.name.includes('伊藤 匠')) danRank = '九段';
            else if (p.id === 'nishiyama-tomoka' || p.name.includes('西山 朋佳')) danRank = '女流五段';
            else if (p.id === 'fukuma-kana' || p.name.includes('福間 香奈')) danRank = '女流六段';
            else if (p.id === 'shimizu-ichiyo' || p.name.includes('清水 市代')) danRank = '女流七段';
          }
          const staticP = staticMap.get(p.id);
          let careerWins = p.careerWins;
          let careerLosses = p.careerLosses;
          let careerWinRate = p.careerWinRate;
          let currentYearWins = p.currentYearWins;
          let currentYearLosses = p.currentYearLosses;
          let currentYearWinRate = p.currentYearWinRate;

          if (staticP && (p.id === 'nakai-hiroe' || p.affiliation === 'LPSA')) {
            if (p.id === 'nakai-hiroe' && (careerWins < 780 || currentYearWins !== 9)) {
              careerWins = staticP.careerWins;
              careerLosses = staticP.careerLosses;
              careerWinRate = staticP.careerWinRate;
              currentYearWins = staticP.currentYearWins;
              currentYearLosses = staticP.currentYearLosses;
              currentYearWinRate = staticP.currentYearWinRate;
            } else if (p.affiliation === 'LPSA' && (!careerWins || careerWins < staticP.careerWins || currentYearWins !== staticP.currentYearWins)) {
              careerWins = staticP.careerWins;
              careerLosses = staticP.careerLosses;
              careerWinRate = staticP.careerWinRate;
              currentYearWins = staticP.currentYearWins;
              currentYearLosses = staticP.currentYearLosses;
              currentYearWinRate = staticP.currentYearWinRate;
            }
          }

          return {
            ...p,
            name,
            rank,
            danRank,
            heldTitles: validHeldTitles,
            careerWins,
            careerLosses,
            careerWinRate,
            currentYearWins,
            currentYearLosses,
            currentYearWinRate,
          };
        });
        saveStoredPlayers(cleaned);
        return cleaned;
      }
      return stored;
    }
    return PLAYERS_DATA;
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

  // Google Account & App Info states
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar: string } | null>(() => {
    try {
      const raw = localStorage.getItem('shogi_oshi_google_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.email === 'shogi.oshi.user@gmail.com' || !parsed.email) {
          const actualUser = {
            name: 'Y.Yoshiya',
            email: 'y.yoshiya@gmail.com',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          };
          localStorage.setItem('shogi_oshi_google_user', JSON.stringify(actualUser));
          return actualUser;
        }
        return parsed;
      }
      // Default to actual user account
      const defaultActualUser = {
        name: 'Y.Yoshiya',
        email: 'y.yoshiya@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      };
      localStorage.setItem('shogi_oshi_google_user', JSON.stringify(defaultActualUser));
      return defaultActualUser;
    } catch {
      return {
        name: 'Y.Yoshiya',
        email: 'y.yoshiya@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      };
    }
  });
  const [showGoogleLoginModal, setShowGoogleLoginModal] = useState(false);
  const [showAppInfoModal, setShowAppInfoModal] = useState(false);

  const handleLoginGoogle = (user: { name: string; email: string; avatar: string }) => {
    setGoogleUser(user);
    try {
      localStorage.setItem('shogi_oshi_google_user', JSON.stringify(user));
    } catch {}
    const accountFollowed = getStoredFollowed(user.email);
    setFollowedList(accountFollowed);
    setSyncToast(`Googleアカウント (${user.email}) に推し棋士・女流棋士データをリンクしました`);
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleLogoutGoogle = () => {
    setGoogleUser(null);
    try {
      localStorage.removeItem('shogi_oshi_google_user');
    } catch {}
    setSyncToast(`Googleアカウントからログアウトしました。`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Auto-sync state
  const [isSyncingPlayers, setIsSyncingPlayers] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getStoredLastSync());
  const [isSyncingMatches, setIsSyncingMatches] = useState(false);
  const [lastMatchSyncTime, setLastMatchSyncTime] = useState<string | null>(getStoredMatchLastSync());
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncMatches = async (force = false) => {
    try {
      setIsSyncingMatches(true);
      const res = await fetch(`/api/matches/sync${force ? '?force=true' : ''}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.matches) && data.matches.length > 0) {
        setMatchesList(() => {
          const officialMatches: Match[] = data.matches;
          saveStoredMatches(officialMatches);
          return officialMatches;
        });

        if (Array.isArray(data.discoveredPlayers) && data.discoveredPlayers.length > 0) {
          setPlayersList((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newDiscovered = data.discoveredPlayers.filter((p: Player) => !existingIds.has(p.id));
            if (newDiscovered.length > 0) {
              const updated = [...prev, ...newDiscovered];
              saveStoredPlayers(updated);
              return updated;
            }
            return prev;
          });
        }

        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        saveStoredMatchLastSync(timeStr);
        setLastMatchSyncTime(timeStr);

        setSyncToast(`日本将棋連盟公式（shogi.or.jp）から最新対局予定 ${data.count}局 を反映しました`);
        setTimeout(() => setSyncToast(null), 4000);
      }
    } catch (e) {
      console.warn('Auto-sync matches notice:', e);
    } finally {
      setIsSyncingMatches(false);
    }
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayersList((prev) => {
      const idx = prev.findIndex((p) => p.id === updatedPlayer.id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = updatedPlayer;
      saveStoredPlayers(updated);
      return updated;
    });
    if (selectedPlayer?.id === updatedPlayer.id) {
      setSelectedPlayer(updatedPlayer);
    }
  };

  const handleSyncPlayers = async (force = false) => {
    try {
      setIsSyncingPlayers(true);
      const res = await fetch(`/api/players/sync${force ? '?force=true' : ''}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.players) && data.players.length > 0) {
        setPlayersList((prev) => {
          // Keep custom added players
          const customPlayers = prev.filter((p) => p.id.startsWith('custom-'));
          const merged = [...data.players, ...customPlayers];
          saveStoredPlayers(merged);
          return merged;
        });

        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        saveStoredLastSync(timeStr);
        setLastSyncTime(timeStr);

        setSyncToast(`現役棋士${data.count}名の最新情報を自動保存しました（連盟・LPSA）`);
        setTimeout(() => setSyncToast(null), 4000);
      }
    } catch (e) {
      console.warn('Auto-sync players notice:', e);
    } finally {
      setIsSyncingPlayers(false);
    }
  };

  // Load persisted state on mount & automatically trigger player auto-scraping
  useEffect(() => {
    const followed = getStoredFollowed(googleUser?.email);
    setFollowedList(followed);

    const todayStr = getTodayDateString();
    const todayInfo = getTodayInfo();



    const rawNotifs = getStoredNotifications(matchesList);
    const synchronizedNotifs = rawNotifs.map((n) => {
      if (n.id === 'notif-1' && (!n.timestamp.startsWith(todayStr) || n.body.includes('順位戦 A級'))) {
        return {
          ...n,
          timestamp: `${todayStr}T08:00:00`,
          title: '【本日対局】藤本 渚 五段の対局日です！',
          body: `本日 ${todayInfo.shortDisplay} 09:00〜 ALSOK杯王将戦 挑決リーグ (vs 西田拓也 五段)。関西将棋会館にて対局中！`,
          matchId: 'shogiorjp-2026-10-24-pro-nagisa_fujimoto-pro-takuya_nishida',
          playerId: 'pro-nagisa_fujimoto',
        };
      }
      return n;
    });

    const validNotifs = synchronizedNotifs.filter((n) => isTodayOrResultNotification(n, matchesList));
    setNotifications(validNotifs);
    saveStoredNotifications(validNotifs);

    // Initial check: if there's an unread today's match or match result notification, show heads up preview
    const unread = validNotifs.find((n) => !n.read);
    if (unread) {
      setActiveHeadsUp(unread);
    }

    const stored = getStoredPlayers();
    const needsForceSync =
      !stored ||
      stored.length === 0 ||
      !stored.some((p) => p.id === 'tanaka-saki') ||
      stored.some(
        (p) =>
          (p.rank && p.rank.length > 25) ||
          (p.rank && (p.rank.includes('１') || p.rank.includes('２'))) ||
          (p.heldTitles && p.heldTitles.some((t) => t.includes('段') || t.includes('級')))
      );
    handleSyncPlayers(needsForceSync);

    const storedMatches = getStoredMatches();
    const needsMatchSync =
      !storedMatches ||
      storedMatches.length === 0 ||
      storedMatches.some((m) => m.id.startsWith('match-live-') || m.id.startsWith('match-up-'));
    handleSyncMatches(needsMatchSync);
  }, []);

  const refreshNotifications = () => {
    const rawNotifs = getStoredNotifications(matchesList);
    const validNotifs = rawNotifs.filter((n) => isTodayOrResultNotification(n, matchesList));
    setNotifications(validNotifs);
    if (validNotifs.length > 0 && !validNotifs[0].read) {
      setActiveHeadsUp(validNotifs[0]);
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

  // Handler for importing scraped player
  const handleImportScrapedPlayer = (newPlayer: Player) => {
    setPlayersList((prev) => {
      const exists = prev.some((p) => p.name === newPlayer.name || p.id === newPlayer.id);
      if (exists) return prev;
      return [newPlayer, ...prev];
    });
  };

  // Handler for merging scraped matches
  const handleSyncScrapedMatches = (scrapedMatches: Match[]) => {
    setMatchesList((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const filteredNew = scrapedMatches.filter((m) => !existingIds.has(m.id));
      return [...filteredNew, ...prev];
    });
  };

  // Follow/unfollow handlers
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
    saveStoredFollowed(updated, googleUser?.email);

    const target = playersList.find((p) => p.id === config.playerId) || PLAYERS_DATA.find((p) => p.id === config.playerId);
    if (target) {
      setSyncToast(`【推し登録】${target.name} を登録しました。本日の対局・対局結果を速報通知します`);
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
    saveStoredFollowed(updated, googleUser?.email);
    setSyncToast(`推し登録を解除し、Googleアカウントの保存データを更新しました`);
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
      updated[idx] = {
        ...updated[idx],
        fanComments: [newComment, ...(updated[idx].fanComments || [])],
      };
      setFollowedList(updated);
      saveStoredFollowed(updated, googleUser?.email);
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
      <header className="px-4 sm:px-6 py-3.5 bg-zinc-950/90 border-b border-zinc-800/80 sticky top-0 z-20 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Shogi Koma Logo Icon */}
          <div className="w-9 h-10 koma-shape bg-gradient-to-b from-[#f9ecc9] to-[#cfa058] border-b-2 border-amber-950 flex items-center justify-center shadow-md">
            <span className="font-serif-jp text-stone-950 font-black text-sm">推</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black text-zinc-100 font-serif-jp tracking-wider whitespace-nowrap truncate">
                将棋推し活アプリ
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400">
              棋士・女流棋士 応援ナビ (連盟・LPSA・無所属)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* Google Login Button / User Profile */}
          <button
            onClick={() => setShowGoogleLoginModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
              googleUser
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
            }`}
            title="Googleアカウントでログインして推し棋士データを保存"
          >
            {googleUser ? (
              <>
                <img
                  src={googleUser.avatar}
                  alt={googleUser.name}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="max-w-[80px] sm:max-w-[100px] truncate">{googleUser.name.split(' ')[0]}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              </>
            ) : (
              <>
                <div className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center">
                  G
                </div>
                <span>Googleログイン</span>
              </>
            )}
          </button>

          {/* Quick notification bell */}
          <button
            onClick={() => setActiveTab('notifications')}
            className="relative p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition border border-zinc-800"
            title="通知速報"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-3 sm:p-6 pb-24 overflow-y-auto relative">
        {syncToast && (
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg backdrop-blur-sm animate-fadeIn">
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
            googleUser={googleUser}
            onOpenGoogleLogin={() => setShowGoogleLoginModal(true)}
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
            onRemoveFollow={handleRemoveFollow}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarScheduleView
            matches={matchesList}
            players={playersList}
            followedList={followedList}
            onSelectMatch={(m) => setSelectedMatch(m)}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onSyncScrapedMatches={handleSyncScrapedMatches}
            isSyncingMatches={isSyncingMatches}
            lastMatchSyncTime={lastMatchSyncTime}
            onRefreshMatches={() => handleSyncMatches(true)}
            activeSubTab={calendarSubTab}
            onChangeSubTab={(tab) => setCalendarSubTab(tab)}
          />
        )}

        {activeTab === 'directory' && (
          <PlayerDirectory
            players={playersList}
            followedList={followedList}
            onToggleFollow={handleToggleFollow}
            onRemoveFollow={handleRemoveFollow}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onImportScrapedPlayer={handleImportScrapedPlayer}
            isSyncingPlayers={isSyncingPlayers}
            lastSyncTime={lastSyncTime}
            onSyncPlayers={handleSyncPlayers}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationCenter
            notifications={notifications}
            matches={matchesList}
            players={playersList}
            onSelectMatch={(m) => setSelectedMatch(m)}
            onRefreshNotifications={refreshNotifications}
            onDeleteNotification={handleDeleteNotification}
            onClearAllNotifications={handleClearAllNotifications}
          />
        )}
      </main>

      {/* Android Bottom Navigation Bar (Material 3 style) */}
      <nav className="fixed sm:sticky bottom-0 left-0 right-0 z-30 bg-zinc-950/95 border-t border-zinc-800/80 px-2 py-1.5 backdrop-blur-lg">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
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

          {/* Notifications Tab */}
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition relative ${
              activeTab === 'notifications'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition relative ${
                activeTab === 'notifications' ? 'bg-amber-500/20' : ''
              }`}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </div>
            <span className="text-[10px] mt-0.5">通知速報</span>
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
          onAddComment={handleAddComment}
          onSelectMatch={(m) => {
            setSelectedPlayer(null);
            setSelectedMatch(m);
          }}
          onUpdatePlayer={handleUpdatePlayer}
        />
      )}

      {/* Google Account Login Modal */}
      {showGoogleLoginModal && (
        <GoogleLoginModal
          currentUser={googleUser}
          followedList={followedList}
          players={playersList}
          onLogin={handleLoginGoogle}
          onLogout={handleLogoutGoogle}
          onClose={() => setShowGoogleLoginModal(false)}
        />
      )}

      {/* App Info & Features Modal */}
      {showAppInfoModal && (
        <AppInfoModal onClose={() => setShowAppInfoModal(false)} />
      )}
    </AndroidFrame>
  );
}
