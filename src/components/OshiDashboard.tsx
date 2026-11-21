import React from 'react';
import { Player, FollowedPlayerConfig, Match, OshiBadge } from '../types/shogi';
import { getTodayDateString, getTodayInfo } from '../utils/dateUtils';
import { formatPlayerName, formatPlayerRankAndDan, isPlayerOnLeave, formatPlayerLeavePeriod, isPlayerRetired, formatPlayerRetirementDate, getPlayerNumberPrefix } from '../utils/playerUtils';
import { OshiBadgeTag } from '../utils/badgeUtils';
import { getPlayerTotalTitles, formatEiseiBadgeLabel } from '../utils/titleUtils';
import {
  Heart,
  Calendar,
  Trophy,
  ChevronRight,
  Plus,
  Database,
  Lock
} from 'lucide-react';

interface OshiDashboardProps {
  followedList: FollowedPlayerConfig[];
  players: Player[];
  matches: Match[];
  onSelectPlayer: (player: Player) => void;
  onSelectMatch: (match: Match) => void;
  onOpenDirectory: () => void;
  onOpenCalendar: () => void;
  onOpenResults?: () => void;
  onOpenAdminDb?: () => void;
  onRemoveFollow: (playerId: string) => void;
  onToggleFollow?: (config: FollowedPlayerConfig) => void;
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
  onSelectPlayer,
  onSelectMatch,
  onOpenDirectory,
  onOpenCalendar,
  onOpenResults,
  onOpenAdminDb,
  onRemoveFollow,
  onToggleFollow,
}) => {
  const followedPlayerMap = new Map(players.map((p) => [p.id, p]));

  // Dynamically obtain today's date upon launch
  const todayDate = getTodayDateString();
  const todayInfo = getTodayInfo();

  // Find today's matches
  const todayMatches = matches.filter((m) => m.date === todayDate || (m.status === 'live' && m.date >= todayDate));
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
                    <span>詳細を見る</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                公式対局結果一覧<br />（年度別: 4月〜翌年3月）
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
              棋士・女流棋士を推し登録して、対局日通知やカレンダー同期を始めましょう！
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
                  m.status !== 'finished' &&
                  m.date >= todayDate
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
                        <OshiBadgeTag badge={config.badge} size="xs" />
                        {isPlayerRetired(player) && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-200 border border-zinc-500/80"
                            title={formatPlayerRetirementDate(player)}
                          >
                            引退
                          </span>
                        )}
                        {isPlayerOnLeave(player) && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            title={formatPlayerLeavePeriod(player)}
                          >
                            休場
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {getPlayerNumberPrefix(player)} No.{player.playerNumber}
                        </span>
                      </div>

                      {/* 1段目: 氏名 段位 */}
                      <div className="flex items-baseline gap-2.5">
                        <h4 className="text-base sm:text-lg font-black text-zinc-100 font-serif-jp tracking-wide group-hover:text-amber-300 transition-colors">
                          {formatPlayerName(player.name)}
                        </h4>
                        <span className="text-xs sm:text-sm font-bold text-amber-400 font-serif-jp">
                          {formatPlayerRankAndDan(player)}
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

                      {/* Titles & Eisei Badges */}
                      {(() => {
                        const totalTitles = getPlayerTotalTitles(player);
                        const eiseiLabel = formatEiseiBadgeLabel(player);
                        if (!eiseiLabel && player.heldTitles.length === 0 && totalTitles === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {eiseiLabel && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-0.5 shadow-sm">
                                {eiseiLabel}
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
                                通算{totalTitles}期
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* 3段目: 応援メモ（設定されている場合） */}
                      {config.cheeringNote && (
                        <div className="mt-1.5 text-[11px] text-amber-300/95 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1.5 max-w-full">
                          <span className="shrink-0 text-xs">💬</span>
                          <span className="truncate">{config.cheeringNote}</span>
                        </div>
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
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/70">
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
                          {player.currentYearWins + player.currentYearLosses > 0 ? `${(player.currentYearWinRate * 100).toFixed(0)}%` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFollow(player.id);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 text-xs font-bold transition border border-zinc-700 cursor-pointer"
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
      {onOpenAdminDb && (
        <div className="pt-2">
          <button
            onClick={onOpenAdminDb}
            className="w-full p-4 rounded-3xl bg-emerald-950/25 border border-emerald-500/35 hover:border-emerald-400 transition flex items-center justify-between text-left group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Database size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-200 font-serif-jp flex items-center gap-1.5">
                  <span>棋士・女流棋士DB 管理</span>
                  <Lock size={12} className="text-emerald-400 shrink-0" />
                </h4>
                <p className="text-xs text-zinc-400">
                  DB管理・改名反映・JSON/Turso取込（パスワード保護）
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-emerald-400/70 group-hover:text-emerald-300 transition shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
