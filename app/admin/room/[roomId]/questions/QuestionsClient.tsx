'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createQuestion,
  deleteQuestion,
  resetQuestionStatus,
  getRoomQuestions,
  logoutAdminAction,
  addRoomRound,
  deleteRoomRound,
  getRoom,
} from '@/lib/actions';
import {
  ArrowLeft,
  Plus,
  Trash2,
  RotateCcw,
  Upload,
  Volume2,
  Video,
  HelpCircle,
  FileText,
  Sparkles,
  Flame,
  CheckCircle2,
  Layers,
  LogOut,
  Settings2,
  Tag,
  X,
} from 'lucide-react';
import useSWR from 'swr';
import { useNotification } from '@/context/NotificationContext';

interface QuestionsClientProps {
  roomId: string;
}

export function QuestionsClient({ roomId }: QuestionsClientProps) {
  const router = useRouter();
  const { toast, confirm: confirmModal } = useNotification();
  const { data: questions = [], isLoading: loading, mutate: mutateQuestions } = useSWR(
    ['questions_list', roomId],
    () => getRoomQuestions(roomId)
  );
  const { data: room, mutate: mutateRoom } = useSWR(
    ['room_data', roomId],
    () => getRoom(roomId)
  );

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [roundFilter, setRoundFilter] = useState<string>('all');

  // Form states
  const [roundType, setRoundType] = useState<'normal' | 'rapid_fire'>('normal');
  const [roundName, setRoundName] = useState('');
  const [setName, setSetName] = useState('Set A');
  const [questionNumber, setQuestionNumber] = useState<number | undefined>(undefined);
  const [showRoundManager, setShowRoundManager] = useState(false);
  const [newRoundInput, setNewRoundInput] = useState('');
  const [qtype, setQtype] = useState<'text' | 'mcq' | 'video' | 'audio'>('text');
  const [prompt, setPrompt] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [points, setPoints] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(undefined);
  const [rapidFireNumber, setRapidFireNumber] = useState<number | undefined>(undefined);

  // MCQ options
  const [mcqOptions, setMcqOptions] = useState<string[]>(['', '', '', '']);

  // Extract all distinct configured & assigned round names
  const configuredRounds = useMemo(() => {
    const list = new Set<string>();
    (room?.customRounds || []).forEach((r) => {
      if (r && r.trim()) list.add(r.trim());
    });
    questions.forEach((q) => {
      if (q.roundName && q.roundName.trim()) list.add(q.roundName.trim());
    });
    return Array.from(list);
  }, [room?.customRounds, questions]);

  // Extract all distinct rapid fire sets
  const configuredSets = useMemo(() => {
    const list = new Set<string>(['Set A', 'Set B', 'Set C']);
    questions.forEach((q) => {
      if (q.setName && q.setName.trim()) list.add(q.setName.trim());
    });
    return Array.from(list);
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (roundFilter === 'all') return questions;
    if (roundFilter === 'rapid_fire') return questions.filter((q) => q.roundType === 'rapid_fire');
    if (roundFilter === 'normal') return questions.filter((q) => q.roundType === 'normal');
    if (roundFilter.startsWith('set:')) {
      const targetSet = roundFilter.replace('set:', '');
      return questions.filter((q) => q.setName === targetSet);
    }
    return questions.filter((q) => q.roundName === roundFilter);
  }, [questions, roundFilter]);

  const handleAdminLogout = async () => {
    const confirmed = await confirmModal({
      title: 'Log Out Host Session?',
      message: 'You will need to enter your Security PIN to regain access to this room.',
      confirmText: 'Log Out',
      cancelText: 'Stay Here',
      variant: 'warning',
      icon: 'logout',
    });
    if (!confirmed) return;

    try {
      await logoutAdminAction();
      toast.info('Logged Out', 'Host session has been closed.');
      router.push('/admin/login');
    } catch (err) {
      toast.error('Logout Failed', (err as Error).message);
    }
  };

  const handleAddRound = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      await addRoomRound(roomId, clean);
      toast.success('Round Created', `"${clean}" has been added to room rounds.`);
      setNewRoundInput('');
      setRoundName(clean);
      if (/rapid/i.test(clean)) {
        setRoundType('rapid_fire');
      }
      await mutateRoom();
    } catch (err) {
      toast.error('Failed to Add Round', (err as Error).message);
    }
  };

  const handleDeleteRound = async (name: string) => {
    const confirmed = await confirmModal({
      title: 'Remove Round?',
      message: `Are you sure you want to remove "${name}" from this room? Existing questions will remain in the question bank.`,
      confirmText: 'Remove Round',
      cancelText: 'Keep Round',
      variant: 'warning',
      icon: 'trash',
    });
    if (!confirmed) return;

    try {
      await deleteRoomRound(roomId, name);
      toast.info('Round Removed', `"${name}" removed from room rounds.`);
      if (roundName === name) {
        setRoundName('');
      }
      if (roundFilter === name) {
        setRoundFilter('all');
      }
      await mutateRoom();
    } catch (err) {
      toast.error('Failed to Remove Round', (err as Error).message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload media');
      }

      setMediaUrl(data.url);
      setSuccess('Media uploaded');
      toast.success('Media Uploaded', 'File attached to current question draft.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!prompt.trim()) {
      setError('Prompt is required.');
      toast.warning('Validation Error', 'Question prompt is required.');
      return;
    }
    if (!correctAnswer.trim()) {
      setError('Answer is required.');
      toast.warning('Validation Error', 'Correct answer is required.');
      return;
    }

    if (qtype === 'mcq') {
      const validOptions = mcqOptions.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        setError('MCQ requires at least 2 options.');
        toast.warning('Validation Error', 'MCQ requires at least 2 options.');
        return;
      }
      if (!validOptions.includes(correctAnswer.trim())) {
        setError('Answer must match one MCQ option.');
        toast.warning('Validation Error', 'Correct answer must match one MCQ option.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createQuestion({
        roomId,
        roundType,
        roundName: roundName.trim() || undefined,
        setName: roundType === 'rapid_fire' ? (setName.trim() || 'Set A') : undefined,
        qtype,
        prompt,
        correctAnswer,
        options: qtype === 'mcq' ? mcqOptions.filter((o) => o.trim().length > 0) : undefined,
        mediaUrl: mediaUrl.trim() || undefined,
        points,
        timerSeconds: timerSeconds || undefined,
        number: questionNumber || (roundType === 'rapid_fire' ? rapidFireNumber : undefined),
      });

      // Reset form fields but keep roundName/setName selected for batch question entry
      setPrompt('');
      setCorrectAnswer('');
      setMediaUrl('');
      setMcqOptions(['', '', '', '']);
      setTimerSeconds(undefined);
      setQuestionNumber(undefined);
      if (roundType === 'rapid_fire') {
        setRapidFireNumber((prev) => (prev ? prev + 1 : undefined));
      }
      setSuccess('Question saved');
      toast.success(
        'Question Saved',
        roundType === 'rapid_fire'
          ? `Added to ${setName.trim() || 'Set A'}.`
          : roundName.trim()
          ? `Added to "${roundName.trim()}" round.`
          : 'Added to question bank.'
      );
      setTimeout(() => setSuccess(''), 3000);

      await Promise.all([mutateQuestions(), mutateRoom()]);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error('Save Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, promptText?: string) => {
    const confirmed = await confirmModal({
      title: 'Delete Question?',
      message: promptText
        ? `Are you sure you want to delete "${promptText.slice(0, 60)}..."?`
        : 'Are you sure you want to delete this question from the bank?',
      confirmText: 'Delete Question',
      cancelText: 'Keep Question',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    try {
      await deleteQuestion(id);
      toast.success('Question Deleted', 'Removed from question bank.');
      await mutateQuestions();
    } catch (err) {
      toast.error('Delete Failed', (err as Error).message);
    }
  };

  const handleReset = async (id: string) => {
    try {
      await resetQuestionStatus(id);
      toast.info('Status Reset', 'Question marked as unused.');
      await mutateQuestions();
    } catch (err) {
      toast.error('Reset Failed', (err as Error).message);
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 p-3 sm:p-5 relative flex flex-col justify-between selection:bg-blue-500/20">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[500px] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-indigo-400/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4 pb-3 border-b border-blue-200/60 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/room/${roomId}`}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-blue-100 text-slate-600 hover:text-slate-900 transition shadow-2xs"
            title="Return to Host Console"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              Question Bank Studio
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Create questions &amp; media library</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 font-medium hidden md:inline">
              {error}
            </span>
          )}
          {success && (
            <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 font-medium hidden md:inline">
              {success}
            </span>
          )}

          <Link
            href={`/admin/room/${roomId}`}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-blue-100 text-xs font-bold text-slate-700 transition shadow-2xs"
          >
            Host Console
          </Link>
          <button
            type="button"
            onClick={handleAdminLogout}
            title="Log out from Host session"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-blue-100 hover:border-rose-200 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Split Workspace */}
      <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 my-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch overflow-hidden pt-3 z-10">
        {/* Left 5 cols: Add Question Form Card */}
        <section className="lg:col-span-5 bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl p-4 sm:p-5 shadow-[0_15px_40px_rgba(30,58,138,0.06)] flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-black text-slate-900">Add Question</h2>
          </div>

          <form onSubmit={handleCreate} className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
            {/* Custom Round Setup & Selection Card */}
            <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Round Setup &amp; Name
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoundManager(!showRoundManager)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>{showRoundManager ? 'Close Setup' : 'Manage Rounds'}</span>
                </button>
              </div>

              {/* Round Manager Drawer */}
              {showRoundManager && (
                <div className="p-2.5 rounded-xl bg-white border border-blue-200 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Configured Rounds</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{configuredRounds.length} round(s)</span>
                  </div>

                  {configuredRounds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {configuredRounds.map((r) => (
                        <div
                          key={r}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                        >
                          <span className="truncate max-w-[140px]">{r}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRound(r)}
                            title={`Delete "${r}"`}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No custom rounds setup yet. Add one below:</p>
                  )}

                  <div className="flex gap-1.5 pt-1 border-t border-slate-100">
                    <input
                      type="text"
                      value={newRoundInput}
                      onChange={(e) => setNewRoundInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRound(newRoundInput);
                        }
                      }}
                      placeholder="e.g. Round 1: General Knowledge"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddRound(newRoundInput)}
                      disabled={!newRoundInput.trim()}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}

              {/* Round Input / Selector with Datalist */}
              <div className="space-y-1.5">
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    list="rounds-datalist"
                    value={roundName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoundName(val);
                      if (/rapid/i.test(val)) {
                        setRoundType('rapid_fire');
                      }
                    }}
                    placeholder="Enter or pick round name (e.g. Round 1: General Knowledge)..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold shadow-2xs"
                  />
                  <datalist id="rounds-datalist">
                    {configuredRounds.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>

                  {roundName && (
                    <button
                      type="button"
                      onClick={() => setRoundName('')}
                      className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      title="Clear round selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Selection Chips */}
                {configuredRounds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-slate-500 font-bold mr-0.5">Quick Pick:</span>
                    {configuredRounds.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRoundName(r);
                          if (/rapid/i.test(r)) {
                            setRoundType('rapid_fire');
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          roundName === r
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mode & Format Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Round Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoundType('normal')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                      roundType === 'normal'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Normal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoundType('rapid_fire')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                      roundType === 'rapid_fire'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 border border-amber-500'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Rapid Fire</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Format
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['text', 'mcq', 'video', 'audio'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQtype(t)}
                      className={`py-2 rounded-2xl text-xs font-black uppercase transition flex flex-col items-center gap-1 ${
                        qtype === t
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-500'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                      }`}
                    >
                      {t === 'text' && <FileText className="w-3.5 h-3.5" />}
                      {t === 'mcq' && <HelpCircle className="w-3.5 h-3.5" />}
                      {t === 'video' && <Video className="w-3.5 h-3.5" />}
                      {t === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rapid Fire Set Assignment */}
            {roundType === 'rapid_fire' && (
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                    <label className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                      Rapid Fire Set Assignment
                    </label>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    Each team selects one unique set
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    list="sets-datalist"
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    placeholder="e.g. Set A, Set B, Set C..."
                    className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-amber-950 placeholder:text-amber-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-semibold shadow-2xs"
                  />
                  <datalist id="sets-datalist">
                    {configuredSets.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-amber-800 font-bold mr-0.5">Quick Pick:</span>
                  {configuredSets.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSetName(s)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        setName === s
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-amber-900 hover:bg-amber-100 border border-amber-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  {['Set A', 'Set B', 'Set C', 'Set D'].map((s) => {
                    if (configuredSets.includes(s)) return null;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSetName(s)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          setName === s
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-amber-900 hover:bg-amber-100 border border-amber-300'
                        }`}
                      >
                        + {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Prompt
              </label>
              <textarea
                required
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter question text..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-sm transition shadow-2xs"
              />
            </div>

            {/* Media Upload */}
            {(qtype === 'video' || qtype === 'audio') && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-center gap-2 transition shadow-2xs">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept={qtype === 'video' ? 'video/*' : 'audio/*'}
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>

                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="or paste direct URL..."
                    className="flex-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {mediaUrl && (
                  <p className="text-xs text-emerald-700 font-medium truncate">Attached: {mediaUrl}</p>
                )}
              </div>
            )}

            {/* MCQ Options */}
            {qtype === 'mcq' && (
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Multiple Choice Options
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {mcqOptions.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shrink-0">
                          {letter}
                        </span>
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => {
                            const copy = [...mcqOptions];
                            copy[idx] = e.target.value;
                            setMcqOptions(copy);
                          }}
                          placeholder={`Option ${letter}`}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Correct Answer */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Correct Answer
              </label>
              {qtype === 'mcq' ? (
                <select
                  required
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 font-medium shadow-2xs"
                >
                  <option value="">
                    -- Select Option --
                  </option>
                  {mcqOptions
                    .filter((o) => o.trim().length > 0)
                    .map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {String.fromCharCode(65 + idx)}: {opt}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="Answer key"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium shadow-2xs"
                />
              )}
            </div>

            {/* Points & Timer & Question Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Timer (Sec)
                </label>
                <input
                  type="number"
                  placeholder={roundType === 'rapid_fire' ? 'Auto (Set Timeline)' : 'Default'}
                  value={timerSeconds ?? ''}
                  onChange={(e) =>
                    setTimerSeconds(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {roundType === 'rapid_fire' ? 'Set Q / Tile #' : 'Question # in Round'}
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder={roundType === 'rapid_fire' ? 'Auto (Next in Set)' : 'Auto (#1, #2...)'}
                  value={questionNumber ?? (roundType === 'rapid_fire' ? rapidFireNumber ?? '' : '')}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    setQuestionNumber(val);
                    if (roundType === 'rapid_fire') setRapidFireNumber(val);
                  }}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 ${
                    roundType === 'rapid_fire'
                      ? 'bg-amber-50/60 border-amber-300 text-amber-900 placeholder:text-amber-400 focus:border-amber-500 focus:ring-amber-100'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-black text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Save Question</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Question Bank List Card */}
        <section className="lg:col-span-7 bg-white/85 backdrop-blur-2xl border border-blue-100 rounded-3xl p-4 sm:p-5 shadow-[0_15px_40px_rgba(30,58,138,0.06)] flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-blue-200/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-black text-slate-900">
                Questions ({questions.length})
              </h2>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setRoundFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 ${
                  roundFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({questions.length})
              </button>

              {configuredRounds.map((r) => {
                const count = questions.filter((q) => q.roundName === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoundFilter(r)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 max-w-[130px] truncate ${
                      roundFilter === r
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={r}
                  >
                    {r} ({count})
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setRoundFilter('rapid_fire')}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 ${
                  roundFilter === 'rapid_fire'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Rapid ({questions.filter((q) => q.roundType === 'rapid_fire').length})
              </button>

              {configuredSets.map((s) => {
                const count = questions.filter((q) => q.setName === s).length;
                if (count === 0) return null;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRoundFilter(`set:${s}`)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shrink-0 ${
                      roundFilter === `set:${s}`
                        ? 'bg-white text-amber-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium my-auto">Loading bank...</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium my-auto bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No questions found for this round filter. Add some on the left.
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-50/80 border border-blue-100 hover:border-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition shadow-2xs"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {q.qtype}
                      </span>
                      {q.roundType === 'rapid_fire' ? (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5 text-amber-600" />
                          <span>{q.setName || 'Rapid Fire'} &bull; #{q.number ?? 1}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[200px]">
                          {q.roundName ? `${q.roundName} • ` : ''}#{q.number ?? 1}
                        </span>
                      )}
                      <span className="text-[10px] font-black text-indigo-600">
                        {q.points} PTS
                      </span>
                      {q.timerSeconds && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {q.timerSeconds}s
                        </span>
                      )}
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                          q.status === 'done'
                            ? 'bg-slate-100 text-slate-500'
                            : q.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{q.prompt}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold truncate">
                      Ans: {q.correctAnswer}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleReset(q.id)}
                      title="Reset Status"
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id, q.prompt)}
                      title="Delete Question"
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="text-center text-[10px] uppercase tracking-wider text-slate-400 py-1 shrink-0">
        Bluefox Quiz &bull; Question Management Studio
      </footer>
    </div>
  );
}

