'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Subtitles,
  Database,
  Film,
  Key,
  Copy,
  Info,
  Save,
  Check,
  Wand2,
  HelpCircle,
  Lock,
  LogOut,
  ArrowLeft,
  Upload
} from 'lucide-react';

function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [dbStatus, setDbStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' | 'form' | 'supabase'

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Sci-Fi / Action');
  const [releaseYear, setReleaseYear] = useState('2024');
  const [duration, setDuration] = useState('1h 45m');
  const [rating, setRating] = useState('HD 1080p');
  const [isFeatured, setIsFeatured] = useState(false);
  const [subtitles, setSubtitles] = useState([
    { name: 'English (CC)', url: '', isDefault: true }
  ]);

  // Quick Stream Edit Modal State
  const [quickEditMovie, setQuickEditMovie] = useState(null);
  const [quickStreamUrl, setQuickStreamUrl] = useState('');

  // Video Test Preview State
  const [testStreamUrl, setTestStreamUrl] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Smart Link Importer & Guide State
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [showF12Guide, setShowF12Guide] = useState(false);

  // Direct Storage Upload, YouTube & Google Drive State
  const [sourceMode, setSourceMode] = useState('youtube'); // 'youtube' | 'upload' | 'gdrive' | 'link'
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');
  const [gdriveInputUrl, setGdriveInputUrl] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const videoInputRef = useRef(null);
  const subInputRef = useRef(null);
  const subUploadTargetRef = useRef(null);
  const [subUploadIndex, setSubUploadIndex] = useState(null);
  const [subSearchId, setSubSearchId] = useState('');
  const [subSearching, setSubSearching] = useState(false);

  function detectSubLanguage(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('_en') || lower.includes('.en.') || lower.includes('-en') || lower.includes('eng')) return 'English';
    if (lower.includes('_es') || lower.includes('.es.') || lower.includes('-es') || lower.includes('spa')) return 'Español';
    if (lower.includes('_fr') || lower.includes('.fr.') || lower.includes('-fr') || lower.includes('fre')) return 'Français';
    if (lower.includes('_de') || lower.includes('.de.') || lower.includes('-de') || lower.includes('ger')) return 'Deutsch';
    if (lower.includes('_hi') || lower.includes('.hi.') || lower.includes('-hi') || lower.includes('hin')) return 'हिन्दी (Hindi)';
    if (lower.includes('_ar') || lower.includes('.ar.') || lower.includes('-ar') || lower.includes('ara')) return 'العربية (Arabic)';
    if (lower.includes('_it') || lower.includes('.it.') || lower.includes('-it') || lower.includes('ita')) return 'Italiano';
    if (lower.includes('_pt') || lower.includes('.pt.') || lower.includes('-pt') || lower.includes('por')) return 'Português';
    if (lower.includes('_ru') || lower.includes('.ru.') || lower.includes('-ru') || lower.includes('rus')) return 'Русский';
    if (lower.includes('_ja') || lower.includes('.ja.') || lower.includes('-ja') || lower.includes('jpn')) return '日本語 (Japanese)';
    return filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim() || 'Custom Subtitles';
  }

  function handleConnectYouTube() {
    if (!youtubeInputUrl.trim()) return;
    const parsedId = getYouTubeId(youtubeInputUrl);
    if (parsedId) {
      setStreamUrl(`https://www.youtube.com/watch?v=${parsedId}`);
      setStatusMessage({ text: `Connected Ad-Free YouTube Cinema Stream (ID: ${parsedId})! Zero quota limits and instant 1080p playback ready.`, type: 'success' });
    } else {
      setStatusMessage({ text: 'Could not detect a valid YouTube Video ID or URL. Please paste the full YouTube link or 11-digit Video ID.', type: 'error' });
    }
  }

  function handleConnectGDrive() {
    if (!gdriveInputUrl.trim()) return;
    const match = gdriveInputUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  gdriveInputUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                  gdriveInputUrl.match(/^([a-zA-Z0-9_-]{20,})$/);
    if (match) {
      const fileId = match[1];
      setStreamUrl(`/api/stream/gdrive?id=${fileId}`);
      setStatusMessage({ text: 'Connected 5TB Google Drive video stream! 1080p native playback ready.', type: 'success' });
    } else {
      setStreamUrl(gdriveInputUrl.trim());
    }
  }

  async function handleFetchSubtitles() {
    const queryId = subSearchId.trim() || id || (title ? title.toLowerCase() : '') || '969681';
    setSubSearching(true);
    try {
      const res = await fetch(`/api/subtitles/search?id=${encodeURIComponent(queryId)}&title=${encodeURIComponent(title || '')}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        setSubtitles(data.subtitles);
        setStatusMessage({ text: `Auto-fetched ${data.subtitles.length} international subtitle tracks!`, type: 'success' });
      } else {
        setStatusMessage({ text: 'No external subtitles found for this ID.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Subtitle fetch error: ${err.message}`, type: 'error' });
    } finally {
      setSubSearching(false);
    }
  }

  async function handleFileUpload(file, folder = 'videos', targetIndex = null) {
    if (!file) return;
    setUploadLoading(true);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUploadStatus(`Uploading ${file.name} (${sizeMb} MB) to Supabase Storage...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.publicUrl) {
        if (folder === 'videos') {
          setStreamUrl(data.publicUrl);
          setUploadStatus(`✅ Video uploaded successfully! Public link: ${data.publicUrl}`);
        } else if (folder === 'subtitles') {
          const detectedLang = detectSubLanguage(file.name);
          setSubtitles((prev) => {
            const updated = [...prev];
            if (targetIndex !== null && updated[targetIndex]) {
              updated[targetIndex] = {
                ...updated[targetIndex],
                url: data.publicUrl,
                name: updated[targetIndex].name && updated[targetIndex].name !== 'English (CC)' ? updated[targetIndex].name : detectedLang,
              };
            } else {
              const emptyIdx = updated.findIndex((s) => !s.url || !s.url.trim());
              if (emptyIdx !== -1) {
                updated[emptyIdx] = {
                  name: detectedLang,
                  url: data.publicUrl,
                  isDefault: emptyIdx === 0,
                };
              } else {
                updated.push({
                  name: detectedLang,
                  url: data.publicUrl,
                  isDefault: updated.length === 0,
                });
              }
            }
            return updated;
          });
          setUploadStatus(`✅ Subtitle "${file.name}" uploaded, converted to WebVTT, and added!`);
        }
      } else {
        setUploadStatus(`❌ Upload failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      setUploadStatus(`❌ Upload error: ${err.message}`);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleAutoExtract() {
    if (!importUrl || !importUrl.trim()) return;
    setImportLoading(true);
    setImportStatus('Inspecting link for video stream & subtitle tracks...');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.title && !title) {
          setTitle(data.title);
          if (!id) setId(data.title.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }
        if (data.stream_url) {
          setStreamUrl(data.stream_url);
        }
        if (Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          setSubtitles(data.subtitles);
        }
        setImportStatus(`Success: ${data.message || 'Stream link and subtitles auto-populated!'}`);
      } else {
        setImportStatus(`Notice: ${data.message || data.error || 'Could not auto-extract. You can paste the .m3u8 directly or use Embed mode.'}`);
      }
    } catch (err) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  }

  // Verify existing session from localStorage
  useEffect(() => {
    async function verifyStoredAuth() {
      try {
        const savedKey = localStorage.getItem('watchbox_admin_key') || localStorage.getItem('cinemahub_admin_key');
        if (savedKey) {
          const res = await fetch('/api/movies?verifyKey=1', {
            headers: { Authorization: `Bearer ${savedKey}` },
          });
          if (res.ok) {
            setAdminKey(savedKey);
            setIsAuthenticated(true);
            loadMovies();
            checkDbStatus();
            setAuthChecking(false);
            return;
          }
        }
      } catch { }
      setIsAuthenticated(false);
      setAuthChecking(false);
    }
    verifyStoredAuth();
  }, []);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (!loginInput.trim()) {
      setLoginError('Please enter your admin secret key.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/movies?verifyKey=1', {
        headers: { Authorization: `Bearer ${loginInput.trim()}` },
      });
      if (res.ok) {
        const key = loginInput.trim();
        setAdminKey(key);
        try {
          localStorage.setItem('watchbox_admin_key', key);
        } catch { }
        setIsAuthenticated(true);
        loadMovies();
        checkDbStatus();
      } else {
        setLoginError('Invalid secret key. Please check your password.');
      }
    } catch (err) {
      setLoginError(`Connection error: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem('watchbox_admin_key');
      localStorage.removeItem('cinemahub_admin_key');
    } catch { }
    setAdminKey('');
    setIsAuthenticated(false);
    setLoginInput('');
    setLoginError('');
  }

  async function checkDbStatus() {
    try {
      const res = await fetch('/api/movies?checkStatus=1');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data.status);
      }
    } catch { }
  }

  async function loadMovies() {
    try {
      setLoading(true);
      const res = await fetch('/api/movies');
      if (res.ok) {
        const data = await res.json();
        setMovies(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveAdminKey(val) {
    setAdminKey(val);
    try {
      localStorage.setItem('watchbox_admin_key', val);
    } catch { }
  }

  // Subtitles Management inside form
  function addSubtitleField() {
    setSubtitles([...subtitles, { name: 'Español', url: '', isDefault: false }]);
  }

  function removeSubtitleField(index) {
    setSubtitles(subtitles.filter((_, i) => i !== index));
  }

  function updateSubtitleField(index, field, value) {
    const updated = [...subtitles];
    updated[index] = { ...updated[index], [field]: value };
    setSubtitles(updated);
  }

  // Reset form
  function resetForm() {
    setIsEditing(false);
    setId('');
    setTitle('');
    setStreamUrl('');
    setPosterUrl('');
    setBackdropUrl('');
    setDescription('');
    setGenre('Sci-Fi / Action');
    setReleaseYear('2024');
    setDuration('1h 45m');
    setRating('HD 1080p');
    setIsFeatured(false);
    setSubtitles([{ name: 'English (CC)', url: '', isDefault: true }]);
    setTestStreamUrl('');
    setSourceMode('youtube');
    setYoutubeInputUrl('');
    setUploadStatus('');
    setGdriveInputUrl('');
    setImportUrl('');
    setImportStatus('');
    setSubSearchId('');
  }

  // Populate form for editing
  function handleStartEdit(movie) {
    setIsEditing(true);
    setId(movie.id);
    setTitle(movie.title || '');
    setStreamUrl(movie.stream_url || '');
    const ytId = getYouTubeId(movie.stream_url);
    const isGDrive = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('drive.google.com') ||
        movie.stream_url.includes('/api/stream/gdrive')
      )
    );
    const isDirectStorage = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('supabase.co') ||
        movie.stream_url.endsWith('.mp4') ||
        movie.stream_url.endsWith('.webm')
      )
    );
    if (ytId) {
      setSourceMode('youtube');
      setYoutubeInputUrl(movie.stream_url);
    } else if (isGDrive) {
      setSourceMode('gdrive');
      setGdriveInputUrl(movie.stream_url);
    } else if (isDirectStorage) {
      setSourceMode('upload');
    } else {
      setSourceMode('link');
    }
    setUploadStatus('');
    setSubSearchId(movie.id || '');
    setPosterUrl(movie.poster_url || '');
    setBackdropUrl(movie.backdrop_url || '');
    setDescription(movie.description || '');
    setGenre(movie.genre || 'Action');
    setReleaseYear(movie.release_year?.toString() || '2024');
    setDuration(movie.duration || '2h');
    setRating(movie.rating || 'HD 1080p');
    setIsFeatured(Boolean(movie.is_featured));
    setSubtitles(
      Array.isArray(movie.subtitles) && movie.subtitles.length > 0
        ? movie.subtitles
        : [{ name: 'English (CC)', url: '', isDefault: true }]
    );
    setActiveTab('form');
  }

  // Save / Update Movie
  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMessage({ text: 'Saving movie...', type: 'info' });

    // Filter valid subtitles
    const validSubs = subtitles
      .filter((s) => s.url && s.url.trim().length > 0)
      .map((s) => ({
        name: s.name.trim() || 'Subtitle',
        url: s.url.trim(),
        isDefault: Boolean(s.isDefault),
      }));

    const movieSlug = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const payload = {
      id: movieSlug,
      title: title.trim(),
      stream_url: streamUrl.trim(),
      poster_url: posterUrl.trim(),
      backdrop_url: backdropUrl.trim(),
      description: description.trim(),
      genre: genre.trim(),
      release_year: parseInt(releaseYear, 10) || 2024,
      duration: duration.trim(),
      rating: rating.trim(),
      is_featured: isFeatured,
      subtitles: validSubs,
    };

    try {
      const endpoint = `/api/movies/${movieSlug}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatusMessage({
          text: `Success: "${title}" saved and live!`,
          type: 'success',
        });
        loadMovies();
        setActiveTab('movies');
        resetForm();
      } else {
        const data = await res.json();
        setStatusMessage({
          text: `Error: ${data.error || 'Failed to save'}`,
          type: 'error',
        });
      }
    } catch (err) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    }
  }

  // Quick stream recovery save
  async function handleQuickStreamSave(e) {
    e.preventDefault();
    if (!quickEditMovie) return;

    setStatusMessage({ text: 'Updating stream link...', type: 'info' });
    let finalUrl = quickStreamUrl.trim();
    const ytId = getYouTubeId(finalUrl);
    if (ytId) {
      finalUrl = `https://www.youtube.com/watch?v=${ytId}`;
    }

    try {
      const res = await fetch(`/api/movies/${quickEditMovie.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          stream_url: finalUrl,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          text: `Stream link for "${quickEditMovie.title}" successfully updated!`,
          type: 'success',
        });
        setQuickEditMovie(null);
        loadMovies();
      } else {
        const data = await res.json();
        setStatusMessage({ text: `Error: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Error: ${err.message}`, type: 'error' });
    }
  }

  // Delete movie
  async function handleDelete(movieId, movieTitle) {
    if (!confirm(`Are you sure you want to delete "${movieTitle}"? This cannot be undone.`)) {
      return;
    }

    setStatusMessage({ text: 'Deleting movie...', type: 'info' });
    try {
      const res = await fetch(`/api/movies/${movieId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
      });

      if (res.ok) {
        setStatusMessage({ text: `Deleted "${movieTitle}"`, type: 'success' });
        loadMovies();
      } else {
        const data = await res.json();
        setStatusMessage({ text: `Delete failed: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Delete error: ${err.message}`, type: 'error' });
    }
  }

  const supabaseSql = `-- Supabase Table & RLS Setup
create table if not exists movies (
  id text primary key,
  title text not null,
  stream_url text not null,
  poster_url text default '',
  backdrop_url text default '',
  description text default '',
  genre text default 'Sci-Fi',
  release_year integer default 2024,
  duration text default '2h 10m',
  rating text default 'PG-13',
  subtitles jsonb default '[]'::jsonb,
  is_featured boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table movies enable row level security;

create policy "Allow public read"
  on movies for select
  using (true);

create policy "Allow service role full access"
  on movies for all
  using (auth.role() = 'service_role');`;

  function copySqlToClipboard() {
    navigator.clipboard.writeText(supabaseSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <RefreshCw size={32} className="spin" style={{ animation: 'spin 1.2s linear infinite', color: '#6366f1' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Verifying administrative credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 30px',
          boxShadow: 'var(--shadow-lg), 0 0 40px rgba(99, 102, 241, 0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#818cf8',
            }}>
              <Lock size={26} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: 8 }}>WatchBox Admin</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Enter your secret admin key to access stream recovery and movie controls.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.5 }}>
                ADMIN SECRET KEY
              </label>
              <input
                type="password"
                value={loginInput}
                onChange={(e) => { setLoginInput(e.target.value); setLoginError(''); }}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#07090e',
                  border: loginError ? '1px solid #ef4444' : '1px solid var(--border)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                autoFocus
                id="admin-login-key-input"
              />
              {loginError && (
                <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> {loginError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-play-hero"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px',
                fontSize: '0.95rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                opacity: loginLoading ? 0.7 : 1,
              }}
              id="admin-login-submit-btn"
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Verifying Key...</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Unlock Admin Panel</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Back to WatchBox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-icon" style={{ width: 34, height: 34 }}>
              <Shield size={18} />
            </div>
            <h1>Admin Control Panel</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.92rem' }}>
            Instant stream URL recovery, subtitle tracks manager, and movie catalog controls.
          </p>
        </div>

        {/* Admin Key Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <Key size={16} color="#6366f1" />
            <input
              type="password"
              placeholder="Admin Secret Key"
              value={adminKey}
              onChange={(e) => handleSaveAdminKey(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '0.88rem', width: 140 }}
              id="admin-key-input"
            />
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Active</span>
          </div>

          <button
            onClick={handleLogout}
            className="nav-btn nav-btn-ghost"
            title="Lock Admin Panel"
            style={{ fontSize: '0.82rem', padding: '8px 12px', color: '#f87171' }}
            id="admin-logout-btn"
          >
            <LogOut size={15} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Database Connection Status Banner */}
      <div className={`status-banner ${dbStatus?.isSupabase ? 'connected' : 'fallback'}`}>
        <Database size={18} />
        <div style={{ flex: 1 }}>
          <strong>Database Status:</strong> {dbStatus ? dbStatus.provider : 'Checking connection...'}
          {!dbStatus?.isSupabase && (
            <span style={{ marginLeft: 8, fontSize: '0.82rem', opacity: 0.9 }}>
              (Saving to local storage. Connect Supabase anytime for free cloud deployment).
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveTab('supabase')}
          className="nav-btn nav-btn-ghost"
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
        >
          View Supabase SQL Guide &rarr;
        </button>
      </div>

      {/* Status Notifications */}
      {statusMessage.text && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.9rem',
            background:
              statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : statusMessage.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
            border: `1px solid ${statusMessage.type === 'success'
              ? 'rgba(16, 185, 129, 0.3)'
              : statusMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(99, 102, 241, 0.3)'
              }`,
            color:
              statusMessage.type === 'success'
                ? '#86efac'
                : statusMessage.type === 'error'
                  ? '#fca5a5'
                  : '#c7d2fe',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'movies' ? 'active' : ''}`}
          onClick={() => setActiveTab('movies')}
          id="tab-movies-list"
        >
          <Film size={16} style={{ display: 'inline', marginRight: 6 }} />
          Movie Library ({movies.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => {
            if (!isEditing) resetForm();
            setActiveTab('form');
          }}
          id="tab-add-movie"
        >
          <Plus size={16} style={{ display: 'inline', marginRight: 6 }} />
          {isEditing ? `Edit: ${title}` : 'Add New Movie'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'supabase' ? 'active' : ''}`}
          onClick={() => setActiveTab('supabase')}
          id="tab-supabase-guide"
        >
          <Database size={16} style={{ display: 'inline', marginRight: 6 }} />
          Supabase Free Tier Setup
        </button>
      </div>

      {/* TAB 1: MOVIES LIST */}
      {activeTab === 'movies' && (
        <div>
          {/* Quick Stream Recovery Action Box */}
          <div className="recovery-card">
            <div className="recovery-info">
              <h3>⚡ Quick Stream Recovery</h3>
              <p>
                If a movie stream link breaks or goes down, simply click "Update Stream Link" on the movie below to instantly fix it for all viewers!
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setActiveTab('form');
              }}
              className="nav-btn nav-btn-primary"
            >
              <Plus size={16} /> Add Another Movie
            </button>
          </div>

          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Movie</th>
                    <th>Genre & Year</th>
                    <th>Stream Source</th>
                    <th>Subtitles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {movies.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                        No movies in database. Click "Add New Movie" above to add your first film.
                      </td>
                    </tr>
                  ) : (
                    movies.map((m) => {
                      const subs = Array.isArray(m.subtitles) ? m.subtitles : [];
                      return (
                        <tr key={m.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <img
                                src={m.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&auto=format&fit=crop&q=80'}
                                alt=""
                                style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, background: '#1e293b' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{m.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: {m.id}</div>
                                {m.is_featured && (
                                  <span className="badge badge-featured" style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: 4 }}>
                                    Featured Hero
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ color: 'var(--text-secondary)' }}>{m.genre}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.release_year} • {m.duration}</div>
                          </td>

                          <td style={{ maxWidth: 260 }}>
                            <div style={{
                              fontSize: '0.78rem',
                              fontFamily: 'monospace',
                              color: '#a5b4fc',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '4px 8px',
                              borderRadius: 4
                            }}>
                              {m.stream_url}
                            </div>
                            <button
                              onClick={() => {
                                setQuickEditMovie(m);
                                setQuickStreamUrl(m.stream_url || '');
                              }}
                              style={{
                                fontSize: '0.75rem',
                                color: '#f87171',
                                fontWeight: 600,
                                marginTop: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              id={`quick-update-btn-${m.id}`}
                            >
                              <RefreshCw size={12} /> Replace Broken Link
                            </button>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: subs.length > 0 ? '#34d399' : 'var(--text-muted)' }}>
                              <Subtitles size={14} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{subs.length} Tracks</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {subs.map((s) => s.name).join(', ') || 'No subtitles'}
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Link
                                href={`/watch/${m.id}`}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                title="Open in Player"
                                target="_blank"
                              >
                                <Play size={14} />
                              </Link>

                              <button
                                onClick={() => handleStartEdit(m)}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#93c5fd' }}
                                title="Full Edit"
                                id={`edit-movie-btn-${m.id}`}
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => handleDelete(m.id, m.title)}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#f87171' }}
                                title="Delete"
                                id={`delete-movie-btn-${m.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD / EDIT MOVIE FORM */}
      {activeTab === 'form' && (
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {isEditing ? `Edit Movie: ${title}` : 'Add New Movie Stream'}
            </h2>
            {isEditing && (
              <button onClick={resetForm} className="nav-btn nav-btn-ghost" style={{ fontSize: '0.85rem' }}>
                Cancel Edit
              </button>
            )}
          </div>

          {/* Quick Smart Link Importer Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '26px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wand2 size={18} color="#a5b4fc" />
                <strong style={{ color: '#fff', fontSize: '0.98rem' }}>Smart Link Importer & Subtitle Extractor</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowF12Guide(!showF12Guide)}
                style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
              >
                <HelpCircle size={14} />
                <span>{showF12Guide ? 'Hide F12 Guide' : 'How to grab direct .m3u8 & .vtt from HDToday (F12)?'}</span>
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Paste a movie link (like <code>hdtoday24.at/watch-movie/...</code>, an embed URL, or a direct <code>.m3u8</code>) and click Auto-Detect.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="url"
                className="form-input"
                style={{ flex: 1, minWidth: 280, background: 'rgba(0,0,0,0.4)' }}
                placeholder="https://hdtoday24.at/watch-movie/spider-man... or direct stream link"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAutoExtract}
                disabled={importLoading || !importUrl.trim()}
                className="nav-btn nav-btn-primary"
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {importLoading ? <RefreshCw size={15} className="spin" /> : <Wand2 size={15} />}
                <span>{importLoading ? 'Detecting...' : 'Auto-Detect Stream & CC'}</span>
              </button>
            </div>

            {importStatus && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                background: importStatus.startsWith('Success') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: importStatus.startsWith('Success') ? '#86efac' : '#c7d2fe',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {importStatus}
              </div>
            )}

            {/* F12 DevTools Step-by-Step Guide */}
            {showF12Guide && (
              <div style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.84rem',
                color: '#cbd5e1',
                lineHeight: 1.6
              }}>
                <h4 style={{ color: '#fff', marginBottom: 8, fontSize: '0.92rem' }}>
                  🎯 How to get the 100% Clean, Ad-Free HD Stream (.m3u8) & Subtitles (.vtt) from HDToday:
                </h4>
                <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>
                    <strong>Open the movie on HDToday</strong> (the page shown in your screenshot).
                  </li>
                  <li>
                    Press <strong>F12</strong> (or right-click anywhere &rarr; <em>Inspect</em>) to open Developer Tools.
                  </li>
                  <li>
                    Click the <strong>Network</strong> tab at the top.
                  </li>
                  <li>
                    In the filter box, type <code>m3u8</code>, then press <strong>Play</strong> on the video.
                  </li>
                  <li>
                    Right-click the <code>master.m3u8</code> or <code>index.m3u8</code> request &rarr; <strong>Copy &rarr; Copy URL</strong>. Paste it below into <em>Stream URL</em>.
                  </li>
                  <li>
                    Now type <code>vtt</code> in the filter box &rarr; Right-click any subtitle (English, Spanish, etc.) &rarr; <strong>Copy URL</strong>. Paste it into <em>Subtitle URL</em> below!
                  </li>
                </ol>
                <div style={{ marginTop: 10, padding: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, color: '#6ee7b7' }}>
                  ✨ <strong>Benefit:</strong> Your site streams the exact movie and subtitles directly with <strong>ZERO popups, ads, or redirects</strong> for your viewers!
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* Movie Title */}
              <div>
                <label className="input-label">Movie Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Inception, Interstellar"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!isEditing && !id) {
                      setId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  required
                  id="form-title"
                />
              </div>

              {/* Movie ID / Slug */}
              <div>
                <label className="input-label">Movie ID / Slug * (URL-friendly)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. interstellar-2014"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                  disabled={isEditing}
                  id="form-id"
                />
              </div>

              {/* Stream Source Mode Selector */}
              <div className="form-group-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <label className="input-label" style={{ margin: 0 }}>
                    Stream Source Mode *
                  </label>
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSourceMode('youtube')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: sourceMode === 'youtube' ? '#ef4444' : 'transparent',
                        color: sourceMode === 'youtube' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: '0.15s ease'
                      }}
                    >
                      <Play size={14} /> ▶️ YouTube (Unlisted • Zero Ads)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('upload')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: sourceMode === 'upload' ? 'var(--primary)' : 'transparent',
                        color: sourceMode === 'upload' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: '0.15s ease'
                      }}
                    >
                      <Upload size={14} /> ☁️ Supabase Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('gdrive')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: sourceMode === 'gdrive' ? 'var(--primary)' : 'transparent',
                        color: sourceMode === 'gdrive' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: '0.15s ease'
                      }}
                    >
                      <Film size={14} /> 📁 Google Drive (5TB Account)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('link')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: sourceMode === 'link' ? 'var(--primary)' : 'transparent',
                        color: sourceMode === 'link' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: '0.15s ease'
                      }}
                    >
                      <ExternalLink size={14} /> 🔗 External Link / Embed
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={videoInputRef}
                  style={{ display: 'none' }}
                  accept="video/mp4,video/webm,video/x-matroska"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'videos');
                  }}
                />

                {/* MODE 1: YouTube Unlisted Video (Zero Ads Cinema) */}
                {sourceMode === 'youtube' ? (
                  <div>
                    {streamUrl && getYouTubeId(streamUrl) ? (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(153, 27, 27, 0.2))',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px 20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#fca5a5', fontSize: '0.98rem' }}>
                              <CheckCircle2 size={19} color="#ef4444" />
                              <span>Active Ad-Free YouTube Cinema Stream Connected</span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Video ID: <strong style={{ color: '#fff' }}>{getYouTubeId(streamUrl)}</strong> • Ultra-fast Google CDN, zero bandwidth limits, 100% ad-free playback.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTestStreamUrl(streamUrl)}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                            >
                              <Play size={14} /> Preview Stream
                            </button>
                            <button
                              type="button"
                              onClick={() => { setStreamUrl(''); setYoutubeInputUrl(''); }}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                            >
                              <Trash2 size={14} /> Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px 20px',
                        background: 'rgba(239, 68, 68, 0.05)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <Play size={22} color="#ef4444" />
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                            Connect YouTube Video (Unlisted • 100% Ad-Free)
                          </div>
                        </div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                          <div style={{ marginBottom: 4 }}>
                            💡 <strong>Zero Ads Guarantee:</strong> Upload your movie to YouTube and set visibility to <strong>Unlisted</strong> with monetization off.
                          </div>
                          <div>
                            YouTube unlisted videos never show advertisements, have unlimited Google CDN streaming speed, and never hit Google Drive's "too many users" quota limit.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Paste YouTube link (https://youtu.be/... or https://youtube.com/watch?v=...) or Video ID"
                            value={youtubeInputUrl}
                            onChange={(e) => setYoutubeInputUrl(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={handleConnectYouTube}
                            className="nav-btn nav-btn-primary"
                            style={{ whiteSpace: 'nowrap', padding: '0 20px', background: '#ef4444', borderColor: '#dc2626' }}
                          >
                            Connect Video
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : sourceMode === 'upload' ? (
                  /* MODE 2: Direct Storage Upload */
                  <div>
                    {streamUrl && (streamUrl.includes('supabase.co') || streamUrl.endsWith('.mp4') || streamUrl.endsWith('.webm')) ? (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.2))',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px 20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#86efac', fontSize: '0.98rem' }}>
                              <CheckCircle2 size={19} color="#10b981" />
                              <span>Active Video File in Supabase Storage</span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              100% Ad-Free Native Cinema Stream ready. Viewers enjoy pure HTML5 playback with multi-language subtitle tracks.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTestStreamUrl(streamUrl)}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                            >
                              <Play size={14} /> Preview Stream
                            </button>
                            <button
                              type="button"
                              onClick={() => videoInputRef.current?.click()}
                              disabled={uploadLoading}
                              className="nav-btn nav-btn-primary"
                              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                            >
                              {uploadLoading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
                              <span>Replace Video</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStreamUrl('')}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => videoInputRef.current?.click()}
                        style={{
                          border: '2px dashed rgba(99, 102, 241, 0.45)',
                          borderRadius: 'var(--radius-md)',
                          padding: '36px 20px',
                          textAlign: 'center',
                          cursor: uploadLoading ? 'not-allowed' : 'pointer',
                          background: 'rgba(99, 102, 241, 0.05)',
                          transition: '0.2s ease'
                        }}
                      >
                        {uploadLoading ? (
                          <RefreshCw size={36} className="spin" color="#818cf8" style={{ margin: '0 auto 12px' }} />
                        ) : (
                          <Upload size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
                        )}
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>
                          {uploadLoading ? 'Uploading Movie to Supabase Storage...' : 'Click to Upload MP4 Movie File'}
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          Stored permanently in your Supabase bucket. Enables full 1080p Artplayer with zero ads, zero popups, and no token expiration.
                        </p>
                      </div>
                    )}
                    {uploadStatus && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                        background: uploadStatus.startsWith('✅') ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                        color: uploadStatus.startsWith('✅') ? '#86efac' : '#c7d2fe',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {uploadStatus}
                      </div>
                    )}
                  </div>
                ) : sourceMode === 'gdrive' ? (
                  /* MODE 3: Google Drive 5TB Account */
                  <div>
                    {streamUrl && (streamUrl.includes('gdrive') || streamUrl.includes('drive.google.com')) ? (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(30, 58, 138, 0.2))',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px 20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#93c5fd', fontSize: '0.98rem' }}>
                              <CheckCircle2 size={19} color="#3b82f6" />
                              <span>Active 5TB Google Drive Pro Stream Connected</span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Direct 1080p proxy stream with byte-range seeking (HTTP 206) and zero ads. Stored in your Google Drive.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTestStreamUrl(streamUrl)}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                            >
                              <Play size={14} /> Preview Stream
                            </button>
                            <button
                              type="button"
                              onClick={() => { setStreamUrl(''); setGdriveInputUrl(''); }}
                              className="nav-btn nav-btn-ghost"
                              style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                            >
                              <Trash2 size={14} /> Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px 20px',
                        background: 'rgba(59, 130, 246, 0.05)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <Film size={22} color="#60a5fa" />
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                            Connect Video from your 5TB Google Drive Pro
                          </div>
                        </div>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                          1. In Google Drive, right-click your MP4 movie and set Share to <strong>"Anyone with the link can view"</strong>.<br />
                          2. Paste the share link below. WatchBox will stream it directly in full 1080p with zero ads, high-speed buffering, and custom subtitles.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="https://drive.google.com/file/d/1XyZ.../view?usp=sharing or File ID"
                            value={gdriveInputUrl}
                            onChange={(e) => setGdriveInputUrl(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={handleConnectGDrive}
                            className="nav-btn nav-btn-primary"
                            style={{ whiteSpace: 'nowrap', padding: '0 20px' }}
                          >
                            Connect Video
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* MODE 4: External Stream / Embed Link */
                  <div>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://vidlink.pro/movie/969681 or external .m3u8 stream link"
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      required={sourceMode === 'link'}
                      id="form-stream-url"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                        Enter an embed URL or third-party manifest. Viewers will use the Web Embed Player.
                      </p>
                      {streamUrl && (
                        <button
                          type="button"
                          onClick={() => setTestStreamUrl(streamUrl)}
                          style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Test Play Link &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Video Tester */}
                {testStreamUrl && (
                  <div className="stream-tester-box" style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {getYouTubeId(testStreamUrl) ? 'Previewing Ad-Free YouTube Cinema Stream:' : 'Previewing Video File:'}
                      </span>
                      <button type="button" onClick={() => setTestStreamUrl('')} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Close Preview
                      </button>
                    </div>
                    {getYouTubeId(testStreamUrl) ? (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(testStreamUrl)}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&fs=1&controls=1&color=white`}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                          allowFullScreen
                          title="Preview"
                        />
                      </div>
                    ) : (
                      <video
                        src={testStreamUrl}
                        controls
                        autoPlay
                        className="stream-tester-video"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Subtitles Management */}
              <div className="form-group-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <label className="input-label" style={{ margin: 0 }}>
                      Subtitle Tracks (International Multi-Language Standards)
                    </label>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Supports WebVTT (.vtt) & SubRip (.srt). Automatically converted and CORS-enabled.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        subUploadTargetRef.current = null;
                        subInputRef.current?.click();
                      }}
                      disabled={uploadLoading}
                      className="nav-btn nav-btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px', background: '#0284c7' }}
                    >
                      <Upload size={13} />
                      <span>☁️ Upload Subtitle (.SRT / .VTT)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFetchSubtitles}
                      disabled={subSearching}
                      className="nav-btn nav-btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                    >
                      {subSearching ? <RefreshCw size={13} className="spin" /> : <Wand2 size={13} />}
                      <span>{subSearching ? 'Fetching Subs...' : '🌐 Auto-Fetch Online Subs'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={addSubtitleField}
                      className="btn-add-sub"
                      id="add-subtitle-track-btn"
                    >
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={subInputRef}
                  style={{ display: 'none' }}
                  accept=".vtt,.srt,.sub,.txt,text/vtt,application/x-subrip,text/plain"
                  onChange={(e) => {
                    const pickedFile = e.target.files?.[0];
                    if (pickedFile) {
                      const targetIdx = subUploadTargetRef.current;
                      handleFileUpload(pickedFile, 'subtitles', targetIdx);
                      e.target.value = '';
                      subUploadTargetRef.current = null;
                    }
                  }}
                />

                <div className="subtitle-manager">
                  {subtitles.map((sub, index) => (
                    <div key={index} className="sub-item-row">
                      <input
                        type="text"
                        placeholder="Language (e.g. English, Español)"
                        className="form-input"
                        style={{ width: 160 }}
                        value={sub.name}
                        onChange={(e) => updateSubtitleField(index, 'name', e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="Subtitle URL (.vtt / .srt or Supabase link)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={sub.url}
                        onChange={(e) => updateSubtitleField(index, 'url', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          subUploadTargetRef.current = index;
                          subInputRef.current?.click();
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.06)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Upload .vtt or .srt file to Supabase"
                      >
                        <Upload size={13} />
                        <span>Upload</span>
                      </button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(sub.isDefault)}
                          onChange={(e) => updateSubtitleField(index, 'isDefault', e.target.checked)}
                        />
                        Default
                      </label>
                      {subtitles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubtitleField(index)}
                          className="btn-remove-sub"
                          title="Remove Subtitle Track"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Tip: Any third-party subtitle link is automatically proxied with CORS headers so browsers will never block it!
                  </p>
                </div>
              </div>

              {/* Poster Image URL */}
              <div>
                <label className="input-label">Poster Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  id="form-poster-url"
                />
              </div>

              {/* Backdrop Image URL */}
              <div>
                <label className="input-label">Backdrop / Landscape Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={backdropUrl}
                  onChange={(e) => setBackdropUrl(e.target.value)}
                  id="form-backdrop-url"
                />
              </div>

              {/* Genre & Rating */}
              <div>
                <label className="input-label">Genre</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sci-Fi / Action"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Quality Badge</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 4K Ultra HD, HD 1080p"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                />
              </div>

              {/* Year & Duration */}
              <div>
                <label className="input-label">Release Year</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="2024"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Duration</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2h 15m or 15 min"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="form-group-full">
                <label className="input-label">Plot Overview / Synopsis</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Write a brief synopsis of the movie..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Featured in Hero checkbox */}
              <div className="form-group-full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Feature as Main Hero Banner on Homepage</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', gap: 14 }}>
              <button
                type="submit"
                className="nav-btn nav-btn-primary"
                style={{ padding: '12px 28px', fontSize: '1rem' }}
                id="save-movie-submit-btn"
              >
                <Save size={18} />
                <span>{isEditing ? 'Save Changes' : 'Publish Movie'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('movies');
                }}
                className="nav-btn nav-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SUPABASE SETUP GUIDE */}
      {activeTab === 'supabase' && (
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Database size={24} color="#6366f1" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Supabase Free Tier Cloud Database Setup</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Follow these 3 easy steps to connect a 100% free PostgreSQL database on Supabase for your Vercel deployment:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ color: '#fff', marginBottom: 6 }}>1. Create Free Project</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>supabase.com</a>, log in with GitHub, and create a new free project.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ color: '#fff' }}>2. Run SQL Schema in Supabase SQL Editor</h4>
                <button
                  onClick={copySqlToClipboard}
                  className="nav-btn nav-btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                >
                  {copiedSql ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL'}</span>
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                In your Supabase project dashboard, click <strong>SQL Editor</strong> &rarr; <strong>New Query</strong>, paste the code below, and click <strong>Run</strong>:
              </p>
              <pre className="code-block">{supabaseSql}</pre>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ color: '#fff', marginBottom: 6 }}>3. Add Keys to .env.local or Vercel Environment Variables</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Find your API URL and Service Role Key under <strong>Project Settings &rarr; API</strong>, and add them:
              </p>
              <pre className="code-block">
                {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_SECRET_KEY=admin123`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STREAM EDIT MODAL */}
      {quickEditMovie && (
        <div className="modal-overlay" onClick={() => setQuickEditMovie(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#f87171' }}>
                  Replace Broken Stream Link
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Movie: <strong>{quickEditMovie.title}</strong>
                </p>
              </div>
              <button onClick={() => setQuickEditMovie(null)} className="btn-close-modal">✕</button>
            </div>

            <form onSubmit={handleQuickStreamSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">New Working Stream (YouTube Link / Video ID, MP4, or Google Drive)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. YouTube link (https://youtu.be/...), 11-digit Video ID, or .mp4 URL"
                  value={quickStreamUrl}
                  onChange={(e) => setQuickStreamUrl(e.target.value)}
                  required
                  id="modal-quick-stream-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  className="nav-btn nav-btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  id="modal-quick-save-btn"
                >
                  <Save size={16} /> Save & Fix Stream
                </button>
                <button
                  type="button"
                  onClick={() => setQuickEditMovie(null)}
                  className="nav-btn nav-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
