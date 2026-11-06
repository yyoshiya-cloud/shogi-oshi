import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Trophy, Heart, Calendar, Users, Bell, X, ExternalLink, TrendingUp, Swords, Smartphone } from 'lucide-react';

interface AppInfoModalProps {
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ onClose }) => {
  // Lock body scroll while modal is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 touch-none"
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
        className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 text-zinc-100 space-y-5 touch-auto overscroll-contain"
        style={{
          transform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          isolation: 'isolate',
        }}
      >
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
              <p className="text-xs text-zinc-400">将棋推し活アプリ Ver 1.4.0</p>
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
                <svg className="w-3.5 h-3.5 fill-current shrink-0 text-sky-400" viewBox="0 0 24 24">
                  <path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026" />
                </svg>
                <span>@yoshiya.bsky.social</span>
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
                <svg className="w-3.5 h-3.5 fill-current shrink-0 text-purple-300" viewBox="0 0 24 24">
                  <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
                </svg>
                <span>@yutakayoshiya</span>
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
                <svg className="w-3.5 h-3.5 fill-current shrink-0 text-zinc-200" viewBox="0 0 24 24">
                  <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
                </svg>
                <span>@Yoshiya</span>
                <ExternalLink size={12} className="opacity-80" />
              </a>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 leading-relaxed">
            すべての将棋ファンと棋士・女流棋士を応援するために製作された推し活ナビゲーションアプリです。
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            主要機能一覧
          </h4>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5 shrink-0">
                <Heart size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  1. 推し棋士管理 & Firebase クラウド完全同期
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  本命・神推し・激推し・注目の4種バッジや推しカラー、応援メモを設定。棋士プロフィール・公式対局予定・全対局結果を含む全データをFirebase Firestoreに完全移行・アクセスでき、複数端末（Android, iOS, Windows, Mac）でリアルタイム同期。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5 shrink-0">
                <Calendar size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  2. 公式対局予定カレンダー & スケジュール同期
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  日本将棋連盟公式（shogi.or.jp）の最新対局日程を自動取得。カレンダー表示とリスト表示を切り替え可能。Googleカレンダーへのワンタップ追加や.icsファイル保存にも対応。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                <Trophy size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  3. 公式対局結果一覧（年度別 & 0局除外スマート表示）
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  連盟公式の全公式戦結果を網羅（2025・2026年度）。対局の無い月を自動除外する月選択タブ、全月一括表示、先後勝率サマリー、推し対局絞り込み、ShogiDB2等の棋譜リンクを完備。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
                <Users size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  4. 棋士・女流棋士名鑑（連盟・LPSA・無所属 全網羅）
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  全現役プロ棋士・女流棋士256名以上を網羅。順位戦・竜王戦クラス、通算タイトル数、今年度・通算成績、多彩な検索・ソート機能を搭載。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5 shrink-0">
                <TrendingUp size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  5. 年度別成績推移グラフ & 詳細プロフィール
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  各棋士の2021〜2026年度成績推移グラフ（折れ線・棒グラフ、全画面ズーム対応）、獲得タイトル履歴、今年度公式戦の実対局一覧（手番・勝敗・手数・棋譜リンク）を閲覧可能。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 mt-0.5 shrink-0">
                <Swords size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  6. 通算直接対決（VS）成績チェック
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  対局予定や対局結果の詳細画面にて、対局する両棋士の通算直接対決勝敗・勝率および直近の対戦履歴（棋戦・勝者・手数・棋譜リンク）を過去データから自動集計して表示。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mt-0.5 shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <strong className="text-zinc-200 block mb-0.5 font-serif-jp">
                  7. プッシュ通知速報アラート
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  推し棋士の対局日当日通知、終局結果速報通知、対局開始リマインドをWeb Notification APIによりタイムリーにお届け（既読管理・一括削除対応）。
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
    </div>,
    document.body
  );
};
