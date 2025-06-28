import { NextRequest, NextResponse } from 'next/server';
import { fetchElevenLabsVoices, isElevenLabsConfigured } from '@/lib/elevenlabs-utils';

export async function GET(request: NextRequest) {
  if (!isElevenLabsConfigured()) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
  }

  try {
    const voices = await fetchElevenLabsVoices();
    return NextResponse.json({ success: true, voices });
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return NextResponse.json({ error: 'Failed to fetch ElevenLabs voices' }, { status: 500 });
  }
} 