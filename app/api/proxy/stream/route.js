import { NextResponse } from 'next/server';

// Streaming Header & CORS Proxy for HLS Manifests (.m3u8) and Video Chunks (.ts / .m4s)
// Solves upstream Referer, Origin, and CORS restrictions without buffering huge video files.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const customReferer = searchParams.get('referer');
  const customOrigin = searchParams.get('origin');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid target url' }, { status: 400 });
    }

    // Default spoofed headers if not explicitly specified
    const referer = customReferer || `${parsedTarget.protocol}//${parsedTarget.host}/`;
    const origin = customOrigin || `${parsedTarget.protocol}//${parsedTarget.host}`;

    const upstreamHeaders = {
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': referer,
      'Origin': origin,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Forward range header if present (important for seeking and video segments)
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstreamRes.ok) {
      return new Response(`Upstream responded with status ${upstreamRes.status}`, {
        status: upstreamRes.status,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

    // If it's an .m3u8 playlist, rewrite all segment and sub-playlist URLs so chunks pass through the proxy
    if (isM3U8) {
      const manifestText = await upstreamRes.text();
      const baseUrl = upstreamRes.url || targetUrl; // Follow redirects if any

      const rewrittenManifest = rewriteM3U8(manifestText, baseUrl, referer, origin);

      return new Response(rewrittenManifest, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // For video chunks (.ts / .m4s / audio), stream the binary body directly with CORS headers
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // Forward essential media headers
    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Stream Proxy] Error proxying:', error.message);
    return NextResponse.json({ error: 'Failed to proxy stream: ' + error.message }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

// Helper to rewrite .m3u8 playlist lines to route through /api/proxy/stream
function rewriteM3U8(text, baseUrl, referer, origin) {
  const lines = text.split('\n');
  const rewrittenLines = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    // Handle URI inside tags like #EXT-X-KEY:METHOD=...,URI="..."
    if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
      const replaced = trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
        const fullUri = resolveUrl(uri, baseUrl);
        const proxied = `/api/proxy/stream?url=${encodeURIComponent(fullUri)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
        return `URI="${proxied}"`;
      });
      rewrittenLines.push(replaced);
      continue;
    }

    // Pass through other comments and tags as-is
    if (trimmed.startsWith('#')) {
      rewrittenLines.push(line);
      continue;
    }

    // This is a media segment or sub-playlist URL
    const fullUrl = resolveUrl(trimmed, baseUrl);
    const proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
    rewrittenLines.push(proxiedUrl);
  }

  return rewrittenLines.join('\n');
}

function resolveUrl(relativeOrAbsolute, base) {
  try {
    return new URL(relativeOrAbsolute, base).href;
  } catch {
    return relativeOrAbsolute;
  }
}
