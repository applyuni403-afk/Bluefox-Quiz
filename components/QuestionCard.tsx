'use client';

import { SafeQuestion } from '@/lib/useGameState';
import { Question } from '@/lib/db/schema';
import { Volume2, Video, HelpCircle, CheckCircle2 } from 'lucide-react';

interface QuestionCardProps {
  question: SafeQuestion | Question;
  showAnswer?: boolean;
}

export function QuestionCard({ question, showAnswer = false }: QuestionCardProps) {
  const fullQuestion = question as Question;
  const isMcq = question.qtype === 'mcq' && Array.isArray(question.options);
  const options = question.options ?? [];

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden transition-all">
      {/* Top badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {question.qtype === 'mcq' && <HelpCircle className="w-3.5 h-3.5" />}
            {question.qtype === 'video' && <Video className="w-3.5 h-3.5" />}
            {question.qtype === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
            {question.qtype.toUpperCase()}
          </span>
          {question.roundType === 'rapid_fire' && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Q #{question.number}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1 rounded-full text-sm font-extrabold bg-indigo-600 text-white shadow-sm">
            {question.points} PTS
          </span>
        </div>
      </div>

      {/* Prompt */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight mb-6">
        {question.prompt}
      </h2>

      {/* Media Player */}
      {question.mediaUrl && (
        <div className="mb-6 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex justify-center items-center">
          {question.qtype === 'video' ? (
            <video
              src={question.mediaUrl}
              muted
              autoPlay
              playsInline
              controls
              className="max-h-[380px] w-full object-contain rounded-lg"
            />
          ) : question.qtype === 'audio' ? (
            <div className="w-full p-6 flex flex-col items-center justify-center gap-3 bg-gradient-to-r from-blue-950 to-indigo-950">
              <Volume2 className="w-10 h-10 text-blue-400 animate-pulse" />
              <audio src={question.mediaUrl} controls autoPlay className="w-full max-w-md" />
            </div>
          ) : null}
        </div>
      )}

      {/* MCQ Options */}
      {isMcq && options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = showAnswer && fullQuestion.correctAnswer === opt;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 p-4 rounded-xl border text-base sm:text-lg font-medium transition-all ${
                  isCorrect
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold ring-2 ring-emerald-500'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0 ${
                    isCorrect
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Correct Answer Display for Host/Admin only */}
      {showAnswer && fullQuestion.correctAnswer && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block opacity-75">
              Host Answer Key:
            </span>
            <span className="text-lg font-extrabold">{fullQuestion.correctAnswer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
