'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Search, Clock, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  useEffect(() => {
    loadMovies();
  }, []);

  async function loadMovies() {
    try {
      setLoading(true);
      const res = await fetch('/api/movies');
      if (res.ok) {
        const data = await res.json();
        setMovies(data);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoading(false);
    }
  }

  // Extract all unique genres
  const genres = ['All', ...new Set(
    movies.flatMap(m => (m.genre ? m.genre.split(/[\/,]/).map(g => g.trim()) : []))
  )];

  // Filter movies
  const filteredMovies = movies.filter(movie => {
    const matchesSearch =
      movie.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movie.description && movie.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesGenre =
      selectedGenre === 'All' ||
      (movie.genre && movie.genre.toLowerCase().includes(selectedGenre.toLowerCase()));

    return matchesSearch && matchesGenre;
  });

  const featuredMovie = movies.find(m => m.is_featured) || movies[0];

  return (
    <div>
      {/* Hero Banner Section */}
      {featuredMovie && !loading && (
        <section className="hero-wrapper">
          <div
            className="hero-banner"
            style={{
              backgroundImage: `url(${featuredMovie.backdrop_url || featuredMovie.poster_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80'})`,
            }}
          >
            <div className="hero-overlay" />
            <div className="hero-content">
              {(featuredMovie.type === 'series' || (Array.isArray(featuredMovie.episodes) && featuredMovie.episodes.length > 0)) && (
                <div style={{ marginBottom: 12 }}>
                  <span className="badge badge-featured" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '5px 12px', fontSize: '0.8rem' }}>
                    📺 TV Series • {featuredMovie.episodes?.length ? `${featuredMovie.episodes.length} Episodes` : featuredMovie.duration}
                  </span>
                </div>
              )}

              <h1 className="hero-title">{featuredMovie.title}</h1>

              <div className="hero-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={15} /> {featuredMovie.release_year || '2024'}
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={15} /> {featuredMovie.duration || '2h 10m'}
                </span>
                <span>•</span>
                <span>{featuredMovie.genre}</span>
              </div>

              <p className="hero-description">{featuredMovie.description}</p>

              <div className="hero-actions">
                <Link
                  href={`/watch/${featuredMovie.id}`}
                  className="btn-play-hero"
                  id="hero-play-button"
                >
                  <Play size={20} fill="#07090e" />
                  <span>Stream Now</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog Section */}
      <section className="catalog-section">
        <div className="catalog-header">
          <div>
            <h2 className="section-title">
              <span>Watch Catalog</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                ({filteredMovies.length} Available)
              </span>
            </h2>
          </div>

          <div className="search-and-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search movies & series"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                id="search-input"
              />
            </div>
          </div>
        </div>

        {/* Genre Filter Pills */}
        <div className="genre-pills" style={{ marginBottom: 24 }}>
          {genres.map((g) => (
            <button
              key={g}
              className={`genre-pill ${selectedGenre === g ? 'active' : ''}`}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Movies Grid */}
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={28} className="spin" style={{ marginBottom: 12, animation: 'spin 1.5s linear infinite' }} />
            <p>Loading available titles...</p>
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: 6 }}>No titles found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>
              Try adjusting your search terms or genre filter.
            </p>
            <button onClick={() => { setSearchTerm(''); setSelectedGenre('All'); }} className="nav-btn nav-btn-primary">
              View All
            </button>
          </div>
        ) : (
          <div className="movies-grid" id="movies-grid">
            {filteredMovies.map((movie) => {
              const isSeriesItem = movie.type === 'series' || (Array.isArray(movie.episodes) && movie.episodes.length > 0);
              return (
                <Link
                  key={movie.id}
                  href={`/watch/${movie.id}`}
                  className="movie-card"
                  id={`movie-card-${movie.id}`}
                >
                  <div className="card-poster-wrap">
                    <img
                      src={movie.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'}
                      alt={movie.title}
                      className="card-poster"
                      loading="lazy"
                    />
                    {isSeriesItem && (
                      <span className="badge badge-series-tag">
                        📺 Series {movie.episodes?.length ? `(${movie.episodes.length} Eps)` : ''}
                      </span>
                    )}
                    <div className="poster-overlay">
                      <div className="play-hover-btn">
                        <Play size={22} fill="#fff" />
                      </div>
                    </div>
                  </div>

                  <div className="card-info">
                    <h3 className="card-title">{movie.title}</h3>
                    <div className="card-meta">
                      <span>{movie.release_year || '2024'}</span>
                      <span>•</span>
                      <span>{movie.duration || '2h'}</span>
                      <span>•</span>
                      <span>{movie.genre}</span>
                    </div>

                    <p className="card-desc">
                      {movie.description || 'Watch now with HD playback and synchronised subtitles.'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
