import crypto from 'crypto';

// Backblaze B2 storage via its S3-compatible API.
// The bucket stays private (B2 only allows public buckets after a payment), so every
// video is served through a short-lived presigned URL instead of a public link.

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const bucket = process.env.B2_BUCKET;
const endpoint = (process.env.B2_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

export const isB2Configured = Boolean(keyId && applicationKey && bucket && endpoint);

// AWS SigV4 requires RFC 3986 encoding, which also escapes !'()*
function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

// AWS Signature V4 query-string signing for a GET request (path must already be URI-encoded)
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

// Backblaze file links (friendly or S3 style) -> /api/stream/b2/<key>, since a private bucket rejects them directly
export function toB2StreamPath(url) {
  if (!url || typeof url !== 'string') return url;
  const match = url.match(/backblazeb2\.com\/file\/[^/]+\/([^?#]+)/) ||
                url.match(/\/\/[^/]+\.s3\.[^/]+\.backblazeb2\.com\/([^?#]+)/) ||
                url.match(/\/\/s3\.[^/]+\.backblazeb2\.com\/[^/]+\/([^?#]+)/);
  return match ? `/api/stream/b2/${match[1]}` : url;
}

// fileKey is the file's name inside the bucket, e.g. "movies/inception-2010.mp4"
export function presignB2Url(fileKey, expiresIn = 12 * 60 * 60) {
  // s3.us-east-005.backblazeb2.com -> us-east-005
  const region = endpoint.split('.')[1];
  const path = `/${encodeRfc3986(bucket)}/${fileKey.split('/').map(encodeRfc3986).join('/')}`;
  return presignGetUrl({
    host: endpoint,
    path,
    region,
    accessKeyId: keyId,
    secretAccessKey: applicationKey,
    expiresIn,
  });
}
