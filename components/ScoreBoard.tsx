'use client';

import { Contestant } from '@/lib/db/schema';
import { Trophy, Users, Plus, Minus, UserPlus, Trash2, X } from 'lucide-react';
import { adjustScore, adminAddGroup, adminRemoveGroup } from '@/lib/actions';
import { useState } from 'react';
import { useNotification } from '@/context/NotificationContext';

interface ScoreBoardProps {
  contestants: Contestant[];
  activeContestantId?: string | null;
  isAdmin?: boolean;
  roomId?: string;
  onMutate?: () => Promise<unknown> | void;
}

export function ScoreBoard({
  contestants,
  activeContestantId,
  isAdmin = false,
  roomId,
  onMutate,
}: ScoreBoardProps) {
  const { toast, confirm } = useNotification();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const groups = contestants
    .filter((c) => c.kind === 'group')
    .sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder);

  const handleScoreChange = async (contestantId: string, delta: number) => {
    try {
      setUpdatingId(contestantId);
      await adjustScore(contestantId, delta);
      const target = groups.find((g) => g.id === contestantId);
      toast.success(
        delta > 0 ? `+${delta} Points` : `${delta} Points`,
        target ? target.name : undefined
      );
      if (onMutate) await onMutate();
    } catch (err) {
      toast.error('Failed to adjust score', (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveGroup = async (group: Contestant) => {
    if (!roomId) return;
    const confirmed = await confirm({
      title: `Kick Team "${group.name}"?`,
      message: `This team will be removed from the quiz and their reserved slot will be freed immediately.`,
      confirmText: 'Kick Team',
      cancelText: 'Keep Team',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    try {
      setUpdatingId(group.id);
      await adminRemoveGroup(roomId, group.id);
      toast.success('Team Removed', `"${group.name}" has been kicked from the quiz.`);
      if (onMutate) await onMutate();
    } catch (err) {
      toast.error('Failed to remove team', (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) return;
    setAddError('');

    const cleanName = newGroupName.trim();
    if (!cleanName) {
      setAddError('Team name is required');
      return;
    }

    if (groups.length >= 8) {
      setAddError('Room is full (8 teams maximum).');
      return;
    }

    setIsSubmittingGroup(true);
    try {
      await adminAddGroup(roomId, cleanName);
      toast.success('Team Registered', `"${cleanName}" joined the quiz.`);
      setNewGroupName('');
      setIsAddingGroup(false);
      if (onMutate) await onMutate();
    } catch (err) {
      const msg = (err as Error).message || 'Failed to add team';
      setAddError(msg);
      toast.error('Registration Failed', msg);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  return (
    <div className="w-full h-full max-h-full flex flex-col bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(30,58,138,0.06)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">
            Leaderboard
          </h3>
        </div>
        <div className="flex items-center gap-2.5">
          {/* 8-Slot Live Indicator Dots */}
          <div className="flex items-center gap-1" title={`${groups.length} of 8 slots filled`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < groups.length
                    ? 'bg-blue-600 shadow-xs'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              groups.length >= 8
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'text-slate-600 bg-slate-100 border border-slate-200'
            }`}
          >
            {groups.length}/8
          </span>
        </div>
      </div>

      {/* Admin Add Group Button & Form */}
      {isAdmin && roomId && (
        <div className="shrink-0 mb-3">
          {!isAddingGroup ? (
            <button
              type="button"
              disabled={groups.length >= 8}
              onClick={() => setIsAddingGroup(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border border-dashed border-blue-200 text-xs font-bold text-blue-700 hover:text-blue-800 hover:bg-blue-50/70 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>{groups.length >= 8 ? '8 Slots Full' : '+ Add Team'}</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateGroup}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                  Add Team (#{groups.length + 1})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGroup(false);
                    setAddError('');
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {addError && (
                <div className="text-[11px] font-medium text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
                  {addError}
                </div>
              )}

              <input
                type="text"
                required
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Team Name"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingGroup(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup || !newGroupName.trim()}
                  className="px-3.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
                >
                  {isSubmittingGroup ? 'Adding...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Users className="w-7 h-7 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="text-xs font-semibold">No teams registered yet</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {groups.map((group, index) => {
            const isActive =
              group.id === activeContestantId ||
              contestants.some(
                (c) => c.id === activeContestantId && c.parentGroupId === group.id
              );
            const isUpdating = updatingId === group.id;

            return (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-blue-50/80 border-blue-400 shadow-xs ring-1 ring-blue-300'
                    : 'bg-slate-50/70 border-slate-200/80 hover:border-blue-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank number or medal */}
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                      index === 0
                        ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 shadow-xs'
                        : index === 1
                        ? 'bg-gradient-to-tr from-slate-300 to-slate-200 text-slate-800'
                        : index === 2
                        ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Group details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {group.name}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white animate-pulse">
                          Turn
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score and Controls */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, -5)}
                        title="Deduct 5 points"
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, 10)}
                        title="Add 10 points"
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {roomId && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRemoveGroup(group)}
                          title="Kick this team"
                          className="p-1 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition disabled:opacity-40 ml-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-right min-w-[36px]">
                    <span className="font-black text-base text-slate-900">
                      {group.score}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                      PTS
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
