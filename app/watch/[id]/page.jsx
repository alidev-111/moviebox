'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import {
  ArrowLeft,
  Subtitles,
  Calendar,
  Clock,
  RefreshCw,
  ExternalLink,
  Moon,
  AlertCircle,
  CheckCircle2,
  Share2,
  Film,
  Play
} from 'lucide-react';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const artRef = useRef(null);
  const playerInstanceRef = useRef(null);

  const [movie, setMovie] = useState(null);
  const [allMovies, setAllMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const [activeSubIndex, setActiveSubIndex] = useState(0);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playerMode, setPlayerMode] = useState('auto'); // 'native' | 'embed' | 'auto'
  const [shieldActive, setShieldActive] = useState(true);

  // Fetch movie data
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`/api/movies/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Movie not found');
        return res.json();
      })
      .then((data) => {
        setMovie(data);
        setError('');
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    // Fetch other movies for recommendations
    fetch('/api/movies')
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setAllMovies(list.filter((m) => m.id !== id));
        }
      })
      .catch(() => { });
  }, [id]);

  // In-Code uBlock Origin Scriptlet Suite (https://github.com/gorhill/uBlock)
  // Implements: 'prevent-window-open' (nowo), 'disable-newtab-links', 'addEventListener-defuser' (aeld), & 'prevent-navigation'
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. uBlock Origin 'prevent-window-open' (nowo)
    // Non-configurable lock on window.open to prevent scripts from restoring it
    const originalOpen = window.open;
    const blockOpen = function (url) {
      console.warn('[uBlock Defuser: prevent-window-open] Blocked window.open to:', url);
      return null;
    };

    try {
      Object.defineProperty(window, 'open', {
        value: blockOpen,
        writable: false,
        configurable: true,
      });
    } catch {
      window.open = blockOpen;
    }

    try {
      if (window.Window && window.Window.prototype) {
        Object.defineProperty(window.Window.prototype, 'open', {
          value: blockOpen,
          writable: false,
          configurable: true,
        });
      }
    } catch { }

    // 2. uBlock Origin 'disable-newtab-links'
    // Neutralizes programmatic anchor clicks with target="_blank"
    const origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      const isExternal = this.href && !this.href.startsWith(window.location.origin) && !this.href.startsWith('javascript:');
      if (this.target === '_blank' || isExternal) {
        console.warn('[uBlock Defuser: disable-newtab-links] Neutralized anchor.click() to:', this.href);
        return;
      }
      return origAnchorClick.apply(this, arguments);
    };

    // Neutralizes user clicks on external/new-tab anchors in capture phase
    const handleCaptureClick = (e) => {
      let target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A') {
        const isExternal = target.href && !target.href.startsWith(window.location.origin) && !target.href.startsWith('javascript:');
        if (target.target === '_blank' || isExternal) {
          console.warn('[uBlock Defuser: disable-newtab-links] Blocked new tab link click:', target.href);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // 3. uBlock Origin 'addEventListener-defuser' (aeld)
    // Defuses malicious popup/popunder listeners
    const origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (['click', 'mousedown', 'mouseup', 'pointerdown', 'touchstart'].includes(type) && typeof listener === 'function') {
        const fnStr = listener.toString();
        if (/(popunder|popads|window\.open|llvpn|adcash|histats|onclick_ad)/i.test(fnStr)) {
          console.warn('[uBlock Defuser: aeld] Defused ad listener for event:', type);
          return;
        }
      }
      return origAddEventListener.call(this, type, listener, options);
    };

    // 4. Frame-busting prevention
    const handleBeforeUnload = (e) => {
      if (document.activeElement?.tagName === 'IFRAME') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('click', handleCaptureClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      try {
        Object.defineProperty(window, 'open', {
          value: originalOpen,
          writable: true,
          configurable: true,
        });
      } catch {
        window.open = originalOpen;
      }
      HTMLAnchorElement.prototype.click = origAnchorClick;
      EventTarget.prototype.addEventListener = origAddEventListener;
      window.removeEventListener('click', handleCaptureClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const [selectedServer, setSelectedServer] = useState(1);

  // Initialize or re-initialize player
  useEffect(() => {
    if (!movie) return;

    const isDirect = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('.m3u8') ||
        movie.stream_url.includes('.mp4') ||
        movie.stream_url.includes('.webm')
      )
    );

    // If using embed mode, Artplayer is not needed
    if (!isDirect && playerMode !== 'native') return;

    if (!artRef.current) return;

    let activeArt = null;

    const initArt = (ArtplayerConstructor, HlsConstructor) => {
      if (!ArtplayerConstructor || !artRef.current) return;

      if (playerInstanceRef.current && playerInstanceRef.current.destroy) {
        playerInstanceRef.current.destroy(false);
        playerInstanceRef.current = null;
      }

      const subtitlesList = Array.isArray(movie.subtitles) ? movie.subtitles : [];
      const defaultSub = subtitlesList[activeSubIndex] || subtitlesList[0];

      let subtitleConfig = undefined;
      if (defaultSub && defaultSub.url && defaultSub.url.trim()) {
        const isAbsolute = defaultSub.url.startsWith('http://') || defaultSub.url.startsWith('https://');
        const finalSubUrl = (isAbsolute && typeof window !== 'undefined' && !defaultSub.url.includes(window.location.host))
          ? `/api/subtitles/proxy?url=${encodeURIComponent(defaultSub.url)}`
          : defaultSub.url;

        subtitleConfig = {
          url: finalSubUrl,
          type: defaultSub.url.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
          style: {
            color: '#ffffff',
            fontSize: '22px',
            textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)',
            fontWeight: '600',
          },
          encoding: 'utf-8',
        };
      }

      const isHls = movie.stream_url.includes('.m3u8') || movie.stream_url.includes('m3u8');

      try {
        const artOptions = {
          container: artRef.current,
          url: movie.stream_url,
          type: isHls ? 'm3u8' : 'mp4',
          title: movie.title,
          poster: movie.backdrop_url || movie.poster_url || '',
          volume: 0.8,
          isLive: false,
          muted: false,
          autoplay: false,
          pip: true,
          autoSize: false,
          autoMini: true,
          screenshot: true,
          setting: true,
          loop: false,
          playbackRate: true,
          aspectRatio: true,
          fullscreen: true,
          fullscreenWeb: true,
          subtitleOffset: true,
          miniProgressBar: true,
          playsInline: true,
          theme: '#6366f1',
          lang: 'en',
          customType: {
            m3u8: function (video, url) {
              if (HlsConstructor && HlsConstructor.isSupported()) {
                const hls = new HlsConstructor({
                  enableWorker: true,
                  lowLatencyMode: true,
                });
                hls.loadSource(url);
                hls.attachMedia(video);

                hls.on(HlsConstructor.Events.MANIFEST_PARSED, function () {
                  if (hls.levels && hls.levels.length > 1) {
                    const qualityLevels = hls.levels.map((level, index) => ({
                      default: index === hls.currentLevel,
                      html: `${level.height || 'Auto'}p`,
                      level: index,
                    }));

                    art.controls.add({
                      name: 'quality',
                      position: 'right',
                      html: 'Quality',
                      selector: [
                        { default: true, html: 'Auto', level: -1 },
                        ...qualityLevels,
                      ],
                      onSelect: function (item) {
                        hls.currentLevel = item.level;
                        return item.html;
                      },
                    });
                  }
                });

                art.on('destroy', () => {
                  hls.destroy();
                });
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
              }
            },
          },
        };

        // Only attach subtitle if a valid config exists to satisfy Artplayer schema
        if (subtitleConfig && typeof subtitleConfig === 'object') {
          artOptions.subtitle = subtitleConfig;
        }

        const art = new ArtplayerConstructor(artOptions);

        playerInstanceRef.current = art;
        activeArt = art;
      } catch (e) {
        console.error('Failed to initialize Artplayer:', e);
      }
    };

    if (typeof window !== 'undefined' && window.Artplayer && window.Hls) {
      initArt(window.Artplayer, window.Hls);
    } else {
      Promise.all([import('artplayer'), import('hls.js')])
        .then(([artMod, hlsMod]) => {
          initArt(artMod.default || artMod, hlsMod.default || hlsMod);
        })
        .catch((err) => {
          console.warn('Fallback to window globals:', err);
          if (window.Artplayer) initArt(window.Artplayer, window.Hls);
        });
    }

    return () => {
      if (activeArt && activeArt.destroy) {
        activeArt.destroy(false);
      }
    };
  }, [scriptsLoaded, movie, activeSubIndex, playerMode]);

  // Change subtitle track
  function switchSubtitle(index) {
    setActiveSubIndex(index);
    if (!playerInstanceRef.current || !movie?.subtitles?.[index]) return;

    const targetSub = movie.subtitles[index];
    if (!targetSub || !targetSub.url) return;

    const isAbsolute = targetSub.url.startsWith('http://') || targetSub.url.startsWith('https://');
    const finalUrl = (isAbsolute && typeof window !== 'undefined' && !targetSub.url.includes(window.location.host))
      ? `/api/subtitles/proxy?url=${encodeURIComponent(targetSub.url)}`
      : targetSub.url;

    if (playerInstanceRef.current.subtitle && playerInstanceRef.current.subtitle.switch) {
      playerInstanceRef.current.subtitle.switch(finalUrl, {
        name: targetSub.name,
        type: targetSub.url.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
      });
    }
  }

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="watch-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={36} className="spin" style={{ animation: 'spin 1.2s linear infinite', color: 'var(--primary)' }} />
        <h2 style={{ marginTop: 20, fontSize: '1.4rem' }}>Loading Cinema Stream...</h2>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="watch-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: '1.6rem', marginBottom: 10 }}>Movie Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          {error || "The requested movie doesn't exist or was removed."}
        </p>
        <Link href="/" className="nav-btn nav-btn-primary">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const isDirectStream = Boolean(
    movie?.stream_url && (
      movie.stream_url.includes('.m3u8') ||
      movie.stream_url.includes('.mp4') ||
      movie.stream_url.includes('.webm')
    )
  );

  const activeMode = playerMode === 'auto' ? (isDirectStream ? 'native' : 'embed') : playerMode;

  const tmdbMatch = movie?.stream_url?.match(/\/(movie|tv)\/(\d+)/) || movie?.stream_url?.match(/tmdb=(\d+)/);
  const currentTmdbId = tmdbMatch ? tmdbMatch[2] : (movie?.id?.includes('spider-man') ? '969681' : null);

  const getEmbedUrl = () => {
    if (!currentTmdbId) return movie?.stream_url;
    if (selectedServer === 1) return `https://vidlink.pro/movie/${currentTmdbId}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
    if (selectedServer === 2) return `https://vidsrc.to/embed/movie/${currentTmdbId}`;
    if (selectedServer === 3) return `https://multiembed.mov/?video_id=${currentTmdbId}&tmdb=1`;
    return `https://vidlink.pro/movie/${currentTmdbId}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
  };

  const subtitlesList = Array.isArray(movie.subtitles) ? movie.subtitles : [];

  return (
    <div style={{ position: 'relative' }}>
      {/* CDN Scripts for Artplayer & HLS.js */}
      <Script
        src="https://cdn.jsdelivr.net/npm/hls.js@latest"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded((c) => c + 1)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded((c) => c + 1)}
      />

      {/* Cinema Mode Backdrop Dimmer */}
      {cinemaMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 90,
            pointerEvents: 'none',
          }}
        />
      )}

      <div className="watch-container" style={{ position: 'relative', zIndex: cinemaMode ? 95 : 1 }}>
        {/* Navigation & Controls Topbar */}
        <div className="watch-topbar">
          <Link href="/" className="back-link" id="back-to-catalog">
            <ArrowLeft size={18} />
            <span>Back to Browse</span>
          </Link>

          <div className="player-controls-strip">
            {/* Player Engine Switcher */}
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border)' }}>
              {/* <button
                onClick={() => setPlayerMode('native')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: activeMode === 'native' ? '#fff' : 'var(--text-secondary)',
                  background: activeMode === 'native' ? 'var(--primary)' : 'transparent',
                  transition: '0.15s ease'
                }}
                title="HD Native player (Artplayer with custom subtitle sync)"
              >
                ⚡ HD Native Player
              </button> */}
              <button
                onClick={() => setPlayerMode('embed')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: activeMode === 'embed' ? '#fff' : 'var(--text-secondary)',
                  background: activeMode === 'embed' ? 'var(--primary)' : 'transparent',
                  transition: '0.15s ease'
                }}
                title="Source website embed player"
              >
                🌐 Web Embed Player
              </button>
            </div>

            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              className="btn-secondary"
              title="Toggle Cinema Mode"
              id="cinema-mode-toggle"
            >
              <Moon size={15} color={cinemaMode ? '#a5b4fc' : 'currentColor'} />
              <span>{cinemaMode ? 'Lights On' : 'Cinema Mode'}</span>
            </button>
          </div>
        </div>

        {/* Server Switcher */}
        {activeMode === 'embed' && currentTmdbId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Stream Server:
            </span>
            <button
              onClick={() => setSelectedServer(1)}
              className={`sub-pill ${selectedServer === 1 ? 'active' : ''}`}
              id="server-btn-1"
            >
              ✨ Server 1 (VidLink • Ad-Free)
            </button>
            <button
              onClick={() => setSelectedServer(2)}
              className={`sub-pill ${selectedServer === 2 ? 'active' : ''}`}
              id="server-btn-2"
            >
              ⚡ Server 2 (VidSrc Mirror)
            </button>
            <button
              onClick={() => setSelectedServer(3)}
              className={`sub-pill ${selectedServer === 3 ? 'active' : ''}`}
              id="server-btn-3"
            >
              🚀 Server 3 (MultiEmbed)
            </button>
          </div>
        )}

        {/* Video Player Box */}
        <div className="player-wrapper" id="player-wrapper" style={{ position: 'relative' }}>
          {activeMode === 'native' ? (
            <div ref={artRef} className="player-container" id="artplayer-container" />
          ) : (
            <iframe
              src={getEmbedUrl()}
              sandbox={selectedServer === 1 ? 'allow-scripts allow-same-origin allow-forms allow-presentation' : undefined}
              style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={movie.title}
              id="embed-player-iframe"
            />
          )}
        </div>

        {/* Auto-Subtitles Banner (When using Embed Engine)
        {activeMode === 'embed' && (
          <div style={{
            marginTop: 16,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.88rem',
            color: '#86efac'
          }} id="embed-subtitles-banner">
            <Subtitles size={18} color="#34d399" />
            <span>
              <strong>Subtitles are automatically loaded inside the video:</strong> Click the <strong>[CC]</strong> button on the bottom-right of the player (next to the settings gear) to switch languages (English, Spanish, etc.)!
            </span>
          </div>
        )} */}

        {/* Subtitles Track Switcher Bar (For Native Direct Streams) */}
        {activeMode === 'native' && subtitlesList.filter(s => s.url).length > 0 && (
          <div className="subtitles-pill-bar" id="subtitles-track-selector">
            <div className="subtitles-pill-label">
              <Subtitles size={17} color="#34d399" />
              <span>Subtitle Tracks:</span>
            </div>
            {subtitlesList.filter(s => s.url).map((sub, idx) => (
              <button
                key={idx}
                className={`sub-pill ${activeSubIndex === idx ? 'active' : ''}`}
                onClick={() => switchSubtitle(idx)}
                id={`subtitle-pill-${idx}`}
              >
                {sub.name || `Track ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Movie Info Box */}
        <div className="movie-details-box">
          <div className="details-header">
            <div>
              <h1 className="details-title" id="movie-title">{movie.title}</h1>
              <div className="details-badges">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} /> {movie.release_year || '2024'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <Clock size={14} /> {movie.duration || '2h'}
                </span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  {movie.genre}
                </span>
              </div>
            </div>

          </div>

          <p className="details-desc">
            {movie.description || 'Enjoy seamless HD streaming with high-fidelity WebVTT subtitles.'}
          </p>
        </div>

        {/* Recommendations / Other Movies */}
        {allMovies.length > 0 && (
          <div style={{ marginTop: 50 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Film size={20} color="#6366f1" /> More Movies to Watch
            </h2>

            <div className="movies-grid">
              {allMovies.slice(0, 3).map((rec) => (
                <Link
                  key={rec.id}
                  href={`/watch/${rec.id}`}
                  className="movie-card"
                >
                  <div className="card-poster-wrap">
                    <img
                      src={rec.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'}
                      alt={rec.title}
                      className="card-poster"
                      loading="lazy"
                    />
                    <div className="poster-overlay">
                      <div className="play-hover-btn">
                        <Play size={20} fill="#fff" />
                      </div>
                    </div>
                  </div>
                  <div className="card-info">
                    <h3 className="card-title">{rec.title}</h3>
                    <div className="card-meta">
                      <span>{rec.release_year}</span>
                      <span>•</span>
                      <span>{rec.genre}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
