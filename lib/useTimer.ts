'use client';

import { useState, useEffect } from 'react';

export interface TimerState {
  secondsLeft: number | null;
  formatted: string;
  isExpired: boolean;
  isCritical: boolean;
  isRunning: boolean;
}

export function formatTime(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function useTimer(endsAt: string | Date | null | undefined): TimerState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt]);

  const targetTime = endsAt ? new Date(endsAt).getTime() : null;
  const secondsLeft =
    targetTime && !isNaN(targetTime)
      ? Math.max(0, Math.ceil((targetTime - now) / 1000))
      : null;

  const isRunning = secondsLeft !== null && secondsLeft > 0;
  const isExpired = secondsLeft === 0;
  const isCritical = secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0;

  return {
    secondsLeft,
    formatted: formatTime(secondsLeft),
    isExpired,
    isCritical,
    isRunning,
  };
}
