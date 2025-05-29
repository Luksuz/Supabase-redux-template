import { NextRequest, NextResponse } from 'next/server'
import { getValidApiKey, markApiKeyAsInvalid, incrementApiKeyUsage } from '@/lib/wellsaid-utils'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

// Function to split text into chunks under 1000 characters while preserving word boundaries
function splitTextIntoChunks(text: string, maxLength: number = 950): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const words = text.split(' ');

  for (const word of words) {
    // Check if adding this word would exceed the limit
    const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
    
    if (testChunk.length <= maxLength) {
      currentChunk = testChunk;
    } else {
      // If current chunk is not empty, save it and start a new one
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        // If a single word is longer than maxLength, we have to include it anyway
        chunks.push(word);
        currentChunk = '';
      }
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function POST(request: NextRequest) {
  try {
    const { text, speaker_id = 3, model = 'caruso', chunkIndex, userId = 'unknown_user', sessionId } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required for audio generation' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required for chunk management' },
        { status: 400 }
      )
    }

    console.log(`🎵 Starting WellSaid Labs audio generation for chunk ${chunkIndex}`)
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎤 Speaker ID: ${speaker_id}, Model: ${model}`)

    // Get a valid API key from the database
    const apiKey = await getValidApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No valid WellSaid Labs API keys available. Please upload API keys first.' },
        { status: 400 }
      )
    }

    console.log(`🔑 Using WellSaid Labs API key: ${apiKey}`)

    // Split text into sub-chunks if it's too long
    const textChunks = splitTextIntoChunks(text)
    console.log(`📝 Split into ${textChunks.length} sub-chunks`)

    // Create session-specific temp directory
    const tempDir = path.join(os.tmpdir(), 'wellsaid-audio', sessionId)
    await fs.mkdir(tempDir, { recursive: true })
    
    const subChunkFiles: string[] = []

    try {
      // Generate audio for each sub-chunk
      for (let i = 0; i < textChunks.length; i++) {
        const subChunk = textChunks[i]
        console.log(`🎵 [Sub-chunk ${i + 1}/${textChunks.length}] Generating: "${subChunk.substring(0, 50)}..." (${subChunk.length} chars)`)

        // Call WellSaid Labs API
        const wellSaidResponse = await fetch('https://api.wellsaidlabs.com/v1/tts/stream', {
          method: 'POST',
          headers: {
            'accept': '*/*',
            'content-type': 'application/json',
            'X-Api-Key': apiKey
          },
          body: JSON.stringify({
            text: subChunk,
            speaker_id: speaker_id,
            model: model
          })
        })

        if (!wellSaidResponse.ok) {
          const errorText = await wellSaidResponse.text()
          console.error(`WellSaid Labs API error: ${wellSaidResponse.status} ${wellSaidResponse.statusText}`)
          
          // If API key is invalid, mark it as invalid
          if (wellSaidResponse.status === 401 || wellSaidResponse.status === 403) {
            console.log(`🚫 Marking API key as invalid due to ${wellSaidResponse.status} error`)
            await markApiKeyAsInvalid(apiKey)
            
            return NextResponse.json(
              { error: 'API key is invalid. Please upload new API keys.' },
              { status: 401 }
            )
          }
          
          throw new Error(`WellSaid Labs API error: ${wellSaidResponse.statusText}`)
        }

        // Save sub-chunk audio to local file
        const audioBuffer = await wellSaidResponse.arrayBuffer()
        const audioData = new Uint8Array(audioBuffer)
        
        const subChunkFileName = `chunk-${chunkIndex}-sub-${i}-${Date.now()}.mp3`
        const subChunkFilePath = path.join(tempDir, subChunkFileName)
        
        await fs.writeFile(subChunkFilePath, audioData)
        subChunkFiles.push(subChunkFilePath)
        
        console.log(`✅ [Sub-chunk ${i + 1}] Audio saved locally: ${subChunkFilePath}`)
      }

      // If multiple sub-chunks, concatenate them
      let finalFilePath: string
      
      if (textChunks.length === 1) {
        // Single sub-chunk, use it directly
        finalFilePath = subChunkFiles[0]
        console.log(`📤 Single sub-chunk, using directly`)
      } else {
        // Multiple sub-chunks, concatenate them
        console.log(`🔗 Concatenating ${textChunks.length} sub-chunks`)
        
        const finalFileName = `chunk-${chunkIndex}-final-${Date.now()}.mp3`
        finalFilePath = path.join(tempDir, finalFileName)
        
        // Create ffmpeg concat file
        const concatFileName = `concat-chunk-${chunkIndex}-${Date.now()}.txt`
        const concatFilePath = path.join(tempDir, concatFileName)
        
        const concatContent = subChunkFiles.map(file => `file '${file}'`).join('\n')
        await fs.writeFile(concatFilePath, concatContent)
        
        // Run ffmpeg concatenation
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${finalFilePath}"`
        console.log(`🎬 Running ffmpeg: ${ffmpegCommand}`)
        
        await execAsync(ffmpegCommand)
        
        // Clean up sub-chunk files and concat file
        for (const subChunkFile of subChunkFiles) {
          await fs.unlink(subChunkFile)
        }
        await fs.unlink(concatFilePath)
        
        console.log(`✅ Sub-chunks concatenated successfully`)
      }

      // Get duration using ffprobe
      console.log(`⏱️ Getting audio duration with ffprobe`)
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${finalFilePath}"`)
      const duration = parseFloat(stdout.trim())
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Invalid duration detected: ${stdout.trim()}`)
      }
      
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`)

      // Increment API key usage after successful generation
      const usageResult = await incrementApiKeyUsage(apiKey)
      if (usageResult.success) {
        if (usageResult.markedInvalid) {
          console.log(`🚫 API key reached usage limit (${usageResult.newCount} uses) and was marked invalid`)
        } else {
          console.log(`📊 API key usage updated: ${usageResult.newCount}/50 uses`)
        }
      } else {
        console.warn(`⚠️ Failed to update API key usage count, but audio generation was successful`)
      }

      console.log(`🎉 Audio chunk generation completed successfully!`)

      return NextResponse.json({
        success: true,
        chunkIndex: chunkIndex,
        localFilePath: finalFilePath, // Return local file path instead of URL
        duration: duration,
        text: text,
        message: `Audio chunk ${chunkIndex} generated successfully and saved locally`
      })

    } catch (error: any) {
      console.error(`❌ Error generating audio chunk:`, error)
      
      // Clean up any temporary files
      const allTempFiles = [...subChunkFiles]
      for (const tempFile of allTempFiles) {
        try {
          await fs.unlink(tempFile)
        } catch (cleanupError) {
          console.warn(`Warning: Failed to clean up temp file ${tempFile}`, cleanupError)
        }
      }
      
      return NextResponse.json(
        { error: `Failed to generate audio chunk: ${error.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in WellSaid Labs audio chunk generation:', error)
    return NextResponse.json(
      { error: 'Internal server error during audio generation' },
      { status: 500 }
    )
  }
} 