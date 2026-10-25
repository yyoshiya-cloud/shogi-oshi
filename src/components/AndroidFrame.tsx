import React, { useState, useEffect } from 'react';
import { PushNotificationItem } from '../types/shogi';
import {
  Wifi,
  Battery,
  Signal,
  Bell,
  X,
  ChevronRight
} from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  activeNotification: PushNotificationItem | null;
  onDismissNotification: () => void;
  onSelectNotificationMatch?: (matchId: string) => void;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({
  children,
  activeNotification,
  onDismissNotification,
  onSelectNotificationMatch,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#090807] text-zinc-100 flex items-center justify-center p-0 sm:py-6 sm:px-4">
      {/* Dedicated Android Smartphone Container */}
      <div className="w-full sm:max-w-[428px] bg-[#121110] sm:rounded-[44px] sm:border-[8px] sm:border-[#262422] sm:shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden min-h-screen sm:min-h-[880px] flex flex-col relative">
        {/* Android Hardware Punch-hole Camera */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-40 border border-zinc-900 pointer-events-none hidden sm:block shadow-inner" />

        {/* Android Native Status Bar */}
        <div className="w-full h-8 px-6 flex items-center justify-between text-xs text-zinc-400 bg-[#121110] z-30 select-none border-b border-zinc-800/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200 text-[11px] tracking-tight">{currentTime}</span>
            {/* Shogi App Icon in Status Bar */}
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[8px] font-bold">
              将
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-zinc-400 tracking-tighter">5G</span>
            <Signal size={12} className="text-zinc-300" />
            <Wifi size={12} className="text-zinc-300" />
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold text-zinc-300">95%</span>
              <Battery size={13} className="text-zinc-100" />
            </div>
          </div>
        </div>

        {/* Heads-Up Notification Banner (Native Android Slide-down style) */}
        {activeNotification && (
          <div className="sticky top-8 left-0 right-0 z-50 px-3 py-2 animate-bounce-once">
            <div className="bg-zinc-900/95 border-2 border-amber-500/70 rounded-2xl p-3 shadow-2xl flex items-start gap-3 backdrop-blur-md">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-stone-950 flex-shrink-0 mt-0.5 shadow-md">
                <Bell size={16} />
              </div>

              <div
                className="flex-1 cursor-pointer"
                onClick={() => {
                  if (activeNotification.matchId && onSelectNotificationMatch) {
                    onSelectNotificationMatch(activeNotification.matchId);
                  }
                  onDismissNotification();
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-400 tracking-wider">
                    将棋推し活アプリ • 速報
                  </span>
                  <span className="text-[10px] text-zinc-500">たった今</span>
                </div>
                <h4 className="text-xs font-bold text-zinc-100 font-serif-jp mt-0.5">
                  {activeNotification.title}
                </h4>
                <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2 leading-relaxed">
                  {activeNotification.body}
                </p>
                {activeNotification.matchId && (
                  <span className="text-[10px] text-amber-400 font-bold mt-1 inline-flex items-center gap-0.5">
                    タップして対局詳細と棋譜を開く <ChevronRight size={10} />
                  </span>
                )}
              </div>

              <button
                onClick={onDismissNotification}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Android App Content */}
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>

        {/* Android Gesture Navigation Bar (Standard bottom pill bar) */}
        <div className="w-full py-2 flex justify-center bg-zinc-950/95 flex-shrink-0 z-30">
          <div className="w-28 h-1 bg-zinc-500 rounded-full opacity-70" />
        </div>
      </div>
    </div>
  );
};
