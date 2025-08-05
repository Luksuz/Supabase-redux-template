import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY

// Available Minimax models
const MINIMAX_MODELS = [
  {
    id: "speech-02-hd",
    name: "Speech-02-HD",
    description: "High quality speech synthesis model",
    quality: "high"
  },
  {
    id: "speech-02-turbo",
    name: "Speech-02-Turbo", 
    description: "Fast speech synthesis model",
    quality: "standard"
  },
  {
    id: "speech-01-hd",
    name: "Speech-01-HD",
    description: "High quality legacy model",
    quality: "high"
  },
  {
    id: "speech-01-turbo",
    name: "Speech-01-Turbo",
    description: "Fast legacy model",
    quality: "standard"
  }
]

// Fallback voices if API is unavailable
const FALLBACK_VOICES = [
  {
    id: "9BWtsMINqrJLrRacOk9x",
    name: "Aria",
    description: "Premium female voice",
    language: "en",
    category: "premade"
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Natural female voice",
    language: "en",
    category: "premade"
  },
  {
    id: "male-1", 
    name: "Male Voice 1",
    description: "Natural male voice",
    language: "en",
    category: "standard"
  }
]

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching Minimax voices from API')

    // Check if API key is available
    if (!MINIMAX_API_KEY) {
      console.log('⚠️ Minimax API key not found, returning fallback voices')
      return NextResponse.json({
        success: true,
        voices: FALLBACK_VOICES,
        models: MINIMAX_MODELS,
        provider: 'minimax',
        total_voices: FALLBACK_VOICES.length,
        total_models: MINIMAX_MODELS.length,
        mock: true
      })
    }

    try {
      // Fetch voices from Minimax API
      console.log('🔍 Minimax API key:', MINIMAX_API_KEY)
      const response = await fetch('https://api.minimax.io/v1/get_voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
          voice_type: "system"
        })
      })

      if (!response.ok) {
        throw new Error(`Minimax API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('🔍 Raw Minimax API response:', JSON.stringify(data, null, 2))
      
      // Handle the actual response format with multiple voice arrays
      let voices = []
      
      // Process voice_slots
      if (data.voice_slots && Array.isArray(data.voice_slots)) {
        const voiceSlots = data.voice_slots
          .filter((voice: any) => voice.voice_id && voice.voice_name) // Filter out empty slots
          .map((voice: any) => ({
            id: voice.voice_id,
            name: voice.voice_name,
            description: Array.isArray(voice.description) ? voice.description.join(', ') : voice.description || 'Voice slot',
            language: "en",
            category: "voice_slot"
          }))
        voices.push(...voiceSlots)
      }
      
      // Process system_voice
      if (data.system_voice && Array.isArray(data.system_voice)) {
        const systemVoices = data.system_voice
          .filter((voice: any) => voice.voice_id && voice.voice_name) // Filter out empty entries
          .map((voice: any) => ({
            id: voice.voice_id,
            name: voice.voice_name,
            description: Array.isArray(voice.description) ? voice.description.join(', ') : voice.description || 'System voice',
            language: "en",
            category: "system"
          }))
        voices.push(...systemVoices)
      }
      
      // Process voice_cloning
      if (data.voice_cloning && Array.isArray(data.voice_cloning)) {
        const clonedVoices = data.voice_cloning
          .filter((voice: any) => voice.voice_id) // Filter out empty entries
          .map((voice: any) => ({
            id: voice.voice_id,
            name: voice.voice_id, // Use voice_id as name if voice_name is not available
            description: Array.isArray(voice.description) ? voice.description.join(', ') : voice.description || 'Cloned voice',
            language: "en",
            category: "cloned",
            created_time: voice.created_time
          }))
        voices.push(...clonedVoices)
      }
      
      // Process voice_generation
      if (data.voice_generation && Array.isArray(data.voice_generation)) {
        const generatedVoices = data.voice_generation
          .filter((voice: any) => voice.voice_id) // Filter out empty entries
          .map((voice: any) => ({
            id: voice.voice_id,
            name: voice.voice_id, // Use voice_id as name if voice_name is not available
            description: Array.isArray(voice.description) ? voice.description.join(', ') : voice.description || 'Generated voice',
            language: "en",
            category: "generated",
            created_time: voice.created_time
          }))
        voices.push(...generatedVoices)
      }
      
      // Process music_generation (if needed for audio generation)
      if (data.music_generation && Array.isArray(data.music_generation)) {
        const musicVoices = data.music_generation
          .filter((voice: any) => voice.voice_id) // Filter out empty entries
          .map((voice: any) => ({
            id: voice.voice_id,
            name: voice.voice_id, // Use voice_id as name
            description: 'Music generation voice',
            language: "en",
            category: "music",
            instrumental_id: voice.instrumental_id,
            created_time: voice.created_time
          }))
        voices.push(...musicVoices)
      }
      
      // If no voices found, use fallback
      if (voices.length === 0) {
        console.warn('⚠️ No voices found in Minimax API response, using fallback voices')
        voices = FALLBACK_VOICES
      }

      console.log(`✅ Fetched ${voices.length} voices from Minimax API`)
      console.log(`🔍 Voice categories: ${voices.map(v => v.category).join(', ')}`)

      return NextResponse.json({
        success: true,
        voices: voices,
        models: MINIMAX_MODELS,
        provider: 'minimax',
        total_voices: voices.length,
        total_models: MINIMAX_MODELS.length
      })

    } catch (apiError: any) {
      console.error('❌ Minimax API error, falling back to static voices:', apiError)
      
      // Return fallback voices if API fails
      return NextResponse.json({
        success: true,
        voices: FALLBACK_VOICES,
        models: MINIMAX_MODELS,
        provider: 'minimax',
        total_voices: FALLBACK_VOICES.length,
        total_models: MINIMAX_MODELS.length,
        fallback: true,
        api_error: apiError.message
      })
    }

  } catch (error: any) {
    console.error('❌ Error fetching Minimax voices:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to fetch Minimax voices: ${error.message}`
    }, { status: 500 })
  }
} 