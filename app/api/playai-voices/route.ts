import { NextRequest, NextResponse } from 'next/server';

const PLAYAI_API_KEY = process.env.PLAYAI_API_KEY;
const PLAYAI_USER_ID = process.env.PLAYAI_USER_ID;

interface PlayAIVoice {
  name: string;
  id: string;
  sample?: string;
  gender?: string;
  accent?: string;
  description?: string;
  language?: string;
  tags?: string[];
  categories?: string[];
  updatedDate?: number;
  createdDate?: number;
}

export async function GET(request: NextRequest) {
  try {
    if (!PLAYAI_API_KEY || !PLAYAI_USER_ID) {
      console.warn('PLAYAI_API_KEY or PLAYAI_USER_ID not configured, returning mock data');
      return NextResponse.json({
        success: false,
        error: 'Play.ai API key or User ID not configured. Please add PLAYAI_API_KEY and PLAYAI_USER_ID to your environment variables.',
        voices: []
      });
    }

    console.log('🎤 Fetching Play.ai voices...');

    const response = await fetch('https://api.play.ai/api/v1/voices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PLAYAI_API_KEY}`,
        'X-USER-ID': PLAYAI_USER_ID,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Play.ai API error:', response.status, errorText);
      throw new Error(`Play.ai API error: ${response.status} ${errorText}`);
    }

    const voices: PlayAIVoice[] = await response.json();
    
    console.log(`✅ Successfully fetched ${voices.length} Play.ai voices`);
    
    // Filter and format voices for our use
    const formattedVoices = voices.map(voice => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender || 'unknown',
      accent: voice.accent || voice.language || 'unknown',
      description: voice.description || '',
      language: voice.language || 'unknown',
      categories: voice.categories || [],
      sample: voice.sample
    }));

    return NextResponse.json({
      success: true,
      voices: formattedVoices
    });

  } catch (error: any) {
    console.error('Error fetching Play.ai voices:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      voices: []
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 