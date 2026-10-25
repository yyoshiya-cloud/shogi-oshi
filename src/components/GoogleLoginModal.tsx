import React, { useState } from 'react';
import { ShieldCheck, LogOut, CheckCircle2, User, X, Mail, Heart } from 'lucide-react';
import { Player, FollowedPlayerConfig } from '../types/shogi';

export interface GoogleUser {
  name: string;
  email: string;
  avatar: string;
}

interface GoogleLoginModalProps {
  currentUser: GoogleUser | null;
  followedList?: FollowedPlayerConfig[];
  players?: Player[];
  onLogin: (user: GoogleUser) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  currentUser,
  followedList = [],
  players = [],
  onLogin,
  onLogout,
  onClose,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [customEmail, setCustomEmail] = useState('y.yoshiya@gmail.com');
  const [customName, setCustomName] = useState('Y.Yoshiya');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleLogin = (name: string, email: string) => {
    setIsSigningIn(true);
    setTimeout(() => {
      const user: GoogleUser = {
        name: name || 'Y.Yoshiya',
        email: email || 'y.yoshiya@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      };
      onLogin(user);
      setIsSigningIn(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 text-zinc-100 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.94H1.18v3.15C3.17 21.36 7.23 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.18C.43 8.1 0 9.99 0 12s.43 3.9 1.18 5.41l4.1-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.18 6.59l4.1 3.15c.95-2.83 3.6-4.99 6.72-4.99z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-black font-serif-jp text-zinc-100">
                Google アカウント連携
              </h3>
              <p className="text-[11px] text-zinc-400">推し棋士・女流棋士データの同期・保存</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {currentUser ? (
          /* Currently Logged In View */
          <div className="space-y-4">
            <div className="bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3.5 shadow-inner">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-black text-lg flex items-center justify-center border-2 border-amber-400 shadow-md">
                {currentUser.name ? currentUser.name.charAt(0) : 'Y'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-0.5">
                  <CheckCircle2 size={13} />
                  <span>Googleアカウント連携中</span>
                </div>
                <h4 className="font-bold text-zinc-100 text-sm truncate">
                  {currentUser.name}
                </h4>
                <p className="text-xs text-zinc-400 truncate font-mono">{currentUser.email}</p>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-2xl text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <ShieldCheck size={14} />
                <span>推し棋士データ クラウド自動保存完了</span>
              </div>
              <p className="text-amber-200/80 text-[11px] leading-relaxed">
                ログイン中のGoogleアカウント ({currentUser.email}) に登録済みの推し棋士・女流棋士データが安全にリンク保存されています。
              </p>
            </div>

            {/* List of Linked Oshi Players & Female Players */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                  <Heart size={13} className="text-rose-400 fill-rose-400" />
                  <span>リンク中の推し棋士・女流棋士 ({followedList.length}名)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  リンク済み
                </span>
              </div>

              {followedList.length === 0 ? (
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-center text-xs text-zinc-500">
                  まだ推し棋士が登録されていません。棋士名鑑から登録するとアカウントに自動リンクされます。
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {followedList.map((f) => {
                    const p = players.find((pl) => pl.id === f.playerId);
                    const cleanName = p ? p.name : f.playerId;
                    const rank = p ? p.rank : '棋士';
                    const affiliation = p?.type === 'women' ? '女流棋士' : '棋士';
                    return (
                      <div
                        key={f.playerId}
                        className="flex items-center justify-between bg-zinc-950/80 px-3 py-2 rounded-xl border border-zinc-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-6 h-6 rounded-lg text-white font-bold flex items-center justify-center text-[11px] shadow shrink-0"
                            style={{ backgroundColor: f.color }}
                          >
                            {cleanName[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-100 font-serif-jp mr-1.5 truncate">
                              {cleanName}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {rank} ({affiliation})
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          {f.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition"
              >
                <LogOut size={14} />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        ) : (
          /* Sign In View */
          <div className="space-y-4">
            <div className="text-center py-1">
              <h4 className="text-sm font-bold text-zinc-100 font-serif-jp">
                実際に使用しているアカウントでログイン
              </h4>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 leading-relaxed">
                Googleアカウントと連携して、推し棋士の登録データや応援コメントを安全に保存・同期します。
              </p>
            </div>

            {/* Primary Detected Account Card: y.yoshiya@gmail.com */}
            {!isCustomMode ? (
              <div className="space-y-3">
                <button
                  onClick={() => handleLogin('Y.Yoshiya', 'y.yoshiya@gmail.com')}
                  disabled={isSigningIn}
                  className="w-full bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-700/80 hover:border-amber-500/50 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left transition shadow-md group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                      Y
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-zinc-100 group-hover:text-amber-300 transition">
                          Y.Yoshiya
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                          ログイン可能
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono truncate">
                        y.yoshiya@gmail.com
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-zinc-900 font-bold text-xs shadow group-hover:bg-amber-400 group-hover:text-stone-950 transition">
                    {isSigningIn ? 'ログイン中...' : '連携する'}
                  </div>
                </button>

                <div className="text-center pt-1">
                  <button
                    onClick={() => setIsCustomMode(true)}
                    className="text-[11px] text-zinc-400 hover:text-amber-300 underline transition"
                  >
                    別のアカウントでログインする
                  </button>
                </div>
              </div>
            ) : (
              /* Custom Account Input */
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400">表示名</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="例: Y.Yoshiya"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400">Google アカウント (メールアドレス)</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setIsCustomMode(false)}
                    className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => handleLogin(customName, customEmail)}
                    disabled={isSigningIn}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition shadow"
                  >
                    {isSigningIn ? 'ログイン中...' : 'ログイン'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
