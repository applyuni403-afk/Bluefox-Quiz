'use client';

import { RapidFireTile } from '@/lib/useGameState';
import { Flame, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface RapidFireBoardProps {
  board: RapidFireTile[];
  activeQuestionId?: string | null;
  isInteractive: boolean;
  onSelectTile: (questionId: string) => Promise<void> | void;
}

export function RapidFireBoard({
  board,
  activeQuestionId,
  isInteractive,
  onSelectTile,
}: RapidFireBoardProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const handleTileClick = async (tile: RapidFireTile) => {
    if (!isInteractive || tile.status === 'done' || selectingId) return;

    try {
      setSelectingId(tile.id);
      await onSelectTile(tile.id);
    } catch (err) {
      console.error('Failed to select rapid fire tile:', err);
    } finally {
      setSelectingId(null);
    }
  };

  if (board.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white/80 backdrop-blur-xl rounded-2xl border border-dashed border-blue-200">
        <Flame className="w-8 h-8 mx-auto mb-2 text-amber-500/80" />
        <p className="text-sm font-semibold text-slate-600">No Rapid Fire tiles configured</p>
      </div>
    );
  }

  const unusedCount = board.filter((b) => b.status === 'unused').length;

  return (
    <div className="w-full bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(30,58,138,0.06)]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight">
              Rapid Fire Matrix
            </h3>
            <p className="text-xs text-slate-500 font-medium">Select a tile number</p>
          </div>
        </div>

        {isInteractive ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Your Turn
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {unusedCount} / {board.length} Left
          </span>
        )}
      </div>

      {/* Grid of Numbered Tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
        {board.map((tile) => {
          const isDone = tile.status === 'done';
          const isActive = tile.id === activeQuestionId || tile.status === 'active';
          const isPending = selectingId === tile.id;

          let tileStyles = '';
          if (isActive) {
            tileStyles =
              'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 text-white shadow-lg shadow-amber-500/25 scale-105 ring-2 ring-amber-300 border border-amber-200';
          } else if (isDone) {
            tileStyles =
              'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed';
          } else {
            // Unused
            tileStyles = isInteractive
              ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/40 active:scale-95 cursor-pointer shadow-xs'
              : 'bg-slate-100 text-slate-700 border border-slate-200 cursor-default';
          }

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isDone || !isInteractive || isPending}
              onClick={() => handleTileClick(tile)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center font-black text-2xl sm:text-3xl transition-all duration-300 ${tileStyles}`}
            >
              {isDone ? (
                <>
                  <span className="line-through opacity-50 text-lg">{tile.number}</span>
                  <Check className="w-3.5 h-3.5 mt-0.5 text-slate-400" />
                </>
              ) : (
                <span>{tile.number}</span>
              )}

              {isPending && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-2xs flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

