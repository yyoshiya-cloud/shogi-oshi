import React from 'react';
import { Sparkles, Trophy, Heart, Calendar, Users, Bell, ShieldCheck, X, ExternalLink } from 'lucide-react';

interface AppInfoModalProps {
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 text-zinc-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black font-serif-jp text-zinc-100">
                機能一覧 & アプリ情報
              </h3>
              <p className="text-xs text-zinc-400">将棋推し活アプリ Ver1.1.0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Author Section */}
        <div className="bg-[#0b111e] p-4 sm:p-4.5 rounded-2xl border border-zinc-800 space-y-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm font-bold text-zinc-100">Author:</span>
            <div className="flex flex-wrap items-center gap-2">
              {/* Bluesky Pill */}
              <a
                href="https://bsky.app/profile/yoshiya.bsky.social"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-sky-500/80 bg-sky-950/40 hover:bg-sky-900/50 text-sky-400 text-xs font-medium transition shadow-sm"
                title="Bluesky @yoshiya.bsky.social を開く"
              >
                <span>Bluesky @yoshiya.bsky.social</span>
                <ExternalLink size={12} className="opacity-80" />
              </a>

              {/* Threads Pill */}
              <a
                href="https://www.threads.net/@yutakayoshiya"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-purple-600 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 text-xs font-medium transition shadow-sm"
                title="Threads @yutakayoshiya を開く"
              >
                <span>Threads @yutakayoshiya</span>
                <ExternalLink size={12} className="opacity-80" />
              </a>

              {/* X Pill */}
              <a
                href="https://x.com/Yoshiya"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-500 text-zinc-200 text-xs font-medium transition shadow-sm"
                title="X @Yoshiya を開く"
              >
                <span>X @Yoshiya</span>
                <ExternalLink size={12} className="opacity-80" />
              </a>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 leading-relaxed">
            すべての将棋ファンと棋士・女流棋士を応援するために製作された公式推し活ナビゲーションアプリです。
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            主要機能一覧
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
                <Calendar size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  1. 公式対局予定カレンダー & リアルタイム同期
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  日本将棋連盟公式（shogi.or.jp）と自動連動し、全公式戦（竜王戦・名人戦・叡王戦など）の最新対局日程・棋戦・会場情報をワンクリックで更新。Googleカレンダーや.ics出力にも対応。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
                <Heart size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  2. 推し棋士登録 & Googleアカウントデータ保存
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  本命・神推し・激推しバッジをつけてお気に入りの棋士を管理。Googleアカウントでログインすることで、推し棋士データをクラウド & ローカルに安全に同期・保存できます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                <Users size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  3. 棋士・女流棋士名鑑 (連盟・LPSA・無所属)
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  現役プロ棋士・女流棋士のプロフィール、タイトル履歴、通算・今年度成績、詳細データを網羅。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
                <Trophy size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  4. 公式対局結果一覧（年度別 4月〜翌年3月 全網羅）
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  日本将棋連盟公式（shogi.or.jp/game/?month=YYYYMM）の年度別（4月〜翌年3月）対局結果を全網羅。棋士・女流棋士の勝敗、先手後手、携帯中継・棋譜リンク、推し棋士絞り込みに対応。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mt-0.5">
                <Bell size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  5. プッシュ通知速報アラート
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  推し棋士の対局日、朝の通知、対局開始リマインド、終局後の速報をタイムリーにお届け。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
