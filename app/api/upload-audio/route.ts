import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

// SSE helper function
function createSSEResponse() {
  const encoder = new TextEncoder()
  let isClosed = false
  
  let controller: ReadableStreamDefaultController<Uint8Array>
  
  const stream = new ReadableStream({
    start(c) {
      controller = c
    }
  })
  
  const sendEvent = (data: any, event?: string) => {
    if (isClosed) {
      console.warn('Attempted to send event on closed SSE controller')
      return
    }
    
    try {
      const message = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(message))
    } catch (error) {
      console.error('Error sending SSE event:', error)
      isClosed = true
    }
  }
  
  const close = () => {
    if (!isClosed) {
      isClosed = true
      try {
        controller.close()
      } catch (error) {
        console.warn('Error closing SSE controller:', error)
      }
    }
  }
  
  return {
    response: new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    }),
    sendEvent,
    close,
    isClosed: () => isClosed
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const useSSE = url.searchParams.get('sse') === 'true'
  
  if (useSSE) {
    return handleSSEUpload(request)
  } else {
    return handleRegularUpload(request)
  }
}

async function handleSSEUpload(request: NextRequest) {
  const { response, sendEvent, close, isClosed } = createSSEResponse()
  
  // Start processing in the background
  processAudioWithSSE(request, sendEvent, close, isClosed).catch((error) => {
    if (!isClosed()) {
      sendEvent({ 
        type: 'error', 
        message: error.message 
      }, 'error')
    }
    close()
  })
  
  return response
}

