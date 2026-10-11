import { NextResponse } from 'next/server';

/**
 * High-Performance Google Drive Video Stream Proxy
 * Streams 1080p video directly from Google Drive 5TB accounts with:
 * 1. Automatic Google virus-scan bypass (dynamic uuid & confirmation token extraction)
 * 2. HTTP 206 Partial Content / Range requests (essential for video scrubbing/seeking in Artplayer)
 * 3. Instant playback even when Google's web player says "video file is still being processed"
 * 4. Zero ads, zero popups, zero token expiration
 */

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
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // Step 1: Query download gateway to retrieve dynamic uuid and confirm tokens for virus warning bypass
    const gatewayUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    
    let targetDownloadUrl = gatewayUrl;
    try {
      const checkRes = await fetch(gatewayUrl, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(6000),
      });

      if (checkRes.ok) {
        const contentType = checkRes.headers.get('content-type') || '';
        // If Google returned the virus warning HTML page, extract form tokens
        if (contentType.includes('text/html')) {
          const html = await checkRes.text();
          const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
          const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/);

          const uuid = uuidMatch ? uuidMatch[1] : '';
          const confirm = confirmMatch ? confirmMatch[1] : 't';

          targetDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}`;
          if (uuid) {
            targetDownloadUrl += `&uuid=${uuid}`;
          }
        } else if (checkRes.status === 200 || checkRes.status === 206) {
          // Direct file stream already returned
          targetDownloadUrl = gatewayUrl;
        }
      }
    } catch (checkErr) {
      console.warn('[GDrive Stream] Token probe warning:', checkErr.message);
      targetDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
    }

    // Step 2: Fetch stream from Google's CDN with the client's Range header
    const streamHeaders = {
      'User-Agent': userAgent,
    };
    if (rangeHeader) {
      streamHeaders['Range'] = rangeHeader;
    }

    const streamRes = await fetch(targetDownloadUrl, {
      headers: streamHeaders,
      redirect: 'follow',
    });

    if (!streamRes.ok && streamRes.status !== 206) {
      return NextResponse.json(
        {
          error: `Google Drive returned HTTP ${streamRes.status}. Please ensure the file sharing is set to "Anyone with the link can view".`,
        },
        { status: streamRes.status }
      );
    }

    // Step 3: Stream back video chunks to browser with Range support
    const resHeaders = new Headers();
    resHeaders.set('Content-Type', streamRes.headers.get('content-type') || 'video/mp4');
    resHeaders.set('Accept-Ranges', 'bytes');
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    resHeaders.set('Cache-Control', 'public, max-age=7200');

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
    },
  });
}
