import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | 'voiceover.mp3';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.type !== 'audio/mpeg') {
      return NextResponse.json({ error: 'Only MP3 files are allowed.' }, { status: 400 });
    }

    const filePath = `voiceover/${Date.now()}-${fileName}`;

    const { error } = await supabase.storage
      .from('audio')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage
      .from('audio')
      .getPublicUrl(filePath);

    return NextResponse.json({ publicUrl: data.publicUrl });

  } catch (error: any) {
    console.error('Error in voiceover upload route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 