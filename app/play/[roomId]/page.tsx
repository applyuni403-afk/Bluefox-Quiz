'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/lib/useGameState';
import { useTimer } from '@/lib/useTimer';
import { Timer } from '@/components/Timer';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreBoard } from '@/components/ScoreBoard';
import { NormalRoundBoard } from '@/components/NormalRoundBoard';
import { RapidFireSetSelector } from '@/components/RapidFireSetSelector';
import { SoundPlayer } from '@/components/SoundPlayer';
import { SiteLogo } from '@/components/SiteLogo';
import { useNotification } from '@/context/NotificationContext';
import {
  logoutContestant,
  chooseNormalQuestion,
  selectRapidFireSet,
  skipRapidFireQuestion,
  proceedToNextNumber,
} from '@/lib/actions';
import {
  Users,
  SkipForward,
  Sparkles,
  Radio,
  Clock,
  Crown,
  UserX,
  LogOut,
  CheckCircle2,
  Send,
  HelpCircle,
  Flame,
  Check,
  ChevronRight,
} from 'lucide-react';

export default function PlayRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { toast, confirm } = useNotification();
  const {
    room,
    contestants,
    question,
    board,
    normalBoard,
    rapidFireSets,
    error,
    isLoading,
    mutate,
  } = useGameState(roomId);

  const [myContestantId, setMyContestantId] = useState<string | null>(null);
  const [myClaimToken, setMyClaimToken] = useState<string | null>(null);
  const [passing, setPassing] = useState(false);
  const [passError, setPassError] = useState('');

  // Contestant interactive answer input states
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);

  // Reset answer states when active question changes
  useEffect(() => {
    setTypedAnswer('');
    setSelectedOption(null);
    setAnswerFeedback(null);
  }, [question?.id]);

  // Read stored contestant id and claim token from localStorage & cookie
  useEffect(() => {
    const keys = [roomId, room?.id, room?.code].filter(Boolean) as string[];
    let foundId: string | null = null;
    let foundToken: string | null = null;

    for (const k of keys) {
      const localId = localStorage.getItem(`bluefox_contestant_${k}`);
      const localToken = localStorage.getItem(`bluefox_claim_token_${k}`);
      if (localId) {
        foundId = localId;
        foundToken = localToken;
        break;
      }
      const match = document.cookie.match(new RegExp(`(?:^|; )bluefox_team_${k}=([^;]*)`));
      if (match && match[1]) {
        try {
          const data = JSON.parse(decodeURIComponent(match[1]));
          if (data.id) {
            foundId = data.id;
            foundToken = data.token || null;
            break;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!foundId) {
      foundId = localStorage.getItem('bluefox_last_contestant_id');
      foundToken = localStorage.getItem('bluefox_last_claim_token');
    }

    if (foundId) {
      const timer = setTimeout(() => {
        setMyContestantId(foundId);
        setMyClaimToken(foundToken);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [roomId, room?.id, room?.code]);

  const activeContestant = contestants.find((c) => c.id === room?.activeContestantId);
  const myContestant = contestants.find((c) => c.id === myContestantId);
  const isMyTurn = Boolean(
    myContestantId &&
      room?.activeContestantId &&
      myContestantId === room.activeContestantId
  );

  // Check if this team was kicked by host
  const wasKicked = Boolean(myContestantId && contestants.length > 0 && !myContestant);

  const { isRunning: isTimerRunning } = useTimer(room?.timerEndsAt);

  // Contestant explicit LOG OUT action
  const handleLogoutTeam = async () => {
    if (!myContestant) return;
    const confirmed = await confirm({
      title: `Log Out Team "${myContestant.name}"?`,
      message:
        'This will release the team session so another device can log in or you can choose a different team.',
      confirmText: 'Log Out Team',
      cancelText: 'Stay Connected',
      variant: 'warning',
      icon: 'logout',
    });
    if (!confirmed) return;

    try {
      await logoutContestant(
        room?.id || roomId,
        myContestant.id,
        myClaimToken || undefined
      );

      // Clear local storage and cookie
      const keys = Array.from(
        new Set([roomId, room?.id, room?.code, localStorage.getItem('bluefox_last_room_id')].filter(Boolean))
      ) as string[];

      keys.forEach((k) => {
        localStorage.removeItem(`bluefox_contestant_${k}`);
        localStorage.removeItem(`bluefox_claim_token_${k}`);
        localStorage.removeItem(`bluefox_team_name_${k}`);
        document.cookie = `bluefox_team_${k}=; path=/; max-age=0; SameSite=Lax`;
      });
      localStorage.removeItem('bluefox_last_contestant_id');
      localStorage.removeItem('bluefox_last_claim_token');

      toast.info('Logged Out', `Logged out of team "${myContestant.name}".`);
      router.push('/join');
    } catch (err) {
      toast.error('Logout Failed', (err as Error).message);
    }
  };

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
          roomId: room?.id || roomId,
          contestantId: myContestantId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to pass question');
      }

      toast.info('Turn Passed', 'Passed turn to the next group in rotation.');
      mutate();
    } catch (err) {
      const msg = (err as Error).message;
      setPassError(msg);
      toast.warning('Pass Failed', msg);
    } finally {
      setPassing(false);
    }
  };

  // Normal quiz question number select
  const handleSelectNormalNumber = async (questionId: string) => {
    try {
      await chooseNormalQuestion(room?.id || roomId, questionId);
      toast.success('Question Launched', 'Good luck!');
      mutate();
    } catch (err) {
      toast.error('Selection Failed', (err as Error).message);
    }
  };

  // Rapid fire set select
  const handleSelectRapidFireSet = async (setName: string) => {
    if (!myContestantId) {
      toast.warning('Team Required', 'Please join or re-join as a team to play.');
      return;
    }
    try {
      await selectRapidFireSet(room?.id || roomId, setName, myContestantId);
      toast.success('Rapid Fire Begun!', `Continuous countdown started for ${setName}!`);
      mutate();
    } catch (err) {
      toast.error('Could Not Start Set', (err as Error).message);
    }
  };

  // Rapid fire skip question
  const handleSkipRapidFire = async () => {
    if (!myContestantId || submittingAnswer) return;
    try {
      setSubmittingAnswer(true);
      await skipRapidFireQuestion(room?.id || roomId, myContestantId);
      mutate();
    } catch (err) {
      toast.error('Skip Failed', (err as Error).message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Submit answer for Normal or Rapid Fire
  const handleSubmitAnswer = async (e?: React.FormEvent, directAnswer?: string) => {
    if (e) e.preventDefault();
    const answerToSubmit = directAnswer || selectedOption || typedAnswer;
    if (!answerToSubmit || !answerToSubmit.trim() || submittingAnswer || !myContestantId) return;

    setSubmittingAnswer(true);
    setAnswerFeedback(null);

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room?.id || roomId,
          contestantId: myContestantId,
          answer: answerToSubmit.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer');
      }

      if (data.correct) {
        setAnswerFeedback(`✓ Correct! +${data.pointsAwarded || question?.points || 10} PTS`);
        toast.success('Correct Answer!', `+${data.pointsAwarded || 10} PTS awarded to your team!`);
        setTypedAnswer('');
        setSelectedOption(null);
      } else {
        if (data.allPassed) {
          setAnswerFeedback(`Question finished. Correct answer: ${data.revealedAnswer}`);
          toast.warning('Turn Over', `All teams tried! The correct answer was: ${data.revealedAnswer}`);
        } else if (data.passed) {
          setAnswerFeedback('Incorrect! Turn passed to next group.');
          toast.warning('Incorrect', 'Turn passed to the next team in rotation.');
        } else {
          setAnswerFeedback('Incorrect! Next question...');
          toast.warning('Incorrect Answer', 'Keep going!');
        }
        setTypedAnswer('');
        setSelectedOption(null);
      }

      mutate();
    } catch (err) {
      const msg = (err as Error).message;
      setAnswerFeedback(`Error: ${msg}`);
      toast.error('Submission Failed', msg);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Normal mode proceed to next question
  const handleProceedToNext = async () => {
    try {
      await proceedToNextNumber(room?.id || roomId);
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading && !room) {
    return (
      <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Connecting to quiz...</p>
      </div>
    );
  }

  if (wasKicked) {
    return (
      <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl shadow-[0_20px_50px_rgba(30,58,138,0.08)]">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <UserX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-1.5">Team Removed</h2>
          <p className="text-xs text-slate-600 mb-6 font-medium">
            Your group has been removed from this quiz session by the host.
          </p>
          <Link
            href="/join"
            onClick={() => {
              localStorage.removeItem(`bluefox_contestant_${roomId}`);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition shadow-md shadow-blue-500/25 active:scale-95"
          >
            <span>Join Another Room</span>
          </Link>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl shadow-[0_20px_50px_rgba(30,58,138,0.08)]">
          <h2 className="text-lg font-bold text-rose-600 mb-2">Room Unavailable</h2>
          <p className="text-xs text-slate-600 mb-4 font-medium">
            {error ? String(error) : 'This quiz room is no longer active.'}
          </p>
          <Link
            href="/join"
            className="inline-block px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition"
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
      <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 p-4 sm:p-6 flex flex-col justify-between relative selection:bg-blue-500/20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-400/10 blur-[140px] pointer-events-none" />

        {/* Header */}
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between pb-3 border-b border-blue-200/60 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <SiteLogo size="md" />
            <div>
              <h1 className="font-black text-lg sm:text-xl tracking-tight text-slate-900">{room.name}</h1>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Radio className="w-3 h-3 animate-pulse text-amber-600" /> Lobby &bull; Waiting for Host
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white/85 backdrop-blur-xl border border-blue-100 px-3.5 py-1.5 rounded-2xl text-right shadow-xs">
              <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-[0.15em]">
                Room Code
              </span>
              <span className="font-mono text-lg font-black text-blue-600 tracking-wider">
                {room.code}
              </span>
            </div>
            {myContestant && (
              <button
                type="button"
                onClick={handleLogoutTeam}
                title="Log out from this team"
                className="px-3 py-1.5 rounded-2xl bg-white hover:bg-rose-50 border border-blue-100 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition shadow-xs flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Lobby Grid */}
        <div className="w-full max-w-5xl mx-auto my-auto z-10 flex-1 min-h-0 flex flex-col justify-center overflow-y-auto py-2">
          {(() => {
            const groups = contestants.filter((c) => c.kind === 'group');
            const maxTeams = room.maxTeams || null;
            const isFull = maxTeams !== null && groups.length >= maxTeams;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>
                        Teams Registered ({groups.length}
                        {maxTeams ? `/${maxTeams}` : ''})
                      </span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {isFull ? `Full (${groups.length}/${maxTeams})` : 'Expandable Roster'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-medium">
                    {isFull
                      ? 'All slots filled &bull; Host will start shortly'
                      : `${groups.length} ${groups.length === 1 ? 'team' : 'teams'} ready to compete`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {groups.map((group) => {
                    const isMe = group.id === myContestantId;
                    return (
                      <div
                        key={group.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isMe
                            ? 'bg-white border-2 border-blue-500 shadow-[0_8px_25px_rgba(59,130,246,0.15)] ring-2 ring-blue-500/20'
                            : 'bg-white/85 backdrop-blur-xl border-blue-100 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">
                            #{group.joinOrder}
                          </span>
                          {isMe && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-blue-600 text-white">
                              Your Team
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900 truncate mb-1">
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Ready to Play</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty placeholder slots: show remaining placeholders if fewer than 4 or 8 */}
                  {Array.from({
                    length: Math.max(
                      0,
                      (maxTeams || (groups.length < 8 ? 8 : Math.ceil(groups.length / 4) * 4)) -
                        groups.length
                    ),
                  })
                    .slice(0, 4)
                    .map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="p-4 rounded-2xl border border-dashed border-blue-200 bg-white/40 flex flex-col items-center justify-center text-center min-h-[100px]"
                      >
                        <Users className="w-4 h-4 text-slate-400 mb-1" />
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Team #{groups.length + i + 1}
                        </span>
                        <span className="text-[9px] text-slate-400">Waiting to join...</span>
                      </div>
                    ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] font-medium text-slate-400 z-10 uppercase tracking-wider py-1 shrink-0">
          Bluefox Quiz &bull; Realtime Synchronized
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
      <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center relative selection:bg-blue-500/20">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/15 blur-[160px] pointer-events-none" />

        <SoundPlayer lastResult="correct" />

        <div className="max-w-lg w-full text-center z-10 my-auto overflow-y-auto max-h-[92vh] py-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-amber-950 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_25px_rgba(245,158,11,0.25)]">
            <Crown className="w-8 h-8" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 mb-1.5 block">
            Tournament Champion
          </span>
          <h1 className="text-3xl sm:text-4xl font-black mb-2 text-slate-900">
            {winner?.name || 'Quiz Concluded'}
          </h1>
          <p className="text-slate-600 mb-5 text-xs sm:text-sm font-medium">
            Final Score: <strong className="text-slate-900 font-black">{winner?.score || 0} PTS</strong>
          </p>

          <div className="bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl p-4 mb-5 shadow-[0_15px_40px_rgba(30,58,138,0.06)] max-h-[40vh] overflow-y-auto">
            <ScoreBoard contestants={contestants} activeContestantId={null} />
          </div>

          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 shadow-md shadow-blue-500/25"
          >
            Return to Quiz Home
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYING VIEW
  // -------------------------------------------------------------
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 flex flex-col justify-between selection:bg-blue-500/20">
      <SoundPlayer lastResult={room.lastResult} />

      {/* Quiz Top Bar */}
      <header className="border-b border-blue-200/60 px-4 sm:px-6 py-2.5 bg-white/80 backdrop-blur-2xl shrink-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SiteLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-slate-900 truncate max-w-xs">{room.name}</h1>
                {room.currentRoundName ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    {room.currentRoundName}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {room.roundType === 'rapid_fire' ? 'Rapid Fire' : 'Normal Quiz'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-semibold">
                CODE: {room.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {myContestant && (
              <button
                type="button"
                onClick={handleLogoutTeam}
                title="Log out from team"
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-blue-100 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition shadow-2xs flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out Team</span>
              </button>
            )}

            {/* Active Turn Badge */}
            <div
              className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                isMyTurn
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse'
                  : 'bg-white border-blue-100 text-slate-700 shadow-2xs'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-current shrink-0" />
              <div>
                <span className="text-[8px] uppercase font-black tracking-[0.15em] opacity-80 block">
                  {isMyTurn ? "IT'S YOUR TURN!" : 'Active Turn'}
                </span>
                <span className="font-bold text-xs">
                  {activeContestant?.name || 'Awaiting question...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Broadcast Stage */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch overflow-hidden">
        {/* Left 2 Columns: Question Stage & Pass Controls */}
        <div className="lg:col-span-2 flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1">
          {/* Synchronized Timer Card */}
          <div className="flex items-center justify-between bg-white/85 backdrop-blur-xl border border-blue-100 rounded-2xl px-4 py-2.5 shadow-2xs shrink-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {room.roundType === 'rapid_fire' && room.rapidFireState?.status === 'running'
                  ? `Rapid Fire Timeline (${room.rapidFireState.activeSet})`
                  : 'Round Timer'}
              </span>
            </div>
            <Timer endsAt={room.timerEndsAt} size="md" />
          </div>

          {/* Normal Round Stage */}
          {room.roundType === 'normal' && (
            <div className="space-y-3 shrink-0">
              {question ? (
                <div className="space-y-3">
                  <QuestionCard
                    question={question}
                    showAnswer={false}
                    interactive={isMyTurn && isTimerRunning && !question.revealedAnswer}
                    selectedOption={selectedOption}
                    onSelectOption={(opt) => setSelectedOption(opt)}
                  />

                  {/* Contestant Interactive Answering Section (Active Turn) */}
                  {isMyTurn && isTimerRunning && !question.revealedAnswer && (
                    <div className="p-4 bg-white/95 backdrop-blur-xl border-2 border-blue-400 rounded-2xl shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          <span>Your Team's Turn — Answer Now!</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {question.qtype === 'mcq' ? 'Select an Option' : 'Type Your Answer'}
                        </span>
                      </div>

                      {question.qtype === 'mcq' ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(question.options || []).map((opt, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              const isSel = selectedOption === opt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedOption(opt)}
                                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer text-left ${
                                    isSel
                                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                                      isSel
                                        ? 'bg-white text-blue-600'
                                        : 'bg-white border border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={!selectedOption || submittingAnswer}
                              onClick={() => handleSubmitAnswer(undefined, selectedOption || undefined)}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {submittingAnswer ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Submit Selected Option</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={passing}
                              onClick={handlePass}
                              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition cursor-pointer shrink-0"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                              <span>Pass</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitAnswer} className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={typedAnswer}
                              onChange={(e) => setTypedAnswer(e.target.value)}
                              placeholder="Type your answer here..."
                              autoFocus
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                            />
                            <button
                              type="submit"
                              disabled={!typedAnswer.trim() || submittingAnswer}
                              className="py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {submittingAnswer ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Submit</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={passing}
                              onClick={handlePass}
                              className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                              <span>Pass</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {answerFeedback && (
                        <p className="text-xs font-bold text-indigo-700">{answerFeedback}</p>
                      )}
                    </div>
                  )}

                  {/* Other Teams Waiting Indicator */}
                  {!isMyTurn && isTimerRunning && !question.revealedAnswer && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                        <span>
                          <strong>{activeContestant?.name || 'Active Team'}</strong> is answering...
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        Pass will rotate to you if unanswered
                      </span>
                    </div>
                  )}

                  {/* When question finished or revealed, proceed button */}
                  {question.revealedAnswer && (
                    <div className="p-3.5 rounded-2xl bg-white/90 border border-blue-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                      <span className="text-xs text-slate-700 font-medium">
                        Question concluded. Ready for next question number!
                      </span>
                      <button
                        type="button"
                        onClick={handleProceedToNext}
                        className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <span>Choose Next Number</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* No Question Active -> Question Number Board */
                <NormalRoundBoard
                  board={normalBoard || []}
                  roundName={room.currentRoundName}
                  activeQuestionId={room.currentQuestionId}
                  isInteractive={isMyTurn}
                  activeTeamName={activeContestant?.name}
                  onSelectNumber={handleSelectNormalNumber}
                />
              )}
            </div>
          )}

          {/* Rapid Fire Stage */}
          {room.roundType === 'rapid_fire' && (
            <div className="space-y-3 shrink-0">
              {room.rapidFireState?.status === 'running' && question ? (
                <div className="space-y-3">
                  {/* Rapid Fire Progress Banner */}
                  <div className="p-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-2xl text-white shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 fill-white animate-pulse" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-90 block">
                          {room.rapidFireState.activeSet} Rapid Fire Timeline
                        </span>
                        <span className="text-xs font-black">
                          Question {room.rapidFireState.questionIndex + 1} of {room.rapidFireState.totalQuestions}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-white/20 text-xs font-black">
                        {room.rapidFireState.correctCount} Correct
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-white text-amber-900 text-xs font-black">
                        +{room.rapidFireState.scoreEarned} PTS
                      </span>
                    </div>
                  </div>

                  <QuestionCard
                    question={question}
                    showAnswer={false}
                    interactive={isMyTurn && isTimerRunning}
                    selectedOption={selectedOption}
                    onSelectOption={(opt) => {
                      setSelectedOption(opt);
                      handleSubmitAnswer(undefined, opt);
                    }}
                  />

                  {/* Fast Answering / Skip Controls */}
                  {isMyTurn && isTimerRunning && (
                    <div className="p-4 bg-white/95 backdrop-blur-xl border border-amber-300 rounded-2xl shadow-xs space-y-2.5">
                      {question.qtype === 'mcq' ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            {(question.options || []).map((opt, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={submittingAnswer}
                                  onClick={() => handleSubmitAnswer(undefined, opt)}
                                  className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer text-left"
                                >
                                  <span className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black shrink-0">
                                    {letter}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            disabled={submittingAnswer}
                            onClick={handleSkipRapidFire}
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>Skip Question &rarr;</span>
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitAnswer} className="flex gap-2">
                          <input
                            type="text"
                            value={typedAnswer}
                            onChange={(e) => setTypedAnswer(e.target.value)}
                            placeholder="Type rapid answer..."
                            autoFocus
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
                          />
                          <button
                            type="submit"
                            disabled={!typedAnswer.trim() || submittingAnswer}
                            className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-amber-500/25 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit</span>
                          </button>
                          <button
                            type="button"
                            disabled={submittingAnswer}
                            onClick={handleSkipRapidFire}
                            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>Skip</span>
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Non-turn Spectator View during live Rapid Fire */}
                  {!isMyTurn && isTimerRunning && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                          <Flame className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            <strong>{activeContestant?.name || 'Active Team'}</strong> is playing{' '}
                            {room.rapidFireState.activeSet}
                          </p>
                          <p className="text-[11px] text-amber-700 font-medium">
                            Rapid Fire questions are answered exclusively by the active team (no passing). Please get ready for your turn!
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wider shrink-0">
                        Spectator Mode
                      </span>
                    </div>
                  )}
                </div>
              ) : room.rapidFireState?.status === 'completed' ? (
                /* Rapid Fire Set Summary */
                <div className="p-6 text-center bg-white/90 backdrop-blur-xl border border-amber-200 rounded-3xl shadow-sm space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 mb-1">
                      {room.rapidFireState.activeSet} Completed!
                    </h3>
                    <p className="text-xs text-slate-600">
                      Score: <strong className="text-slate-900">{room.rapidFireState.correctCount}</strong> / {room.rapidFireState.totalQuestions} questions correct (+{room.rapidFireState.scoreEarned} PTS)
                    </p>
                  </div>

                  {isMyTurn && (
                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-xs shadow-md animate-pulse">
                      ★ It&apos;s Your Turn, {myContestant?.name}! Choose your Rapid Fire set below.
                    </div>
                  )}

                  <RapidFireSetSelector
                    sets={rapidFireSets || []}
                    isInteractive={isMyTurn}
                    activeTeamName={activeContestant?.name}
                    defaultTimelineSeconds={room.rapidFireSeconds || 60}
                    onSelectSet={handleSelectRapidFireSet}
                  />
                </div>
              ) : (
                /* No Set Active -> Rapid Fire Set Selector */
                <div className="space-y-3">
                  {isMyTurn && (
                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-xs shadow-md animate-pulse">
                      ★ It&apos;s Your Turn, {myContestant?.name}! Choose your Rapid Fire set below.
                    </div>
                  )}
                  <RapidFireSetSelector
                    sets={rapidFireSets || []}
                    isInteractive={isMyTurn}
                    activeTeamName={activeContestant?.name}
                    defaultTimelineSeconds={room.rapidFireSeconds || 60}
                    onSelectSet={handleSelectRapidFireSet}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Scoreboard */}
        <div className="lg:col-span-1 h-full min-h-0 flex flex-col overflow-hidden">
          <ScoreBoard
            contestants={contestants}
            activeContestantId={room.activeContestantId}
            isAdmin={false}
          />
        </div>
      </main>

      <footer className="border-t border-blue-200/50 px-6 py-1.5 text-center text-[10px] uppercase tracking-wider text-slate-400 shrink-0">
        Bluefox Quiz &bull; Continuous Live Sync
      </footer>
    </div>
  );
}
