import type { GameStateResponse } from '@/lib/useGameState';
import {
  getRoomsCollection,
  getContestantsCollection,
  getQuestionsCollection,
  Room,
} from '@/lib/db';
import { resolveRoom, finishRapidFireSet } from '@/lib/actions';

type SSEListener = (state: GameStateResponse) => void;

interface EngineGlobal {
  roomStateMap: Map<string, GameStateResponse>;
  roomListeners: Map<string, Set<SSEListener>>;
}

declare global {
  var _bluefoxEngineGlobal: EngineGlobal | undefined;
}

function getEngineGlobal(): EngineGlobal {
  if (!global._bluefoxEngineGlobal) {
    global._bluefoxEngineGlobal = {
      roomStateMap: new Map(),
      roomListeners: new Map(),
    };
  }
  return global._bluefoxEngineGlobal;
}

/**
 * Subscribe an SSE listener to real-time state changes for a specific room.
 */
export function subscribeToRoomEvents(
  roomIdOrCode: string,
  listener: SSEListener
): () => void {
  const { roomListeners } = getEngineGlobal();
  const key = roomIdOrCode.toLowerCase();
  if (!roomListeners.has(key)) {
    roomListeners.set(key, new Set());
  }
  const listeners = roomListeners.get(key)!;
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      roomListeners.delete(key);
    }
  };
}

/**
 * Broadcast an updated state to all connected listeners immediately (0 ms).
 */
export function broadcastRoomState(
  canonicalId: string,
  code: string | undefined | null,
  state: GameStateResponse
): void {
  const { roomStateMap, roomListeners } = getEngineGlobal();

  // Store in memory for instant < 1ms API reads
  if (canonicalId) {
    roomStateMap.set(canonicalId.toLowerCase(), state);
  }
  if (code) {
    roomStateMap.set(code.toLowerCase(), state);
  }

  // Notify all active SSE clients
  const keysToNotify = [canonicalId, code].filter(Boolean) as string[];
  const notified = new Set<SSEListener>();

  for (const key of keysToNotify) {
    const listeners = roomListeners.get(key.toLowerCase());
    if (listeners) {
      listeners.forEach((listener) => {
        if (!notified.has(listener)) {
          notified.add(listener);
          try {
            listener(state);
          } catch (err) {
            console.error('SSE listener error:', err);
          }
        }
      });
    }
  }
}

/**
 * Get active room state directly from memory (< 0.1 ms).
 */
export function getMemoryRoomState(roomIdOrCode: string): GameStateResponse | null {
  if (!roomIdOrCode) return null;
  const { roomStateMap } = getEngineGlobal();
  return roomStateMap.get(roomIdOrCode.toLowerCase()) || null;
}

/**
 * Invalidate memory state for a room.
 */
export function invalidateMemoryRoom(roomIdOrCode: string): void {
  if (!roomIdOrCode) return;
  const { roomStateMap } = getEngineGlobal();
  roomStateMap.delete(roomIdOrCode.toLowerCase());
}

/**
 * Compute the full GameStateResponse payload from raw DB objects.
 */
