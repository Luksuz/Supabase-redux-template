import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { 
      sectionId, 
      text, 
      voiceId, 
      engine = 'neural',
      outputFormat = 'mp3',
      sampleRate = '48000',
      effect = 'default',
      masterVolume = '0',
      masterSpeed = '0',
      masterPitch = '0'
    } = await request.json()

    if (!text || !voiceId) {
      return NextResponse.json({
        success: false,
        error: 'Text and voiceId are required'
      }, { status: 400 })
    }

    if (!process.env.VOICEMAKER_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'VoiceMaker API key not configured'
      }, { status: 500 })
    }

    console.log(`🎵 Generating VoiceMaker audio for section: ${sectionId}`)
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎤 Voice: ${voiceId}`)

    // VoiceMaker API endpoint for generating audio
    const response = await fetch('https://developer.voicemaker.in/voice/api', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VOICEMAKER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Engine: engine,
        VoiceId: voiceId,
        LanguageCode: 'en-US',
        Text: text,
        OutputFormat: outputFormat,
        SampleRate: sampleRate,
        Effect: effect,
        MasterVolume: masterVolume,
        MasterSpeed: masterSpeed,
        MasterPitch: masterPitch
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `VoiceMaker API error: ${response.status}`)
    }

    if (data.success && data.data && data.data.audio_url) {
      console.log(`✅ VoiceMaker audio generated successfully for section: ${sectionId}`)
      
      return NextResponse.json({
        success: true,
        audioUrl: data.data.audio_url,
        result: {
          success: true,
          audioUrl: data.data.audio_url,
          audioSize: data.data.audio_size || 0,
          chunksGenerated: 1,
          totalChunks: 1,
          modelId: `${engine}-${voiceId}`,
          provider: 'voicemaker'
        }
      })
    } else {
      throw new Error('Invalid response format from VoiceMaker API')
    }
  } catch (error) {
    console.error('VoiceMaker audio generation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate VoiceMaker audio'
    }, { status: 500 })
  }
} 