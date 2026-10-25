import React, { useState, useEffect, useMemo } from 'react';
import { ShogiMonthlyResult, Player, FollowedPlayerConfig, Match } from '../types/shogi';
import results2026Json from '../data/results2026.json';
import {
  Trophy,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  Heart,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowUpDown,
  BookOpen
} from 'lucide-react';

interface MonthlyResultsViewProps {
  players: Player[];
  followedList: FollowedPlayerConfig[];
  onSelectPlayer: (player: Player) => void;
  onSelectMatch?: (match: Match) => void;
}

const MONTH_OPTIONS = [
  { key: '202610', label: '2026年 10月', short: '10月' },
  { key: '202609', label: '2026年 9月', short: '9月' },
  { key: '202608', label: '2026年 8月', short: '8月' },
  { key: '202607', label: '2026年 7月', short: '7月' },
  { key: '202606', label: '2026年 6月', short: '6月' },
  { key: '202605', label: '2026年 5月', short: '5月' },
  { key: '202604', label: '2026年 4月', short: '4月' },
  { key: '202603', label: '2026年 3月', short: '3月' },
  { key: '202602', label: '2026年 2月', short: '2月' },
  { key: '202601', label: '2026年 1月', short: '1月' },
];

export const MonthlyResultsView: React.FC<MonthlyResultsViewProps> = ({
  players,
  followedList,
  onSelectPlayer,
  onSelectMatch,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('202610');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'oshi' | 'pro' | 'women' | 'title'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Newest date first by default
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [monthlyData, setMonthlyData] = useState<Record<string, ShogiMonthlyResult[]>>(() => {
    return results2026Json as Record<string, ShogiMonthlyResult[]>;
  });
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleSelectMonth = (newMonth: string) => {
    setSelectedMonth(newMonth);
    setSelectedDate(null);
  };

  const currentMonthIndex = MONTH_OPTIONS.findIndex((m) => m.key === selectedMonth);
  const handlePrevMonth = () => {
    if (currentMonthIndex < MONTH_OPTIONS.length - 1) {
      handleSelectMonth(MONTH_OPTIONS[currentMonthIndex + 1].key);
    }
  };
  const handleNextMonth = () => {
    if (currentMonthIndex > 0) {
      handleSelectMonth(MONTH_OPTIONS[currentMonthIndex - 1].key);
    }
  };

  const followedPlayerIds = useMemo(() => new Set(followedList.map((f) => f.playerId)), [followedList]);
  const followedPlayerNames = useMemo(() => {
    const set = new Set<string>();
    followedList.forEach((f) => {
      const p = players.find((pl) => pl.id === f.playerId);
      if (p) {
        set.add(p.name);
        set.add(p.name.replace(/\s+/g, ''));
      }
    });
    return set;
  }, [followedList, players]);

  // Fast player lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => {
      map.set(p.name.replace(/\s+/g, ''), p);
      map.set(p.name, p);
      map.set(p.id, p);
    });
    return map;
  }, [players]);

  const currentMonthResults = useMemo(() => {
    return monthlyData[selectedMonth] || [];
  }, [monthlyData, selectedMonth]);

  // Calendar matrix and dates for selectedMonth
  const calendarData = useMemo(() => {
    const year = parseInt(selectedMonth.slice(0, 4), 10);
    const month = parseInt(selectedMonth.slice(4, 6), 10) - 1; // 0-indexed month

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Map dateStr -> matches
    const dateMap = new Map<string, ShogiMonthlyResult[]>();
    for (const r of currentMonthResults) {
      if (!dateMap.has(r.date)) dateMap.set(r.date, []);
      dateMap.get(r.date)!.push(r);
    }

    const days: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      matchesCount: number;
      hasOshiMatch: boolean;
      hasTitleMatch: boolean;
    }[] = [];

    // Prev month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMStr = String(month === 0 ? 12 : month).padStart(2, '0');
      const prevYStr = month === 0 ? year - 1 : year;
      days.push({
        day: d,
        dateStr: `${prevYStr}-${prevMStr}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: false,
        matchesCount: 0,
        hasOshiMatch: false,
        hasTitleMatch: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const dayMatches = dateMap.get(dateStr) || [];
      const hasOshiMatch = dayMatches.some((r) => {
        const s = r.sente.replace(/\s+/g, '');
        const g = r.gote.replace(/\s+/g, '');
        return followedPlayerNames.has(s) || followedPlayerNames.has(g);
      });
      const hasTitleMatch = dayMatches.some(
        (r) =>
          r.category === 'タイトル戦' ||
          r.category === '女流タイトル戦' ||
          r.tournament.includes('竜王') ||
          r.tournament.includes('名人') ||
          r.tournament.includes('白玲') ||
          r.tournament.includes('清麗')
      );

      days.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        matchesCount: dayMatches.length,
        hasOshiMatch,
        hasTitleMatch,
      });
    }

    // Next month padding (up to 35 or 42 cells)
    const totalSlots = days.length > 35 ? 42 : 35;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMStr = String(month === 11 ? 1 : month + 2).padStart(2, '0');
      const nextYStr = month === 11 ? year + 1 : year;
      days.push({
        day: d,
        dateStr: `${nextYStr}-${nextMStr}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: false,
        matchesCount: 0,
        hasOshiMatch: false,
        hasTitleMatch: false,
      });
    }

    return { year, month: month + 1, days, dateMap };
  }, [selectedMonth, currentMonthResults, followedPlayerNames]);


  // Manual refresh for current selected month from server/official site
  const handleRefreshMonth = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch(`/api/matches/results?month=${selectedMonth}&force=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.results) {
        setMonthlyData((prev) => ({
          ...prev,
          [selectedMonth]: json.results,
        }));
        setRefreshMessage(`最新の対局結果（${json.results.length}局）を日本将棋連盟から更新しました`);
      } else {
        setRefreshMessage('現在のデータを最新として維持しています');
      }
    } catch (err: any) {
      console.warn('Refresh error:', err);
      setRefreshMessage('通信エラーのため内蔵キャッシュを表示しています');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4000);
    }
  };

  // Filtered and searched results
  const filteredResults = useMemo(() => {
    let list = currentMonthResults;

    // Filter by category
    if (categoryFilter === 'oshi') {
      list = list.filter((r) => {
        const senteClean = r.sente.replace(/\s+/g, '');
        const goteClean = r.gote.replace(/\s+/g, '');
        return followedPlayerNames.has(senteClean) || followedPlayerNames.has(goteClean);
      });
    } else if (categoryFilter === 'women') {
      list = list.filter((r) => r.isWomen);
    } else if (categoryFilter === 'pro') {
      list = list.filter((r) => !r.isWomen);
    } else if (categoryFilter === 'title') {
      list = list.filter(
        (r) =>
          r.category === 'タイトル戦' ||
          r.category === '女流タイトル戦' ||
          r.tournament.includes('竜王') ||
          r.tournament.includes('名人') ||
          r.tournament.includes('白玲') ||
          r.tournament.includes('清麗')
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace(/\s+/g, '');
      list = list.filter((r) => {
        const p1 = r.sente.toLowerCase().replace(/\s+/g, '');
        const p2 = r.gote.toLowerCase().replace(/\s+/g, '');
        const tourney = r.tournament.toLowerCase();
        const note = r.note.toLowerCase();
        return p1.includes(q) || p2.includes(q) || tourney.includes(q) || note.includes(q);
      });
    }

    // Filter by selected date (if clicked on calendar)
    if (selectedDate) {
      list = list.filter((r) => r.date === selectedDate);
    }

    // Sort order
    return [...list].sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.date.localeCompare(a.date);
      }
      return a.date.localeCompare(b.date);
    });
  }, [currentMonthResults, categoryFilter, searchQuery, sortOrder, followedPlayerNames, selectedDate]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: ShogiMonthlyResult[] }[] = [];
    let curDate = '';
    let curItems: ShogiMonthlyResult[] = [];

    for (const r of filteredResults) {
      if (r.date !== curDate) {
        if (curItems.length > 0) {
          groups.push({ date: curDate, items: curItems });
        }
        curDate = r.date;
        curItems = [r];
      } else {
        curItems.push(r);
      }
    }
    if (curItems.length > 0) {
      groups.push({ date: curDate, items: curItems });
    }
    return groups;
  }, [filteredResults]);

  // Statistics for current month
  const monthStats = useMemo(() => {
    const total = currentMonthResults.length;
    let senteWins = 0;
    let goteWins = 0;
    let oshiWins = 0;
    let oshiLosses = 0;

    for (const r of currentMonthResults) {
      const senteClean = r.sente.replace(/\s+/g, '');
      const goteClean = r.gote.replace(/\s+/g, '');

      if (r.winner === r.sente) senteWins++;
      else if (r.winner === r.gote) goteWins++;

      if (followedPlayerNames.has(senteClean)) {
        if (r.winner === r.sente) oshiWins++;
        else if (r.loser === r.sente) oshiLosses++;
      }
      if (followedPlayerNames.has(goteClean)) {
        if (r.winner === r.gote) oshiWins++;
        else if (r.loser === r.gote) oshiLosses++;
      }
    }

    const decisiveTotal = senteWins + goteWins;
    const senteRate = decisiveTotal > 0 ? ((senteWins / decisiveTotal) * 100).toFixed(1) : '50.0';
    const goteRate = decisiveTotal > 0 ? ((goteWins / decisiveTotal) * 100).toFixed(1) : '50.0';

    return {
      total,
      senteWins,
      goteWins,
      senteRate,
      goteRate,
      oshiWins,
      oshiLosses,
    };
  }, [currentMonthResults, followedPlayerNames]);

  const handlePlayerClick = (playerName: string) => {
    const clean = playerName.replace(/[※\*＊]/g, '').trim();
    const p = playerMap.get(clean.replace(/\s+/g, '')) || playerMap.get(clean);
    if (p) {
      onSelectPlayer(p);
    } else {
      // Create quick pro player view
      const isWomen = playerName.includes('※') || playerName.includes('女流');
      const tempPlayer: Player = {
        id: `player-${clean.replace(/\s+/g, '')}`,
        name: clean,
        kana: '',
        romaji: clean,
        type: isWomen ? 'women' : 'pro',
        affiliation: playerName.includes('※') ? 'LPSA' : '日本将棋連盟',
        rank: isWomen ? '女流棋士' : '現役棋士',
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
        colorAccent: isWomen ? '#ec4899' : '#6366f1',
        avatarBg: `linear-gradient(135deg, #18181b 0%, ${isWomen ? '#ec489933' : '#6366f133'} 100%)`,
        shortBio: `${clean}（${isWomen ? '女流棋士' : '棋士'}）。2026年公式対局登録棋士。`,
        highlights: ['日本将棋連盟公式対局出場'],
        yearRecords: [],
        senteWinRate: 0.5,
        goteWinRate: 0.5,
        openingStats: [],
        headToHead: [],
        externalLinks: {
          officialProfile: playerName.includes('※')
            ? 'https://joshi-shogi.com/'
            : `https://www.shogi.or.jp/player/pro/`,
          kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(clean)}`,
        },
      };
      onSelectPlayer(tempPlayer);
    }
  };

  const handleResultToMatchModal = (r: ShogiMonthlyResult) => {
    if (!onSelectMatch) return;
    const p1 = playerMap.get(r.sente.replace(/\s+/g, '')) || playerMap.get(r.sente);
    const p2 = playerMap.get(r.gote.replace(/\s+/g, '')) || playerMap.get(r.gote);

    const m: Match = {
      id: r.id,
      tournament: r.tournament,
      category: r.category,
      round: r.note || '本戦',
      date: r.date,
      time: '10:00',
      player1Id: p1?.id || `p1-${r.sente}`,
      player2Id: p2?.id || `p2-${r.gote}`,
      sentePlayerId: p1?.id || `p1-${r.sente}`,
      gotePlayerId: p2?.id || `p2-${r.gote}`,
      status: 'finished',
      venue: r.venue || '東京・将棋会館',
      timeControl: '公式持ち時間',
      broadcast: ['日本将棋連盟モバイル中継'],
      winnerId: r.winner === r.sente ? (p1?.id || r.sente) : (p2?.id || r.gote),
      kifuUrl: `https://shogidb2.com/search?q=${encodeURIComponent(`${r.sente} ${r.gote}`)}`,
      kifuMoves: [],
      highlights: `${r.sente} 対 ${r.gote}（${r.tournament}）。勝者: ${r.winner}。`,
    };
    onSelectMatch(m);
  };

  const formatDateHeader = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(parseInt(y, 10), m - 1, d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayStr = days[dateObj.getDay()];
    return `${y}年${m}月${d}日 (${dayStr}曜日)`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/40 rounded-2xl p-4 sm:p-5 border border-amber-500/20 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                公式記録
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-100 flex items-center gap-1.5">
                <Trophy size={20} className="text-amber-400" />
                2026年 対局結果一覧
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              日本将棋連盟公式（shogi.or.jp）2026年1月〜10月の全対局結果（棋士・女流棋士 2,900局超）
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://www.shogi.or.jp/game/?month=${selectedMonth}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition"
              title="日本将棋連盟の該当月公式結果ページを別タブで開く"
            >
              <ExternalLink size={13} />
              公式連盟ページ
            </a>
            <button
              onClick={handleRefreshMonth}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-zinc-700 transition disabled:opacity-50"
              title="この月の最新対局結果を再取得"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
              {isRefreshing ? '更新中...' : '最新取得'}
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div className="mt-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{refreshMessage}</span>
          </div>
        )}

        {/* Month Selector Carousel */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80">
          <div className="text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
            <span>対象月を選択（2026年）:</span>
            <span className="text-zinc-400 text-[10px]">
              選択中: {selectedMonth.slice(0, 4)}年{parseInt(selectedMonth.slice(4), 10)}月 (
              {currentMonthResults.length}局)
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700">
            {MONTH_OPTIONS.map((m) => {
              const isSelected = selectedMonth === m.key;
              const count = monthlyData[m.key]?.length || 0;
              return (
                <button
                  key={m.key}
                  onClick={() => handleSelectMonth(m.key)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center min-w-[70px] ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80 hover:text-white border border-zinc-700/60'
                  }`}
                >
                  <span>{m.short}</span>
                  <span
                    className={`text-[10px] font-normal ${
                      isSelected ? 'text-zinc-900 font-bold' : 'text-zinc-400'
                    }`}
                  >
                    {count}局
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly Summary Metrics Card */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400">総対局数</span>
            <span className="text-base font-bold text-zinc-100">{monthStats.total} 局</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400">先手勝率 vs 後手勝率</span>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              ▲{monthStats.senteRate}% / △{monthStats.goteRate}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400">先手 / 後手 勝利数</span>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              先手 {monthStats.senteWins}勝 / 後手 {monthStats.goteWins}勝
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-rose-400 flex items-center gap-1">
              <Heart size={11} className="fill-rose-400" />
              推し棋士の戦績
            </span>
            <span className="text-xs font-bold text-rose-300 mt-0.5">
              {monthStats.oshiWins}勝 {monthStats.oshiLosses}敗
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Toggle: Calendar Selection vs List */}
      <div className="flex items-center justify-between gap-2 bg-zinc-900/90 border border-zinc-800 p-2 rounded-2xl shadow-sm">
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs w-full sm:w-auto">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
              viewMode === 'calendar'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Grid size={13} />
            <span>カレンダーで日付選択</span>
          </button>
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedDate(null);
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
              viewMode === 'list'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <List size={13} />
            <span>月間一覧リスト</span>
          </button>
        </div>

        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-xl border border-amber-500/30 transition flex items-center gap-1 shrink-0"
            title="日付選択を解除してこの月の全対局を表示"
          >
            <span>選択解除（全日表示）</span>
            <span className="text-amber-400 font-bold">✕</span>
          </button>
        )}
      </div>

      {/* Interactive Monthly Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="bg-zinc-900/95 rounded-2xl p-3 sm:p-4 border border-zinc-800 shadow-md space-y-3">
          {/* Calendar Header with Prev/Next Month Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                disabled={currentMonthIndex >= MONTH_OPTIONS.length - 1}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 transition"
                title="前の月へ（2026年）"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-serif-jp">
                {calendarData.year}年 {calendarData.month}月
              </h3>
              <button
                onClick={handleNextMonth}
                disabled={currentMonthIndex <= 0}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 transition"
                title="次の月へ（2026年）"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                推し対局
              </span>
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                タイトル戦
              </span>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px]">
            <span className="text-rose-400 py-1">日</span>
            <span className="text-zinc-400 py-1">月</span>
            <span className="text-zinc-400 py-1">火</span>
            <span className="text-zinc-400 py-1">水</span>
            <span className="text-zinc-400 py-1">木</span>
            <span className="text-zinc-400 py-1">金</span>
            <span className="text-sky-400 py-1">土</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarData.days.map((d, idx) => {
              const isSelected = selectedDate === d.dateStr;
              const hasMatches = d.matchesCount > 0;
              const dayOfWeek = idx % 7;
              const isSun = dayOfWeek === 0;
              const isSat = dayOfWeek === 6;

              return (
                <button
                  key={idx}
                  disabled={!d.isCurrentMonth}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDate(null);
                    } else if (hasMatches) {
                      setSelectedDate(d.dateStr);
                    }
                  }}
                  className={`relative min-h-[50px] sm:min-h-[56px] p-1.5 rounded-xl flex flex-col justify-between text-left transition border ${
                    !d.isCurrentMonth
                      ? 'opacity-20 border-transparent cursor-default'
                      : isSelected
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/60 shadow-md shadow-amber-500/20'
                      : hasMatches
                      ? 'bg-zinc-950/90 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                      : 'bg-zinc-950/40 border-zinc-900 opacity-50 cursor-default'
                  }`}
                  title={
                    d.isCurrentMonth
                      ? `${d.dateStr}: ${d.matchesCount}局${d.hasOshiMatch ? ' (推し棋士あり)' : ''}`
                      : ''
                  }
                >
                  {/* Top row: day number and heart icon */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold leading-none ${
                        isSelected
                          ? 'text-amber-300 font-extrabold'
                          : isSun
                          ? 'text-rose-400'
                          : isSat
                          ? 'text-sky-400'
                          : 'text-zinc-200'
                      }`}
                    >
                      {d.day}
                    </span>
                    {d.hasOshiMatch && (
                      <span className="text-rose-400 flex-shrink-0" title="推し棋士の対局あり">
                        <Heart size={11} className="fill-rose-400" />
                      </span>
                    )}
                  </div>

                  {/* Bottom info: match count or title dot */}
                  <div className="mt-1">
                    {hasMatches ? (
                      <div className="flex items-center justify-between gap-0.5">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold leading-tight ${
                            isSelected
                              ? 'bg-amber-400 text-zinc-950 font-black'
                              : d.hasOshiMatch
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {d.matchesCount}局
                        </span>
                        {d.hasTitleMatch && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
                            title="タイトル戦"
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Date Banner when a date is clicked on calendar */}
          {selectedDate && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs mt-2">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-amber-400 shrink-0" />
                <span className="font-bold text-amber-300">
                  {formatDateHeader(selectedDate)} の対局結果（{filteredResults.length}局）
                </span>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-lg border border-zinc-700 transition"
              >
                全日表示に戻す ✕
              </button>
            </div>
          )}
        </div>
      )}


      {/* Filter and Search Controls */}
      <div className="bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="棋士名・棋戦名で検索（例: 藤井、羽生、竜王戦、白玲戦）..."
              className="w-full pl-9 pr-8 py-2 bg-zinc-950 rounded-xl text-xs text-zinc-200 placeholder-zinc-400 border border-zinc-700/80 focus:border-amber-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs border border-zinc-700/80 transition flex-shrink-0"
            title="日付順を変更"
          >
            <ArrowUpDown size={13} className="text-amber-400" />
            <span>{sortOrder === 'desc' ? '日付が新しい順' : '日付が古い順'}</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-zinc-400 text-[11px] mr-1 flex items-center gap-1 flex-shrink-0">
            <Filter size={12} />
            絞込:
          </span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-zinc-200 text-zinc-950 font-bold'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            すべて ({currentMonthResults.length})
          </button>
          <button
            onClick={() => setCategoryFilter('oshi')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 flex-shrink-0 ${
              categoryFilter === 'oshi'
                ? 'bg-rose-500 text-white font-bold'
                : 'bg-zinc-800/80 text-rose-300 hover:bg-zinc-700/80'
            }`}
          >
            <Heart size={12} className={categoryFilter === 'oshi' ? 'fill-white' : 'fill-rose-400'} />
            推し棋士のみ
          </button>
          <button
            onClick={() => setCategoryFilter('pro')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
              categoryFilter === 'pro'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-zinc-800/80 text-indigo-300 hover:bg-zinc-700/80'
            }`}
          >
            棋士 (男性)
          </button>
          <button
            onClick={() => setCategoryFilter('women')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
              categoryFilter === 'women'
                ? 'bg-pink-600 text-white font-bold'
                : 'bg-zinc-800/80 text-pink-300 hover:bg-zinc-700/80'
            }`}
          >
            女流棋士
          </button>
          <button
            onClick={() => setCategoryFilter('title')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
              categoryFilter === 'title'
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-zinc-800/80 text-amber-300 hover:bg-zinc-700/80'
            }`}
          >
            タイトル戦
          </button>
        </div>
      </div>

      {/* Results List Grouped by Date */}
      {groupedByDate.length === 0 ? (
        <div className="bg-zinc-900/60 rounded-2xl p-8 border border-zinc-800 text-center space-y-3">
          <BookOpen size={36} className="mx-auto text-zinc-600" />
          <h3 className="text-sm font-bold text-zinc-300">該当する対局結果が見つかりませんでした</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            検索条件または絞り込み条件を変更するか、月を切り替えてお試しください。
          </p>
          {(searchQuery || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
            >
              条件をリセット
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400 px-1 flex items-center justify-between">
            <span>表示中: {filteredResults.length} 局</span>
            {searchQuery && (
              <span className="text-amber-400 truncate max-w-[200px]">
                「{searchQuery}」の検索結果
              </span>
            )}
          </div>

          {groupedByDate.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date Header Sticky Bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-amber-400" />
                  <span className="text-xs font-bold text-zinc-200">
                    {formatDateHeader(group.date)}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                  {group.items.length}局
                </span>
              </div>

              {/* Cards for this Date */}
              <div className="grid grid-cols-1 gap-2.5">
                {group.items.map((result) => {
                  const senteClean = result.sente.replace(/\s+/g, '');
                  const goteClean = result.gote.replace(/\s+/g, '');
                  const isSenteOshi = followedPlayerNames.has(senteClean);
                  const isGoteOshi = followedPlayerNames.has(goteClean);

                  const isSenteWinner = result.winner === result.sente;
                  const isGoteWinner = result.winner === result.gote;

                  // Category badge styling
                  const isTitle =
                    result.category === 'タイトル戦' ||
                    result.tournament.includes('竜王') ||
                    result.tournament.includes('名人') ||
                    result.tournament.includes('王位') ||
                    result.tournament.includes('王座') ||
                    result.tournament.includes('棋王') ||
                    result.tournament.includes('王将') ||
                    result.tournament.includes('棋聖') ||
                    result.tournament.includes('叡王');

                  const isLadyTitle =
                    result.category === '女流タイトル戦' ||
                    result.tournament.includes('白玲') ||
                    result.tournament.includes('清麗') ||
                    result.tournament.includes('女王') ||
                    result.tournament.includes('女流王座') ||
                    result.tournament.includes('女流名人') ||
                    result.tournament.includes('女流王位') ||
                    result.tournament.includes('女流王将') ||
                    result.tournament.includes('倉敷藤花');

                  const badgeClass = isTitle
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : isLadyTitle
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                    : result.isWomen
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : result.category === '順位戦'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700';

                  return (
                    <div
                      key={result.id}
                      className={`bg-zinc-900/90 rounded-2xl p-3 sm:p-4 border transition hover:border-zinc-700 ${
                        isSenteOshi || isGoteOshi
                          ? 'border-rose-500/30 bg-gradient-to-r from-zinc-900 via-zinc-900 to-rose-950/20'
                          : 'border-zinc-800'
                      }`}
                    >
                      {/* Top Row: Tournament & Round & Venue */}
                      <div className="flex items-center justify-between gap-2 text-xs mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}
                          >
                            {result.tournament}
                          </span>
                          {result.note && (
                            <span className="text-[11px] text-zinc-400 font-medium truncate">
                              {result.note}
                            </span>
                          )}
                        </div>

                        {result.venue && (
                          <span className="text-[11px] text-zinc-400 flex-shrink-0">
                            {result.venue}
                          </span>
                        )}
                      </div>

                      {/* Main Matchup Arena */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-zinc-950/60 p-2.5 sm:p-3 rounded-xl border border-zinc-800/80">
                        {/* Sente Player (Left) */}
                        <div
                          onClick={() => handlePlayerClick(result.sente)}
                          className={`flex items-center gap-2 cursor-pointer p-1 rounded-lg transition hover:bg-zinc-800/40 ${
                            isSenteWinner ? 'font-bold' : 'opacity-85'
                          }`}
                        >
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-amber-400 border border-zinc-700">
                              ▲先手
                            </span>
                            <div className="mt-1">
                              {isSenteWinner ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1 rounded">
                                  {result.resultType === 'fusen' ? '□不戦勝' : '○勝ち'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] text-zinc-400 bg-zinc-900 px-1 rounded">
                                  {result.resultType === 'fusen' ? '■不戦敗' : '●'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-sm truncate ${
                                  isSenteWinner ? 'text-zinc-100 font-bold' : 'text-zinc-300'
                                }`}
                              >
                                {result.sente}
                              </span>
                              {isSenteOshi && (
                                <span className="flex-shrink-0 text-rose-400" title="推し棋士">
                                  <Heart size={13} className="fill-rose-400" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 block truncate">
                              {result.senteRaw.includes('※') ? 'LPSA / 女流' : '日本将棋連盟'}
                            </span>
                          </div>
                        </div>

                        {/* VS Center Marker */}
                        <div className="flex flex-col items-center justify-center px-1">
                          <span className="text-[11px] font-extrabold text-zinc-400 tracking-wider">
                            VS
                          </span>
                          {result.resultType === 'sennichite' && (
                            <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 rounded">
                              千日手
                            </span>
                          )}
                          {result.resultType === 'jishogi' && (
                            <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-1 rounded">
                              持将棋
                            </span>
                          )}
                        </div>

                        {/* Gote Player (Right) */}
                        <div
                          onClick={() => handlePlayerClick(result.gote)}
                          className={`flex items-center justify-end gap-2 cursor-pointer p-1 rounded-lg transition hover:bg-zinc-800/40 text-right ${
                            isGoteWinner ? 'font-bold' : 'opacity-85'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center justify-end gap-1">
                              {isGoteOshi && (
                                <span className="flex-shrink-0 text-rose-400" title="推し棋士">
                                  <Heart size={13} className="fill-rose-400" />
                                </span>
                              )}
                              <span
                                className={`text-sm truncate ${
                                  isGoteWinner ? 'text-zinc-100 font-bold' : 'text-zinc-300'
                                }`}
                              >
                                {result.gote}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 block truncate">
                              {result.goteRaw.includes('※') ? 'LPSA / 女流' : '日本将棋連盟'}
                            </span>
                          </div>

                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              △後手
                            </span>
                            <div className="mt-1">
                              {isGoteWinner ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1 rounded">
                                  {result.resultType === 'fusen' ? '□不戦勝' : '○勝ち'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] text-zinc-400 bg-zinc-900 px-1 rounded">
                                  {result.resultType === 'fusen' ? '■不戦敗' : '●'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Links & Kifu */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {result.links && result.links.length > 0 ? (
                            result.links.map((link, idx) => (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition"
                              >
                                <ExternalLink size={11} />
                                {link.title}
                              </a>
                            ))
                          ) : (
                            <span className="text-[10px] text-zinc-400">公式戦終局</span>
                          )}
                        </div>


                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
