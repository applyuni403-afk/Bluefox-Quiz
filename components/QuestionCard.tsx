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
    <div className="w-full bg-white/90 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(30,58,138,0.08)] relative overflow-hidden transition-all duration-300">
      {/* Ambient internal card glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top badges bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 relative z-10">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            {question.qtype === 'mcq' && <HelpCircle className="w-3.5 h-3.5" />}
            {question.qtype === 'video' && <Video className="w-3.5 h-3.5" />}
            {question.qtype === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
            {question.qtype.toUpperCase()}
          </span>
          {question.roundType === 'rapid_fire' && (
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              #{question.number}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
            <Award className="w-3.5 h-3.5 text-blue-100" />
            <span>{question.points} PTS</span>
          </span>
        </div>
      </div>

      {/* Question Prompt */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-8 tracking-tight relative z-10">
        {question.prompt}
      </h2>

      {/* Media Container */}
      {question.mediaUrl && (
        <div className="mb-8 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-lg flex justify-center items-center relative z-10">
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
            <div className="w-full p-6 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-blue-50 to-indigo-50 border border-blue-100">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Volume2 className="w-6 h-6 animate-pulse" />
              </div>
              <audio src={question.mediaUrl} controls autoPlay className="w-full max-w-md accent-blue-600" />
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
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-sm ring-1 ring-emerald-300'
                    : 'bg-slate-50/80 border-slate-200 hover:border-blue-300 hover:bg-white text-slate-800 shadow-2xs'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black shrink-0 transition-all ${
                    isCorrect
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1 font-semibold text-base sm:text-lg leading-snug">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Host Answer Key (Admin only) */}
      {showAnswer && fullQuestion.correctAnswer && (
        <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 shadow-xs relative z-10">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest block text-emerald-700/90">
              Host Answer Key
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900">{fullQuestion.correctAnswer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

