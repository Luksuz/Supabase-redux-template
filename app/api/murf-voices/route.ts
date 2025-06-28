import { NextRequest, NextResponse } from 'next/server'
import { fetchMurfVoices, isMurfConfigured } from '@/lib/murf-utils'

export async function GET(request: NextRequest) {
  try {
    if (!isMurfConfigured()) {
      return NextResponse.json(
        { error: 'Murf.ai API key not configured' },
        { status: 500 }
      )
    }

    console.log('🎤 Fetching Murf.ai voices...')
    const voices = await fetchMurfVoices()
    
    console.log(`✅ Retrieved ${voices.length} Murf.ai voices`)
    
    return NextResponse.json({
      success: true,
      voices: voices
    })

  } catch (error: any) {
    console.error('Error fetching Murf.ai voices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Murf.ai voices: ' + error.message },
      { status: 500 }
    )
  }
} 