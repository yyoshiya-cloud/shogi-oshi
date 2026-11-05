import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Player, FollowedPlayerConfig, OshiBadge } from '../types/shogi';
import { X, Check, Bell, Palette, MessageSquareHeart, Trash2, Heart } from 'lucide-react';
import { formatPlayerName } from '../utils/playerUtils';
import { OSHI_BADGE_OPTIONS, getOshiBadgeConfig, renderOshiBadgeIcon } from '../utils/badgeUtils';

interface OshiConfigModalProps {
  player: Player;
  currentConfig?: FollowedPlayerConfig | null;
  onSave: (config: FollowedPlayerConfig) => void;
  onRemove?: (playerId: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  { color: '#f43f5e', name: 'ローズピンク' },
  { color: '#f59e0b', name: 'アンバーゴールド' },
  { color: '#10b981', name: 'エメラルド' },
  { color: '#0ea5e9', name: 'スカイブルー' },
  { color: '#8b5cf6', name: 'バイオレット' },
  { color: '#ec4899', name: 'ピュアピンク' },
  { color: '#f97316', name: 'コーラルオレンジ' },
  { color: '#06b6d4', name: 'シアン' },
];

export const OshiConfigModal: React.FC<OshiConfigModalProps> = ({
  player,
  currentConfig,
  onSave,
  onRemove,
  onClose,
}) => {
  const isEditing = !!currentConfig;

  const [selectedBadge, setSelectedBadge] = useState<OshiBadge>(currentConfig?.badge || '本命');
  const [selectedColor, setSelectedColor] = useState<string>(
    currentConfig?.color || (player.type === 'women' ? '#ec4899' : '#f59e0b')
  );
  const [cheeringNote, setCheeringNote] = useState<string>(currentConfig?.cheeringNote || '');
  const [notifyTiming, setNotifyTiming] = useState({
    dayBefore: currentConfig?.notifyTiming?.dayBefore ?? false,
    morningOf: currentConfig?.notifyTiming?.morningOf ?? true,
    matchStart: currentConfig?.notifyTiming?.matchStart ?? true,
    resultImmediately: currentConfig?.notifyTiming?.resultImmediately ?? true,
  });

  // Lock body scroll to prevent mobile Android Chrome GPU compositor tearing
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  const handleSave = () => {
    const newConfig: FollowedPlayerConfig = {
      playerId: player.id,
      badge: selectedBadge,
      color: selectedColor,
      cheeringNote: cheeringNote.trim(),
      notificationsEnabled: true,
      notifyTiming,
      cheerCount: currentConfig?.cheerCount || 0,
      followedAt: currentConfig?.followedAt || new Date().toISOString(),
      fanComments: currentConfig?.fanComments || [],
    };
    onSave(newConfig);
    onClose();
  };

  const selectedBadgeObj = getOshiBadgeConfig(selectedBadge);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex flex-col justify-end sm:justify-center items-center sm:p-4 touch-none"
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
        className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl text-zinc-100 overflow-hidden relative touch-auto overscroll-contain"
        style={{
          transform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          isolation: 'isolate',
        }}
      >
        {/* Header - Pinned at top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold font-serif-jp text-white shadow-md overflow-hidden shrink-0 border border-white/20"
              style={{ backgroundColor: selectedColor }}
            >
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                player.name[0]
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-zinc-400">
                  {player.type === 'women' ? '女流棋士' : '棋士'}
                </span>
                <span className="text-xs text-amber-400 font-bold font-serif-jp">
                  {player.rank}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black font-serif-jp tracking-wide truncate">
                {formatPlayerName(player.name)}
                <span className="text-xs font-normal text-zinc-400 ml-1.5 font-sans">
                  {isEditing ? '推し設定の変更' : '推し棋士に登録'}
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
            title="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 overscroll-contain">

        {/* 1. 推しバッジの選択 */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <Heart size={14} className="text-rose-400 fill-rose-400" />
            <span>推しバッジを選択</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {OSHI_BADGE_OPTIONS.map((opt) => {
              const isSelected = selectedBadge === opt.badge;
              return (
                <button
                  key={opt.badge}
                  type="button"
                  onClick={() => setSelectedBadge(opt.badge)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 relative ${
                    opt.bg
                  } ${opt.text} ${
                    isSelected
                      ? `${opt.border} ring-2 ${opt.ring} shadow-md shadow-${opt.ring}/20 bg-opacity-40`
                      : 'border-zinc-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm flex items-center gap-1.5">
                      {renderOshiBadgeIcon(opt.badge, 16)}
                      <span>{opt.label}</span>
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center">
                        <Check size={11} className="stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-normal leading-tight">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 推しカラーの設定 */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Palette size={14} className="text-amber-400" />
              <span>推しカラーを設定</span>
            </span>
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              プレビュー:
              <span
                className="inline-block w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: selectedColor }}
              />
            </span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-zinc-950/60 p-2.5 rounded-2xl border border-zinc-800">
            {PRESET_COLORS.map((c) => {
              const isSelected = selectedColor.toLowerCase() === c.color.toLowerCase();
              return (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setSelectedColor(c.color)}
                  className={`w-full aspect-square rounded-xl transition flex items-center justify-center relative shadow-sm hover:scale-105 ${
                    isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                >
                  {isSelected && <Check size={14} className="text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 応援メモの入力 */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageSquareHeart size={14} className="text-rose-400" />
              <span>応援メモ（推しポイント・自由メモ）</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">任意</span>
          </label>
          <textarea
            value={cheeringNote}
            onChange={(e) => setCheeringNote(e.target.value)}
            rows={2}
            maxLength={100}
            placeholder="例: 竜王戦防衛全力応援！ / 詰将棋の美しさに魅了されました / 終盤の切れ味が最高"
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500 transition resize-none"
          />
          <div className="text-right text-[10px] text-zinc-500">
            {cheeringNote.length} / 100文字
          </div>
        </div>

        {/* 4. 通知タイミング設定 */}
        <div className="space-y-2 bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/80">
          <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Bell size={13} className="text-amber-400" />
            <span>対局通知タイミング</span>
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={notifyTiming.morningOf}
                onChange={(e) => setNotifyTiming({ ...notifyTiming, morningOf: e.target.checked })}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900"
              />
              <span>当日朝 (08:00)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={notifyTiming.matchStart}
                onChange={(e) => setNotifyTiming({ ...notifyTiming, matchStart: e.target.checked })}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900"
              />
              <span>対局開始時</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={notifyTiming.resultImmediately}
                onChange={(e) => setNotifyTiming({ ...notifyTiming, resultImmediately: e.target.checked })}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900"
              />
              <span>終局速報</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={notifyTiming.dayBefore}
                onChange={(e) => setNotifyTiming({ ...notifyTiming, dayBefore: e.target.checked })}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900"
              />
              <span>前日夜 (20:00)</span>
            </label>
          </div>
        </div>

        </div>

        {/* Action Buttons - Pinned at bottom */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 shrink-0 flex items-center gap-2.5">
          {isEditing && onRemove && (
            <button
              type="button"
              onClick={() => {
                onRemove(player.id);
                onClose();
              }}
              className="p-3 rounded-2xl bg-zinc-850 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 text-xs font-bold transition border border-zinc-700 shrink-0 flex items-center gap-1 cursor-pointer"
              title="推し登録を解除"
            >
              <Trash2 size={15} />
              <span>推し解除</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Heart size={14} className="fill-stone-950" />
            <span>{isEditing ? '推し設定を更新する' : `${selectedBadge}として推し登録する`}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
