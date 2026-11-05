import React, { useState, useEffect } from 'react';
import { Player, Match, FollowedPlayerConfig } from '../types/shogi';
import { getOshiBadgeConfig, renderOshiBadgeIcon, OshiBadgeTag } from '../utils/badgeUtils';
import { getPlayerTotalTitles } from '../utils/titleUtils';
import { formatPlayerName } from '../utils/playerUtils';
import {
  Smartphone,
  CheckCircle2,
  Calendar,
  Trophy,
  ChevronRight,
  X,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Layers,
  Flame,
  Zap,
  Info,
  Download,
  Share2,
  Clock
} from 'lucide-react';

interface AndroidWidgetModalProps {
  followedList: FollowedPlayerConfig[];
  players: Player[];
  matches: Match[];
  onClose: () => void;
  onSelectMatch?: (match: Match) => void;
  onSelectPlayer?: (player: Player) => void;
}

export type WidgetSize = 'medium' | 'small' | 'large';
export type WidgetTheme = 'shogi' | 'dark' | 'gold' | 'sakura';

interface WidgetConfig {
  selectedPlayerId: string; // 'auto' or player ID
  size: WidgetSize;
  theme: WidgetTheme;
  showVsRecord: boolean;
  showKifuLink: boolean;
  autoRefresh: boolean;
}

