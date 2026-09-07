'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  deleteRoom,
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
  Trash2,
  Radio,
} from 'lucide-react';
import useSWR from 'swr';

interface AdminRoomClientProps {
  roomId: string;
}

export function AdminRoomClient({ roomId }: AdminRoomClientProps) {
  const router = useRouter();
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

  const handleDeleteRoom = async () => {
    const confirmed = window.confirm(
      `Permanently delete room "${room?.name}"?\nAll questions, teams, and scores will be deleted.`
    );
    if (!confirmed) return;

    try {
      setIsActionPending(true);
      await deleteRoom(roomId);
      router.push('/admin/login');
    } catch (err) {
      alert((err as Error).message || 'Failed to delete room');
      setIsActionPending(false);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groups = contestants.filter((c) => c.kind === 'group');
  const individuals = contestants.filter((c) => c.kind === 'individual');
  const activeContestant = contestants.find((c) => c.id === room.activeContestantId);

  const activeHostQuestion = allQuestions.find(
    (q) => q.id === room.currentQuestionId
  );

  const selectedGroup = groups.find((g) => g.id === selectedParentGroupId);
  const availableMembers = Array.isArray(selectedGroup?.members)
    ? selectedGroup!.members
    : [];

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-between selection:bg-indigo-500/30">
      {/* Sound Syncer */}
      <SoundPlayer lastResult={room.lastResult} />

      {/* Broadcast Navbar */}
      <header className="border-b border-white/[0.06] bg-[#07090e]/90 backdrop-blur-2xl px-6 py-3.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left Brand & Room Pill */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0b0e14] rounded-[15px] flex items-center justify-center text-lg">
                🦊
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base text-white truncate max-w-[200px] sm:max-w-xs">{room.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    room.status === 'playing'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : room.status === 'finished'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}
                >
                  {room.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                <span>Code:</span>
                <button
                  type="button"
                  onClick={copyRoomCode}
                  className="font-mono font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                >
                  <span>{room.code}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-zinc-600">&bull;</span>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="text-zinc-400 hover:text-white transition flex items-center gap-1"
                  title="Copy direct join link"
                >
                  <Link2 className="w-3 h-3 text-indigo-400" />
                  <span>{copiedLink ? 'Copied' : 'Invite Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/play/${room.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition"
            >
              <span>Arena View</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <Link
              href={`/admin/room/${room.id}/questions`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Questions ({allQuestions.length})</span>
            </Link>

            {room.status === 'lobby' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => startGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start</span>
              </button>
            ) : room.status === 'playing' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => finishGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95 disabled:opacity-50"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Finish</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => resetGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 transition disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {/* Delete Room Button */}
            <button
              type="button"
              disabled={isActionPending}
              onClick={handleDeleteRoom}
              title="Delete room permanently"
              className="p-1.5 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Arena */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start z-10">
        {/* Left 2 Columns: Live Control Center */}
        <div className="lg:col-span-2 space-y-6">
          {/* Round Mode & Turn Banner */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  {room.roundType === 'rapid_fire' ? 'Rapid Fire Matrix' : 'Normal Quiz Round'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.06] rounded-2xl p-1">
                <button
                  type="button"
                  disabled={room.roundType === 'normal' || isActionPending}
                  onClick={() => wrapAction(() => setRound(room.id, 'normal'))}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    room.roundType === 'normal'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  disabled={room.roundType === 'rapid_fire' || isActionPending}
                  onClick={() => wrapAction(() => setRound(room.id, 'rapid_fire'))}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    room.roundType === 'rapid_fire'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Rapid Fire
                </button>
              </div>
            </div>

            {/* Current Turn & Rotate Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-bold block">
                    Active Turn
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-white">
                      {activeContestant?.name || 'No team selected'}
                    </span>
                    {activeContestant?.kind === 'individual' && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Individual
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isActionPending || groups.length <= 1}
                onClick={() => wrapAction(() => nextTurn(room.id))}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>Rotate Turn</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rapid Fire Player Selector (Visible in rapid_fire mode) */}
          {room.roundType === 'rapid_fire' && (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-amber-300">
                  Assign Rapid-Fire Player
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Group:
                  </label>
                  <select
                    value={selectedParentGroupId}
                    onChange={(e) => {
                      setSelectedParentGroupId(e.target.value);
                      setSelectedMemberName('');
                    }}
                    className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="">-- Choose Team --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Player:
                  </label>
                  {availableMembers.length > 0 ? (
                    <select
                      value={selectedMemberName}
                      onChange={(e) => setSelectedMemberName(e.target.value)}
                      className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
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
                      placeholder="Player Name"
                      className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                    />
                  )}
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={!selectedParentGroupId || !selectedMemberName || isActionPending}
                    onClick={() =>
                      wrapAction(() =>
                        startRapidFireForIndividual(room.id, selectedParentGroupId, selectedMemberName)
                      )
                    }
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-40"
                  >
                    Activate Player
                  </button>
                </div>
              </div>

              {/* Credit button for individual points */}
              {individuals.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-zinc-400 font-semibold">Credit to Team:</span>
                  {individuals.map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      disabled={ind.score <= 0 || isActionPending}
                      onClick={() => wrapAction(() => creditIndividualToGroup(room.id, ind.id))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/[0.05] hover:bg-amber-500/20 text-amber-300 border border-white/[0.08] disabled:opacity-30"
                    >
                      {ind.name} ({ind.score} pts) &rarr; Team
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Question & Timer Control Center */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Active Question Display
              </span>
              {activeHostQuestion && (
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => closeQuestion(room.id))}
                  className="text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Close Question
                </button>
              )}
            </div>

            {activeHostQuestion ? (
              <div className="space-y-4">
                <QuestionCard question={activeHostQuestion} />

                {/* Host Answer Hint Bar */}
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-300">Answer Key:</span>
                  <span className="font-mono font-black text-white text-sm bg-black/40 px-3 py-1 rounded-xl border border-white/[0.08]">
                    {activeHostQuestion.correctAnswer}
                  </span>
                </div>

                {/* Evaluation Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => markCorrect(room.id))}
                    className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Correct (+{activeHostQuestion.points})</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => markWrong(room.id))}
                    className="py-3 px-3 rounded-2xl bg-rose-600 hover:bg-rose-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-rose-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Wrong</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => passQuestion(room.id))}
                    className="py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Pass Turn</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() => wrapAction(() => closeQuestion(room.id))}
                    className="py-3 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] font-bold text-xs uppercase tracking-wider text-zinc-300 transition active:scale-95 flex items-center justify-center disabled:opacity-50"
                  >
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 bg-white/[0.01] rounded-2xl border border-dashed border-white/[0.06]">
                <Clock className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">Select a question from below to display live</p>
              </div>
            )}

            {/* Timer Controllers */}
            <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer endsAt={room.timerEndsAt} size="md" />
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                  {[15, 30, 45].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      disabled={isActionPending}
                      onClick={() => wrapAction(() => startTimer(room.id, sec))}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={customTimerSec}
                  onChange={(e) => setCustomTimerSec(Number(e.target.value))}
                  className="w-16 bg-black/40 border border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-center text-white"
                />
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => startTimer(room.id, customTimerSec))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => stopTimer(room.id))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 transition"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {/* Rapid Fire Board (when rapid_fire) */}
          {room.roundType === 'rapid_fire' && board.length > 0 && (
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
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Launch Bank ({allQuestions.length})
              </span>
              <Link
                href={`/admin/room/${room.id}/questions`}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
              >
                + Add Question
              </Link>
            </div>

            {allQuestions.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs">
                No questions added.{' '}
                <Link href={`/admin/room/${room.id}/questions`} className="text-indigo-400 underline font-semibold">
                  Add questions
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {allQuestions.map((q) => {
                  const isCurrent = q.id === room.currentQuestionId;
                  const isDone = q.status === 'done';

                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isCurrent
                          ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
                          : isDone
                          ? 'bg-black/20 border-white/[0.03] opacity-40'
                          : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-white/[0.06] text-zinc-400">
                            {q.qtype}
                          </span>
                          <span className="text-[11px] font-black text-indigo-400">
                            {q.points}p
                          </span>
                          {isDone && <span className="text-[10px] text-zinc-500 font-semibold">(Done)</span>}
                        </div>
                        <p className="text-xs font-semibold text-zinc-200 truncate">
                          {q.prompt}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isActionPending}
                        onClick={() => wrapAction(() => showQuestion(room.id, q.id))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200'
                        }`}
                      >
                        {isCurrent ? 'Showing' : 'Launch'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Leaderboard & Team Roster */}
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
