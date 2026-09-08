'use client';

import { RapidFireSetItem } from '@/lib/useGameState';
import { Flame, CheckCircle2, Lock, Sparkles, Layers, Clock } from 'lucide-react';
import { useState } from 'react';

interface RapidFireSetSelectorProps {
  sets: RapidFireSetItem[];
  isInteractive: boolean;
  activeTeamName?: string;
  defaultTimelineSeconds?: number;
  onSelectSet: (setName: string) => Promise<void> | void;
}

export function RapidFireSetSelector({
  sets,
  isInteractive,
  activeTeamName,
  defaultTimelineSeconds = 60,
  onSelectSet,
}: RapidFireSetSelectorProps) {
  const [selectingSet, setSelectingSet] = useState<string | null>(null);

  const handleSelect = async (setName: string) => {
    if (!isInteractive || selectingSet) return;
    try {
      setSelectingSet(setName);
      await onSelectSet(setName);
    } catch (err) {
      console.error('Failed to select rapid fire set:', err);
    } finally {
      setSelectingSet(null);
    }
  };

  if (sets.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white/85 backdrop-blur-xl rounded-3xl border border-dashed border-amber-200 shadow-2xs">
        <Flame className="w-8 h-8 mx-auto mb-2 text-amber-500/70" />
        <h4 className="font-bold text-slate-800 text-sm mb-1">No Rapid Fire Sets Available</h4>
        <p className="text-xs text-slate-500">
          The quizmaster will configure Rapid Fire question sets shortly in the Question Bank.
        </p>
      </div>
    );
  }

  const availableSets = sets.filter((s) => !s.isUsed);

  return (
    <div className="w-full bg-white/90 backdrop-blur-2xl border border-amber-200/90 rounded-3xl p-4 sm:p-6 shadow-[0_15px_40px_rgba(245,158,11,0.08)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                Select Your Rapid Fire Set
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                {defaultTimelineSeconds}s Timeline
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {isInteractive
                ? 'Choose an available set to launch your rapid-fire countdown!'
                : activeTeamName
                ? `Waiting for ${activeTeamName} to pick an available set...`
                : 'Each team picks one unique set'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInteractive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-300 shadow-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Choose a Set!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <Layers className="w-3 h-3 text-slate-400" />
              <span>{availableSets.length} / {sets.length} Sets Available</span>
            </span>
          )}
        </div>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {sets.map((set) => {
          const isPending = selectingSet === set.setName;
          const isTaken = set.isUsed;

          return (
            <div
              key={set.setName}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                isTaken
                  ? 'bg-slate-50/80 border-slate-200 opacity-60 text-slate-500'
                  : isInteractive
                  ? 'bg-gradient-to-b from-white to-amber-50/50 border-amber-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Question Set
                  </span>
                  {isTaken ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                      <Lock className="w-3 h-3 text-slate-500" /> Taken
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available
                    </span>
                  )}
                </div>

                <h4 className="font-black text-lg text-slate-900 mb-1 tracking-tight">
                  {set.setName}
                </h4>

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    <strong>{set.questionCount}</strong> Questions
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <strong>{defaultTimelineSeconds}s</strong>
                  </span>
                </div>
              </div>

              {isTaken ? (
                <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 font-medium">
                  {set.usedByTeamName ? (
                    <span>
                      Claimed by <strong className="text-slate-700">{set.usedByTeamName}</strong>
                    </span>
                  ) : (
                    <span>Already Played</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!isInteractive || isPending}
                  onClick={() => handleSelect(set.setName)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
                    isInteractive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 fill-white" />
                      <span>Play {set.setName}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