export const AndroidWidgetModal: React.FC<AndroidWidgetModalProps> = ({
  followedList,
  players,
  matches,
  onClose,
  onSelectMatch,
  onSelectPlayer,
}) => {
  // Config state initialized from localStorage
  const [config, setConfig] = useState<WidgetConfig>(() => {
    try {
      const saved = localStorage.getItem('shogi_oshi_widget_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      selectedPlayerId: 'auto',
      size: 'medium',
      theme: 'shogi',
      showVsRecord: true,
      showKifuLink: true,
      autoRefresh: true,
    };
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'instructions' | 'web_widget'>('preview');
  const [isCopied, setIsCopied] = useState(false);
  const [isAddedSuccess, setIsAddedSuccess] = useState(false);

  // Save config on change
  useEffect(() => {
    try {
      localStorage.setItem('shogi_oshi_widget_config', JSON.stringify(config));
    } catch {}
  }, [config]);

  // Determine active target player
  const followedPlayerObjects = followedList
    .map((f) => players.find((p) => p.id === f.playerId))
    .filter((p): p is Player => p !== undefined);

  const activePlayer =
    config.selectedPlayerId === 'auto'
      ? followedPlayerObjects[0] || players[0]
      : players.find((p) => p.id === config.selectedPlayerId) || players[0];

  const activeFollowConfig = followedList.find((f) => f.playerId === activePlayer?.id);

  // Get next or recent match for active player
  const activePlayerMatches = activePlayer
    ? matches.filter(
        (m) => m.player1Id === activePlayer.id || m.player2Id === activePlayer.id
      )
    : [];

  // Upcoming/live match first, otherwise recent match
  const upcomingMatch = activePlayerMatches.find(
    (m) => m.status === 'upcoming' || m.status === 'live'
  );
  const recentFinishedMatch = activePlayerMatches.find(
    (m) => m.status === 'finished'
  );

  const displayMatch = upcomingMatch || recentFinishedMatch || matches[0];

  // Opponent calculation
  let opponentPlayer: Player | undefined;
  if (displayMatch && activePlayer) {
    const oppId =
      displayMatch.player1Id === activePlayer.id
        ? displayMatch.player2Id
        : displayMatch.player1Id;
    opponentPlayer = players.find((p) => p.id === oppId);
  }

  const isPlayer1 = displayMatch && activePlayer && displayMatch.player1Id === activePlayer.id;

  // Outcome calculation if finished
  let outcome: 'win' | 'loss' | 'upcoming' | 'live' = 'upcoming';
  if (displayMatch?.status === 'live') {
    outcome = 'live';
  } else if (displayMatch?.status === 'finished' && displayMatch.winnerId) {
    outcome = displayMatch.winnerId === activePlayer?.id ? 'win' : 'loss';
  }

  // VS Record calculation
  let vsWin = 0;
  let vsLoss = 0;
  if (activePlayer && opponentPlayer) {
    const pastHeadToHead = matches.filter(
      (m) =>
        m.status === 'finished' &&
        m.winnerId &&
        ((m.player1Id === activePlayer.id && m.player2Id === opponentPlayer.id) ||
          (m.player1Id === opponentPlayer.id && m.player2Id === activePlayer.id))
    );
    vsWin = pastHeadToHead.filter((m) => m.winnerId === activePlayer.id).length;
    vsLoss = pastHeadToHead.filter((m) => m.winnerId === opponentPlayer.id).length;
  }

  // Theme styling helpers
  const getThemeStyles = (theme: WidgetTheme) => {
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-zinc-950/95 text-zinc-100 border-zinc-700/60 shadow-2xl',
          headerBg: 'bg-zinc-900/90 border-b border-zinc-800',
          accent: 'text-sky-400',
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          highlight: 'bg-zinc-900 border-zinc-800',
        };
      case 'gold':
        return {
          bg: 'bg-gradient-to-br from-[#1a140a] via-[#2a1d0d] to-[#120e07] text-amber-100 border-amber-500/50 shadow-2xl',
          headerBg: 'bg-amber-950/60 border-b border-amber-800/50',
          accent: 'text-amber-300',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          highlight: 'bg-amber-950/40 border-amber-900/50',
        };
      case 'sakura':
        return {
          bg: 'bg-gradient-to-br from-[#1c1216] via-[#2d1722] to-[#140b10] text-rose-100 border-rose-500/40 shadow-2xl',
          headerBg: 'bg-rose-950/60 border-b border-rose-900/50',
          accent: 'text-rose-300',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          highlight: 'bg-rose-950/40 border-rose-900/40',
        };
      case 'shogi':
      default:
        return {
          bg: 'bg-gradient-to-b from-[#1c1813] via-[#14120e] to-[#0d0c0a] text-amber-50 border-amber-600/40 shadow-2xl',
          headerBg: 'bg-[#262019]/90 border-b border-amber-900/40',
          accent: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          highlight: 'bg-[#181410] border-amber-900/30',
        };
    }
  };

  const themeStyles = getThemeStyles(config.theme);

  const handleCopyEmbedCode = () => {
    const embedHtml = `<iframe src="${window.location.origin}/?widget=true&playerId=${activePlayer?.id || 'auto'}&size=${config.size}&theme=${config.theme}" width="380" height="240" style="border:none;border-radius:16px;" title="将棋推し棋士直近対局ウィジェット"></iframe>`;
    navigator.clipboard.writeText(embedHtml);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleSimulateAddWidget = () => {
    setIsAddedSuccess(true);
    setTimeout(() => setIsAddedSuccess(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black font-serif-jp text-zinc-100 tracking-wide">
                  Android ホーム画面ウィジェット
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  PWA Widget 対応
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                推し棋士の直近の対局予定・勝敗結果をスマホのホーム画面でいつでも確認
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
            title="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-5 pt-2 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone size={14} />
            ライブプレビュー & カスタマイズ
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'instructions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Info size={14} />
            Android追加手順ガイド
          </button>
          <button
            onClick={() => setActiveTab('web_widget')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'web_widget'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Share2 size={14} />
            Web埋め込みコード
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'preview' && (
            <>
              {/* Android Home Screen Simulator Container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    Android ホーム画面 リアルタイムシミュレーター
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    表示サイズ: {config.size === 'small' ? '2×2' : config.size === 'medium' ? '4×2 (推奨)' : '4×4'}
                  </span>
                </div>

                {/* Simulated Android Phone Wall Frame */}
                <div className="relative rounded-3xl bg-[#0e1117] border-4 border-zinc-800 p-4 sm:p-6 shadow-2xl overflow-hidden min-h-[300px] flex flex-col justify-between"
                     style={{
                       backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(30, 41, 59, 0.8), rgba(9, 9, 11, 0.95))',
                     }}
                >
                  {/* Top Bar of Android Phone */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pb-3 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300">10:00</span>
                      <span className="text-[10px] text-amber-400 font-sans font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                        将棋推し活
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>5G 📶</span>
                      <span>100% 🔋</span>
                    </div>
                  </div>

                  {/* Widget Preview Box */}
                  <div className="my-4 flex justify-center">
                    {/* WIDGET CARD RENDER */}
                    <div
                      className={`w-full transition-all duration-300 rounded-2xl border p-4 ${themeStyles.bg} ${
                        config.size === 'small'
                          ? 'max-w-[220px]'
                          : config.size === 'medium'
                          ? 'max-w-[440px]'
                          : 'max-w-[500px]'
                      }`}
                    >
                      {/* Widget Header Row */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
                        <div className="flex items-center gap-2 truncate">
                          {/* App icon mini badge */}
                          <div className="w-5 h-5 rounded-md koma-shape bg-amber-500 text-stone-950 font-black font-serif-jp text-[10px] flex items-center justify-center shrink-0">
                            推
                          </div>
                          <span className="text-xs font-bold font-serif-jp truncate text-white/90">
                            推し棋士 直近対局
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {activeFollowConfig?.badge && (
                            <OshiBadgeTag badge={activeFollowConfig.badge} size="xs" />
                          )}
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <Clock size={10} />
                            自動更新中
                          </span>
                        </div>
                      </div>

                      {/* Main Player & Match Info */}
                      {activePlayer ? (
                        <div className="space-y-2.5">
                          {/* Player Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {activePlayer.photoUrl ? (
                                <img
                                  src={activePlayer.photoUrl}
                                  alt={activePlayer.name}
                                  className="w-10 h-10 rounded-full object-cover border border-amber-500/50 shadow-sm shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-amber-600/30 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-sm shrink-0">
                                  {activePlayer.name[0]}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-sm font-black font-serif-jp text-white">
                                    {activePlayer.name}
                                  </h4>
                                  <span className="text-xs font-bold text-amber-400">
                                    {activePlayer.rank}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400">
                                  {activePlayer.affiliation || '日本将棋連盟'} • 通算勝率 {(activePlayer.careerWinRate * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div>
                              {outcome === 'live' && (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-500/30 border border-rose-500/60 text-rose-300 text-xs font-bold flex items-center gap-1 animate-pulse">
                                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                                  対局中
                                </span>
                              )}
                              {outcome === 'upcoming' && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1">
                                  <Calendar size={12} />
                                  対局予定
                                </span>
                              )}
                              {outcome === 'win' && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/30 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-1">
                                  <Trophy size={12} />
                                  勝利
                                </span>
                              )}
                              {outcome === 'loss' && (
                                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-bold">
                                  敗戦
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Match Detail Row */}
                          {displayMatch ? (
                            <div className={`p-2.5 rounded-xl border ${themeStyles.highlight} space-y-1.5`}>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-amber-400 truncate max-w-[65%]">
                                  {displayMatch.tournament}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {displayMatch.date} ({displayMatch.time})
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs font-serif-jp pt-1 border-t border-white/5">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-zinc-400 text-[10px]">対局相手:</span>
                                  <span className="font-bold text-white">
                                    {opponentPlayer ? opponentPlayer.name : '対戦相手'}
                                  </span>
                                  {opponentPlayer && (
                                    <span className="text-[10px] text-amber-300 font-sans">
                                      {opponentPlayer.rank}
                                    </span>
                                  )}
                                </div>

                                {config.showVsRecord && opponentPlayer && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                                    通算 VS {vsWin}勝{vsLoss}敗
                                  </span>
                                )}
                              </div>

                              {displayMatch.status === 'finished' && displayMatch.movesCount && (
                                <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1">
                                  <span>総手数: {displayMatch.movesCount}手</span>
                                  {displayMatch.openingStrategy && (
                                    <span>戦型: {displayMatch.openingStrategy}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 text-center text-xs text-zinc-400 bg-zinc-900/40 rounded-xl">
                              現在公表されている対局日程はありません
                            </div>
                          )}

                          {/* Action Link inside Widget */}
                          <div className="flex items-center justify-between text-[10px] pt-1 text-zinc-400">
                            <span>タップでアプリの対局詳細を開きます</span>
                            {displayMatch && onSelectMatch && (
                              <button
                                onClick={() => {
                                  onClose();
                                  onSelectMatch(displayMatch);
                                }}
                                className="text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                詳細を見る <ChevronRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-zinc-400">
                          推し棋士が登録されていません。棋士名鑑から推し登録してください。
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Android Launcher Dock Icons simulation */}
                  <div className="flex items-center justify-around pt-3 border-t border-zinc-800/60 opacity-60">
                    <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs">
                      📞
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xs">
                      💬
                    </div>
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 font-black flex items-center justify-center text-xs shadow-lg">
                      推
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 text-xs">
                      🌐
                    </div>
                  </div>
                </div>
              </div>

              {/* Widget Customization Controls */}
              <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} />
                  ウィジェット表示設定
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Select Oshi Player */}
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1.5">
                      表示する推し棋士:
                    </label>
                    <select
                      value={config.selectedPlayerId}
                      onChange={(e) =>
                        setConfig({ ...config, selectedPlayerId: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="auto">
                        ✨ 最推し（リスト先頭の棋士を自動表示）
                      </option>
                      {followedPlayerObjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.rank})
                        </option>
                      ))}
                      {followedPlayerObjects.length === 0 && (
                        <option value="fujii-sota">藤井 聡太 竜王・名人 (初期選択)</option>
                      )}
                    </select>
                  </div>

                  {/* Select Theme */}
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1.5">
                      ウィジェットテーマデザイン:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'shogi', name: '将棋木目', bg: 'bg-[#262019] text-amber-300' },
                          { id: 'dark', name: 'ダーク', bg: 'bg-zinc-900 text-sky-400' },
                          { id: 'gold', name: 'ゴールド', bg: 'bg-amber-950 text-amber-300' },
                          { id: 'sakura', name: '桜・ピンク', bg: 'bg-rose-950 text-rose-300' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setConfig({ ...config, theme: t.id })}
                          className={`p-2 rounded-xl text-[10px] font-bold transition border text-center cursor-pointer ${
                            t.bg
                          } ${
                            config.theme === t.id
                              ? 'border-amber-400 ring-2 ring-amber-400/40'
                              : 'border-zinc-800 opacity-70 hover:opacity-100'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Size */}
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1.5">
                      ウィジェットサイズ:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'small', label: '2×2 小型' },
                          { id: 'medium', label: '4×2 標準 (推奨)' },
                          { id: 'large', label: '4×4 大型' },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setConfig({ ...config, size: s.id })}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition border text-center cursor-pointer ${
                            config.size === s.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Features */}
                  <div className="space-y-2">
                    <label className="block text-zinc-300 font-bold mb-1">
                      表示オプション:
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showVsRecord}
                        onChange={(e) =>
                          setConfig({ ...config, showVsRecord: e.target.checked })
                        }
                        className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-950"
                      />
                      <span>通算対戦成績（VS表示）を含める</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.autoRefresh}
                        onChange={(e) =>
                          setConfig({ ...config, autoRefresh: e.target.checked })
                        }
                        className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-950"
                      />
                      <span>対局結果の自動バックグラウンド更新を有効化</span>
                    </label>
                  </div>
                </div>

                {/* Add Widget Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSimulateAddWidget}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone size={18} />
                    <span>Android ホーム画面にウィジェットを追加する</span>
                  </button>

                  {isAddedSuccess && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>
                        ウィジェット設定をアプリ・PWA構成に登録しました！下記の「Android追加手順ガイド」に従ってホーム画面に追加してください。
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-5">
              <div className="bg-[#0e131f] p-4.5 rounded-2xl border border-sky-500/30 text-xs space-y-3">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                  <Smartphone size={18} />
                  <span>Android ホーム画面ウィジェット設定手順 (2ステップ)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  将棋推し活アプリは Progressive Web App (PWA) ウィジェット規格およびショートカット連携に対応しています。
                </p>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <h5 className="font-bold text-zinc-100 text-sm">
                      アプリをホーム画面に追加（PWAインストール）
                    </h5>
                    <p className="text-zinc-400 leading-relaxed">
                      AndroidのChromeブラウザで本アプリを開き、画面右上の「⋮（メニュー）」→
                      <strong>「ホーム画面に追加」</strong>
                      または<strong>「アプリをインストール」</strong>をタップします。
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <h5 className="font-bold text-zinc-100 text-sm">
                      ホーム画面の長押しから「ウィジェット」を選択
                    </h5>
                    <p className="text-zinc-400 leading-relaxed">
                      スマホのホーム画面の空きスペースを長押しし、<strong>「ウィジェット」</strong>メニューを選択。一覧から「将棋推し活アプリ」を選んでホーム画面の好きな場所に配置します。
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <h5 className="font-bold text-zinc-100 text-sm">
                      対局予定・勝敗結果のリアルタイム更新
                    </h5>
                    <p className="text-zinc-400 leading-relaxed">
                      連盟公式からの対局結果・対局予定が自動同期され、ウィジェットの表示も最新状態にアップデートされます。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'web_widget' && (
            <div className="space-y-4 text-xs">
              <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <h5 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <Share2 size={16} className="text-amber-400" />
                  <span>Webサイト・ブログ用 埋め込みウィジェットコード</span>
                </h5>
                <p className="text-zinc-400 leading-relaxed">
                  ご自身のブログや推し活Webサイトに、最新対局予定を表示するウィジェットを埋め込むことができます。
                </p>

                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-[11px] text-amber-300 break-all select-all">
                  {`<iframe src="${window.location.origin}/?widget=true&playerId=${activePlayer?.id || 'auto'}&size=${config.size}&theme=${config.theme}" width="380" height="240" style="border:none;border-radius:16px;" title="将棋推し棋士直近対局ウィジェット"></iframe>`}
                </div>

                <button
                  onClick={handleCopyEmbedCode}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>クリップボードにコピーしました！</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={16} />
                      <span>埋め込みHTMLコードをコピー</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>PWA Widget / Android ホーム画面連動アクティブ</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
