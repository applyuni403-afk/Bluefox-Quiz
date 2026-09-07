'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Play, Users, Plus, X, ArrowRight, ShieldAlert, CheckCircle, RefreshCw, ChevronLeft } from 'lucide-react';
import { joinRoom, checkRoomCapacity } from '@/lib/actions';
import { SiteLogo } from '@/components/SiteLogo';

interface RecentRoom {
  roomId: string;
  roomCode?: string;
  groupName: string;
  joinedAt: number;
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Read stored recent rooms
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bluefox_recent_rooms');
      if (stored) {
        const parsed = JSON.parse(stored);
        const timer = setTimeout(() => setRecentRooms(parsed), 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Prefill code from URL params (e.g. ?code=XJAYVN or ?room=XJAYVN or ?roomId=uuid)
  useEffect(() => {
    const paramCode = searchParams.get('code') || searchParams.get('room') || searchParams.get('roomId');
    if (paramCode) {
      const sanitized = paramCode.trim();
      const timer = setTimeout(() => setCode(sanitized), 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const cleanInput = code.trim();

  // Polled room capacity via SWR for both 6-char code and full room ID
  const { data: capacity } = useSWR(
    cleanInput.length >= 4 ? ['room_capacity', cleanInput] : null,
    () => checkRoomCapacity(cleanInput),
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
      setError('Please enter the room code or room ID.');
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
        if (capacity?.code) {
          localStorage.setItem(`bluefox_contestant_${capacity.code}`, res.contestantId);
        }
        if (code.trim()) {
          localStorage.setItem(`bluefox_contestant_${code.trim()}`, res.contestantId);
        }
        localStorage.setItem('bluefox_last_contestant_id', res.contestantId);
        localStorage.setItem('bluefox_last_room_id', res.roomId);

        // Save to recent rooms list
        try {
          const stored = localStorage.getItem('bluefox_recent_rooms');
          let list: RecentRoom[] = stored ? JSON.parse(stored) : [];
          list = list.filter((r) => r.roomId !== res.roomId);
          list.unshift({
            roomId: res.roomId,
            roomCode: capacity?.code || (code.trim().length === 6 ? code.trim().toUpperCase() : undefined),
            groupName: groupName.trim(),
            joinedAt: Date.now(),
          });
          localStorage.setItem('bluefox_recent_rooms', JSON.stringify(list.slice(0, 5)));
        } catch {
          // Ignore storage errors
        }

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

  const handleQuickRejoin = (recent: RecentRoom) => {
    setCode(recent.roomCode || recent.roomId);
    setGroupName(recent.groupName);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(30,58,138,0.06)]">
        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Live Capacity Pill Banner */}
        {capacity && capacity.exists && (
          <div
            className={`mb-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              capacity.isFull
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {capacity.isFull ? (
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <div className="truncate">
                <span className="font-bold text-slate-900 block truncate">{capacity.name}</span>
                <span className="text-[11px] opacity-80 text-slate-600">
                  {capacity.isFull ? '8/8 full &bull; Reconnect only' : `${8 - (capacity.groupCount || 0)} slots open`}
                </span>
              </div>
            </div>
            <span className="font-mono font-black text-xs bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-blue-900 shrink-0 shadow-2xs">
              {capacity.groupCount} / 8
            </span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          {/* Room Code or ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Room Code or Room ID
              </label>
              {cleanInput.length >= 4 && capacity && !capacity.exists && (
                <span className="text-[11px] font-medium text-rose-600">Not found</span>
              )}
            </div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BLUFOX or Room ID"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-base font-bold text-center transition-all shadow-2xs"
            />
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">
              Team Name
            </label>
            <div className="relative">
              <Users className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Alpha Cyber"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Members List */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">
              Members <span className="text-slate-400 normal-case">(optional)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={handleKeyDownMember}
                placeholder="Player name"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddMember}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {members.map((m, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-xs font-medium text-blue-700 border border-blue-200"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="hover:text-rose-500 p-0.5"
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
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Enter Quiz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Rejoin Recent Rooms */}
      {recentRooms.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl border border-blue-100/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2.5">
            Previous Sessions (Click to Rejoin)
          </span>
          <div className="space-y-1.5">
            {recentRooms.map((recent) => (
              <button
                key={recent.roomId}
                type="button"
                onClick={() => handleQuickRejoin(recent)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 text-left transition group shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-xs text-slate-900 block truncate group-hover:text-blue-700">
                    {recent.groupName}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {recent.roomCode ? `CODE: ${recent.roomCode}` : `ID: ${recent.roomId.slice(0, 8)}...`}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition shrink-0">
                  Select
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-blue-500/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-300/30 via-indigo-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Top back shortcut */}
      <div className="w-full max-w-md mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <SiteLogo size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Join Quiz</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Enter 6-digit room code or Room ID to join the live session
          </p>
        </div>

        {/* Join Card wrapped in Suspense for useSearchParams */}
        <Suspense
          fallback={
            <div className="p-8 text-center bg-white/80 backdrop-blur-2xl border border-blue-100 rounded-3xl">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-slate-500">Loading quiz...</p>
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
