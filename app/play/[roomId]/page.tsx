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
import {
  Users,
  SkipForward,
  Sparkles,
  Radio,
  Clock,
  Crown,
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
  const isMyTurn = Boolean(
    myContestantId && room?.activeContestantId && myContestantId === room.activeContestantId
  );

  // Timer running check derived purely from hook
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

      // Revalidate local game state immediately
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
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Connecting to Bluefox Quiz Room...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-6 max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl">
          <h2 className="text-xl font-bold text-rose-400 mb-2">Room Unavailable</h2>
          <p className="text-sm text-zinc-400 mb-4">
            {error ? String(error) : 'This quiz room could not be found.'}
          </p>
          <a
            href="/join"
            className="inline-block px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition"
          >
            Return to Join Screen
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LOBBY VIEW
  // -------------------------------------------------------------
  if (room.status === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white p-6 sm:p-10 flex flex-col items-center justify-between">
        {/* Header */}
        <div className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦊</span>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tight">{room.name}</h1>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Lobby &bull; Waiting for Host
              </span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-2xl text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-widest">
              Room Code
            </span>
            <span className="font-mono text-2xl font-black text-blue-400 tracking-wider">
              {room.code}
            </span>
          </div>
        </div>

        {/* Lobby Grid */}
        <div className="w-full max-w-4xl my-10">
          {(() => {
            const groups = contestants.filter((c) => c.kind === 'group');
            const isFull = groups.length >= 8;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      <span>Registered Groups ({groups.length} / 8)</span>
                    </h2>
                    {isFull && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Lobby Full (8/8)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {isFull
                      ? 'Maximum 8 groups joined. Waiting for host to start the game.'
                      : `${8 - groups.length} group slots remaining &bull; Host will start shortly`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {groups.map((group) => {
                    const isMe = group.id === myContestantId;
                    return (
                      <div
                        key={group.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isMe
                            ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                            : 'bg-zinc-900/80 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-300">
                            Slot #{group.joinOrder}
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-600 text-white">
                              Your Group
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-lg text-white truncate mb-1">
                          {group.name}
                        </h3>
                        {Array.isArray(group.members) && group.members.length > 0 ? (
                          <p className="text-xs text-zinc-400 line-clamp-2">
                            {group.members.join(', ')}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500 italic">No members listed</p>
                        )}
                      </div>
                    );
                  })}

                  {Array.from({ length: Math.max(0, 8 - groups.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="p-5 rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 flex flex-col items-center justify-center text-center min-h-[130px]"
                    >
                      <Users className="w-6 h-6 text-zinc-700 mb-2" />
                      <span className="text-xs font-semibold text-zinc-500 block mb-0.5">
                        Slot #{groups.length + i + 1} Available
                      </span>
                      <span className="text-[11px] text-zinc-600">
                        Waiting for team...
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-500">
          Bluefox Quiz &bull; Screens stay in continuous real-time sync with host actions
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
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white p-6 sm:p-12 flex flex-col items-center justify-center">
        <SoundPlayer lastResult="correct" />

        <div className="max-w-2xl w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-amber-950 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-400/30">
            <Crown className="w-10 h-10" />
          </div>

          <span className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2 block">
            Quiz Completed &bull; Final Standings
          </span>
          <h1 className="text-4xl sm:text-6xl font-black mb-4">
            Congratulations {winner?.name}!
          </h1>
          <p className="text-zinc-400 mb-10 text-lg">
            Outstanding performance with{' '}
            <strong className="text-white font-extrabold">{winner?.score} points</strong>.
          </p>

          {/* Leaderboard Podiums */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8">
            <ScoreBoard contestants={contestants} activeContestantId={null} />
          </div>

          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYING VIEW (Normal or Rapid Fire)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between selection:bg-blue-600">
      {/* Sound Player & Banner */}
      <div className="sticky top-0 z-50 px-4 pt-3 backdrop-blur-md">
        <SoundPlayer lastResult={room.lastResult} />
      </div>

      {/* Main Game Screen Header */}
      <header className="border-b border-zinc-800/80 px-4 sm:px-8 py-4 bg-zinc-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦊</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl text-white">
                  {room.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {room.roundType === 'rapid_fire' ? '🔥 Rapid Fire' : '🎯 Normal Round'}
                </span>
              </div>
              <span className="text-xs text-zinc-400">
                Room Code: <strong className="text-blue-400 font-mono">{room.code}</strong>
              </span>
            </div>
          </div>

          {/* Active Turn Indicator Banner */}
          <div
            className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 transition-all ${
              isMyTurn
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400 animate-pulse'
                : 'bg-zinc-900 border-zinc-800 text-zinc-200'
            }`}
          >
            <Sparkles className="w-5 h-5 text-current shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest opacity-80 block">
                {isMyTurn ? "IT'S YOUR TURN!" : 'Active Turn'}
              </span>
              <span className="font-black text-base sm:text-lg">
                {activeContestant?.name || 'Waiting for host...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Active Question & Interactive Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Synchronized Timer Bar */}
          <div className="flex items-center justify-between bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-semibold">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Round Clock</span>
            </div>
            <Timer endsAt={room.timerEndsAt} size="md" />
          </div>

          {/* Normal Round: Question Card */}
          {room.roundType === 'normal' && (
            <div>
              {question ? (
                <QuestionCard question={question} showAnswer={false} />
              ) : (
                <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-400">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-blue-400 opacity-60 animate-pulse" />
                  <h3 className="text-xl font-bold text-white mb-1">
                    Ready for the Next Question
                  </h3>
                  <p className="text-sm">
                    The host will launch the next question shortly. Get ready!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rapid Fire Round: Board & Question */}
          {room.roundType === 'rapid_fire' && (
            <div className="space-y-6">
              {question && <QuestionCard question={question} showAnswer={false} />}
              <RapidFireBoard
                board={board}
                activeQuestionId={question?.id}
                isInteractive={isMyTurn}
                onSelectTile={handleSelectTile}
              />
            </div>
          )}

          {/* PASS Button Section (visible only when active team & timer is running) */}
          {isMyTurn && isTimerRunning && room.roundType === 'normal' && (
            <div className="p-6 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-500/40 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-black text-amber-300">Unsure of the answer?</h4>
                <p className="text-xs text-zinc-400">
                  Pass immediately to transfer the question to the next group in rotation.
                </p>
                {passError && (
                  <p className="text-xs text-rose-400 font-bold mt-1">{passError}</p>
                )}
              </div>

              <button
                type="button"
                disabled={passing}
                onClick={handlePass}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-lg shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {passing ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <SkipForward className="w-5 h-5 fill-white" />
                    <span>PASS QUESTION</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live Scoreboard */}
        <div className="lg:col-span-1 space-y-6">
          <ScoreBoard
            contestants={contestants}
            activeContestantId={room.activeContestantId}
            isAdmin={false}
          />
        </div>
      </main>

      {/* Footer info */}
      <footer className="border-t border-zinc-900 px-6 py-4 text-center text-xs text-zinc-500">
        Bluefox Quiz &bull; Polling every 1s &bull; Millisecond-level synchronized timer
      </footer>
    </div>
  );
}
