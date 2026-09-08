import { NextResponse } from 'next/server';
import {
  getContestantsCollection,
  getQuestionsCollection,
} from '@/lib/db';
import { resolveRoom, finishRapidFireSet } from '@/lib/actions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
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

    const contestants = await getContestantsCollection();
    const cs = await contestants
      .find({ roomId: { $in: roomIds } })
      .sort({ joinOrder: 1 })
      .toArray();

    const questions = await getQuestionsCollection();
    const q = room.currentQuestionId
      ? await questions.findOne({ id: room.currentQuestionId })
      : null;

    // Normal round board tiles (for active round)
    const effectiveRoundName =
      room.currentRoundName ||
      (room.customRounds && room.customRounds.length > 0 ? room.customRounds[0] : null);

    const normalFilter: Record<string, unknown> = {
      roomId: { $in: roomIds },
      roundType: 'normal',
    };
    if (effectiveRoundName) {
      const countInRound = await questions.countDocuments({
        ...normalFilter,
        roundName: effectiveRoundName,
      });
      if (countInRound > 0) {
        normalFilter.roundName = effectiveRoundName;
      }
    }
    const normalBoard = await questions
      .find(normalFilter, {
        projection: { id: 1, number: 1, status: 1, roundName: 1, points: 1 },
      })
      .sort({ number: 1 })
      .toArray();

    // Rapid Fire Sets
    const rfFilter: Record<string, unknown> = {
      roomId: { $in: roomIds },
      roundType: 'rapid_fire',
    };
    if (effectiveRoundName) {
      const countRfInRound = await questions.countDocuments({
        ...rfFilter,
        roundName: effectiveRoundName,
      });
      if (countRfInRound > 0) {
        rfFilter.roundName = effectiveRoundName;
      }
    }
    const rfQuestions = await questions
      .find(rfFilter, { projection: { id: 1, setName: 1, number: 1, status: 1, roundName: 1 } })
      .toArray();

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

    const board =
      room.roundType === 'rapid_fire'
        ? await questions
            .find(
              {
                roomId: { $in: roomIds },
                roundType: 'rapid_fire',
                ...(room.rapidFireState?.activeSet ? { setName: room.rapidFireState.activeSet } : {}),
              },
              { projection: { id: 1, number: 1, status: 1, setName: 1 } }
            )
            .sort({ number: 1 })
            .toArray()
        : [];

    // Allow correctAnswer only when revealedAnswer exists or question is done
    const shouldReveal = Boolean(room.revealedAnswer || (q && q.status === 'done'));
    const safeQ = q
      ? {
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

    return NextResponse.json(
      {
        room,
        contestants: cs,
        question: safeQ,
        board,
        normalBoard,
        rapidFireSets,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('State API Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch game state' },
      { status: 500 }
    );
  }
}
