import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { checkIsAdmin } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            'BLOB_READ_WRITE_TOKEN is not configured. Please configure Vercel Blob in your project or paste a direct media URL.',
        },
        { status: 503 }
      );
    }

    const filename = `quiz-media/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const blob = await put(filename, file, {
      access: 'public',
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to upload media file' },
      { status: 500 }
    );
  }
}
