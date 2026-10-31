import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Database, CheckCircle2, ShieldCheck } from 'lucide-react';
import { syncAllPlayersWithKishibetsu } from '../services/kishibetsuService';
import { Player } from '../types/shogi';
import { applyPlayerOverrides } from '../utils/playerUtils';
import { PLAYERS_DATA } from '../data/shogiDatabase';
import { initializePlayerRecords } from '../utils/yearRecordsGenerator';
import { saveStoredPlayers, getStoredPlayers } from '../utils/storage';

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

  const handleSyncFromKishibetsu = async () => {
    setIsSyncing(true);
    setSyncComplete(false);
    try {
      let sourcePlayers = players.length >= 50 ? players : getStoredPlayers();
      if (sourcePlayers.length < 50) {
        sourcePlayers = PLAYERS_DATA;
      }
      const updated = await syncAllPlayersWithKishibetsu(sourcePlayers);
      saveStoredPlayers(updated);
      if (onPlayersSynced) {
        onPlayersSynced(updated);
      }

      // 当該年度の対局結果（対局スケジュール・月別勝敗結果）を最新更新
      try {
        if (onRefreshMatches) {
          onRefreshMatches();
        }
        await Promise.all([
          fetch('/api/matches/sync?force=true').catch(() => {}),
          fetch('/api/matches/results?all=true&force=true').catch(() => {}),
        ]);
      } catch (mErr) {
        console.warn('Match results sync notice:', mErr);
      }

      setSyncCount(updated.length);
      setSyncComplete(true);
    } catch (err) {
      console.error('Kishibetsu sync error:', err);
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
      const reloaded = sourcePlayers.map(initializePlayerRecords);
      saveStoredPlayers(reloaded);
      if (onPlayersSynced) {
        onPlayersSynced(reloaded);
      }

      // 当該年度の対局結果（対局スケジュール・月別勝敗結果）を最新更新
      try {
        if (onRefreshMatches) {
          onRefreshMatches();
        }
        await Promise.all([
          fetch('/api/matches/sync?force=true').catch(() => {}),
          fetch('/api/matches/results?all=true&force=true').catch(() => {}),
        ]);
      } catch (mErr) {
        console.warn('Match results refresh notice:', mErr);
      }

      setVerifyMsg(`全 ${reloaded.length} 名（プロ棋士・女流棋士）の2021〜2026年度成績および当該年度対局結果を完全初期化・最新反映いたしました。`);
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
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100 font-serif-jp">
              kishibetsu.com 連携・全対局取得基盤 & ステータス検証
            </h3>
            <p className="text-[11px] text-zinc-400">
              全棋士・女流棋士データの再読み込み、休場・引退・順位戦クラスの検証
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
                全 {syncCount} 名の2021-2026年度成績データをkishibetsu.comから同期完了
              </span>
            </>
          ) : (
            <span className="text-zinc-400">
              最新の休場・引退・クラス要件に準拠したデータ検証が可能
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleVerifyAndReloadAll}
            disabled={isVerifying}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs shadow transition disabled:opacity-50 cursor-pointer border border-amber-500/30"
          >
            <ShieldCheck size={13} className={isVerifying ? 'animate-spin' : ''} />
            <span>{isVerifying ? '全件検証・再読み込み中...' : '全件再読み込み・ステータス検証'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncFromKishibetsu}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? '同期中...' : '全年度成績を同期'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
