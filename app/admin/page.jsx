'use client';

import { useState, useEffect } from 'react';
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
  ArrowLeft
} from 'lucide-react';

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

  // Auto Extractor State
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [showF12Guide, setShowF12Guide] = useState(false);

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
  }

  // Populate form for editing
  function handleStartEdit(movie) {
    setIsEditing(true);
    setId(movie.id);
    setTitle(movie.title || '');
    setStreamUrl(movie.stream_url || '');
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
    try {
      const res = await fetch(`/api/movies/${quickEditMovie.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          stream_url: quickStreamUrl.trim(),
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

              {/* Stream URL */}
              <div className="form-group-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="input-label" style={{ margin: 0 }}>
                    Stream URL (.m3u8 HLS or .mp4 direct link) *
                  </label>
                  {streamUrl && (
                    <button
                      type="button"
                      onClick={() => setTestStreamUrl(streamUrl)}
                      style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}
                    >
                      Test Play Link &rarr;
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/stream/index.m3u8 or https://.../movie.mp4"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  required
                  id="form-stream-url"
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Direct viewer playback. Vercel only serves this metadata so your serverless limits and bandwidth stay at zero.
                </p>

                {/* Inline Video Tester */}
                {testStreamUrl && (
                  <div className="stream-tester-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Previewing Stream:</span>
                      <button type="button" onClick={() => setTestStreamUrl('')} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Close Preview
                      </button>
                    </div>
                    <video
                      src={testStreamUrl}
                      controls
                      autoPlay
                      className="stream-tester-video"
                    />
                  </div>
                )}
              </div>

              {/* Subtitles Management */}
              <div className="form-group-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="input-label" style={{ margin: 0 }}>
                    Subtitle Tracks (.vtt or .srt)
                  </label>
                  <button
                    type="button"
                    onClick={addSubtitleField}
                    className="btn-add-sub"
                    id="add-subtitle-track-btn"
                  >
                    <Plus size={14} /> Add Another Subtitle Language
                  </button>
                </div>

                <div className="subtitle-manager">
                  {subtitles.map((sub, index) => (
                    <div key={index} className="sub-item-row">
                      <input
                        type="text"
                        placeholder="Language (e.g. English, Español)"
                        className="form-input"
                        style={{ width: 180 }}
                        value={sub.name}
                        onChange={(e) => updateSubtitleField(index, 'name', e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="Subtitle URL (.vtt / .srt or /subtitles/sample.vtt)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={sub.url}
                        onChange={(e) => updateSubtitleField(index, 'url', e.target.value)}
                      />
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
                <label className="input-label">New Working Stream URL (.m3u8 or .mp4)</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://..."
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
