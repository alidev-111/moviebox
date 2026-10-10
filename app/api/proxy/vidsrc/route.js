import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdb = searchParams.get('tmdb') || '969681';

    const targetUrl = `https://vidsrc.me/embed/movie?tmdb=${encodeURIComponent(tmdb)}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://vidsrc.me/',
      },
    });

    if (!res.ok) {
      return new NextResponse(`Failed to load VidSrc: ${res.status}`, { status: res.status });
    }

    let html = await res.text();

    // 1. Remove anti-sandbox scripts
    html = html.replace(/<script[^>]*src="[^"]*sbx\.js[^"]*"[^>]*><\/script>/gi, '');
    html = html.replace(/<script[^>]*src="[^"]*disable-devtool\.js[^"]*"[^>]*><\/script>/gi, '');

    // 2. Add base tag so relative URLs resolve to vidsrc.me
    html = html.replace('<head>', '<head><base href="https://vidsrc.me/">');

    // 3. Inject popup killer & top-navigation protector
    const popupKiller = `
<script>
  (function() {
    // 1. Kill window.open popups
    window.open = function() {
      console.warn('[WatchBox Shield] Blocked external popup attempt');
      return null;
    };

    // 2. Prevent frame-busting top navigation
    try {
      Object.defineProperty(window, 'top', { get: function() { return window.self; } });
      Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
    } catch(e) {}

    // 3. Kill all target="_blank" click popups
    document.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A') {
        if (target.target === '_blank' || (target.href && !target.href.includes('vidsrc'))) {
          e.preventDefault();
          e.stopPropagation();
          console.warn('[WatchBox Shield] Blocked ad click:', target.href);
        }
      }
    }, true);
  })();
</script>
`;
    html = html.replace('</head>', `${popupKiller}</head>`);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=1800',
      },
    });
  } catch (error) {
    console.error('VidSrc proxy error:', error);
    return new NextResponse(`Error proxying VidSrc: ${error.message}`, { status: 500 });
  }
}
