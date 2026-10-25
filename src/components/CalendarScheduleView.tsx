import React, { useState } from 'react';
import { Match, Player, FollowedPlayerConfig } from '../types/shogi';
import { getGoogleCalendarUrl, downloadICSFile } from '../utils/calendarExport';
import { getTodayDateString, getTodayInfo, formatJapaneseDate } from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Heart,
  CalendarPlus,
  Download,
  Filter,
  CheckCircle2,
  Tv,
  List,
  Grid,
  RefreshCw,
  DownloadCloud,
  AlertCircle,
  ExternalLink,
  Trophy
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [internalSubTab, setInternalSubTab] = useState<'schedule' | 'results'>('schedule');
  const currentSubTab = activeSubTab || internalSubTab;
  const setSubTab = (tab: 'schedule' | 'results') => {
    setInternalSubTab(tab);
    if (onChangeSubTab) onChangeSubTab(tab);
  };


  const followedPlayerIds = new Set(followedList.map((f) => f.playerId));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const getPlayer = (id: string): Player => {
    const existing = playerMap.get(id);
    if (existing) return existing;
    const clean = id.replace(/^pro-|^lady-|^player-/, '').replace(/_/g, ' ');
    return {
      id,
      name: clean,
      kana: '',
      romaji: clean,
      type: 'pro',
      affiliation: '日本将棋連盟',
      rank: '棋士',
      playerNumber: 0,
      birthDate: '',
      birthPlace: '',
      master: '',
      style: '居飛車',
      ryuoClass: '-',
      junisenClass: '-',
      heldTitles: [],
      totalTitles: 0,
      titleHistory: '',
      careerWins: 0,
      careerLosses: 0,
      careerWinRate: 0,
      currentYearWins: 0,
      currentYearLosses: 0,
      currentYearWinRate: 0,
      currentYearStreak: 0,
      rankingInFederation: {},
      colorAccent: '#6366f1',
      avatarBg: 'linear-gradient(135deg, #18181b 0%, #6366f133 100%)',
      shortBio: `${clean}（棋士）。公式戦対局。`,
      highlights: [],
      yearRecords: [],
      senteWinRate: 0.5,
      goteWinRate: 0.5,
      openingStats: [],
      headToHead: [],
      externalLinks: {
        officialProfile: 'https://www.shogi.or.jp/player/',
        kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(clean)}`,
      },
    };
  };

  // Filter matches
  const filteredMatches = matches.filter((m) => {
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
          <span>対局予定（公式スケジュール）</span>
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
          <span>対局結果（2026年 1〜10月一覧）</span>
        </button>
      </div>

      {currentSubTab === 'results' ? (
        <MonthlyResultsView
          players={players}
          followedList={followedList}
          onSelectPlayer={onSelectPlayer || (() => {})}
          onSelectMatch={onSelectMatch}
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
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition flex items-center gap-1 shadow-sm"
              title="現在の日付に対局カレンダーを合わせる"
            >
              <Clock size={12} className="text-amber-400" />
              <span>本日 ({todayInfo.shortDisplay})</span>
            </button>

            {onRefreshMatches && (
              <button
                onClick={onRefreshMatches}
                disabled={isSyncingMatches}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md ${
                  isSyncingMatches
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20'
                }`}
                title="https://www.shogi.or.jp/game/?tab=schedule から最新対局予定を再取得"
              >
                <RefreshCw size={13} className={isSyncingMatches ? 'animate-spin' : ''} />
                <span>{isSyncingMatches ? '同期中...' : '予定を更新'}</span>
              </button>
            )}
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
          {/* Main: Month Grid */}
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
                const hasOshiMatch = dayMatches.some(
                  (m) => followedPlayerIds.has(m.player1Id) || followedPlayerIds.has(m.player2Id)
                );

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
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-amber-300/90 truncate max-w-[180px]">
                          {match.tournament}
                        </span>
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
                      </div>

                      {/* Versus */}
                      <div className="flex items-center justify-between my-2">
                        <div className="text-left">
                          <span className="text-xs text-amber-400 font-bold mr-1">▲</span>
                          <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                            {p1.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 block">{p1.rank}</span>
                        </div>
                        <span className="text-xs font-black text-zinc-500">VS</span>
                        <div className="text-right">
                          <span className="text-xs text-sky-400 font-bold mr-1">△</span>
                          <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                            {p2.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 block">{p2.rank}</span>
                        </div>
                      </div>

                      {/* Location and time */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800/60">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {match.time}〜
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {match.venue.slice(0, 10)}
                        </span>
                      </div>

                      {/* Calendar export buttons inside card */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-800/60">
                        <a
                          href={getGoogleCalendarUrl(match, p1, p2)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[11px] font-medium transition"
                        >
                          <CalendarPlus size={12} />
                          <span>Google登録</span>
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadICSFile(match, p1, p2);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition"
                        >
                          <Download size={12} />
                          <span>.ics保存</span>
                        </button>
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
        <div className="space-y-3">
          {filteredMatches.map((match) => {
            const p1 = getPlayer(match.player1Id);
            const p2 = getPlayer(match.player2Id);

            const isOshiMatch =
              followedPlayerIds.has(p1.id) || followedPlayerIds.has(p2.id);
            const winner = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;

            return (
              <div
                key={match.id}
                onClick={() => onSelectMatch(match)}
                className={`p-4 rounded-2xl border transition hover:border-amber-500/60 cursor-pointer ${
                  isOshiMatch
                    ? 'bg-rose-950/15 border-rose-800/40'
                    : 'bg-zinc-900/70 border-zinc-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        match.status === 'live'
                          ? 'bg-amber-500/20 text-amber-300'
                          : match.status === 'finished'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {match.status === 'live' ? '対局中' : match.status === 'finished' ? '終局' : '予定'}
                    </span>
                    <span className="font-bold text-zinc-200 text-sm font-serif-jp">
                      {match.tournament}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-xs">
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={12} className="text-amber-400" />
                      {match.date} {match.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-amber-400" />
                      {match.venue}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center py-2">
                  <div className="flex items-center justify-between bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60">
                    <div>
                      <span className="text-xs text-amber-400 font-bold mr-1">▲ 先手</span>
                      <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                        {p1.name}
                      </span>
                      <span className="text-xs text-zinc-400 ml-1.5">{p1.rank}</span>
                    </div>
                    {winner?.id === p1.id && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                        勝
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60">
                    <div>
                      <span className="text-xs text-sky-400 font-bold mr-1">△ 後手</span>
                      <span className="font-bold text-sm text-zinc-100 font-serif-jp">
                        {p2.name}
                      </span>
                      <span className="text-xs text-zinc-400 ml-1.5">{p2.rank}</span>
                    </div>
                    {winner?.id === p2.id && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                        勝
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Calendar and Direct Kifu Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800/60 text-xs">
                  <span className="text-zinc-400 truncate text-[11px]">
                    中継: {match.broadcast.join(', ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={getGoogleCalendarUrl(match, p1, p2)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition"
                    >
                      <CalendarPlus size={13} />
                      <span>Googleカレンダー</span>
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadICSFile(match, p1, p2);
                      }}
                      className="flex items-center gap-1 text-zinc-300 hover:text-white transition"
                    >
                      <Download size={13} />
                      <span>.ics</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};