export function computeGameStatePayload(
  room: Room,
  contestants: any[],
  allQuestions: any[]
): GameStateResponse {
  // Current question
  const q = room.currentQuestionId
    ? allQuestions.find((item) => item.id === room.currentQuestionId) || null
    : null;

  // Normal round board tiles
  const effectiveRoundName =
    room.currentRoundName ||
    (room.customRounds && room.customRounds.length > 0 ? room.customRounds[0] : null);

  let normalQuestions = allQuestions.filter((item) => item.roundType === 'normal');
  if (effectiveRoundName) {
    const countInRound = normalQuestions.filter((item) => item.roundName === effectiveRoundName).length;
    if (countInRound > 0) {
      normalQuestions = normalQuestions.filter((item) => item.roundName === effectiveRoundName);
    }
  }
  normalQuestions.sort((a, b) => a.number - b.number);
  const normalBoard = normalQuestions.map((item) => ({
    id: item.id,
    number: item.number,
    status: item.status,
    roundName: item.roundName,
    points: item.points,
  }));

  // Rapid Fire Sets
  let rfQuestions = allQuestions.filter((item) => item.roundType === 'rapid_fire');
  if (effectiveRoundName) {
    const countRfInRound = rfQuestions.filter((item) => item.roundName === effectiveRoundName).length;
    if (countRfInRound > 0) {
      rfQuestions = rfQuestions.filter((item) => item.roundName === effectiveRoundName);
    }
  }

  const setMap = new Map<string, { count: number }>();
  for (const item of rfQuestions) {
    const sName = item.setName || 'Set A';
    const existing = setMap.get(sName) || { count: 0 };
    existing.count += 1;
    setMap.set(sName, existing);
  }

  const rapidFireSets = Array.from(setMap.entries()).map(([setName, data]) => {
    const isUsed = Boolean(room.usedSets && room.usedSets.includes(setName));
    const assignedId = room.setAssignments?.[setName] || null;
    const assignedTeam = assignedId ? contestants.find((c) => c.id === assignedId)?.name : null;
    return {
      setName,
      questionCount: data.count,
      isUsed,
      usedByTeamName: assignedTeam || null,
    };
  });

  rapidFireSets.sort((a, b) =>
    a.setName.localeCompare(b.setName, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Active Rapid Fire Board
  const activeRfSet = room.rapidFireState?.activeSet;
  const board =
    room.roundType === 'rapid_fire'
      ? allQuestions
          .filter(
            (item) =>
              item.roundType === 'rapid_fire' &&
              (!activeRfSet || item.setName === activeRfSet)
          )
          .sort((a, b) => a.number - b.number)
          .map((item) => ({
            id: item.id,
            number: item.number,
            status: item.status,
            setName: item.setName,
          }))
      : [];

  const shouldReveal = Boolean(room.revealedAnswer || (q && q.status === 'done'));
  const safeQ = q
    ? {
        _id: q._id || q.id,
        id: q.id,
        roomId: q.roomId,
        roundType: q.roundType,
        roundName: q.roundName || null,
        setName: q.setName || null,
        number: q.number,
        qtype: q.qtype,
        prompt: q.prompt,
        options: q.options,
        mediaUrl: q.mediaUrl,
        points: q.points,
        timerSeconds: q.timerSeconds,
        status: q.status,
        answeredBy: q.answeredBy,
        revealedAnswer: shouldReveal ? (room.revealedAnswer || q.correctAnswer) : null,
      }
    : null;

  return {
    room,
    contestants,
    question: safeQ,
    board,
    normalBoard,
    rapidFireSets,
  };
}

/**
 * Load full room state from DB and store in memory.
 */
export async function loadAndCacheRoomState(roomIdOrCode: string): Promise<GameStateResponse | null> {
  let room = await resolveRoom(roomIdOrCode);
  if (!room) return null;

  // Auto-complete Rapid Fire set if timeline expired
  if (
    room.roundType === 'rapid_fire' &&
    room.rapidFireState?.status === 'running' &&
    room.timerEndsAt &&
    new Date() > new Date(room.timerEndsAt)
  ) {
    await finishRapidFireSet(room.id);
    room = await resolveRoom(roomIdOrCode);
    if (!room) return null;
  }

  const roomIds = [room.id, room.code].filter(Boolean) as string[];

  const [contestantsColl, questionsColl] = await Promise.all([
    getContestantsCollection(),
    getQuestionsCollection(),
  ]);

  const [cs, allQuestions] = await Promise.all([
    contestantsColl
      .find({ roomId: { $in: roomIds } })
      .sort({ joinOrder: 1 })
      .toArray(),
    questionsColl
      .find({ roomId: { $in: roomIds } })
      .toArray(),
  ]);

  const payload = computeGameStatePayload(room, cs, allQuestions);
  broadcastRoomState(room.id, room.code, payload);
  return payload;
}
