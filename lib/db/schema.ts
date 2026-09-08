export interface RapidFireState {
  activeSet: string | null;
  contestantId: string | null;
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  scoreEarned: number;
  status: 'idle' | 'running' | 'completed';
}

export interface Room {
  id: string;
  _id: string;
  code: string; // 6-char join code, e.g. "BLUFOX"
  name: string;
  status: 'lobby' | 'playing' | 'finished';
  roundType: 'normal' | 'rapid_fire';
  currentRoundName?: string | null; // e.g. "Round 1: General Knowledge"
  customRounds?: string[]; // list of custom rounds setup by host
  currentQuestionId: string | null;
  activeContestantId: string | null; // whose turn (group, or individual in rapid fire)
  timerEndsAt: Date | null; // null = not running
  timerSeconds: number; // room default, admin-adjustable
  passCount: number;
  lastResult: string | null; // drives sounds
  revealedAnswer?: string | null; // answer shown when question ends/all pass
  rapidFireState?: RapidFireState | null; // live rapid fire set state
  usedSets?: string[]; // sets that have been taken/completed
  setAssignments?: Record<string, string>; // mapping setName -> contestantId
  rapidFireSeconds?: number; // duration for rapid fire set countdown (default 60s)
  maxTeams?: number | null; // expandable max teams limit (null = dynamically expandable / unlimited)
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
  roundName?: string | null; // custom round name e.g. "Round 1: General Knowledge"
  setName?: string | null; // Rapid fire set e.g. "Set A", "Set B"
  number: number; // shown on rapid-fire or normal round board
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

