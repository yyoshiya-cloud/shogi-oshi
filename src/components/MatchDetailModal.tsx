import React from 'react';
import { Match, Player } from '../types/shogi';
import { ShogiBoardViewer } from './ShogiBoardViewer';
import { getGoogleCalendarUrl, downloadICSFile } from '../utils/calendarExport';
import { triggerPushNotification } from '../utils/storage';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Tv,
  ExternalLink,
  Bell,
  Download,
  Share2,
  Sparkles,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  onNotificationSent,
  onSelectPlayer,
}) => {
  if (!match) return null;

  const player1 = players.find((p) => p.id === match.player1Id);
  const player2 = players.find((p) => p.id === match.player2Id);

  if (!player1 || !player2) return null;

  const winner = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  const sentePlayer = (match.sentePlayerId ? players.find((p) => p.id === match.sentePlayerId) : null) ?? player1;
  const gotePlayer = (match.gotePlayerId ? players.find((p) => p.id === match.gotePlayerId) : null) ?? player2;

  // Simulate pushing notification for this match result
  const handleTestResultNotification = async () => {
    if (isFinished && winner) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 }
      });
      await triggerPushNotification(
        `【終局速報】${winner.name} ${winner.rank}が勝利！`,
        `${match.tournament}にて、${winner.name}が${match.movesCount || '百数'}手で勝利を収めました。棋譜速報が公開されています。`,
        'match_result',
        match.id,
        winner.id
      );
    } else {
      await triggerPushNotification(
        `【対局開始】${match.tournament} が始まりました！`,
        `${player1.name} ${player1.rank} vs ${player2.name} ${player2.rank} (${match.venue})。熱戦を見守りましょう！`,
        'match_start',
        match.id,
        player1.id
      );
    }
    if (onNotificationSent) onNotificationSent();
  };

  // Google Calendar URL
  const gcalUrl = getGoogleCalendarUrl(match, player1, player2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isLive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : isFinished
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {isLive ? '対局中' : isFinished ? '終局' : '対局予定'}
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
            {/* Center VS or WIN indicator */}
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

          {/* Match Outcome details if Finished */}
          {isFinished && (
            <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900/80 to-amber-950/30 border border-amber-900/40 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-sm">
                <Sparkles size={16} />
                <span>対局結果・勝敗詳細</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500 block">勝者</span>
                  <span className="font-bold text-zinc-100 font-serif-jp text-sm">
                    {winner ? `${winner.name} ${winner.rank}` : '対局中'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">手数・決着</span>
                  <span className="font-bold text-zinc-100 text-sm">
                    {match.movesCount ? `${match.movesCount}手 (${match.endCondition || '投了'})` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">戦型</span>
                  <span className="font-bold text-zinc-100 text-sm">
                    {match.openingStrategy || '力戦'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Match Highlights */}
          {match.highlights && (
            <div className="bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl">
              <span className="text-xs font-semibold text-amber-300/90 block mb-1">
                見どころ・解説
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {match.highlights}
              </p>
            </div>
          )}

          {/* Action Buttons: Calendar Registration & Direct Kifu Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs sm:text-sm font-semibold transition"
            >
              <Calendar size={15} />
              <span>Googleカレンダーに登録</span>
            </a>

            <button
              onClick={() => downloadICSFile(match, player1, player2)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs sm:text-sm font-semibold transition"
            >
              <Download size={15} />
              <span>.ics カレンダーファイル保存</span>
            </button>
          </div>

          {/* Push Notification Trigger Test Button (Match result push notification) */}
          <div className="bg-zinc-900/90 border border-amber-500/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-left">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-100">
                  {isFinished ? '対局結果のプッシュ通知をテスト' : '対局当日の朝通知をテスト'}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {isFinished ? '勝敗速報と棋譜通知を即座に受信・確認できます' : '対局開始リマインダー通知を受信できます'}
                </p>
              </div>
            </div>
            <button
              onClick={handleTestResultNotification}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-md transition whitespace-nowrap"
            >
              通知を今すぐ送信
            </button>
          </div>

          {/* Broadcast Channels */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/40 px-3 py-2 rounded-lg">
            <Tv size={14} className="text-zinc-500 flex-shrink-0" />
            <span className="text-zinc-500">中継予定:</span>
            <span className="text-zinc-300 font-medium">
              {match.broadcast.join(' / ')}
            </span>
          </div>

          {/* Direct Kifu Board Viewer (if moves exist or finished) */}
          {match.kifuMoves && match.kifuMoves.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-100 font-serif-jp flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block" />
                  盤面・棋譜ステップ再生
                </h3>
                {match.kifuUrl && (
                  <a
                    href={match.kifuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
                  >
                    <span>公式棋譜へ直接リンク</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <ShogiBoardViewer
                moves={match.kifuMoves}
                kifuUrl={match.kifuUrl}
                tournament={match.tournament}
                senteName={`${sentePlayer.name} ${sentePlayer.rank}`}
                goteName={`${gotePlayer.name} ${gotePlayer.rank}`}
                totalMovesCount={match.movesCount}
                endCondition={match.endCondition}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
