import { NextResponse } from 'next/server';
import { cleanSubtitleVtt } from '@/lib/subtitles';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const stripAll = searchParams.get('stripTags') === '1' || searchParams.get('stripTags') === 'true';

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing "url" query parameter' }, { status: 400 });
    }

    // Validate URL
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WatchBox SubtitleFetcher',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch subtitle: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    const vttContent = cleanSubtitleVtt(text, { stripAllTags: stripAll });

    return new Response(vttContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        // s-maxage lets Vercel's CDN keep the converted file too, so each subtitle is processed about once a day
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Subtitle Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
