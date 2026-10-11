import { NextResponse } from 'next/server';

function convertSrtToVtt(srtContent) {
  // International WebVTT converter with numeric counter stripping and comma-to-period timestamp normalization
  let cleaned = srtContent
    .replace(/\r+/g, '')
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  if (!cleaned.startsWith('WEBVTT')) {
    cleaned = 'WEBVTT\n\n' + cleaned;
  }
  return cleaned;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

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

    let text = await response.text();
    // Remove UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    let isSrt = targetUrl.toLowerCase().endsWith('.srt') || !text.startsWith('WEBVTT');
    let vttContent = text;

    if (isSrt) {
      vttContent = convertSrtToVtt(text);
    }

    return new Response(vttContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Subtitle Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
