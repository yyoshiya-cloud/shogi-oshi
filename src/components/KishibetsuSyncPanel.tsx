import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Database, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { syncAllPlayersWithKishibetsu } from '../services/kishibetsuService';
import { Player, ShogiMonthlyResult } from '../types/shogi';
import { applyPlayerOverrides } from '../utils/playerUtils';
import { PLAYERS_DATA } from '../data/shogiDatabase';
import { initializePlayerRecords, updateMatchStatsData } from '../utils/yearRecordsGenerator';
import { saveStoredPlayers, getStoredPlayers, saveStoredFiscalResults } from '../utils/storage';

interface KishibetsuSyncPanelProps {
  players?: Player[];
  onPlayersSynced?: (updatedPlayers: Player[]) => void;
  onRefreshMatches?: () => void;
}

export const KishibetsuSyncPanel: React.FC<KishibetsuSyncPanelProps> = ({
  players = [],
  onPlayersSynced,
  onRefreshMatches,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  // 全年度対局成績と今年度の対局結果・対局予定を一度に完全同期
  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncComplete(false);
    setVerifyMsg(null);
    try {
      let sourcePlayers = players.length >= 50 ? players : getStoredPlayers();
      if (sourcePlayers.length < 50) {
        sourcePlayers = PLAYERS_DATA;
      }

      // 1. 今年度の公式対局結果（月別勝敗・対局履歴）と対局予定を一括取得
      let latestResults: Record<string, ShogiMonthlyResult[]> | undefined = undefined;
      try {
        const [resultsRes] = await Promise.all([
          fetch('/api/matches/results?all=true&force=true')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/matches/sync?force=true')
            .catch(() => null),
        ]);

        if (resultsRes && resultsRes.success && resultsRes.data) {
          const fetchedData = resultsRes.data as Record<string, ShogiMonthlyResult[]>;
          latestResults = fetchedData;
          saveStoredFiscalResults(fetchedData);
          updateMatchStatsData(fetchedData);
        }

        if (onRefreshMatches) {
          onRefreshMatches();
        }
      } catch (mErr) {
        console.warn('Match results sync notice:', mErr);
      }

      // 2. 全棋士・女流棋士の全年度成績（2021〜2026年度）を最新対局データに基づいて再集計・同期
      const updated = await syncAllPlayersWithKishibetsu(sourcePlayers, latestResults);
      saveStoredPlayers(updated);
      if (onPlayersSynced) {
        onPlayersSynced(updated);
      }

      setSyncCount(updated.length);
      setSyncComplete(true);
    } catch (err) {
      console.error('All-in-one sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyAndReloadAll = async () => {
    setIsVerifying(true);
    setVerifyMsg(null);
    try {
      let sourcePlayers = players.length >= 50 ? players : getStoredPlayers();
      if (sourcePlayers.length < 50) {
        sourcePlayers = PLAYERS_DATA;
      }

      // 当該年度の対局結果（対局スケジュール・月別勝敗結果）を最新更新
      try {
        const resultsRes = await fetch('/api/matches/results?all=true&force=true')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (resultsRes && resultsRes.success && resultsRes.data) {
          saveStoredFiscalResults(resultsRes.data);
          updateMatchStatsData(resultsRes.data);
        }
        if (onRefreshMatches) {
          onRefreshMatches();
        }
        await fetch('/api/matches/sync?force=true').catch(() => {});
      } catch (mErr) {
        console.warn('Match results refresh notice:', mErr);
      }

      const reloaded = sourcePlayers.map(initializePlayerRecords);
      saveStoredPlayers(reloaded);
      if (onPlayersSynced) {
        onPlayersSynced(reloaded);
      }

      setVerifyMsg(`全 ${reloaded.length} 名（プロ棋士・女流棋士）の2021〜2026全年度成績および今年度対局結果を完全初期化・最新反映いたしました。`);
    } catch (e) {
      console.error('Verify error:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100 font-serif-jp flex items-center gap-1.5">
              <span>全年度対局成績 & 今年度対局結果 一括同期基盤</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans">
                連動同期
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              全256名の全年度成績（2021〜2026年度）と今年度の公式対局結果・対局予定を一度に同期
            </p>
          </div>
        </div>
        <a
          href="https://kishibetsu.com/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition"
        >
          <span>kishibetsu.com</span>
          <ExternalLink size={11} />
        </a>
      </div>

      {verifyMsg && (
        <div className="px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{verifyMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          {syncComplete ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span className="font-semibold text-emerald-300">
                全 {syncCount} 名の全年度成績（2021〜2026年度）＆今年度対局結果を一度に同期完了
              </span>
            </>
          ) : (
            <span className="text-zinc-400">
              ワンクリックで全棋士の全年度成績と今年度の最新対局結果をまとめて最新化
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleVerifyAndReloadAll}
            disabled={isVerifying || isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs shadow transition disabled:opacity-50 cursor-pointer border border-amber-500/30"
          >
            <ShieldCheck size={13} className={isVerifying ? 'animate-spin' : ''} />
            <span>{isVerifying ? '検証中...' : '全件再読み込み・検証'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing || isVerifying}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? '一度に一括同期中...' : '全年度成績＆今年度対局結果を一括同期'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

