import { NextRequest, NextResponse } from 'next/server';
import { generateElevenLabsAudio, isElevenLabsConfigured } from '@/lib/elevenlabs-utils';

export async function POST(request: NextRequest) {
  if (!isElevenLabsConfigured()) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
  }

  try {
    const { text, voiceId, chunkIndex, sessionId, generateSubtitles } = await request.json();

    if (!text || !voiceId || !sessionId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { audioUrl, duration, compressedAudioUrl } = await generateElevenLabsAudio(text, voiceId, chunkIndex, sessionId, generateSubtitles);

    return NextResponse.json({
      success: true,
      audioUrl,
      duration,
      chunkIndex,
      compressedAudioUrl,
    });
  } catch (error: any) {
    console.error('Error in ElevenLabs audio generation route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 