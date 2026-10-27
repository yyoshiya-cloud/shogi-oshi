import React, { useState, useMemo } from 'react';
import { Player, YearRecord, ShogiMonthlyResult } from '../types/shogi';
import results2026Json from '../data/results2026.json';
import {
  Trophy,
  TrendingUp,
  ShieldCheck,
  Swords,
  ExternalLink,
  Award,
  Sparkles,
  BarChart2,
  Calendar,
} from 'lucide-react';

interface PlayerStatsChartsProps {
  player: Player;
}

export const PlayerStatsCharts: React.FC<PlayerStatsChartsProps> = ({ player }) => {
  const [activeTab, setActiveTab] = useState<'yearly' | 'opening' | 'rivals'>('yearly');
  const [selectedYearIndex, setSelectedYearIndex] = useState<number | null>(null);

  const hasCareerStats = player.careerWins > 0 || player.careerLosses > 0;
  const hasYearStats = player.currentYearWins > 0 || player.currentYearLosses > 0;

  // Derive comprehensive year records (including 2025 and 2026 from official data)
  const effectiveYearRecords = useMemo<YearRecord[]>(() => {
    if (player.yearRecords && player.yearRecords.length > 1) {
      return player.yearRecords;
    }

    const targetClean = player.name.replace(/\s+/g, '');
    const data = results2026Json as Record<string, ShogiMonthlyResult[]>;

    // 2025年度: 202504〜202603
    let y2025Wins = 0;
    let y2025Losses = 0;
    const m2025 = [
      '202504', '202505', '202506', '202507', '202508', '202509',
      '202510', '202511', '202512', '202601', '202602', '202603'
    ];
    for (const m of m2025) {
      for (const r of data[m] || []) {
        const sClean = r.sente.replace(/\s+/g, '');
        const gClean = r.gote.replace(/\s+/g, '');
        if (
          sClean === targetClean ||
          gClean === targetClean ||
          r.sentePlayerId === player.id ||
          r.gotePlayerId === player.id
        ) {
          const isWinner =
            r.winner.replace(/\s+/g, '') === targetClean ||
            (sClean === targetClean && (r.senteMark.includes('○') || r.senteMark.includes('□'))) ||
            (gClean === targetClean && (r.goteMark.includes('○') || r.goteMark.includes('□')));
          if (isWinner) y2025Wins++;
          else y2025Losses++;
        }
      }
    }

    // 2026年度: 202604〜202703
    let y2026Wins = player.currentYearWins || 0;
    let y2026Losses = player.currentYearLosses || 0;
    if (y2026Wins === 0 && y2026Losses === 0) {
      const m2026 = ['202604', '202605', '202606', '202607', '202608', '202609', '202610'];
      for (const m of m2026) {
        for (const r of data[m] || []) {
          const sClean = r.sente.replace(/\s+/g, '');
          const gClean = r.gote.replace(/\s+/g, '');
          if (
            sClean === targetClean ||
            gClean === targetClean ||
            r.sentePlayerId === player.id ||
            r.gotePlayerId === player.id
          ) {
            const isWinner =
              r.winner.replace(/\s+/g, '') === targetClean ||
              (sClean === targetClean && (r.senteMark.includes('○') || r.senteMark.includes('□'))) ||
              (gClean === targetClean && (r.goteMark.includes('○') || r.goteMark.includes('□')));
            if (isWinner) y2026Wins++;
            else y2026Losses++;
          }
        }
      }
    }

    const records: YearRecord[] = [];
    if (y2025Wins + y2025Losses > 0) {
      records.push({
        year: 2025,
        wins: y2025Wins,
        losses: y2025Losses,
        rate: Math.round((y2025Wins / (y2025Wins + y2025Losses)) * 1000) / 1000,
      });
    }
    if (y2026Wins + y2026Losses > 0) {
      records.push({
        year: 2026,
        wins: y2026Wins,
        losses: y2026Losses,
        rate:
          player.currentYearWinRate ||
          Math.round((y2026Wins / (y2026Wins + y2026Losses)) * 1000) / 1000,
      });
    }

    if (records.length > 0) {
      return records;
    }

    return player.yearRecords || [];
  }, [player]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards (Removed Sente/Gote win rates as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>通算成績</span>
            <Trophy size={16} className="text-amber-400" />
          </div>
          <div className="mt-3">
            {hasCareerStats ? (
              <>
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-serif-jp">
                  {player.careerWins}
                </span>
                <span className="text-xs text-zinc-400 ml-0.5">勝 </span>
                <span className="text-xl sm:text-2xl font-bold text-zinc-300 font-serif-jp ml-1">
                  {player.careerLosses}
                </span>
                <span className="text-xs text-zinc-400 ml-0.5">敗</span>
              </>
            ) : (
              <span className="text-lg font-bold text-zinc-200 font-serif-jp">
                公式戦現役
              </span>
            )}
          </div>
          <div className="text-xs text-amber-400 font-bold mt-2">
            {hasCareerStats
              ? `通算勝率 ${(player.careerWinRate * 100).toFixed(1)}%`
              : '連盟公式記録ベース'}
          </div>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>今年度成績</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="mt-3">
            {hasYearStats ? (
              <>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-serif-jp">
                  {player.currentYearWins}
                </span>
                <span className="text-xs text-zinc-400 ml-0.5">勝 </span>
                <span className="text-xl sm:text-2xl font-bold text-zinc-300 font-serif-jp ml-1">
                  {player.currentYearLosses}
                </span>
                <span className="text-xs text-zinc-400 ml-0.5">敗</span>
              </>
            ) : (
              <span className="text-lg font-bold text-zinc-300 font-serif-jp">
                今年度集計中
              </span>
            )}
          </div>
          <div className="text-xs text-emerald-400 font-bold mt-2">
            {hasYearStats
              ? `勝率 ${(player.currentYearWinRate * 100).toFixed(1)}%`
              : '公式戦対局'}
          </div>
        </div>
      </div>

      {/* Tabs for detailed interactive graphs */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-3 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('yearly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'yearly'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp size={15} />
            年度別成績推移
          </button>
          <button
            onClick={() => setActiveTab('opening')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'opening'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck size={15} />
            主要戦型別勝率
          </button>
          <button
            onClick={() => setActiveTab('rivals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'rivals'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Swords size={15} />
            主要ライバル対戦成績
          </button>
        </div>

        {/* Tab 1: Enhanced Clear Yearly Clustered Bar & Line Chart with Breakdown Table */}
        {activeTab === 'yearly' && (
          <div>
            {effectiveYearRecords.length > 0 ? (
              <div className="space-y-4">
                {/* Header with Title and Legend */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs sm:text-sm">
                      <TrendingUp size={16} className="text-amber-400" />
                      <span>年度別 勝敗数・勝率推移グラフ</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      各年度の勝数・敗数（棒）と勝率（折れ線）の比較推移
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-zinc-800 text-[11px] self-start sm:self-auto">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                      <span className="text-zinc-300 font-medium">勝数</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                      <span className="text-zinc-300 font-medium">敗数</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-zinc-900 inline-block" />
                      <span className="text-amber-300 font-bold">勝率(%)</span>
                    </span>
                  </div>
                </div>

                {/* Selected Year Inspector Card */}
                {(() => {
                  const activeRecord =
                    selectedYearIndex !== null && effectiveYearRecords[selectedYearIndex]
                      ? effectiveYearRecords[selectedYearIndex]
                      : effectiveYearRecords[effectiveYearRecords.length - 1];
                  const totalGames = activeRecord.wins + activeRecord.losses;
                  return (
                    <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500 text-zinc-950 shadow">
                          {activeRecord.year}年度
                        </span>
                        <span className="text-zinc-300 font-medium">
                          総対局 <strong className="text-white text-sm font-bold">{totalGames}</strong> 局
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1">
                          <span>○ 勝数:</span>
                          <strong className="text-sm text-emerald-400">{activeRecord.wins}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1">
                          <span>● 敗数:</span>
                          <strong className="text-sm text-rose-400">{activeRecord.losses}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1">
                          <span>勝率:</span>
                          <strong className="text-sm font-mono text-amber-200">
                            {(activeRecord.rate * 100).toFixed(1)}%
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* SVG Visual Chart */}
                <div className="w-full bg-zinc-950/80 p-3 sm:p-4 rounded-2xl border border-zinc-800 shadow-inner overflow-hidden">
                  <div className="relative h-60 sm:h-64 w-full">
                    {(() => {
                      const records = effectiveYearRecords;
                      const maxBarVal = Math.max(...records.map((r) => Math.max(r.wins, r.losses)), 5);
                      const ceilingVal = Math.max(10, Math.ceil(maxBarVal / 5) * 5);
                      const numGroups = records.length;
                      const plotX = 42;
                      const plotW = 476;
                      const plotY = 25;
                      const plotH = 175;
                      const bottomY = plotY + plotH;

                      const groupWidth = plotW / numGroups;
                      const barWidth = Math.min(22, Math.max(10, groupWidth * 0.28));
                      const gap = 3;

                      return (
                        <svg viewBox="0 0 560 235" className="w-full h-full overflow-visible select-none">
                          {/* Horizontal Grid lines with Dual Axis Labels */}
                          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
                            const y = bottomY - ratio * plotH;
                            const gamesVal = Math.round(ceilingVal * ratio);
                            const rateVal = Math.round(ratio * 100);
                            return (
                              <g key={i}>
                                <line
                                  x1={plotX}
                                  y1={y}
                                  x2={plotX + plotW}
                                  y2={y}
                                  stroke="#27272a"
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                />
                                {/* Left axis: Games count */}
                                <text
                                  x={plotX - 6}
                                  y={y + 3.5}
                                  fill="#71717a"
                                  fontSize="9"
                                  textAnchor="end"
                                  fontFamily="monospace"
                                >
                                  {gamesVal}局
                                </text>
                                {/* Right axis: Win rate % */}
                                <text
                                  x={plotX + plotW + 6}
                                  y={y + 3.5}
                                  fill="#a1a1aa"
                                  fontSize="9"
                                  textAnchor="start"
                                  fontFamily="monospace"
                                >
                                  {rateVal}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Groups of Side-by-Side Bars */}
                          {records.map((item, index) => {
                            const groupCenterX = plotX + (index + 0.5) * groupWidth;
                            const isSelected =
                              selectedYearIndex === index ||
                              (selectedYearIndex === null && index === records.length - 1);

                            const winHeight = Math.max(2, (item.wins / ceilingVal) * plotH);
                            const winY = bottomY - winHeight;

                            const lossHeight = Math.max(2, (item.losses / ceilingVal) * plotH);
                            const lossY = bottomY - lossHeight;

                            const winX = groupCenterX - barWidth - gap / 2;
                            const lossX = groupCenterX + gap / 2;

                            return (
                              <g
                                key={`group-${item.year}`}
                                className="cursor-pointer transition-all"
                                onClick={() => setSelectedYearIndex(index)}
                              >
                                {/* Clickable Column Highlight Background */}
                                <rect
                                  x={groupCenterX - groupWidth / 2 + 2}
                                  y={plotY - 5}
                                  width={groupWidth - 4}
                                  height={plotH + 35}
                                  fill={isSelected ? 'rgba(245, 158, 11, 0.12)' : 'transparent'}
                                  rx="8"
                                  className="transition-all hover:fill-amber-500/10"
                                />

                                {/* Wins Bar (Emerald) */}
                                <rect
                                  x={winX}
                                  y={winY}
                                  width={barWidth}
                                  height={winHeight}
                                  fill="#10b981"
                                  rx="3"
                                  className="transition-all hover:brightness-110"
                                />
                                {item.wins > 0 && (
                                  <text
                                    x={winX + barWidth / 2}
                                    y={Math.max(winY - 3, 14)}
                                    fill="#34d399"
                                    fontSize="9"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {item.wins}
                                  </text>
                                )}

                                {/* Losses Bar (Rose) */}
                                <rect
                                  x={lossX}
                                  y={lossY}
                                  width={barWidth}
                                  height={lossHeight}
                                  fill="#f43f5e"
                                  rx="3"
                                  className="transition-all hover:brightness-110"
                                />
                                {item.losses > 0 && (
                                  <text
                                    x={lossX + barWidth / 2}
                                    y={Math.max(lossY - 3, 14)}
                                    fill="#fb7185"
                                    fontSize="9"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {item.losses}
                                  </text>
                                )}

                                {/* Year Label at bottom */}
                                <text
                                  x={groupCenterX}
                                  y={bottomY + 16}
                                  fill={isSelected ? '#fbbf24' : '#d4d4d8'}
                                  fontSize="10.5"
                                  fontWeight={isSelected ? 'bold' : 'normal'}
                                  textAnchor="middle"
                                >
                                  {item.year.toString().slice(-2)}年
                                </text>
                              </g>
                            );
                          })}

                          {/* Connecting Polyline for Win Rate */}
                          <polyline
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            points={records
                              .map((item, index) => {
                                const groupCenterX = plotX + (index + 0.5) * groupWidth;
                                const rateY = bottomY - Math.min(1, Math.max(0, item.rate)) * plotH;
                                return `${groupCenterX},${rateY}`;
                              })
                              .join(' ')}
                          />

                          {/* Win Rate Point Markers & Direct Numerical Badges */}
                          {records.map((item, index) => {
                            const groupCenterX = plotX + (index + 0.5) * groupWidth;
                            const rateY = bottomY - Math.min(1, Math.max(0, item.rate)) * plotH;
                            const isSelected =
                              selectedYearIndex === index ||
                              (selectedYearIndex === null && index === records.length - 1);
                            const ratePercent = (item.rate * 100).toFixed(1);

                            return (
                              <g
                                key={`point-${item.year}`}
                                className="cursor-pointer"
                                onClick={() => setSelectedYearIndex(index)}
                              >
                                {/* Glowing outer circle on selected */}
                                {isSelected && (
                                  <circle
                                    cx={groupCenterX}
                                    cy={rateY}
                                    r="8"
                                    fill="rgba(245, 158, 11, 0.3)"
                                  />
                                )}
                                {/* Main gold point node */}
                                <circle
                                  cx={groupCenterX}
                                  cy={rateY}
                                  r="4.5"
                                  fill="#fbbf24"
                                  stroke="#09090b"
                                  strokeWidth="2"
                                />

                                {/* Win Rate text badge directly above node */}
                                <rect
                                  x={groupCenterX - 18}
                                  y={Math.max(rateY - 18, 5)}
                                  width={36}
                                  height={12}
                                  fill="#18181b"
                                  stroke={isSelected ? '#f59e0b' : '#3f3f46'}
                                  strokeWidth="0.8"
                                  rx="3"
                                />
                                <text
                                  x={groupCenterX}
                                  y={Math.max(rateY - 9, 14)}
                                  fill={isSelected ? '#fbbf24' : '#fde68a'}
                                  fontSize="8.5"
                                  fontWeight="extrabold"
                                  textAnchor="middle"
                                >
                                  {ratePercent}%
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Structured Breakdown Table for All Years */}
                <div className="bg-zinc-950/60 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300 font-serif-jp flex items-center gap-1.5">
                      <BarChart2 size={13} className="text-amber-400" />
                      年度別 成績詳細一覧表
                    </span>
                    <span className="text-[10px] text-zinc-500">行をタップしてグラフ上の年度を選択</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="py-2 px-3 text-center">年度</th>
                          <th className="py-2 px-3 text-center">対局数</th>
                          <th className="py-2 px-3 text-center text-emerald-400">勝数 (○)</th>
                          <th className="py-2 px-3 text-center text-rose-400">敗数 (●)</th>
                          <th className="py-2 px-3 text-center text-amber-300">勝率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {[...effectiveYearRecords].reverse().map((r) => {
                          const originalIdx = effectiveYearRecords.findIndex(
                            (rec) => rec.year === r.year
                          );
                          const isSelected =
                            selectedYearIndex === originalIdx ||
                            (selectedYearIndex === null &&
                              originalIdx === effectiveYearRecords.length - 1);
                          const total = r.wins + r.losses;
                          const isBestRate =
                            r.rate ===
                            Math.max(...effectiveYearRecords.map((item) => item.rate));

                          return (
                            <tr
                              key={r.year}
                              onClick={() => setSelectedYearIndex(originalIdx)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-amber-500/15 text-white font-bold'
                                  : 'hover:bg-zinc-850/60 text-zinc-300'
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-bold">
                                <span className="inline-flex items-center gap-1">
                                  {r.year}年度
                                  {isBestRate && (
                                    <span
                                      className="px-1 py-0.2 rounded text-[9px] bg-amber-500/30 text-amber-300 font-normal border border-amber-500/40"
                                      title="最高勝率"
                                    >
                                      最高
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-medium">{total}局</td>
                              <td className="py-2 px-3 text-center font-bold text-emerald-400">
                                {r.wins}勝
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-rose-400">
                                {r.losses}敗
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-amber-300">
                                {(r.rate * 100).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 text-right">
                  ※ 日本将棋連盟公式戦記録準拠（年度: 4月〜翌年3月）
                </p>
              </div>
            ) : (
              <div className="py-8 px-4 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                <TrendingUp className="mx-auto text-amber-400/80" size={28} />
                <p className="text-sm font-bold text-zinc-200 font-serif-jp">年度別公式戦詳細記録</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  公式戦の詳細対局データは、日本将棋連盟公式名鑑または将棋DB2（棋譜データベース）にて全件検索可能です。
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <a
                    href={player.externalLinks.officialProfile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 transition"
                  >
                    <span>公式名鑑を見る</span>
                    <ExternalLink size={11} />
                  </a>
                  <a
                    href={player.externalLinks.kifuDatabase}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  >
                    <span>将棋DB2で検索</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Opening Strategies (戦型別) */}
        {activeTab === 'opening' && (
          <div>
            {player.openingStats.length > 0 ? (
              <div className="space-y-3.5">
                <p className="text-xs text-zinc-400 mb-2">
                  採用回数の多い主要戦型における勝率と公式対局数
                </p>
                {player.openingStats.map((item, idx) => (
                  <div key={idx} className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200 text-sm font-serif-jp">{item.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">
                          {item.count}局
                        </span>
                      </div>
                      <span className="font-extrabold text-amber-400 text-sm">
                        {(item.winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.winRate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                <ShieldCheck className="mx-auto text-amber-400/80" size={28} />
                <p className="text-sm font-bold text-zinc-200 font-serif-jp">主要戦型: {player.style || '居飛車'}</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  戦型別の詳細な指し手・棋譜は将棋DB2（棋譜データベース）にてご覧いただけます。
                </p>
                <div className="pt-2">
                  <a
                    href={player.externalLinks.kifuDatabase}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 transition"
                  >
                    <span>将棋DB2で棋譜・戦型を検索</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Head to Head against Rivals */}
        {activeTab === 'rivals' && (
          <div>
            {player.headToHead.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 mb-1">
                  歴代および現役の主要ライバルとの公式戦対戦成績 (勝・敗)
                </p>
                {player.headToHead.map((h2h) => {
                  const total = h2h.wins + h2h.losses;
                  const winRatio = total > 0 ? (h2h.wins / total) * 100 : 50;
                  return (
                    <div key={h2h.opponentId} className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100 text-sm font-serif-jp">
                            vs {h2h.opponentName}
                          </span>
                          <span className="text-xs text-zinc-400">({h2h.opponentRank})</span>
                        </div>
                        <div className="text-xs font-semibold">
                          <span className="text-emerald-400 font-bold">{h2h.wins}勝</span>
                          <span className="text-zinc-500 mx-1">-</span>
                          <span className="text-rose-400 font-bold">{h2h.losses}敗</span>
                          <span className="ml-2 text-zinc-400">({winRatio.toFixed(0)}%)</span>
                        </div>
                      </div>
                      {/* Two-color proportional bar */}
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${winRatio}%` }}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all duration-500"
                          style={{ width: `${100 - winRatio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 px-4 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                <Swords className="mx-auto text-amber-400/80" size={28} />
                <p className="text-sm font-bold text-zinc-200 font-serif-jp">公式戦対戦履歴</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  各棋士との過去の対戦全対局・勝敗記録は将棋DB2または連盟名鑑にて詳細に確認できます。
                </p>
                <div className="pt-2">
                  <a
                    href={player.externalLinks.kifuDatabase}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 transition"
                  >
                    <span>将棋DB2で対戦履歴を検索</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
