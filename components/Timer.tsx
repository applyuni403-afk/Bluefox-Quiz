'use client';

import { useTimer } from '@/lib/useTimer';
import { Clock, AlertTriangle } from 'lucide-react';

interface TimerProps {
  endsAt: string | Date | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function Timer({ endsAt, size = 'md' }: TimerProps) {
  const { formatted, isCritical, isExpired, isRunning } = useTimer(endsAt);

  if (endsAt === null || endsAt === undefined) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-500 font-mono text-xs font-semibold backdrop-blur-md">
        <Clock className="w-3.5 h-3.5 text-zinc-600" />
        <span>00:00</span>
      </div>
    );
  }

  const isLg = size === 'lg';
  const isSm = size === 'sm';

  let colorClasses = '';
  if (isExpired) {
    colorClasses =
      'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.25)]';
  } else if (isCritical) {
    colorClasses =
      'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-pulse';
  } else {
    colorClasses =
      'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.15)]';
  }

  return (
    <div
      className={`inline-flex items-center justify-center border font-mono font-black tracking-wider transition-all duration-300 backdrop-blur-xl ${colorClasses} ${
        isLg
          ? 'px-7 py-3 rounded-2xl text-4xl sm:text-5xl gap-3.5'
          : isSm
          ? 'px-3 py-1 rounded-full text-sm gap-1.5'
          : 'px-5 py-2 rounded-xl text-xl sm:text-2xl gap-2.5'
      }`}
    >
      {isExpired ? (
        <AlertTriangle className={isLg ? 'w-8 h-8 text-rose-400' : 'w-4 h-4 text-rose-400'} />
      ) : (
        <Clock
          className={`${isLg ? 'w-7 h-7' : 'w-4 h-4'} ${
            isRunning ? 'animate-spin text-current opacity-80' : 'opacity-60'
          }`}
          style={{ animationDuration: '6s' }}
        />
      )}
      <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
        {isExpired ? '00:00' : formatted}
      </span>
      {isExpired && (
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-sans">
          Time
        </span>
      )}
    </div>
  );
}

