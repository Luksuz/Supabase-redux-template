import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PLAYAI_API_KEY = process.env.PLAYAI_API_KEY;
const PLAYAI_USER_ID = process.env.PLAYAI_USER_ID;

interface PlayAIRequest {
  text: string;
  voice: string;
  model?: string;
  chunkIndex?: number;
  sessionId?: string;
  generateSubtitles?: boolean;
}

interface PlayAIResponse {
  id: string;
  status: string;
  output?: {
    url: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PlayAIRequest = await request.json();
    const { text, voice, model = 'PlayDialog', chunkIndex, sessionId, generateSubtitles } = body;

    console.log(`🎵 Play.ai audio generation request:
      - Text length: ${text.length}
      - Voice: ${voice}
      - Model: ${model}
      - Chunk: ${chunkIndex !== undefined ? chunkIndex + 1 : 'single'}
      - Session: ${sessionId || 'none'}
    `);

    if (!text || !voice) {
      return NextResponse.json({ error: 'Text and voice are required' }, { status: 400 });
    }

    if (!PLAYAI_API_KEY || !PLAYAI_USER_ID) {
      console.error('PLAYAI_API_KEY or PLAYAI_USER_ID not configured');
      return NextResponse.json({ 
        error: 'Play.ai API key or User ID not configured. Please add PLAYAI_API_KEY and PLAYAI_USER_ID to your environment variables.' 
      }, { status: 500 });
    }

    // Call Play.ai TTS API
    const playaiResponse = await fetch('https://api.play.ai/api/v1/tts/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PLAYAI_API_KEY}`,
        'X-USER-ID': PLAYAI_USER_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        text: text,
        voice: voice
      })
    });

    if (!playaiResponse.ok) {
      const errorData = await playaiResponse.text();
      console.error('Play.ai API error:', playaiResponse.status, errorData);
      throw new Error(`Play.ai API error: ${playaiResponse.status} ${errorData}`);
    }

    const result: PlayAIResponse = await playaiResponse.json();
    
    if (result.error) {
      throw new Error(`Play.ai generation failed: ${result.error}`);
    }

    if (!result.output?.url) {
      throw new Error('No audio URL returned from Play.ai');
    }

    console.log(`✅ Play.ai audio generated successfully: ${result.output.url}`);

    // Get audio duration by fetching the file
    let duration = 3.0; // Default fallback duration
    try {
      const audioResponse = await fetch(result.output.url, { method: 'HEAD' });
      if (audioResponse.ok) {
        const contentLength = audioResponse.headers.get('content-length');
        if (contentLength) {
          // Rough estimation: MP3 at 128kbps ≈ 16KB per second
          duration = Math.max(1, parseInt(contentLength) / 16000);
        }
      }
    } catch (durationError) {
      console.warn('Could not determine audio duration, using default:', durationError);
    }

    // Upload to Supabase for persistence
    const supabase = await createClient();
    let finalAudioUrl = result.output.url;

    try {
      // Download the audio file
      const audioResponse = await fetch(result.output.url);
      if (audioResponse.ok) {
        const audioBuffer = await audioResponse.arrayBuffer();
        
        // Upload to Supabase
        const fileName = `playai_${sessionId || 'single'}_${chunkIndex !== undefined ? chunkIndex : Date.now()}.mp3`;
        const filePath = `audio/playai/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('audio')
          .upload(filePath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false
          });

        if (!uploadError) {
          const { data } = supabase.storage.from('audio').getPublicUrl(filePath);
          finalAudioUrl = data.publicUrl;
          console.log(`📁 Audio uploaded to Supabase: ${finalAudioUrl}`);
        } else {
          console.warn('Failed to upload to Supabase, using original URL:', uploadError);
        }
      }
    } catch (uploadError) {
      console.warn('Failed to upload audio to Supabase:', uploadError);
    }

    return NextResponse.json({
      audioUrl: finalAudioUrl,
      duration: duration,
      chunkIndex: chunkIndex,
      sessionId: sessionId,
      provider: 'playai',
      voice: voice,
      model: model
    });

  } catch (error: any) {
    console.error('Play.ai audio generation error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate audio with Play.ai'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 