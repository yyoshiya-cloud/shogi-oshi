import React, { useState, useEffect, useMemo, memo } from 'react';
import { Player, FollowedPlayerConfig, OshiBadge, PlayerType, PlayerAffiliation } from '../types/shogi';
import { KishibetsuSyncPanel } from './KishibetsuSyncPanel';
import { getPlayerTotalTitles } from '../utils/titleUtils';
import { formatPlayerName } from '../utils/playerUtils';
import {
  Search,
  Heart,
  Trophy,
  SlidersHorizontal,
  Plus,
  Check,
  UserCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  DownloadCloud,
  RefreshCw,
  Globe,
  Building,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlayerDirectoryProps {
  players: Player[];
  followedList: FollowedPlayerConfig[];
  onToggleFollow: (config: FollowedPlayerConfig) => void;
  onRemoveFollow: (playerId: string) => void;
  onSelectPlayer: (player: Player) => void;
  onImportScrapedPlayer?: (player: Player) => void;
  isSyncingPlayers?: boolean;
  lastSyncTime?: string | null;
  onSyncPlayers?: (force?: boolean) => void;
}

const BADGE_COLORS: Record<OshiBadge, { bg: string; text: string; border: string }> = {
  本命: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' },
  神推し: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
  激推し: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  注目: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40' },
};

const AFFILIATION_COLORS: Record<PlayerAffiliation, { bg: string; text: string; border: string }> = {
  日本将棋連盟: { bg: 'bg-zinc-800', text: 'text-zinc-300', border: 'border-zinc-700' },
  LPSA: { bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-700/60' },
  無所属: { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-700/60' },
};

export function normalizeRankForFilter(rank: string): string {
  if (!rank) return '';
  return rank
    .replace(/１/g, '1')
    .replace(/２/g, '2')
    .replace(/３/g, '3')
    .replace(/４/g, '4')
    .replace(/５/g, '5')
    .replace(/６/g, '6')
    .replace(/７/g, '7')
    .replace(/８/g, '8')
    .replace(/９/g, '9')
    .replace(/女流一級/g, '女流1級')
    .replace(/女流二級/g, '女流2級')
    .replace(/女流１級/g, '女流1級')
    .replace(/女流２級/g, '女流2級');
}

export function matchesRankFilter(playerOrRank: Player | string, filter: string): boolean {
  if (filter === 'all') return true;
  const rankStr =
    typeof playerOrRank === 'string'
      ? playerOrRank
      : `${playerOrRank.rank} ${playerOrRank.danRank || ''}`;
  const isWomen =
    typeof playerOrRank === 'string'
      ? playerOrRank.includes('女流')
      : playerOrRank.type === 'women' || playerOrRank.rank.includes('女流') || (playerOrRank.danRank && playerOrRank.danRank.includes('女流'));

  const normRank = normalizeRankForFilter(rankStr);
  const normFilter = normalizeRankForFilter(filter);

  if (PRO_RANKS.includes(filter)) {
    return normRank.includes(normFilter) && !isWomen;
  }
  return normRank.includes(normFilter);
}

export const PRO_RANKS = ['九段', '八段', '七段', '六段', '五段', '四段'];
export const WOMEN_RANKS = ['女流七段', '女流六段', '女流五段', '女流四段', '女流三段', '女流二段', '女流初段', '女流1級', '女流2級'];

interface PlayerCardItemProps {
  player: Player;
  isFollowed: boolean;
  followConfig?: FollowedPlayerConfig;
  onSelectPlayer: (player: Player) => void;
  onToggleFollow: (config: FollowedPlayerConfig) => void;
}

/**
 * Optimized and memoized Player Card component ensuring immediate, efficient rendering of career title badges.
 */
const PlayerCardItem = memo(({ player, isFollowed, followConfig, onSelectPlayer, onToggleFollow }: PlayerCardItemProps) => {
  const badgeStyle = isFollowed && followConfig ? BADGE_COLORS[followConfig.badge] : null;
  const aff: PlayerAffiliation = player.affiliation || '日本将棋連盟';
  const affStyle = AFFILIATION_COLORS[aff];

  // Memoized total titles calculation
  const totalTitles = useMemo(() => getPlayerTotalTitles(player), [player]);

  const hasCareerStats = player.careerWins > 0 || player.careerLosses > 0;
  const hasYearStats = player.currentYearWins > 0 || player.currentYearLosses > 0;

  return (
    <div
      onClick={() => onSelectPlayer(player)}
      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group hover:border-amber-500/50 ${
        isFollowed && followConfig
          ? 'bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/20 border-amber-500/50 shadow-md'
          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
      }`}
    >
      {/* Left Accent Strip */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1.5 transition-all"
        style={{ backgroundColor: isFollowed && followConfig ? followConfig.color : (player.type === 'women' ? '#ec4899' : '#3b82f6') }}
      />

      {/* Left Info: Avatar/Initial, Name, Rank, Affiliation */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black font-serif-jp shadow-md border border-white/20 bg-zinc-900 text-amber-400 flex-shrink-0 overflow-hidden relative"
          style={{ backgroundColor: player.type === 'women' ? '#ec4899' : '#3b82f6' }}
        >
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt={player.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            player.name[0]
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                player.type === 'women'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {player.type === 'women' ? '女流棋士' : '棋士'} No.{player.playerNumber}
            </span>

            <span
              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${affStyle.bg} ${affStyle.text} ${affStyle.border}`}
            >
              {aff}
            </span>

            {(player.rank.includes('引退') || player.shortBio?.includes('引退') || player.titleHistory?.includes('引退')) && (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300 border border-zinc-600">
                引退
              </span>
            )}

            {isFollowed && badgeStyle && followConfig && (
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
              >
                <Heart size={10} className="fill-current" />
                {followConfig.badge}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-black text-zinc-100 font-serif-jp tracking-wide group-hover:text-amber-300 transition-colors">
              {formatPlayerName(player.name)}
            </h3>
            <span className="text-xs font-bold text-amber-400 font-serif-jp">
              {player.danRank && !player.rank.includes(player.danRank)
                ? `${player.rank} (${player.danRank})`
                : player.rank}
            </span>
            <span className="text-[11px] text-zinc-400">
              {player.master ? `${player.master}門下 / ` : player.birthPlace ? `${player.birthPlace} / ` : ''}{player.style || '居飛車'}
            </span>
          </div>

          {/* Titles / Career Titles Badges */}
          {(player.heldTitles.length > 0 || totalTitles > 0) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {player.heldTitles.map((t) => (
                <span
                  key={t}
                  className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40"
                >
                  {t}
                </span>
              ))}
              {totalTitles > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300/90 border border-amber-500/30 flex items-center gap-0.5">
                  <Trophy size={9} className="text-amber-400" />
                  通算獲得 {totalTitles}期
                </span>
              )}
            </div>
          )}

          {isFollowed && followConfig && followConfig.cheeringNote && (
            <p className="text-[11px] text-amber-200/90 italic mt-1">
              「{followConfig.cheeringNote}」
            </p>
          )}
        </div>
      </div>

      {/* Center/Right Stats & Actions */}
      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/70">
        <div className="flex items-center gap-3 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/60 text-xs">
          <div>
            <span className="text-[9px] text-zinc-500 block">通算成績</span>
            <span className="font-bold text-zinc-200 font-serif-jp">
              {hasCareerStats ? `${player.careerWins}勝${player.careerLosses}敗` : '公式戦現役'}
            </span>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div>
            <span className="text-[9px] text-zinc-500 block">今年度勝率</span>
            <span className="font-bold text-emerald-400 font-serif-jp">
              {hasYearStats ? `${(player.currentYearWinRate * 100).toFixed(0)}%` : '対局中'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFollowed ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <UserCheck size={13} />
              <span>推し中</span>
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow({
                  playerId: player.id,
                  badge: '注目',
                  color: '#f59e0b',
                  cheeringNote: '',
                  notificationsEnabled: true,
                  notifyTiming: {
                    dayBefore: false,
                    morningOf: true,
                    matchStart: true,
                    resultImmediately: true
                  },
                  cheerCount: 0,
                  followedAt: new Date().toISOString(),
                  fanComments: []
                });
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold shadow hover:brightness-110 transition"
            >
              <Heart size={13} />
              <span>推し登録</span>
            </button>
          )}
          <ChevronRight size={16} className="text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </div>
  );
});

export const PlayerDirectory: React.FC<PlayerDirectoryProps> = ({
  players,
  followedList,
  onToggleFollow,
  onRemoveFollow,
  onSelectPlayer,
  onImportScrapedPlayer,
  isSyncingPlayers = false,
  lastSyncTime,
  onSyncPlayers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pro' | 'women'>('all');
  const [affiliationFilter, setAffiliationFilter] = useState<PlayerAffiliation | 'all'>('all');
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'wins' | 'winrate' | 'titles'>('number');
  const [showOnlyFollowed, setShowOnlyFollowed] = useState(false);

  const followedMap = useMemo(() => {
    return new Map(followedList.map((f) => [f.playerId, f]));
  }, [followedList]);

  // Helper to count matching players for a given rank under current filterType & affiliationFilter
  const getRankCount = (rank: string) => {
    return players.filter((p) => {
      if (filterType === 'pro' && p.type === 'women') return false;
      if (filterType === 'women' && p.type !== 'women') return false;
      if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) return false;
      return matchesRankFilter(p, rank);
    }).length;
  };

  // When filterType becomes 'pro', restrict affiliationFilter to '日本将棋連盟'
  useEffect(() => {
    if (filterType === 'pro' && affiliationFilter !== '日本将棋連盟') {
      setAffiliationFilter('日本将棋連盟');
    }
  }, [filterType, affiliationFilter]);

  // If selected rankFilter has 0 matching players under current filterType & affiliationFilter, reset to 'all'
  useEffect(() => {
    if (rankFilter !== 'all' && getRankCount(rankFilter) === 0) {
      setRankFilter('all');
    }
  }, [filterType, affiliationFilter, rankFilter, players]);

  // Filter and sort players with guaranteed total titles and reactive recalculation
  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => {
        if (showOnlyFollowed && !followedMap.has(p.id)) return false;

        if (filterType === 'pro' && p.type === 'women') return false;
        if (filterType === 'women' && p.type !== 'women') return false;

        if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) return false;

        if (!matchesRankFilter(p, rankFilter)) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = p.name.toLowerCase().includes(q) || (p.kana && p.kana.toLowerCase().includes(q)) || (p.romaji && p.romaji.toLowerCase().includes(q));
          const numMatch = p.playerNumber?.toString().includes(q);
          const titleMatch = p.heldTitles.some((t) => t.toLowerCase().includes(q));
          const masterMatch = p.master && p.master.toLowerCase().includes(q);
          const birthMatch = p.birthPlace && p.birthPlace.toLowerCase().includes(q);
          if (!nameMatch && !numMatch && !titleMatch && !masterMatch && !birthMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wins') {
          return b.careerWins - a.careerWins;
        }
        if (sortBy === 'winrate') {
          return b.careerWinRate - a.careerWinRate;
        }
        if (sortBy === 'titles') {
          const tA = getPlayerTotalTitles(a);
          const tB = getPlayerTotalTitles(b);
          if (tB !== tA) return tB - tA;
          return b.careerWins - a.careerWins;
        }
        return (
          (a.type === 'women' ? 1 : 0) - (b.type === 'women' ? 1 : 0) ||
          (a.playerNumber || 999) - (b.playerNumber || 999)
        );
      });
  }, [players, followedMap, filterType, affiliationFilter, rankFilter, searchQuery, sortBy, showOnlyFollowed]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header & Kishibetsu Sync Panel */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white font-serif-jp flex items-center gap-2">
              <Sparkles className="text-amber-400" size={20} />
              <span>全棋士・女流棋士名鑑</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              日本将棋連盟・LPSA所属プロの公式戦通算成績、獲得タイトル、戦型データを網羅
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyFollowed(!showOnlyFollowed)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                showOnlyFollowed
                  ? 'bg-rose-600 text-white shadow-rose-600/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Heart size={14} className={showOnlyFollowed ? 'fill-current' : ''} />
              <span>推し棋士のみ ({followedList.length})</span>
            </button>
          </div>
        </div>

        {onSyncPlayers && (
          <KishibetsuSyncPanel
            players={players}
            onPlayersSynced={(updated) => {
              if (onImportScrapedPlayer) {
                updated.forEach((p) => onImportScrapedPlayer(p));
              }
            }}
          />
        )}
      </div>

      {/* Search & Filtering Toolbar */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-4 shadow-lg">
        {/* Search input & Sort dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="棋士名、かな、棋士番号、師匠、出身地、タイトル名で検索..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-500/60 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 rounded-md transition"
                title="検索入力をクリア"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SlidersHorizontal size={15} className="text-zinc-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500/60 transition w-full sm:w-auto"
            >
              <option value="number">並び順: 棋士番号順</option>
              <option value="titles">並び順: 通算獲得タイトル数</option>
              <option value="wins">並び順: 通算勝利数多い順</option>
              <option value="winrate">並び順: 勝率高い順</option>
            </select>
          </div>
        </div>

        {/* Category Tabs (All / Pro / Women) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterType === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            すべて ({players.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterType('pro');
              setAffiliationFilter('日本将棋連盟');
            }}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterType === 'pro'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            棋士 ({players.filter((p) => p.type !== 'women').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('women')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
              filterType === 'women'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            女流棋士 ({players.filter((p) => p.type === 'women').length})
          </button>
        </div>

        {/* Affiliation & Rank Filters */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-semibold mr-1">所属:</span>
            <button
              type="button"
              disabled={filterType === 'pro'}
              onClick={() => setAffiliationFilter('all')}
              title={filterType === 'pro' ? '棋士選択時は日本将棋連盟固定' : undefined}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterType === 'pro'
                  ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                  : affiliationFilter === 'all'
                  ? 'bg-zinc-700 text-white font-bold'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              すべて
            </button>
            {(['日本将棋連盟', 'LPSA', '無所属'] as PlayerAffiliation[]).map((aff) => {
              const isAffDisabled = filterType === 'pro' && aff !== '日本将棋連盟';
              return (
                <button
                  key={aff}
                  type="button"
                  disabled={isAffDisabled}
                  onClick={() => setAffiliationFilter(aff)}
                  title={isAffDisabled ? '棋士選択時は日本将棋連盟のみ選択可' : undefined}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    isAffDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : affiliationFilter === aff
                      ? 'bg-zinc-700 text-white font-bold'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {aff}
                </button>
              );
            })}
          </div>

          {/* Rank Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-zinc-400 font-semibold mr-1">段位:</span>
            <button
              type="button"
              onClick={() => setRankFilter('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                rankFilter === 'all'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              すべて
            </button>

            {/* Pro Ranks */}
            {PRO_RANKS.map((rank) => {
              const count = getRankCount(rank);
              const isProDisabled = filterType === 'women' || count === 0;
              return (
                <button
                  key={rank}
                  disabled={isProDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isProDisabled ? '該当棋士なし / 不活性' : undefined}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                    isProDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === rank
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {rank} <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}

            {/* Women Ranks */}
            {WOMEN_RANKS.map((rank) => {
              const count = getRankCount(rank);
              const isWomenDisabled = filterType === 'pro' || count === 0;
              return (
                <button
                  key={rank}
                  disabled={isWomenDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isWomenDisabled ? '該当女流棋士なし / 不活性' : undefined}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                    isWomenDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === rank
                      ? 'bg-rose-500 text-white font-bold shadow-sm'
                      : 'bg-zinc-950 text-rose-300 hover:bg-zinc-800 border border-zinc-800/80'
                  }`}
                >
                  {rank} <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Players List (Horizontal Row Layout with Memoized Cards) */}
      <div className="space-y-3">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player) => {
            const followConfig = followedMap.get(player.id);
            const isFollowed = !!followConfig;

            return (
              <PlayerCardItem
                key={player.id}
                player={player}
                isFollowed={isFollowed}
                followConfig={followConfig}
                onSelectPlayer={onSelectPlayer}
                onToggleFollow={onToggleFollow}
              />
            );
          })
        ) : (
          <div className="py-12 px-4 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3 bg-zinc-900/40">
            <AlertCircle className="mx-auto text-zinc-500" size={32} />
            <p className="text-sm font-bold text-zinc-200 font-serif-jp">該当する棋士が見つかりませんでした</p>
            <p className="text-xs text-zinc-400">検索条件やフィルターを変更して再度お試しください。</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setAffiliationFilter('all');
                setRankFilter('all');
                setShowOnlyFollowed(false);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition shadow cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>フィルターをすべてリセット（全256名を表示）</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
