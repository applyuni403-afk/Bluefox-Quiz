'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameState } from '@/lib/useGameState';
import { useTimer } from '@/lib/useTimer';
import { Timer } from '@/components/Timer';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreBoard } from '@/components/ScoreBoard';
import { RapidFireBoard } from '@/components/RapidFireBoard';
import { SoundPlayer } from '@/components/SoundPlayer';
import { SiteLogo } from '@/components/SiteLogo';
import {
  Users,
  SkipForward,
  Sparkles,
  Radio,
  Clock,
  Crown,
  UserX,
} from 'lucide-react';

export default function PlayRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { room, contestants, question, board, error, isLoading, mutate } =
    useGameState(roomId);

  const [myContestantId, setMyContestantId] = useState<string | null>(null);
  const [passing, setPassing] = useState(false);
  const [passError, setPassError] = useState('');

  // Read stored contestant id from localStorage
  useEffect(() => {
    const stored =
      localStorage.getItem(`bluefox_contestant_${roomId}`) ||
      localStorage.getItem('bluefox_last_contestant_id');
    if (stored) {
      const timer = setTimeout(() => setMyContestantId(stored), 0);
      return () => clearTimeout(timer);
    }
  }, [roomId]);

  const activeContestant = contestants.find((c) => c.id === room?.activeContestantId);
  const myContestant = contestants.find((c) => c.id === myContestantId);
  const isMyTurn = Boolean(
    myContestantId && room?.activeContestantId && myContestantId === room.activeContestantId
  );

  // Check if this player was kicked by host
  const wasKicked = Boolean(myContestantId && contestants.length > 0 && !myContestant);

  const { isRunning: isTimerRunning } = useTimer(room?.timerEndsAt);

  // Contestant PASS action
  const handlePass = async () => {
    if (!isMyTurn || !isTimerRunning || passing) return;
    setPassing(true);
    setPassError('');

    try {
      const res = await fetch('/api/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          contestantId: myContestantId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to pass question');
      }

      mutate();
    } catch (err) {
      setPassError((err as Error).message);
    } finally {
      setPassing(false);
    }
  };

  // Rapid fire tile select
  const handleSelectTile = async (questionId: string) => {
    try {
      const res = await fetch('/api/rapid-fire/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          questionId,
          contestantId: myContestantId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to select question');
      }
      mutate();
    } catch (err) {
      console.error('Rapid fire error:', err);
    }
  };

  if (isLoading && !room) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-zinc-400">Connecting to arena...</p>
      </div>
    );
  }

  if (wasKicked) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <UserX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white mb-1.5">Team Removed</h2>
          <p className="text-xs text-zinc-400 mb-6">
            Your group has been removed from this quiz session by the host.
          </p>
          <Link
            href="/join"
            onClick={() => {
              localStorage.removeItem(`bluefox_contestant_${roomId}`);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition active:scale-95"
          >
            <span>Join Another Room</span>
          </Link>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl">
          <h2 className="text-lg font-bold text-rose-400 mb-2">Room Unavailable</h2>
          <p className="text-xs text-zinc-400 mb-4">
            {error ? String(error) : 'This quiz room is no longer active.'}
          </p>
          <Link
            href="/join"
            className="inline-block px-5 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-white transition"
          >
            Return to Join
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LOBBY VIEW
  // -------------------------------------------------------------
  if (room.status === 'lobby') {
    return (
      <div className="min-h-screen bg-[#07090e] text-zinc-100 p-6 sm:p-10 flex flex-col items-center justify-between relative overflow-hidden selection:bg-indigo-500/30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-600/10 to-transparent blur-[140px] pointer-events-none" />

        {/* Header */}
        <div className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-white/[0.06] z-10">
          <div className="flex items-center gap-3">
            <SiteLogo size="md" />
            <div>
              <h1 className="font-black text-xl tracking-tight text-white">{room.name}</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Radio className="w-3 h-3 animate-pulse" /> Lobby &bull; Waiting for Host
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-2xl text-right">
            <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-[0.15em]">
              Room Code
            </span>
            <span className="font-mono text-xl font-black text-blue-400 tracking-wider">
              {room.code}
            </span>
          </div>
        </div>

        {/* Lobby Grid */}
        <div className="w-full max-w-4xl my-10 z-10">
          {(() => {
            const groups = contestants.filter((c) => c.kind === 'group');
            const isFull = groups.length >= 8;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold flex items-center gap-2 text-white">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Teams Registered ({groups.length}/8)</span>
                    </h2>
                    {isFull && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Full (8/8)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">
                    {isFull
                      ? 'All 8 slots filled &bull; Host will start shortly'
                      : `${8 - groups.length} slots remaining`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {groups.map((group) => {
                    const isMe = group.id === myContestantId;
                    return (
                      <div
                        key={group.id}
                        className={`p-5 rounded-3xl border transition-all ${
                          isMe
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
                            : 'bg-white/[0.03] backdrop-blur-xl border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-black text-zinc-300">
                            #{group.joinOrder}
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500 text-white">
                              Your Team
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-base text-white truncate mb-1">
                          {group.name}
                        </h3>
                        {Array.isArray(group.members) && group.members.length > 0 ? (
                          <p className="text-[11px] text-zinc-400 line-clamp-2">
                            {group.members.join(', ')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic">Ready</p>
                        )}
                      </div>
                    );
                  })}

                  {Array.from({ length: Math.max(0, 8 - groups.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="p-5 rounded-3xl border border-dashed border-white/[0.06] bg-white/[0.01] flex flex-col items-center justify-center text-center min-h-[130px]"
                    >
                      <Users className="w-5 h-5 text-zinc-700 mb-2" />
                      <span className="text-xs font-semibold text-zinc-500 block">
                        Slot #{groups.length + i + 1}
                      </span>
                      <span className="text-[10px] text-zinc-600">Waiting for team...</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] font-medium text-zinc-500 z-10 uppercase tracking-wider">
          Bluefox Quiz Arena &bull; Realtime Synchronized
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FINISHED VIEW
  // -------------------------------------------------------------
  if (room.status === 'finished') {
    const sorted = [...contestants]
      .filter((c) => c.kind === 'group')
      .sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    return (
      <div className="min-h-screen bg-[#07090e] text-zinc-100 p-6 sm:p-12 flex flex-col items-center justify-center relative overflow-hidden selection:bg-indigo-500/30">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[160px] pointer-events-none" />

        <SoundPlayer lastResult="correct" />

        <div className="max-w-xl w-full text-center z-10">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-amber-950 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(245,158,11,0.4)]">
            <Crown className="w-10 h-10" />
          </div>

          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2 block">
            Tournament Champion
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 text-white">
            {winner?.name || 'Quiz Concluded'}
          </h1>
          <p className="text-zinc-400 mb-8 text-sm font-medium">
            Final Score: <strong className="text-white font-black">{winner?.score || 0} PTS</strong>
          </p>

          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-5 mb-6 shadow-2xl">
            <ScoreBoard contestants={contestants} activeContestantId={null} />
          </div>

          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition active:scale-95 shadow-lg"
          >
            Return to Arena Home
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYING VIEW
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-between selection:bg-indigo-500/30">
      <SoundPlayer lastResult={room.lastResult} />

      {/* Arena Top Bar */}
      <header className="border-b border-white/[0.06] px-4 sm:px-8 py-3.5 bg-[#07090e]/90 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SiteLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-white truncate max-w-xs">{room.name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/[0.05] text-zinc-400 border border-white/[0.06]">
                  {room.roundType === 'rapid_fire' ? 'Rapid Fire' : 'Normal'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono font-semibold">
                CODE: {room.code}
              </span>
            </div>
          </div>

          {/* Active Turn Badge */}
          <div
            className={`px-4 py-2 rounded-2xl border flex items-center gap-2.5 transition-all ${
              isMyTurn
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse'
                : 'bg-white/[0.03] border-white/[0.06] text-zinc-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-current shrink-0" />
            <div>
              <span className="text-[9px] uppercase font-black tracking-[0.15em] opacity-80 block">
                {isMyTurn ? "IT'S YOUR TURN!" : 'Active Turn'}
              </span>
              <span className="font-bold text-xs sm:text-sm">
                {activeContestant?.name || 'Awaiting question...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Broadcast Stage */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Question Stage & Pass Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Synchronized Timer Card */}
          <div className="flex items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Round Timer</span>
            </div>
            <Timer endsAt={room.timerEndsAt} size="md" />
          </div>

          {/* Question Stage */}
          {room.roundType === 'normal' && (
            <div>
              {question ? (
                <QuestionCard question={question} showAnswer={false} />
              ) : (
                <div className="p-12 text-center bg-white/[0.02] border border-dashed border-white/[0.08] rounded-3xl text-zinc-400">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-blue-400 opacity-60 animate-pulse" />
                  <h3 className="text-base font-bold text-white mb-1">
                    Ready for Next Question
                  </h3>
                  <p className="text-xs text-zinc-500">
                    The quizmaster will launch the next question shortly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rapid Fire Mode */}
          {room.roundType === 'rapid_fire' && (
            <div className="space-y-5">
              {question && <QuestionCard question={question} showAnswer={false} />}
              <RapidFireBoard
                board={board}
                activeQuestionId={question?.id}
                isInteractive={isMyTurn}
                onSelectTile={handleSelectTile}
              />
            </div>
          )}

          {/* Pass Action Button */}
          {isMyTurn && isTimerRunning && room.roundType === 'normal' && (
            <div className="p-5 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-amber-600/10 border border-blue-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-white">Unsure of the answer?</h4>
                <p className="text-[11px] text-zinc-400">Pass turn to the next group in rotation.</p>
                {passError && <p className="text-xs text-rose-400 font-bold mt-1">{passError}</p>}
              </div>

              <button
                type="button"
                disabled={passing}
                onClick={handlePass}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                {passing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <SkipForward className="w-4 h-4 fill-white" />
                    <span>PASS TURN</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Scoreboard */}
        <div className="lg:col-span-1 space-y-6">
          <ScoreBoard
            contestants={contestants}
            activeContestantId={room.activeContestantId}
            isAdmin={false}
          />
        </div>
      </main>

      <footer className="border-t border-white/[0.04] px-6 py-4 text-center text-[10px] uppercase tracking-wider text-zinc-500">
        Bluefox Arena &bull; Continuous Live Sync
      </footer>
    </div>
  );
}
