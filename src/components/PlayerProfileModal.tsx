import React, { useState, useEffect, useMemo } from 'react';
import { Player, FollowedPlayerConfig, Match, ShogiMonthlyResult } from '../types/shogi';
import { PlayerStatsCharts } from './PlayerStatsCharts';
import results2026Json from '../data/results2026.json';
import {
  X,
  Heart,
  Trophy,
  ExternalLink,
  Loader2,
  Calendar,
  BookOpen,
  Filter,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlayerProfileModalProps {
  player: Player | null;
  followedConfig?: FollowedPlayerConfig;
  matches: Match[];
  allPlayers: Player[];
  onClose: () => void;
  onRemoveFollow: (playerId: string) => void;
  onAddComment: (playerId: string, text: string) => void;
  onSelectMatch: (match: Match) => void;
  onUpdatePlayer?: (player: Player) => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  followedConfig,
  matches,
  allPlayers,
  onClose,
  onRemoveFollow,
  onAddComment,
  onSelectMatch,
  onUpdatePlayer,
}) => {
  if (!player) return null;

  const [activeTab, setActiveTab] = useState<'stats' | 'results' | 'matches' | 'cheer'>('stats');
  const [commentInput, setCommentInput] = useState('');
  const [activePlayer, setActivePlayer] = useState<Player>(player);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [resultsFiscalYear, setResultsFiscalYear] = useState<number>(2026);
  const [resultsMonthFilter, setResultsMonthFilter] = useState<string>('all');
  const [resultsOutcomeFilter, setResultsOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all');

  useEffect(() => {
    if (player && (player.id === 'ito-takumi' || (player.name && player.name.includes('伊藤 匠'))) && player.totalTitles !== 4) {
      setActivePlayer({ ...player, totalTitles: 4 });
    } else {
      setActivePlayer(player);
    }
  }, [player]);

  // On-demand detail enrichment if official link is available and basic bio is missing
  useEffect(() => {
    const profileUrl = player.externalLinks?.officialProfile;
    const isJSA = profileUrl && profileUrl.startsWith('https://www.shogi.or.jp/player/');
    const isLPSA =
      player.affiliation === 'LPSA' || (profileUrl && profileUrl.includes('joshi-shogi.com'));

    if (
      (!player.birthDate || !player.master || player.careerWins === 0 || !player.kana) &&
      (isJSA || isLPSA)
    ) {
      let isCancelled = false;
      setLoadingDetails(true);

      const targetUrl = isLPSA ? 'https://joshi-shogi.com/profile/' : profileUrl;
      fetch(
        `/api/players/profile-details?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(
          player.name
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled && data.success && data.details) {
            const d = data.details;
            const updated: Player = {
              ...player,
              photoUrl: d.photoUrl || player.photoUrl,
              danRank: d.danRank || player.danRank,
              birthDate: d.birthDate || player.birthDate,
              birthPlace: d.birthPlace || player.birthPlace,
              master: d.master || player.master,
              ryuoClass: d.ryuoClass || player.ryuoClass,
              junisenClass: d.junisenClass || player.junisenClass,
              currentYearWins:
                d.currentYearWins !== undefined ? d.currentYearWins : player.currentYearWins,
              currentYearLosses:
                d.currentYearLosses !== undefined ? d.currentYearLosses : player.currentYearLosses,
              currentYearWinRate:
                d.currentYearWinRate !== undefined ? d.currentYearWinRate : player.currentYearWinRate,
              currentYearStreak:
                d.currentYearStreak !== undefined ? d.currentYearStreak : player.currentYearStreak,
              totalTitles:
                player.id === 'ito-takumi' || player.name.includes('伊藤 匠')
                  ? 4
                  : d.totalTitles !== undefined
                  ? d.totalTitles
                  : player.totalTitles,
              titleHistory: d.titleHistory || player.titleHistory,
              highlights: d.highlights || player.highlights,
              romaji: d.romaji || player.romaji,
              kana: d.kana || player.kana,
              bloodType: d.bloodType || player.bloodType,
              motto: d.motto || player.motto,
              favPiece: d.favPiece || player.favPiece,
              achievements: d.achievements || player.achievements,
              shortBio:
                d.shortBio ||
                (d.master
                  ? `${player.affiliation || '日本将棋連盟'}所属の${player.type === 'women' ? '現役女流棋士' : '現役棋士'}（${player.rank}）。${d.master}門下。${
                      d.birthPlace ? `${d.birthPlace}出身。` : ''
                    }`
                  : player.shortBio),
            };
            setActivePlayer(updated);
            onUpdatePlayer?.(updated);
          }
        })
        .catch((err) => console.warn('Could not fetch player details:', err))
        .finally(() => {
          if (!isCancelled) setLoadingDetails(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [player.id, player.externalLinks?.officialProfile, player.name]);

  // Past and upcoming matches involving this player (sorted descending by date)
  const playerMatches = useMemo(() => {
    return matches
      .filter((m) => m.player1Id === activePlayer.id || m.player2Id === activePlayer.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [matches, activePlayer.id]);

  // Months belonging to the selected fiscal year (4月〜翌年3月)
  const fiscalYearMonths = useMemo(() => {
    const list: string[] = [];
    for (let m = 4; m <= 12; m++) {
      list.push(`${resultsFiscalYear}${String(m).padStart(2, '0')}`);
    }
    for (let m = 1; m <= 3; m++) {
      list.push(`${resultsFiscalYear + 1}${String(m).padStart(2, '0')}`);
    }
    return list;
  }, [resultsFiscalYear]);

  // Complete official match results for this player in selected fiscal year (4月〜翌年3月) from shogi.or.jp
  const playerOfficialResults = useMemo(() => {
    const list: (ShogiMonthlyResult & {
      isPlayerWinner: boolean;
      opponentName: string;
      isPlayerSente: boolean;
    })[] = [];

    const targetClean = activePlayer.name.replace(/\s+/g, '');
    const data = results2026Json as Record<string, ShogiMonthlyResult[]>;
    const validMonthsSet = new Set(fiscalYearMonths);
    const months = Object.keys(data)
      .filter((m) => validMonthsSet.has(m))
      .sort((a, b) => b.localeCompare(a));

    for (const m of months) {
      for (const r of data[m] || []) {
        const sClean = r.sente.replace(/\s+/g, '');
        const gClean = r.gote.replace(/\s+/g, '');
        const isSente = sClean === targetClean || r.sentePlayerId === activePlayer.id;
        const isGote = gClean === targetClean || r.gotePlayerId === activePlayer.id;

        if (isSente || isGote) {
          const isPlayerWinner =
            r.winner.replace(/\s+/g, '') === targetClean ||
            (isSente && (r.senteMark.includes('○') || r.senteMark.includes('□'))) ||
            (isGote && (r.goteMark.includes('○') || r.goteMark.includes('□')));
          const opponentName = isSente ? r.gote : r.sente;

          list.push({
            ...r,
            isPlayerWinner,
            opponentName,
            isPlayerSente: isSente,
          });
        }
      }
    }
    // Sort strictly in descending order of year/month/day (最新の対局日が先頭)
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [activePlayer, fiscalYearMonths]);

  // Player's statistics calculated from actual official match results in fiscal year
  const playerFiscalStats = useMemo(() => {
    const total = playerOfficialResults.length;
    let wins = 0;
    let losses = 0;
    let senteWins = 0;
    let senteLosses = 0;
    let goteWins = 0;
    let goteLosses = 0;

    for (const r of playerOfficialResults) {
      if (r.isPlayerWinner) {
        wins++;
        if (r.isPlayerSente) senteWins++;
        else goteWins++;
      } else {
        losses++;
        if (r.isPlayerSente) senteLosses++;
        else goteLosses++;
      }
    }

    const decisive = wins + losses;
    const rate = decisive > 0 ? (wins / decisive).toFixed(3) : '.000';
    const ratePercent = decisive > 0 ? ((wins / decisive) * 100).toFixed(1) : '0.0';

    return {
      total,
      wins,
      losses,
      rate,
      ratePercent,
      senteWins,
      senteLosses,
      goteWins,
      goteLosses,
    };
  }, [playerOfficialResults]);

  // Months in which this player actually had games
  const availableMonths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of playerOfficialResults) {
      counts.set(r.month, (counts.get(r.month) || 0) + 1);
    }
    const res: { key: string; short: string; count: number }[] = [];
    const sortedFiscalMonths = [...fiscalYearMonths].reverse();
    for (const m of sortedFiscalMonths) {
      if (counts.has(m)) {
        const monthNum = parseInt(m.slice(4), 10);
        const isNextYear = parseInt(m.slice(0, 4), 10) > resultsFiscalYear;
        res.push({
          key: m,
          short: isNextYear ? `翌${monthNum}月` : `${monthNum}月`,
          count: counts.get(m)!,
        });
      }
    }
    return res;
  }, [playerOfficialResults, fiscalYearMonths, resultsFiscalYear]);

  // Filtered player match results (sorted descending by date)
  const filteredPlayerResults = useMemo(() => {
    let list = playerOfficialResults;
    if (resultsMonthFilter !== 'all') {
      list = list.filter((r) => r.month === resultsMonthFilter);
    }
    if (resultsOutcomeFilter === 'win') {
      list = list.filter((r) => r.isPlayerWinner);
    } else if (resultsOutcomeFilter === 'loss') {
      list = list.filter((r) => !r.isPlayerWinner);
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [playerOfficialResults, resultsMonthFilter, resultsOutcomeFilter]);

  const handleSelectResultMatch = (
    r: ShogiMonthlyResult & { isPlayerWinner: boolean; opponentName: string; isPlayerSente: boolean }
  ) => {
    onClose();
    const p1 = allPlayers.find((p) => p.name.replace(/\s+/g, '') === r.sente.replace(/\s+/g, ''));
    const p2 = allPlayers.find((p) => p.name.replace(/\s+/g, '') === r.gote.replace(/\s+/g, ''));

    const m: Match = {
      id: r.id,
      tournament: r.tournament,
      category: r.category,
      round: r.note || '公式戦',
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


  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(activePlayer.id, commentInput.trim());
    setCommentInput('');
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.8 },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl h-[92vh] max-h-[900px] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Banner with Player Color */}
        <div
          className="relative px-6 pt-6 pb-5 text-white flex-shrink-0"
          style={{ background: activePlayer.avatarBg || 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white transition"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black font-serif-jp shadow-2xl border-2 border-white/20 overflow-hidden bg-zinc-900 flex-shrink-0"
                style={{ backgroundColor: activePlayer.colorAccent }}
              >
                {activePlayer.photoUrl ? (
                  <img
                    src={activePlayer.photoUrl}
                    alt={activePlayer.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  activePlayer.name[0]
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-amber-200 border border-white/10">
                    {activePlayer.type === 'women' ? '女流棋士' : '棋士'} No.{activePlayer.playerNumber}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      activePlayer.affiliation === 'LPSA'
                        ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50'
                        : activePlayer.affiliation === '無所属'
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400/50'
                        : 'bg-white/10 text-zinc-200 border-white/20'
                    }`}
                  >
                    {activePlayer.affiliation || '日本将棋連盟'}
                  </span>
                  {followedConfig && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1 shadow">
                      <Heart size={11} className="fill-white" />
                      {followedConfig.badge}
                    </span>
                  )}
                  {loadingDetails && (
                    <span className="text-[10px] text-amber-300 flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      連盟データ同期中
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-serif-jp tracking-wider mt-1">
                  {activePlayer.name}
                  {activePlayer.kana ? (
                    <span className="text-xs font-normal text-zinc-300 ml-2">
                      ({activePlayer.kana})
                    </span>
                  ) : activePlayer.romaji ? (
                    <span className="text-xs font-normal text-zinc-300 ml-2">
                      ({activePlayer.romaji})
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm font-bold text-amber-300 font-serif-jp">
                  {activePlayer.danRank && !activePlayer.rank.includes(activePlayer.danRank)
                    ? `${activePlayer.rank} (${activePlayer.danRank})`
                    : activePlayer.rank}
                </p>
              </div>
            </div>

            {followedConfig && (
              <button
                onClick={() => {
                  onRemoveFollow(activePlayer.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/40 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 font-bold text-xs border border-white/20 transition"
              >
                <span>推し解除</span>
              </button>
            )}
          </div>

          {/* Currently Held Titles */}
          {activePlayer.heldTitles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-white/10 items-center">
              <span className="text-xs text-amber-300 flex items-center gap-1 mr-1 font-bold">
                <Trophy size={13} className="text-amber-400" />
                現在保持タイトル:
              </span>
              {activePlayer.heldTitles.map((title) => (
                <span
                  key={title}
                  className="px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-400/25 text-amber-200 border border-amber-300/50 shadow-sm"
                >
                  {title}
                </span>
              ))}
            </div>
          )}

          {/* Past / Career Titles Won */}
          {activePlayer.totalTitles > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10 text-xs">
              <span className="text-amber-300/90 flex items-center gap-1 mr-1 font-bold">
                <Trophy size={13} className="text-amber-400/80" />
                通算タイトル獲得:
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-500/20 text-amber-200 border border-amber-400/40">
                {activePlayer.totalTitles}期
              </span>
              {activePlayer.titleHistory && (
                <span className="text-[11px] text-zinc-300 ml-1">
                  ({activePlayer.titleHistory})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/60 px-4 sm:px-6 pt-2 overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            プロフィール・通算成績
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'results'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy size={14} className={activeTab === 'results' ? 'text-amber-400' : 'text-zinc-500'} />
            <span>{resultsFiscalYear}年度 対局結果 ({playerOfficialResults.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'matches'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            対局予定 ({playerMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('cheer')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'cheer'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            推し応援コーナー
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* TAB 1: Profile & Statistical Charts */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Detailed Profile Table */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    基本プロフィール情報
                  </h3>
                  {loadingDetails && (
                    <span className="text-[11px] text-amber-300 flex items-center gap-1.5 animate-pulse">
                      <Loader2 size={11} className="animate-spin" />
                      連盟・公式データ取得中...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">段位</span>
                    <span className="font-semibold text-amber-300">
                      {activePlayer.danRank || activePlayer.rank}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">生年月日</span>
                    <span className="font-semibold text-zinc-200">
                      {activePlayer.birthDate || '公式名鑑参照'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">出身地</span>
                    <span className="font-semibold text-zinc-200">
                      {activePlayer.birthPlace || '非公開'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">師匠</span>
                    <span className="font-semibold text-zinc-200">
                      {activePlayer.master || '－'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">得意戦型</span>
                    <span className="font-semibold text-zinc-200">
                      {activePlayer.style || '居飛車'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">所属組織</span>
                    <span className="font-semibold text-amber-300">
                      {activePlayer.affiliation || '日本将棋連盟'}
                    </span>
                  </div>

                  {activePlayer.type === 'women' ? (
                    <>
                      <div>
                        <span className="text-zinc-500 block">女流棋士番号</span>
                        <span className="font-semibold text-zinc-200">
                          No.{activePlayer.playerNumber || '-'}
                        </span>
                      </div>
                      {activePlayer.bloodType && (
                        <div>
                          <span className="text-zinc-500 block">血液型</span>
                          <span className="font-semibold text-zinc-200">
                            {activePlayer.bloodType}
                          </span>
                        </div>
                      )}
                      {activePlayer.favPiece && (
                        <div>
                          <span className="text-zinc-500 block">好きな駒</span>
                          <span className="font-semibold text-zinc-200">
                            {activePlayer.favPiece}
                          </span>
                        </div>
                      )}
                      {activePlayer.motto && (
                        <div className="col-span-2 sm:col-span-3 pt-2 border-t border-zinc-800/60">
                          <span className="text-zinc-500 block">座右の銘</span>
                          <span className="font-semibold text-amber-300">
                            「{activePlayer.motto}」
                          </span>
                        </div>
                      )}
                      {activePlayer.achievements && (
                        <div className="col-span-2 sm:col-span-3 pt-2 border-t border-zinc-800/60">
                          <span className="text-zinc-500 block">主な戦績・棋歴</span>
                          <span className="font-medium text-zinc-300 leading-relaxed">
                            {activePlayer.achievements}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-zinc-500 block">棋士番号</span>
                        <span className="font-semibold text-zinc-200">
                          No.{activePlayer.playerNumber || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">竜王戦クラス</span>
                        <span className="font-semibold text-zinc-200">
                          {activePlayer.ryuoClass || '参加棋戦'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">順位戦クラス</span>
                        <span className="font-semibold text-zinc-200">
                          {activePlayer.junisenClass || '参加棋戦'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {activePlayer.highlights && activePlayer.highlights.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300">
                    <span className="text-amber-400 font-bold block mb-1.5">主な獲得タイトル・ハイライト:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activePlayer.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-zinc-850 text-zinc-200 text-[11px] border border-zinc-700/60"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activePlayer.titleHistory && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300">
                    <span className="text-amber-400 font-bold mr-1">タイトル獲得履歴:</span>
                    <span>{activePlayer.titleHistory}</span>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
                  {activePlayer.shortBio}
                </div>
              </div>

              {/* Statistical Charts Component */}
              <PlayerStatsCharts player={activePlayer} />

              {/* External Links */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href={activePlayer.externalLinks.officialProfile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-amber-300 transition"
                >
                  <span>
                    {activePlayer.affiliation === 'LPSA'
                      ? 'LPSA公式 プロフィール'
                      : activePlayer.affiliation === '無所属'
                      ? '公式 プロフィール'
                      : '日本将棋連盟公式 棋士名鑑'}
                  </span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href={activePlayer.externalLinks.kifuDatabase}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-amber-300 transition"
                >
                  <span>将棋DB2 棋譜データベース</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* TAB: Official Match Results for this Player by Fiscal Year (4月〜翌年3月) */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {/* Fiscal Year Switcher & Annual Summary Metrics Card */}
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/30 rounded-2xl p-4 border border-amber-500/30 shadow-md">
                {/* Fiscal Year Selection Buttons */}
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-800/80">
                  <span className="text-xs font-bold text-zinc-300">年度切替:</span>
                  <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                    <button
                      onClick={() => {
                        setResultsFiscalYear(2026);
                        setResultsMonthFilter('all');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        resultsFiscalYear === 2026
                          ? 'bg-amber-500 text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      2026年度 (2026年4月〜2027年3月)
                    </button>
                    <button
                      onClick={() => {
                        setResultsFiscalYear(2025);
                        setResultsMonthFilter('all');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        resultsFiscalYear === 2025
                          ? 'bg-amber-500 text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      2025年度 (2025年4月〜2026年3月)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {resultsFiscalYear}年度 公式記録
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-zinc-100 font-serif-jp">
                        {activePlayer.name} の{resultsFiscalYear}年度 公式対局戦績
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      日本将棋連盟公式（shogi.or.jp {resultsFiscalYear}年4月〜{resultsFiscalYear + 1}年3月）の全公式戦記録
                    </p>
                  </div>

                  <div className="flex items-baseline gap-2 bg-zinc-950/80 px-3.5 py-2 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400 font-medium">勝率:</span>
                    <span className="text-lg font-bold text-amber-300 font-mono">
                      .{playerFiscalStats.rate.replace(/^0\./, '')}
                    </span>
                    <span className="text-xs text-zinc-400">({playerFiscalStats.ratePercent}%)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/80">
                  <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">総対局数</span>
                    <span className="text-sm font-bold text-zinc-100">{playerFiscalStats.total} 局</span>
                  </div>
                  <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">勝敗</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {playerFiscalStats.wins}勝 <span className="text-zinc-400">{playerFiscalStats.losses}敗</span>
                    </span>
                  </div>
                  <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">☗ 先手番</span>
                    <span className="text-xs font-bold text-zinc-200">
                      {playerFiscalStats.senteWins}勝 {playerFiscalStats.senteLosses}敗
                    </span>
                  </div>
                  <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">☖ 後手番</span>
                    <span className="text-xs font-bold text-zinc-200">
                      {playerFiscalStats.goteWins}勝 {playerFiscalStats.goteLosses}敗
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                  {/* Month Filter */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs">
                    <span className="text-[11px] text-zinc-400 mr-1 flex items-center gap-1 shrink-0">
                      <Filter size={11} />
                      月別:
                    </span>
                    <button
                      onClick={() => setResultsMonthFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                        resultsMonthFilter === 'all'
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      すべて ({playerOfficialResults.length})
                    </button>
                    {availableMonths.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setResultsMonthFilter(m.key)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                          resultsMonthFilter === m.key
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {m.short} ({m.count})
                      </button>
                    ))}
                  </div>

                  {/* Outcome Filter */}
                  <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 text-xs shrink-0">
                    <button
                      onClick={() => setResultsOutcomeFilter('all')}
                      className={`px-2 py-1 rounded-lg transition ${
                        resultsOutcomeFilter === 'all'
                          ? 'bg-zinc-800 text-white font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      すべて
                    </button>
                    <button
                      onClick={() => setResultsOutcomeFilter('win')}
                      className={`px-2 py-1 rounded-lg transition ${
                        resultsOutcomeFilter === 'win'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-zinc-400 hover:text-emerald-400'
                      }`}
                    >
                      ○ 勝利のみ ({playerFiscalStats.wins})
                    </button>
                    <button
                      onClick={() => setResultsOutcomeFilter('loss')}
                      className={`px-2 py-1 rounded-lg transition ${
                        resultsOutcomeFilter === 'loss'
                          ? 'bg-rose-600 text-white font-bold'
                          : 'text-zinc-400 hover:text-rose-400'
                      }`}
                    >
                      ● 敗戦のみ ({playerFiscalStats.losses})
                    </button>
                  </div>
                </div>
              </div>

              {/* Match Cards List */}
              {filteredPlayerResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 space-y-2">
                  <p className="font-bold text-zinc-300">
                    {playerOfficialResults.length === 0
                      ? `${resultsFiscalYear}年度の公式戦対局データはありません`
                      : '該当する対局結果がありません'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {playerOfficialResults.length === 0
                      ? '日本将棋連盟または将棋DB2で過去の棋譜を検索できます。'
                      : '条件をリセットするか、他の月をお試しください。'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs text-zinc-400 px-1 flex items-center justify-between">
                    <span>表示中: {filteredPlayerResults.length} 局</span>
                    <span className="text-[11px] text-zinc-500">
                      カードをタップで詳細・棋譜を確認
                    </span>
                  </div>

                  {filteredPlayerResults.map((r) => {
                    const opponent = allPlayers.find(
                      (p) => p.name.replace(/\s+/g, '') === r.opponentName.replace(/\s+/g, '')
                    );

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectResultMatch(r)}
                        className={`p-3 sm:p-4 rounded-2xl bg-zinc-900/80 border transition hover:border-amber-400/50 cursor-pointer ${
                          r.isPlayerWinner
                            ? 'border-emerald-500/30 hover:border-emerald-400/60'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Top row: Date & Tournament */}
                        <div className="flex items-center justify-between gap-2 text-xs mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-zinc-400 font-mono text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {r.date}
                            </span>
                            <span className="font-bold text-zinc-200 font-serif-jp truncate">
                              {r.tournament}
                            </span>
                            {r.note && (
                              <span className="text-[11px] text-zinc-400 truncate">
                                {r.note}
                              </span>
                            )}
                          </div>

                          {/* Win/Loss Badge */}
                          <div className="shrink-0">
                            {r.isPlayerWinner ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span>{r.resultType === 'fusen' ? '□ 不戦勝' : '○ 勝利'}</span>
                                <span className="text-[10px] text-emerald-400/80">
                                  ({r.isPlayerSente ? '☗先手' : '☖後手'})
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                <span>{r.resultType === 'fusen' ? '■ 不戦敗' : '● 敗戦'}</span>
                                <span className="text-[10px] text-zinc-400">
                                  ({r.isPlayerSente ? '☗先手' : '☖後手'})
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Opponent info */}
                        <div className="flex items-center justify-between gap-3 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80 my-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs text-zinc-400 font-medium shrink-0">対戦相手:</span>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-sm font-bold text-zinc-100 truncate">
                                {r.opponentName}
                              </span>
                              {opponent && (
                                <span className="text-xs text-amber-300 font-medium shrink-0">
                                  {opponent.danRank || opponent.rank}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[11px] text-zinc-400 shrink-0">
                            手番: {r.isPlayerSente ? '☗先手' : '☖後手'}
                          </div>
                        </div>

                        {/* Bottom: Links & Actions */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {r.links && r.links.length > 0 ? (
                              r.links.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition"
                                >
                                  <ExternalLink size={10} />
                                  <span>{link.title}</span>
                                </a>
                              ))
                            ) : (
                              <span className="text-[10px] text-zinc-500">日本将棋連盟公式記録</span>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Matches list for this player (upcoming/schedule) */}
          {activeTab === 'matches' && (
            <div className="space-y-3">
              {playerMatches.length > 0 ? (
                playerMatches.map((match) => {
                  const opponentId =
                    match.player1Id === activePlayer.id ? match.player2Id : match.player1Id;
                  const opponent = allPlayers.find((p) => p.id === opponentId);
                  const isWinner = match.winnerId === activePlayer.id;
                  const isFinished = match.status === 'finished';

                  return (
                    <div
                      key={match.id}
                      onClick={() => {
                        onClose();
                        onSelectMatch(match);
                      }}
                      className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-zinc-200 font-serif-jp">
                          {match.tournament}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            match.status === 'live'
                              ? 'bg-amber-500/20 text-amber-300'
                              : isFinished
                              ? isWinner
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {match.status === 'live'
                            ? '対局中'
                            : isFinished
                            ? isWinner
                              ? '○ 勝利'
                              : '● 敗戦'
                            : '対局予定'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-300 py-1">
                        <span>
                          vs {opponent?.name || '相手棋士'} ({opponent?.rank})
                        </span>
                        <span className="text-zinc-500">{match.date}</span>
                      </div>

                      {isFinished && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800/60 mt-1">
                          <span>
                            戦型: {match.openingStrategy || '力戦'} ({match.movesCount}手)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-xs text-zinc-400 bg-zinc-900/40 rounded-2xl border border-zinc-800/60">
                  <p className="font-bold text-zinc-300 mb-1">直近の対局データがありません</p>
                  <p>将棋DB2（棋譜データベース）にて全過去対局を検索できます。</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Cheer section */}
          {activeTab === 'cheer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <h4 className="text-xs font-bold text-amber-400 mb-2">推し応援メッセージ</h4>
                {followedConfig?.cheeringNote ? (
                  <p className="text-sm text-zinc-200 italic p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    「{followedConfig.cheeringNote}」
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    推し登録時に設定した応援コメントがここに表示されます。
                  </p>
                )}
              </div>

              {followedConfig?.fanComments && followedConfig.fanComments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400">応援ログ</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {followedConfig.fanComments.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-300"
                      >
                        <p>{c.text}</p>
                        <span className="text-[10px] text-zinc-500 mt-1 block">
                          {new Date(c.createdAt).toLocaleString('ja-JP')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add cheer comment form */}
              <form onSubmit={handleSendComment} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={`${activePlayer.name}へ応援メッセージを送る...`}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <Heart size={13} className="fill-current" />
                  <span>応援</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
