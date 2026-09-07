'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useGameState } from '@/lib/useGameState';
import { useTimer } from '@/lib/useTimer';
import { Timer } from '@/components/Timer';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreBoard } from '@/components/ScoreBoard';
import { RapidFireBoard } from '@/components/RapidFireBoard';
import { SoundPlayer } from '@/components/SoundPlayer';
import {
  startGame,
  finishGame,
  resetGame,
  setRound,
  showQuestion,
  startTimer,
  stopTimer,
  markCorrect,
  markWrong,
  passQuestion,
  nextTurn,
  closeQuestion,
  startRapidFireForIndividual,
  chooseRapidFireQuestion,
  creditIndividualToGroup,
  getRoomQuestions,
} from '@/lib/actions';
import {
  Play,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Users,
  Copy,
  Check,
  Award,
  ListPlus,
  ExternalLink,
  Link2,
} from 'lucide-react';
import useSWR from 'swr';

interface AdminRoomClientProps {
  roomId: string;
}

export function AdminRoomClient({ roomId }: AdminRoomClientProps) {
  const { room, contestants, board, mutate } = useGameState(roomId);
  const { data: allQuestions = [] } = useSWR(
    ['admin_questions', roomId, room?.version],
    () => getRoomQuestions(roomId)
  );
  const [customTimerSec, setCustomTimerSec] = useState(30);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedParentGroupId, setSelectedParentGroupId] = useState('');
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);

  // 00:00 Auto-Pass Single Authority
  const timerState = useTimer(room?.timerEndsAt);
  const passedForTimer = useRef<string | null>(null);

  useEffect(() => {
    if (
      timerState.isExpired &&
      room?.currentQuestionId &&
      room?.status === 'playing' &&
      room?.roundType === 'normal'
    ) {
      const timerKey = `${room.currentQuestionId}-${room.passCount}`;
      if (passedForTimer.current !== timerKey) {
        passedForTimer.current = timerKey;
        passQuestion(roomId).then(() => mutate());
      }
    }
  }, [
    timerState.isExpired,
    room?.currentQuestionId,
    room?.status,
    room?.passCount,
    room?.roundType,
    roomId,
    mutate,
  ]);

  const copyRoomCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!room?.code) return;
    const url = `${window.location.origin}/join?code=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const wrapAction = async (fn: () => Promise<unknown>) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await fn();
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsActionPending(false);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groups = contestants.filter((c) => c.kind === 'group');
  const individuals = contestants.filter((c) => c.kind === 'individual');
  const activeContestant = contestants.find((c) => c.id === room.activeContestantId);

  // Find active question from allQuestions (which has correctAnswer for host!)
  const activeHostQuestion = allQuestions.find(
    (q) => q.id === room.currentQuestionId
  );

  const selectedGroup = groups.find((g) => g.id === selectedParentGroupId);
  const availableMembers = Array.isArray(selectedGroup?.members)
    ? selectedGroup!.members
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between selection:bg-blue-600">
      {/* Host Banner & Sound Sync */}
      <div className="sticky top-0 z-50 px-4 pt-2 backdrop-blur-md">
        <SoundPlayer lastResult={room.lastResult} />
      </div>

      {/* Admin Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 sticky top-12 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🦊</span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-extrabold text-xl text-white">{room.name}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    room.status === 'playing'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : room.status === 'finished'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {room.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <span>Room Code:</span>
                <button
                  type="button"
                  onClick={copyRoomCode}
                  className="inline-flex items-center gap-1 font-mono font-bold text-blue-400 bg-zinc-800 px-2 py-0.5 rounded hover:bg-zinc-700 transition"
                  title="Copy room code"
                >
                  <span>{room.code}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded hover:bg-indigo-900/60 transition font-medium"
                  title="Copy direct join link for participants"
                >
                  {copiedLink ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/play/${room.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              <span>Contestant Screen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Link
              href={`/admin/room/${room.id}/questions`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Question Bank ({allQuestions.length})</span>
            </Link>

            {room.status === 'lobby' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => startGame(room.id))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Quiz Game</span>
              </button>
            ) : room.status === 'playing' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => finishGame(room.id))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
              >
                <Award className="w-4 h-4" />
                <span>Finish Game</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => resetGame(room.id))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Lobby</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin Arena */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Live Control Center */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lobby 8-Group Banner */}
          {room.status === 'lobby' && (
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-sm text-white block">
                    Quiz Lobby &bull; {groups.length} / 8 Groups Registered
                  </span>
                  <p className="text-xs text-blue-300/80">
                    {groups.length >= 8
                      ? 'All 8 group slots are filled! Further joins are closed.'
                      : `${8 - groups.length} slots remaining. Share the room code "${room.code}" or add groups manually.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isActionPending || groups.length === 0}
                onClick={() => wrapAction(() => startGame(room.id))}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 shrink-0"
              >
                Start Quiz Now
              </button>
            </div>
          )}
          {/* Round Mode & Turn Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
              <div>
                <span className="text-xs uppercase font-bold text-zinc-400 block tracking-wider">
                  Active Mode
                </span>
                <h3 className="text-xl font-black">
                  {room.roundType === 'rapid_fire' ? '🔥 Rapid Fire' : '🎯 Normal Round'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={room.roundType === 'normal' || isActionPending}
                  onClick={() => wrapAction(() => setRound(room.id, 'normal'))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    room.roundType === 'normal'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Normal Round
                </button>
                <button
                  type="button"
                  disabled={room.roundType === 'rapid_fire' || isActionPending}
                  onClick={() => wrapAction(() => setRound(room.id, 'rapid_fire'))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    room.roundType === 'rapid_fire'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Rapid Fire Round
                </button>
              </div>
            </div>

            {/* Current Turn & Rotation */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-semibold">
                    Current Turn:
                  </span>
                  <span className="font-black text-lg text-white">
                    {activeContestant?.name || 'No active group'}
                  </span>
                  {activeContestant?.kind === 'individual' && (
                    <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      Individual
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isActionPending || groups.length <= 1}
                onClick={() => wrapAction(() => nextTurn(room.id))}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>Rotate Next Turn</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rapid Fire Setup Section (Visible when roundType === 'rapid_fire') */}
          {room.roundType === 'rapid_fire' && (
            <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-lg text-amber-300">
                  Rapid Fire Player Assignment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">
                    Select Group:
                  </label>
                  <select
                    value={selectedParentGroupId}
                    onChange={(e) => {
                      setSelectedParentGroupId(e.target.value);
                      setSelectedMemberName('');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Choose Group --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Score: {g.score})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">
                    Member Name:
                  </label>
                  {availableMembers.length > 0 ? (
                    <select
                      value={selectedMemberName}
                      onChange={(e) => setSelectedMemberName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Choose Member --</option>
                      {availableMembers.map((m, idx) => (
                        <option key={idx} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedMemberName}
                      onChange={(e) => setSelectedMemberName(e.target.value)}
                      placeholder="Type member name"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={
                      !selectedParentGroupId || !selectedMemberName || isActionPending
                    }
                    onClick={() =>
                      wrapAction(() =>
                        startRapidFireForIndividual(
                          room.id,
                          selectedParentGroupId,
                          selectedMemberName
                        )
                      )
                    }
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                  >
                    Activate Individual Turn
                  </button>
                </div>
              </div>

              {/* Individual Credit Back to Group */}
              {individuals.length > 0 && (
                <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-zinc-400">
                    Fold rapid fire points into parent group:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {individuals.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        disabled={isActionPending}
                        onClick={() =>
                          wrapAction(() => creditIndividualToGroup(room.id, ind.id))
                        }
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/20 transition"
                      >
                        Credit {ind.name} ({ind.score} pts) &rarr; Group
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Synchronized Timer Controls */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-lg text-white">Timer Controls</h3>
              </div>
              <Timer endsAt={room.timerEndsAt} size="md" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5">
                <span className="text-xs text-zinc-400 font-bold">Duration:</span>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={customTimerSec}
                  onChange={(e) => setCustomTimerSec(parseInt(e.target.value) || 30)}
                  className="w-14 bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
                />
                <span className="text-xs text-zinc-500">sec</span>
              </div>

              {/* Quick Presets */}
              {[10, 15, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setCustomTimerSec(sec)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    customTimerSec === sec
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => startTimer(room.id, customTimerSec))}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  Start Timer
                </button>
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => stopTimer(room.id))}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition disabled:opacity-50"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {/* Active Question Display & Scorer Actions */}
          <div className="space-y-4">
            {activeHostQuestion ? (
              <div className="space-y-4">
                <QuestionCard question={activeHostQuestion} showAnswer={true} />

                {/* Scorer Button Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => markCorrect(room.id))}
                    className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-sm text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CORRECT (+{activeHostQuestion.points})</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => markWrong(room.id))}
                    className="py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 font-black text-sm text-white shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>WRONG</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => passQuestion(room.id))}
                    className="py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-sm text-white shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>PASS TO NEXT</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => closeQuestion(room.id))}
                    className="py-3.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 font-bold text-sm text-zinc-300 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <span>Close Question</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
                <p className="text-zinc-400 text-sm mb-4">
                  No question currently live on the screens. Select a question below to
                  show to contestants.
                </p>
              </div>
            )}
          </div>

          {/* Rapid Fire Board View for Host */}
          {room.roundType === 'rapid_fire' && (
            <RapidFireBoard
              board={board}
              activeQuestionId={room.currentQuestionId}
              isInteractive={true}
              onSelectTile={(qid) =>
                wrapAction(() => chooseRapidFireQuestion(room.id, qid, customTimerSec))
              }
            />
          )}

          {/* Question Launcher Bank */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-lg text-white">
                Launch Questions ({allQuestions.length})
              </h3>
              <Link
                href={`/admin/room/${room.id}/questions`}
                className="text-xs font-bold text-blue-400 hover:underline"
              >
                + Add / Manage Questions
              </Link>
            </div>

            {allQuestions.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-sm">
                No questions added yet.{' '}
                <Link
                  href={`/admin/room/${room.id}/questions`}
                  className="text-blue-400 underline font-semibold"
                >
                  Create your first question now
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {allQuestions.map((q) => {
                  const isCurrent = q.id === room.currentQuestionId;
                  const isDone = q.status === 'done';

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isCurrent
                          ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/30'
                          : isDone
                          ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
                            {q.qtype}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-900/60 text-blue-300">
                            {q.roundType === 'rapid_fire'
                              ? `Rapid Fire #${q.number}`
                              : 'Normal'}
                          </span>
                          <span className="text-xs font-extrabold text-indigo-400">
                            {q.points} pts
                          </span>
                          {isDone && (
                            <span className="text-[10px] text-zinc-500 font-semibold">
                              (Completed)
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-zinc-200 truncate">
                          {q.prompt}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isActionPending}
                        onClick={() => wrapAction(() => showQuestion(room.id, q.id))}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                      >
                        {isCurrent ? 'Showing Live' : 'Show to Room'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Contestant Roster & Score Editor */}
        <div className="lg:col-span-1 space-y-6">
          <ScoreBoard
            contestants={contestants}
            activeContestantId={room.activeContestantId}
            isAdmin={true}
            roomId={room.id}
            onMutate={mutate}
          />
        </div>
      </main>
    </div>
  );
}
