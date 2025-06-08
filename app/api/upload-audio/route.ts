import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
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