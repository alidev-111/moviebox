import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  !supabaseUrl.includes('your-project.supabase.co')
);

const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

const BUCKETS_FILE = path.join(process.cwd(), 'data', 'buckets.json');

// Default fallback environment bucket
const envKeyId = process.env.B2_KEY_ID;
const envApplicationKey = process.env.B2_APPLICATION_KEY;
const envBucket = process.env.B2_BUCKET;
const envEndpoint = (process.env.B2_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

export const isB2Configured = Boolean(envKeyId && envApplicationKey && envBucket && envEndpoint);

// In-memory cache for buckets to avoid reading disk/db on every video chunk
let memoryBucketsCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

// AWS SigV4 requires RFC 3986 encoding, which also escapes !'()*
export function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

// AWS Signature V4 query-string signing for a GET request
export function presignGetUrl({ host, path, region, accessKeyId, secretAccessKey, expiresIn = 3600, date = new Date() }) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;

  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join('&');

  const canonicalRequest = ['GET', path, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Local JSON storage for buckets
async function readLocalBuckets() {
  try {
    const raw = await fs.readFile(BUCKETS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeLocalBuckets(buckets) {
  try {
    await fs.mkdir(path.dirname(BUCKETS_FILE), { recursive: true });
    await fs.writeFile(BUCKETS_FILE, JSON.stringify(buckets, null, 2), 'utf-8');
    memoryBucketsCache = buckets;
    lastCacheTime = Date.now();
  } catch (err) {
    console.error('[B2] Failed to write local buckets:', err.message);
  }
}

// Ensure at least the default .env bucket exists if configured
function getDefaultEnvBucket() {
  if (!isB2Configured) return null;
  return {
    id: 'default-env',
    label: `Default Bucket (${envBucket})`,
    bucket_name: envBucket,
    key_id: envKeyId,
    application_key: envApplicationKey,
    endpoint: envEndpoint,
    is_active: true,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getAllBuckets() {
  const now = Date.now();
  if (memoryBucketsCache && (now - lastCacheTime) < CACHE_TTL) {
    return memoryBucketsCache;
  }

  let buckets = [];

  // 1. Try Supabase first if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('storage_buckets')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        buckets = data;
      }
    } catch (err) {
      console.warn('[B2] Supabase query storage_buckets failed, using local:', err.message);
    }
  }

  // 2. Fallback to local file if empty
  if (buckets.length === 0) {
    buckets = await readLocalBuckets();
  }

  // 3. If still empty but .env.local has a bucket, auto-seed it
  const defaultBucket = getDefaultEnvBucket();
  if (buckets.length === 0 && defaultBucket) {
    buckets = [defaultBucket];
    await writeLocalBuckets(buckets);
  } else if (defaultBucket && !buckets.some(b => b.bucket_name === defaultBucket.bucket_name || b.id === 'default-env')) {
    // Add default bucket if not present
    buckets.unshift(defaultBucket);
  }

  memoryBucketsCache = buckets;
  lastCacheTime = now;
  return buckets;
}

export async function getBucketById(idOrName) {
  const buckets = await getAllBuckets();
  if (!idOrName) {
    return buckets.find((b) => b.is_default && b.is_active) || buckets.find((b) => b.is_active) || buckets[0] || null;
  }

  return (
    buckets.find((b) => b.id === idOrName) ||
    buckets.find((b) => b.bucket_name === idOrName) ||
    buckets.find((b) => b.label === idOrName) ||
    buckets.find((b) => b.is_default) ||
    buckets[0] ||
    null
  );
}

export async function upsertBucket(bucketData) {
  const timestamp = new Date().toISOString();
  const bucketId = bucketData.id || `b2-${(bucketData.bucket_name || 'bucket').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

  const normalized = {
    id: bucketId,
    label: (bucketData.label || bucketData.bucket_name || 'My B2 Bucket').trim(),
    bucket_name: (bucketData.bucket_name || '').trim(),
    key_id: (bucketData.key_id || '').trim(),
    application_key: (bucketData.application_key || '').trim(),
    endpoint: (bucketData.endpoint || 's3.us-east-005.backblazeb2.com').replace(/^https?:\/\//, '').replace(/\/+$/, '').trim(),
    is_active: bucketData.is_active !== undefined ? Boolean(bucketData.is_active) : true,
    is_default: Boolean(bucketData.is_default),
    updated_at: timestamp,
    created_at: bucketData.created_at || timestamp,
  };

  // If set to default, unset other defaults
  let all = await getAllBuckets();
  if (normalized.is_default) {
    all = all.map(b => ({ ...b, is_default: b.id === normalized.id }));
  }

  const idx = all.findIndex((b) => b.id === normalized.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...normalized };
  } else {
    all.push(normalized);
  }

  await writeLocalBuckets(all);

  // Sync to Supabase if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('storage_buckets').upsert(normalized);
      if (error) {
        console.warn('[B2] Supabase upsert storage_buckets warning:', error.message);
      }
    } catch (e) {
      console.warn('[B2] Supabase upsert error:', e.message);
    }
  }

  memoryBucketsCache = all;
  lastCacheTime = Date.now();
  return normalized;
}

export async function deleteBucket(bucketId) {
  let all = await getAllBuckets();
  all = all.filter((b) => b.id !== bucketId && b.bucket_name !== bucketId);
  await writeLocalBuckets(all);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('storage_buckets').delete().eq('id', bucketId);
    } catch (e) {
      console.warn('[B2] Supabase delete storage_buckets error:', e.message);
    }
  }

  memoryBucketsCache = all;
  lastCacheTime = Date.now();
  return { success: true };
}

// Live connection test to Backblaze B2 S3 API
export async function testBucketConnection(bucketData) {
  const host = (bucketData.endpoint || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  const bucketName = (bucketData.bucket_name || '').trim();
  const keyId = (bucketData.key_id || '').trim();
  const appKey = (bucketData.application_key || '').trim();

  if (!host || !bucketName || !keyId || !appKey) {
    return {
      success: false,
      error: 'Missing required fields: Endpoint, Bucket Name, Key ID, and Application Key are all required.',
    };
  }

  const region = host.split('.')[1] || 'us-east-005';

  try {
    // Attempt 1: S3 ListObjects query on bucket (returns file list if key has list permission)
    const listUrl = presignGetUrl({
      host,
      path: `/${encodeRfc3986(bucketName)}`,
      region,
      accessKeyId: keyId,
      secretAccessKey: appKey,
      expiresIn: 300,
    });

    const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(6000) });
    const listText = await listRes.text();

    if (listRes.status === 200) {
      const keyMatches = [...listText.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
      return {
        success: true,
        message: 'Successfully connected and verified Backblaze B2 bucket!',
        filesFound: keyMatches,
      };
    }

    // Attempt 2: If key is restricted to readFiles only (returns 403 on listing), probe with a signed GET request
    const probeUrl = presignGetUrl({
      host,
      path: `/${encodeRfc3986(bucketName)}/__probe_test__.txt`,
      region,
      accessKeyId: keyId,
      secretAccessKey: appKey,
      expiresIn: 300,
    });

    const probeRes = await fetch(probeUrl, {
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(6000),
    });

    if (probeRes.status === 404 || probeRes.status === 200 || probeRes.status === 206) {
      return {
        success: true,
        message: 'Successfully connected and authenticated with Backblaze B2 bucket!',
        filesFound: [],
      };
    }

    if (probeRes.status === 403 || listRes.status === 403) {
      return {
        success: false,
        error: 'Authentication failed (HTTP 403 Unauthorized). Please verify your Application Key ID, Application Key, and that the key has access to bucket "' + bucketName + '".',
      };
    }

    return {
      success: false,
      error: `Backblaze returned HTTP ${probeRes.status}. Please check your bucket name and S3 endpoint.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to Backblaze: ${err.message}`,
    };
  }
}

// Backblaze file links -> /api/stream/b2/<bucketId>/<key>
export function toB2StreamPath(url, bucketId = '') {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/api/stream/b2/')) return url;

  const match = url.match(/backblazeb2\.com\/file\/([^/]+)\/([^?#]+)/) ||
                url.match(/\/\/([^/]+)\.s3\.[^/]+\.backblazeb2\.com\/([^?#]+)/) ||
                url.match(/\/\/s3\.[^/]+\.backblazeb2\.com\/([^/]+)\/([^?#]+)/);

  if (match) {
    const detectedBucket = match[1];
    const fileKey = match[2];
    return `/api/stream/b2/${bucketId || detectedBucket}/${fileKey}`;
  }

  return url;
}

// Generate presigned URL for a specific bucket (or fallback)
export async function presignB2Url(fileKey, expiresIn = 12 * 60 * 60, bucketIdOrObj = null) {
  let targetBucket = null;

  if (bucketIdOrObj && typeof bucketIdOrObj === 'object' && bucketIdOrObj.endpoint) {
    targetBucket = bucketIdOrObj;
  } else if (bucketIdOrObj && typeof bucketIdOrObj === 'string') {
    targetBucket = await getBucketById(bucketIdOrObj);
  }

  if (!targetBucket) {
    targetBucket = await getBucketById(null);
  }

  if (!targetBucket) {
    throw new Error('No active Backblaze B2 bucket configured.');
  }

  const endpoint = targetBucket.endpoint;
  const region = endpoint.split('.')[1] || 'us-east-005';
  const path = `/${encodeRfc3986(targetBucket.bucket_name)}/${fileKey.split('/').map(encodeRfc3986).join('/')}`;

  return presignGetUrl({
    host: endpoint,
    path,
    region,
    accessKeyId: targetBucket.key_id,
    secretAccessKey: targetBucket.application_key,
    expiresIn,
  });
}
