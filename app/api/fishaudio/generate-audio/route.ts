import { NextRequest, NextResponse } from 'next/server'

// Helper function to split text into chunks
function chunkText(text: string, maxChunkSize: number = 3000): string[] {
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

export async function POST(request: NextRequest) {
  try {
    const { 
      sectionId, 
      text, 
      voiceId, 
      model = 'speech-1',
      format = 'mp3',
      mp3Bitrate = 192,
      normalize = true,
      latency = 'normal'
    } = await request.json()

    if (!text || !voiceId) {
      return NextResponse.json({
        success: false,
        error: 'Text and voiceId are required'
      }, { status: 400 })
    }

    if (!process.env.FISH_AUDIO_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Fish Audio API key not configured'
      }, { status: 500 })
    }

    console.log(`🐠 Generating Fish Audio for section: ${sectionId}`)
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎤 Voice: ${voiceId}, Model: ${model}`)

    // Split text into chunks for processing
    const textChunks = chunkText(text, 3000)
    console.log(`📦 Split into ${textChunks.length} chunks`)

    const audioBuffers: Buffer[] = []
    let totalSize = 0

    // Process each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const textChunk = textChunks[i]
      console.log(`🔄 Processing chunk ${i + 1}/${textChunks.length} (${textChunk.length} chars)`)

      try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
            'Content-Type': 'application/json',
            'Model': model
          },
          body: JSON.stringify({
            text: textChunk,
            chunk_length: 3000,
            format: format,
            mp3_bitrate: mp3Bitrate,
            reference_id: voiceId,
            normalize: normalize,
            latency: latency
          })
        })

        if (!response.ok || !response.body) {
          let errorBody = ''
          try { 
            errorBody = await response.text() 
          } catch (e) { 
            /* ignore */ 
          }
          throw new Error(`Fish Audio API error [Chunk ${i + 1}]: ${response.status} ${response.statusText}. Body: ${errorBody}`)
        }

        // Read the streaming response
        const reader = response.body.getReader()
        const chunks: Buffer[] = []
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(Buffer.from(value))
        }

        const chunkBuffer = Buffer.concat(chunks)
        audioBuffers.push(chunkBuffer)
        totalSize += chunkBuffer.length

        console.log(`✅ Chunk ${i + 1} completed: ${Math.round(chunkBuffer.length / 1024)}KB`)

        // Small delay between chunks to avoid rate limiting
        if (i < textChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${i + 1}:`, error)
        throw new Error(`Failed to process chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Combine all audio buffers
    const combinedBuffer = Buffer.concat(audioBuffers)
    const base64Audio = combinedBuffer.toString('base64')
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    console.log(`✅ Fish Audio generation completed for section: ${sectionId}`)
    console.log(`📊 Total size: ${Math.round(totalSize / 1024)}KB, Chunks: ${textChunks.length}`)

    return NextResponse.json({
      success: true,
      audioUrl: audioUrl,
      result: {
        success: true,
        audioUrl: audioUrl,
        audioSize: totalSize,
        chunksGenerated: textChunks.length,
        totalChunks: textChunks.length,
        voiceId: voiceId,
        modelId: model,
        provider: 'fishaudio'
      }
    })

  } catch (error) {
    console.error('Fish Audio generation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate Fish Audio'
    }, { status: 500 })
  }
} 