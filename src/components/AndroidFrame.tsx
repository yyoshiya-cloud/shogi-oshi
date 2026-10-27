import React from 'react';
import { PushNotificationItem } from '../types/shogi';
import { Bell, X, ChevronRight } from 'lucide-react';

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
  return (
    <div className="min-h-screen bg-[#090807] text-zinc-100 flex flex-col relative w-full">
      {/* Heads-Up Notification Banner */}
      {activeNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-bounce-once">
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
                  タップして対局詳細を開く <ChevronRight size={10} />
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

      {/* App Content */}
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto">{children}</div>
    </div>
  );
};
