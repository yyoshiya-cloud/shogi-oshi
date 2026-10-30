import React, { useMemo, useState } from 'react';
import { Match, Player } from '../types/shogi';
import { getTodayDateString } from '../utils/dateUtils';
import { getDirectHeadToHead } from '../utils/headToHeadUtils';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Trophy,
  Swords,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function getLastName(fullName: string): string {
  if (!fullName) return '';
  const clean = fullName.replace(/[※＊\*\+\(\)（）\d段級]/g, '').trim();
  const parts = clean.split(/[\s\u3000]+/);
  if (parts.length > 1 && parts[0]) {
    return parts[0];
  }
  if (clean.startsWith('佐々木')) return '佐々木';
  if (clean.startsWith('長谷部')) return '長谷部';
  if (clean.length >= 3) {
    return clean.slice(0, 2);
  }
  return clean;
}

interface MatchDetailModalProps {
  match: Match | null;
  players: Player[];
  onClose: () => void;
  onNotificationSent?: () => void;
  onSelectPlayer?: (player: Player) => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  players,
  onClose,
  onSelectPlayer,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  const player1 = match ? players.find((p) => p.id === match.player1Id) : null;
  const player2 = match ? players.find((p) => p.id === match.player2Id) : null;

  // Calculate direct head-to-head record from past match database (Must run before any early return)
  const h2h = useMemo(() => {
    if (!player1 || !player2) {
      return {
        player1Name: '',
        player2Name: '',
        player1Wins: 0,
        player2Wins: 0,
        draws: 0,
        totalMatches: 0,
        recentMatches: [],
        shogiDbSearchUrl: '',
      };
    }
    return getDirectHeadToHead(player1, player2);
  }, [player1, player2]);

  if (!match || !player1 || !player2) return null;

  const winner = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;
  const isFinished = match.status === 'finished';

  // System time and status check (JST)
  const todayStr = getTodayDateString();
  const now = new Date();
  const currentJSTTime = now.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const isMatchToday = match.date === todayStr;
  const isPastStartTime = isMatchToday && currentJSTTime >= (match.time || '10:00');

