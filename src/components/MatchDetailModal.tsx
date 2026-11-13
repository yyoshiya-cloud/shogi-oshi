import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Match, Player } from '../types/shogi';
import { getTodayDateString } from '../utils/dateUtils';
import { getDirectHeadToHead } from '../utils/headToHeadUtils';
import { formatPlayerRankAndDan, resolvePlayer, normalizeShogiPlayerNameForMatch } from '../utils/playerUtils';
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

  // Lock body scroll while modal is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const player1 = match ? resolvePlayer(match.player1Id, players) : null;
  const player2 = match ? resolvePlayer(match.player2Id, players) : null;

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

  const isP1RealPlayer =
    players.some((p) => p.id === player1.id || normalizeShogiPlayerNameForMatch(p.name) === normalizeShogiPlayerNameForMatch(player1.name)) ||
    (player1.playerNumber ?? 0) > 0;
  const isP2RealPlayer =
    players.some((p) => p.id === player2.id || normalizeShogiPlayerNameForMatch(p.name) === normalizeShogiPlayerNameForMatch(player2.name)) ||
    (player2.playerNumber ?? 0) > 0;

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 overflow-y-auto touch-none"
      style={{
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col touch-auto overscroll-contain"
        style={{
          transform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          isolation: 'isolate',
        }}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900 sticky top-0 z-20">
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
                if (onSelectPlayer && isP1RealPlayer) onSelectPlayer(player1);
              }}
              className={`p-4 rounded-2xl border transition group relative ${
                isP1RealPlayer ? 'cursor-pointer hover:border-amber-400' : 'cursor-default'
              } ${
                winner?.id === player1.id
                  ? (player1.type === 'women' || player1.affiliation === 'LPSA' || match.category?.includes('女流'))
                    ? 'bg-gradient-to-br from-pink-950/60 via-pink-900/35 to-zinc-900 border-pink-400/90 ring-1 ring-pink-400/60 shadow-xl shadow-pink-500/15'
                    : 'bg-gradient-to-br from-sky-950/60 via-sky-900/35 to-zinc-900 border-sky-400/90 ring-1 ring-sky-400/60 shadow-xl shadow-sky-500/15'
                  : isFinished
                  ? 'bg-zinc-900/50 border-zinc-800/80'
                  : 'bg-zinc-900/70 border-zinc-800/80'
              }`}
              title={isP1RealPlayer ? 'クリックして棋士情報を表示' : undefined}
            >
              <div className="flex items-center justify-between gap-1.5 mb-2.5">
                <span className="text-xs font-black text-amber-400 tracking-wide">☗</span>
                {winner?.id === player1.id ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1 shadow-md whitespace-nowrap shrink-0 ${
                    (player1.type === 'women' || player1.affiliation === 'LPSA' || match.category?.includes('女流'))
                      ? 'bg-gradient-to-r from-pink-400 via-pink-300 to-rose-300 text-zinc-950 border border-pink-200 shadow-pink-500/20'
                      : 'bg-gradient-to-r from-sky-400 via-sky-300 to-cyan-300 text-zinc-950 border border-sky-200 shadow-sky-500/20'
                  }`}>
                    <span>○ 勝者</span>
                  </span>
                ) : isFinished ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 whitespace-nowrap shrink-0">
                    ● 敗退
                  </span>
                ) : null}
              </div>
              <h3 className="flex items-center gap-1.5 min-w-0 mb-1">
                <span
                  className={`text-base sm:text-lg font-serif-jp transition whitespace-nowrap ${
                    winner?.id === player1.id
                      ? (player1.type === 'women' || player1.affiliation === 'LPSA' || match.category?.includes('女流'))
                        ? 'text-pink-200 font-black drop-shadow-[0_1px_3px_rgba(236,72,153,0.3)] group-hover:text-pink-100'
                        : 'text-sky-200 font-black drop-shadow-[0_1px_3px_rgba(56,189,248,0.3)] group-hover:text-sky-100'
                      : 'text-zinc-100 font-bold group-hover:text-amber-300'
                  }`}
                >
                  {player1.name}
                </span>
                {isP1RealPlayer && <span className="text-zinc-500 text-xs shrink-0">↗</span>}
              </h3>
              <p className="text-xs text-amber-300/90 font-semibold">{formatPlayerRankAndDan(player1)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{player1.style || player1.affiliation}</p>
            </div>

            {/* Player 2 Card */}
            <div
              onClick={() => {
                if (onSelectPlayer && isP2RealPlayer) onSelectPlayer(player2);
              }}
              className={`p-4 rounded-2xl border text-right transition group relative ${
                isP2RealPlayer ? 'cursor-pointer hover:border-amber-400' : 'cursor-default'
              } ${
                winner?.id === player2.id
                  ? (player2.type === 'women' || player2.affiliation === 'LPSA' || match.category?.includes('女流'))
                    ? 'bg-gradient-to-bl from-pink-950/60 via-pink-900/35 to-zinc-900 border-pink-400/90 ring-1 ring-pink-400/60 shadow-xl shadow-pink-500/15'
                    : 'bg-gradient-to-bl from-sky-950/60 via-sky-900/35 to-zinc-900 border-sky-400/90 ring-1 ring-sky-400/60 shadow-xl shadow-sky-500/15'
                  : isFinished
                  ? 'bg-zinc-900/50 border-zinc-800/80'
                  : 'bg-zinc-900/70 border-zinc-800/80'
              }`}
              title={isP2RealPlayer ? 'クリックして棋士情報を表示' : undefined}
            >
              <div className="flex items-center justify-end gap-1.5 mb-2.5">
                {winner?.id === player2.id ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1 shadow-md whitespace-nowrap shrink-0 ${
                    (player2.type === 'women' || player2.affiliation === 'LPSA' || match.category?.includes('女流'))
                      ? 'bg-gradient-to-r from-pink-400 via-pink-300 to-rose-300 text-zinc-950 border border-pink-200 shadow-pink-500/20'
                      : 'bg-gradient-to-r from-sky-400 via-sky-300 to-cyan-300 text-zinc-950 border border-sky-200 shadow-sky-500/20'
                  }`}>
                    <span>○ 勝者</span>
                  </span>
                ) : isFinished ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 whitespace-nowrap shrink-0">
                    ● 敗退
                  </span>
                ) : null}
                <span className="text-xs font-black text-sky-400 tracking-wide">⛉</span>
              </div>
              <h3 className="flex items-center justify-end gap-1.5 min-w-0 mb-1">
                {isP2RealPlayer && <span className="text-zinc-500 text-xs shrink-0">↗</span>}
                <span
                  className={`text-base sm:text-lg font-serif-jp transition whitespace-nowrap ${
                    winner?.id === player2.id
                      ? (player2.type === 'women' || player2.affiliation === 'LPSA' || match.category?.includes('女流'))
                        ? 'text-pink-200 font-black drop-shadow-[0_1px_3px_rgba(236,72,153,0.3)] group-hover:text-pink-100'
                        : 'text-sky-200 font-black drop-shadow-[0_1px_3px_rgba(56,189,248,0.3)] group-hover:text-sky-100'
                      : 'text-zinc-100 font-bold group-hover:text-amber-300'
                  }`}
                >
                  {player2.name}
                </span>
              </h3>
              <p className="text-xs text-amber-300/90 font-semibold">{formatPlayerRankAndDan(player2)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{player2.style || player2.affiliation}</p>
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
    </div>,
    document.body
  );
};
