import { NextResponse } from 'next/server';
import { getRoomsCollection } from '@/lib/db';
import { passQuestion } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, contestantId } = body;

    if (!roomId || !contestantId) {
      return NextResponse.json(
        { error: 'Missing roomId or contestantId' },
        { status: 400 }
      );
    }

    const rooms = await getRoomsCollection();
    const room = await rooms.findOne({ id: roomId });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'playing') {
      return NextResponse.json({ error: 'Game is not active' }, { status: 400 });
    }

    // Server-side verification: only the active contestant may pass
    if (room.activeContestantId !== contestantId) {
      return NextResponse.json(
        { error: 'Only the currently active contestant may pass' },
        { status: 403 }
      );
    }

    // Verify timer is running
    if (!room.timerEndsAt || new Date(room.timerEndsAt).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Cannot pass: timer is not active' },
        { status: 400 }
      );
    }

    const result = await passQuestion(roomId);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Pass API Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to pass question' },
      { status: 500 }
    );
  }
}
