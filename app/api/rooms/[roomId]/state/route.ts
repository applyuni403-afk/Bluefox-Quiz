import { NextResponse } from 'next/server';
import {
  getContestantsCollection,
  getQuestionsCollection,
  getCachedRoomState,
  setCachedRoomState,
} from '@/lib/db';
import { resolveRoom, finishRapidFireSet } from '@/lib/actions';
import {
  getMemoryRoomState,
  broadcastRoomState,
} from '@/lib/engine/roomEngine';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // 1. Check in-memory room engine first (< 0.1 ms response)
    const memoryState = getMemoryRoomState(roomId) || getCachedRoomState<any>(roomId);
    if (memoryState) {
      const isExpiredRf =
        memoryState.room?.roundType === 'rapid_fire' &&
        memoryState.room?.rapidFireState?.status === 'running' &&
        memoryState.room?.timerEndsAt &&
        new Date() > new Date(memoryState.room.timerEndsAt);

      if (!isExpiredRf) {
        return NextResponse.json(memoryState, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }
    }

    let room = await resolveRoom(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Auto-complete Rapid Fire set if the continuous timeline has expired
    if (
      room.roundType === 'rapid_fire' &&
      room.rapidFireState?.status === 'running' &&
      room.timerEndsAt &&
      new Date() > new Date(room.timerEndsAt)
    ) {
      await finishRapidFireSet(room.id);
      room = await resolveRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
    }

    const roomIds = [room.id, room.code].filter(Boolean) as string[];

    // 2. Fetch contestants and ALL room questions in parallel (just 1 round-trip)
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

    // 3. In-memory resolution of current question
    const q = room.currentQuestionId
      ? allQuestions.find((item) => item.id === room.currentQuestionId) || null
      : null;

    // 4. Normal round board tiles (computed in memory)
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

    // 5. Rapid Fire Sets (computed in memory)
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
      const assignedTeam = assignedId ? cs.find((c) => c.id === assignedId)?.name : null;
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

    // 6. Active Rapid Fire Board (computed in memory)
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

    // Allow correctAnswer only when revealedAnswer exists or question is done
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

    const responsePayload = {
      room,
      contestants: cs,
      question: safeQ,
      board,
      normalBoard,
      rapidFireSets,
    };

    // Cache with short TTL (500ms) for high-frequency polling efficiency
    setCachedRoomState(room.id, responsePayload, 500);
    if (room.code) {
      setCachedRoomState(room.code, responsePayload, 500);
    }
    broadcastRoomState(room.id, room.code, responsePayload);

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('State API Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch game state' },
      { status: 500 }
    );
  }
}
