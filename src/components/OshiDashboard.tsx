import React from 'react';
import { Player, FollowedPlayerConfig, Match, OshiBadge } from '../types/shogi';
import { getGoogleCalendarUrl } from '../utils/calendarExport';
import { getTodayDateString, getTodayInfo } from '../utils/dateUtils';
import { formatPlayerName } from '../utils/playerUtils';
import {
  Heart,
  Calendar,
  Clock,
  Sparkles,
  Trophy,
  ChevronRight,
  TrendingUp,
  Radio,
  Plus,
  Tv,
  CalendarPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OshiDashboardProps {
  followedList: FollowedPlayerConfig[];
  players: Player[];
  matches: Match[];
  googleUser?: { name: string; email: string; avatar: string } | null;
  onOpenGoogleLogin?: () => void;
  onSelectPlayer: (player: Player) => void;
  onSelectMatch: (match: Match) => void;
  onOpenDirectory: () => void;
  onOpenCalendar: () => void;
  onOpenResults?: () => void;
  onRemoveFollow: (playerId: string) => void;
}

const BADGE_COLORS: Record<OshiBadge, { bg: string; text: string; border: string }> = {
  本命: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' },
  神推し: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
  激推し: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  注目: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40' },
};

export const OshiDashboard: React.FC<OshiDashboardProps> = ({
  followedList,
  players,
  matches,
  googleUser,
  onOpenGoogleLogin,
  onSelectPlayer,
  onSelectMatch,
  onOpenDirectory,
  onOpenCalendar,
  onOpenResults,
  onRemoveFollow,
}) => {
  const followedPlayerMap = new Map(players.map((p) => [p.id, p]));

  // Dynamically obtain today's date upon launch
  const todayDate = getTodayDateString();
  const todayInfo = getTodayInfo();

  // Find today's matches
  const todayMatches = matches.filter((m) => m.date === todayDate || m.status === 'live');
  const followedTodayMatches = todayMatches.filter(
    (m) =>
      followedList.some((f) => f.playerId === m.player1Id) ||
      followedList.some((f) => f.playerId === m.player2Id)
  );

  const getPlayer = (id: string): Player => {
    const p = followedPlayerMap.get(id) || players.find((pl) => pl.id === id);
    if (p) return p;
    const clean = id.replace(/^pro-|^lady-|^player-/, '').replace(/_/g, ' ').replace(/\s+/g, '');
    const byName = players.find((pl) => pl.name.replace(/\s+/g, '') === clean);
    if (byName) return byName;
    return {
      id,
      name: id.replace(/^pro-|^lady-|^player-/, '').replace(/_/g, ' '),
      rank: '棋士',
    } as unknown as Player;
  };

  return (
    <div className="space-y-6">
      {/* Today's Special Alert Banner if there are matches today */}
      {followedTodayMatches.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-zinc-900 border border-rose-500/40 rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black tracking-wider text-amber-400 uppercase">
              本日の推し棋士 対局情報 ({todayInfo.shortDisplay})
            </span>
          </div>

          {followedTodayMatches.map((m) => {
            const p1 = getPlayer(m.player1Id);
            const p2 = getPlayer(m.player2Id);

            return (
              <div
                key={m.id}
                onClick={() => onSelectMatch(m)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 p-3.5 rounded-2xl border border-amber-500/30 hover:border-amber-400 transition cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {m.status === 'live' && 
                       new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) >= m.time
                       ? '対局中' : '本日対局'}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-zinc-100 font-serif-jp">
                      {m.tournament}
                    </span>
                  </div>
                  <p className="text-xs text-amber-300 font-semibold mt-1">
                    ☗ {formatPlayerName(p1.name)} ({p1.rank}) vs ☖ {formatPlayerName(p2.name)} ({p2.rank})
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    会場: {m.venue} / 持ち時間: {m.timeControl}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <span>棋譜・詳細を見る</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Google Account Link Status Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-zinc-900/90 to-zinc-900 border border-blue-500/30 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.94H1.18v3.15C3.17 21.36 7.23 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.18C.43 8.1 0 9.99 0 12s.43 3.9 1.18 5.41l4.1-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.18 6.59l4.1 3.15c.95-2.83 3.6-4.99 6.72-4.99z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-zinc-100">
                Googleアカウント連携: <span className="text-amber-300 font-mono">{googleUser?.email || 'y.yoshiya@gmail.com'}</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                リンク保存中
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              登録した推し棋士・女流棋士 ({followedList.length}名) はアカウントにリンクされ、安全に保存されています。
            </p>
          </div>
        </div>
        {onOpenGoogleLogin && (
          <button
            onClick={onOpenGoogleLogin}
            className="self-end sm:self-auto px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-blue-300 text-xs font-semibold border border-zinc-700 transition"
          >
            リンク詳細
          </button>
        )}
      </div>

      {/* 2026年 公式対局結果 Quick Banner */}
      <div
        onClick={onOpenResults || onOpenCalendar}
        className="cursor-pointer bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/30 rounded-2xl p-3.5 sm:p-4 border border-amber-500/30 hover:border-amber-400 transition flex items-center justify-between group shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                日本将棋連盟公式
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition">
                公式対局結果一覧（年度別: 4月〜翌年3月）
              </h4>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              日本将棋連盟公式の全公式戦（棋士・女流棋士）の勝敗・中継リンクを月別に閲覧
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold group-hover:translate-x-1 transition shrink-0 ml-2">
          <span>一覧を見る</span>
          <ChevronRight size={16} />
        </div>
      </div>

      {/* Followed Oshi Players Showcase */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-500 fill-rose-500" />
            <h3 className="text-base font-black text-zinc-100 font-serif-jp tracking-wide">
              推し棋士一覧 ({followedList.length})
            </h3>
          </div>
          <button
            onClick={onOpenDirectory}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition"
          >
            <Plus size={14} />
            <span>推し棋士を追加</span>
          </button>
        </div>

        {followedList.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 text-center space-y-3">
            <Heart size={36} className="mx-auto text-zinc-600" />
            <h4 className="text-sm font-bold text-zinc-200">
              まだ推し棋士が登録されていません
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              棋士・女流棋士（連盟・LPSA・無所属）を推し登録して、対局日通知やカレンダー同期を始めましょう！
            </p>
            <button
              onClick={onOpenDirectory}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg transition"
            >
              棋士名鑑から登録する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {followedList.map((config) => {
              const player = followedPlayerMap.get(config.playerId);
              if (!player) return null;

              const badgeStyle = BADGE_COLORS[config.badge];

              // Next upcoming match for this player
              const nextMatch = matches.find(
                (m) =>
                  (m.player1Id === player.id || m.player2Id === player.id) &&
                  m.status !== 'finished'
              );

              const opponent = nextMatch
                ? players.find(
                    (p) =>
                      p.id ===
                      (nextMatch.player1Id === player.id
                        ? nextMatch.player2Id
                        : nextMatch.player1Id)
                  )
                : null;

              return (
                <div
                  key={player.id}
                  onClick={() => onSelectPlayer(player)}
                  className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 hover:border-amber-500/50 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group shadow-xl"
                >
                  {/* Left Accent Strip */}
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1.5"
                    style={{ backgroundColor: config.color }}
                  />

                  {/* Left Info: Avatar, Name, Rank, Badge */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold font-serif-jp text-white shadow-md flex-shrink-0 overflow-hidden bg-zinc-900"
                      style={{ backgroundColor: config.color }}
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
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                        >
                          <Heart size={10} className="fill-current" />
                          {config.badge}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {player.type === 'women' ? '女流棋士' : '棋士'} No.{player.playerNumber}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <h4 className="text-base sm:text-lg font-black text-zinc-100 font-serif-jp tracking-wide group-hover:text-amber-300 transition-colors">
                          {formatPlayerName(player.name)}
                        </h4>
                        <span className="text-xs font-bold text-amber-400 font-serif-jp">
                          {player.danRank && !player.rank.includes(player.danRank)
                            ? `${player.rank} (${player.danRank})`
                            : player.rank}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {player.master} 門下 • {player.style}
                        </span>
                      </div>

                      {config.cheeringNote && (
                        <p className="text-[11px] text-amber-200/90 italic mt-1">
                          「{config.cheeringNote}」
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Next Match Info */}
                  <div className="w-full md:w-auto my-2 md:my-0 px-2">
                    {nextMatch ? (
                      <div className="bg-zinc-800/40 rounded-lg p-2 text-[10px] border border-zinc-700/50">
                        <span className="text-amber-400 font-bold">次回対局:</span> {nextMatch.date} {nextMatch.time}〜
                        <div className="text-zinc-300">
                           {nextMatch.tournament} (vs {opponent ? formatPlayerName(opponent.name) : '対戦相手未定'})
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-950/40 rounded-lg p-2 text-[10px] border border-zinc-800/50 text-zinc-500">
                        本日対局なし
                      </div>
                    )}
                  </div>

                  {/* Right Stats & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/70">
                    <div className="flex items-center gap-3 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/60 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 block">通算成績</span>
                        <span className="font-bold text-zinc-200 font-serif-jp">
                          {player.careerWins}勝{player.careerLosses}敗
                        </span>
                      </div>
                      <div className="border-l border-zinc-800 pl-3">
                        <span className="text-[9px] text-zinc-500 block">今年度勝率</span>
                        <span className="font-bold text-emerald-400 font-serif-jp">
                          {(player.currentYearWinRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFollow(player.id);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 text-xs font-bold transition border border-zinc-700"
                        title="推し解除"
                      >
                        推し解除
                      </button>

                      <ChevronRight size={16} className="text-zinc-400 group-hover:text-amber-400 transition hidden sm:block" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Shortcuts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          onClick={onOpenCalendar}
          className="p-4 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/40 transition flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-100 font-serif-jp">
                対局カレンダーを開く
              </h4>
              <p className="text-xs text-zinc-400">
                月間カレンダー表示・Googleカレンダー同期
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-amber-400 transition" />
        </button>

        <button
          onClick={onOpenDirectory}
          className="p-4 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/40 transition flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              <Heart size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-100 font-serif-jp">
                推し棋士・女流棋士を探す
              </h4>
              <p className="text-xs text-zinc-400">
                プロ棋士・LPSA・無所属の全棋士名鑑から検索・追加
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-rose-400 transition" />
        </button>
      </div>
    </div>
  );
};
