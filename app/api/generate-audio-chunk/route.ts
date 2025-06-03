import { NextRequest, NextResponse } from 'next/server'
import { getValidApiKey, markApiKeyAsInvalid, incrementApiKeyUsage } from '@/lib/wellsaid-utils'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { createWriteStream } from 'fs'

const execAsync = promisify(exec)

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const RETRY_MULTIPLIER = 2 // Exponential backoff

// Function to split text into chunks under 150 characters while preserving word boundaries
function splitTextIntoChunks(text: string, maxLength: number = 140): string[] {
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

// Sleep function for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry wrapper function
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries + 1} attempts failed. Last error:`, lastError)
        throw lastError
      }
      
      const delay = initialDelay * Math.pow(RETRY_MULTIPLIER, attempt)
      console.warn(`⚠️ Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)
      await sleep(delay)
    }
  }
  
  throw lastError
}

// Generate audio for a single sub-chunk with retry logic using streaming
async function generateSubChunkAudio(
  subChunk: string,
  speaker_id: number,
  model: string,
  subChunkIndex: number,
  totalSubChunks: number,
  outputFilePath: string
): Promise<void> {
  return withRetry(async () => {
    console.log(`🎵 [Sub-chunk ${subChunkIndex + 1}/${totalSubChunks}] Generating: "${subChunk.substring(0, 50)}..." (${subChunk.length} chars)`)
    
    // Get a valid API key (this might be different from previous attempts if keys were invalidated)
    const apiKey = await getValidApiKey()
    if (!apiKey) {
      throw new Error('No valid WellSaid Labs API keys available')
    }
    
    console.log(`🔑 Using API key for sub-chunk ${subChunkIndex + 1}`)

    // Call WellSaid Labs API
    const wellSaidResponse = await fetch('https://api.wellsaidlabs.com/v1/tts/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({
        text: subChunk,
        speaker_id: speaker_id,
        model: model
      })
    })

    if (!wellSaidResponse.ok) {
      let errorMessage = "Failed to render"
      try {
        const { message } = await wellSaidResponse.json()
        errorMessage = message
      } catch (error) {
        // If JSON parsing fails, fall back to status text
        errorMessage = wellSaidResponse.statusText || "Failed to render"
      }
      
      console.error(`WellSaid Labs API error: ${wellSaidResponse.status} ${errorMessage}`)
      
      // If API key is invalid, mark it as invalid and throw error to trigger retry with new key
      if (wellSaidResponse.status === 401 || wellSaidResponse.status === 403) {
        console.log(`🚫 Marking API key as invalid due to ${wellSaidResponse.status} error`)
        await markApiKeyAsInvalid(apiKey)
        throw new Error(`API key invalid (${wellSaidResponse.status}): ${errorMessage}`)
      }
      
      // For other errors, throw with status for potential retry
      throw new Error(`WellSaid Labs API error (${wellSaidResponse.status}): ${errorMessage}`)
    }

    // Stream the response directly to file
    const storageWriteStream = createWriteStream(outputFilePath)
    
    if (!wellSaidResponse.body) {
      throw new Error('No response body received from WellSaid Labs API')
    }

    // Convert web stream to Node.js stream and pipe to file
    const reader = wellSaidResponse.body.getReader()
    
    try {
      await new Promise<void>((resolve, reject) => {
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                storageWriteStream.end()
                break
              }
              
              if (!storageWriteStream.write(value)) {
                // Wait for drain event if write buffer is full
                await new Promise<void>(resolveWrite => storageWriteStream.once('drain', () => resolveWrite()))
              }
            }
          } catch (error) {
            storageWriteStream.destroy()
            reject(error)
          }
        }
        
        storageWriteStream.on('finish', resolve)
        storageWriteStream.on('error', reject)
        
        pump().catch(reject)
      })
    } finally {
      reader.releaseLock()
    }

    // Increment API key usage after successful generation
    const usageResult = await incrementApiKeyUsage(apiKey)
    if (usageResult.success) {
      if (usageResult.markedInvalid) {
        console.log(`🚫 API key reached usage limit (${usageResult.newCount} uses) and was marked invalid`)
      } else {
        console.log(`📊 API key usage updated: ${usageResult.newCount}/50 uses`)
      }
    }
  })
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

    console.log(`🎵 Starting WellSaid Labs audio generation for chunk ${chunkIndex} (with retry mechanism)`)
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎤 Speaker ID: ${speaker_id}, Model: ${model}`)

    // Split text into sub-chunks if it's too long
    const textChunks = splitTextIntoChunks(text)
    console.log(`📝 Split into ${textChunks.length} sub-chunks`)

    // Create session-specific temp directory
    const tempDir = path.join(os.tmpdir(), 'wellsaid-audio', sessionId)
    await fs.mkdir(tempDir, { recursive: true })
    
    const subChunkFiles: string[] = []

    try {
      // Generate audio for each sub-chunk with retry logic
      for (let i = 0; i < textChunks.length; i++) {
        const subChunk = textChunks[i]
        
        try {
          // Create raw audio file path
          const rawSubChunkFileName = `chunk-${chunkIndex}-sub-${i}-raw-${Date.now()}.mp3`
          const rawSubChunkFilePath = path.join(tempDir, rawSubChunkFileName)
          
          // Generate audio with streaming and retry mechanism
          await generateSubChunkAudio(subChunk, speaker_id, model, i, textChunks.length, rawSubChunkFilePath)
          
          // Compress the audio chunk
          const compressedSubChunkFileName = `chunk-${chunkIndex}-sub-${i}-compressed-${Date.now()}.mp3`
          const compressedSubChunkFilePath = path.join(tempDir, compressedSubChunkFileName)
          
          console.log(`🗜️ [Sub-chunk ${i + 1}] Compressing audio: ${rawSubChunkFilePath} -> ${compressedSubChunkFilePath}`)
          
          await withRetry(async () => {
            const compressionCommand = `ffmpeg -i "${rawSubChunkFilePath}" -b:a 64k -ar 44100 -ac 1 -y "${compressedSubChunkFilePath}"`
            console.log(`🎛️ Running compression: ${compressionCommand}`)
            await execAsync(compressionCommand)
          }, 2, 500)
          
          // Clean up raw file and use compressed file
          await fs.unlink(rawSubChunkFilePath)
          subChunkFiles.push(compressedSubChunkFilePath)
          
          console.log(`✅ [Sub-chunk ${i + 1}] Audio generated and compressed: ${compressedSubChunkFilePath}`)
          
        } catch (error) {
          console.error(`❌ Sub-chunk ${i + 1} failed after all retry attempts:`, error)
          
          // Clean up any temp files created so far
          for (const tempFile of subChunkFiles) {
            try {
              await fs.unlink(tempFile)
            } catch (cleanupError) {
              console.warn(`Warning: Failed to clean up temp file ${tempFile}`, cleanupError)
            }
          }
          
          // Return specific error message
          return NextResponse.json(
            { 
              error: `Failed to generate audio for sub-chunk ${i + 1} after ${MAX_RETRIES + 1} attempts: ${(error as Error).message}`,
              retryable: true,
              chunkIndex: chunkIndex
            },
            { status: 500 }
          )
        }
      }

      // If multiple sub-chunks, concatenate them with compression
      let finalFilePath: string
      
      if (textChunks.length === 1) {
        // Single sub-chunk, already compressed - use it directly
        finalFilePath = subChunkFiles[0]
        console.log(`📤 Single compressed sub-chunk, using directly`)
      } else {
        // Multiple sub-chunks, concatenate them with additional compression
        console.log(`🔗 Concatenating ${textChunks.length} compressed sub-chunks`)
        
        const finalFileName = `chunk-${chunkIndex}-final-compressed-${Date.now()}.mp3`
        finalFilePath = path.join(tempDir, finalFileName)
        
        // Create ffmpeg concat file
        const concatFileName = `concat-chunk-${chunkIndex}-${Date.now()}.txt`
        const concatFilePath = path.join(tempDir, concatFileName)
        
        const concatContent = subChunkFiles.map(file => `file '${file}'`).join('\n')
        await fs.writeFile(concatFilePath, concatContent)
        
        // Run ffmpeg concatenation with compression (not using -c copy)
        await withRetry(async () => {
          const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -b:a 64k -ar 44100 -ac 1 -y "${finalFilePath}"`
          console.log(`🎬 Running compressed concatenation: ${ffmpegCommand}`)
          await execAsync(ffmpegCommand)
        }, 2, 500) // Fewer retries for ffmpeg, shorter delay
        
        // Clean up sub-chunk files and concat file
        for (const subChunkFile of subChunkFiles) {
          await fs.unlink(subChunkFile)
        }
        await fs.unlink(concatFilePath)
        
        console.log(`✅ Sub-chunks concatenated with compression successfully`)
      }

      // Get duration using ffprobe with retry
      console.log(`⏱️ Getting audio duration with ffprobe`)
      const duration = await withRetry(async () => {
        const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${finalFilePath}"`)
        const parsedDuration = parseFloat(stdout.trim())
        
        if (isNaN(parsedDuration) || parsedDuration <= 0) {
          throw new Error(`Invalid duration detected: ${stdout.trim()}`)
        }
        
        return parsedDuration
      }, 2, 500)
      
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`)
      console.log(`🎉 Audio chunk generation completed successfully after retries!`)

      return NextResponse.json({
        success: true,
        chunkIndex: chunkIndex,
        localFilePath: finalFilePath,
        duration: duration,
        text: text,
        retriesUsed: true, // Indicate that retry mechanism was available
        message: `Audio chunk ${chunkIndex} generated successfully and saved locally`
      })

    } catch (error: any) {
      console.error(`❌ Error generating audio chunk after retries:`, error)
      
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
        { 
          error: `Failed to generate audio chunk after retries: ${error.message}`,
          retryable: false,
          chunkIndex: chunkIndex
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in WellSaid Labs audio chunk generation:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error during audio generation',
        retryable: false
      },
      { status: 500 }
    )
  }
}