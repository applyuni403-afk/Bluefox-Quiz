'use client';

import { Contestant } from '@/lib/db/schema';
import { Trophy, Users, Plus, Minus, UserPlus, Trash2, X } from 'lucide-react';
import { adjustScore, adminAddGroup, adminRemoveGroup } from '@/lib/actions';
import { useState } from 'react';

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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const groups = contestants
    .filter((c) => c.kind === 'group')
    .sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder);

  const handleScoreChange = async (contestantId: string, delta: number) => {
    try {
      setUpdatingId(contestantId);
      await adjustScore(contestantId, delta);
      if (onMutate) await onMutate();
    } catch (err) {
      console.error('Failed to adjust score:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveGroup = async (group: Contestant) => {
    if (!roomId) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove group "${group.name}" from the quiz?`
    );
    if (!confirmed) return;

    try {
      setUpdatingId(group.id);
      await adminRemoveGroup(roomId, group.id);
      if (onMutate) await onMutate();
    } catch (err) {
      alert((err as Error).message || 'Failed to remove group');
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
      setAddError('Group name is required');
      return;
    }

    if (groups.length >= 8) {
      setAddError('Room is full (8 groups maximum).');
      return;
    }

    setIsSubmittingGroup(true);
    try {
      const members = newGroupMembers
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      await adminAddGroup(roomId, cleanName, members);
      setNewGroupName('');
      setNewGroupMembers('');
      setIsAddingGroup(false);
      if (onMutate) await onMutate();
    } catch (err) {
      setAddError((err as Error).message || 'Failed to add group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-100">
            Leaderboard
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* 8-slot visual indicators */}
          <div className="flex items-center gap-1" title={`${groups.length} of 8 slots filled`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < groups.length
                    ? 'bg-blue-500 ring-1 ring-blue-400'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              groups.length >= 8
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {groups.length} / 8 Groups
          </span>
        </div>
      </div>

      {/* Admin Add Group Button & Modal */}
      {isAdmin && roomId && (
        <div className="mb-4">
          {!isAddingGroup ? (
            <button
              type="button"
              disabled={groups.length >= 8}
              onClick={() => setIsAddingGroup(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-500" />
              <span>{groups.length >= 8 ? 'All 8 Group Slots Filled' : '+ Add Group Manually'}</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateGroup}
              className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                  Add Team (Slot #{groups.length + 1})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGroup(false);
                    setAddError('');
                  }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {addError && (
                <div className="text-[11px] font-medium text-rose-500 bg-rose-500/10 p-2 rounded-lg">
                  {addError}
                </div>
              )}

              <input
                type="text"
                required
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Team / Group Name (e.g. Phoenix)"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <input
                type="text"
                value={newGroupMembers}
                onChange={(e) => setNewGroupMembers(e.target.value)}
                placeholder="Members (comma-separated, optional)"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingGroup(false)}
                  className="px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup || !newGroupName.trim()}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {isSubmittingGroup ? 'Adding...' : 'Save Group'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="p-6 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Waiting for groups to join...</p>
          <p className="text-xs text-zinc-400 mt-1">Up to 8 groups can register using the room code.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group, index) => {
            const isActive = group.id === activeContestantId;
            const isUpdating = updatingId === group.id;

            return (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500 shadow-md ring-2 ring-blue-500/30 dark:bg-blue-950/40'
                    : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank number or medal */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      index === 0
                        ? 'bg-amber-400 text-amber-950'
                        : index === 1
                        ? 'bg-zinc-300 text-zinc-800'
                        : index === 2
                        ? 'bg-amber-700 text-amber-100'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Group details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-zinc-900 dark:text-zinc-100 truncate">
                        {group.name}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white animate-pulse">
                          Active Turn
                        </span>
                      )}
                    </div>

                    {Array.isArray(group.members) && group.members.length > 0 && (
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {group.members.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score and Host Controls */}
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  {isAdmin && (
                    <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800 rounded-lg p-1">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, -5)}
                        title="Deduct 5 points"
                        className="p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 transition-colors disabled:opacity-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, 10)}
                        title="Add 10 points"
                        className="p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      {roomId && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRemoveGroup(group)}
                          title="Remove / Kick this group"
                          className="p-1 hover:bg-rose-500/20 rounded text-zinc-400 hover:text-rose-400 transition-colors disabled:opacity-50 ml-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-right min-w-[40px]">
                    <span className="font-black text-xl text-zinc-900 dark:text-zinc-50">
                      {group.score}
                    </span>
                    <span className="text-[11px] text-zinc-400 block font-semibold">
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

