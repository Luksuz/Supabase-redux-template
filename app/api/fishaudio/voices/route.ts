import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Fish Audio predefined voices and models
    const fishAudioData = {
      name: "Fish Audio",
      voices: [
        { id: "7f92f8afb8ec43bf81429cc1c9199cb1", name: "Gentle Female Voice" },
        { id: "54a5170f9f8e4d60a2a10e8aae699282", name: "Professional Male Voice" },
      ],
      models: [
        { id: "speech-1", name: "Standard Quality" },
        { id: "speech-1.6", name: "Enhanced Quality" }
      ]
    }

    return NextResponse.json({
      success: true,
      voices: fishAudioData.voices,
      models: fishAudioData.models
    })
  } catch (error) {
    console.error('Fish Audio voices API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Fish Audio voices'
    }, { status: 500 })
  }
} 