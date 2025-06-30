import { NextRequest, NextResponse } from 'next/server';
import { fetchSpeechifyVoices, isSpeechifyConfigured } from '@/lib/speechify-utils';

export async function GET(request: NextRequest) {
  if (!isSpeechifyConfigured()) {
    return NextResponse.json({ error: 'Speechify API key not configured' }, { status: 500 });
  }

  try {
    console.log('🎤 Fetching Speechify voices...');
    const voices = await fetchSpeechifyVoices();
    
    // Check if we got mock data (common when API key is invalid)
    const hasMockData = voices.length > 0 && voices.some((voice: any) => 
      voice.id === 'id' || 
      voice.displayName === 'displayName' ||
      voice.locale === 'locale' ||
      voice.gender === 'gender'
    );
    
    if (hasMockData) {
      console.warn('⚠️ Speechify API returned mock data - API key may be invalid');
      console.warn('Mock voices received:', voices);
      return NextResponse.json({ 
        error: 'Speechify API returned mock data. Please check if your API key is valid and has proper permissions.',
        success: false,
        voices: []
      }, { status: 400 });
    }
    
    console.log(`✅ Retrieved ${voices.length} valid Speechify voices`);
    
    return NextResponse.json({ 
      success: true, 
      voices 
    });
  } catch (error: any) {
    console.error('Error fetching Speechify voices:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Speechify voices: ' + error.message,
      success: false,
      voices: []
    }, { status: 500 });
  }
} 