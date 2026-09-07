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
      <div className="p-8 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
        <Flame className="w-10 h-10 mx-auto mb-2 text-amber-500 opacity-60" />
        <h4 className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">
          No Rapid Fire Questions Yet
        </h4>
        <p className="text-sm">
          Add rapid-fire questions in the Question Editor to populate the numbered board.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
              Rapid Fire Board
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Pick an available number to reveal the question
            </p>
          </div>
        </div>

        {isInteractive ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Your Pick!
          </span>
        ) : (
          <span className="text-xs font-semibold text-zinc-400">
            {board.filter((b) => b.status === 'unused').length} / {board.length} Available
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
              'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 scale-105 ring-4 ring-amber-400/50';
          } else if (isDone) {
            tileStyles =
              'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-60';
          } else {
            // Unused
            tileStyles = isInteractive
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:scale-105 hover:shadow-xl hover:shadow-blue-600/25 active:scale-95 cursor-pointer'
              : 'bg-blue-600 text-white opacity-90 cursor-default';
          }

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isDone || !isInteractive || isPending}
              onClick={() => handleTileClick(tile)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center font-black text-2xl sm:text-3xl transition-all duration-200 ${tileStyles}`}
            >
              {isDone ? (
                <>
                  <span className="line-through opacity-50">{tile.number}</span>
                  <Check className="w-4 h-4 mt-1 text-zinc-400" />
                </>
              ) : (
                <span>{tile.number}</span>
              )}

              {isPending && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
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
