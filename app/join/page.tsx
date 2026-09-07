'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Play, Users, Plus, X, ArrowRight, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { joinRoom, checkRoomCapacity } from '@/lib/actions';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill code from URL params (e.g. ?code=XJAYVN or ?room=XJAYVN)
  useEffect(() => {
    const paramCode = searchParams.get('code') || searchParams.get('room');
    if (paramCode) {
      const sanitized = paramCode.trim().toUpperCase().slice(0, 6);
      const timer = setTimeout(() => setCode(sanitized), 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const cleanCode = code.trim().toUpperCase();

  // Polled room capacity via SWR (no synchronous setState in effect)
  const { data: capacity } = useSWR(
    cleanCode.length === 6 ? ['room_capacity', cleanCode] : null,
    () => checkRoomCapacity(cleanCode),
    { refreshInterval: 2000 }
  );

  const handleAddMember = () => {
    if (!memberName.trim()) return;
    if (members.length >= 10) return;
    setMembers([...members, memberName.trim()]);
    setMemberName('');
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleKeyDownMember = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMember();
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('Please enter the 6-character room code.');
      return;
    }
    if (!groupName.trim()) {
      setError('Please enter a group / team name.');
      return;
    }

    setLoading(true);
    try {
      const allMembers = memberName.trim()
        ? [...members, memberName.trim()]
        : members;

      const res = await joinRoom(code, groupName, allMembers);

      if (res?.success && res.roomId && res.contestantId) {
        // Persist contestant identification in localStorage for persistence across reloads
        localStorage.setItem(`bluefox_contestant_${res.roomId}`, res.contestantId);
        localStorage.setItem('bluefox_last_contestant_id', res.contestantId);
        localStorage.setItem('bluefox_last_room_id', res.roomId);

        // Navigate to contestant game view
        router.push(`/play/${res.roomId}`);
      } else {
        setError(res?.error || 'Failed to join room');
        setLoading(false);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to join room');
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Live Capacity Banner */}
      {capacity && capacity.exists && (
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            capacity.isFull
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {capacity.isFull ? (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div>
              <span className="font-bold block text-sm text-white">
                {capacity.name}
              </span>
              {capacity.isFull ? (
                <span className="opacity-90">
                  All 8 slots filled. Existing teams can still enter their exact team name to reconnect!
                </span>
              ) : (
                <span className="opacity-90">
                  {8 - (capacity.groupCount || 0)} slots remaining (Max 8 groups)
                </span>
              )}
            </div>
          </div>
          <span className="font-mono font-black text-sm bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 shrink-0">
            {capacity.groupCount} / 8
          </span>
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-5">
        {/* Room Code */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Room Code (6 Characters)
            </label>
            {cleanCode.length === 6 && capacity && !capacity.exists && (
              <span className="text-[11px] font-medium text-rose-400">
                Room not found
              </span>
            )}
          </div>
          <input
            type="text"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. BLUFOX"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-2xl font-black tracking-widest text-center uppercase"
          />
        </div>

        {/* Group Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Group / Team Name
          </label>
          <div className="relative">
            <Users className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Cyber Cell, Team Alpha"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Members List */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Team Members (Optional)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={handleKeyDownMember}
              placeholder="Member name"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddMember}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {members.map((m, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300 border border-zinc-700/60"
                >
                  <span>{m}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(idx)}
                    className="hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !code || !groupName}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Join Quiz Arena</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-2xl mx-auto shadow-xl shadow-blue-600/30 mb-4">
            🦊
          </div>
          <h1 className="text-3xl font-black tracking-tight">Join Quiz Arena</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Enter the 6-character room code given by the quiz host.
          </p>
        </div>

        {/* Join Card wrapped in Suspense for useSearchParams */}
        <Suspense
          fallback={
            <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-zinc-500 mb-2" />
              <p className="text-xs text-zinc-400">Loading join arena...</p>
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
