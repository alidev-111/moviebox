import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_FILE = path.join(process.cwd(), 'data', 'movies.json');

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

export async function getAllMovies() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
      if (error) {
        console.warn('[DB] Supabase error, falling back to local storage:', error.message);
      }
    } catch (err) {
      console.warn('[DB] Supabase query threw exception, using local storage:', err.message);
    }
  }

  // Fallback to local movies
  return await readLocalMovies();
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
        return data;
      }
    } catch (err) {
      console.warn('[DB] Supabase getMovieById error, using local fallback:', err.message);
    }
  }

  const localMovies = await readLocalMovies();
  return localMovies.find((m) => m.id === id) || null;
}

export async function upsertMovie(movieData) {
  const timestamp = new Date().toISOString();
  const normalizedData = {
    ...movieData,
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
    const { data, error } = await supabase
      .from('movies')
      .upsert(normalizedData)
      .select()
      .single();

    if (error) {
      console.error('[DB] Supabase upsert failed:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }
    return data;
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
