import { NextResponse } from 'next/server';
import { isB2Configured, presignB2Url } from '@/lib/b2';

const ROUTE_PREFIX = '/api/stream/b2/';

/**
 * Backblaze B2 Video Stream
 * /api/stream/b2/movies/inception-2010.mp4 -> 302 redirect to a presigned B2 URL.
 * The browser then streams (and seeks with Range requests) straight from Backblaze,
 * so no video bytes pass through this server.
 */
export async function GET(request) {
  if (!isB2Configured) {
    return NextResponse.json(
      { error: 'Backblaze B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET and B2_ENDPOINT.' },
      { status: 503 }
    );
  }

  const { pathname } = new URL(request.url);
  let segments;
  try {
    segments = pathname.slice(ROUTE_PREFIX.length).split('/').map(decodeURIComponent);
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (segments.length === 0 || segments.some((s) => !s || s === '.' || s === '..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const signedUrl = presignB2Url(segments.join('/'));

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
