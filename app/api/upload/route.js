import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db';

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'alikon123';

function convertSrtToVtt(srtContent) {
  let cleaned = srtContent
    .replace(/\r+/g, '')
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  if (!cleaned.startsWith('WEBVTT')) {
    cleaned = 'WEBVTT\n\n' + cleaned;
  }
  return cleaned;
}

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

    let uploadBuffer = Buffer.from(await file.arrayBuffer());
    let uploadContentType = file.type || 'application/octet-stream';
    let finalFileName = sanitizedName;

    // Subtitle conversion & standardization to WebVTT
    if (folder === 'subtitles') {
      const text = uploadBuffer.toString('utf-8');
      const isSrt = sanitizedName.toLowerCase().endsWith('.srt') || !text.startsWith('WEBVTT');
      if (isSrt) {
        const vttText = convertSrtToVtt(text);
        uploadBuffer = Buffer.from(vttText, 'utf-8');
        finalFileName = sanitizedName.replace(/\.srt$/i, '') + '.vtt';
      }
      uploadContentType = 'text/vtt; charset=utf-8';
    }

    const filePath = `${folder}/${timestamp}_${finalFileName}`;

    const { data, error } = await supabase.storage
      .from('movies')
      .upload(filePath, uploadBuffer, {
        contentType: uploadContentType,
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
      fileName: finalFileName,
      fileSize: uploadBuffer.length,
      contentType: uploadContentType,
    });
  } catch (err) {
    console.error('[Upload API] Error processing upload:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
