'use client';

import { NormalRoundTile } from '@/lib/useGameState';
import { Sparkles, Check, Hash, Lock } from 'lucide-react';
import { useState } from 'react';

interface NormalRoundBoardProps {
  board: NormalRoundTile[];
  roundName?: string | null;
  activeQuestionId?: string | null;
  isInteractive: boolean;
  activeTeamName?: string;
  onSelectNumber: (questionId: string) => Promise<void> | void;
}

export function NormalRoundBoard({
  board,
  roundName,
  activeQuestionId,
  isInteractive,
  activeTeamName,
  onSelectNumber,
}: NormalRoundBoardProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const handleTileClick = async (tile: NormalRoundTile) => {
    if (!isInteractive || tile.status === 'done' || selectingId) return;

    try {
      setSelectingId(tile.id);
      await onSelectNumber(tile.id);
    } catch (err) {
      console.error('Failed to select normal round question:', err);
    } finally {
      setSelectingId(null);
    }
  };

  if (board.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white/85 backdrop-blur-xl rounded-3xl border border-dashed border-blue-200 shadow-2xs">
        <Hash className="w-8 h-8 mx-auto mb-2 text-blue-500/70" />
        <h4 className="font-bold text-slate-800 text-sm mb-1">
          {roundName ? `"${roundName}" Questions` : 'Normal Round Questions'}
        </h4>
        <p className="text-xs text-slate-500">
          No questions added to this round yet. The quizmaster will launch questions shortly.
        </p>
      </div>
    );
  }

  const unusedCount = board.filter((b) => b.status === 'unused').length;

  return (
    <div className="w-full bg-white/90 backdrop-blur-2xl border border-blue-100 rounded-3xl p-4 sm:p-6 shadow-[0_15px_40px_rgba(30,58,138,0.06)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                {roundName || 'Choose Question Number'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                Normal Round
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {isInteractive
                ? 'Your team gets to pick the next question number!'
                : activeTeamName
                ? `Waiting for ${activeTeamName} to choose a number...`
                : 'Select a number to begin'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInteractive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-300 shadow-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Choose a Number!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>{unusedCount} / {board.length} Remaining</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid of Numbered Tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {board.map((tile) => {
          const isDone = tile.status === 'done';
          const isActive = tile.id === activeQuestionId || tile.status === 'active';
          const isPending = selectingId === tile.id;

          let tileStyles = '';
          if (isActive) {
            tileStyles =
              'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/30 scale-105 ring-2 ring-blue-400 border border-blue-300';
          } else if (isDone) {
            tileStyles =
              'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60';
          } else {
            // Unused
            tileStyles = isInteractive
              ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/40 active:scale-95 cursor-pointer shadow-xs'
              : 'bg-white text-slate-800 border border-blue-100 hover:border-blue-200 shadow-2xs cursor-default';
          }

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isDone || !isInteractive || isPending}
              onClick={() => handleTileClick(tile)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center font-black transition-all duration-200 ${tileStyles}`}
            >
              {isDone ? (
                <>
                  <span className="line-through text-lg opacity-40">#{tile.number}</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl tracking-tight">#{tile.number}</span>
                  {tile.points && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-1.5 py-0.2 rounded-full ${
                        isInteractive || isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}
                    >
                      {tile.points} PTS
                    </span>
                  )}
                </>
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
