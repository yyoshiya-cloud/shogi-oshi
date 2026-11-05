import React, { useState, useEffect, useMemo, memo } from 'react';
import { Player, FollowedPlayerConfig, OshiBadge, PlayerAffiliation } from '../types/shogi';
import { KishibetsuSyncPanel } from './KishibetsuSyncPanel';
import { OshiConfigModal } from './OshiConfigModal';
import { getPlayerTotalTitles, isEiseiPlayer, formatEiseiBadgeLabel } from '../utils/titleUtils';
import { formatPlayerName, isPlayerOnLeave, isPlayerRetired } from '../utils/playerUtils';
import { formatProRyuoClass, formatProJunisenClass } from './PlayerProfileModal';
import { OshiBadgeTag } from '../utils/badgeUtils';
import {
  Search,
  Heart,
  Trophy,
  Crown,
  SlidersHorizontal,
  Check,
  UserCheck,
  Sparkles,
  ChevronRight,
  RefreshCw,
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
  onUpdateAllPlayers?: (players: Player[]) => void;
  isSyncingPlayers?: boolean;
  lastSyncTime?: string | null;
  onSyncPlayers?: (force?: boolean) => void;
  onRefreshMatches?: () => void;
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

function normalizeRankForFilter(rank: string): string {
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

function matchesRankFilter(playerOrRank: Player | string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === '永世') {
    if (typeof playerOrRank === 'string') {
      return playerOrRank.includes('永世') || playerOrRank.includes('名誉') || playerOrRank.includes('クイーン');
    }
    return isEiseiPlayer(playerOrRank);
  }
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

function matchJunisenFilter(p: Player, filter: string): boolean {
  if (filter === 'all') return true;
  if (p.type === 'women') {
    const jc = p.junisenClass || '';
    if (filter === '白玲') return jc.includes('白玲') || (p.heldTitles && p.heldTitles.includes('白玲'));
    if (filter === '女流A級') return jc.startsWith('A級');
    if (filter === '女流B級') return jc.startsWith('B級');
    if (filter === '女流C級') return jc.startsWith('C級');
    if (filter === '女流D級') return jc.startsWith('D級');
    if (filter === '女流フリークラス') return jc.includes('フリークラス');
    return false;
  }

  const formatted = formatProJunisenClass(p);
  if (filter === '名人') return formatted.includes('名人');
  if (filter === 'A級') return formatted === 'A級' || formatted.startsWith('A級');
  if (filter === 'B級1組') return formatted.includes('B級1組');
  if (filter === 'B級2組') return formatted.includes('B級2組');
  if (filter === 'C級1組') return formatted.includes('C級1組');
  if (filter === 'C級2組') return formatted.includes('C級2組');
  if (filter === 'フリークラス') return formatted === 'フリークラス';
  if (filter === '未参加') return formatted === '未参加';
  return false;
}

function matchRyuoFilter(p: Player, filter: string): boolean {
  if (filter === 'all') return true;
  if (p.type === 'women') return false;
  const formatted = formatProRyuoClass(p);
  if (filter === '竜王') return formatted.includes('竜王') && !formatted.includes('組');
  if (['1組', '2組', '3組', '4組', '5組', '6組'].includes(filter)) {
    return formatted === filter || formatted.includes(filter);
  }
  if (filter === '未参加') return formatted === '未参加';
  return false;
}

const PRO_RANKS = ['九段', '八段', '七段', '六段', '五段', '四段'];
const WOMEN_RANKS = ['女流七段', '女流六段', '女流五段', '女流四段', '女流三段', '女流二段', '女流初段', '女流1級', '女流2級'];

interface PlayerCardItemProps {
  player: Player;
  isFollowed: boolean;
  followConfig?: FollowedPlayerConfig;
  onSelectPlayer: (player: Player) => void;
  onOpenConfig: (player: Player, config?: FollowedPlayerConfig | null) => void;
}

/**
 * Optimized and memoized Player Card component ensuring immediate, efficient rendering of career title badges.
 */
const PlayerCardItem = memo(({ player, isFollowed, followConfig, onSelectPlayer, onOpenConfig }: PlayerCardItemProps) => {
  const badgeStyle = isFollowed && followConfig ? BADGE_COLORS[followConfig.badge] : null;
  const aff: PlayerAffiliation = player.affiliation || '日本将棋連盟';
  const affStyle = AFFILIATION_COLORS[aff];

  // Memoized total titles calculation
  const totalTitles = useMemo(() => getPlayerTotalTitles(player), [player]);

  const onLeave = isPlayerOnLeave(player);
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

            {isPlayerRetired(player) && (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300 border border-zinc-600">
                引退
              </span>
            )}

            {onLeave && (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                休場中
              </span>
            )}

            {isFollowed && followConfig && (
              <OshiBadgeTag badge={followConfig.badge} size="xs" />
            )}
          </div>

          {/* 竜王戦・順位戦クラスバッジ（棋士番号の直下行に独立配置） */}
          {player.type !== 'women' && (
            <div className="flex items-center gap-1.5 flex-wrap my-1">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-600/40">
                竜王戦 {formatProRyuoClass(player)}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700">
                順位戦 {formatProJunisenClass(player)}
              </span>
            </div>
          )}
          {player.type === 'women' && player.junisenClass && player.junisenClass !== '-' && (
            <div className="flex items-center gap-1.5 flex-wrap my-1">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700">
                女流順位戦 {player.junisenClass}
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-black text-zinc-100 font-serif-jp tracking-wide group-hover:text-amber-300 transition-colors">
              {formatPlayerName(player.name)}
            </h3>
            <span className="text-xs sm:text-sm font-bold text-amber-400 font-serif-jp ml-1">
              {player.danRank && !player.rank.includes(player.danRank)
                ? `${player.rank} (${player.danRank})`
                : player.rank}
            </span>
          </div>

          {/* 2段目: 門下 / 得意戦型 */}
          <div className="text-[11px] text-zinc-400 mt-0.5 font-medium leading-tight">
            {player.master
              ? `${player.master}門下 / ${player.style || '居飛車'}`
              : player.birthPlace
              ? `${player.birthPlace} / ${player.style || '居飛車'}`
              : player.style || '居飛車'}
          </div>

          {/* Titles / Career Titles / Eisei Qualification Badges */}
          {(() => {
            const eiseiBadge = formatEiseiBadgeLabel(player);
            const hasTitlesOrEisei = player.heldTitles.length > 0 || totalTitles > 0 || !!eiseiBadge;
            if (!hasTitlesOrEisei) return null;

            return (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {eiseiBadge && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-0.5 shadow-sm">
                    <Crown size={9} className="text-amber-400 fill-amber-400/50" />
                    {eiseiBadge}
                  </span>
                )}
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
            );
          })()}

          {/* Cheering Note Display */}
          {isFollowed && followConfig?.cheeringNote && (
            <div className="mt-1 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 max-w-full truncate">
              <span>💬</span>
              <span className="truncate">{followConfig.cheeringNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* Center/Right Stats & Actions */}
      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/70">
        <div className="flex items-center gap-3 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/60 text-xs">
          <div>
            <span className="text-[9px] text-zinc-500 block">通算成績</span>
            <span className="font-bold text-zinc-200 font-serif-jp">
              {player.careerWins > 0 || player.careerLosses > 0 ? `${player.careerWins}勝${player.careerLosses}敗` : '0勝0敗'}
            </span>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div>
            <span className="text-[9px] text-zinc-500 block">今年度成績</span>
            <span className="font-bold text-emerald-400 font-serif-jp">
              {onLeave ? (
                <span className="text-amber-400 text-[11px] font-bold">休場中</span>
              ) : player.currentYearWins > 0 || player.currentYearLosses > 0 ? (
                `${(player.currentYearWinRate * 100).toFixed(0)}%`
              ) : (
                '0%'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFollowed && followConfig ? (
            <OshiBadgeTag badge={followConfig.badge} size="sm" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenConfig(player, null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow hover:shadow-rose-600/30 transition cursor-pointer"
              title="本命・神推し・激推しバッジや推しカラーを選んで登録"
            >
              <Heart size={13} className="fill-white" />
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
  onUpdateAllPlayers,
  isSyncingPlayers = false,
  lastSyncTime,
  onSyncPlayers,
  onRefreshMatches,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pro' | 'women'>('all');
  const [affiliationFilter, setAffiliationFilter] = useState<PlayerAffiliation | 'all' | 'oshi'>('all');
  const [titleFilter, setTitleFilter] = useState<'all' | 'hasTitle' | 'noTitle'>('all');
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [junisenFilter, setJunisenFilter] = useState<string>('all');
  const [ryuoFilter, setRyuoFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'wins' | 'winrate' | 'titles'>('number');
  const [configuringPlayer, setConfiguringPlayer] = useState<{ player: Player; config?: FollowedPlayerConfig | null } | null>(null);

  const followedMap = useMemo(() => {
    return new Map(followedList.map((f) => [f.playerId, f]));
  }, [followedList]);

  // Helper to count matching players for a given rank under current filterType, affiliationFilter & titleFilter
  const getRankCount = (rank: string) => {
    return players.filter((p) => {
      if (filterType === 'pro' && p.type === 'women') return false;
      if (filterType === 'women' && p.type !== 'women') return false;
      if (affiliationFilter === 'oshi') {
        if (!followedMap.has(p.id)) return false;
      } else if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) {
        return false;
      }
      if (titleFilter === 'hasTitle' && (!p.heldTitles || p.heldTitles.length === 0)) return false;
      if (titleFilter === 'noTitle' && p.heldTitles && p.heldTitles.length > 0) return false;
      if (!matchJunisenFilter(p, junisenFilter)) return false;
      if (!matchRyuoFilter(p, ryuoFilter)) return false;
      return matchesRankFilter(p, rank);
    }).length;
  };

  // When filterType becomes 'pro', restrict affiliationFilter if it was LPSA or 無所属
  useEffect(() => {
    if (filterType === 'pro' && (affiliationFilter === 'LPSA' || affiliationFilter === '無所属')) {
      setAffiliationFilter('日本将棋連盟');
    }
  }, [filterType, affiliationFilter]);

  // If selected rankFilter has 0 matching players under current filterType, affiliationFilter & titleFilter, reset to 'all'
  useEffect(() => {
    if (rankFilter !== 'all' && getRankCount(rankFilter) === 0) {
      setRankFilter('all');
    }
  }, [filterType, affiliationFilter, titleFilter, rankFilter, junisenFilter, ryuoFilter, players]);

  // Filter and sort players with guaranteed total titles and reactive recalculation
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
        if (filterType === 'pro' && p.type === 'women') return false;
        if (filterType === 'women' && p.type !== 'women') return false;

        if (affiliationFilter === 'oshi') {
          if (!followedMap.has(p.id)) return false;
        } else if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) {
          return false;
        }

        if (affiliationFilter !== 'oshi') {
          if (titleFilter === 'hasTitle' && (!p.heldTitles || p.heldTitles.length === 0)) return false;
          if (titleFilter === 'noTitle' && p.heldTitles && p.heldTitles.length > 0) return false;

          if (!matchesRankFilter(p, rankFilter)) return false;
          if (!matchJunisenFilter(p, junisenFilter)) return false;
          if (!matchRyuoFilter(p, ryuoFilter)) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = p.name.toLowerCase().includes(q);
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
  }, [players, followedMap, filterType, affiliationFilter, titleFilter, rankFilter, junisenFilter, ryuoFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
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
        </div>
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
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'bg-zinc-950 text-rose-400 hover:text-rose-300 border border-rose-900/50'
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

            {/* 推し棋士ボタン */}
            <button
              type="button"
              onClick={() => setAffiliationFilter((prev) => (prev === 'oshi' ? 'all' : 'oshi'))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                affiliationFilter === 'oshi'
                  ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30'
                  : 'bg-zinc-950 text-rose-300 hover:text-rose-200 border border-rose-500/40'
              }`}
            >
              <Heart size={11} className="fill-current text-rose-400" />
              <span>推し棋士</span>
              <span className="text-[10px] opacity-80">
                ({followedList.length})
              </span>
            </button>
          </div>

          {/* Title Filter (タイトル: あり / なし) */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className={`font-semibold mr-1 transition-colors ${affiliationFilter === 'oshi' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              タイトル:
            </span>
            <button
              type="button"
              disabled={affiliationFilter === 'oshi'}
              onClick={() => setTitleFilter((prev) => (prev === 'hasTitle' ? 'all' : 'hasTitle'))}
              title={affiliationFilter === 'oshi' ? '推し棋士選択時は不活性' : undefined}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                affiliationFilter === 'oshi'
                  ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                  : titleFilter === 'hasTitle'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                  : 'bg-zinc-950 text-amber-400 hover:text-amber-300 border border-zinc-800'
              }`}
            >
              <span>あり</span>
              <span className="text-[10px] opacity-80">
                ({players.filter((p) => {
                  if (filterType === 'pro' && p.type === 'women') return false;
                  if (filterType === 'women' && p.type !== 'women') return false;
                  if (affiliationFilter === 'oshi') {
                    if (!followedMap.has(p.id)) return false;
                  } else if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) {
                    return false;
                  }
                  return p.heldTitles && p.heldTitles.length > 0;
                }).length})
              </span>
            </button>
            <button
              type="button"
              disabled={affiliationFilter === 'oshi'}
              onClick={() => setTitleFilter((prev) => (prev === 'noTitle' ? 'all' : 'noTitle'))}
              title={affiliationFilter === 'oshi' ? '推し棋士選択時は不活性' : undefined}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                affiliationFilter === 'oshi'
                  ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                  : titleFilter === 'noTitle'
                  ? 'bg-zinc-700 text-white font-bold shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <span>なし</span>
              <span className="text-[10px] opacity-80">
                ({players.filter((p) => {
                  if (filterType === 'pro' && p.type === 'women') return false;
                  if (filterType === 'women' && p.type !== 'women') return false;
                  if (affiliationFilter === 'oshi') {
                    if (!followedMap.has(p.id)) return false;
                  } else if (affiliationFilter !== 'all' && p.affiliation !== affiliationFilter) {
                    return false;
                  }
                  return !p.heldTitles || p.heldTitles.length === 0;
                }).length})
              </span>
            </button>
          </div>

          {/* Rank Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className={`font-semibold mr-1 transition-colors ${affiliationFilter === 'oshi' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              段位:
            </span>
            <button
              type="button"
              disabled={affiliationFilter === 'oshi'}
              onClick={() => setRankFilter('all')}
              title={affiliationFilter === 'oshi' ? '推し棋士選択時は不活性' : undefined}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                affiliationFilter === 'oshi'
                  ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                  : rankFilter === 'all'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              すべて
            </button>

            {/* 永世 Tab */}
            {(() => {
              const count = getRankCount('永世');
              const isEiseiDisabled = affiliationFilter === 'oshi' || count === 0;
              return (
                <button
                  type="button"
                  disabled={isEiseiDisabled}
                  onClick={() => setRankFilter('永世')}
                  title={isEiseiDisabled ? '不活性' : '永世称号・クイーン称号資格保持者'}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
                    isEiseiDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === '永世'
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                      : 'bg-zinc-950 text-amber-300 hover:bg-zinc-800 border border-amber-500/40'
                  }`}
                >
                  <span>永世</span>
                  <span className="text-[9px] opacity-80">({count})</span>
                </button>
              );
            })()}

            {/* Pro Ranks */}
            {PRO_RANKS.map((rank) => {
              const count = getRankCount(rank);
              const isProDisabled = affiliationFilter === 'oshi' || filterType === 'women' || count === 0;
              return (
                <button
                  key={rank}
                  disabled={isProDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isProDisabled ? '不活性' : undefined}
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
              const isWomenDisabled = affiliationFilter === 'oshi' || filterType === 'pro' || count === 0;
              return (
                <button
                  key={rank}
                  disabled={isWomenDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isWomenDisabled ? '不活性' : undefined}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                    isWomenDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === rank
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'bg-zinc-950 text-rose-400 hover:text-rose-300 border border-zinc-800 font-semibold'
                  }`}
                >
                  {rank} <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Class Filters (順位戦クラス & 竜王戦クラス Dropdowns) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2.5 border-t border-zinc-800/80">
            {/* 順位戦クラス Dropdown */}
            <div className="flex items-center gap-2 flex-1">
              <label htmlFor="junisen-filter" className="text-zinc-400 font-semibold text-xs whitespace-nowrap shrink-0 flex items-center gap-1">
                <Trophy size={13} className="text-amber-400" />
                <span>順位戦:</span>
              </label>
              <select
                id="junisen-filter"
                value={junisenFilter}
                onChange={(e) => setJunisenFilter(e.target.value)}
                className={`bg-zinc-950 border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 transition w-full cursor-pointer font-medium ${
                  junisenFilter !== 'all'
                    ? 'border-amber-500/80 text-amber-300 font-bold bg-amber-950/20'
                    : 'border-zinc-800 text-zinc-200'
                }`}
              >
                <option value="all">順位戦クラス: すべて</option>
                <optgroup label="棋士 順位戦">
                  <option value="名人">名人 (1名)</option>
                  <option value="A級">A級 (10名)</option>
                  <option value="B級1組">B級1組 (13名)</option>
                  <option value="B級2組">B級2組 (27名)</option>
                  <option value="C級1組">C級1組 (31名)</option>
                  <option value="C級2組">C級2組 (54名)</option>
                  <option value="フリークラス">フリークラス (31名)</option>
                </optgroup>
                <optgroup label="女流棋士 白玲戦・女流順位戦">
                  <option value="白玲">白玲 (1名)</option>
                  <option value="女流A級">女流A級 (10名)</option>
                  <option value="女流B級">女流B級 (10名)</option>
                  <option value="女流C級">女流C級 (19名)</option>
                  <option value="女流D級">女流D級 (36名)</option>
                  <option value="女流フリークラス">女流フリークラス (5名)</option>
                </optgroup>
              </select>
            </div>

            {/* 竜王戦クラス Dropdown */}
            <div className="flex items-center gap-2 flex-1">
              <label htmlFor="ryuo-filter" className="text-zinc-400 font-semibold text-xs whitespace-nowrap shrink-0 flex items-center gap-1">
                <Trophy size={13} className="text-amber-400" />
                <span>竜王戦:</span>
              </label>
              <select
                id="ryuo-filter"
                value={ryuoFilter}
                onChange={(e) => setRyuoFilter(e.target.value)}
                className={`bg-zinc-950 border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 transition w-full cursor-pointer font-medium ${
                  ryuoFilter !== 'all'
                    ? 'border-amber-500/80 text-amber-300 font-bold bg-amber-950/20'
                    : 'border-zinc-800 text-zinc-200'
                }`}
              >
                <option value="all">竜王戦クラス: すべて</option>
                <option value="竜王">竜王 (1名)</option>
                <option value="1組">1組 (16名)</option>
                <option value="2組">2組 (16名)</option>
                <option value="3組">3組 (16名)</option>
                <option value="4組">4組 (32名)</option>
                <option value="5組">5組 (31名)</option>
                <option value="6組">6組 (52名)</option>
                <option value="未参加">未参加 (10名)</option>
              </select>
            </div>

            {/* Reset button if class filter active */}
            {(junisenFilter !== 'all' || ryuoFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setJunisenFilter('all');
                  setRyuoFilter('all');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs border border-amber-500/30 transition shrink-0 cursor-pointer flex items-center justify-center gap-1"
                title="クラス指定を解除"
              >
                <X size={13} />
                <span>クラス解除</span>
              </button>
            )}
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
                onOpenConfig={(p, cfg) => setConfiguringPlayer({ player: p, config: cfg })}
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
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition shadow cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>フィルターをすべてリセット（全256名を表示）</span>
            </button>
          </div>
        )}
      </div>

      {/* Oshi Badge & Config Modal */}
      {configuringPlayer && (
        <OshiConfigModal
          player={configuringPlayer.player}
          currentConfig={configuringPlayer.config}
          onSave={(newConfig) => {
            onToggleFollow(newConfig);
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
            setConfiguringPlayer(null);
          }}
          onRemove={(playerId) => {
            onRemoveFollow(playerId);
            setConfiguringPlayer(null);
          }}
          onClose={() => setConfiguringPlayer(null)}
        />
      )}
    </div>
  );
};
