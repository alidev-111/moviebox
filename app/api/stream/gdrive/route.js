import { NextResponse } from 'next/server';

/**
 * High-Performance Google Drive Video Stream Proxy
 * Streams 1080p video directly from Google Drive 5TB accounts with:
 * 1. Global in-memory session cache with single-flight resolution locking
 * 2. Proper Google Set-Cookie & NID preservation (prevents 403 / "quota exceeded" errors)
 * 3. HTTP 206 Partial Content / Range requests (essential for instant seeking in Artplayer)
 * 4. Automatic cache invalidation on token expiration
 * 5. Optional Google Drive API Key support (alt=media)
 * 6. Zero ads, zero popups, zero YouTube awkwardness
 */

// In-memory session cache: Map<fileId, { downloadUrl: string, cookieHeader: string, expiresAt: number }>
const sessionCache = new Map();

// In-flight resolution lock: Map<fileId, Promise<Session>>
const pendingResolutions = new Map();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function resolveDriveSession(fileId) {
  const now = Date.now();
  const cached = sessionCache.get(fileId);
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  // Check if a resolution for this fileId is already in flight to avoid duplicate requests
  if (pendingResolutions.has(fileId)) {
    return pendingResolutions.get(fileId);
  }

  const resolutionPromise = (async () => {
    try {
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      if (apiKey) {
        const session = {
          downloadUrl: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`,
          cookieHeader: '',
          isApi: true,
          expiresAt: now + 3600 * 1000 * 6, // 6 hours
        };
        sessionCache.set(fileId, session);
        return session;
      }

      // Gateway session resolver with cookie preservation
      const gatewayUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
      const probeRes = await fetch(gatewayUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });

      // Extract cookies from probe
      let cookieHeader = '';
      if (typeof probeRes.headers.getSetCookie === 'function') {
        const rawCookies = probeRes.headers.getSetCookie();
        cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
      } else {
        const raw = probeRes.headers.get('set-cookie');
        if (raw) cookieHeader = raw.split(';')[0];
      }

      let downloadUrl = gatewayUrl;
      const contentType = probeRes.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        const html = await probeRes.text();
        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
        const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/);

        const uuid = uuidMatch ? uuidMatch[1] : '';
        const confirm = confirmMatch ? confirmMatch[1] : 't';

        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}${uuid ? `&uuid=${uuid}` : ''}`;
      }

      const session = {
        downloadUrl,
        cookieHeader,
        isApi: false,
        expiresAt: now + 3600 * 1000 * 2, // 2 hours
      };

      sessionCache.set(fileId, session);
      return session;
    } finally {
      pendingResolutions.delete(fileId);
    }
  })();

  pendingResolutions.set(fileId, resolutionPromise);
  return resolutionPromise;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawIdOrUrl = searchParams.get('id') || searchParams.get('url');

    if (!rawIdOrUrl) {
      return NextResponse.json({ error: 'Missing file id or url parameter' }, { status: 400 });
    }

    // Extract Google Drive File ID
    let fileId = rawIdOrUrl;
    const match = rawIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  rawIdOrUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                  rawIdOrUrl.match(/^([a-zA-Z0-9_-]{20,})$/);

    if (match) {
      fileId = match[1];
    }

    const rangeHeader = request.headers.get('range');

    // Step 1: Resolve authenticated stream session (using cached tokens & cookies)
    let session = await resolveDriveSession(fileId);

    // Step 2: Fetch stream chunk with client Range header
    const streamHeaders = {
      'User-Agent': USER_AGENT,
    };
    if (session.cookieHeader) {
      streamHeaders['Cookie'] = session.cookieHeader;
    }
    if (rangeHeader) {
      streamHeaders['Range'] = rangeHeader;
    }

    let streamRes = await fetch(session.downloadUrl, {
      headers: streamHeaders,
      redirect: 'follow',
    });

    // Step 3: If session expired on Google's side (e.g. 403 or HTML returned), invalidate cache & retry once
    const resContentType = streamRes.headers.get('content-type') || '';
    if ((streamRes.status === 403 || streamRes.status === 401 || resContentType.includes('text/html')) && !session.isApi) {
      sessionCache.delete(fileId);
      session = await resolveDriveSession(fileId);

      const retryHeaders = {
        'User-Agent': USER_AGENT,
      };
      if (session.cookieHeader) {
        retryHeaders['Cookie'] = session.cookieHeader;
      }
      if (rangeHeader) {
        retryHeaders['Range'] = rangeHeader;
      }

      streamRes = await fetch(session.downloadUrl, {
        headers: retryHeaders,
        redirect: 'follow',
      });
    }

    if (!streamRes.ok && streamRes.status !== 206) {
      return NextResponse.json(
        {
          error: `Google Drive returned HTTP ${streamRes.status}. Please ensure the file sharing is set to "Anyone with the link can view".`,
        },
        { status: streamRes.status }
      );
    }

    // Step 4: Stream video chunks with HTTP 206 Partial Content headers to browser
    const resHeaders = new Headers();
    resHeaders.set('Content-Type', streamRes.headers.get('content-type') || 'video/mp4');
    resHeaders.set('Accept-Ranges', 'bytes');
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    resHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    resHeaders.set('Cache-Control', 'public, max-age=3600');

    if (streamRes.headers.get('content-range')) {
      resHeaders.set('Content-Range', streamRes.headers.get('content-range'));
    }
    if (streamRes.headers.get('content-length')) {
      resHeaders.set('Content-Length', streamRes.headers.get('content-length'));
    }

    return new Response(streamRes.body, {
      status: streamRes.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error('[Google Drive Proxy Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function HEAD(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    },
  });
}
