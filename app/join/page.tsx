'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Play, Users, ArrowRight, ShieldAlert, CheckCircle, RefreshCw, ChevronLeft, LogOut } from 'lucide-react';
import { joinRoom, checkRoomCapacity, logoutContestant } from '@/lib/actions';
import { SiteLogo } from '@/components/SiteLogo';
import { useNotification } from '@/context/NotificationContext';

interface RecentRoom {
  roomId: string;
  roomCode?: string;
  groupName: string;
  joinedAt: number;
}

function getStoredSession(key: string) {
  try {
    const rawLocal = localStorage.getItem(`bluefox_contestant_${key}`);
    const tokenLocal = localStorage.getItem(`bluefox_claim_token_${key}`);
    const nameLocal = localStorage.getItem(`bluefox_team_name_${key}`);

    const match = document.cookie.match(new RegExp(`(?:^|; )bluefox_team_${key}=([^;]*)`));
    let cookieData: { id?: string; token?: string; name?: string } = {};
    if (match && match[1]) {
      try {
        cookieData = JSON.parse(decodeURIComponent(match[1]));
      } catch {
        // ignore
      }
    }

    const contestantId = rawLocal || cookieData.id || null;
    const claimToken = tokenLocal || cookieData.token || null;
    const teamName = nameLocal || cookieData.name || null;

    if (contestantId && claimToken) {
      return { contestantId, claimToken, teamName };
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredSession(
  roomId: string,
  code: string | undefined,
  contestantId: string,
  claimToken: string,
  teamName: string
) {
  try {
    const keys = Array.from(new Set([roomId, code].filter(Boolean))) as string[];
    keys.forEach((k) => {
      localStorage.setItem(`bluefox_contestant_${k}`, contestantId);
      localStorage.setItem(`bluefox_claim_token_${k}`, claimToken);
      localStorage.setItem(`bluefox_team_name_${k}`, teamName);
      document.cookie = `bluefox_team_${k}=${encodeURIComponent(
        JSON.stringify({ id: contestantId, token: claimToken, name: teamName })
      )}; path=/; max-age=604800; SameSite=Lax`;
    });
    localStorage.setItem('bluefox_last_contestant_id', contestantId);
    localStorage.setItem('bluefox_last_claim_token', claimToken);
    localStorage.setItem('bluefox_last_room_id', roomId);
  } catch {
    // ignore
  }
}

function clearStoredSession(roomId: string, code?: string) {
  try {
    const keys = Array.from(
      new Set([roomId, code, localStorage.getItem('bluefox_last_room_id')].filter(Boolean))
    ) as string[];
    keys.forEach((k) => {
      localStorage.removeItem(`bluefox_contestant_${k}`);
      localStorage.removeItem(`bluefox_claim_token_${k}`);
      localStorage.removeItem(`bluefox_team_name_${k}`);
      document.cookie = `bluefox_team_${k}=; path=/; max-age=0; SameSite=Lax`;
    });
    localStorage.removeItem('bluefox_last_contestant_id');
    localStorage.removeItem('bluefox_last_claim_token');
  } catch {
    // ignore
  }
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, confirm } = useNotification();

  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
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

  // Check if current device already has a claimed session in this room
  const activeSessionKey = capacity?.roomId || (cleanInput.length >= 4 ? cleanInput : null);
  const activeSession = activeSessionKey ? getStoredSession(activeSessionKey) : null;

  const handleSwitchOrLogout = async () => {
    if (!activeSession || !activeSessionKey) return;
    const confirmed = await confirm({
      title: `Log Out Team "${activeSession.teamName || 'Current Team'}"?`,
      message: 'This will release your team session so another device or a different team can be chosen.',
      confirmText: 'Log Out',
      cancelText: 'Stay Connected',
      variant: 'warning',
      icon: 'logout',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      await logoutContestant(
        capacity?.roomId || activeSessionKey,
        activeSession.contestantId,
        activeSession.claimToken
      );
      clearStoredSession(capacity?.roomId || activeSessionKey, capacity?.code);
      setGroupName('');
      toast.info('Logged Out', 'Team session released. You can now select or enter a team.');
    } catch (err) {
      toast.error('Logout Failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      const msg = 'Please enter the room code or room ID.';
      setError(msg);
      toast.warning('Input Required', msg);
      return;
    }
    if (!groupName.trim()) {
      const msg = 'Please enter a team name.';
      setError(msg);
      toast.warning('Input Required', msg);
      return;
    }

    // If already claimed as another team in the same room, require explicit logout confirmation
    if (
      activeSession &&
      activeSession.teamName &&
      activeSession.teamName.toLowerCase() !== groupName.trim().toLowerCase()
    ) {
      const switchConfirmed = await confirm({
        title: 'Switch Team Session?',
        message: `You are currently connected as "${activeSession.teamName}". Would you like to log out from "${activeSession.teamName}" and join as "${groupName.trim()}"?`,
        confirmText: 'Switch Team',
        cancelText: 'Cancel',
        variant: 'warning',
        icon: 'logout',
      });
      if (!switchConfirmed) return;

      await logoutContestant(
        capacity?.roomId || activeSessionKey || code.trim(),
        activeSession.contestantId,
        activeSession.claimToken
      );
      clearStoredSession(capacity?.roomId || activeSessionKey || code.trim(), capacity?.code);
    }

    setLoading(true);
    try {
      const currentToken = activeSession?.claimToken || getStoredSession(code.trim())?.claimToken;
      const res = await joinRoom(code, groupName, [], currentToken);

      if (res?.success && res.roomId && res.contestantId && res.claimToken) {
        saveStoredSession(
          res.roomId,
          capacity?.code || (code.trim().length === 6 ? code.trim().toUpperCase() : undefined),
          res.contestantId,
          res.claimToken,
          res.groupName || groupName.trim()
        );

        // Save to recent rooms list
        try {
          const stored = localStorage.getItem('bluefox_recent_rooms');
          let list: RecentRoom[] = stored ? JSON.parse(stored) : [];
          list = list.filter((r) => r.roomId !== res.roomId);
          list.unshift({
            roomId: res.roomId,
            roomCode: capacity?.code || (code.trim().length === 6 ? code.trim().toUpperCase() : undefined),
            groupName: res.groupName || groupName.trim(),
            joinedAt: Date.now(),
          });
          localStorage.setItem('bluefox_recent_rooms', JSON.stringify(list.slice(0, 5)));
        } catch {
          // Ignore storage errors
        }

        if (res.reconnected) {
          toast.success('Reconnected', `Welcome back, ${res.groupName || groupName}!`);
        } else {
          toast.success('Team Joined', `Welcome, "${res.groupName || groupName}"!`);
        }

        router.push(`/play/${res.roomId}`);
      } else {
        const msg = res?.error || 'Failed to join room';
        setError(msg);
        toast.error('Unable to Join', msg);
        setLoading(false);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to join room';
      setError(msg);
      toast.error('Join Error', msg);
      setLoading(false);
    }
  };

  const handleQuickRejoin = (recent: RecentRoom) => {
    setCode(recent.roomCode || recent.roomId);
    setGroupName(recent.groupName);
    setIsCustomName(false);
    toast.info('Room Selected', `Prefilled team "${recent.groupName}".`);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-5 sm:p-6 shadow-[0_15px_40px_rgba(30,58,138,0.06)]">
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Live Capacity Pill Banner */}
        {capacity && capacity.exists && (
          <div
            className={`mb-4 p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
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
                  {capacity.isFull
                    ? 'Room full &bull; Reconnect only'
                    : capacity.maxGroups
                    ? `${capacity.maxGroups - (capacity.groupCount || 0)} slots open`
                    : 'Open for teams &bull; Expandable roster'}
                </span>
              </div>
            </div>
            <span className="font-mono font-black text-xs bg-white px-2 py-0.5 rounded-lg border border-blue-200 text-blue-900 shrink-0 shadow-2xs">
              {capacity.groupCount} {capacity.maxGroups ? `/ ${capacity.maxGroups}` : 'Teams'}
            </span>
          </div>
        )}

        {/* Active Session Notification Card */}
        {activeSession && activeSession.teamName && capacity?.roomId && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                  Active Team Session
                </span>
                <p className="text-xs sm:text-sm font-black text-slate-900">
                  Connected as: <span className="text-blue-700">{activeSession.teamName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSwitchOrLogout}
                disabled={loading}
                title="Log out from this team session"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 border border-blue-200 hover:border-rose-200 text-xs font-bold text-slate-700 hover:text-rose-600 transition shadow-2xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/play/${capacity.roomId}`)}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Resume Quiz as {activeSession.teamName}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-3.5">
          {/* Room Code or ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Room Code or Room ID
              </label>
              {cleanInput.length >= 4 && capacity && !capacity.exists && (
                <span className="text-[10px] font-medium text-rose-600">Not found</span>
              )}
            </div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BLUFOX or Room ID"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-sm font-bold text-center transition-all shadow-2xs"
            />
          </div>

          {/* Team Selection: Dropdown of Registered Teams or Custom Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {capacity?.registeredTeams && capacity.registeredTeams.length > 0 && !isCustomName
                  ? 'Select Registered Team'
                  : 'Team Name'}
              </label>

              {capacity?.registeredTeams && capacity.registeredTeams.length > 0 && (
                <div>
                  {isCustomName ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomName(false);
                        if (capacity.registeredTeams?.[0]) {
                          setGroupName(capacity.registeredTeams[0].name);
                        }
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                    >
                      &larr; Choose from registered teams
                    </button>
                  ) : !capacity.isFull ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomName(true);
                        setGroupName('');
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                    >
                      + Register a new team
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {capacity?.registeredTeams && capacity.registeredTeams.length > 0 && !isCustomName ? (
              <div className="space-y-2">
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                  <select
                    required
                    value={groupName}
                    onChange={(e) => {
                      if (e.target.value === '__custom_new__') {
                        setIsCustomName(true);
                        setGroupName('');
                      } else {
                        setGroupName(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-blue-200 rounded-2xl pl-10 pr-9 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm font-bold transition-all shadow-2xs appearance-none cursor-pointer"
                  >
                    <option value="">
                      -- Choose Registered Team ({capacity.registeredTeams.length} available) --
                    </option>
                    {capacity.registeredTeams.map((team) => (
                      <option key={team.id} value={team.name}>
                        {team.name} ({team.score} PTS)
                      </option>
                    ))}
                    {!capacity.isFull && (
                      <option value="__custom_new__">+ Register a New Team...</option>
                    )}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>

                {/* Quick-Pick Team Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-0.5">
                    Quick Pick:
                  </span>
                  {capacity.registeredTeams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        setIsCustomName(false);
                        setGroupName(team.name);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        groupName === team.name
                          ? 'bg-blue-600 text-white shadow-xs scale-105'
                          : 'bg-slate-100 hover:bg-blue-50 text-slate-700 border border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Alpha Cyber"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm font-medium transition-all shadow-2xs"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !code || !groupName}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>
                  {capacity?.registeredTeams?.some((t) => t.name === groupName)
                    ? `Rejoin as "${groupName}"`
                    : 'Enter Quiz'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Rejoin Recent Rooms */}
      {recentRooms.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl border border-blue-100/80 rounded-2xl p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2">
            Previous Sessions (Click to Rejoin)
          </span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {recentRooms.map((recent) => (
              <button
                key={recent.roomId}
                type="button"
                onClick={() => handleQuickRejoin(recent)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-white hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 text-left transition group shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-xs text-slate-900 block truncate group-hover:text-blue-700">
                    {recent.groupName}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {recent.roomCode ? `CODE: ${recent.roomCode}` : `ID: ${recent.roomId.slice(0, 8)}...`}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition shrink-0">
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
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 flex flex-col justify-between items-center p-3 sm:p-5 relative selection:bg-blue-500/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-300/30 via-indigo-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Top back shortcut */}
      <div className="w-full max-w-md shrink-0 z-10 pt-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md z-10 flex-1 min-h-0 flex flex-col justify-center my-auto overflow-y-auto pr-1">
        {/* Header */}
        <div className="text-center mb-3 sm:mb-4 shrink-0">
          <SiteLogo size="md" className="mx-auto mb-2" />
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Join Quiz</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
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

      <footer className="text-center text-[10px] uppercase tracking-wider text-slate-400 py-1 shrink-0">
        Bluefox Quiz &bull; Live Tournament
      </footer>
    </div>
  );
}
