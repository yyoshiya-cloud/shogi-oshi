import React, { useState, useMemo } from 'react';
import { PushNotificationItem, Match, Player } from '../types/shogi';
import {
  triggerPushNotification,
  saveStoredNotifications,
  deleteStoredNotification,
  clearStoredNotifications,
} from '../utils/storage';
import {
  isTodayOrResultNotification,
  isNotificationTodayMatch,
  isNotificationMatchResult
} from '../utils/notificationFilter';
import { getTodayInfo, getTodayDateString } from '../utils/dateUtils';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Settings,
  Sparkles,
  Smartphone,
  ChevronRight,
  Clock,
  Radio,
  Trophy,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NotificationCenterProps {
  notifications: PushNotificationItem[];
  matches: Match[];
  players: Player[];
  onSelectMatch: (match: Match) => void;
  onRefreshNotifications: () => void;
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  matches,
  players,
  onSelectMatch,
  onRefreshNotifications,
  onDeleteNotification,
  onClearAllNotifications,
}) => {
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');
  const [subFilter, setSubFilter] = useState<'all' | 'today' | 'result'>('all');
  const [timingSettings, setTimingSettings] = useState({
    morningOf: true,
    matchStart: true,
    resultImmediately: true,
  });
  const [isTestSending, setIsTestSending] = useState(false);

  // Request actual browser push notification permission
  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setPermissionState(res);
        if (res === 'granted') {
          await triggerPushNotification(
            '【通知設定完了】将棋推し活プッシュ通知が有効になりました',
            '推し棋士の【当日の対局（朝・開始）】および【終局・勝敗速報＆棋譜リンク】をリアルタイムにお届けします。',
            'match_day'
          );
          onRefreshNotifications();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Strictly filter notifications to ONLY today's matches and match results
  const bulletinNotifications = useMemo(() => {
    return notifications.filter((n) => isTodayOrResultNotification(n, matches));
  }, [notifications, matches]);

  const todayCount = useMemo(() => {
    return bulletinNotifications.filter((n) => {
      const match = n.matchId ? matches.find((m) => m.id === n.matchId) : null;
      return isNotificationTodayMatch(n, match);
    }).length;
  }, [bulletinNotifications, matches]);

  const resultCount = useMemo(() => {
    return bulletinNotifications.filter((n) => {
      const match = n.matchId ? matches.find((m) => m.id === n.matchId) : null;
      return isNotificationMatchResult(n, match);
    }).length;
  }, [bulletinNotifications, matches]);

  const displayedNotifications = useMemo(() => {
    if (subFilter === 'today') {
      return bulletinNotifications.filter((n) => {
        const match = n.matchId ? matches.find((m) => m.id === n.matchId) : null;
        return isNotificationTodayMatch(n, match);
      });
    }
    if (subFilter === 'result') {
      return bulletinNotifications.filter((n) => {
        const match = n.matchId ? matches.find((m) => m.id === n.matchId) : null;
        return isNotificationMatchResult(n, match);
      });
    }
    return bulletinNotifications;
  }, [bulletinNotifications, subFilter, matches]);

  // Test notification: Match Day Morning notification
  const handleTestMatchDay = async () => {
    setIsTestSending(true);
    const info = getTodayInfo();
    await triggerPushNotification(
      '【本日対局】藤井 聡太 竜王・名人の対局日です！',
      `本日 ${info.shortDisplay} 09:00〜 第85期 順位戦 A級 5回戦 (vs 永瀬拓矢 九段)。特別対局室にて対局開始！`,
      'match_day',
      'match-live-01',
      'fujii-sota'
    );
    setIsTestSending(false);
    onRefreshNotifications();
  };

  // Test notification: Match Start in progress notification
  const handleTestMatchStart = async () => {
    setIsTestSending(true);
    await triggerPushNotification(
      '【対局開始】第85期 順位戦 A級 5回戦が始まりました！',
      '本日特別対局室にて藤井聡太名人 vs 永瀬拓矢九段の対局が開始。戦型は角換わり腰掛け銀です。',
      'match_start',
      'match-live-01',
      'fujii-sota'
    );
    setIsTestSending(false);
    onRefreshNotifications();
  };

  // Test notification: Match Result notification with direct kifu link
  const handleTestMatchResult = async () => {
    setIsTestSending(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    await triggerPushNotification(
      '【勝敗速報】藤井 聡太 竜王が第2局に勝利！',
      '第39期 竜王戦 第2局にて、藤井竜王が伊藤匠叡王に115手で勝利（2連勝）。棋譜をアプリ内で直接再生できます。',
      'match_result',
      'match-fin-01',
      'fujii-sota'
    );
    setIsTestSending(false);
    onRefreshNotifications();
  };

  // Test notification: Women's Shogi match result
  const handleTestWomenResult = async () => {
    setIsTestSending(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    await triggerPushNotification(
      '【勝敗速報】西山 朋佳 白玲が防衛達成！',
      '第4期 白玲戦 七番勝負 第6局にて、西山白玲が福間女流四冠に127手で勝利しタイトル防衛！',
      'match_result',
      'match-fin-02',
      'nishiyama-tomoka'
    );
    setIsTestSending(false);
    onRefreshNotifications();
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveStoredNotifications(updated);
    onRefreshNotifications();
  };

  // Clear all notifications
  const handleClearAll = () => {
    if (onClearAllNotifications) {
      onClearAllNotifications();
    } else {
      clearStoredNotifications();
      onRefreshNotifications();
    }
  };

  // Delete single notification
  const handleDeleteOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteNotification) {
      onDeleteNotification(id);
    } else {
      deleteStoredNotification(id);
      onRefreshNotifications();
    }
  };

  return (
    <div className="space-y-5">
      {/* Push Notification Header Policy Card */}
      <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-800/40 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-lg">
              <Bell size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-zinc-100 font-serif-jp">
                  通知速報 本日:{getTodayInfo().shortDisplay}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    permissionState === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {permissionState === 'granted' ? 'Android通知有効 (許可済)' : '通知未設定'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                通知速報は<strong className="text-amber-300 font-bold">「当日の対局（朝8:00・開始時）」</strong>と<strong className="text-rose-400 font-bold">「対局結果（終局時即時・棋譜リンク）」</strong>のみを厳選してお届けします。
              </p>
            </div>
          </div>

          {permissionState !== 'granted' && (
            <button
              onClick={handleRequestPermission}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition whitespace-nowrap"
            >
              Android通知を有効化
            </button>
          )}
        </div>

        {/* Quick Test Bar */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1 mr-1">
            <Sparkles size={13} className="text-amber-400" />
            速報シミュレーション:
          </span>
          <button
            onClick={handleTestMatchDay}
            disabled={isTestSending}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[11px] font-medium transition border border-zinc-700 flex items-center gap-1"
          >
            <Clock size={12} />
            <span>【本日対局 朝】テスト</span>
          </button>
          <button
            onClick={handleTestMatchStart}
            disabled={isTestSending}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-200 text-[11px] font-medium transition border border-zinc-700 flex items-center gap-1"
          >
            <Radio size={12} className="text-amber-400" />
            <span>【対局開始】テスト</span>
          </button>
          <button
            onClick={handleTestMatchResult}
            disabled={isTestSending}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 text-[11px] font-bold transition border border-amber-500/40 flex items-center gap-1"
          >
            <Trophy size={12} className="text-amber-400" />
            <span>【勝敗速報＆棋譜】テスト</span>
          </button>
          <button
            onClick={handleTestWomenResult}
            disabled={isTestSending}
            className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-[11px] font-bold transition border border-rose-800/40 flex items-center gap-1"
          >
            <Sparkles size={12} />
            <span>【女流棋戦 終局速報】テスト</span>
          </button>
        </div>
      </div>

      {/* Scope banner confirmation */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs shadow-sm">
        <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
        <span>通知速報には、後日の対局予告や一般告知は入らず、<strong>当日の対局</strong>と<strong>対局結果（勝敗速報）</strong>のみが表示されます。</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'list'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            速報履歴 ({bulletinNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings size={13} className="inline mr-1" />
            速報タイミング設定
          </button>
        </div>

        {activeTab === 'list' && bulletinNotifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition"
            >
              既読にする
            </button>
            <button
              onClick={handleClearAll}
              className="text-[11px] text-rose-400 hover:text-rose-300 transition flex items-center gap-0.5"
            >
              <Trash2 size={11} />
              全削除
            </button>
          </div>
        )}
      </div>

      {/* Tab: Notification List */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Subfilter Pills: All, Today's Matches, Match Results */}
          <div className="flex items-center gap-2 pb-1">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Filter size={11} />
              表示絞り込み:
            </span>
            <button
              onClick={() => setSubFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                subFilter === 'all'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              すべて ({bulletinNotifications.length})
            </button>
            <button
              onClick={() => setSubFilter('today')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                subFilter === 'today'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-zinc-900 text-amber-400 hover:text-amber-300'
              }`}
            >
              本日の対局 ({todayCount})
            </button>
            <button
              onClick={() => setSubFilter('result')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                subFilter === 'result'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-zinc-900 text-rose-400 hover:text-rose-300'
              }`}
            >
              対局結果 ({resultCount})
            </button>
          </div>

          {displayedNotifications.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-3xl border border-zinc-800">
              <Bell size={32} className="mx-auto mb-2 text-zinc-600" />
              <p className="font-bold text-zinc-300">
                {subFilter === 'today'
                  ? '本日の対局速報はありません'
                  : subFilter === 'result'
                  ? '対局結果の速報はありません'
                  : '現在、本日の対局および対局結果の速報はありません'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                推し棋士が当日に対局するか、終局結果が出ると自動的にこちらへ届きます。
              </p>
            </div>
          ) : (
            displayedNotifications.map((notif) => {
              const match = notif.matchId ? matches.find((m) => m.id === notif.matchId) : null;
              const isResult = isNotificationMatchResult(notif, match);

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (match) onSelectMatch(match);
                  }}
                  className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
                    !notif.read
                      ? isResult
                        ? 'bg-rose-950/20 border-rose-600/50 shadow-sm'
                        : 'bg-amber-950/20 border-amber-600/50 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
                          isResult
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {isResult ? <Trophy size={16} /> : <Clock size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isResult
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isResult ? '対局結果・勝敗速報' : '本日の対局'}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-zinc-100 font-serif-jp">
                            {notif.title}
                          </h4>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          {notif.body}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                          <span>{new Date(notif.timestamp).toLocaleString('ja-JP')}</span>
                          {match && (
                            <span className="text-amber-400 flex items-center gap-0.5 hover:underline font-bold">
                              <span>対局詳細・棋譜を見る</span>
                              <ChevronRight size={11} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete single notification button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteOne(notif.id, e)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition flex-shrink-0"
                      title="この通知を消す"
                      aria-label="この通知を消す"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Notification Settings */}
      {activeTab === 'settings' && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-zinc-100 font-serif-jp">
            推し棋士の速報通知設定（当日の対局・対局結果のみ）
          </h4>
          <p className="text-xs text-zinc-400">
            後日の対局でトレイが埋もれないよう、通知速報は「本日の対局」および「対局結果」のみに限定されています。
          </p>

          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300">対局日 朝 (当日 08:00)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">当日の対局</span>
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5">本日開催の対局開始時間と中継先（ABEMA等）をお知らせ</span>
              </div>
              <input
                type="checkbox"
                checked={timingSettings.morningOf}
                onChange={(e) => setTimingSettings({ ...timingSettings, morningOf: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300">対局開始直前 (対局開始 30分前)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">当日の対局</span>
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5">本日の対局開始アナウンスと中継視聴リンク</span>
              </div>
              <input
                type="checkbox"
                checked={timingSettings.matchStart}
                onChange={(e) => setTimingSettings({ ...timingSettings, matchStart: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-rose-800/40 bg-rose-950/10 cursor-pointer hover:border-rose-700">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-300">終局・勝敗速報＆棋譜リンク (終局時即時)</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-bold">対局結果</span>
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5">決着手数、勝敗結果、および公式棋譜へのダイレクトリンク</span>
              </div>
              <input
                type="checkbox"
                checked={timingSettings.resultImmediately}
                onChange={(e) => setTimingSettings({ ...timingSettings, resultImmediately: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
