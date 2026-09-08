'use client';
import { useEffect } from 'react';
import useSWR from 'swr';
import type { Room, Contestant, Question } from '@/lib/db/schema';

export interface SafeQuestion extends Omit<Question, 'correctAnswer'> {
  revealedAnswer?: string | null;
}

export interface RapidFireTile {
  id: string;
  number: number;
  status: 'unused' | 'active' | 'done';
}

export interface NormalRoundTile {
  id: string;
  number: number;
  status: 'unused' | 'active' | 'done';
  roundName?: string | null;
  points?: number;
}

export interface RapidFireSetItem {
  setName: string;
  questionCount: number;
  isUsed: boolean;
  usedByTeamName?: string | null;
}

export interface GameStateResponse {
  room: Room;
  contestants: Contestant[];
  question: SafeQuestion | null;
  board: RapidFireTile[];
  normalBoard?: NormalRoundTile[];
  rapidFireSets?: RapidFireSetItem[];
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
      refreshInterval: 1000, // Real-time sync via 1-second polling fallback
      dedupingInterval: 100, // Low deduping interval so manual action mutations revalidate immediately
      revalidateOnFocus: true,
    }
  );

  // Real-time SSE Push Stream for 5-20ms instant updates across all screens
  useEffect(() => {
    if (!roomId) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events`);
      es.onmessage = (event) => {
        try {
          if (event.data && event.data.startsWith('{')) {
            const fresh = JSON.parse(event.data) as GameStateResponse;
            // Instantly mutate without network re-fetch (0 ms latency)
            mutate(fresh, false);
          }
        } catch {
          // Ignore heartbeat or non-json data
        }
      };
      es.onerror = () => {
        // EventSource will automatically retry; polling handles fallback
      };
    } catch {
      // EventSource not supported
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [roomId, mutate]);

  return {
    data,
    room: data?.room ?? null,
    contestants: data?.contestants ?? [],
    question: data?.question ?? null,
    board: data?.board ?? [],
    normalBoard: data?.normalBoard ?? [],
    rapidFireSets: data?.rapidFireSets ?? [],
    error,
    mutate,
    isLoading,
  };
}

