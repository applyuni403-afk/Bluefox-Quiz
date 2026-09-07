'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, unlockAudio } from '@/lib/soundEffects';
import confetti from 'canvas-confetti';
import { VolumeX, CheckCircle, XCircle } from 'lucide-react';

interface SoundPlayerProps {
  lastResult: string | null;
}

export function SoundPlayer({ lastResult }: SoundPlayerProps) {
  const prevResult = useRef<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const handleUnlockAudio = () => {
    unlockAudio();
    setAudioUnlocked(true);
  };

  useEffect(() => {
    if (lastResult && lastResult !== prevResult.current) {
      if (lastResult === 'correct') {
        playSound('clap');
        try {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
          });
        } catch {
          // ignore in SSR
        }
      } else if (lastResult === 'wrong') {
        playSound('wrong');
      }
    }
    prevResult.current = lastResult;
  }, [lastResult]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Audio Unlock Button for mobile / browser autoplay policies */}
      {!audioUnlocked && (
        <button
          type="button"
          onClick={handleUnlockAudio}
          className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-blue-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          <VolumeX className="w-3.5 h-3.5 text-amber-400" />
          <span>Tap to enable sound effects 🔊</span>
        </button>
      )}

      {/* Result Banners */}
      {lastResult === 'correct' && (
        <div className="w-full animate-bounce rounded-2xl bg-emerald-500 text-white p-4 sm:p-5 text-center shadow-xl shadow-emerald-500/20 mb-6 flex items-center justify-center gap-3">
          <CheckCircle className="w-8 h-8 sm:w-10 h-10" />
          <div>
            <span className="text-xl sm:text-3xl font-black tracking-tight block">
              🎉 CORRECT ANSWER! 🎉
            </span>
            <span className="text-xs sm:text-sm font-semibold opacity-90">
              Points awarded to the active team!
            </span>
          </div>
        </div>
      )}

      {lastResult === 'wrong' && (
        <div className="w-full animate-shake rounded-2xl bg-rose-600 text-white p-4 sm:p-5 text-center shadow-xl shadow-rose-600/20 mb-6 flex items-center justify-center gap-3">
          <XCircle className="w-8 h-8 sm:w-10 h-10" />
          <div>
            <span className="text-xl sm:text-3xl font-black tracking-tight block">
              ❌ INCORRECT!
            </span>
            <span className="text-xs sm:text-sm font-semibold opacity-90">
              Question may be passed or closed.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
