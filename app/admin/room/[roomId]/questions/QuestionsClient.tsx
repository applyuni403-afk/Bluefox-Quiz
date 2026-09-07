'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  createQuestion,
  deleteQuestion,
  resetQuestionStatus,
  getRoomQuestions,
} from '@/lib/actions';
import {
  ArrowLeft,
  PlusCircle,
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
      setSuccess('Media uploaded to Vercel Blob successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        (err as Error).message +
          ' (Tip: You can also paste a direct public video/audio URL below)'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!prompt.trim()) {
      setError('Please provide a question prompt.');
      return;
    }
    if (!correctAnswer.trim()) {
      setError('Please provide the correct answer.');
      return;
    }

    if (qtype === 'mcq') {
      const validOptions = mcqOptions.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        setError('MCQ questions require at least 2 options.');
        return;
      }
      if (!validOptions.includes(correctAnswer.trim())) {
        setError('Correct answer must match one of the MCQ options.');
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
      setSuccess('Question added successfully!');
      setTimeout(() => setSuccess(''), 3000);

      await mutateQuestions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
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
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/room/${roomId}`}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Question Bank Editor</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Create and manage text, MCQ, video, and audio questions for normal and rapid fire rounds.
              </p>
            </div>
          </div>

          <Link
            href={`/admin/room/${roomId}`}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition"
          >
            Back to Host Controls
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Add Question Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-extrabold">Create New Question</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {/* Round & Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Round Category
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRoundType('normal')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      roundType === 'normal'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Normal Round</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoundType('rapid_fire')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      roundType === 'rapid_fire'
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    <span>Rapid Fire Round</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Question Format
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['text', 'mcq', 'video', 'audio'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQtype(t)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold uppercase transition flex flex-col items-center gap-1 ${
                        qtype === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      {t === 'text' && <FileText className="w-3.5 h-3.5" />}
                      {t === 'mcq' && <HelpCircle className="w-3.5 h-3.5" />}
                      {t === 'video' && <Video className="w-3.5 h-3.5" />}
                      {t === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Question Prompt
              </label>
              <textarea
                required
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What is the capital city of Australia?"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Media Upload (for video / audio) */}
            {(qtype === 'video' || qtype === 'audio') && (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {qtype === 'video' ? 'Video File (MP4 / WebM)' : 'Audio File (MP3 / WAV)'}
                </label>

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer flex items-center justify-center gap-2 transition">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Uploading to Blob...' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept={qtype === 'video' ? 'video/*' : 'audio/*'}
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>

                  <span className="text-xs text-zinc-500">or enter direct URL:</span>

                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://.../video.mp4"
                    className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {mediaUrl && (
                  <p className="text-xs text-emerald-400 truncate">
                    Attached media: {mediaUrl}
                  </p>
                )}
              </div>
            )}

            {/* MCQ Options (if format is MCQ) */}
            {qtype === 'mcq' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Multiple Choice Options
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mcqOptions.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300 shrink-0">
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
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Correct Answer */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Correct Answer
              </label>
              {qtype === 'mcq' ? (
                <select
                  required
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Select Correct Option --</option>
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
                  placeholder="e.g. Canberra"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              )}
            </div>

            {/* Points & Timer Overrides & Board Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 10)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Timer Override (Sec)
                </label>
                <input
                  type="number"
                  placeholder="Leave blank for room default"
                  value={timerSeconds ?? ''}
                  onChange={(e) =>
                    setTimerSeconds(
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {roundType === 'rapid_fire' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Board Tile #
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1, 2, 3..."
                    value={rapidFireNumber ?? ''}
                    onChange={(e) =>
                      setRapidFireNumber(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-extrabold text-white shadow-xl shadow-blue-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>Save Question to Bank</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Question Bank Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-extrabold mb-4">
            Room Question Bank ({questions.length})
          </h2>

          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No questions created yet. Use the form above to populate questions.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
                        {q.qtype}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-900/60 text-blue-300">
                        {q.roundType === 'rapid_fire'
                          ? `Rapid Fire #${q.number}`
                          : 'Normal'}
                      </span>
                      <span className="text-xs font-bold text-indigo-400">
                        {q.points} PTS
                      </span>
                      {q.timerSeconds && (
                        <span className="text-xs text-zinc-400">
                          {q.timerSeconds}s
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          q.status === 'done'
                            ? 'bg-zinc-800 text-zinc-400'
                            : q.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <p className="font-bold text-white text-base">{q.prompt}</p>
                    <p className="text-xs text-emerald-400 font-semibold">
                      Answer: {q.correctAnswer}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReset(q.id)}
                      title="Reset status to unused"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      title="Delete question"
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
