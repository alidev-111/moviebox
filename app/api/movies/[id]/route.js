import { NextResponse } from 'next/server';
import { getMovieById, upsertMovie, deleteMovieById } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const movie = await getMovieById(id);

    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    return NextResponse.json(movie);
  } catch (error) {
    console.error(`API GET /api/movies/${id} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_SECRET_KEY || 'admin123';

    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if existing movie exists to preserve fields if not supplied
    const existing = await getMovieById(id);

    const mergedData = {
      ...(existing || {}),
      ...body,
      id,
      title: body.title !== undefined ? body.title : existing?.title || 'Untitled',
      type: body.type !== undefined ? body.type : existing?.type || (Array.isArray(body.episodes) && body.episodes.length > 0 ? 'series' : 'movie'),
      episodes: body.episodes !== undefined ? body.episodes : existing?.episodes || [],
      stream_url: body.stream_url !== undefined ? body.stream_url : existing?.stream_url,
      subtitles: body.subtitles !== undefined ? body.subtitles : existing?.subtitles || [],
      poster_url: body.poster_url !== undefined ? body.poster_url : existing?.poster_url || '',
      backdrop_url: body.backdrop_url !== undefined ? body.backdrop_url : existing?.backdrop_url || '',
      description: body.description !== undefined ? body.description : existing?.description || '',
      genre: body.genre !== undefined ? body.genre : existing?.genre || 'Action',
      release_year: body.release_year !== undefined ? parseInt(body.release_year, 10) : existing?.release_year || 2024,
      duration: body.duration !== undefined ? body.duration : existing?.duration || '2h 00m',
      rating: body.rating !== undefined ? body.rating : existing?.rating || 'HD',
      is_featured: body.is_featured !== undefined ? Boolean(body.is_featured) : existing?.is_featured || false,
      updated_at: new Date().toISOString(),
    };

    const isSeries = mergedData.type === 'series' || (Array.isArray(mergedData.episodes) && mergedData.episodes.length > 0);
    if (!mergedData.stream_url && (!isSeries || mergedData.episodes.length === 0)) {
      return NextResponse.json({ error: 'stream_url or episodes are required' }, { status: 400 });
    }

    const saved = await upsertMovie(mergedData);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('API PUT /api/movies/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_SECRET_KEY || 'admin123';

    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
    }

    const { id } = await params;
    const res = await deleteMovieById(id);
    return NextResponse.json(res);
  } catch (error) {
    console.error('API DELETE /api/movies/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
