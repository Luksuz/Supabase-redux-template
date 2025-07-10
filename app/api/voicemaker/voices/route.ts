import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { language = 'en-US' } = await request.json()

    // VoiceMaker API endpoint for listing voices
    const response = await fetch('https://developer.voicemaker.in/voice/list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VOICEMAKER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: language
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `VoiceMaker API error: ${response.status}`)
    }

    if (data.success && data.data && data.data.voices_list) {
      return NextResponse.json({
        success: true,
        voices: data.data.voices_list
      })
    } else {
      throw new Error('Invalid response format from VoiceMaker API')
    }
  } catch (error) {
    console.error('VoiceMaker voices API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch VoiceMaker voices'
    }, { status: 500 })
  }
} 