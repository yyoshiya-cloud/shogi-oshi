import React, { useState, useMemo } from 'react';
import { ShogiMonthlyResult, Player } from '../types/shogi';
import { getStoredFiscalResults, saveStoredFiscalResults } from '../utils/storage';
import { enrichAllResultsWithSupplements, enrichMonthlyResultsWithSupplements } from '../services/matchSupplementService';
import { updateMatchStatsData } from '../utils/yearRecordsGenerator';
import { clearPlayerMatchCache } from '../services/shogiDbMatchEnrichment';
import { saveFiscalResultsToCloud, savePlayersToCloud } from '../services/firebaseSync';
import {
  ShieldAlert,
  Database,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Tv,
  Calendar,
  X,
  Sparkles,
  Zap
} from 'lucide-react';

interface DataAuditModalProps {
  players: Player[];
  onClose: () => void;
  onUpdateResults?: (updated: Record<string, ShogiMonthlyResult[]>) => void;
  onUpdatePlayers?: (updated: Player[]) => void;
}

export const DataAuditModal: React.FC<DataAuditModalProps> = ({
  players,
  onClose,
  onUpdateResults,
  onUpdatePlayers,
}) => {
  const [fiscalData, setFiscalData] = useState<Record<string, ShogiMonthlyResult[]>>(() => {
    return getStoredFiscalResults() || {};
  });

  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'resync' | 'manual'>('audit');
  const [selectedMonth, setSelectedMonth] = useState<string>('202607');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Manual Match Registration Form state
  const [manualDate, setManualDate] = useState<string>('2026-07-26');
  const [manualTournament, setManualTournament] = useState<string>('NHK杯');
  const [manualSente, setManualSente] = useState<string>('羽生 善治');
  const [manualGote, setManualGote] = useState<string>('横山 泰明');
  const [manualWinner, setManualWinner] = useState<'sente' | 'gote'>('sente');
  const [manualNote, setManualNote] = useState<string>('本戦 1回戦 第17局 101手');

  // Audit Calculations
  const auditReport = useMemo(() => {
    let totalMatches = 0;
    let nhkCount = 0;
    let gingaCount = 0;
    let titleCount = 0;

    const monthSummaries: { month: string; count: number; nhk: number; ginga: number; status: 'ok' | 'warning' }[] = [];

    // Checked months range: 202504..202703
    const months = [
      '202504', '202505', '202506', '202507', '202508', '202509', '202510', '202511', '202512', '202601', '202602', '202603',
      '202604', '202605', '202606', '202607', '202608', '202609', '202610', '202611', '202612', '202701', '202702', '202703'
    ];

    for (const m of months) {
      const list = fiscalData[m] || [];
      const mMatches = list.length;
      totalMatches += mMatches;

      let mNhk = 0;
      let mGinga = 0;

      for (const r of list) {
        if (/NHK杯/i.test(r.tournament)) {
          nhkCount++;
          mNhk++;
        }
        if (/銀河戦/i.test(r.tournament)) {
          gingaCount++;
          mGinga++;
        }
        if (r.category === 'タイトル戦' || r.category === '女流タイトル戦') {
          titleCount++;
        }
      }

      // Check for month warnings (e.g. 0 matches in active months or missing television matches)
      const isPastMonth = m <= '202610';
      const isWarning = isPastMonth && (mMatches === 0 || (mNhk === 0 && (m === '202607' || m === '202608' || m === '202507')) || (mGinga === 0 && m.startsWith('2025')));

      monthSummaries.push({
        month: m,
        count: mMatches,
        nhk: mNhk,
        ginga: mGinga,
        status: isWarning ? 'warning' : 'ok',
      });
    }

    return {
      totalMatches,
      nhkCount,
      gingaCount,
      titleCount,
      monthSummaries,
    };
  }, [fiscalData]);

  // Apply Special Supplement Data (NHK杯 & 銀河戦)
  const handleApplySupplements = async () => {
    try {
      setIsProcessing(true);
      setStatusMessage('NHK杯決勝トーナメント・銀河戦の補填データをデータベースに統合中...');

      const enriched = enrichAllResultsWithSupplements(fiscalData);
      setFiscalData(enriched);
      saveStoredFiscalResults(enriched);
      updateMatchStatsData(enriched);
      clearPlayerMatchCache();

      // Cloud Sync
      await saveFiscalResultsToCloud(enriched);

      onUpdateResults?.(enriched);

      let addedCount = 0;
      for (const k of Object.keys(enriched)) {
        addedCount += (enriched[k]?.length || 0) - (fiscalData[k]?.length || 0);
      }

      setStatusMessage(`補填データの統合が完了しました！合計対局数を最新化・クラウド同期しました。`);
    } catch (err: any) {
      setStatusMessage(`補填データの統合中にエラーが発生しました: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Re-fetch Official Monthly Results from shogi.or.jp
  const handleRefetchMonth = async (m: string) => {
    try {
      setIsProcessing(true);
      setStatusMessage(`${m.slice(0, 4)}年${parseInt(m.slice(4), 10)}月の公式対局結果を日本将棋連盟から再取得中...`);

      const res = await fetch(`/api/matches/results?month=${m}&force=true`);
      if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
      const json = await res.json();

      if (json.success && json.results) {
        // Enrich fetched results with supplement matches as well
        const enrichedMonth = enrichMonthlyResultsWithSupplements(m, json.results);
        const updated = {
          ...fiscalData,
          [m]: enrichedMonth,
        };

        setFiscalData(updated);
        saveStoredFiscalResults(updated);
        updateMatchStatsData(updated);
        clearPlayerMatchCache();

        await saveFiscalResultsToCloud(updated);
        onUpdateResults?.(updated);

        setStatusMessage(`${m.slice(0, 4)}年${parseInt(m.slice(4), 10)}月の対局結果 (${enrichedMonth.length}局) を再取得・データベースに反映しました！`);
      } else {
        setStatusMessage(`取得データがありませんでした。`);
      }
    } catch (err: any) {
      setStatusMessage(`再取得エラー: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Re-calculate all player stats
  const handleRecalculatePlayerStats = () => {
    try {
      setIsProcessing(true);
      setStatusMessage('全250名超の棋士・女流棋士の年度別成績（勝数・負数）を再計算中...');

      updateMatchStatsData(fiscalData);
      clearPlayerMatchCache();

      const updatedPlayers = players.map((p) => {
        // Recalculate or keep profile
        return p;
      });

      onUpdatePlayers?.(updatedPlayers);
      savePlayersToCloud(updatedPlayers);

      setStatusMessage('全棋士の勝敗・年度戦績データの再計算・同期が完了しました！');
    } catch (err: any) {
      setStatusMessage(`再計算エラー: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Add a manual match
  const handleAddManualMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate || !manualSente.trim() || !manualGote.trim()) return;

    try {
      setIsProcessing(true);
      const monthKey = manualDate.replace(/[^0-9]/g, '').slice(0, 6);
      const senteClean = manualSente.trim();
      const goteClean = manualGote.trim();
      const winnerName = manualWinner === 'sente' ? senteClean : goteClean;
      const loserName = manualWinner === 'sente' ? goteClean : senteClean;

      const senteP = players.find((p) => p.name.replace(/\s+/g, '') === senteClean.replace(/\s+/g, ''));
      const goteP = players.find((p) => p.name.replace(/\s+/g, '') === goteClean.replace(/\s+/g, ''));

      const newMatch: ShogiMonthlyResult = {
        id: `res-manual-${Date.now()}`,
        date: manualDate,
        month: monthKey,
        sente: senteClean,
        gote: goteClean,
        senteRaw: `${senteClean}`,
        goteRaw: `${goteClean}`,
        sentePlayerId: senteP?.id || `p-${senteClean}`,
        gotePlayerId: goteP?.id || `p-${goteClean}`,
        senteMark: manualWinner === 'sente' ? '○' : '●',
        goteMark: manualWinner === 'gote' ? '○' : '●',
        winner: winnerName,
        loser: loserName,
        winnerId: manualWinner === 'sente' ? (senteP?.id || senteClean) : (goteP?.id || goteClean),
        loserId: manualWinner === 'sente' ? (goteP?.id || goteClean) : (senteP?.id || senteClean),
        resultType: 'normal',
        tournament: manualTournament || '公式戦',
        note: manualNote || '手動登録対局',
        venue: '東京・NHK放送センター',
        isWomen: manualSente.includes('女流') || manualGote.includes('女流'),
        category: manualSente.includes('女流') || manualGote.includes('女流') ? '女流棋戦' : '一般棋戦',
        links: [
          {
            title: '日本将棋連盟公式',
            url: `https://www.shogi.or.jp/game/?month=${monthKey}`,
          },
        ],
        sourceUrl: `https://www.shogi.or.jp/game/?month=${monthKey}`,
      };

      const monthList = fiscalData[monthKey] || [];
      const updatedMonth = [newMatch, ...monthList].sort((a, b) => b.date.localeCompare(a.date));

      const updatedFiscal = {
        ...fiscalData,
        [monthKey]: updatedMonth,
      };

      setFiscalData(updatedFiscal);
      saveStoredFiscalResults(updatedFiscal);
      updateMatchStatsData(updatedFiscal);
      clearPlayerMatchCache();

      saveFiscalResultsToCloud(updatedFiscal);
      onUpdateResults?.(updatedFiscal);

      setStatusMessage(`対局「${senteClean} vs ${goteClean} (${manualTournament})」をデータベースに追加・即時反映しました！`);
      setActiveSubTab('audit');
    } catch (err: any) {
      setStatusMessage(`手動追加エラー: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>公式対局データ 更新漏れ監査・補填管理画面</span>
              </h2>
              <p className="text-xs text-zinc-400">
                NHK杯決勝トーナメントや銀河戦など、更新漏れが発生しやすい対局の自動検知と再取得・補填
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Status Toast */}
        {statusMessage && (
          <div className="px-4 py-2.5 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-amber-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          </div>
        )}

        {/* Sub-tab Navigation */}
        <div className="flex border-b border-zinc-800/80 bg-zinc-900/50 px-4 pt-2">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'audit'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database size={14} />
            <span>データベース監査 & 月別診断</span>
          </button>
          <button
            onClick={() => setActiveSubTab('resync')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'resync'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RefreshCw size={14} />
            <span>テレビ棋戦一括補填・連盟再取得</span>
          </button>
          <button
            onClick={() => setActiveSubTab('manual')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'manual'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PlusCircle size={14} />
            <span>過去対局の手動補填登録</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Audit Subtab */}
          {activeSubTab === 'audit' && (
            <div className="space-y-4">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block">総登録対局数</span>
                  <span className="text-lg font-bold text-amber-300 mt-0.5 block">
                    {auditReport.totalMatches} 局
                  </span>
                </div>
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block flex items-center gap-1">
                    <Tv size={12} className="text-sky-400" />
                    NHK杯 登録数
                  </span>
                  <span className="text-lg font-bold text-sky-300 mt-0.5 block">
                    {auditReport.nhkCount} 局
                  </span>
                </div>
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block flex items-center gap-1">
                    <Sparkles size={12} className="text-purple-400" />
                    銀河戦 登録数
                  </span>
                  <span className="text-lg font-bold text-purple-300 mt-0.5 block">
                    {auditReport.gingaCount} 局
                  </span>
                </div>
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block flex items-center gap-1">
                    <Calendar size={12} className="text-emerald-400" />
                    監査対象月数
                  </span>
                  <span className="text-lg font-bold text-emerald-300 mt-0.5 block">
                    24 か月
                  </span>
                </div>
              </div>

              {/* Special Action Alert Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      NHK杯・銀河戦の更新漏れ補填データを一括統合可能
                    </h4>
                    <p className="text-[11px] text-zinc-300 mt-0.5">
                      日本将棋連盟の月間結果で欠落しやすいNHK杯本戦・決勝トーナメントや銀河戦の補填データを1クリックでデータベースへ書き込みます。
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleApplySupplements}
                  disabled={isProcessing}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Zap size={14} />
                  <span>補填データを適用</span>
                </button>
              </div>

              {/* Monthly Audit Table */}
              <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200">
                    2025年度〜2026年度 月別対局数・TV棋戦記録 診断結果
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    ※黄色アイコンは対局数の再取得または補填推奨
                  </span>
                </div>

                <div className="divide-y divide-zinc-800/60 max-h-[320px] overflow-y-auto">
                  {auditReport.monthSummaries.map((m) => {
                    const year = m.month.slice(0, 4);
                    const monthNum = parseInt(m.month.slice(4), 10);
                    return (
                      <div
                        key={m.month}
                        className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs ${
                          m.status === 'warning' ? 'bg-amber-950/20' : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {m.status === 'warning' ? (
                            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold text-zinc-200">
                              {year}年 {monthNum}月
                            </span>
                            <span className="text-[10px] text-zinc-400 ml-2">
                              (NHK杯: {m.nhk}局 / 銀河戦: {m.ginga}局)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-bold ${
                              m.count === 0 ? 'text-zinc-400' : 'text-zinc-200'
                            }`}
                          >
                            {m.count} 局
                          </span>
                          <button
                            onClick={() => handleRefetchMonth(m.month)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[11px] font-semibold border border-zinc-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="連盟公式から該当月の対局結果を再取得"
                          >
                            <RefreshCw size={11} />
                            <span>再取得</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Resync & Batch Tools Subtab */}
          {activeSubTab === 'resync' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/90 rounded-2xl p-4 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <Zap size={16} />
                  <span>テレビ棋戦補填・公式データ一括修復ツール</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold text-zinc-200">
                      1. NHK杯・銀河戦 補填データ統合
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      特製補填アーカイブ (`specialMatchesSupplement.json`) からNHK杯決勝トーナメントおよび銀河戦の対局結果をデータベースへ統合します。
                    </p>
                    <button
                      onClick={handleApplySupplements}
                      disabled={isProcessing}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition cursor-pointer shadow"
                    >
                      補填データを一括統合・適用
                    </button>
                  </div>

                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold text-zinc-200">
                      2. 全250名超の棋士成績 再計算
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      登録されている全ての月間対局結果から、各棋士の2025年度・2026年度通算勝敗数・勝率データを全自動で再インデックス化します。
                    </p>
                    <button
                      onClick={handleRecalculatePlayerStats}
                      disabled={isProcessing}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow"
                    >
                      全棋士成績を再計算・同期
                    </button>
                  </div>
                </div>
              </div>

              {/* Monthly Targeted Re-fetch Box */}
              <div className="bg-zinc-900/90 rounded-2xl p-4 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <RefreshCw size={16} className="text-sky-400" />
                  <span>指定月の公式対局結果 ピンポイント再取得</span>
                </h3>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-none"
                  >
                    {auditReport.monthSummaries.map((m) => (
                      <option key={m.month} value={m.month}>
                        {m.month.slice(0, 4)}年{parseInt(m.month.slice(4), 10)}月 (現在{m.count}局)
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleRefetchMonth(selectedMonth)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                  >
                    公式連盟サイトから強制度再取得
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual Match Entry Subtab */}
          {activeSubTab === 'manual' && (
            <form onSubmit={handleAddManualMatch} className="bg-zinc-900/90 rounded-2xl p-4 border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <PlusCircle size={16} />
                <span>未登録の過去対局（NHK杯等）を直接登録</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">対局日</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">棋戦名</label>
                  <input
                    type="text"
                    value={manualTournament}
                    onChange={(e) => setManualTournament(e.target.value)}
                    placeholder="例: NHK杯、銀河戦"
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">先手 棋士名</label>
                  <input
                    type="text"
                    value={manualSente}
                    onChange={(e) => setManualSente(e.target.value)}
                    placeholder="例: 羽生 善治"
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">後手 棋士名</label>
                  <input
                    type="text"
                    value={manualGote}
                    onChange={(e) => setManualGote(e.target.value)}
                    placeholder="例: 横山 泰明"
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">勝者</label>
                  <div className="flex items-center gap-4 py-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="winner"
                        checked={manualWinner === 'sente'}
                        onChange={() => setManualWinner('sente')}
                      />
                      <span>先手 ({manualSente || '先手'}) の勝利</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="winner"
                        checked={manualWinner === 'gote'}
                        onChange={() => setManualWinner('gote')}
                      />
                      <span>後手 ({manualGote || '後手'}) の勝利</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">対局詳細・備考</label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="例: 本戦 1回戦 第17局 101手"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                >
                  この対局をデータベースに手動登録
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            データ保持: ローカルストレージ & Cloud Firestore 双方に即時同期
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
