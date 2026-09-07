export interface Room {
  id: string;
  _id: string;
  code: string; // 6-char join code, e.g. "BLUFOX"
  name: string;
  status: 'lobby' | 'playing' | 'finished';
  roundType: 'normal' | 'rapid_fire';
  currentQuestionId: string | null;
  activeContestantId: string | null; // whose turn (group, or individual in rapid fire)
  timerEndsAt: Date | null; // null = not running
  timerSeconds: number; // room default, admin-adjustable
  passCount: number;
  lastResult: string | null; // drives sounds
  version: number; // bump on every change
  createdAt: Date;
}

export interface Contestant {
  id: string;
  _id: string;
  roomId: string;
  name: string;
  kind: 'group' | 'individual'; // 'group' | 'individual' (rapid fire)
  parentGroupId: string | null; // set for individuals
  members: string[];
  score: number;
  joinOrder: number; // 1..8, drives pass rotation
  claimToken?: string | null; // unique token for device locking
  lastActiveAt?: Date | null;
  createdAt: Date;
}

export interface Question {
  id: string;
  _id: string;
  roomId: string;
  roundType: 'normal' | 'rapid_fire';
  number: number; // shown on rapid-fire board
  qtype: 'text' | 'mcq' | 'video' | 'audio';
  prompt: string;
  options: string[] | null; // ["A", "B", "C", "D"] for mcq
  correctAnswer: string;
  mediaUrl: string | null; // Vercel Blob URL for video/audio
  points: number;
  timerSeconds: number | null; // per-question override (null = room default)
  status: 'unused' | 'active' | 'done';
  answeredBy: string | null;
}
