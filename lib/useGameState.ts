'use client';

import useSWR from 'swr';
import type { Room, Contestant, Question } from '@/lib/db/schema';

export type SafeQuestion = Omit<Question, 'correctAnswer'>;

export interface RapidFireTile {
  id: string;
  number: number;
  status: 'unused' | 'active' | 'done';
}

export interface GameStateResponse {
  room: Room;
  contestants: Contestant[];
  question: SafeQuestion | null;
  board: RapidFireTile[];
  error?: string;
}

const fetcher = async (url: string): Promise<GameStateResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export function useGameState(roomId: string | undefined | null) {
  const { data, error, mutate, isLoading } = useSWR<GameStateResponse>(
    roomId ? `/api/rooms/${roomId}/state` : null,
    fetcher,
    {
      refreshInterval: 1000, // Real-time sync via 1-second polling
      dedupingInterval: 500,
      revalidateOnFocus: true,
    }
  );

  return {
    data,
    room: data?.room ?? null,
    contestants: data?.contestants ?? [],
    question: data?.question ?? null,
    board: data?.board ?? [],
    error,
    mutate,
    isLoading,
  };
}
