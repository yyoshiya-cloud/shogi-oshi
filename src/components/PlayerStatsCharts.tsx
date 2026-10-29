import React, { useState, useMemo, useEffect } from 'react';
import { Player, YearRecord } from '../types/shogi';
import { generateCompleteYearRecords } from '../utils/yearRecordsGenerator';
import {
  Trophy,
  TrendingUp,
  ShieldCheck,
  Swords,
  ExternalLink,
  BarChart2,
  Maximize2,
  ZoomIn,
  X,
} from 'lucide-react';

export interface PlayerYearlyChartSvgProps {
  records: YearRecord[];
  selectedYearIndex: number | null;
  onSelectYear?: (index: number) => void;
  isZoomed?: boolean;
}

/**
 * Reusable high-performance SVG chart for yearly match records and win rates.
 * Used identically in both standard card view and enlarged fullscreen overlay modal.
 */
export const PlayerYearlyChartSvg: React.FC<PlayerYearlyChartSvgProps> = ({
  records,
  selectedYearIndex,
  onSelectYear,
  isZoomed = false,
}) => {
  const maxBarVal = Math.max(...records.map((r) => Math.max(r.wins, r.losses)), 5);
  const ceilingVal = Math.max(10, Math.ceil(maxBarVal / 5) * 5);
  const numGroups = records.length;

  const viewBox = isZoomed ? '0 0 740 330' : '0 0 560 235';
  const plotX = isZoomed ? 52 : 42;
  const plotW = isZoomed ? 636 : 476;
  const plotY = isZoomed ? 28 : 25;
  const plotH = isZoomed ? 245 : 175;
  const bottomY = plotY + plotH;
  const groupWidth = plotW / numGroups;
  const barWidth = isZoomed
    ? Math.min(30, Math.max(16, groupWidth * 0.32))
    : Math.min(22, Math.max(10, groupWidth * 0.28));
  const gap = isZoomed ? 5 : 3;

  const activeRatePoints = records
    .map((item, index) => {
      if (item.wins + item.losses === 0 || item.isPreDebut) return null;
      const groupCenterX = plotX + (index + 0.5) * groupWidth;
      const rateY = bottomY - Math.min(1, Math.max(0, item.rate)) * plotH;
      return `${groupCenterX},${rateY}`;
    })
    .filter(Boolean) as string[];

  return (
    <svg viewBox={viewBox} className="w-full h-full overflow-visible select-none">
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
              x={plotX - (isZoomed ? 8 : 6)}
              y={y + 3.5}
              fill="#71717a"
              fontSize={isZoomed ? '11' : '9'}
              textAnchor="end"
              fontFamily="monospace"
            >
              {gamesVal}局
            </text>
            {/* Right axis: Win rate % */}
            <text
              x={plotX + plotW + (isZoomed ? 8 : 6)}
              y={y + 3.5}
              fill="#a1a1aa"
              fontSize={isZoomed ? '11' : '9'}
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
        const isPreDebut = item.isPreDebut || item.wins + item.losses === 0;

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
            onClick={(e) => {
              e.stopPropagation();
              onSelectYear?.(index);
            }}
          >
            {/* Clickable Column Highlight Background */}
            <rect
              x={groupCenterX - groupWidth / 2 + 2}
              y={plotY - 5}
              width={groupWidth - 4}
              height={plotH + 35}
              fill={isSelected ? 'rgba(245, 158, 11, 0.14)' : 'transparent'}
              rx="8"
              className="transition-all hover:fill-amber-500/10"
            />

            {isPreDebut ? (
              <g>
                <line
                  x1={groupCenterX - (isZoomed ? 12 : 8)}
                  y1={bottomY - (isZoomed ? 16 : 12)}
                  x2={groupCenterX + (isZoomed ? 12 : 8)}
                  y2={bottomY - (isZoomed ? 16 : 12)}
                  stroke="#52525b"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <text
                  x={groupCenterX}
                  y={bottomY - (isZoomed ? 26 : 20)}
                  fill="#71717a"
                  fontSize={isZoomed ? '10' : '8'}
                  textAnchor="middle"
                >
                  プロ前
                </text>
              </g>
            ) : (
              <>
                {/* Wins Bar (Emerald) */}
                <rect
                  x={winX}
                  y={winY}
                  width={barWidth}
                  height={winHeight}
                  fill="#10b981"
                  rx={isZoomed ? '4' : '3'}
                  className="transition-all hover:brightness-110"
                />
                {item.wins > 0 && (
                  <text
                    x={winX + barWidth / 2}
                    y={Math.max(winY - 4, 14)}
                    fill="#34d399"
                    fontSize={isZoomed ? '11' : '9'}
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
                  rx={isZoomed ? '4' : '3'}
                  className="transition-all hover:brightness-110"
                />
                {item.losses > 0 && (
                  <text
                    x={lossX + barWidth / 2}
                    y={Math.max(lossY - 4, 14)}
                    fill="#fb7185"
                    fontSize={isZoomed ? '11' : '9'}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {item.losses}
                  </text>
                )}
              </>
            )}

            {/* Year Label at bottom */}
            <text
              x={groupCenterX}
              y={bottomY + (isZoomed ? 20 : 16)}
              fill={isSelected ? '#fbbf24' : '#d4d4d8'}
              fontSize={isZoomed ? '12.5' : '10.5'}
              fontWeight={isSelected ? 'bold' : 'normal'}
              textAnchor="middle"
            >
              {isZoomed ? `${item.year}年度` : `${item.year.toString().slice(-2)}年`}
            </text>
          </g>
        );
      })}

      {/* Connecting Polyline for Win Rate across active years */}
      {activeRatePoints.length > 1 && (
        <polyline
          fill="none"
          stroke="#f59e0b"
          strokeWidth={isZoomed ? '3.2' : '2.5'}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={activeRatePoints.join(' ')}
        />
      )}

      {/* Win Rate Point Markers & Direct Numerical Badges for active years */}
      {records.map((item, index) => {
        if (item.wins + item.losses === 0 || item.isPreDebut) return null;
        const groupCenterX = plotX + (index + 0.5) * groupWidth;
        const rateY = bottomY - Math.min(1, Math.max(0, item.rate)) * plotH;
        const isSelected =
          selectedYearIndex === index ||
          (selectedYearIndex === null && index === records.length - 1);
        const ratePercent = (item.rate * 100).toFixed(1);
        const badgeW = isZoomed ? 44 : 36;
        const badgeH = isZoomed ? 15 : 12;

        return (
          <g
            key={`point-${item.year}`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectYear?.(index);
            }}
          >
            {/* Glowing outer circle on selected */}
            {isSelected && (
              <circle
                cx={groupCenterX}
                cy={rateY}
                r={isZoomed ? '10' : '8'}
                fill="rgba(245, 158, 11, 0.3)"
              />
            )}

            {/* Main gold point node */}
            <circle
              cx={groupCenterX}
              cy={rateY}
              r={isZoomed ? '5.5' : '4.5'}
              fill="#fbbf24"
              stroke="#09090b"
              strokeWidth="2"
            />

            {/* Win Rate text badge directly above node */}
            <rect
              x={groupCenterX - badgeW / 2}
              y={Math.max(rateY - (isZoomed ? 22 : 18), 5)}
              width={badgeW}
              height={badgeH}
              fill="#18181b"
              stroke={isSelected ? '#f59e0b' : '#3f3f46'}
              strokeWidth={isZoomed ? '1.2' : '0.8'}
              rx="3"
            />
            <text
              x={groupCenterX}
              y={Math.max(rateY - (isZoomed ? 11 : 9), 14)}
              fill={isSelected ? '#fbbf24' : '#fde68a'}
              fontSize={isZoomed ? '10' : '8.5'}
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
};

export interface PlayerStatsChartsProps {
  player: Player;
  onOpenZoom?: () => void;
}

export const PlayerStatsCharts: React.FC<PlayerStatsChartsProps> = ({ player, onOpenZoom }) => {
  const [activeTab, setActiveTab] = useState<'yearly' | 'opening' | 'rivals'>('yearly');
  const [selectedYearIndex, setSelectedYearIndex] = useState<number | null>(null);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const handleOpenZoom = () => {
    if (onOpenZoom) {
      onOpenZoom();
    } else {
      setIsZoomModalOpen(true);
    }
  };

  // Close zoom modal on Escape key if opened internally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomModalOpen(false);
      }
    };
    if (isZoomModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomModalOpen]);

  const hasCareerStats = player.careerWins > 0 || player.careerLosses > 0;
  const hasYearStats = player.currentYearWins > 0 || player.currentYearLosses > 0;

  // Comprehensive 2021-2026 year records generated for all players
  const effectiveYearRecords = useMemo<YearRecord[]>(() => {
    return generateCompleteYearRecords(player);
  }, [player]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
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
              <span className="text-lg font-bold text-zinc-200 font-serif-jp">
                今年度公式戦対局中
              </span>
            )}
          </div>
          <div className="text-xs text-emerald-400 font-bold mt-2">
            {hasYearStats
              ? `勝率 ${(player.currentYearWinRate * 100).toFixed(1)}%`
              : '今年度公式記録ベース'}
          </div>
        </div>
      </div>

      {/* Statistical Tabs */}
      <div>
        <div className="flex border-b border-zinc-800 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('yearly')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'yearly'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            年度別成績推移
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('opening')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'opening'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            主要戦型別勝率
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rivals')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'rivals'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ライバル対決
          </button>
        </div>

        {/* Tab 1: Yearly Records */}
        {activeTab === 'yearly' && (
          <div className="space-y-4">
            {effectiveYearRecords.length > 0 ? (
              <div className="space-y-4">
                {/* Quick Year Pill Selectors */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] text-zinc-400 font-medium mr-1 shrink-0">
                    表示年度:
                  </span>
                  {effectiveYearRecords.map((r, idx) => {
                    const isSelected =
                      selectedYearIndex === idx ||
                      (selectedYearIndex === null && idx === effectiveYearRecords.length - 1);
                    return (
                      <button
                        key={r.year}
                        type="button"
                        onClick={() => setSelectedYearIndex(idx)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                        }`}
                      >
                        {r.year}年度
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Inspector Card for Selected Year */}
                {(() => {
                  const activeRecord =
                    selectedYearIndex !== null && effectiveYearRecords[selectedYearIndex]
                      ? effectiveYearRecords[selectedYearIndex]
                      : effectiveYearRecords[effectiveYearRecords.length - 1];
                  const totalGames = activeRecord ? activeRecord.wins + activeRecord.losses : 0;
                  const isPreDebut = activeRecord?.isPreDebut || totalGames === 0;

                  return (
                    <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-900 to-amber-950/20 border border-zinc-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-500 text-zinc-950 shadow-sm">
                          {activeRecord?.year}年度
                        </span>
                        {activeRecord?.year === 2026 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                            今年度速報
                          </span>
                        )}
                        {isPreDebut ? (
                          <span className="text-zinc-400 font-medium">プロ入り前（公式戦未出場）</span>
                        ) : (
                          <span className="text-zinc-300 font-medium">
                            総対局数 <strong className="text-white text-sm font-bold">{totalGames}</strong> 局
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {isPreDebut ? (
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 font-medium text-xs">
                            奨励会・研修会等在籍期間
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* SVG Visual Chart Card with Header and Click-to-Zoom */}
                <div className="w-full bg-zinc-950/80 p-3 sm:p-4 rounded-2xl border border-zinc-800 shadow-inner overflow-hidden">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800/80">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-serif-jp">
                      <BarChart2 size={13} className="text-amber-400" />
                      年度別戦績推移グラフ
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenZoom}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 text-[11px] font-bold text-amber-300 hover:text-amber-200 transition shadow-sm active:scale-95 cursor-pointer"
                      title="グラフを拡大表示"
                    >
                      <Maximize2 size={12} />
                      <span>拡大表示</span>
                    </button>
                  </div>

                  <div
                    className="relative h-60 sm:h-64 w-full cursor-pointer group"
                    onClick={handleOpenZoom}
                    title="クリックしてグラフを拡大表示"
                  >
                    {/* Hover indicator overlay */}
                    <div className="absolute top-1 right-1 z-10 hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/90 border border-zinc-700 text-[10px] text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
                      <ZoomIn size={11} />
                      <span>クリックで拡大</span>
                    </div>
                    <PlayerYearlyChartSvg
                      records={effectiveYearRecords}
                      selectedYearIndex={selectedYearIndex}
                      onSelectYear={(idx) => setSelectedYearIndex(idx)}
                      isZoomed={false}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"></span>
                        勝数
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block"></span>
                        敗数
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span>
                        勝率
                      </span>
                    </div>
                    <span className="hidden sm:inline text-zinc-400">
                      ※ グラフをクリックすると全画面で拡大表示できます
                    </span>
                  </div>
                </div>

                {/* Standalone fallback zoom dialog */}
                {!onOpenZoom && isZoomModalOpen && (
                  <YearlyChartZoomModal
                    player={player}
                    isOpen={isZoomModalOpen}
                    onClose={() => setIsZoomModalOpen(false)}
                    initialYearIndex={selectedYearIndex}
                  />
                )}

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
                          const isPreDebut = r.isPreDebut || total === 0;
                          const activeRates = effectiveYearRecords
                            .filter((item) => item.wins + item.losses > 0 && !item.isPreDebut)
                            .map((item) => item.rate);
                          const isBestRate =
                            !isPreDebut && activeRates.length > 0 && r.rate === Math.max(...activeRates);

                          return (
                            <tr
                              key={r.year}
                              onClick={() => setSelectedYearIndex(originalIdx)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-amber-500/15 text-white font-bold'
                                  : 'hover:bg-zinc-855/60 text-zinc-300'
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-bold">
                                <span className="inline-flex items-center gap-1">
                                  {r.year}年度
                                  {r.year === 2026 && (
                                    <span
                                      className="px-1 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30"
                                      title="2026年度は年度途中（4月〜現在）の最新確定速報値"
                                    >
                                      速報
                                    </span>
                                  )}
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
                              <td className="py-2 px-3 text-center font-medium">
                                {isPreDebut ? (
                                  <span className="text-zinc-500">0局</span>
                                ) : (
                                  `${total}局`
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-bold">
                                {isPreDebut ? (
                                  <span className="text-zinc-600 font-normal">－</span>
                                ) : (
                                  <span className="text-emerald-400">{r.wins}勝</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-bold">
                                {isPreDebut ? (
                                  <span className="text-zinc-600 font-normal">－</span>
                                ) : (
                                  <span className="text-rose-400">{r.losses}敗</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold">
                                {isPreDebut ? (
                                  <span className="text-zinc-500 font-sans text-[11px] font-normal">
                                    － (プロ入り前)
                                  </span>
                                ) : (
                                  <span className="text-amber-300">{(r.rate * 100).toFixed(1)}%</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 text-right">
                  ※ 日本将棋連盟・kishibetsu.com公式戦記録準拠（年度: 4月〜翌年3月／2026年度は年度途中確定速報値）
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

export interface YearlyChartZoomModalProps {
  player: Player;
  isOpen: boolean;
  onClose: () => void;
  initialYearIndex?: number | null;
}

export const YearlyChartZoomModal: React.FC<YearlyChartZoomModalProps> = ({
  player,
  isOpen,
  onClose,
  initialYearIndex = null,
}) => {
  const effectiveYearRecords = useMemo<YearRecord[]>(() => {
    return generateCompleteYearRecords(player);
  }, [player]);

  const [selectedYearIndex, setSelectedYearIndex] = useState<number | null>(
    initialYearIndex !== null ? initialYearIndex : effectiveYearRecords.length - 1
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const records = effectiveYearRecords;
  const activeRecord =
    selectedYearIndex !== null && records[selectedYearIndex]
      ? records[selectedYearIndex]
      : records[records.length - 1];
  const totalGames = activeRecord ? activeRecord.wins + activeRecord.losses : 0;
  const isPreDebut = activeRecord?.isPreDebut || totalGames === 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black font-serif-jp shadow border border-white/20 bg-zinc-900 text-amber-400 flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: player.colorAccent }}
            >
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                player.name[0]
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  全画面拡大表示
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white font-serif-jp">
                  {player.name}（{player.danRank || player.rank}）年度別戦績推移グラフ
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                2021年度〜2026年度 公式戦年度別詳細推移（日本将棋連盟・LPSA・kishibetsu.com公式記録）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer"
            title="閉じる (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Year Pill Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-zinc-400 font-medium mr-1 shrink-0">
            年度切替:
          </span>
          {records.map((r, idx) => {
            const isSelected =
              selectedYearIndex === idx ||
              (selectedYearIndex === null && idx === records.length - 1);
            return (
              <button
                key={r.year}
                type="button"
                onClick={() => setSelectedYearIndex(idx)}
                className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {r.year}年度
              </button>
            );
          })}
        </div>

        {/* Large Inspector Card inside Zoom */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-sm font-black bg-amber-500 text-zinc-950 shadow">
              {activeRecord?.year}年度
            </span>
            {activeRecord?.year === 2026 && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                今年度速報
              </span>
            )}
            {isPreDebut ? (
              <span className="text-zinc-400 font-medium text-sm">
                プロ入り前（公式戦未出場）
              </span>
            ) : (
              <span className="text-zinc-300 font-medium text-sm">
                総対局数 <strong className="text-white text-base font-bold">{totalGames}</strong> 局
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isPreDebut ? (
              <span className="px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 font-medium text-xs">
                奨励会・研修会等在籍期間
              </span>
            ) : (
              <>
                <div className="bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <span>○ 勝数:</span>
                  <strong className="text-base text-emerald-400">
                    {activeRecord?.wins ?? 0}
                  </strong>
                </div>
                <div className="bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1.5">
                  <span>● 敗数:</span>
                  <strong className="text-base text-rose-400">
                    {activeRecord?.losses ?? 0}
                  </strong>
                </div>
                <div className="bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5">
                  <span>勝率:</span>
                  <strong className="text-base font-mono text-amber-200">
                    {((activeRecord?.rate ?? 0) * 100).toFixed(1)}%
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Enlarged High-Resolution SVG Graph */}
        <div className="w-full bg-zinc-950 p-4 sm:p-6 rounded-2xl border border-zinc-800 shadow-inner overflow-hidden">
          <div className="relative h-72 sm:h-96 w-full">
            <PlayerYearlyChartSvg
              records={records}
              selectedYearIndex={selectedYearIndex}
              onSelectYear={(idx) => setSelectedYearIndex(idx)}
              isZoomed={true}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-800 text-xs">
          <div className="flex items-center gap-4 text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
              勝数 (緑)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
              敗数 (赤)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-amber-400 inline-block"></span>
              勝率折れ線 (金)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold transition text-xs cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