async function processAudioWithSSE(
  request: NextRequest, 
  sendEvent: (data: any, event?: string) => void,
  close: () => void,
  isClosed: () => boolean
) {
  try {
    sendEvent({ type: 'progress', message: 'Starting audio upload...', progress: 0 }, 'progress')
    
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const userId = formData.get('userId') as string

    if (!audioFile) {
      throw new Error('Audio file is required')
    }

    if (!userId) {
      throw new Error('User ID is required')
    }

    console.log(`🎵 Starting audio upload for user: ${userId}`)
    console.log(`📁 File: ${audioFile.name}, Size: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB`)

    if (isClosed()) return

    sendEvent({ 
      type: 'progress', 
      message: `Processing ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB)...`, 
      progress: 10 
    }, 'progress')

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), 'audio-upload', Date.now().toString())
    await fs.mkdir(tempDir, { recursive: true })

    try {
      if (isClosed()) return
      sendEvent({ type: 'progress', message: 'Saving uploaded file...', progress: 20 }, 'progress')
      
      // Save uploaded file to temp directory
      const originalFilePath = path.join(tempDir, `original_${audioFile.name}`)
      const audioArrayBuffer = await audioFile.arrayBuffer()
      await fs.writeFile(originalFilePath, new Uint8Array(audioArrayBuffer))
      
      console.log(`📁 Saved original file: ${originalFilePath}`)

      if (isClosed()) return
      sendEvent({ type: 'progress', message: 'Analyzing audio duration...', progress: 30 }, 'progress')

      // Get duration using ffprobe
      console.log(`⏱️ Getting audio duration with ffprobe`)
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${originalFilePath}"`)
      const duration = parseFloat(stdout.trim())
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Invalid audio duration: ${stdout.trim()}`)
      }
      
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`)

      if (isClosed()) return
      sendEvent({ 
        type: 'progress', 
        message: `Duration: ${duration.toFixed(1)}s. Calculating compression settings...`, 
        progress: 40 
      }, 'progress')

      // Check original file size
      const originalStats = await fs.stat(originalFilePath)
      const originalSizeMB = originalStats.size / (1024 * 1024)
      console.log(`📊 Original file size: ${originalSizeMB.toFixed(2)}MB`)

      // Calculate maximum bitrate we can afford to target 23-24MB (safety buffer)
      const targetSizeMB = 23 // Target 23MB for 2MB safety buffer
      const maxAffordableBitrate = Math.floor((targetSizeMB * 8 * 1024) / duration)
      
      // Set quality limits for Opus
      let targetBitrate = Math.max(6, Math.min(128, maxAffordableBitrate))
      
      if (maxAffordableBitrate >= 64) {
        targetBitrate = Math.min(128, maxAffordableBitrate)
      } else if (maxAffordableBitrate >= 32) {
        targetBitrate = Math.min(64, maxAffordableBitrate)
      } else if (maxAffordableBitrate >= 16) {
        targetBitrate = Math.min(32, maxAffordableBitrate)
      } else if (maxAffordableBitrate >= 12) {
        targetBitrate = Math.min(16, maxAffordableBitrate)
      } else {
        targetBitrate = Math.max(6, maxAffordableBitrate)
      }
      
      const estimatedSizeMB = (targetBitrate * duration) / (8 * 1024)
      console.log(`🎯 Target Opus bitrate: ${targetBitrate}k (max affordable: ${maxAffordableBitrate}k)`)
      console.log(`📊 Estimated final size: ${estimatedSizeMB.toFixed(1)}MB (targeting ${targetSizeMB}MB)`)

      if (isClosed()) return
      sendEvent({ 
        type: 'progress', 
        message: `Compressing with Opus at ${targetBitrate}k bitrate...`, 
        progress: 50 
      }, 'progress')

      // Compress audio using Opus codec optimized for speech/VoIP
      const compressedFileName = `compressed_${Date.now()}_${audioFile.name.replace(/\.[^/.]+$/, '.webm')}`
      const compressedFilePath = path.join(tempDir, compressedFileName)
      
      console.log(`🗜️ Compressing audio with Opus codec at ${targetBitrate}k bitrate (maximizing quality)`)
      const compressionCommand = `ffmpeg -i "${originalFilePath}" -vn -map_metadata -1 -ac 1 -c:a libopus -b:a ${targetBitrate}k -application voip "${compressedFilePath}"`
      
      await execAsync(compressionCommand)
      
      if (isClosed()) return
      sendEvent({ type: 'progress', message: 'Compression complete. Verifying output...', progress: 70 }, 'progress')

      // Check compressed file size
      const compressedStats = await fs.stat(compressedFilePath)
      const compressedSizeMB = compressedStats.size / (1024 * 1024)
      console.log(`✅ Audio compressed with Opus: ${compressedFilePath}`)
      console.log(`📊 Final compressed size: ${compressedSizeMB.toFixed(2)}MB (${((1 - compressedSizeMB/originalSizeMB) * 100).toFixed(1)}% reduction)`)
      console.log(`🎯 Target achieved: ${compressedSizeMB <= 24 ? '✅' : '⚠️'} (${compressedSizeMB.toFixed(1)}MB / 24MB limit)`)
      
      if (compressedSizeMB > 25) {
        console.warn(`⚠️ Compressed file exceeds 25MB - this should be very rare with our calculations!`)
      } else if (compressedSizeMB > 24) {
        console.warn(`⚠️ Compressed file is close to limit (${compressedSizeMB.toFixed(1)}MB) but should be fine`)
      }

      if (isClosed()) return
      sendEvent({ 
        type: 'progress', 
        message: `Uploading to cloud storage (${compressedSizeMB.toFixed(1)}MB)...`, 
        progress: 80 
      }, 'progress')

      // Upload compressed audio to Supabase storage
      const supabase = await createClient()
      const compressedAudioData = await fs.readFile(compressedFilePath)
      
      const fileName = `${Date.now()}_${compressedFileName}`
      const filePath = `${userId}/audio/${fileName}`

      console.log(`☁️ Uploading to Supabase: ${filePath}`)
      
      const { data, error } = await supabase.storage
        .from('video-generator')
        .upload(filePath, compressedAudioData, {
          contentType: 'audio/webm',
          upsert: false
        })

      if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Failed to upload audio: ${error.message}`)
      }

      if (isClosed()) return
      sendEvent({ type: 'progress', message: 'Getting public URL...', progress: 90 }, 'progress')

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl
      
      console.log(`✅ Audio uploaded successfully: ${publicUrl}`)

      if (isClosed()) return
      sendEvent({ type: 'progress', message: 'Cleaning up temporary files...', progress: 95 }, 'progress')

      // Cleanup temp files
      await fs.unlink(originalFilePath)
      await fs.unlink(compressedFilePath)
      await fs.rmdir(tempDir)
      
      console.log(`🧹 Cleaned up temporary files`)

      // Send success event
      if (!isClosed()) {
        sendEvent({
          type: 'success',
          audioUrl: publicUrl,
          duration: duration,
          fileName: fileName,
          originalFileName: audioFile.name,
          filePath: filePath,
          message: 'Audio uploaded and compressed successfully',
          progress: 100
        }, 'success')
      }

    } catch (error: any) {
      console.error(`❌ Error processing audio:`, error)
      
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError)
      }

      throw error
    }

  } catch (error: any) {
    console.error(`❌ Error in upload-audio route:`, error)
    throw error
  } finally {
    // Only close if not already closed
    if (!isClosed()) {
      close()
    }
  }
}

// Keep the original function for non-SSE requests
async function handleRegularUpload(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const userId = formData.get('userId') as string

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`🎵 Starting audio upload for user: ${userId}`)
    console.log(`📁 File: ${audioFile.name}, Size: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB`)

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), 'audio-upload', Date.now().toString())
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Save uploaded file to temp directory
      const originalFilePath = path.join(tempDir, `original_${audioFile.name}`)
      const audioArrayBuffer = await audioFile.arrayBuffer()
      await fs.writeFile(originalFilePath, new Uint8Array(audioArrayBuffer))
      
      console.log(`📁 Saved original file: ${originalFilePath}`)

      // Get duration using ffprobe
      console.log(`⏱️ Getting audio duration with ffprobe`)
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${originalFilePath}"`)
      const duration = parseFloat(stdout.trim())
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Invalid audio duration: ${stdout.trim()}`)
      }
      
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`)

      // Check original file size
      const originalStats = await fs.stat(originalFilePath)
      const originalSizeMB = originalStats.size / (1024 * 1024)
      console.log(`📊 Original file size: ${originalSizeMB.toFixed(2)}MB`)

      // Calculate maximum bitrate we can afford to target 23-24MB (safety buffer)
      // Formula: File Size (MB) = (Bitrate in kbps * Duration in seconds) / (8 * 1024)
      // Target: 23MB for safety, so Bitrate = (23 * 8 * 1024) / Duration
      const targetSizeMB = 23 // Target 23MB for 2MB safety buffer
      const maxAffordableBitrate = Math.floor((targetSizeMB * 8 * 1024) / duration)
      
      // Set quality limits for Opus (6k minimum for intelligibility, 128k maximum for efficiency)
      // Opus can handle much higher bitrates efficiently compared to MP3
      let targetBitrate = Math.max(6, Math.min(128, maxAffordableBitrate))
      
      // If we can afford high quality, use it! No artificial restrictions
      if (maxAffordableBitrate >= 64) {
        targetBitrate = Math.min(128, maxAffordableBitrate) // Excellent quality
      } else if (maxAffordableBitrate >= 32) {
        targetBitrate = Math.min(64, maxAffordableBitrate) // Very good quality
      } else if (maxAffordableBitrate >= 16) {
        targetBitrate = Math.min(32, maxAffordableBitrate) // Good quality
      } else if (maxAffordableBitrate >= 12) {
        targetBitrate = Math.min(16, maxAffordableBitrate) // Decent quality
      } else {
        targetBitrate = Math.max(6, maxAffordableBitrate) // Minimum quality
      }
      
      // Estimate final file size
      const estimatedSizeMB = (targetBitrate * duration) / (8 * 1024)
      console.log(`🎯 Target Opus bitrate: ${targetBitrate}k (max affordable: ${maxAffordableBitrate}k)`)
      console.log(`📊 Estimated final size: ${estimatedSizeMB.toFixed(1)}MB (targeting ${targetSizeMB}MB)`)

      // Compress audio using Opus codec optimized for speech/VoIP
      const compressedFileName = `compressed_${Date.now()}_${audioFile.name.replace(/\.[^/.]+$/, '.webm')}`
      const compressedFilePath = path.join(tempDir, compressedFileName)
      
      console.log(`🗜️ Compressing audio with Opus codec at ${targetBitrate}k bitrate (maximizing quality)`)
      const compressionCommand = `ffmpeg -i "${originalFilePath}" -vn -map_metadata -1 -ac 1 -c:a libopus -b:a ${targetBitrate}k -application voip "${compressedFilePath}"`
      
      await execAsync(compressionCommand)
      
      // Check compressed file size
      const compressedStats = await fs.stat(compressedFilePath)
      const compressedSizeMB = compressedStats.size / (1024 * 1024)
      console.log(`✅ Audio compressed with Opus: ${compressedFilePath}`)
      console.log(`📊 Final compressed size: ${compressedSizeMB.toFixed(2)}MB (${((1 - compressedSizeMB/originalSizeMB) * 100).toFixed(1)}% reduction)`)
      console.log(`🎯 Target achieved: ${compressedSizeMB <= 24 ? '✅' : '⚠️'} (${compressedSizeMB.toFixed(1)}MB / 24MB limit)`)
      
      if (compressedSizeMB > 25) {
        console.warn(`⚠️ Compressed file exceeds 25MB - this should be very rare with our calculations!`)
      } else if (compressedSizeMB > 24) {
        console.warn(`⚠️ Compressed file is close to limit (${compressedSizeMB.toFixed(1)}MB) but should be fine`)
      }

      // Upload compressed audio to Supabase storage
      const supabase = await createClient()
      const compressedAudioData = await fs.readFile(compressedFilePath)
      
      const fileName = `${Date.now()}_${compressedFileName}`
      const filePath = `${userId}/audio/${fileName}`

      console.log(`☁️ Uploading to Supabase: ${filePath}`)
      
      const { data, error } = await supabase.storage
        .from('video-generator')
        .upload(filePath, compressedAudioData, {
          contentType: 'audio/webm',
          upsert: false
        })

      if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Failed to upload audio: ${error.message}`)
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl
      
      console.log(`✅ Audio uploaded successfully: ${publicUrl}`)

      // Cleanup temp files
      await fs.unlink(originalFilePath)
      await fs.unlink(compressedFilePath)
      await fs.rmdir(tempDir)
      
      console.log(`🧹 Cleaned up temporary files`)

      return NextResponse.json({
        success: true,
        audioUrl: publicUrl,
        duration: duration,
        fileName: fileName,
        originalFileName: audioFile.name,
        filePath: filePath,
        message: 'Audio uploaded and compressed successfully'
      })

    } catch (error: any) {
      console.error(`❌ Error processing audio:`, error)
      
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError)
      }

      return NextResponse.json(
        { error: `Failed to process audio: ${error.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error(`❌ Error in upload-audio route:`, error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}