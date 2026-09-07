import { NextResponse } from 'next/server';
import {
  getContestantsCollection,
  getQuestionsCollection,
} from '@/lib/db';
import { resolveRoom } from '@/lib/actions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await resolveRoom(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
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

    const board =
      room.roundType === 'rapid_fire'
        ? await questions
            .find(
              { roomId: { $in: roomIds }, roundType: 'rapid_fire' },
              { projection: { id: 1, number: 1, status: 1 } }
            )
            .sort({ number: 1 })
            .toArray()
        : [];

    // Never leak correctAnswer to public/contestant polling screens
    const safeQ = q
      ? {
          id: q.id,
          roomId: q.roomId,
          roundType: q.roundType,
          number: q.number,
          qtype: q.qtype,
          prompt: q.prompt,
          options: q.options,
          mediaUrl: q.mediaUrl,
          points: q.points,
          timerSeconds: q.timerSeconds,
          status: q.status,
          answeredBy: q.answeredBy,
        }
      : null;

    return NextResponse.json(
      { room, contestants: cs, question: safeQ, board },
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
