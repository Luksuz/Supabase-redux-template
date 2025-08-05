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

    console.log('VoiceMaker API response:', data)

    if (!response.ok) {
      throw new Error(data.error || `VoiceMaker API error: ${response.status}`)
    }

    if (data.success && data.path) {
      console.log(`✅ VoiceMaker audio generated successfully for section: ${sectionId}`)
      console.log(`📊 Used characters: ${data.usedChars}, Remaining: ${data.remainChars}`)
      console.log(`🔄 Downloading audio from: ${data.path}`)
      
      // Download the audio file from VoiceMaker's URL
      const audioResponse = await fetch(data.path)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio from VoiceMaker: ${audioResponse.status}`)
      }
      
      // Convert to buffer and then to base64
      const audioBuffer = await audioResponse.arrayBuffer()
      const audioBase64 = Buffer.from(audioBuffer).toString('base64')
      const audioSize = audioBuffer.byteLength
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`
      
      console.log(`✅ Audio downloaded and converted to data URL. Size: ${Math.round(audioSize / 1024)}KB`)
      
      return NextResponse.json({
        success: true,
        audioUrl: audioUrl,
        result: {
          success: true,
          audioUrl: audioUrl,
          audioSize: audioSize,
          chunksGenerated: 1,
          totalChunks: 1,
          voiceId: voiceId,
          modelId: engine,
          provider: 'voicemaker',
          usedChars: data.usedChars,
          remainChars: data.remainChars,
          remainKeyChars: data.remainKeyChars
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