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
  Play,
  Settings,
  X,
  Sliders,
  Check,
  Tv,
  SkipBack,
  SkipForward,
  ListVideo
} from 'lucide-react';
import { cleanSubtitleVtt } from '@/lib/subtitles';

export function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

// Videos in our own storage (Backblaze, Supabase) or plain .mp4/.webm links have no embed mirror,
// so they always play in ArtPlayer ("embed" would only show the raw file in the browser's bare player)
function isHostedVideoFile(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/api/stream/b2/') ||
    url.includes('supabase.co') ||
    url.endsWith('.mp4') ||
    url.endsWith('.webm');
}

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
  const [resolvedStream, setResolvedStream] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [currentEpIndex, setCurrentEpIndex] = useState(0);

  // Initialize episode index from URL query param (?ep=1, ?ep=2...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const epParam = new URLSearchParams(window.location.search).get('ep');
      if (epParam) {
        const parsed = parseInt(epParam, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setCurrentEpIndex(parsed - 1);
        }
      }
    }
  }, []);

  const isSeries = Boolean(movie?.type === 'series' || (Array.isArray(movie?.episodes) && movie.episodes.length > 0));
  const episodesList = isSeries ? (movie?.episodes || []) : [];
  const currentEpisode = isSeries && episodesList[currentEpIndex] ? episodesList[currentEpIndex] : null;

  function switchEpisode(index) {
    if (!isSeries || index < 0 || index >= episodesList.length) return;
    setCurrentEpIndex(index);
    setActiveSubIndex(0);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('ep', String(index + 1));
      window.history.replaceState({}, '', url.toString());
    }
  }

  // Subtitle Appearance Customization State (Adhering to Netflix & BBC International Standards)
  const [subSettings, setSubSettings] = useState({
    fontSize: '22px', // '16px' | '22px' | '28px' | '34px'
    color: '#ffffff', // '#ffffff' | '#ffe600' | '#38bdf8' | '#4ade80'
    bg: 'shadow',     // 'shadow' | 'box' | 'solid'
    position: '45px', // '45px' | '75px' | 'top'
    formatting: 'styled', // 'styled' (formatted italics) | 'clean' (strip all tags)
  });
  const [showSubSettings, setShowSubSettings] = useState(false);

  // Load saved subtitle preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('watchbox_sub_settings');
      if (saved) {
        setSubSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch { }
  }, []);

  function applySubStyle(newValues) {
    const updated = { ...subSettings, ...newValues };
    setSubSettings(updated);
    try {
      localStorage.setItem('watchbox_sub_settings', JSON.stringify(updated));
    } catch { }

    if (newValues.formatting && newValues.formatting !== subSettings.formatting) {
      switchSubtitle(activeSubIndex, newValues.formatting);
    }

    if (playerInstanceRef.current && playerInstanceRef.current.subtitle) {
      const artSub = playerInstanceRef.current.subtitle;
      if (typeof artSub.style === 'function') {
        if (updated.fontSize) artSub.style('fontSize', updated.fontSize);
        if (updated.color) artSub.style('color', updated.color);
        if (updated.position) artSub.style('bottom', updated.position === 'top' ? 'calc(100% - 90px)' : updated.position);
        if (updated.bg === 'shadow') {
          artSub.style('textShadow', '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85)');
          artSub.style('backgroundColor', 'transparent');
          artSub.style('padding', '0');
        } else if (updated.bg === 'box') {
          artSub.style('textShadow', 'none');
          artSub.style('backgroundColor', 'rgba(0,0,0,0.65)');
          artSub.style('padding', '4px 10px');
          artSub.style('borderRadius', '6px');
        } else if (updated.bg === 'solid') {
          artSub.style('textShadow', 'none');
          artSub.style('backgroundColor', 'rgba(0,0,0,0.95)');
          artSub.style('padding', '4px 10px');
          artSub.style('borderRadius', '6px');
        }
      }
    }
  }

  // Fetch movie data & resolve stream manifest
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

        // If the movie has a direct file (YouTube, Google Drive, or Supabase Storage), we DO NOT need the pirate resolver
        const hasDirectFile = Boolean(
          data?.stream_url && (
            getYouTubeId(data.stream_url) ||
            data.stream_url.includes('drive.google.com') ||
            data.stream_url.includes('/api/stream/gdrive') ||
            data.stream_url.includes('supabase.co') ||
            data.stream_url.endsWith('.mp4') ||
            data.stream_url.endsWith('.webm')
          )
        );

        if (!hasDirectFile) {
          setIsResolving(true);
          fetch(`/api/resolve?id=${id}`)
            .then((r) => r.json())
            .then((rData) => {
              if (rData && rData.success && rData.streamUrl) {
                setResolvedStream(rData);
              }
            })
            .catch(() => {})
            .finally(() => {
              setIsResolving(false);
            });
        }
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

    const activeEp = (movie.type === 'series' || (Array.isArray(movie.episodes) && movie.episodes.length > 0))
      ? movie.episodes[currentEpIndex]
      : null;

    const rawCandidate = activeEp?.stream_url || resolvedStream?.streamUrl || movie.stream_url;
    let streamToPlay = rawCandidate;

    // YouTube Unlisted streams are rendered natively via the cinema YouTube embed iframe
    const ytId = getYouTubeId(streamToPlay);
    if (ytId) {
      if (playerInstanceRef.current && playerInstanceRef.current.destroy) {
        playerInstanceRef.current.destroy(false);
        playerInstanceRef.current = null;
      }
      return;
    }

    // Direct Google Drive 5TB stream handling
    if (streamToPlay && (streamToPlay.includes('drive.google.com') || streamToPlay.startsWith('/api/stream/gdrive'))) {
      const gdriveMatch = streamToPlay.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || streamToPlay.match(/id=([a-zA-Z0-9_-]+)/);
      if (gdriveMatch && !streamToPlay.startsWith('/api/stream/gdrive')) {
        streamToPlay = `/api/stream/gdrive?id=${gdriveMatch[1]}`;
      }
    }

    const isClientTokenized = rawCandidate?.includes('token=') && (rawCandidate?.includes('zealotsofzenith') || rawCandidate?.includes('ip_cidr'));
    if (streamToPlay && streamToPlay.includes('.m3u8') && !streamToPlay.startsWith('/api/proxy/stream') && !isClientTokenized) {
      streamToPlay = `/api/proxy/stream?url=${encodeURIComponent(streamToPlay)}`;
    }

    const isDirect = Boolean(
      resolvedStream?.streamUrl ||
      (streamToPlay && (
        streamToPlay.includes('.m3u8') ||
        streamToPlay.includes('.mp4') ||
        streamToPlay.includes('.webm') ||
        streamToPlay.includes('drive.google.com') ||
        streamToPlay.includes('/api/stream/gdrive') ||
        streamToPlay.includes('supabase.co')
      ))
    );

    // If there is no direct .m3u8 or video file, Artplayer cannot play webpage URLs
    if (!isDirect) return;

    if (!artRef.current) return;

    let activeArt = null;

    function cinemaDoubleTapPlugin(art) {
      const { $player } = art.template;
      if (!$player) return;

      let layer = $player.querySelector('.cinema-double-tap-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'cinema-double-tap-layer';
        layer.innerHTML = `
          <div class="double-tap-zone left" id="dt-zone-left">
            <div class="double-tap-ripple-content">
              <div class="double-tap-icon-wrapper">
                <svg class="double-tap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="11 17 6 12 11 7"></polyline>
                  <polyline points="18 17 13 12 18 7"></polyline>
                </svg>
                <svg class="double-tap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="11 17 6 12 11 7"></polyline>
                  <polyline points="18 17 13 12 18 7"></polyline>
                </svg>
              </div>
              <div class="double-tap-seconds" id="dt-sec-left">-10 seconds</div>
            </div>
          </div>
          <div class="double-tap-zone right" id="dt-zone-right">
            <div class="double-tap-ripple-content">
              <div class="double-tap-icon-wrapper">
                <svg class="double-tap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="13 17 18 12 13 7"></polyline>
                  <polyline points="6 17 11 12 6 7"></polyline>
                </svg>
                <svg class="double-tap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="13 17 18 12 13 7"></polyline>
                  <polyline points="6 17 11 12 6 7"></polyline>
                </svg>
              </div>
              <div class="double-tap-seconds" id="dt-sec-right">+10 seconds</div>
            </div>
          </div>
        `;
        $player.appendChild(layer);
      }

      const leftZone = layer.querySelector('#dt-zone-left');
      const rightZone = layer.querySelector('#dt-zone-right');
      const leftSec = layer.querySelector('#dt-sec-left');
      const rightSec = layer.querySelector('#dt-sec-right');

      let accumulatedSeconds = 0;
      let currentSide = null;
      let resetTimer = null;
      let wasPlayingBeforeTap = false;

      function triggerSeek(side) {
        const isForward = side === 'right';
        const activeZone = isForward ? rightZone : leftZone;
        const activeSecEl = isForward ? rightSec : leftSec;
        const inactiveZone = isForward ? leftZone : rightZone;

        if (inactiveZone) inactiveZone.classList.remove('active');

        if (currentSide === side) {
          accumulatedSeconds += 10;
        } else {
          accumulatedSeconds = 10;
          currentSide = side;
        }

        if (activeSecEl) {
          activeSecEl.textContent = `${isForward ? '+' : '-'}${accumulatedSeconds} seconds`;
        }

        if (activeZone) {
          activeZone.classList.remove('active');
          void activeZone.offsetWidth; // Force CSS animation restart
          activeZone.classList.add('active');
        }

        if (isForward) {
          const dur = art.duration || Infinity;
          art.seek = Math.min(dur, art.currentTime + 10);
          if (art.notice) art.notice.show = `+${accumulatedSeconds}s Forward`;
        } else {
          art.seek = Math.max(0, art.currentTime - 10);
          if (art.notice) art.notice.show = `-${accumulatedSeconds}s Backward`;
        }

        if (wasPlayingBeforeTap && !art.playing) {
          art.play().catch(() => {});
        }

        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          if (activeZone) activeZone.classList.remove('active');
          accumulatedSeconds = 0;
          currentSide = null;
        }, 650);
      }

      art.on('dblclick', (e) => {
        const rect = $player.getBoundingClientRect();
        const clientX = e.clientX || 0;
        const relX = clientX - rect.left;
        const ratio = relX / rect.width;

        if (ratio < 0.45) {
          triggerSeek('left');
        } else if (ratio > 0.55) {
          triggerSeek('right');
        } else {
          art.fullscreen = !art.fullscreen;
        }
      });

      let lastTouchTime = 0;
      let lastTouchSide = null;

      function onTouchEnd(e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const touch = e.changedTouches[0];
        const rect = $player.getBoundingClientRect();
        const relX = touch.clientX - rect.left;
        const ratio = relX / rect.width;

        const side = ratio < 0.45 ? 'left' : ratio > 0.55 ? 'right' : null;
        if (!side) return;

        const now = Date.now();
        if (now - lastTouchTime < 350 && lastTouchSide === side) {
          if (e.cancelable) e.preventDefault();
          triggerSeek(side);
          lastTouchTime = 0;
        } else {
          lastTouchTime = now;
          lastTouchSide = side;
          wasPlayingBeforeTap = art.playing;
        }
      }

      $player.addEventListener('touchend', onTouchEnd, { passive: false });

      if (art.hotkey) {
        art.hotkey.add('ArrowRight', () => {
          triggerSeek('right');
        });
        art.hotkey.add('ArrowLeft', () => {
          triggerSeek('left');
        });
      }

      return {
        name: 'cinemaDoubleTapSeek',
        triggerSeek,
        destroy() {
          clearTimeout(resetTimer);
          $player.removeEventListener('touchend', onTouchEnd);
          if (layer && layer.parentNode) {
            layer.parentNode.removeChild(layer);
          }
        }
      };
    }

    const initArt = (ArtplayerConstructor, HlsConstructor) => {
      if (!ArtplayerConstructor || !artRef.current) return;

      ArtplayerConstructor.DBCLICK_FULLSCREEN = false;
      ArtplayerConstructor.MOBILE_DBCLICK_PLAY = false;

      if (playerInstanceRef.current && playerInstanceRef.current.destroy) {
        playerInstanceRef.current.destroy(false);
        playerInstanceRef.current = null;
      }

      const rawSubs = [
        ...(Array.isArray(activeEp?.subtitles) && activeEp.subtitles.length > 0
          ? activeEp.subtitles
          : (Array.isArray(movie.subtitles) ? movie.subtitles : [])),
        ...(Array.isArray(resolvedStream?.subtitles) ? resolvedStream.subtitles : [])
      ];
      const subtitlesList = rawSubs.filter((s, i, arr) => s.url && arr.findIndex(x => x.url === s.url) === i);
      const defaultSub = subtitlesList[activeSubIndex] || subtitlesList[0];

      let subtitleConfig = undefined;
      if (defaultSub && defaultSub.url && defaultSub.url.trim()) {
        const isAbsolute = defaultSub.url.startsWith('http://') || defaultSub.url.startsWith('https://');
        const finalSubUrl = (isAbsolute && typeof window !== 'undefined' && !defaultSub.url.includes(window.location.host))
          ? `/api/subtitles/proxy?url=${encodeURIComponent(defaultSub.url)}${subSettings.formatting === 'clean' ? '&stripTags=1' : ''}`
          : defaultSub.url;

        subtitleConfig = {
          url: finalSubUrl,
          type: defaultSub.url.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
          style: {
            color: subSettings.color,
            fontSize: subSettings.fontSize,
            textShadow: subSettings.bg === 'shadow'
              ? '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85)'
              : 'none',
            backgroundColor: subSettings.bg === 'box'
              ? 'rgba(0,0,0,0.65)'
              : subSettings.bg === 'solid'
              ? 'rgba(0,0,0,0.95)'
              : 'transparent',
            padding: subSettings.bg !== 'shadow' ? '4px 10px' : '0',
            borderRadius: subSettings.bg !== 'shadow' ? '6px' : '0',
            fontWeight: '600',
            bottom: subSettings.position === 'top' ? 'calc(100% - 90px)' : subSettings.position,
          },
          encoding: 'utf-8',
          escape: false,
          onVttLoad: (vtt) => cleanSubtitleVtt(vtt, { stripAllTags: subSettings.formatting === 'clean' }),
        };
      }

      const isHls = streamToPlay?.includes('.m3u8') || streamToPlay?.includes('m3u8');

      try {
        const artOptions = {
          container: artRef.current,
          url: streamToPlay,
          type: isHls ? 'm3u8' : 'mp4',
          title: activeEp ? `${movie.title} • ${activeEp.title || `Episode ${activeEp.episode_number || currentEpIndex + 1}`}` : movie.title,
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
          plugins: [cinemaDoubleTapPlugin],
          settings: [
            {
              // Zoom to fill wide phone screens in fullscreen (crops the edges, removes black bars)
              name: 'fill-screen',
              html: 'Fill Screen',
              tooltip: 'Off',
              switch: false,
              onSwitch: function (item) {
                const fill = !item.switch;
                art.video.style.objectFit = fill ? 'cover' : '';
                item.tooltip = fill ? 'On' : 'Off';
                return fill;
              },
            },
          ],
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

                let fragFailCount = 0;
                hls.on(HlsConstructor.Events.ERROR, function (event, data) {
                  console.warn('[WatchBox Hls Error]:', data.type, data.details, data.response?.code);

                  // Detect CORS or 403/Forbidden fragment load errors from pirate CDNs
                  if (data.details === 'fragLoadError' || data.details === 'manifestLoadError') {
                    fragFailCount++;
                    if (fragFailCount >= 2) {
                      if (art && art.notice) {
                        art.notice.show = 'Stream blocked by CDN (CORS/403). Auto-switching to Embed Server...';
                      }
                      setTimeout(() => {
                        setPlayerMode('embed');
                      }, 1500);
                      return;
                    }
                  }

                  if (data.fatal) {
                    switch (data.type) {
                      case HlsConstructor.ErrorTypes.NETWORK_ERROR:
                        if (art && art.notice) {
                          art.notice.show = 'Network error or expired token. Switching to Embed Server...';
                        }
                        setTimeout(() => {
                          setPlayerMode('embed');
                        }, 1500);
                        break;
                      case HlsConstructor.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                      default:
                        hls.destroy();
                        break;
                    }
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

        art.on('subtitleBeforeUpdate', (cues) => {
          if (Array.isArray(cues)) {
            cues.forEach((cue) => {
              if (cue && cue.text) {
                if (subSettings.formatting === 'clean') {
                  cue.text = cue.text.replace(/<[^>]+>/g, '').replace(/\{[\\\/]?[^}]+\}/g, '');
                } else {
                  cue.text = cue.text.replace(/\{[\\\/]?[^}]+\}/g, '').replace(/<\/?font[^>]*>/gi, '');
                }
              }
            });
          }
        });

        art.on('video:ended', () => {
          if (isSeries && currentEpIndex < episodesList.length - 1) {
            if (art.notice) {
              art.notice.show = `Playing Next: Episode ${currentEpIndex + 2}...`;
            }
            setTimeout(() => {
              switchEpisode(currentEpIndex + 1);
            }, 1200);
          }
        });

        // Phones: fullscreen turns to landscape and fills the screen (Fill Screen in settings can switch it off)
        art.on('fullscreen', (isFullscreen) => {
          if (!ArtplayerConstructor.utils.isMobile) return;
          art.video.style.objectFit = isFullscreen ? 'cover' : '';
          art.setting.update({ name: 'fill-screen', switch: isFullscreen, tooltip: isFullscreen ? 'On' : 'Off' });
          try {
            if (isFullscreen && screen.orientation?.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            } else if (!isFullscreen && screen.orientation?.unlock) {
              screen.orientation.unlock();
            }
          } catch {
            // Orientation lock isn't supported everywhere (e.g. iOS Safari)
          }
        });

        art.on('error', (err) => {
          console.warn('[ArtPlayer Error]:', err);
          if (isHostedVideoFile(streamToPlay)) {
            if (art.notice) {
              art.notice.show = 'Video could not be loaded. Check the file link, and that it is an MP4 (H.264 video, AAC audio).';
            }
            return;
          }
          if (art && art.notice) {
            art.notice.show = 'Stream error or Google Drive quota limit. Switching to Embed player...';
          }
          setTimeout(() => {
            setPlayerMode('embed');
          }, 1500);
        });

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
  }, [scriptsLoaded, movie, activeSubIndex, playerMode, resolvedStream, currentEpIndex]);

  // Change subtitle track
  function switchSubtitle(index, forceFormatting) {
    setActiveSubIndex(index);
    if (!playerInstanceRef.current) return;

    const currentSubs = [
      ...(Array.isArray(currentEpisode?.subtitles) && currentEpisode.subtitles.length > 0
        ? currentEpisode.subtitles
        : (Array.isArray(movie?.subtitles) ? movie.subtitles : [])),
      ...(Array.isArray(resolvedStream?.subtitles) ? resolvedStream.subtitles : [])
    ].filter((s, i, arr) => s.url && arr.findIndex(x => x.url === s.url) === i);

    const targetSub = currentSubs[index];
    if (!targetSub || !targetSub.url) return;

    const activeFormatting = forceFormatting || subSettings.formatting;
    const isAbsolute = targetSub.url.startsWith('http://') || targetSub.url.startsWith('https://');
    const finalUrl = (isAbsolute && typeof window !== 'undefined' && !targetSub.url.includes(window.location.host))
      ? `/api/subtitles/proxy?url=${encodeURIComponent(targetSub.url)}${activeFormatting === 'clean' ? '&stripTags=1' : ''}`
      : targetSub.url;

    if (playerInstanceRef.current.subtitle && playerInstanceRef.current.subtitle.switch) {
      playerInstanceRef.current.subtitle.switch(finalUrl, {
        name: targetSub.name,
        type: targetSub.url.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
        escape: false,
        onVttLoad: (vtt) => cleanSubtitleVtt(vtt, { stripAllTags: activeFormatting === 'clean' }),
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

  const currentStreamUrl = currentEpisode?.stream_url || resolvedStream?.streamUrl || movie?.stream_url;
  const youtubeId = getYouTubeId(currentStreamUrl);

  const isDirectStorage = Boolean(
    youtubeId ||
    (currentStreamUrl && (
      currentStreamUrl.includes('drive.google.com') ||
      currentStreamUrl.includes('/api/stream/gdrive') ||
      currentStreamUrl.includes('supabase.co') ||
      currentStreamUrl.endsWith('.mp4') ||
      currentStreamUrl.endsWith('.webm')
    ))
  );

  const isDirectStream = Boolean(
    isDirectStorage ||
    resolvedStream?.streamUrl ||
    (currentStreamUrl && (
      currentStreamUrl.includes('.m3u8') ||
      currentStreamUrl.includes('.mp4') ||
      currentStreamUrl.includes('.webm')
    ))
  );

  const isGoogleDrive = Boolean(
    currentStreamUrl && (
      currentStreamUrl.includes('drive.google.com') ||
      currentStreamUrl.includes('/api/stream/gdrive')
    )
  );

  const isHostedFile = !youtubeId && isHostedVideoFile(currentStreamUrl);

  const activeMode = youtubeId
    ? 'youtube'
    : isHostedFile
    ? 'native'
    : (playerMode === 'auto' ? (isDirectStream ? 'native' : 'embed') : playerMode);

  const tmdbMatch = currentStreamUrl?.match(/\/(movie|tv)\/(\d+)/) || currentStreamUrl?.match(/tmdb=(\d+)/);
  const currentTmdbId = tmdbMatch ? tmdbMatch[2] : (movie?.id?.includes('spider-man') ? '969681' : null);

  const epNumber = currentEpisode?.episode_number || (currentEpIndex + 1);
  const getEmbedUrl = () => {
    if (currentStreamUrl && (currentStreamUrl.includes('drive.google.com') || currentStreamUrl.includes('/api/stream/gdrive'))) {
      const gdriveMatch = currentStreamUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || currentStreamUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (gdriveMatch) {
        return `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`;
      }
    }

    // Direct OK.ru embed normalization (supports ok.ru/video/ID and ok.ru/videoembed/ID)
    if (currentStreamUrl && currentStreamUrl.includes('ok.ru')) {
      const okMatch = currentStreamUrl.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/);
      if (okMatch) {
        return `https://ok.ru/videoembed/${okMatch[1]}`;
      }
      return currentStreamUrl;
    }

    // Direct VK, Streamtape, DoodStream, or custom embed URLs
    if (currentStreamUrl && (
      currentStreamUrl.includes('vk.com') ||
      currentStreamUrl.includes('streamtape') ||
      currentStreamUrl.includes('dood') ||
      currentStreamUrl.includes('mixdrop') ||
      (!currentStreamUrl.includes('tmdb') && !currentStreamUrl.match(/\/(movie|tv)\/\d+/))
    )) {
      return currentStreamUrl;
    }
    if (!currentTmdbId) return currentStreamUrl;
    if (isSeries) {
      if (selectedServer === 1) return `https://vidlink.pro/tv/${currentTmdbId}/1/${epNumber}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
      if (selectedServer === 2) return `https://vidsrc.to/embed/tv/${currentTmdbId}/1/${epNumber}`;
      if (selectedServer === 3) return `https://multiembed.mov/?video_id=${currentTmdbId}&tmdb=1&s=1&e=${epNumber}`;
      return `https://vidlink.pro/tv/${currentTmdbId}/1/${epNumber}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
    }
    if (selectedServer === 1) return `https://vidlink.pro/movie/${currentTmdbId}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
    if (selectedServer === 2) return `https://vidsrc.to/embed/movie/${currentTmdbId}`;
    if (selectedServer === 3) return `https://multiembed.mov/?video_id=${currentTmdbId}&tmdb=1`;
    return `https://vidlink.pro/movie/${currentTmdbId}?primaryColor=6366f1&secondaryColor=4f46e5&icons=vid`;
  };

  const rawSubs = [
    ...(Array.isArray(currentEpisode?.subtitles) && currentEpisode.subtitles.length > 0
      ? currentEpisode.subtitles
      : (Array.isArray(movie.subtitles) ? movie.subtitles : [])),
    ...(Array.isArray(resolvedStream?.subtitles) ? resolvedStream.subtitles : [])
  ];
  const subtitlesList = rawSubs.filter((s, i, arr) => s.url && arr.findIndex(x => x.url === s.url) === i);

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

      {/* In-Player Subtitle Settings Modal (International Standards & Customization) */}
      {showSubSettings && (
        <div className="sub-modal-backdrop" onClick={() => setShowSubSettings(false)}>
          <div className="sub-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={20} color="#818cf8" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                  Subtitle Settings & Appearance
                </h3>
              </div>
              <button
                onClick={() => setShowSubSettings(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Interactive Cinema Screen Live Preview */}
            <div className="sub-preview-screen">
              <div style={{
                position: 'absolute',
                bottom: subSettings.position === 'top' ? 'auto' : (subSettings.position === '75px' ? '28px' : '14px'),
                top: subSettings.position === 'top' ? '14px' : 'auto',
                fontSize: subSettings.fontSize,
                color: subSettings.color,
                fontWeight: 600,
                textAlign: 'center',
                textShadow: subSettings.bg === 'shadow' ? '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85)' : 'none',
                backgroundColor: subSettings.bg === 'box' ? 'rgba(0,0,0,0.65)' : subSettings.bg === 'solid' ? 'rgba(0,0,0,0.95)' : 'transparent',
                padding: subSettings.bg !== 'shadow' ? '4px 12px' : '0',
                borderRadius: subSettings.bg !== 'shadow' ? '6px' : '0',
                maxWidth: '90%',
                lineHeight: 1.35,
                transition: '0.15s ease',
              }}>
                {subSettings.formatting === 'styled' ? (
                  <i>WatchBox Cinema • Sample Subtitle (Netflix Std)</i>
                ) : (
                  'WatchBox Cinema • Sample Subtitle (Netflix Std)'
                )}
              </div>
            </div>

            {/* Font Size Option */}
            <div className="sub-setting-row">
              <div className="sub-setting-title">
                <span>Font Size (International Standard: 22px / ~3.8% height)</span>
                <span style={{ color: '#818cf8' }}>{subSettings.fontSize}</span>
              </div>
              <div className="sub-options-grid">
                {[
                  { label: 'Small (16px)', val: '16px' },
                  { label: 'Standard (22px)', val: '22px' },
                  { label: 'Large (28px)', val: '28px' },
                  { label: 'Extra Large (34px)', val: '34px' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`sub-opt-btn ${subSettings.fontSize === item.val ? 'active' : ''}`}
                    onClick={() => applySubStyle({ fontSize: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Color Option */}
            <div className="sub-setting-row">
              <div className="sub-setting-title">
                <span>Color (High-Contrast Guidelines)</span>
                <span style={{ color: subSettings.color }}>● Selected</span>
              </div>
              <div className="sub-options-grid">
                {[
                  { label: 'Pure White (Netflix Std)', val: '#ffffff' },
                  { label: 'Cinema Yellow', val: '#ffe600' },
                  { label: 'Ice Cyan', val: '#38bdf8' },
                  { label: 'Mint Green', val: '#4ade80' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`sub-opt-btn ${subSettings.color === item.val ? 'active' : ''}`}
                    onClick={() => applySubStyle({ color: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background / Contrast Box Option */}
            <div className="sub-setting-row">
              <div className="sub-setting-title">
                <span>Contrast & Background Style</span>
              </div>
              <div className="sub-options-grid">
                {[
                  { label: 'Drop Shadow Only (Netflix)', val: 'shadow' },
                  { label: 'Translucent Box (BBC)', val: 'box' },
                  { label: 'Solid Black Box (FCC)', val: 'solid' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`sub-opt-btn ${subSettings.bg === item.val ? 'active' : ''}`}
                    onClick={() => applySubStyle({ bg: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Option */}
            <div className="sub-setting-row">
              <div className="sub-setting-title">
                <span>Vertical Screen Placement</span>
              </div>
              <div className="sub-options-grid">
                {[
                  { label: 'Bottom Safe Area (Standard)', val: '45px' },
                  { label: 'Raised Above Controls (75px)', val: '75px' },
                  { label: 'Top of Screen', val: 'top' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`sub-opt-btn ${subSettings.position === item.val ? 'active' : ''}`}
                    onClick={() => applySubStyle({ position: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Formatting Option (Fixes raw <i> / <font> tags) */}
            <div className="sub-setting-row">
              <div className="sub-setting-title">
                <span>Tag Handling & Formatting (Zero Raw Markup)</span>
                <span style={{ color: '#818cf8' }}>
                  {subSettings.formatting === 'styled' ? '✨ Formatted Italics (Netflix Std)' : '🔤 Clean Plain Text'}
                </span>
              </div>
              <div className="sub-options-grid">
                {[
                  { label: '✨ Formatted Italics (No Raw Tags)', val: 'styled' },
                  { label: '🔤 Clean Plain Text (Strip All Tags)', val: 'clean' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`sub-opt-btn ${subSettings.formatting === item.val ? 'active' : ''}`}
                    onClick={() => applySubStyle({ formatting: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Standards Compliance Note */}
            <div style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: '0.78rem',
              color: '#c7d2fe',
              lineHeight: 1.5,
            }}>
              💡 <strong>International Guidelines (Netflix Timed Text & BBC Standards):</strong><br />
              Raw markup tags like <code>&lt;i&gt;</code>, <code>&lt;font&gt;</code>, and <code>&#123;\an8&#125;</code> are strictly parsed or stripped so raw code never appears on screen. Subtitles use proportional sans-serif font, maximum 2 lines per cue, with title-safe margins.
            </div>
          </div>
        </div>
      )}

      <div className="watch-container" style={{ position: 'relative', zIndex: cinemaMode ? 95 : 1 }}>
        {/* Navigation & Controls Topbar */}
        <div className="watch-topbar">
          <Link href="/" className="back-link" id="back-to-catalog">
            <ArrowLeft size={18} />
            <span>Back to Browse</span>
          </Link>

          <div className="player-controls-strip">
            {/* Direct Cinema Badge vs Player Switcher */}
            {youtubeId ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#fca5a5'
              }}>
                <CheckCircle2 size={15} color="#ef4444" />
                <span>⚡ 1080p Ad-Free YouTube Cinema Stream (Zero Ads)</span>
              </div>
            ) : (
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border)' }}>
                {isDirectStream && (
                  <button
                    onClick={() => setPlayerMode('native')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: activeMode === 'native' ? '#fff' : 'var(--text-secondary)',
                      background: activeMode === 'native' ? 'var(--primary)' : 'transparent',
                      transition: '0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                    title="HD Native player (Pure HTML5 ArtPlayer, Zero Ads)"
                    id="btn-native-player"
                  >
                    ⚡ HD Native (Zero Ads)
                  </button>
                )}
                {!isHostedFile && (
                  <button
                    onClick={() => setPlayerMode('embed')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: (activeMode === 'embed' || !isDirectStream) ? '#fff' : 'var(--text-secondary)',
                      background: (activeMode === 'embed' || !isDirectStream) ? 'var(--primary)' : 'transparent',
                      transition: '0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                    title={isGoogleDrive ? 'Google Drive Web Embed / Mirror Player' : 'Web Embed Player (Multi-server fallback)'}
                    id="btn-embed-player"
                  >
                    {isGoogleDrive ? '🌐 Drive Mirror' : '🌐 Embed Player'}
                  </button>
                )}
              </div>
            )}

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

        {/* Server Switcher (Available when in Embed mode and movie has TMDB record) */}
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
          {youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&fs=1&controls=1&color=white`}
              style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title={movie.title}
              id="youtube-cinema-player"
            />
          ) : activeMode === 'native' && isDirectStream ? (
            <div ref={artRef} className="player-container" id="artplayer-container" />
          ) : (
            <iframe
              src={getEmbedUrl()}
              style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={movie.title}
              id="embed-player-iframe"
            />
          )}
        </div>

        {/* Series Quick Next/Prev Episode Strip (for TV Dramas & Series) */}
        {isSeries && episodesList.length > 0 && (
          <div className="series-ep-nav-bar" id="series-ep-nav">
            <button
              type="button"
              onClick={() => switchEpisode(currentEpIndex - 1)}
              disabled={currentEpIndex === 0}
              className="ep-nav-btn"
              id="btn-prev-episode"
              title="Previous Episode"
            >
              <SkipBack size={15} />
              <span>Prev Episode</span>
            </button>

            <div className="ep-nav-center">
              <span className="ep-nav-badge">EPISODE {currentEpIndex + 1} OF {episodesList.length}</span>
              <span className="ep-nav-title">{currentEpisode?.title || `Episode ${currentEpIndex + 1}`}</span>
            </div>

            <button
              type="button"
              onClick={() => switchEpisode(currentEpIndex + 1)}
              disabled={currentEpIndex >= episodesList.length - 1}
              className="ep-nav-btn"
              id="btn-next-episode"
              title="Next Episode"
            >
              <span>Next Episode</span>
              <SkipForward size={15} />
            </button>
          </div>
        )}

        {/* Subtitles Track Switcher Bar (For Native Direct Streams) */}
        {activeMode === 'native' && (
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
            <button
              type="button"
              className="sub-settings-trigger"
              onClick={() => setShowSubSettings(true)}
              id="open-sub-settings-btn"
              title="Customize subtitle size, color, background and position"
            >
              <Sliders size={14} />
              <span>Subtitle Settings</span>
            </button>
          </div>
        )}

        {/* Series Playlist / Episodes Drawer (Netflix & Drama Standard) */}
        {isSeries && episodesList.length > 0 && (
          <div className="series-playlist-container" id="series-episodes-section">
            <div className="playlist-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="playlist-icon-badge">
                  <Tv size={18} />
                </div>
                <div>
                  <h2 className="playlist-title">Episodes Playlist</h2>
                  <p className="playlist-subtitle">{episodesList.length} Episodes available • Instant streaming without page reload</p>
                </div>
              </div>
              <div className="playlist-active-counter">
                Now Playing: <strong>EP {currentEpIndex + 1}</strong>
              </div>
            </div>

            <div className="episodes-grid">
              {episodesList.map((ep, idx) => {
                const isActive = currentEpIndex === idx;
                return (
                  <div
                    key={ep.id || idx}
                    onClick={() => switchEpisode(idx)}
                    className={`episode-card ${isActive ? 'active' : ''}`}
                    id={`episode-card-${idx + 1}`}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ep-card-left">
                      <div className={`ep-number-badge ${isActive ? 'active' : ''}`}>
                        {isActive ? (
                          <div className="ep-playing-equalizer">
                            <span /><span /><span />
                          </div>
                        ) : (
                          <span>{ep.episode_number || idx + 1}</span>
                        )}
                      </div>
                    </div>
                    <div className="ep-card-info">
                      <div className="ep-card-title-row">
                        <h4 className="ep-card-title">
                          {ep.title || `Episode ${ep.episode_number || idx + 1}`}
                        </h4>
                        {isActive && (
                          <span className="badge badge-now-playing">NOW PLAYING</span>
                        )}
                      </div>
                      <div className="ep-card-meta">
                        {ep.duration && (
                          <span className="ep-meta-item">
                            <Clock size={12} /> {ep.duration}
                          </span>
                        )}
                        {ep.stream_url && (
                          <span className="ep-meta-badge">
                            {ep.stream_url.includes('drive.google.com') ? 'Google Drive' : ep.stream_url.includes('youtube') ? 'YouTube' : 'HD 1080p'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ep-card-action">
                      <div className={`ep-play-circle ${isActive ? 'active' : ''}`}>
                        <Play size={14} fill={isActive ? '#fff' : 'currentColor'} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Movie Info Box */}
        <div className="movie-details-box">
          <div className="details-header">
            <div>
              <h1 className="details-title" id="movie-title">
                {movie.title}
                {isSeries && currentEpisode && (
                  <span style={{ fontSize: '1.05rem', color: '#818cf8', display: 'block', fontWeight: 600, marginTop: 4 }}>
                    {currentEpisode.title || `Episode ${currentEpisode.episode_number || currentEpIndex + 1}`}
                  </span>
                )}
              </h1>
              <div className="details-badges">
                {isSeries ? (
                  <span className="badge badge-featured" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                    📺 TV Series • {episodesList.length} Episodes
                  </span>
                ) : null}
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} /> {movie.release_year || '2024'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <Clock size={14} /> {isSeries ? (currentEpisode?.duration || movie.duration || '45m') : (movie.duration || '2h')}
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
