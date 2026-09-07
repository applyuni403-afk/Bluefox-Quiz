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
      `Kick team "${group.name}" from this quiz session?`
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
    <div className="w-full bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="font-black text-sm uppercase tracking-wider text-white">
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
                    ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              groups.length >= 8
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-zinc-400 bg-white/[0.04]'
            }`}
          >
            {groups.length}/8
          </span>
        </div>
      </div>

      {/* Admin Add Group Button & Form */}
      {isAdmin && roomId && (
        <div className="mb-4">
          {!isAddingGroup ? (
            <button
              type="button"
              disabled={groups.length >= 8}
              onClick={() => setIsAddingGroup(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-dashed border-white/15 text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              <span>{groups.length >= 8 ? '8 Slots Full' : '+ Add Team'}</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateGroup}
              className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  Add Team (#{groups.length + 1})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGroup(false);
                    setAddError('');
                  }}
                  className="text-zinc-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {addError && (
                <div className="text-[11px] font-medium text-rose-300 bg-rose-500/10 p-2 rounded-xl">
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
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60"
              />

              <input
                type="text"
                value={newGroupMembers}
                onChange={(e) => setNewGroupMembers(e.target.value)}
                placeholder="Members (comma-separated, optional)"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingGroup(false)}
                  className="px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup || !newGroupName.trim()}
                  className="px-3.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition disabled:opacity-50"
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
        <div className="p-8 text-center text-zinc-500 bg-white/[0.01] rounded-2xl border border-dashed border-white/[0.06]">
          <Users className="w-7 h-7 mx-auto mb-2 opacity-30" />
          <p className="text-xs font-semibold">No teams registered yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group, index) => {
            const isActive = group.id === activeContestantId;
            const isUpdating = updatingId === group.id;

            return (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank number or medal */}
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                      index === 0
                        ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : index === 1
                        ? 'bg-gradient-to-tr from-zinc-300 to-slate-100 text-zinc-900'
                        : index === 2
                        ? 'bg-gradient-to-tr from-amber-700 to-amber-600 text-amber-100'
                        : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Group details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-white truncate">
                        {group.name}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500 text-white animate-pulse">
                          Turn
                        </span>
                      )}
                    </div>

                    {Array.isArray(group.members) && group.members.length > 0 && (
                      <div className="text-[10px] text-zinc-400 truncate">
                        {group.members.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score and Controls */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 bg-black/40 border border-white/[0.06] rounded-xl p-0.5">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, -5)}
                        title="Deduct 5 points"
                        className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleScoreChange(group.id, 10)}
                        title="Add 10 points"
                        className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {roomId && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRemoveGroup(group)}
                          title="Kick this team"
                          className="p-1 hover:bg-rose-500/20 rounded-lg text-zinc-400 hover:text-rose-400 transition disabled:opacity-40 ml-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-right min-w-[36px]">
                    <span className="font-black text-base text-white">
                      {group.score}
                    </span>
                    <span className="text-[9px] text-zinc-500 block font-bold uppercase tracking-wider">
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
