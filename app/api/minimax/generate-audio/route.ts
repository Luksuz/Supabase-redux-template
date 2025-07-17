import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeYouTubeTimestamps } from '@/utils/youtube-utils'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID

// Helper function to split text into chunks
function chunkText(text: string, maxChunkSize: number = 8000): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.')
        currentChunk = trimmedSentence
      } else {
        // Handle very long sentences by breaking them at word boundaries
        const words = trimmedSentence.split(' ')
        let wordChunk = ''
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxChunkSize) {
            wordChunk += (wordChunk ? ' ' : '') + word
          } else {
            if (wordChunk) {
              chunks.push(wordChunk)
              wordChunk = word
            } else {
              // Single word longer than chunk size, force it
              chunks.push(word)
            }
          }
        }
        if (wordChunk) {
          chunks.push(wordChunk)
        }
        currentChunk = ''
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + '.')
  }

  return chunks.filter(chunk => chunk.trim().length > 0)
}

// Convert hex audio data to base64
function hexToBase64(hexString: string): string {
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
  }
  return Buffer.from(bytes).toString('base64')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestBody = await request.json()
    const { 
      text, 
      voiceId, 
      modelId = "speech-02-hd",
      sectionId,
      speed = 1,
      vol = 1,
      pitch = 0
    } = requestBody

    console.log(`📥 Received Minimax audio generation request for section ${sectionId}`)
    console.log(`Text length: ${text?.length || 0}, Voice: ${voiceId}, Model: ${modelId}`)

    if (!text || !voiceId) {
      return NextResponse.json({ 
        error: "Missing required fields: text and voiceId" 
      }, { status: 400 })
    }

    // Check if Minimax API key is available
    if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
      console.log("⚠️ Minimax API key or Group ID not found. Returning mock audio generation response.")
      
      const cleanedText = removeYouTubeTimestamps(text)
      console.log(`📝 Mock generation using cleaned text: ${cleanedText.substring(0, 100)}...`)
      
      // Update section with mock audio generation status if sectionId provided
      if (sectionId) {
        try {
          await supabase
            .from('fine_tuning_outline_sections')
            .update({ 
              audio_generated: true,
              audio_voice_id: voiceId,
              audio_model_id: modelId,
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId)
            .eq('user_id', user.id)
        } catch (error) {
          console.error('Error updating section:', error)
        }
      }

      return NextResponse.json({
        success: true,
        audioData: '', // Empty base64 for mock
        audioSize: 0,
        chunksGenerated: 1,
        totalChunks: 1,
        voiceId,
        modelId,
        mock: true
      })
    }

    try {
      const cleanedText = removeYouTubeTimestamps(text)
      const textChunks = chunkText(cleanedText)
      
      console.log(`📝 Processing ${textChunks.length} text chunks for Minimax generation`)

      const audioChunks: string[] = []
      const errors: string[] = []

      // Process each chunk
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i]
        console.log(`🎵 Generating audio for chunk ${i + 1}/${textChunks.length}`)

        try {
          const response = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MINIMAX_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: modelId,
              text: chunk,
              stream: false,
              voice_setting: {
                voice_id: voiceId,
                speed: speed,
                vol: vol,
                pitch: pitch
              },
              audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3",
                channel: 1
              }
            })
          })

          if (!response.ok) {
            throw new Error(`Minimax API error: ${response.status} ${response.statusText}`)
          }

          const result = await response.json()
          
          if (result.base_resp?.status_code !== 0) {
            throw new Error(`Minimax API error: ${result.base_resp?.status_msg || 'Unknown error'}`)
          }

          if (result.data?.audio) {
            // Convert hex audio to base64
            const audioBase64 = hexToBase64(result.data.audio)
            audioChunks.push(audioBase64)
            console.log(`✅ Chunk ${i + 1} generated successfully (${result.extra_info?.audio_size || 'unknown'} bytes)`)
          } else {
            throw new Error('No audio data received from Minimax')
          }

        } catch (error: any) {
          console.error(`❌ Error generating chunk ${i + 1}:`, error)
          errors.push(`Chunk ${i + 1}: ${error.message}`)
        }
      }

      if (audioChunks.length === 0) {
        throw new Error('No audio chunks were generated successfully')
      }

      // Combine all audio chunks
      const combinedAudio = audioChunks.join('')
      const audioBuffer = Buffer.from(combinedAudio, 'base64')

      console.log(`🎉 Minimax audio generation completed: ${audioChunks.length}/${textChunks.length} chunks successful`)

      // Update section status if sectionId provided
      if (sectionId) {
        try {
          await supabase
            .from('fine_tuning_outline_sections')
            .update({ 
              audio_generated: true,
              audio_voice_id: voiceId,
              audio_model_id: modelId,
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId)
            .eq('user_id', user.id)
        } catch (error) {
          console.error('Error updating section:', error)
        }
      }
      
      return NextResponse.json({
        success: true,
        audioData: combinedAudio,
        audioSize: audioBuffer.length,
        chunksGenerated: audioChunks.length,
        totalChunks: textChunks.length,
        voiceId,
        modelId,
        errors: errors.length > 0 ? errors : undefined
      })
      
    } catch (error: any) {
      console.error("❌ Error in Minimax audio generation:", error)
      return NextResponse.json({
        success: false,
        error: `Minimax generation failed: ${error.message}`
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error("❌ Error generating Minimax audio:", error)
    return NextResponse.json(
      { error: `Failed to generate audio: ${error.message}` },
      { status: 500 }
    )
  }
} 