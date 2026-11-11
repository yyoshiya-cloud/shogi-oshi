import React, { useState, useMemo } from 'react';
import { Match, Player, FollowedPlayerConfig, ShogiMonthlyResult } from '../types/shogi';
import { getGoogleCalendarUrl, downloadICSFile, downloadMultipleICSFile, MatchExportItem } from '../utils/calendarExport';
import { getTodayInfo, formatJapaneseDate } from '../utils/dateUtils';
import { formatPlayerName, formatPlayerRankAndDan, resolvePlayer } from '../utils/playerUtils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  CalendarPlus,
  Download,
  Filter,
  List,
  Grid,
  RefreshCw,
  ExternalLink,
  Trophy,
  Bookmark,
  BookmarkCheck,
  CheckSquare,
  Square,
  Check,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MonthlyResultsView } from './MonthlyResultsView';

interface CalendarScheduleViewProps {
  matches: Match[];
  players: Player[];
  followedList: FollowedPlayerConfig[];
  onSelectMatch: (match: Match) => void;
  onSelectPlayer?: (player: Player) => void;
  onSyncScrapedMatches?: (newMatches: Match[]) => void;
  isSyncingMatches?: boolean;
  lastMatchSyncTime?: string | null;
  onRefreshMatches?: () => void;
  activeSubTab?: 'schedule' | 'results';
  onChangeSubTab?: (tab: 'schedule' | 'results') => void;
  onUpdateResults?: (updated: Record<string, ShogiMonthlyResult[]>, targetMonths?: string[]) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  matches,
  players,
  followedList,
  onSelectMatch,
  onSelectPlayer,
  onSyncScrapedMatches,
  isSyncingMatches = false,
  lastMatchSyncTime = null,
  onRefreshMatches,
  activeSubTab,
  onChangeSubTab,
  onUpdateResults,
}) => {
  // Reliably obtain current date upon launch in local/JST time
  const todayInfo = getTodayInfo();
  const todayDate = todayInfo.dateStr;

  const [currentYear, setCurrentYear] = useState<number>(() => todayInfo.year);
  const [currentMonth, setCurrentMonth] = useState<number>(() => todayInfo.month);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayDate);
  const [filterOnlyOshi, setFilterOnlyOshi] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'finished'>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarDisplayMode, setCalendarDisplayMode] = useState<'strip' | 'month'>('strip');
  const [stripOffsetDays, setStripOffsetDays] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [internalSubTab, setInternalSubTab] = useState<'schedule' | 'results'>('schedule');
  const currentSubTab = activeSubTab || internalSubTab;
  const setSubTab = (tab: 'schedule' | 'results') => {
    setInternalSubTab(tab);
    if (onChangeSubTab) onChangeSubTab(tab);
  };


  const [selectedGoogleIds, setSelectedGoogleIds] = useState<Set<string>>(new Set());
  const [selectedIcsIds, setSelectedIcsIds] = useState<Set<string>>(new Set());

  const toggleGoogleReservation = (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedGoogleIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const toggleIcsReservation = (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIcsIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const handleSelectAllBoth = () => {
    const allIds = new Set(filteredMatches.map((m) => m.id));
    setSelectedGoogleIds(allIds);
    setSelectedIcsIds(allIds);
  };

  const handleSelectOshiBoth = () => {
    const oshiIds = new Set(
      filteredMatches
        .filter((m) => followedPlayerIds.has(m.player1Id) || followedPlayerIds.has(m.player2Id))
        .map((m) => m.id)
    );
    setSelectedGoogleIds(oshiIds);
    setSelectedIcsIds(oshiIds);
  };

  const handleClearAllReservations = () => {
    setSelectedGoogleIds(new Set());
    setSelectedIcsIds(new Set());
  };

  const followedPlayerIds = new Set(followedList.map((f) => f.playerId));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const getPlayer = (id: string): Player => {
    return resolvePlayer(id, players);
  };

  // Selected Google Calendar export items
  const googleExportItems = useMemo<MatchExportItem[]>(() => {
    if (selectedGoogleIds.size === 0) return [];
    const items: MatchExportItem[] = [];
    matches.forEach((m) => {
      if (selectedGoogleIds.has(m.id)) {
        items.push({
          match: m,
          p1: getPlayer(m.player1Id),
          p2: getPlayer(m.player2Id),
        });
      }
    });
    return items;
  }, [selectedGoogleIds, matches, players]);

  // Selected ICS export items
  const icsExportItems = useMemo<MatchExportItem[]>(() => {
    if (selectedIcsIds.size === 0) return [];
    const items: MatchExportItem[] = [];
    matches.forEach((m) => {
      if (selectedIcsIds.has(m.id)) {
        items.push({
          match: m,
          p1: getPlayer(m.player1Id),
          p2: getPlayer(m.player2Id),
        });
      }
    });
    return items;
  }, [selectedIcsIds, matches, players]);

  const handleBulkGoogleCalendar = () => {
    if (googleExportItems.length === 0) return;
    googleExportItems.forEach((item, idx) => {
      const url = getGoogleCalendarUrl(item.match, item.p1, item.p2);
      setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      }, idx * 250);
    });

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });
  };

  const handleBulkICSDownload = () => {
    if (icsExportItems.length === 0) return;
    downloadMultipleICSFile(icsExportItems, `shogi_selected_matches_${todayDate}.ics`);
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 },
    });
  };

  // Filter matches (対局結果・対局一覧は年月日で降順に整列)
  const filteredMatches = useMemo(() => {
    const list = matches.filter((m) => {
      // Oshi filter
      if (filterOnlyOshi) {
        const isOshi = followedPlayerIds.has(m.player1Id) || followedPlayerIds.has(m.player2Id);
        if (!isOshi) return false;
      }
      // Status filter
      if (statusFilter === 'upcoming' && m.status === 'finished') return false;
      if (statusFilter === 'finished' && m.status !== 'finished') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const p1 = getPlayer(m.player1Id);
        const p2 = getPlayer(m.player2Id);
        const str = `${m.tournament} ${m.round || ''} ${p1.name} ${p2.name} ${m.date} ${m.venue} ${m.highlights || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    // システム日付（本日）を先頭にし、未来の日程を昇順（本日、翌日、明後日...）で整列
    return list.sort((a, b) => {
      const aIsUpcomingOrToday = a.date >= todayDate;
      const bIsUpcomingOrToday = b.date >= todayDate;

      // 本日および未来の対局を先頭に
      if (aIsUpcomingOrToday && !bIsUpcomingOrToday) return -1;
      if (!aIsUpcomingOrToday && bIsUpcomingOrToday) return 1;

      if (aIsUpcomingOrToday && bIsUpcomingOrToday) {
        // 本日以降は日付昇順（本日、翌日、明後日...）
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return (a.time || '').localeCompare(b.time || '');
      }

      // 過去日は直近過去順（降順）
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [matches, filterOnlyOshi, followedPlayerIds, statusFilter, searchQuery, players, todayDate]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar matrix
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Padding days before
  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    const mStr = String(currentMonth === 0 ? 12 : currentMonth).padStart(2, '0');
    const yStr = currentMonth === 0 ? currentYear - 1 : currentYear;
    calendarDays.push({
      day: d,
      dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(currentMonth + 1).padStart(2, '0');
    calendarDays.push({
      day: i,
      dateStr: `${currentYear}-${mStr}-${String(i).padStart(2, '0')}`,
      isCurrentMonth: true,
    });
  }

  // Padding days after (up to 42 cells)
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    const mStr = String(currentMonth + 2 > 12 ? 1 : currentMonth + 2).padStart(2, '0');
    const yStr = currentMonth + 2 > 12 ? currentYear + 1 : currentYear;
    calendarDays.push({
      day: i,
      dateStr: `${yStr}-${mStr}-${String(i).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // 1-week horizontal date strip calculation
  const weekStripDays = useMemo(() => {
    const list: {
      dateStr: string;
      year: number;
      month: number;
      day: number;
      dayOfWeekStr: string;
      dayOfWeekIdx: number;
      isToday: boolean;
      matchesCount: number;
      hasOshiMatch: boolean;
    }[] = [];

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    // Base date starts from today (system date) + offset
    const baseDate = new Date(todayInfo.year, todayInfo.month, todayInfo.day + stripOffsetDays);

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const dayNum = d.getDate();
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeekIdx = d.getDay();
      const dayOfWeekStr = weekdays[dayOfWeekIdx];

      const dayMatches = filteredMatches.filter((match) => match.date === dateStr);
      const hasOshiMatch = dayMatches.some(
        (match) => followedPlayerIds.has(match.player1Id) || followedPlayerIds.has(match.player2Id)
      );

      list.push({
        dateStr,
        year: y,
        month: m,
        day: dayNum,
        dayOfWeekStr,
        dayOfWeekIdx,
        isToday: dateStr === todayDate,
        matchesCount: dayMatches.length,
        hasOshiMatch,
      });
    }

    return list;
  }, [todayInfo, stripOffsetDays, filteredMatches, followedPlayerIds, todayDate]);

  // Selected date matches
  const selectedDateMatches = filteredMatches.filter((m) => m.date === selectedDate);

  const monthNames = [
    '1月 (睦月)', '2月 (如月)', '3月 (弥生)', '4月 (卯月)',
    '5月 (皐月)', '6月 (水無月)', '7月 (文月)', '8月 (葉月)',
    '9月 (長月)', '10月 (神無月)', '11月 (霜月)', '12月 (師走)'
  ];

  return (
    <div className="space-y-4">
      {/* Schedule vs Results Segmented Subtab Switcher */}
      <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800 shadow-md">
        <button
          onClick={() => setSubTab('schedule')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
            currentSubTab === 'schedule'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CalendarIcon size={14} />
          <span>対局予定<br />（公式スケジュール）</span>
        </button>
        <button
          onClick={() => setSubTab('results')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
            currentSubTab === 'results'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Trophy size={14} />
          <span>対局結果<br />（4月〜翌年3月）</span>
        </button>
      </div>

      {currentSubTab === 'results' ? (
        <MonthlyResultsView
          players={players}
          followedList={followedList}
          onSelectPlayer={onSelectPlayer || (() => {})}
          onSelectMatch={onSelectMatch}
          onUpdateResults={onUpdateResults}
        />
      ) : (
        <>
          {/* 日本将棋連盟公式 対局予定 Sync Header Banner */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-zinc-800 p-3.5 sm:p-4 rounded-3xl shadow-lg">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <CalendarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-zinc-100 font-serif-jp">
                  公式対局予定カレンダー
                </h2>
                <a
                  href="https://www.shogi.or.jp/game/?tab=schedule"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-700 font-semibold transition"
                  title="日本将棋連盟の対局予定ページを開く"
                >
                  <span>日本将棋連盟公式 連携</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isSyncingMatches ? (
                  <span className="text-amber-400 animate-pulse font-medium">
                    日本将棋連盟（shogi.or.jp）から最新対局予定を取得中...
                  </span>
                ) : (
                  <span>
                    全 <strong className="text-amber-300 font-bold">{matches.length}</strong> 局の公式戦日程を反映済み
                    {lastMatchSyncTime && (
                      <span className="ml-1 text-zinc-400 font-mono">（最終同期: {lastMatchSyncTime}）</span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                const info = getTodayInfo();
                setSelectedDate(info.dateStr);
                setCurrentYear(info.year);
                setCurrentMonth(info.month);
                setStripOffsetDays(0);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition flex items-center gap-1 shadow-sm"
              title="現在の日付に対局カレンダーを合わせる"
            >
              <Clock size={12} className="text-amber-400" />
              <span>本日 {todayInfo.shortDisplay}</span>
            </button>

          </div>
        </div>
      </div>

      {/* View & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Oshi Filter Toggle */}
          <button
            onClick={() => setFilterOnlyOshi(!filterOnlyOshi)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
              filterOnlyOshi
                ? 'bg-rose-500 text-white shadow-rose-900/30'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <Heart size={14} className={filterOnlyOshi ? 'fill-white' : ''} />
            <span>推し棋士のみ ({followedList.length})</span>
          </button>

          {/* Status Segmented Control */}
          <div className="flex bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              すべて ({matches.length})
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`px-2.5 py-1 rounded-lg transition ${
                statusFilter === 'upcoming'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              予定
            </button>
            <button
              onClick={() => setStatusFilter('finished')}
              className={`px-2.5 py-1 rounded-lg transition ${
                statusFilter === 'finished'
                  ? 'bg-zinc-700 text-zinc-100 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              終局
            </button>
          </div>

          {/* Quick Bulk Selection Buttons */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs flex-wrap sm:flex-nowrap">
            <span className="text-zinc-400 font-bold px-1 flex items-center gap-1 text-[11px] shrink-0">
              <Bookmark size={12} className="text-amber-400" />
              <span>一括予約:</span>
            </span>
            <button
              onClick={handleSelectAllBoth}
              className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition text-[11px] font-medium shrink-0"
              title="表示中の対局をすべてGoogleおよび.ics一括予約に追加します"
            >
              表示全選択 ({filteredMatches.length})
            </button>
            <button
              onClick={handleSelectOshiBoth}
              className="px-2 py-0.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 transition text-[11px] font-medium flex items-center gap-0.5 shrink-0"
              title="推し対局のみを一括予約に追加します"
            >
              <Heart size={10} className="fill-rose-400" />
              <span>推し全選択</span>
            </button>
            {(selectedGoogleIds.size > 0 || selectedIcsIds.size > 0) && (
              <button
                onClick={handleClearAllReservations}
                className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition text-[11px] shrink-0"
                title="すべての予約選択を解除します"
              >
                解除
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box for棋士・棋戦 */}
          <div className="relative flex-1 md:w-44">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="棋士・棋戦検索..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Calendar / List Toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                viewMode === 'calendar'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Grid size={14} />
              <span className="hidden sm:inline">カレンダー</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                viewMode === 'list'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <List size={14} />
              <span className="hidden sm:inline">一覧</span>
            </button>
          </div>
        </div>
      </div>



      {/* Calendar Mode */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          {/* 1-Week Horizontal Date Strip */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-3.5 sm:p-4 shadow-xl space-y-3">
            {/* Strip Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <CalendarIcon size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-zinc-100 font-serif-jp flex items-center gap-1.5">
                    <span>直近1週間の対局日程</span>
                    <span className="text-[11px] text-zinc-400 font-normal">
                      ({weekStripDays[0]?.month}月{weekStripDays[0]?.day}日〜{weekStripDays[weekStripDays.length - 1]?.month}月{weekStripDays[weekStripDays.length - 1]?.day}日)
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStripOffsetDays((prev) => prev - 7)}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  title="1週間前へ"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    setStripOffsetDays(0);
                    setSelectedDate(todayDate);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-xl font-bold transition flex items-center gap-1 ${
                    selectedDate === todayDate && stripOffsetDays === 0
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                  title="本日に戻る"
                >
                  <Clock size={12} />
                  <span>本日</span>
                </button>
                <button
                  onClick={() => setStripOffsetDays((prev) => prev + 7)}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  title="1週間先へ"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => setCalendarDisplayMode((m) => (m === 'strip' ? 'month' : 'strip'))}
                  className="ml-1 text-[11px] px-2.5 py-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition flex items-center gap-1"
                  title={calendarDisplayMode === 'strip' ? '月間グリッドカレンダーを展開' : '直近1週間バーのみに折りたたむ'}
                >
                  {calendarDisplayMode === 'strip' ? (
                    <>
                      <Grid size={13} className="text-amber-400" />
                      <span className="hidden sm:inline">月間表示</span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon size={13} className="text-amber-400" />
                      <span className="hidden sm:inline">1週間バーに縮小</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Horizontal Scrollable Date Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
              {weekStripDays.map((d) => {
                const isSelected = d.dateStr === selectedDate;
                const isSun = d.dayOfWeekIdx === 0;
                const isSat = d.dayOfWeekIdx === 6;

                return (
                  <button
                    key={d.dateStr}
                    onClick={() => {
                      setSelectedDate(d.dateStr);
                      setCurrentYear(d.year);
                      setCurrentMonth(d.month - 1);
                    }}
                    className={`flex-shrink-0 w-[64px] sm:w-[70px] py-2 px-1 rounded-2xl flex flex-col items-center justify-between text-center transition cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-zinc-950 font-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300 border-amber-200 scale-105 z-10'
                        : d.isToday
                        ? 'bg-zinc-900 border-amber-500/60 hover:bg-zinc-850 hover:border-amber-400'
                        : d.matchesCount > 0
                        ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                        : 'bg-zinc-950/40 border-zinc-900/80 text-zinc-500 hover:bg-zinc-900 opacity-60'
                    }`}
                  >
                    {/* Day of Week */}
                    <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold leading-none">
                      <span
                        className={
                          isSelected
                            ? 'text-zinc-950 font-extrabold'
                            : isSun
                            ? 'text-rose-400'
                            : isSat
                            ? 'text-sky-400'
                            : 'text-zinc-400'
                        }
                      >
                        {d.dayOfWeekStr}
                      </span>
                    </div>

                    {/* Day Number */}
                    <span
                      className={`text-base sm:text-lg font-black font-serif-jp my-0.5 leading-tight ${
                        isSelected
                          ? 'text-zinc-950 font-black'
                          : d.isToday
                          ? 'text-amber-400 font-extrabold'
                          : 'text-zinc-100'
                      }`}
                    >
                      {d.day}
                    </span>

                    {/* Bottom Badge: Today / Match count / Oshi Heart */}
                    <div className="min-h-[16px] flex items-center justify-center gap-0.5 w-full">
                      {d.isToday && !isSelected && (
                        <span className="text-[8px] bg-amber-500 text-zinc-950 font-black px-1 rounded leading-tight">
                          本日
                        </span>
                      )}
                      {d.hasOshiMatch && (
                        <span
                          className={`text-[10px] leading-none ${isSelected ? 'text-zinc-950' : 'text-rose-400'}`}
                          title="推し棋士の対局あり"
                        >
                          ♥
                        </span>
                      )}
                      {d.matchesCount > 0 ? (
                        <span
                          className={`text-[9px] font-bold px-1 rounded leading-tight ${
                            isSelected
                              ? 'bg-zinc-950 text-amber-300 font-black'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {d.matchesCount}局
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-600">-</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional: Month Grid (only rendered when user toggles calendarDisplayMode === 'month') */}
          {calendarDisplayMode === 'month' && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-xl">
              {/* Month Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={18} className="text-amber-400" />
                  <h3 className="text-base sm:text-lg font-black text-zinc-100 font-serif-jp tracking-wide">
                    {currentYear}年 {monthNames[currentMonth]}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const info = getTodayInfo();
                      setCurrentYear(info.year);
                      setCurrentMonth(info.month);
                      setSelectedDate(info.dateStr);
                      setStripOffsetDays(0);
                    }}
                    className="px-2 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    今月
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 text-center text-xs font-bold mb-2">
                <span className="text-rose-400">日</span>
                <span className="text-zinc-400">月</span>
                <span className="text-zinc-400">火</span>
                <span className="text-zinc-400">水</span>
                <span className="text-zinc-400">木</span>
                <span className="text-zinc-400">金</span>
                <span className="text-sky-400">土</span>
              </div>

              {/* Calendar Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cDay, idx) => {
                  const dayMatches = filteredMatches.filter((m) => m.date === cDay.dateStr);
                  const isSelected = cDay.dateStr === selectedDate;
                  const isToday = cDay.dateStr === todayDate;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cDay.dateStr)}
                      className={`min-h-[64px] sm:min-h-[72px] p-1.5 rounded-2xl flex flex-col justify-between text-left transition border ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                          : isToday
                          ? 'bg-zinc-800/80 border-amber-500/40'
                          : cDay.isCurrentMonth
                          ? 'bg-zinc-950/40 border-zinc-800/50 hover:bg-zinc-800/50'
                          : 'bg-zinc-950/20 border-transparent text-zinc-600 opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-amber-300 font-bold'
                              : isToday
                              ? 'text-amber-400 font-bold'
                              : cDay.isCurrentMonth
                              ? 'text-zinc-300'
                              : 'text-zinc-600'
                          }`}
                        >
                          {cDay.day}
                        </span>
                        {isToday && (
                          <span className="text-[9px] bg-amber-500 text-stone-950 px-1 py-0.2 rounded font-black">
                            本日
                          </span>
                        )}
                      </div>

                      {/* Match Badges / Dots */}
                      <div className="mt-1 space-y-0.5">
                        {dayMatches.slice(0, 2).map((m) => {
                          const isLive = m.status === 'live';
                          const isFin = m.status === 'finished';
                          const isOshi =
                            followedPlayerIds.has(m.player1Id) || followedPlayerIds.has(m.player2Id);

                          return (
                            <div
                              key={m.id}
                              className={`truncate text-[9px] px-1 py-0.5 rounded leading-tight font-medium ${
                                isLive
                                  ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                                  : isOshi
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                                  : isFin
                                  ? 'bg-zinc-800 text-zinc-400'
                                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                              }`}
                            >
                              {m.tournament.slice(0, 10)}
                            </div>
                          );
                        })}
                        {dayMatches.length > 2 && (
                          <span className="text-[8px] text-zinc-400 block text-right font-bold">
                            +{dayMatches.length - 2}局
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom: Selected Date Matches Agenda */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-zinc-100 font-serif-jp">
                    {formatJapaneseDate(selectedDate)} の対局一覧
                  </h4>
                  {selectedDate === todayDate && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      本日
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  該当 {selectedDateMatches.length} 局
                </p>
              </div>
            </div>

            {selectedDateMatches.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                <CalendarIcon size={32} className="mx-auto mb-2 text-zinc-600" />
                この日に予定されている対局はありません
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateMatches.map((match) => {
                  const p1 = getPlayer(match.player1Id);
                  const p2 = getPlayer(match.player2Id);

                  const isOshiMatch =
                    followedPlayerIds.has(p1.id) || followedPlayerIds.has(p2.id);

                  return (
                    <div
                      key={match.id}
                      className={`p-3.5 rounded-2xl border transition hover:border-amber-500/60 cursor-pointer ${
                        isOshiMatch
                          ? 'bg-rose-950/15 border-rose-800/40'
                          : 'bg-zinc-950/60 border-zinc-800'
                      }`}
                      onClick={() => onSelectMatch(match)}
                    >
                      <div className="flex items-center justify-between text-xs mb-2 gap-2">
                        <span className="font-semibold text-amber-300/90 truncate flex-1 font-serif-jp">
                          {match.tournament}
                          {match.round && ` ${match.round}`}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              match.status === 'live'
                                ? 'bg-amber-500/20 text-amber-300'
                                : match.status === 'finished'
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {match.status === 'live'
                              ? '対局中'
                              : match.status === 'finished'
                              ? '終局'
                              : '予定'}
                          </span>

                          {/* Separate Google Reservation Button */}
                          <button
                            onClick={(e) => toggleGoogleReservation(match.id, e)}
                            className={`p-1.5 rounded-xl transition flex items-center justify-center ${
                              selectedGoogleIds.has(match.id)
                                ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                                : 'bg-zinc-800/80 hover:bg-blue-950/60 text-blue-400 hover:text-blue-300 border border-zinc-700/60'
                            }`}
                            title="Googleカレンダー登録予約：この対局をGoogle一括登録の対象に追加します（画面下部の一括登録バーで登録実行）"
                            aria-label="Googleカレンダー登録予約"
                          >
                            <CalendarPlus size={13} className={selectedGoogleIds.has(match.id) ? 'fill-blue-200' : ''} />
                          </button>

                          {/* Separate ICS Download Reservation Button */}
                          <button
                            onClick={(e) => toggleIcsReservation(match.id, e)}
                            className={`p-1.5 rounded-xl transition flex items-center justify-center ${
                              selectedIcsIds.has(match.id)
                                ? 'bg-amber-500 text-zinc-950 border border-amber-400 shadow-sm'
                                : 'bg-zinc-800/80 hover:bg-amber-950/60 text-amber-400 hover:text-amber-300 border border-zinc-700/60'
                            }`}
                            title=".ics保存予約：この対局を.icsファイル一括保存の対象に追加します（画面下部の一括登録バーで保存実行）"
                            aria-label=".ics保存予約"
                          >
                            <Download size={13} className={selectedIcsIds.has(match.id) ? 'stroke-[2.5]' : ''} />
                          </button>
                        </div>
                      </div>

                      {/* Versus */}
                      <div className="flex items-center justify-between my-2">
                        <div className="text-left">
                          <span className="text-xs text-amber-400 font-bold mr-1">☗</span>
                          <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                            {formatPlayerName(p1.name)}
                          </span>
                          <span className="text-[11px] text-zinc-400 block">{formatPlayerRankAndDan(p1)}</span>
                        </div>
                        <span className="text-xs font-black text-zinc-500">VS</span>
                        <div className="text-right">
                          <span className="text-xs text-sky-400 font-bold mr-1">⛉</span>
                          <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                            {formatPlayerName(p2.name)}
                          </span>
                          <span className="text-[11px] text-zinc-400 block">{formatPlayerRankAndDan(p2)}</span>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800/60 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {match.time}〜 開始
                        </span>
                        {match.broadcast?.length > 0 && (
                          <span className="truncate max-w-[200px] text-[10px] text-zinc-400">
                            中継: {match.broadcast.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* List Mode */}
      {viewMode === 'list' && (
        <div className="space-y-2.5">
          {filteredMatches.map((match) => {
            const p1 = getPlayer(match.player1Id);
            const p2 = getPlayer(match.player2Id);

            const isOshiMatch =
              followedPlayerIds.has(p1.id) || followedPlayerIds.has(p2.id);
            const winner = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;
            const isToday = match.date === todayDate;

            return (
              <div
                key={match.id}
                onClick={() => onSelectMatch(match)}
                className={`p-3 rounded-2xl border transition hover:border-amber-500/60 cursor-pointer shadow-sm ${
                  isOshiMatch
                    ? 'bg-rose-950/15 border-rose-800/40'
                    : isToday
                    ? 'bg-zinc-900/90 border-amber-500/40 ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/70 border-zinc-800'
                }`}
              >
                {/* Compact Header: Status, Today badge, Tournament Title & Date */}
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        match.status === 'live'
                          ? 'bg-amber-500/20 text-amber-300'
                          : match.status === 'finished'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {match.status === 'live' ? '対局中' : match.status === 'finished' ? '終局' : '予定'}
                    </span>
                    {isToday && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-zinc-950 shrink-0">
                        本日
                      </span>
                    )}
                    <span
                      className="font-bold text-zinc-100 text-xs sm:text-sm font-serif-jp truncate"
                      title={`${match.tournament}${match.round ? ` ${match.round}` : ''}`}
                    >
                      {match.tournament}
                      {match.round && ` ${match.round}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] shrink-0 font-mono">
                    <CalendarIcon size={11} className={isToday ? 'text-amber-400' : 'text-zinc-500'} />
                    <span className={isToday ? 'text-amber-300 font-bold' : ''}>
                      {match.date}
                    </span>
                  </div>
                </div>

                {/* Compact Single-row Versus Layout */}
                <div className="flex items-center justify-between bg-zinc-950/70 px-2.5 py-1.5 rounded-xl border border-zinc-800/60 my-1.5 gap-2">
                  {/* Sente Player */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-black text-amber-400 shrink-0" title="先手">
                      ☗
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-zinc-100 font-serif-jp truncate shrink-0">
                      {formatPlayerName(p1.name)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 truncate" title={formatPlayerRankAndDan(p1)}>
                      {formatPlayerRankAndDan(p1)}
                    </span>
                    {winner?.id === p1.id && (
                      <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.2 rounded shrink-0">
                        勝
                      </span>
                    )}
                  </div>

                  {/* VS divider */}
                  <span className="text-[10px] font-black text-zinc-500 px-1 shrink-0">VS</span>

                  {/* Gote Player */}
                  <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right">
                    {winner?.id === p2.id && (
                      <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.2 rounded shrink-0">
                        勝
                      </span>
                    )}
                    <span className="text-[10px] sm:text-[11px] text-zinc-400 truncate" title={formatPlayerRankAndDan(p2)}>
                      {formatPlayerRankAndDan(p2)}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-zinc-100 font-serif-jp truncate shrink-0">
                      {formatPlayerName(p2.name)}
                    </span>
                    <span className="text-xs font-black text-sky-400 shrink-0" title="後手">
                      ⛉
                    </span>
                  </div>
                </div>

                {/* Compact Footer: Broadcast & Reservation Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/40 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate text-zinc-400">
                      中継: {match.broadcast?.length > 0 ? match.broadcast.join(', ') : '日本将棋連盟モバイル中継等'}
                    </span>
                    {isOshiMatch && (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5 shrink-0 text-[10px]">
                        <Heart size={10} className="fill-rose-400" />
                        <span>推し対局</span>
                      </span>
                    )}
                  </div>

                  {/* Two separate reservation buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => toggleGoogleReservation(match.id, e)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center ${
                        selectedGoogleIds.has(match.id)
                          ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                          : 'bg-zinc-800/90 hover:bg-blue-950/60 text-blue-400 hover:text-blue-300 border border-zinc-700/60'
                      }`}
                      title="Googleカレンダー登録予約：この対局をGoogle一括登録の対象に追加します（画面下部の一括登録バーで登録実行）"
                      aria-label="Googleカレンダー登録予約"
                    >
                      <CalendarPlus size={12} className={selectedGoogleIds.has(match.id) ? 'fill-blue-200' : ''} />
                    </button>

                    <button
                      onClick={(e) => toggleIcsReservation(match.id, e)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center ${
                        selectedIcsIds.has(match.id)
                          ? 'bg-amber-500 text-zinc-950 border border-amber-400 shadow-sm'
                          : 'bg-zinc-800/90 hover:bg-amber-950/60 text-amber-400 hover:text-amber-300 border border-zinc-700/60'
                      }`}
                      title=".ics保存予約：この対局を.icsファイル一括保存の対象に追加します（画面下部の一括登録バーで保存実行）"
                      aria-label=".ics保存予約"
                    >
                      <Download size={12} className={selectedIcsIds.has(match.id) ? 'stroke-[2.5]' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slim, Responsive, Overflow-Proof Floating Bulk Action Bar */}
      {(selectedGoogleIds.size > 0 || selectedIcsIds.size > 0) && (
        <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/95 backdrop-blur-md border border-amber-500/50 p-2 sm:p-2.5 rounded-2xl shadow-2xl shadow-amber-950/70 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {selectedGoogleIds.size > 0 && (
            <button
              onClick={handleBulkGoogleCalendar}
              className="px-3 sm:px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md shadow-blue-900/40 shrink-0 whitespace-nowrap"
              title="予約中の対局をGoogleカレンダーに一括追加登録します"
            >
              <CalendarPlus size={14} />
              <span>Google一括追加 ({selectedGoogleIds.size})</span>
            </button>
          )}

          {selectedIcsIds.size > 0 && (
            <button
              onClick={handleBulkICSDownload}
              className="px-3 sm:px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md shadow-amber-950/40 shrink-0 whitespace-nowrap"
              title="予約中の対局を1つの.icsファイルにまとめて一括保存ダウンロードします"
            >
              <Download size={14} />
              <span>一括.ics保存 ({selectedIcsIds.size})</span>
            </button>
          )}

          <button
            onClick={handleClearAllReservations}
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0"
            title="すべての予約登録をクリアして解除します"
            aria-label="予約全解除"
          >
            <X size={15} />
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
};

