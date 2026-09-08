import { NextResponse } from 'next/server';
import {
  subscribeToRoomEvents,
  getMemoryRoomState,
  loadAndCacheRoomState,
} from '@/lib/engine/roomEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  let initial = getMemoryRoomState(roomId);
  if (!initial) {
    initial = await loadAndCacheRoomState(roomId);
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial state immediately
      if (initial) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));
      }

      // 2. Subscribe to real-time room updates
      unsubscribe = subscribeToRoomEvents(roomId, (freshState) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(freshState)}\n\n`));
        } catch {
          // Stream closed by client
        }
      });

      // 3. Keep-alive ping every 15s
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 15000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
