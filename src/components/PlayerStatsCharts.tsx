import React, { useState } from 'react';
import { Player } from '../types/shogi';
import { Trophy, TrendingUp, ShieldCheck, Swords, ExternalLink } from 'lucide-react';

interface PlayerStatsChartsProps {
  player: Player;
}

export const PlayerStatsCharts: React.FC<PlayerStatsChartsProps> = ({ player }) => {
  const [activeTab, setActiveTab] = useState<'yearly' | 'opening' | 'rivals'>('yearly');

  const hasCareerStats = player.careerWins > 0 || player.careerLosses > 0;
  const hasYearStats = player.currentYearWins > 0 || player.currentYearLosses > 0;

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
              ? `勝率 ${(player.currentYearWinRate * 100).toFixed(1)}%${player.currentYearStreak > 0 ? ` (連勝 ${player.currentYearStreak})` : ''}`
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

        {/* Tab 1: Accurate SVG Yearly Bar & Line Chart */}
        {activeTab === 'yearly' && (
          <div>
            {player.yearRecords.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200 font-serif-jp">年度別勝敗数と勝率推移グラフ</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 勝数
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> 敗数
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 勝率(%)
                    </span>
                  </div>
                </div>

                {/* SVG Visual Chart */}
                <div className="w-full bg-zinc-950/70 p-4 rounded-xl border border-zinc-800">
                  <div className="relative h-56 w-full">
                    <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                      {/* Horizontal grid lines for win rate % */}
                      {[0, 25, 50, 75, 100].map((pct, i) => {
                        const y = 20 + (150 * (100 - pct)) / 100;
                        return (
                          <g key={i}>
                            <line x1="35" y1={y} x2="480" y2={y} stroke="#27272a" strokeDasharray="4 4" strokeWidth="1" />
                            <text x="30" y={y + 3} fill="#a1a1aa" fontSize="9" textAnchor="end">{pct}%</text>
                          </g>
                        );
                      })}

                      {/* Bars for each year */}
                      {player.yearRecords.map((item, index, arr) => {
                        const maxVal = Math.max(...arr.map((r) => r.wins + r.losses), 60);
                        const barWidth = 26;
                        const spacing = (430 - arr.length * barWidth) / Math.max(1, arr.length - 1);
                        const x = 50 + index * (barWidth + spacing);

                        const winH = (item.wins / maxVal) * 130;
                        const lossH = (item.losses / maxVal) * 130;
                        const winY = 170 - winH;
                        const lossY = winY - lossH;
                        const winRate = item.rate * 100;
                        const rateY = 170 - (winRate / 100) * 130;

                        return (
                          <g key={item.year} className="group cursor-pointer">
                            {/* Wins bar (emerald) */}
                            <rect
                              x={x}
                              y={winY}
                              width={barWidth}
                              height={winH}
                              fill="#10b981"
                              rx="3"
                              className="transition-all duration-300 hover:fill-emerald-400"
                            />
                            {/* Losses bar stacked on top (rose) */}
                            <rect
                              x={x}
                              y={lossY}
                              width={barWidth}
                              height={lossH}
                              fill="#f43f5e"
                              rx="3"
                              className="transition-all duration-300 hover:fill-rose-400 opacity-90"
                            />

                            {/* Win rate point on line */}
                            <circle
                              cx={x + barWidth / 2}
                              cy={rateY}
                              r="4"
                              fill="#fbbf24"
                              stroke="#18181b"
                              strokeWidth="2"
                            />

                            {/* Year text */}
                            <text x={x + barWidth / 2} y="188" fill="#d4d4d8" fontSize="11" fontWeight="bold" textAnchor="middle">
                              {item.year.toString().slice(-2)}年
                            </text>

                            {/* Tooltip on hover */}
                            <title>{`${item.year}年度: ${item.wins}勝 ${item.losses}敗 (勝率 ${(item.rate * 100).toFixed(1)}%)`}</title>
                          </g>
                        );
                      })}

                      {/* Connecting Line for Win Rate */}
                      <polyline
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2.5"
                        points={player.yearRecords.map((item, index, arr) => {
                          const barWidth = 26;
                          const spacing = (430 - arr.length * barWidth) / Math.max(1, arr.length - 1);
                          const x = 50 + index * (barWidth + spacing) + barWidth / 2;
                          const winRate = item.rate * 100;
                          const rateY = 170 - (winRate / 100) * 130;
                          return `${x},${rateY}`;
                        }).join(' ')}
                      />
                    </svg>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 text-right">
                  ※ 日本将棋連盟公式戦年度記録ベース（緑: 勝数, 赤: 敗数, 黄線: 勝率推移）
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
