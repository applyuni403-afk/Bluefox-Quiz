import { NextResponse } from 'next/server';
import { getQuestionsCollection, getContestantsCollection } from '@/lib/db';
import { chooseRapidFireQuestion, resolveRoom } from '@/lib/actions';
import { checkIsAdmin } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, questionId, contestantId } = body;

    if (!roomId || !questionId) {
      return NextResponse.json(
        { error: 'Missing roomId or questionId' },
        { status: 400 }
      );
    }

    const room = await resolveRoom(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.roundType !== 'rapid_fire') {
      return NextResponse.json(
        { error: 'Room is not in rapid fire mode' },
        { status: 400 }
      );
    }

    const isAdmin = await checkIsAdmin();

    // Verify contestant if not admin
    if (!isAdmin) {
      if (!contestantId) {
        return NextResponse.json(
          { error: 'Only the active rapid-fire team or player may choose a question' },
          { status: 403 }
        );
      }

      const contestants = await getContestantsCollection();
      const activeId = room.activeContestantId;

      if (!activeId) {
        return NextResponse.json(
          { error: 'No contestant is currently active' },
          { status: 400 }
        );
      }

      const isAllowed =
        activeId === contestantId ||
        Boolean(
          await contestants.findOne({
            id: activeId,
            parentGroupId: contestantId,
          })
        ) ||
        Boolean(
          await contestants.findOne({
            id: contestantId,
            parentGroupId: activeId,
          })
        );

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Only the active rapid-fire team or player may choose a question' },
          { status: 403 }
        );
      }
    }

    const questions = await getQuestionsCollection();
    const q = await questions.findOne({ id: questionId });

    if (!q || q.status === 'done') {
      return NextResponse.json(
        { error: 'This question has already been completed' },
        { status: 400 }
      );
    }

    await chooseRapidFireQuestion(roomId, questionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rapid Fire choose error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to select question' },
      { status: 500 }
    );
  }
}
