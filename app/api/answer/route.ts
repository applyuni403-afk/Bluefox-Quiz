import { NextResponse } from 'next/server';
import { submitAnswer } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, contestantId, answer } = body;

    if (!roomId || !contestantId || answer === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, contestantId, or answer' },
        { status: 400 }
      );
    }

    const result = await submitAnswer(roomId, contestantId, String(answer));
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit answer' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Answer submission error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Server error while evaluating answer' },
      { status: 500 }
    );
  }
}
