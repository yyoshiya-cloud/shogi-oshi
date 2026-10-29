import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Database, CheckCircle2 } from 'lucide-react';
import { syncAllPlayersWithKishibetsu } from '../services/kishibetsuService';
import { Player } from '../types/shogi';

interface KishibetsuSyncPanelProps {
  players?: Player[];
  onPlayersSynced?: (updatedPlayers: Player[]) => void;
}

export const KishibetsuSyncPanel: React.FC<KishibetsuSyncPanelProps> = ({
  players = [],
  onPlayersSynced,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  const handleSyncFromKishibetsu = async () => {
    setIsSyncing(true);
    setSyncComplete(false);
    try {
      const updated = await syncAllPlayersWithKishibetsu(players);
      if (onPlayersSynced) {
        onPlayersSynced(updated);
      }
      setSyncCount(updated.length);
      setSyncComplete(true);
    } catch (err) {
      console.error('Kishibetsu sync error:', err);
    } finally {
      setIsSyncing(false);
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
              kishibetsu.com 連携・全対局取得基盤
            </h3>
            <p className="text-[11px] text-zinc-400">
              2021年度〜2026年度の全棋士・女流棋士公式戦成績を完全同期
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
              kishibetsu.comの2021〜2026年度アーカイブと完全に連動
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSyncFromKishibetsu}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'kishibetsu.comから同期中...' : '全年度成績を同期・更新'}</span>
        </button>
      </div>
    </div>
  );
};
