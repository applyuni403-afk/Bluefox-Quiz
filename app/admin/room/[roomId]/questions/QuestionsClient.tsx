'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  createQuestion,
  deleteQuestion,
  resetQuestionStatus,
  getRoomQuestions,
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
} from 'lucide-react';
import useSWR from 'swr';

interface QuestionsClientProps {
  roomId: string;
}

export function QuestionsClient({ roomId }: QuestionsClientProps) {
  const { data: questions = [], isLoading: loading, mutate: mutateQuestions } = useSWR(
    ['questions_list', roomId],
    () => getRoomQuestions(roomId)
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'normal' | 'rapid_fire'>('all');

  // Form states
  const [roundType, setRoundType] = useState<'normal' | 'rapid_fire'>('normal');
  const [qtype, setQtype] = useState<'text' | 'mcq' | 'video' | 'audio'>('text');
  const [prompt, setPrompt] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [points, setPoints] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(undefined);
  const [rapidFireNumber, setRapidFireNumber] = useState<number | undefined>(undefined);

  // MCQ options
  const [mcqOptions, setMcqOptions] = useState<string[]>(['', '', '', '']);

  const filteredQuestions = useMemo(() => {
    if (filter === 'all') return questions;
    return questions.filter((q) => q.roundType === filter);
  }, [questions, filter]);

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
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
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
      return;
    }
    if (!correctAnswer.trim()) {
      setError('Answer is required.');
      return;
    }

    if (qtype === 'mcq') {
      const validOptions = mcqOptions.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        setError('MCQ requires at least 2 options.');
        return;
      }
      if (!validOptions.includes(correctAnswer.trim())) {
        setError('Answer must match one MCQ option.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createQuestion({
        roomId,
        roundType,
        qtype,
        prompt,
        correctAnswer,
        options: qtype === 'mcq' ? mcqOptions.filter((o) => o.trim().length > 0) : undefined,
        mediaUrl: mediaUrl.trim() || undefined,
        points,
        timerSeconds: timerSeconds || undefined,
        number: roundType === 'rapid_fire' ? rapidFireNumber : undefined,
      });

      // Reset form
      setPrompt('');
      setCorrectAnswer('');
      setMediaUrl('');
      setMcqOptions(['', '', '', '']);
      setTimerSeconds(undefined);
      setSuccess('Question saved');
      setTimeout(() => setSuccess(''), 3000);

      await mutateQuestions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await deleteQuestion(id);
      await mutateQuestions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReset = async (id: string) => {
    try {
      await resetQuestionStatus(id);
      await mutateQuestions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090e] text-white p-4 sm:p-8 relative overflow-hidden flex flex-col items-center">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-5xl space-y-6 relative z-10">
        {/* Top Header */}
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/room/${roomId}`}
              className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 transition"
              title="Return to Host Console"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Question Bank
              </h1>
              <p className="text-xs text-zinc-400 font-medium">Manage quiz content & media</p>
            </div>
          </div>

          <Link
            href={`/admin/room/${roomId}`}
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-zinc-300 transition"
          >
            Host Console
          </Link>
        </header>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* Add Question Form Card */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-white">Add Question</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {/* Category & Format Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Round
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoundType('normal')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                      roundType === 'normal'
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] border border-blue-400/30'
                        : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.04]'
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
                        ? 'bg-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] border border-amber-400/30'
                        : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Rapid Fire</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
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
                          ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] border border-indigo-400/30'
                          : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.04]'
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

            {/* Prompt */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Prompt
              </label>
              <textarea
                required
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter question text..."
                className="w-full bg-black/40 border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-medium text-sm transition"
              />
            </div>

            {/* Media Upload */}
            {(qtype === 'video' || qtype === 'audio') && (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-2 transition">
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
                    className="flex-1 w-full bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                {mediaUrl && (
                  <p className="text-xs text-emerald-400 truncate">Attached: {mediaUrl}</p>
                )}
              </div>
            )}

            {/* MCQ Options */}
            {qtype === 'mcq' && (
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Multiple Choice Options
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {mcqOptions.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center font-black text-xs text-zinc-300 shrink-0">
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
                          className="flex-1 bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Correct Answer */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Correct Answer
              </label>
              {qtype === 'mcq' ? (
                <select
                  required
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 font-medium"
                >
                  <option value="" className="bg-zinc-900">
                    -- Select Option --
                  </option>
                  {mcqOptions
                    .filter((o) => o.trim().length > 0)
                    .map((opt, idx) => (
                      <option key={idx} value={opt} className="bg-zinc-900">
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
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 font-medium"
                />
              )}
            </div>

            {/* Points & Timer & Rapid Fire Tile */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 10)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Timer (Sec)
                </label>
                <input
                  type="number"
                  placeholder="Default"
                  value={timerSeconds ?? ''}
                  onChange={(e) =>
                    setTimerSeconds(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {roundType === 'rapid_fire' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Tile #
                  </label>
                  <input
                    type="number"
                    placeholder="1..12"
                    value={rapidFireNumber ?? ''}
                    onChange={(e) =>
                      setRapidFireNumber(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    className="w-full bg-black/40 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-black text-xs uppercase tracking-wider text-white shadow-[0_0_25px_rgba(59,130,246,0.35)] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
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
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-white">
                Questions ({questions.length})
              </h2>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
              {(['all', 'normal', 'rapid_fire'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition ${
                    filter === f
                      ? 'bg-white/[0.1] text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f === 'rapid_fire' ? 'Rapid' : f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading bank...</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No questions found. Add some above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-white/[0.05] text-zinc-300 border border-white/[0.06]">
                        {q.qtype}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {q.roundType === 'rapid_fire' ? `#${q.number}` : 'Normal'}
                      </span>
                      <span className="text-[11px] font-black text-indigo-300">
                        {q.points} PTS
                      </span>
                      {q.timerSeconds && (
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {q.timerSeconds}s
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          q.status === 'done'
                            ? 'bg-white/[0.04] text-zinc-500'
                            : q.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-300'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <p className="font-bold text-white text-sm truncate">{q.prompt}</p>
                    <p className="text-xs text-emerald-400 font-semibold truncate">
                      Ans: {q.correctAnswer}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleReset(q.id)}
                      title="Reset Status"
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06] transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      title="Delete Question"
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
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
    </main>
  );
}

