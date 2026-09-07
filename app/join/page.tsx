'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Play, Users, Plus, X, ArrowRight, ShieldAlert, CheckCircle, RefreshCw, ChevronLeft } from 'lucide-react';
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

  // Polled room capacity via SWR
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
        localStorage.setItem(`bluefox_contestant_${res.roomId}`, res.contestantId);
        localStorage.setItem('bluefox_last_contestant_id', res.contestantId);
        localStorage.setItem('bluefox_last_room_id', res.roomId);

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
    <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Live Capacity Pill Banner */}
      {capacity && capacity.exists && (
        <div
          className={`mb-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            capacity.isFull
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {capacity.isFull ? (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div className="truncate">
              <span className="font-bold text-white block truncate">{capacity.name}</span>
              <span className="text-[11px] opacity-80">
                {capacity.isFull ? '8/8 full &bull; Reconnect only' : `${8 - (capacity.groupCount || 0)} slots open`}
              </span>
            </div>
          </div>
          <span className="font-mono font-black text-xs bg-black/40 px-2.5 py-1 rounded-lg border border-white/[0.08] shrink-0">
            {capacity.groupCount} / 8
          </span>
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-4">
        {/* Room Code */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              Room Code
            </label>
            {cleanCode.length === 6 && capacity && !capacity.exists && (
              <span className="text-[11px] font-medium text-rose-400">Not found</span>
            )}
          </div>
          <input
            type="text"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BLUFOX"
            className="w-full bg-black/40 border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 font-mono text-2xl font-black tracking-widest text-center uppercase transition-all"
          />
        </div>

        {/* Group Name */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1.5">
            Team Name
          </label>
          <div className="relative">
            <Users className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Alpha Cyber"
              className="w-full bg-black/40 border border-white/[0.08] rounded-2xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
            />
          </div>
        </div>

        {/* Members List */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1.5">
            Members <span className="text-zinc-500 normal-case">(optional)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={handleKeyDownMember}
              placeholder="Player name"
              className="flex-1 bg-black/40 border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
            />
            <button
              type="button"
              onClick={handleAddMember}
              className="px-3.5 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {members.map((m, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.05] text-xs text-zinc-300 border border-white/[0.06]"
                >
                  <span>{m}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(idx)}
                    className="hover:text-rose-400 p-0.5"
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
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.99] disabled:opacity-40"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Enter Quiz Arena</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Top back shortcut */}
      <div className="w-full max-w-md mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-600 to-slate-900 p-[1px] shadow-2xl shadow-blue-500/20 mx-auto mb-4">
            <div className="w-full h-full bg-[#0b0e14] rounded-[23px] flex items-center justify-center text-3xl">
              🦊
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Join Quiz Arena</h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Enter 6-digit room code to join the live session
          </p>
        </div>

        {/* Join Card wrapped in Suspense for useSearchParams */}
        <Suspense
          fallback={
            <div className="p-8 text-center bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-zinc-500 mb-2" />
              <p className="text-xs text-zinc-400">Loading arena...</p>
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
