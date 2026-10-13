import { NextResponse } from 'next/server';
import { testBucketConnection, getBucketById } from '@/lib/b2';

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'alikon123';

function isAuthorized(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '')?.trim();
  return token === ADMIN_SECRET_KEY;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // If only an ID was provided, fetch the stored bucket credentials
    let bucketData = body;
    if (body.id && (!body.application_key || !body.key_id)) {
      const stored = await getBucketById(body.id);
      if (stored) {
        bucketData = { ...stored, ...body };
      }
    }

    const result = await testBucketConnection(bucketData);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Bucket Test API Error]:', err);
    return NextResponse.json(
      { success: false, error: `Test connection failed: ${err.message}` },
      { status: 500 }
    );
  }
}
