import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface ShogiBoardViewerProps {
  moves: string[];
  kifuUrl: string;
  tournament: string;
  senteName: string;
  goteName: string;
  totalMovesCount?: number;
  endCondition?: string;
}

// Initial 9x9 Shogi board representation
// sente (▲) moves up, gote (△) moves down
// Coordinates: board[row][col] where row is 0..8 (一..九), col is 0..8 (9..1)
type Piece = {
  type: string; // '王'|'玉'|'飛'|'角'|'金'|'銀'|'桂'|'香'|'歩'|'竜'|'馬'|'成銀'|'成桂'|'成香'|'と'
  owner: 'sente' | 'gote';
};

const INITIAL_BOARD: (Piece | null)[][] = [
  // 1段目 (gote back rank)
  [
    { type: '香', owner: 'gote' }, { type: '桂', owner: 'gote' }, { type: '銀', owner: 'gote' },
    { type: '金', owner: 'gote' }, { type: '王', owner: 'gote' }, { type: '金', owner: 'gote' },
    { type: '銀', owner: 'gote' }, { type: '桂', owner: 'gote' }, { type: '香', owner: 'gote' }
  ],
  // 2段目
  [
    null, { type: '飛', owner: 'gote' }, null,
    null, null, null,
    null, { type: '角', owner: 'gote' }, null
  ],
  // 3段目 (gote pawns)
  [
    { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' },
    { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' },
    { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' }, { type: '歩', owner: 'gote' }
  ],
  // 4..6段目 (empty initially)
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  // 7段目 (sente pawns)
  [
    { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' },
    { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' },
    { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' }, { type: '歩', owner: 'sente' }
  ],
  // 8段目
  [
    null, { type: '角', owner: 'sente' }, null,
    null, null, null,
    null, { type: '飛', owner: 'sente' }, null
  ],
  // 9段目 (sente back rank)
  [
    { type: '香', owner: 'sente' }, { type: '桂', owner: 'sente' }, { type: '銀', owner: 'sente' },
    { type: '金', owner: 'sente' }, { type: '玉', owner: 'sente' }, { type: '金', owner: 'sente' },
    { type: '銀', owner: 'sente' }, { type: '桂', owner: 'sente' }, { type: '香', owner: 'sente' }
  ]
];

const KANJI_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const ARABIC_COLS = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];

export const ShogiBoardViewer: React.FC<ShogiBoardViewerProps> = ({
  moves,
  kifuUrl,
  senteName,
  goteName,
  totalMovesCount,
  endCondition,
}) => {
  const [currentPly, setCurrentPly] = useState<number>(moves.length > 0 ? Math.min(moves.length, 30) : 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Auto-play moves
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentPly((prev) => {
          if (prev >= moves.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, moves.length]);

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentPly((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentPly((p) => Math.min(moves.length, p + 1));
  };

  const handleStart = () => {
    setIsPlaying(false);
    setCurrentPly(0);
  };

  const handleEnd = () => {
    setIsPlaying(false);
    setCurrentPly(moves.length);
  };

  // Helper to parse shogi notation like "▲７六歩", "△８四歩", "▲２六歩", "７七角成", "同 銀"
  const getRenderedBoard = () => {
    const b: (Piece | null)[][] = JSON.parse(JSON.stringify(INITIAL_BOARD));

    const kanjiColMap: Record<string, number> = {
      '１': 8, '２': 7, '３': 6, '４': 5, '５': 4, '６': 3, '７': 2, '８': 1, '９': 0,
      '1': 8, '2': 7, '3': 6, '4': 5, '5': 4, '6': 3, '7': 2, '8': 1, '9': 0,
      '同': -1
    };
    const kanjiRowMap: Record<string, number> = {
      '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '七': 6, '八': 7, '九': 8
    };

    let lastDest: { row: number; col: number } | null = null;

    for (let i = 0; i < currentPly && i < moves.length; i++) {
      const move = moves[i];
      if (!move) continue;

      const owner = move.startsWith('☗') || move.startsWith('▲') ? 'sente' : move.startsWith('☖') || move.startsWith('△') ? 'gote' : (i % 2 === 0 ? 'sente' : 'gote');
      const clean = move.replace(/^[☗☖▲△]/, '');

      // Ignore endgame declarations or special conditions
      if (clean.includes('投了') || clean.includes('反則') || clean.includes('千日手') || clean.includes('持将棋') || clean.includes('中断')) {
        continue;
      }

      // Check for "同" (same square as last move)
      if (clean.startsWith('同')) {
        if (lastDest) {
          const { row, col } = lastDest;
          // Extract piece type
          let pType = '歩';
          if (clean.includes('飛')) pType = '飛';
          else if (clean.includes('角')) pType = '角';
          else if (clean.includes('金')) pType = '金';
          else if (clean.includes('銀')) pType = '銀';
          else if (clean.includes('桂')) pType = '桂';
          else if (clean.includes('香')) pType = '香';
          else if (clean.includes('玉') || clean.includes('王')) pType = '玉';
          else if (clean.includes('馬')) pType = '馬';
          else if (clean.includes('竜')) pType = '竜';
          else if (clean.includes('と')) pType = 'と';

          if (clean.includes('成') && !pType.startsWith('成') && pType !== '王' && pType !== '金') {
            if (pType === '歩') pType = 'と';
            else if (pType === '銀') pType = '成銀';
            else if (pType === '桂') pType = '成桂';
            else if (pType === '香') pType = '成香';
            else if (pType === '角') pType = '馬';
            else if (pType === '飛') pType = '竜';
          }

          b[row][col] = { type: pType, owner };
        }
        continue;
      }

      const colChar = clean[0];
      const rowChar = clean[1];
      const targetCol = kanjiColMap[colChar];
      const targetRow = kanjiRowMap[rowChar];

      if (targetCol !== undefined && targetCol >= 0 && targetRow !== undefined) {
        // Extract piece type
        let pType = '歩';
        if (clean.includes('飛')) pType = '飛';
        else if (clean.includes('角')) pType = '角';
        else if (clean.includes('金')) pType = '金';
        else if (clean.includes('銀')) pType = '銀';
        else if (clean.includes('桂')) pType = '桂';
        else if (clean.includes('香')) pType = '香';
        else if (clean.includes('玉') || clean.includes('王')) pType = '玉';
        else if (clean.includes('馬')) pType = '馬';
        else if (clean.includes('竜')) pType = '竜';
        else if (clean.includes('と')) pType = 'と';

        if (clean.includes('成') && !pType.startsWith('成') && pType !== '王' && pType !== '金') {
          if (pType === '歩') pType = 'と';
          else if (pType === '銀') pType = '成銀';
          else if (pType === '桂') pType = '成桂';
          else if (pType === '香') pType = '成香';
          else if (pType === '角') pType = '馬';
          else if (pType === '飛') pType = '竜';
        }

        // Exact origin source identification for standard shogi moves
        let foundFrom: { row: number; col: number } | null = null;

        // Specific rule for advancing pawns
        if (pType === '歩' || pType === 'と') {
          if (owner === 'sente') {
            // Sente moves up: targetRow should be below foundFrom.row (foundFrom.row = targetRow + 1)
            const fromR = targetRow + 1;
            if (fromR >= 0 && fromR < 9 && b[fromR][targetCol]?.type === '歩' && b[fromR][targetCol]?.owner === 'sente') {
              foundFrom = { row: fromR, col: targetCol };
            }
          } else {
            // Gote moves down: targetRow should be above foundFrom.row (foundFrom.row = targetRow - 1)
            const fromR = targetRow - 1;
            if (fromR >= 0 && fromR < 9 && b[fromR][targetCol]?.type === '歩' && b[fromR][targetCol]?.owner === 'gote') {
              foundFrom = { row: fromR, col: targetCol };
            }
          }
        }

        if (!foundFrom) {
          // General search for matching piece owned by player
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              const p = b[r][c];
              if (p && p.owner === owner && (p.type === pType || (pType === '歩' && (p.type === '歩' || p.type === 'と')))) {
                foundFrom = { row: r, col: c };
                break;
              }
            }
            if (foundFrom) break;
          }
        }

        if (foundFrom) {
          b[foundFrom.row][foundFrom.col] = null;
        }

        b[targetRow][targetCol] = { type: pType, owner };
        lastDest = { row: targetRow, col: targetCol };
      }
    }

    return b;
  };

  const renderedBoard = getRenderedBoard();
  const currentMoveText = currentPly > 0 ? moves[currentPly - 1] : '開始局面';

  return (
    <div className="flex flex-col items-center bg-[#181614] rounded-2xl p-3 sm:p-5 border border-amber-900/30 shadow-xl">
      {/* Top Header: Player Names and Turn indicator */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-amber-900/30 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-zinc-400">☖ 後手:</span>
          <span className="font-bold text-zinc-100">{goteName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">☗ 先手:</span>
          <span className="font-bold text-amber-300">{senteName}</span>
        </div>
      </div>

      {/* Shogi Board Container with Traditional Wood Grain Styling */}
      <div className="my-4 relative p-2.5 sm:p-3.5 rounded-xl bg-gradient-to-br from-[#dfb76c] via-[#ce9e4b] to-[#b38235] shadow-2xl border-4 border-[#85531b]">
        {/* Column Numbers 9..1 */}
        <div className="grid grid-cols-9 text-center text-[10px] sm:text-xs font-bold text-[#452608] pb-1">
          {ARABIC_COLS.map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        {/* 9x9 Grid with Row Numerals 一..九 */}
        <div className="flex">
          <div className="grid grid-cols-9 grid-rows-9 gap-[1px] bg-[#643b0f] border-2 border-[#542f0a] shadow-inner">
            {renderedBoard.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="relative w-7 h-8 sm:w-10 sm:h-11 flex items-center justify-center bg-[#f0ca82] hover:bg-[#ebd59f] transition-colors"
                  >

                    {/* Piece */}
                    {cell && (
                      <div
                        className={`koma-shape w-6 h-7 sm:w-8 sm:h-9 flex items-center justify-center font-serif-jp text-xs sm:text-sm font-extrabold shadow-md transition-transform ${
                          cell.owner === 'gote'
                            ? 'rotate-180 bg-[#dec084] text-[#2e1d0f] border-b-2 border-black/40'
                            : 'bg-[#faecc8] text-[#1c1208] border-b-2 border-amber-950/40'
                        }`}
                      >
                        <span className={cell.type === '馬' || cell.type === '竜' || cell.type === 'と' ? 'text-red-700' : ''}>
                          {cell.type}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Row Kanji Labels 一..九 */}
          <div className="flex flex-col justify-around pl-1 text-[10px] sm:text-xs font-bold text-[#452608]">
            {KANJI_NUMS.map((k) => (
              <div key={k} className="h-8 sm:h-11 flex items-center justify-center">
                {k}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Move Status Banner */}
      <div className="w-full flex items-center justify-between bg-zinc-900/80 px-4 py-2.5 rounded-xl border border-zinc-800 text-sm mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {currentPly}手目
          </span>
          <span className="font-bold text-zinc-100 font-serif-jp tracking-wider text-base">
            {currentMoveText}
          </span>
          {currentPly === moves.length && (currentMoveText.includes('投了') || endCondition) && (
            <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              終局（{endCondition || '投了'}）
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-zinc-400">
            {totalMovesCount && totalMovesCount > moves.length
              ? `全 ${moves.length} 手 (序盤ダイジェスト / 終局: ${totalMovesCount}手${endCondition ? ` ${endCondition}` : ''})`
              : `全 ${moves.length} 手${endCondition && currentPly === moves.length ? ` (${endCondition})` : ''}`}
          </span>
        </div>
      </div>

      {/* Explanatory Notice if only opening moves are loaded */}
      {totalMovesCount && totalMovesCount > moves.length && (
        <div className="w-full bg-amber-950/20 border border-amber-500/30 rounded-xl px-3 py-2 text-[11px] text-amber-200/90 mb-3 flex items-start gap-2 leading-relaxed">
          <span className="text-amber-400 font-bold shrink-0">ℹ️</span>
          <span>
            アプリ内盤面ビューアは序盤ハイライト（全{moves.length}手）を再現しています。終局（{totalMovesCount}手）までの全手順・消費時間は下の公式リンクよりご覧いただけます。
          </span>
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <button
          onClick={handleStart}
          disabled={currentPly === 0}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition"
          title="最初へ"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={handlePrev}
          disabled={currentPly === 0}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition"
          title="1手戻る"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={moves.length === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition shadow-lg ${
            isPlaying
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-amber-500 text-stone-950 hover:bg-amber-400 font-bold'
          }`}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? '一時停止' : '自動再生'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentPly >= moves.length}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition"
          title="1手進む"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={handleEnd}
          disabled={currentPly >= moves.length}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition"
          title="最終手へ"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Horizontal Moves Scroll preview */}
      <div className="w-full overflow-x-auto py-1 px-1 flex gap-1.5 scrollbar-thin border-t border-zinc-800/80 pt-3">
        {moves.map((m, idx) => {
          const plyNumber = idx + 1;
          const isActive = plyNumber === currentPly;
          return (
            <button
              key={idx}
              onClick={() => {
                setIsPlaying(false);
                setCurrentPly(plyNumber);
              }}
              className={`flex-shrink-0 px-2 py-1 rounded text-xs transition ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-bold shadow'
                  : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {plyNumber}. {m}
            </button>
          );
        })}
      </div>

      {/* External Direct Link */}
      {kifuUrl && (
        <a
          href={kifuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 underline underline-offset-4 transition"
        >
          <span>将棋DB2 / 公式連盟中継で全棋譜・消費時間を閲覧</span>
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
};
