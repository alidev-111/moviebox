import { NextResponse } from 'next/server';
import { getAllMovies, upsertMovie, getDatabaseStatus } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('checkStatus') === '1') {
      return NextResponse.json({ status: getDatabaseStatus() });
    }
    if (searchParams.get('verifyKey') === '1') {
      const authHeader = request.headers.get('authorization');
      const adminKey = process.env.ADMIN_SECRET_KEY || 'admin123';
      const isValid = authHeader === `Bearer ${adminKey}`;
      return NextResponse.json({ valid: isValid }, { status: isValid ? 200 : 401 });
    }

    const movies = await getAllMovies();
    return NextResponse.json(movies);
  } catch (error) {
    console.error('API GET /api/movies error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_SECRET_KEY || 'admin123';
    
    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, stream_url, poster_url, backdrop_url, description, genre, release_year, duration, rating, subtitles, is_featured } = body;

    if (!id || !title || !stream_url) {
      return NextResponse.json({ error: 'Missing required fields: id, title, and stream_url are required' }, { status: 400 });
    }

    const saved = await upsertMovie({
      id: id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      title: title.trim(),
      stream_url: stream_url.trim(),
      poster_url: poster_url?.trim() || '',
      backdrop_url: backdrop_url?.trim() || '',
      description: description?.trim() || '',
      genre: genre?.trim() || 'Action',
      release_year: release_year ? parseInt(release_year, 10) : new Date().getFullYear(),
      duration: duration?.trim() || '2h 00m',
      rating: rating?.trim() || 'HD',
      subtitles: Array.isArray(subtitles) ? subtitles : [],
      is_featured: Boolean(is_featured),
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('API POST /api/movies error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
