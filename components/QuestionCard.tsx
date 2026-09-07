'use client';

import { SafeQuestion } from '@/lib/useGameState';
import { Question } from '@/lib/db/schema';
import { Volume2, Video, HelpCircle, CheckCircle2, Award } from 'lucide-react';

interface QuestionCardProps {
  question: SafeQuestion | Question;
  showAnswer?: boolean;
}

export function QuestionCard({ question, showAnswer = false }: QuestionCardProps) {
  const fullQuestion = question as Question;
  const isMcq = question.qtype === 'mcq' && Array.isArray(question.options);
  const options = question.options ?? [];

  return (
    <div className="w-full bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative overflow-hidden transition-all duration-300">
      {/* Ambient internal card glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top badges bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/25 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            {question.qtype === 'mcq' && <HelpCircle className="w-3.5 h-3.5" />}
            {question.qtype === 'video' && <Video className="w-3.5 h-3.5" />}
            {question.qtype === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
            {question.qtype.toUpperCase()}
          </span>
          {question.roundType === 'rapid_fire' && (
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              #{question.number}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] border border-blue-400/30">
            <Award className="w-3.5 h-3.5 text-blue-200" />
            <span>{question.points} PTS</span>
          </span>
        </div>
      </div>

      {/* Question Prompt */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-8 tracking-tight drop-shadow-sm relative z-10">
        {question.prompt}
      </h2>

      {/* Media Container */}
      {question.mediaUrl && (
        <div className="mb-8 rounded-2xl overflow-hidden bg-black/60 border border-white/[0.08] shadow-2xl flex justify-center items-center relative z-10">
          {question.qtype === 'video' ? (
            <video
              src={question.mediaUrl}
              muted
              autoPlay
              playsInline
              controls
              className="max-h-[420px] w-full object-contain rounded-xl"
            />
          ) : question.qtype === 'audio' ? (
            <div className="w-full p-6 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-blue-950/40 to-black/80">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                <Volume2 className="w-6 h-6 animate-pulse" />
              </div>
              <audio src={question.mediaUrl} controls autoPlay className="w-full max-w-md accent-blue-500" />
            </div>
          ) : null}
        </div>
      )}

      {/* MCQ Options Grid */}
      {isMcq && options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative z-10">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = showAnswer && fullQuestion.correctAnswer === opt;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                  isCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] text-zinc-200'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black shrink-0 transition-all ${
                    isCorrect
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                      : 'bg-white/[0.05] border border-white/[0.08] text-zinc-300'
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1 font-semibold text-base sm:text-lg leading-snug">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Host Answer Key (Admin only) */}
      {showAnswer && fullQuestion.correctAnswer && (
        <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative z-10">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest block text-emerald-400/80">
              Host Answer Key
            </span>
            <span className="text-base sm:text-lg font-black text-white">{fullQuestion.correctAnswer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

