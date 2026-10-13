import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { toB2StreamPath } from './b2.js';

const DATA_FILE = path.join(process.cwd(), 'data', 'movies.json');

// Cache-Control for public movie reads: Vercel's CDN serves a cached copy for 15s (then a stale copy for up to 60s
// more while refreshing), so busy pages rarely run a function and admin edits (e.g. new subtitles) show within seconds.
// Stream links are signed later in /api/stream/b2, never cached here.
export const PUBLIC_CACHE = 's-maxage=15, stale-while-revalidate=60';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  !supabaseUrl.includes('your-project.supabase.co')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Local JSON file storage helpers
async function readLocalMovies() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[DB] Failed to read local movies file, returning empty array:', err.message);
    return [];
  }
}

async function writeLocalMovies(movies) {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(movies, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to write local movies:', err.message);
  }
}

function normalizeMovieRecord(m) {
  if (!m) return null;
  const parsed = { ...m };
  if (typeof parsed.stream_url === 'string' && parsed.stream_url.startsWith('series_playlist::')) {
    try {
      const unpacked = JSON.parse(parsed.stream_url.slice('series_playlist::'.length));
      parsed.type = unpacked.type || 'series';
      parsed.episodes = Array.isArray(unpacked.episodes) ? unpacked.episodes : [];
      parsed.stream_url = unpacked.stream_url || (parsed.episodes[0]?.stream_url || '');
    } catch (e) {
      console.warn('[DB] Failed to unpack series_playlist:', e);
    }
  } else {
    parsed.type = parsed.type || (Array.isArray(parsed.episodes) && parsed.episodes.length > 0 ? 'series' : 'movie');
    parsed.episodes = Array.isArray(parsed.episodes) ? parsed.episodes : [];
  }
  return parsed;
}

export async function getAllMovies() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(normalizeMovieRecord);
      }
      if (error) {
        console.warn('[DB] Supabase error, falling back to local storage:', error.message);
      }
    } catch (err) {
      console.warn('[DB] Supabase query threw exception, using local storage:', err.message);
    }
  }

  // Fallback to local movies
  const local = await readLocalMovies();
  return local.map(normalizeMovieRecord);
}

export async function getMovieById(id) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return normalizeMovieRecord(data);
      }
    } catch (err) {
      console.warn('[DB] Supabase getMovieById error, using local fallback:', err.message);
    }
  }

  const localMovies = await readLocalMovies();
  const found = localMovies.find((m) => m.id === id) || null;
  return normalizeMovieRecord(found);
}

export async function upsertMovie(movieData) {
  const timestamp = new Date().toISOString();
  const isSeries = movieData.type === 'series' || (Array.isArray(movieData.episodes) && movieData.episodes.length > 0);
  const episodes = (Array.isArray(movieData.episodes) ? movieData.episodes : []).map((ep) => ({
    ...ep,
    stream_url: toB2StreamPath(ep.stream_url),
  }));
  const effectiveStreamUrl = toB2StreamPath((movieData.stream_url || (episodes.length > 0 ? episodes[0].stream_url : '') || '').trim());

  const normalizedData = {
    ...movieData,
    type: isSeries ? 'series' : 'movie',
    episodes: episodes,
    stream_url: effectiveStreamUrl,
    subtitles: movieData.subtitles || [],
    updated_at: timestamp,
    created_at: movieData.created_at || timestamp,
  };

  // Always update local file as cache/backup
  const localMovies = await readLocalMovies();
  const index = localMovies.findIndex((m) => m.id === normalizedData.id);
  if (index >= 0) {
    localMovies[index] = { ...localMovies[index], ...normalizedData };
  } else {
    localMovies.unshift(normalizedData);
  }
  await writeLocalMovies(localMovies);

  if (isSupabaseConfigured && supabase) {
    // Attempt 1: Upsert directly with type and episodes columns
    try {
      const { data, error } = await supabase
        .from('movies')
        .upsert(normalizedData)
        .select()
        .single();

      if (!error && data) {
        return normalizeMovieRecord(data);
      }

      // If Supabase table doesn't have 'episodes' or 'type' columns yet, fallback safely
      if (error && (error.message.includes('column') || error.message.includes('episodes') || error.message.includes('type'))) {
        console.warn('[DB] Supabase table lacks episodes/type column. Using stream_url packaging fallback.');
        const fallbackData = {
          ...normalizedData,
          stream_url: isSeries ? `series_playlist::${JSON.stringify({ episodes, type: 'series', stream_url: effectiveStreamUrl })}` : effectiveStreamUrl,
        };
        delete fallbackData.type;
        delete fallbackData.episodes;

        const { data: fbData, error: fbErr } = await supabase
          .from('movies')
          .upsert(fallbackData)
          .select()
          .single();

        if (fbErr) {
          console.error('[DB] Supabase fallback upsert failed:', fbErr.message);
          throw new Error(`Supabase error: ${fbErr.message}`);
        }
        return normalizeMovieRecord(fbData);
      } else if (error) {
        console.error('[DB] Supabase upsert failed:', error.message);
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (err) {
      console.error('[DB] Supabase upsert exception:', err.message);
      throw err;
    }
  }

  return normalizedData;
}

export async function deleteMovieById(id) {
  const localMovies = await readLocalMovies();
  const filtered = localMovies.filter((m) => m.id !== id);
  await writeLocalMovies(filtered);

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('movies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Supabase delete failed:', error.message);
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  }

  return { success: true, id };
}

export function getDatabaseStatus() {
  return {
    isSupabase: isSupabaseConfigured,
    provider: isSupabaseConfigured ? 'Supabase Cloud (PostgreSQL)' : 'Local File Storage (Ready for Supabase)',
  };
}
