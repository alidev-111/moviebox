import { NextResponse } from 'next/server';
import { getAllBuckets, upsertBucket, deleteBucket } from '@/lib/b2';

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'alikon123';

function isAuthorized(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '')?.trim();
  return token === ADMIN_SECRET_KEY;
}

// Mask sensitive keys for client display (e.g. "K005...GXE")
function maskSecret(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= 8) return '********';
  return str.slice(0, 4) + '••••••••' + str.slice(-4);
}

export async function GET(request) {
  try {
    const buckets = await getAllBuckets();
    const safeBuckets = buckets.map((b) => ({
      ...b,
      application_key_masked: maskSecret(b.application_key),
      // Only include full application_key if authorized admin requested
      application_key: isAuthorized(request) ? b.application_key : maskSecret(b.application_key),
    }));

    return NextResponse.json({
      success: true,
      buckets: safeBuckets,
    });
  } catch (err) {
    console.error('[Buckets API GET Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.bucket_name || !body.key_id || !body.endpoint) {
      return NextResponse.json(
        { error: 'Bucket Name, Application Key ID, and Endpoint are required.' },
        { status: 400 }
      );
    }

    // If editing and application_key wasn't re-entered, keep existing
    if (!body.application_key && body.id) {
      const all = await getAllBuckets();
      const existing = all.find((b) => b.id === body.id);
      if (existing) {
        body.application_key = existing.application_key;
      }
    }

    if (!body.application_key) {
      return NextResponse.json(
        { error: 'Application Key is required.' },
        { status: 400 }
      );
    }

    const saved = await upsertBucket(body);
    return NextResponse.json({
      success: true,
      bucket: {
        ...saved,
        application_key_masked: maskSecret(saved.application_key),
      },
    });
  } catch (err) {
    console.error('[Buckets API POST Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing bucket id parameter' }, { status: 400 });
    }

    await deleteBucket(id);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[Buckets API DELETE Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
