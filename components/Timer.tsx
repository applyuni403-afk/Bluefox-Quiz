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
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 border border-slate-200 text-slate-500 font-mono text-xs font-semibold shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>00:00</span>
      </div>
    );
  }

  const isLg = size === 'lg';
  const isSm = size === 'sm';

  let colorClasses = '';
  if (isExpired) {
    colorClasses =
      'bg-rose-50 border-rose-300 text-rose-600 shadow-sm shadow-rose-500/10';
  } else if (isCritical) {
    colorClasses =
      'bg-amber-50 border-amber-300 text-amber-700 shadow-sm shadow-amber-500/10 animate-pulse';
  } else {
    colorClasses =
      'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm shadow-emerald-500/10';
  }

  return (
    <div
      className={`inline-flex items-center justify-center border font-mono font-black tracking-wider transition-all duration-300 backdrop-blur-md ${colorClasses} ${
        isLg
          ? 'px-7 py-3 rounded-2xl text-4xl sm:text-5xl gap-3.5'
          : isSm
          ? 'px-3 py-1 rounded-full text-sm gap-1.5'
          : 'px-5 py-2 rounded-xl text-xl sm:text-2xl gap-2.5'
      }`}
    >
      {isExpired ? (
        <AlertTriangle className={isLg ? 'w-8 h-8 text-rose-600' : 'w-4 h-4 text-rose-600'} />
      ) : (
        <Clock
          className={`${isLg ? 'w-7 h-7' : 'w-4 h-4'} ${
            isRunning ? 'animate-spin text-current opacity-80' : 'opacity-60'
          }`}
          style={{ animationDuration: '6s' }}
        />
      )}
      <span>{isExpired ? '00:00' : formatted}</span>
      {isExpired && (
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-sans">
          Time
        </span>
      )}
    </div>
  );
}

