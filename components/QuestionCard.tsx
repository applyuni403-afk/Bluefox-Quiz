'use client';

import { SafeQuestion } from '@/lib/useGameState';
import { Question } from '@/lib/db/schema';
import { Volume2, Video, HelpCircle, CheckCircle2, Award } from 'lucide-react';

interface QuestionCardProps {
  question: SafeQuestion | Question;
  showAnswer?: boolean;
  revealedAnswer?: string | null;
  selectedOption?: string | null;
  interactive?: boolean;
  onSelectOption?: (option: string) => void;
}

export function QuestionCard({
  question,
  showAnswer = false,
  revealedAnswer: propRevealedAnswer,
  selectedOption = null,
  interactive = false,
  onSelectOption,
}: QuestionCardProps) {
  const fullQuestion = question as Question;
  const safeQuestion = question as SafeQuestion;
  const isMcq = question.qtype === 'mcq' && Array.isArray(question.options);
  const options = question.options ?? [];
  const revealedAnswer = propRevealedAnswer ?? safeQuestion.revealedAnswer ?? (showAnswer ? fullQuestion.correctAnswer : null);

  return (
    <div className="w-full bg-white/90 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-4 sm:p-6 shadow-[0_15px_40px_rgba(30,58,138,0.06)] relative overflow-hidden transition-all duration-200">
      {/* Ambient internal card glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top badges bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 pb-2.5 border-b border-slate-100 relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            {question.qtype === 'mcq' && <HelpCircle className="w-3 h-3" />}
            {question.qtype === 'video' && <Video className="w-3 h-3" />}
            {question.qtype === 'audio' && <Volume2 className="w-3 h-3" />}
            {question.qtype.toUpperCase()}
          </span>
          {question.roundName && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              {question.roundName}
            </span>
          )}
          {question.setName && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
              {question.setName}
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            #{question.number}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
            <Award className="w-3 h-3 text-blue-100" />
            <span>{question.points} PTS</span>
          </span>
        </div>
      </div>

      {/* Question Prompt */}
      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 leading-snug mb-4 tracking-tight relative z-10">
        {question.prompt}
      </h2>

      {/* Media Container */}
      {question.mediaUrl && (
        <div className="mb-4 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-md flex justify-center items-center relative z-10 max-h-[260px]">
          {question.qtype === 'video' ? (
            <video
              src={question.mediaUrl}
              muted
              autoPlay
              playsInline
              controls
              className="max-h-[250px] w-full object-contain rounded-xl"
            />
          ) : question.qtype === 'audio' ? (
            <div className="w-full p-4 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-blue-50 to-indigo-50 border border-blue-100">
              <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <audio src={question.mediaUrl} controls autoPlay className="w-full max-w-md accent-blue-600" />
            </div>
          ) : null}
        </div>
      )}

      {/* MCQ Options Grid */}
      {isMcq && options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = (showAnswer && fullQuestion.correctAnswer === opt) || (revealedAnswer && revealedAnswer === opt);
            const isSelected = selectedOption === opt;

            const canClick = interactive && !revealedAnswer && onSelectOption;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (canClick) onSelectOption(opt);
                }}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all duration-200 ${
                  isCorrect
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-300'
                    : isSelected
                    ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-300 shadow-xs'
                    : canClick
                    ? 'bg-slate-50/80 border-slate-200 hover:border-blue-300 hover:bg-white text-slate-800 shadow-2xs cursor-pointer active:scale-98'
                    : 'bg-slate-50/80 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black shrink-0 transition-all ${
                    isCorrect
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1 font-semibold text-xs sm:text-sm leading-snug">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Revealed Correct Answer Banner (Visible to all participants when question concludes) */}
      {revealedAnswer && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-2 border-emerald-300 flex items-center gap-3 text-emerald-900 shadow-sm relative z-10 animate-fade-in">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest block text-emerald-700">
              Question Concluded &bull; Correct Answer
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900">{revealedAnswer}</span>
          </div>
        </div>
      )}

      {/* Host Answer Key (Admin only when not revealed) */}
      {!revealedAnswer && showAnswer && fullQuestion.correctAnswer && (
        <div className="mt-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-2.5 text-indigo-900 shadow-xs relative z-10">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest block text-indigo-700/90">
              Host Answer Key
            </span>
            <span className="text-sm font-black text-slate-900">{fullQuestion.correctAnswer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

