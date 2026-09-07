'use client';

import { useTimer } from '@/lib/useTimer';
import { Clock, AlertCircle } from 'lucide-react';

interface TimerProps {
  endsAt: string | Date | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function Timer({ endsAt, size = 'md' }: TimerProps) {
  const { formatted, isCritical, isExpired, isRunning } = useTimer(endsAt);

  if (endsAt === null || endsAt === undefined) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-mono text-sm font-semibold">
        <Clock className="w-4 h-4" />
        <span>Timer Paused</span>
      </div>
    );
  }

  const isLg = size === 'lg';
  const isSm = size === 'sm';

  const colorStyles = isExpired
    ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
    : isCritical
    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 animate-pulse'
    : 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400';

  return (
    <div
      className={`inline-flex items-center justify-center border font-mono font-black transition-all duration-200 ${colorStyles} ${
        isLg
          ? 'px-8 py-4 rounded-2xl text-4xl sm:text-6xl gap-4 shadow-lg'
          : isSm
          ? 'px-3 py-1.5 rounded-lg text-lg gap-1.5'
          : 'px-5 py-2.5 rounded-xl text-2xl gap-2.5 shadow-sm'
      }`}
    >
      {isExpired ? (
        <AlertCircle className={isLg ? 'w-10 h-10' : 'w-5 h-5'} />
      ) : (
        <Clock
          className={`${isLg ? 'w-10 h-10' : 'w-5 h-5'} ${
            isRunning ? 'animate-spin text-current' : ''
          }`}
          style={{ animationDuration: '4s' }}
        />
      )}
      <span>{isExpired ? '00:00' : formatted}</span>
      {isExpired && (
        <span className="text-xs uppercase tracking-widest font-sans ml-2 font-bold opacity-80">
          Time&apos;s Up!
        </span>
      )}
    </div>
  );
}
