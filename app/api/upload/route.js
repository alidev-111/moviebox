import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db';

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'alikon123';

export async function POST(request) {
  try {
    // Basic auth check
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '')?.trim();
    if (token !== ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Key' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        error: 'Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment.'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'videos'; // 'videos' | 'subtitles'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${folder}/${timestamp}_${sanitizedName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabase.storage
      .from('movies')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.error('[Upload API] Supabase storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('movies')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      path: filePath,
      publicUrl: publicData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    });
  } catch (err) {
    console.error('[Upload API] Error processing upload:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
