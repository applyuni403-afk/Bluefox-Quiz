'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/lib/useGameState';
import { useTimer } from '@/lib/useTimer';
import { Timer } from '@/components/Timer';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreBoard } from '@/components/ScoreBoard';
import { RapidFireBoard } from '@/components/RapidFireBoard';
import { NormalRoundBoard } from '@/components/NormalRoundBoard';
import { RapidFireSetSelector } from '@/components/RapidFireSetSelector';
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
  startRapidFireForGroup,
  chooseRapidFireQuestion,
  getRoomQuestions,
  logoutAdminAction,
  setRoomActiveRound,
  chooseNormalQuestion,
  selectRapidFireSet,
  skipRapidFireQuestion,
  finishRapidFireSet,
  revealQuestionAnswer,
  proceedToNextNumber,
  setRapidFireTimeLimit,
  submitAnswer,
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
  LogOut,
  Tag,
  Eye,
  ChevronRight,
} from 'lucide-react';
import useSWR from 'swr';
import { SiteLogo } from '@/components/SiteLogo';
import { useNotification } from '@/context/NotificationContext';

interface AdminRoomClientProps {
  roomId: string;
}

export function AdminRoomClient({ roomId }: AdminRoomClientProps) {
  const router = useRouter();
  const { toast, confirm } = useNotification();
  const { room, contestants, board, normalBoard, rapidFireSets, mutate } =
    useGameState(roomId);
  const { data: allQuestions = [] } = useSWR(
    ['admin_questions', roomId, room?.version],
    () => getRoomQuestions(roomId)
  );
  const [customTimerSec, setCustomTimerSec] = useState(30);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedParentGroupId, setSelectedParentGroupId] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const [bankFilter, setBankFilter] = useState<string>('all');

  const configuredRounds = useMemo(() => {
    const list = new Set<string>();
    (room?.customRounds || []).forEach((r) => {
      if (r && r.trim()) list.add(r.trim());
    });
    allQuestions.forEach((q) => {
      if (q.roundName && q.roundName.trim()) list.add(q.roundName.trim());
    });
    return Array.from(list);
  }, [room?.customRounds, allQuestions]);

  const filteredBankQuestions = useMemo(() => {
    if (bankFilter === 'all') return allQuestions;
    if (bankFilter === 'active') {
      if (!room?.currentRoundName) return allQuestions;
      return allQuestions.filter((q) => q.roundName === room.currentRoundName);
    }
    if (bankFilter === 'normal') return allQuestions.filter((q) => q.roundType === 'normal');
    if (bankFilter === 'rapid_fire') return allQuestions.filter((q) => q.roundType === 'rapid_fire');
    return allQuestions.filter((q) => q.roundName === bankFilter);
  }, [allQuestions, bankFilter, room?.currentRoundName]);

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
    toast.success('Room Code Copied', `${room.code} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!room?.code) return;
    const url = `${window.location.origin}/join?code=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Invite Link Copied', 'Direct participant URL ready to share');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const wrapAction = async (fn: () => Promise<unknown>) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await fn();
      await mutate();
    } catch (err) {
      toast.error('Action Failed', (err as Error).message || 'Operation could not be completed');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteRoom = async () => {
    const confirmed = await confirm({
      title: 'Delete Quiz Room?',
      message: `Are you sure you want to delete "${room?.name}"? All registered teams, questions, and scores will be permanently erased.`,
      confirmText: 'Delete Room',
      cancelText: 'Keep Room',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    try {
      setIsActionPending(true);
      await deleteRoom(roomId);
      toast.success('Room Deleted', `Room "${room?.name}" was deleted.`);
      router.push('/admin/login');
    } catch (err) {
      toast.error('Failed to Delete Room', (err as Error).message);
      setIsActionPending(false);
    }
  };

  const handleAdminLogout = async () => {
    const confirmed = await confirm({
      title: 'Log Out Host Session?',
      message: 'You will need to enter your Security PIN to regain access to the Host Control Studio.',
      confirmText: 'Log Out',
      cancelText: 'Stay in Room',
      variant: 'warning',
      icon: 'logout',
    });
    if (!confirmed) return;

    try {
      setIsActionPending(true);
      await logoutAdminAction();
      toast.info('Logged Out', 'Host session has been closed.');
      router.push('/admin/login');
    } catch (err) {
      toast.error('Logout Failed', (err as Error).message);
      setIsActionPending(false);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groups = contestants.filter((c) => c.kind === 'group');
  const activeContestant = contestants.find((c) => c.id === room.activeContestantId);

  const activeHostQuestion = allQuestions.find(
    (q) => q.id === room.currentQuestionId
  );

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 flex flex-col justify-between selection:bg-blue-500/20">
      {/* Sound Syncer */}
      <SoundPlayer lastResult={room.lastResult} />

      {/* Broadcast Navbar */}
      <header className="border-b border-blue-200/60 bg-white/80 backdrop-blur-2xl px-4 sm:px-6 py-2.5 shrink-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left Brand & Room Pill */}
          <div className="flex items-center gap-3">
            <SiteLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-slate-900 truncate max-w-[180px] sm:max-w-xs">{room.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    room.status === 'playing'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : room.status === 'finished'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {room.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span>Code:</span>
                <button
                  type="button"
                  onClick={copyRoomCode}
                  className="font-mono font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{room.code}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-slate-300">&bull;</span>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="text-slate-500 hover:text-slate-800 transition flex items-center gap-1 cursor-pointer"
                  title="Copy direct join link"
                >
                  <Link2 className="w-3 h-3 text-blue-600" />
                  <span>{copiedLink ? 'Copied' : 'Invite Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/play/${room.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition"
            >
              <span>Quiz View</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>

            <Link
              href={`/admin/room/${room.id}/questions`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition shadow-2xs"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Questions ({allQuestions.length})</span>
            </Link>

            {room.status === 'lobby' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => startGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start</span>
              </button>
            ) : room.status === 'playing' ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => finishGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Finish</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => wrapAction(() => resetGame(room.id))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
              className="p-1.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Admin Logout Button */}
            <button
              type="button"
              disabled={isActionPending}
              onClick={handleAdminLogout}
              title="Log out from Host session"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 shadow-2xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Stage */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch overflow-hidden z-10">
        {/* Left 2 Columns: Live Control Center */}
        <div className="lg:col-span-2 flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1">
          {/* Round Mode & Turn Banner */}
          <div className="bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-2xl p-4 shadow-2xs shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                <div>
                  <span className="text-xs font-black tracking-tight text-slate-900 block">
                    {room.currentRoundName || (room.roundType === 'rapid_fire' ? 'Rapid Fire Matrix' : 'Normal Quiz Round')}
                  </span>
                  {room.currentRoundName && (
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">
                      Mode: {room.roundType === 'rapid_fire' ? 'Rapid Fire' : 'Normal'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Round Switcher Dropdown (if rounds exist) */}
                {configuredRounds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl px-2.5 py-1">
                    <Tag className="w-3 h-3 text-indigo-600 shrink-0" />
                    <select
                      disabled={isActionPending}
                      value={room.currentRoundName || ''}
                      onChange={(e) => {
                        const selected = e.target.value;
                        wrapAction(async () => {
                          await setRoomActiveRound(room.id, selected || null);
                          toast.success(
                            'Active Round Changed',
                            selected ? `Now presenting "${selected}".` : 'Round name cleared.'
                          );
                        });
                      }}
                      className="bg-transparent text-xs font-black text-indigo-950 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- No Named Round --</option>
                      {configuredRounds.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Normal vs Rapid Mode buttons */}
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-2xl p-1">
                  <button
                    type="button"
                    disabled={room.roundType === 'normal' || isActionPending}
                    onClick={() => wrapAction(() => setRound(room.id, 'normal'))}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      room.roundType === 'normal'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    disabled={room.roundType === 'rapid_fire' || isActionPending}
                    onClick={() => wrapAction(() => setRound(room.id, 'rapid_fire'))}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      room.roundType === 'rapid_fire'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rapid Fire
                  </button>
                </div>
              </div>
            </div>

            {/* Current Turn & Rotate Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold block">
                    Active Turn
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-slate-900">
                      {activeContestant?.name || 'No team selected'}
                    </span>
                    {activeContestant?.kind === 'individual' && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
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
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <span>Rotate Turn</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rapid Fire Team Selector (Visible in rapid_fire mode) */}
          {room.roundType === 'rapid_fire' && (
            <div className="bg-white/85 backdrop-blur-2xl border border-amber-200 rounded-2xl p-4 space-y-3 shadow-2xs shrink-0">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-800">
                  Activate Rapid-Fire Team
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 items-center">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select Team:
                  </label>
                  <select
                    value={selectedParentGroupId}
                    onChange={(e) => setSelectedParentGroupId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="">-- Choose Team to Play Rapid Fire --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.score} PTS)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-auto self-end flex gap-2">
                  <button
                    type="button"
                    disabled={!selectedParentGroupId || isActionPending}
                    onClick={() =>
                      wrapAction(async () => {
                        await startRapidFireForGroup(room.id, selectedParentGroupId);
                        const activated = groups.find((g) => g.id === selectedParentGroupId);
                        toast.success(
                          'Rapid Fire Activated',
                          `Turn granted to "${activated?.name || 'Selected Team'}".`
                        );
                      })
                    }
                    className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-40 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Activate Team</span>
                  </button>
                  <button
                    type="button"
                    disabled={isActionPending}
                    onClick={() =>
                      wrapAction(async () => {
                        await nextTurn(room.id);
                        toast.info('Turn Advanced', 'Rotated to next team.');
                      })
                    }
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center gap-1"
                    title="Advance to next team in rotation"
                  >
                    <span>Next Team &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Question & Timer Control Center */}
          <div className="bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-2xl p-4 shadow-2xs space-y-4 shrink-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active Question Display
              </span>
              {activeHostQuestion && (
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => closeQuestion(room.id))}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Close Display &times;
                </button>
              )}
            </div>

            {activeHostQuestion ? (
              <div className="space-y-3">
                <QuestionCard question={activeHostQuestion} showAnswer={false} />

                {/* Host Answer Display */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-semibold">Official Answer:</span>
                    <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {activeHostQuestion.correctAnswer}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-semibold">Active Turn:</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeContestant?.name || 'No team selected'}
                      {room.passCount > 0 ? ` (Pass #${room.passCount})` : ''}
                    </span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +{activeHostQuestion.points} PTS
                    </span>
                  </div>
                </div>

                {/* Evaluation Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  {room.roundType === 'rapid_fire' ? (
                    room.rapidFireState?.status === 'running' ? (
                      /* Rapid Fire Live Host Action Bar */
                      <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                        <div className="flex items-center gap-2">
                          <Flame className="w-5 h-5 text-amber-600 animate-pulse" />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                              Rapid Fire Live Controls
                            </span>
                            <span className="font-bold text-amber-950">
                              Set {room.rapidFireState.activeSet} (Q{room.rapidFireState.questionIndex + 1}/{room.rapidFireState.totalQuestions}) &bull; {activeContestant?.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isActionPending}
                            onClick={() =>
                              wrapAction(async () => {
                                const res = await submitAnswer(room.id, activeContestant?.id || '', activeHostQuestion?.correctAnswer || '');
                                if (res?.correct) toast.success('Correct!', 'Advanced to next question.');
                              })
                            }
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>+Pts & Next</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionPending}
                            onClick={() =>
                              wrapAction(async () => {
                                await skipRapidFireQuestion(room.id, activeContestant?.id || '');
                                toast.info('Skipped', 'Advanced to next question.');
                              })
                            }
                            className="px-3 py-2 rounded-xl bg-slate-700 text-white font-bold text-xs hover:bg-slate-800 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>Skip & Next</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionPending}
                            onClick={() =>
                              wrapAction(async () => {
                                await finishRapidFireSet(room.id);
                                toast.info('Stopped', 'Rapid fire set finished.');
                              })
                            }
                            className="px-3 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Stop Set</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                        <span>Rapid Fire mode: Activate a team above or let the active team select their set below.</span>
                      </div>
                    )
                  ) : (
                    /* Normal Evaluation Action Buttons */
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <button
                        type="button"
                        disabled={isActionPending || !activeContestant}
                        onClick={() =>
                          wrapAction(async () => {
                            const res = await markCorrect(room.id);
                            if (res?.success) {
                              toast.success(
                                'Points Awarded!',
                                `+${res.pointsAwarded} PTS auto-added to "${
                                  res.contestantName || activeContestant?.name
                                }".`
                              );
                            }
                          })
                        }
                        className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="truncate">Correct (+{activeHostQuestion.points})</span>
                      </button>

                      <button
                        type="button"
                        disabled={isActionPending}
                        onClick={() => wrapAction(() => markWrong(room.id))}
                        className="py-2.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-rose-500/20 transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Wrong</span>
                      </button>

                      <button
                        type="button"
                        disabled={isActionPending}
                        onClick={() => wrapAction(() => passQuestion(room.id))}
                        className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span>Pass Turn</span>
                      </button>

                      <button
                        type="button"
                        disabled={isActionPending}
                        onClick={() => wrapAction(() => revealQuestionAnswer(room.id))}
                        className="py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Reveal</span>
                      </button>

                      <button
                        type="button"
                        disabled={isActionPending}
                        onClick={() => wrapAction(() => proceedToNextNumber(room.id))}
                        className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-900 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-slate-900/20 transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <span>Next Q</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isActionPending}
                        onClick={() => wrapAction(() => closeQuestion(room.id))}
                        className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs uppercase tracking-wider text-slate-700 border border-slate-200 transition active:scale-95 flex items-center justify-center disabled:opacity-50 cursor-pointer"
                      >
                        <span>Done</span>
                      </button>
                    </div>
                  )}

                  {/* Direct Question Points Award to Another Team (if answered out of turn) */}
                  {groups.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">
                        Award +{activeHostQuestion.points} to another team:
                      </span>
                      <select
                        defaultValue=""
                        disabled={isActionPending}
                        onChange={(e) => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          e.target.value = '';
                          wrapAction(async () => {
                            const res = await markCorrect(room.id, targetId);
                            if (res?.success) {
                              toast.success(
                                'Points Awarded!',
                                `+${res.pointsAwarded} PTS auto-added to "${res.contestantName}".`
                              );
                            }
                          });
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Choose Team to Receive +{activeHostQuestion.points} PTS --</option>
                        {groups
                          .filter((g) => g.id !== activeContestant?.id)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.score} PTS)
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p className="text-xs font-semibold">No active question on screen</p>
              </div>
            )}

            {/* Timer Controllers */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer endsAt={room.timerEndsAt} size="md" />
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {[15, 30, 45].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      disabled={isActionPending}
                      onClick={() => wrapAction(() => startTimer(room.id, sec))}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
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
                  className="w-16 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-center text-slate-900 shadow-2xs"
                />
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => startTimer(room.id, customTimerSec))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs cursor-pointer"
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => wrapAction(() => stopTimer(room.id))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {/* Normal Round Interactive Number Board (when no question active) */}
          {room.roundType === 'normal' && !activeHostQuestion && (
            <NormalRoundBoard
              board={normalBoard || []}
              roundName={room.currentRoundName}
              activeQuestionId={room.currentQuestionId}
              isInteractive={true}
              activeTeamName={activeContestant?.name}
              onSelectNumber={(qid) =>
                wrapAction(() => chooseNormalQuestion(room.id, qid, customTimerSec))
              }
            />
          )}

          {/* Rapid Fire Set Selector (when not actively running a set) */}
          {room.roundType === 'rapid_fire' &&
            room.rapidFireState?.status !== 'running' && (
              <div className="space-y-3">
                <RapidFireSetSelector
                  sets={rapidFireSets || []}
                  isInteractive={Boolean(activeContestant)}
                  activeTeamName={activeContestant?.name}
                  defaultTimelineSeconds={room.rapidFireSeconds || 60}
                  onSelectSet={(sName) =>
                    wrapAction(async () => {
                      if (!activeContestant) {
                        toast.warning('Select Team', 'Please select and activate a team first.');
                        return;
                      }
                      await selectRapidFireSet(room.id, sName, activeContestant.id, customTimerSec);
                      toast.success(
                        'Rapid Fire Launched',
                        `Started ${sName} for ${activeContestant.name}!`
                      );
                    })
                  }
                />
              </div>
            )}

          {/* Question Launcher Bank */}
          <div className="bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-2xl p-4 shadow-2xs shrink-0">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                  Launch Bank ({filteredBankQuestions.length}/{allQuestions.length})
                </span>
              </div>
              <Link
                href={`/admin/room/${room.id}/questions`}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                + Add / Manage Questions
              </Link>
            </div>

            {/* Bank Round Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 mb-2.5 pb-2 border-b border-slate-100 overflow-x-auto">
              <button
                type="button"
                onClick={() => setBankFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 ${
                  bankFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({allQuestions.length})
              </button>

              {room.currentRoundName && (
                <button
                  type="button"
                  onClick={() => setBankFilter('active')}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 ${
                    bankFilter === 'active'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  Active Round ({allQuestions.filter((q) => q.roundName === room.currentRoundName).length})
                </button>
              )}

              {configuredRounds
                .filter((r) => r !== room.currentRoundName)
                .map((r) => {
                  const count = allQuestions.filter((q) => q.roundName === r).length;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBankFilter(r)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 max-w-[130px] truncate ${
                        bankFilter === r
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r} ({count})
                    </button>
                  );
                })}
            </div>

            {filteredBankQuestions.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs">
                No questions found for this filter.{' '}
                <Link href={`/admin/room/${room.id}/questions`} className="text-blue-600 underline font-semibold">
                  Add questions
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {filteredBankQuestions.map((q) => {
                  const isCurrent = q.id === room.currentQuestionId;
                  const isDone = q.status === 'done';

                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                        isCurrent
                          ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300'
                          : isDone
                          ? 'bg-slate-50 border-slate-200 opacity-50'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-blue-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700">
                            {q.qtype}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[140px]">
                            {q.roundName || 'Round 1'}
                          </span>
                          {q.setName && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              {q.setName}
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            #{q.number}
                          </span>
                          <span className="text-[10px] font-black text-blue-600">
                            {q.points}p
                          </span>
                          {isDone && <span className="text-[9px] text-slate-400 font-semibold">(Done)</span>}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {q.prompt}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isActionPending}
                        onClick={() => wrapAction(() => showQuestion(room.id, q.id))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
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
        <div className="lg:col-span-1 h-full min-h-0 flex flex-col overflow-hidden">
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