  // Determine badge text and style based on system date and time
  let badgeText = '対局予定';
  let badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  if (isFinished) {
    badgeText = '終局';
    badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
  } else if (isMatchToday || match.status === 'live') {
    if (isPastStartTime) {
      badgeText = '対局中';
      badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else {
      badgeText = '本日対局';
      badgeStyle = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    }
  } else {
    badgeText = '対局予定';
    badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
  }

  const p1LastName = getLastName(player1.name);
  const p2LastName = getLastName(player2.name);

  const p1Ratio = h2h.totalMatches > 0 ? (h2h.player1Wins / h2h.totalMatches) * 100 : 50;
  const p2Ratio = h2h.totalMatches > 0 ? (h2h.player2Wins / h2h.totalMatches) * 100 : 50;
  const visibleMatches = showAllHistory ? h2h.recentMatches : h2h.recentMatches.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle}`}
            >
              {badgeText}
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              {match.category}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Tournament Title */}
          <div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-100 font-serif-jp tracking-wide">
              {match.tournament}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-amber-400" />
                {match.date} {match.time}〜
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-amber-400" />
                {match.venue}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-amber-400" />
                {match.timeControl}
              </span>
            </div>
          </div>

          {/* Versus Header Cards */}
          <div className="grid grid-cols-2 gap-3 relative">
            {/* Center VS indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-amber-500/40 flex items-center justify-center shadow-lg">
                <span className="text-xs font-black text-amber-400 font-serif-jp">VS</span>
              </div>
            </div>

            {/* Player 1 Card */}
            <div
              onClick={() => {
                if (onSelectPlayer) onSelectPlayer(player1);
              }}
              className={`p-4 rounded-2xl border transition cursor-pointer hover:border-amber-400 group ${
                winner?.id === player1.id
                  ? 'bg-amber-950/20 border-amber-500/60 shadow-lg'
                  : 'bg-zinc-900/60 border-zinc-800/80'
              }`}
              title="クリックして棋士情報を表示"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-amber-400">☗ 先手</span>
                {winner?.id === player1.id && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-stone-950 flex items-center gap-1">
                    <Trophy size={11} /> 勝利
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-100 font-serif-jp group-hover:text-amber-300 transition">
                {player1.name} ↗
              </h3>
              <p className="text-xs text-amber-300/80 font-medium">{player1.rank}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{player1.style}</p>
            </div>

            {/* Player 2 Card */}
            <div
              onClick={() => {
                if (onSelectPlayer) onSelectPlayer(player2);
              }}
              className={`p-4 rounded-2xl border text-right transition cursor-pointer hover:border-amber-400 group ${
                winner?.id === player2.id
                  ? 'bg-amber-950/20 border-amber-500/60 shadow-lg'
                  : 'bg-zinc-900/60 border-zinc-800/80'
              }`}
              title="クリックして棋士情報を表示"
            >
              <div className="flex items-center justify-end gap-2 mb-2">
                {winner?.id === player2.id && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-stone-950 flex items-center gap-1">
                    <Trophy size={11} /> 勝利
                  </span>
                )}
                <span className="text-xs font-bold text-sky-400">☖ 後手</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-100 font-serif-jp group-hover:text-amber-300 transition">
                ↗ {player2.name}
              </h3>
              <p className="text-xs text-amber-300/80 font-medium">{player2.rank}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{player2.style}</p>
            </div>
          </div>

          {/* 直接対局記録（過去の対戦成績） */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <Swords size={16} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-zinc-100 font-serif-jp whitespace-pre-line leading-tight">
                  過去の対局記録{'\n'}（対戦成績）
                </h3>
              </div>
              <a
                href={h2h.shogiDbSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition shrink-0"
              >
                <span>将棋DB2で全記録</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* 勝敗サマリー */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold font-serif-jp">
                <span className="text-amber-400 flex items-center gap-1">
                  {p1LastName}:{h2h.player1Wins}勝
                </span>
                <span className="text-zinc-400 text-[11px] font-sans">
                  {h2h.totalMatches > 0 ? `過去公式戦 計${h2h.totalMatches}局` : '初手合（直接対局なし）'}
                  {h2h.draws > 0 && `（引分 ${h2h.draws}）`}
                </span>
                <span className="text-sky-400 flex items-center gap-1">
                  {h2h.player2Wins}勝:{p2LastName}
                </span>
              </div>

              {/* 比率バー */}
              {h2h.totalMatches > 0 && (
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800">
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${p1Ratio}%` }}
                    title={`${p1LastName}: ${h2h.player1Wins}勝 (${p1Ratio.toFixed(0)}%)`}
                  />
                  <div
                    className="bg-sky-500 transition-all duration-500"
                    style={{ width: `${p2Ratio}%` }}
                    title={`${p2LastName}: ${h2h.player2Wins}勝 (${p2Ratio.toFixed(0)}%)`}
                  />
                </div>
              )}
            </div>

            {/* 対戦履歴リスト */}
            {h2h.recentMatches.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold px-1">
                  <span>直近の対局一覧 ({h2h.recentMatches.length}局)</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {visibleMatches.map((item) => {
                    const isP1Win = item.winnerPlayerId === player1.id || item.winnerName === player1.name;
                    const isP2Win = item.winnerPlayerId === player2.id || item.winnerName === player2.name;
                    const winnerLastName = item.winnerName ? getLastName(item.winnerName) : '';

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800/70 text-xs hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {item.date}
                          </span>
                          <span className="text-zinc-300 font-medium truncate">
                            {item.tournament}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-zinc-400">
                            ☗{getLastName(item.senteName)} vs ☖{getLastName(item.goteName)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isP1Win
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isP2Win
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {winnerLastName ? `${winnerLastName} 〇` : '結果'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {h2h.recentMatches.length > 5 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="w-full py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-amber-300 flex items-center justify-center gap-1 transition"
                  >
                    <span>{showAllHistory ? '表示をたたむ' : `さらに過去の対局を表示 (全${h2h.recentMatches.length}局)`}</span>
                    {showAllHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 px-2 text-xs text-zinc-500 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                過去の公式戦データベースに対局記録がありません（初手合の可能性があります）
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
