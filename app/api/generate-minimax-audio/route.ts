import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

interface MinimaxRequest {
  text: string;
  voice: string;
  model?: string;
  chunkIndex?: number;
  sessionId?: string;
  generateSubtitles?: boolean;
}

interface MinimaxResponse {
  data: {
    audio: string; // hex audio data
    status: number;
    subtitle_file?: string;
  };
  extra_info: {
    audio_length: number;
    audio_sample_rate: number;
    audio_size: number;
    audio_bitrate: number;
    word_count: number;
    invisible_character_ratio: number;
    audio_format: string;
    usage_characters: number;
  };
  trace_id: string;
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: MinimaxRequest = await request.json();
    const { text, voice, model = 'speech-02-hd', chunkIndex, sessionId, generateSubtitles } = body;

    console.log(`🎵 Minimax audio generation request:
      - Text length: ${text.length}
      - Voice: ${voice}
      - Model: ${model}
      - Chunk: ${chunkIndex !== undefined ? chunkIndex + 1 : 'single'}
      - Session: ${sessionId || 'none'}
    `);

    if (!text || !voice) {
      return NextResponse.json({ error: 'Text and voice are required' }, { status: 400 });
    }

    if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
      console.error('MINIMAX_API_KEY or MINIMAX_GROUP_ID not configured');
      return NextResponse.json({ 
        error: 'Minimax API key or Group ID not configured. Please add MINIMAX_API_KEY and MINIMAX_GROUP_ID to your environment variables.' 
      }, { status: 500 });
    }

    // Call Minimax TTS API
    const minimaxResponse = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        text: text,
        stream: false,
        voice_setting: {
          voice_id: voice,
          speed: 1,
          vol: 1,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1
        }
      })
    });

    if (!minimaxResponse.ok) {
      const errorData = await minimaxResponse.text();
      console.error('Minimax API error:', minimaxResponse.status, errorData);
      throw new Error(`Minimax API error: ${minimaxResponse.status} ${errorData}`);
    }

    const result: MinimaxResponse = await minimaxResponse.json();
    
    if (result.base_resp.status_code !== 0) {
      throw new Error(`Minimax generation failed: ${result.base_resp.status_msg}`);
    }

    if (!result.data.audio) {
      throw new Error('No audio data returned from Minimax');
    }

    console.log(`✅ Minimax audio generated successfully, size: ${result.extra_info.audio_size} bytes`);

    // Convert hex audio data to buffer
    const audioBuffer = Buffer.from(result.data.audio, 'hex');
    
    // Calculate duration from extra_info (audio_length is in milliseconds)
    const duration = result.extra_info.audio_length / 1000;

    // Upload to Supabase for persistence
    const supabase = await createClient();
    
    try {
      // Upload to Supabase
      const fileName = `minimax_${sessionId || 'single'}_${chunkIndex !== undefined ? chunkIndex : Date.now()}.mp3`;
      const filePath = `audio/minimax/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Failed to upload to Supabase:', uploadError);
        throw new Error('Failed to upload audio to storage');
      }

      const { data } = supabase.storage.from('audio').getPublicUrl(filePath);
      const finalAudioUrl = data.publicUrl;
      console.log(`📁 Audio uploaded to Supabase: ${finalAudioUrl}`);

      return NextResponse.json({
        audioUrl: finalAudioUrl,
        duration: duration,
        chunkIndex: chunkIndex,
        sessionId: sessionId,
        provider: 'minimax',
        voice: voice,
        model: model,
        subtitlesUrl: result.data.subtitle_file || undefined
      });

    } catch (uploadError) {
      console.error('Failed to upload audio to Supabase:', uploadError);
      throw new Error('Failed to upload audio to storage');
    }

  } catch (error: any) {
    console.error('Minimax audio generation error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate audio with Minimax'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 