import { NextResponse } from 'next/server';
import { getBucketById, presignB2Url } from '@/lib/b2';

const ROUTE_PREFIX = '/api/stream/b2/';

/**
 * Backblaze B2 Multi-Bucket Dynamic Video Stream
 * Supports:
 * 1. /api/stream/b2/[bucketId]/[...fileKey]
 * 2. /api/stream/b2/[...fileKey] (uses default bucket)
 * 3. /api/stream/b2/[...fileKey]?bucket=[bucketId]
 * 
 * Generates an on-the-fly AWS SigV4 presigned URL using the target bucket's
 * specific credentials and 302 redirects the browser / ArtPlayer to Backblaze.
 * ArtPlayer then streams directly with HTTP 206 Range requests without server load.
 */
export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);
  const explicitBucketParam = searchParams.get('bucket');

  let segments;
  try {
    segments = pathname
      .slice(ROUTE_PREFIX.length)
      .split('/')
      .map((s) => decodeURIComponent(s.replace(/\+/g, ' ')));
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (segments.length === 0 || segments.some((s) => !s || s === '.' || s === '..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  try {
    let targetBucket = null;
    let fileKey = segments.join('/');

    if (explicitBucketParam) {
      targetBucket = await getBucketById(explicitBucketParam);
    } else if (segments.length >= 2) {
      // Check if the first path segment is a known bucket ID or bucket name
      const potentialBucket = await getBucketById(segments[0]);
      if (potentialBucket && (potentialBucket.id === segments[0] || potentialBucket.bucket_name === segments[0])) {
        targetBucket = potentialBucket;
        fileKey = segments.slice(1).join('/');
      }
    }

    if (!targetBucket) {
      targetBucket = await getBucketById(null);
    }

    if (!targetBucket) {
      return NextResponse.json(
        { error: 'No active Backblaze B2 storage bucket found. Please configure a bucket in Admin -> Storage Buckets.' },
        { status: 503 }
      );
    }

    const signedUrl = await presignB2Url(fileKey, 43200, targetBucket);

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'private, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[B2 Stream Error]:', err);
    return NextResponse.json(
      { error: `Failed to generate B2 stream: ${err.message}` },
      { status: 500 }
    );
  }
}
