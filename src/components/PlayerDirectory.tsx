import React, { useState } from 'react';
import { Player, FollowedPlayerConfig, OshiBadge, PlayerType, PlayerAffiliation } from '../types/shogi';
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
  AlertCircle
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

const THEME_COLORS = [
  '#f59e0b', // gold
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#0ea5e9', // sky
];

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

  // Pro Ranks (四段〜九段) should only match pro players (excluding 女流X段)
  if (PRO_RANKS.includes(filter)) {
    return normRank.includes(normFilter) && !isWomen;
  }

  // Women Ranks (女流2級, 女流1級, 女流初段, 女流二段...)
  return normRank.includes(normFilter);
}

export const PRO_RANKS = ['四段', '五段', '六段', '七段', '八段', '九段'];
export const WOMEN_RANKS = [
  '女流2級',
  '女流1級',
  '女流初段',
  '女流二段',
  '女流三段',
  '女流四段',
  '女流五段',
  '女流六段',
  '女流七段',
];

export const PlayerDirectory: React.FC<PlayerDirectoryProps> = ({
  players,
  followedList,
  onToggleFollow,
  onRemoveFollow,
  onSelectPlayer,
  onImportScrapedPlayer,
  isSyncingPlayers = false,
  lastSyncTime = null,
  onSyncPlayers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | PlayerType>('all');
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [affiliationFilter, setAffiliationFilter] = useState<'all' | PlayerAffiliation>('all');
  const [styleFilter, setStyleFilter] = useState<'all' | '居飛車' | '振り飛車'>('all');

  const handleSelectFilterType = (newType: 'all' | PlayerType) => {
    setFilterType(newType);
    if (newType === 'pro') {
      // 棋士選択時: LPSAと無所属は不活性。選択されていたら全所属にリセット
      if (affiliationFilter === 'LPSA' || affiliationFilter === '無所属') {
        setAffiliationFilter('all');
      }
      // 女流2級から女流七段は不活性。選択されていたら全段位にリセット
      if (WOMEN_RANKS.includes(rankFilter)) {
        setRankFilter('all');
      }
    } else if (newType === 'women') {
      // 女流棋士選択時: 棋士の四段から九段は不活性。選択されていたら全段位にリセット
      if (PRO_RANKS.includes(rankFilter)) {
        setRankFilter('all');
      }
    }
  };

  // Follow Registration Modal State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<OshiBadge>('本命');
  const [selectedColor, setSelectedColor] = useState<string>('#f59e0b');
  const [cheerNote, setCheerNote] = useState<string>('');

  // Manual Add Player State (allowing registration of all active shogi players with rank selection)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKana, setNewKana] = useState('');
  const [newType, setNewType] = useState<PlayerType>('pro');
  const [newRank, setNewRank] = useState('九段');
  const [newAffiliation, setNewAffiliation] = useState<PlayerAffiliation>('日本将棋連盟');
  const [newStyle, setNewStyle] = useState<Player['style']>('居飛車');
  const [newMaster, setNewMaster] = useState('');

  const followedMap = new Map(followedList.map((f) => [f.playerId, f]));

  // Open modal for registration
  const handleOpenFollowModal = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = followedMap.get(p.id);
    if (existing) {
      setSelectedBadge(existing.badge);
      setSelectedColor(existing.color);
      setCheerNote(existing.cheeringNote);
    } else {
      setSelectedBadge('本命');
      setSelectedColor(p.colorAccent || '#f59e0b');
      setCheerNote(p.type === 'women' ? 'タイトル獲得を全力応援！' : '全冠制覇＆勝利を応援！');
    }
    setEditingPlayer(p);
  };

  // Submit follow registration
  const handleSaveFollow = () => {
    if (!editingPlayer) return;

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });

    const existing = followedMap.get(editingPlayer.id);
    const newConfig: FollowedPlayerConfig = {
      playerId: editingPlayer.id,
      badge: selectedBadge,
      color: selectedColor,
      cheeringNote: cheerNote.trim() || '全力応援！',
      notificationsEnabled: true,
      notifyTiming: existing?.notifyTiming || {
        dayBefore: true,
        morningOf: true,
        matchStart: true,
        resultImmediately: true,
      },
      cheerCount: existing ? existing.cheerCount : 1,
      followedAt: existing?.followedAt || new Date().toISOString(),
      fanComments: existing?.fanComments || [],
    };

    onToggleFollow(newConfig);
    setEditingPlayer(null);
  };

  // Submit manual custom player addition (all active shogi players registration)
  const handleAddCustomPlayer = () => {
    if (!newName.trim()) return;

    const customPlayer: Player = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      kana: newKana.trim() || newName.trim(),
      romaji: '',
      type: newType,
      rank: newRank,
      playerNumber: Math.floor(Math.random() * 900) + 100,
      birthDate: '2000-01-01',
      birthPlace: '日本',
      master: newMaster.trim() || '未登録',
      style: newStyle,
      ryuoClass: '公式戦',
      junisenClass: '公式戦',
      heldTitles: [],
      totalTitles: 0,
      titleHistory: '現役将棋棋士 手動登録',
      careerWins: 120,
      careerLosses: 60,
      careerWinRate: 0.667,
      currentYearWins: 25,
      currentYearLosses: 12,
      currentYearWinRate: 0.676,
      currentYearStreak: 3,
      rankingInFederation: { winsRank: 12 },
      colorAccent: newType === 'women' ? '#f43f5e' : '#f59e0b',
      avatarBg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      shortBio: `${newName.trim()}（${newRank}）。現役将棋棋士として登録されました。`,
      highlights: ['現役プロ棋士・女流棋士 手動登録データ'],
      yearRecords: [{ year: 2026, wins: 25, losses: 12, rate: 0.676 }],
      senteWinRate: 0.71,
      goteWinRate: 0.63,
      openingStats: [{ name: '角換わり', winRate: 0.7, count: 35 }],
      headToHead: [],
      externalLinks: {
        officialProfile: 'https://www.shogi.or.jp/player/',
        kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(newName.trim())}`,
      },
    };

    if (onImportScrapedPlayer) {
      onImportScrapedPlayer(customPlayer);
    }
    confetti({ particleCount: 50, spread: 50 });
    setIsAddModalOpen(false);
    setNewName('');
    setNewKana('');
    setNewMaster('');
  };

  // Filter players
  const filteredPlayers = players.filter((p) => {
    // Type filter
    if (filterType !== 'all' && p.type !== filterType) return false;
    // Rank filter
    if (rankFilter !== 'all') {
      if (!matchesRankFilter(p, rankFilter)) return false;
    }
    // Affiliation filter (連盟 / LPSA / 無所属)
    const aff: PlayerAffiliation = p.affiliation || '日本将棋連盟';
    if (affiliationFilter !== 'all' && aff !== affiliationFilter) return false;
    // Style filter
    if (styleFilter !== 'all' && p.style !== styleFilter && p.style !== 'オールラウンダー') return false;
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchKana = p.kana.toLowerCase().includes(q);
      const matchRank = p.rank.toLowerCase().includes(q);
      const matchDan = p.danRank?.toLowerCase().includes(q);
      const matchPlace = p.birthPlace.toLowerCase().includes(q);
      const matchMaster = p.master.toLowerCase().includes(q);
      const matchAff = aff.toLowerCase().includes(q);
      if (!matchName && !matchKana && !matchRank && !matchDan && !matchPlace && !matchMaster && !matchAff) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Auto-Sync Status Banner */}
      <div className="bg-gradient-to-r from-zinc-900/90 via-amber-950/20 to-zinc-900/90 border border-amber-500/30 px-3.5 py-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-zinc-300">
            <span className="font-bold text-amber-300">起動時自動同期:</span> 日本将棋連盟・LPSA公式より現役棋士<span className="text-white font-bold mx-1">{players.length}名</span>自動保存済み
          </span>
          {lastSyncTime && (
            <span className="text-[11px] text-zinc-400 hidden md:inline">
              (最終同期: {lastSyncTime})
            </span>
          )}
        </div>

        {onSyncPlayers && (
          <button
            onClick={() => onSyncPlayers(true)}
            disabled={isSyncingPlayers}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
            title="日本将棋連盟およびLPSA公式サイトから最新の棋士データを取得して自動保存します"
          >
            <RefreshCw size={12} className={isSyncingPlayers ? 'animate-spin text-amber-400' : ''} />
            <span>{isSyncingPlayers ? '公式データ同期中...' : '公式データ再同期'}</span>
          </button>
        )}
      </div>

      {/* Search & Filter Header */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl space-y-3">
        {/* Top search row with Scraping trigger button */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="棋士・女流棋士名、読み、段位、所属(連盟/LPSA/無所属)、出身地..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition shadow-sm whitespace-nowrap"
          >
            <Plus size={14} />
            <span>新規棋士を手動登録</span>
          </button>
        </div>

        {/* Filter Pills 1: Pro vs Women */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
            <button
              onClick={() => handleSelectFilterType('all')}
              className={`px-3 py-1 rounded-lg transition ${
                filterType === 'all'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              全員 ({players.length})
            </button>
            <button
              onClick={() => handleSelectFilterType('pro')}
              className={`px-3 py-1 rounded-lg transition ${
                filterType === 'pro'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              棋士 ({players.filter((p) => p.type === 'pro').length})
            </button>
            <button
              onClick={() => handleSelectFilterType('women')}
              className={`px-3 py-1 rounded-lg transition ${
                filterType === 'women'
                  ? 'bg-rose-500/20 text-rose-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              女流棋士 ({players.filter((p) => p.type === 'women').length})
            </button>
          </div>

          {/* Affiliation Filter Pills (Requirement: 日本将棋連盟, LPSA, 無所属 中井広恵) */}
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-[11px] mr-1">所属:</span>
            <div className="flex bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
              <button
                onClick={() => setAffiliationFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  affiliationFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                全所属
              </button>
              <button
                onClick={() => setAffiliationFilter('日本将棋連盟')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  affiliationFilter === '日本将棋連盟'
                    ? 'bg-zinc-700 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                連盟
              </button>
              <button
                onClick={() => setAffiliationFilter('LPSA')}
                disabled={filterType === 'pro'}
                title={filterType === 'pro' ? '棋士選択時は不活性' : undefined}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  filterType === 'pro'
                    ? 'opacity-25 cursor-not-allowed text-zinc-600 pointer-events-none'
                    : affiliationFilter === 'LPSA'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                LPSA ({filterType === 'pro' ? 0 : players.filter((p) => p.affiliation === 'LPSA').length})
              </button>
              <button
                onClick={() => setAffiliationFilter('無所属')}
                disabled={filterType === 'pro'}
                title={filterType === 'pro' ? '棋士選択時は不活性' : undefined}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  filterType === 'pro'
                    ? 'opacity-25 cursor-not-allowed text-zinc-600 pointer-events-none'
                    : affiliationFilter === '無所属'
                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                無所属 ({filterType === 'pro' ? 0 : players.filter((p) => p.affiliation === '無所属').length})
              </button>
            </div>
          </div>
        </div>

        {/* Style Filter */}
        <div className="flex items-center gap-1.5 text-xs pt-1 border-t border-zinc-800/60">
          <span className="text-zinc-500 text-[11px]">戦型:</span>
          <button
            onClick={() => setStyleFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              styleFilter === 'all' ? 'bg-zinc-800 text-zinc-200 font-semibold' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setStyleFilter('居飛車')}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              styleFilter === '居飛車' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            居飛車
          </button>
          <button
            onClick={() => setStyleFilter('振り飛車')}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              styleFilter === '振り飛車' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            振り飛車
          </button>
        </div>

        {/* Rank Filter Selection Bar (棋士・女流棋士 段位別タブ) */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-[11px] font-bold">段位別フィルター:</span>
            {rankFilter !== 'all' && (
              <button
                onClick={() => setRankFilter('all')}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline"
              >
                フィルター解除
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setRankFilter('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                rankFilter === 'all'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              全段位
            </button>

            {/* Pro Ranks */}
            {PRO_RANKS.map((rank) => {
              const isProDisabled = filterType === 'women';
              const count = players.filter((p) => (filterType === 'women' ? false : matchesRankFilter(p, rank))).length;
              return (
                <button
                  key={rank}
                  disabled={isProDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isProDisabled ? '女流棋士選択時は不活性' : undefined}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                    isProDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === rank
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {rank} <span className="text-[9px] opacity-70">({isProDisabled ? 0 : count})</span>
                </button>
              );
            })}

            {/* Women Ranks */}
            {WOMEN_RANKS.map((rank) => {
              const isWomenDisabled = filterType === 'pro';
              const count = players.filter((p) => (filterType === 'pro' ? false : matchesRankFilter(p, rank))).length;
              return (
                <button
                  key={rank}
                  disabled={isWomenDisabled}
                  onClick={() => setRankFilter(rank)}
                  title={isWomenDisabled ? '棋士選択時は不活性' : undefined}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                    isWomenDisabled
                      ? 'opacity-25 cursor-not-allowed text-zinc-600 bg-zinc-950 border border-zinc-900 pointer-events-none'
                      : rankFilter === rank
                      ? 'bg-rose-500 text-white font-bold shadow-sm'
                      : 'bg-zinc-950 text-rose-300 hover:bg-zinc-800 border border-zinc-800/80'
                  }`}
                >
                  {rank} <span className="text-[9px] opacity-70">({isWomenDisabled ? 0 : count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Players List (Horizontal Row Layout) */}
      <div className="space-y-3">
        {filteredPlayers.map((player) => {
          const followConfig = followedMap.get(player.id);
          const isFollowed = !!followConfig;
          const badgeStyle = isFollowed ? BADGE_COLORS[followConfig.badge] : null;
          const aff: PlayerAffiliation = player.affiliation || '日本将棋連盟';
          const affStyle = AFFILIATION_COLORS[aff];

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group hover:border-amber-500/50 ${
                isFollowed
                  ? 'bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/20 border-amber-500/50 shadow-md'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {/* Left Accent Strip */}
              <div
                className="absolute top-0 bottom-0 left-0 w-1.5 transition-all"
                style={{ backgroundColor: isFollowed ? followConfig.color : player.colorAccent }}
              />

              {/* Left Info: Avatar/Initial, Name, Rank, Affiliation */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold font-serif-jp text-white shadow-md flex-shrink-0 overflow-hidden bg-zinc-900"
                  style={{ backgroundColor: isFollowed ? followConfig.color : player.colorAccent }}
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

                    {isFollowed && badgeStyle && (
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
                      {player.name}
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

                  {player.heldTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {player.heldTitles.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {player.heldTitles.length === 0 && player.totalTitles > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300/90 border border-amber-500/30">
                        通算獲得 {player.totalTitles}期
                      </span>
                    </div>
                  )}

                  {isFollowed && followConfig.cheeringNote && (
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
                      {player.careerWins > 0 || player.careerLosses > 0
                        ? `${player.careerWins}勝${player.careerLosses}敗`
                        : '公式戦現役'}
                    </span>
                  </div>
                  <div className="border-l border-zinc-800 pl-3">
                    <span className="text-[9px] text-zinc-500 block">
                      {player.currentYearWins > 0 ? '今年度勝率' : '通算勝率'}
                    </span>
                    <span className="font-bold text-emerald-400 font-serif-jp">
                      {player.currentYearWins > 0
                        ? `${(player.currentYearWinRate * 100).toFixed(0)}%`
                        : player.careerWins > 0
                        ? `${(player.careerWinRate * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleOpenFollowModal(player, e)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition shadow-sm ${
                      isFollowed
                        ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                    }`}
                  >
                    <Heart size={13} className={isFollowed ? 'fill-rose-500 text-rose-500' : ''} />
                    <span>{isFollowed ? '推し設定' : '推し登録'}</span>
                  </button>

                  {isFollowed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFollow(player.id);
                      }}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition border border-zinc-700"
                      title="推し解除"
                    >
                      ✕
                    </button>
                  )}

                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-amber-400 transition hidden sm:block" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Heart size={20} className="text-rose-500 fill-rose-500" />
                <h3 className="text-base font-bold text-zinc-100 font-serif-jp">
                  推し棋士の登録・設定
                </h3>
              </div>
              <button
                onClick={() => setEditingPlayer(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Target Player Summary */}
            <div className="flex items-center gap-3 bg-zinc-900/70 p-3 rounded-2xl border border-zinc-800">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold font-serif-jp text-lg shadow"
                style={{ backgroundColor: selectedColor }}
              >
                {editingPlayer.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-100 font-serif-jp">
                    {editingPlayer.name}
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {editingPlayer.affiliation || '日本将棋連盟'}
                  </span>
                </div>
                <p className="text-xs text-amber-400">{editingPlayer.rank}</p>
                <p className="text-[11px] text-zinc-400">{editingPlayer.master} 門下</p>
              </div>
            </div>

            {/* Badge Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">推しランク・バッジ</label>
              <div className="grid grid-cols-4 gap-2">
                {(['本命', '神推し', '激推し', '注目'] as OshiBadge[]).map((badge) => (
                  <button
                    key={badge}
                    onClick={() => setSelectedBadge(badge)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition border ${
                      selectedBadge === badge
                        ? `${BADGE_COLORS[badge].bg} ${BADGE_COLORS[badge].text} ${BADGE_COLORS[badge].border} ring-2 ring-amber-400/30`
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>

            {/* Fan Color Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">推しカラー (テーマ色)</label>
              <div className="flex items-center gap-3">
                {THEME_COLORS.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSelectedColor(col)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      selectedColor === col ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Cheering Memo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">応援メッセージ / 一言メモ</label>
              <input
                type="text"
                value={cheerNote}
                onChange={(e) => setCheerNote(e.target.value)}
                placeholder="例: 全冠防衛を応援！ / 出雲のイナズマ最高！"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center gap-2 pt-2">
              {followedMap.has(editingPlayer.id) && (
                <button
                  onClick={() => {
                    onRemoveFollow(editingPlayer.id);
                    setEditingPlayer(null);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-rose-400 text-xs font-bold transition border border-zinc-800 hover:border-rose-900/40"
                >
                  登録解除
                </button>
              )}
              <button
                onClick={handleSaveFollow}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black shadow-lg transition"
              >
                {followedMap.has(editingPlayer.id) ? '設定を保存' : '推しに登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Player Registration Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={20} className="text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100 font-serif-jp">
                  現役将棋棋士の新規登録（手動）
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              日本将棋連盟・LPSA所属の現役プロ棋士や女流棋士を自由に登録できます。段位や所属を選択・入力してください。
            </p>

            <div className="space-y-3 bg-zinc-900/70 p-3.5 rounded-2xl border border-zinc-800">
              <div className="flex flex-row items-center gap-3 text-xs">
                <span className="text-zinc-400 font-semibold w-20">区分:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="newType"
                    checked={newType === 'pro'}
                    onChange={() => setNewType('pro')}
                    className="accent-amber-500"
                  />
                  <span className="text-zinc-200">プロ棋士</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="newType"
                    checked={newType === 'women'}
                    onChange={() => setNewType('women')}
                    className="accent-rose-500"
                  />
                  <span className="text-zinc-200">女流棋士</span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">棋士名</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 佐々木 大地"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">ふりがな</label>
                  <input
                    type="text"
                    value={newKana}
                    onChange={(e) => setNewKana(e.target.value)}
                    placeholder="例: ささき だいち"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">段位 / 称号選択</label>
                  <select
                    value={newRank}
                    onChange={(e) => setNewRank(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="九段">九段</option>
                    <option value="八段">八段</option>
                    <option value="七段">七段</option>
                    <option value="六段">六段</option>
                    <option value="五段">五段</option>
                    <option value="四段">四段</option>
                    <option value="竜王">竜王</option>
                    <option value="名人">名人</option>
                    <option value="叡王">叡王</option>
                    <option value="王位">王位</option>
                    <option value="王座">王座</option>
                    <option value="棋王">棋王</option>
                    <option value="王将">王将</option>
                    <option value="棋聖">棋聖</option>
                    <option value="女流四段">女流四段</option>
                    <option value="女流三段">女流三段</option>
                    <option value="女流二段">女流二段</option>
                    <option value="女流初段">女流初段</option>
                    <option value="女流名人">女流名人</option>
                    <option value="女流王位">女流王位</option>
                    <option value="女流王座">女流王座</option>
                    <option value="女流棋聖">女流棋聖</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">所属団体</label>
                  <select
                    value={newAffiliation}
                    onChange={(e) => setNewAffiliation(e.target.value as PlayerAffiliation)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="日本将棋連盟">日本将棋連盟</option>
                    <option value="LPSA">LPSA (日本女子プロ将棋協会)</option>
                    <option value="無所属">無所属</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">戦型</label>
                  <select
                    value={newStyle}
                    onChange={(e) => setNewStyle(e.target.value as Player['style'])}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="居飛車">居飛車</option>
                    <option value="振り飛車">振り飛車</option>
                    <option value="オールラウンダー">オールラウンダー</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">師匠 (任意)</label>
                  <input
                    type="text"
                    value={newMaster}
                    onChange={(e) => setNewMaster(e.target.value)}
                    placeholder="例: 森信雄七段"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddCustomPlayer}
                disabled={!newName.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-xs font-black shadow-lg transition"
              >
                <Plus size={14} />
                <span>棋士を登録する</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
