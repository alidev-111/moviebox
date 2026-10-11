import { NextResponse } from 'next/server';

/**
 * Google Drive Video Stream Proxy
 * Enables high-performance, ad-free streaming from a 5TB Google Drive Pro account.
 * Supports:
 * 1. HTTP 206 Partial Content / Range requests (essential for video seeking in Artplayer)
 * 2. Virus-scan bypass for files > 100MB
 * 3. Optional GOOGLE_DRIVE_API_KEY support for direct Drive v3 streaming
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawIdOrUrl = searchParams.get('id') || searchParams.get('url');

    if (!rawIdOrUrl) {
      return NextResponse.json({ error: 'Missing file id or url parameter' }, { status: 400 });
    }

    // Extract file ID if full Google Drive URL was passed
    let fileId = rawIdOrUrl;
    const match = rawIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  rawIdOrUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                  rawIdOrUrl.match(/^([a-zA-Z0-9_-]{20,})$/);

    if (match) {
      fileId = match[1];
    }

    const rangeHeader = request.headers.get('range');
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

    // Method 1: If user configured a Google Drive API Key in .env.local
    if (apiKey) {
      const gdriveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const apiHeaders = {};
      if (rangeHeader) {
        apiHeaders['Range'] = rangeHeader;
      }

      const apiRes = await fetch(gdriveApiUrl, {
        headers: apiHeaders,
      });

      if (apiRes.ok || apiRes.status === 206) {
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', apiRes.headers.get('content-type') || 'video/mp4');
        responseHeaders.set('Accept-Ranges', 'bytes');
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        if (apiRes.headers.get('content-range')) {
          responseHeaders.set('Content-Range', apiRes.headers.get('content-range'));
        }
        if (apiRes.headers.get('content-length')) {
          responseHeaders.set('Content-Length', apiRes.headers.get('content-length'));
        }

        return new Response(apiRes.body, {
          status: apiRes.status,
          headers: responseHeaders,
        });
      }
    }

    // Method 2: Direct Google Drive UC download endpoint with cookie confirmation & virus bypass
    const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const initialRes = await fetch(initialUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });

    let downloadUrl = initialUrl;
    const cookieHeader = initialRes.headers.get('set-cookie') || '';

    // If redirected immediately to download CDN
    if (initialRes.status === 302 || initialRes.status === 303) {
      downloadUrl = initialRes.headers.get('location') || initialUrl;
    } else {
      // Check if Google showed the "File is too large for virus scan" HTML page
      const htmlText = await initialRes.text();
      const confirmMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/);
      const confirmCode = confirmMatch ? confirmMatch[1] : 't';

      downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmCode}`;
    }

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (cookieHeader) {
      fetchHeaders['Cookie'] = cookieHeader;
    }
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const streamRes = await fetch(downloadUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    if (!streamRes.ok && streamRes.status !== 206) {
      return NextResponse.json(
        {
          error: `Google Drive returned status ${streamRes.status}. Make sure the file sharing is set to "Anyone with the link can view".`,
        },
        { status: streamRes.status }
      );
    }

    const resHeaders = new Headers();
    resHeaders.set('Content-Type', streamRes.headers.get('content-type') || 'video/mp4');
    resHeaders.set('Accept-Ranges', 'bytes');
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
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
