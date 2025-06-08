import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

// Shotstack API settings from environment variables
const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || 'ovtvkcufDaBDRJnsTLHkMB3eLG6ytwlRoUAPAHPq';
const SHOTSTACK_ENDPOINT = process.env.SHOTSTACK_ENDPOINT || 'https://api.shotstack.io/edit/stage';

// Function to sanitize filename for Supabase storage
function sanitizeFilename(filename: string): string {
  // Extract file extension
  const ext = path.extname(filename)
  const nameWithoutExt = path.basename(filename, ext)
  
  // Replace invalid characters with underscores and remove non-ASCII characters
  const sanitized = nameWithoutExt
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
  
  return `${sanitized}${ext}`
}

// Function to get video duration using ffprobe
async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ])

    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}`))
        return
      }

      try {
        const info = JSON.parse(output)
        const duration = parseFloat(info.format.duration)
        resolve(duration)
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`))
      }
    })

    ffprobe.on('error', (error) => {
      reject(new Error(`ffprobe error: ${error.message}`))
    })
  })
}

// Function to create looped video with Shotstack
async function createLoopedVideo(videoUrl: string, duration: number, loopCount: number = 20) {
  console.log(`🔄 Creating ${loopCount}x looped video from: ${videoUrl}`)
  
  // Create video clips for looping
  const videoClips = []
  for (let i = 0; i < loopCount; i++) {
    videoClips.push({
      asset: {
        type: "video",
        src: videoUrl
      },
      start: i * duration,
      length: duration,
      fit: "cover"
    })
  }

  const timeline = {
    background: "#000000",
    tracks: [{
      clips: videoClips
    }]
  }

  const output = {
    format: "mp4",
    size: {
      width: 1280,
      height: 720
    },
    fps: 25,
    quality: "low",
    aspectRatio: "16:9"
  }

  const edit = {
    timeline: timeline,
    output: output
  }

  console.log(`🎬 Sending looped video request to Shotstack...`)
  
  const response = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SHOTSTACK_API_KEY
    },
    body: JSON.stringify(edit)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shotstack API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  const renderId = data.response?.id

  if (!renderId) {
    throw new Error('No Shotstack render ID returned for looped video')
  }

  console.log(`✅ Shotstack render started for looped video with ID: ${renderId}`)
  return renderId
}

// Function to poll Shotstack for completion
async function pollShotstackCompletion(renderId: string, maxAttempts: number = 60, intervalMs: number = 10000) {
  console.log(`🔍 Polling Shotstack render ${renderId} for completion...`)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${SHOTSTACK_ENDPOINT}/render/${renderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SHOTSTACK_API_KEY
        }
      })

      if (!response.ok) {
        throw new Error(`Shotstack status check failed: ${response.status}`)
      }

      const data = await response.json()
      const status = data.response.status
      
      console.log(`📊 Attempt ${attempt}/${maxAttempts} - Shotstack status: ${status}`)

      if (status === "done" || status === "processed") {
        console.log(`✅ Shotstack render completed! URL: ${data.response.url}`)
        return {
          success: true,
          url: data.response.url,
          status: status
        }
      } else if (status === "failed") {
        console.log(`❌ Shotstack render failed: ${data.response.data?.message || 'Unknown error'}`)
        return {
          success: false,
          error: data.response.data?.message || 'Shotstack render failed',
          status: status
        }
      }

      // Still processing, wait before next attempt
      if (attempt < maxAttempts) {
        console.log(`⏳ Waiting ${intervalMs/1000}s before next status check...`)
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }

    } catch (error: any) {
      console.error(`Error checking Shotstack status (attempt ${attempt}):`, error)
      if (attempt === maxAttempts) {
        return {
          success: false,
          error: `Failed to check status after ${maxAttempts} attempts: ${error.message}`,
          status: 'unknown'
        }
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  return {
    success: false,
    error: `Shotstack render did not complete within ${maxAttempts} attempts (${(maxAttempts * intervalMs)/60000} minutes)`,
    status: 'timeout'
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const userId = formData.get('userId') as string

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`🎬 Starting video upload for user: ${userId}`)
    console.log(`📁 File: ${videoFile.name}, Size: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`)

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), 'video-upload', Date.now().toString())
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Save uploaded file to temp directory
      const tempFilePath = path.join(tempDir, videoFile.name)
      const videoArrayBuffer = await videoFile.arrayBuffer()
      await fs.writeFile(tempFilePath, new Uint8Array(videoArrayBuffer))
      
      console.log(`📁 Saved video file: ${tempFilePath}`)

      // Get video duration using ffprobe
      let videoDuration: number
      try {
        videoDuration = await getVideoDuration(tempFilePath)
        console.log(`⏱️ Video duration: ${videoDuration}s`)
      } catch (error: any) {
        console.error('Failed to get video duration:', error)
        videoDuration = 10 // Default fallback duration
      }

      // Upload original video to Supabase storage
      const supabase = await createClient()
      const videoData = await fs.readFile(tempFilePath)
      
      const sanitizedName = sanitizeFilename(videoFile.name)
      const fileName = `${Date.now()}_${sanitizedName}`
      const filePath = `${userId}/videos/${fileName}`

      console.log(`☁️ Uploading original video to Supabase: ${filePath}`)
      
      const { data, error } = await supabase.storage
        .from('video-generator')
        .upload(filePath, videoData, {
          contentType: videoFile.type || 'video/mp4',
          upsert: false
        })

      if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Failed to upload video: ${error.message}`)
      }

      // Get public URL for original video
      const { data: publicUrlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(filePath)

      const originalVideoUrl = publicUrlData.publicUrl
      
      console.log(`✅ Original video uploaded successfully: ${originalVideoUrl}`)

      // Create looped video with Shotstack
      let loopedVideoUrl: string | null = null
      let loopedVideoError: string | null = null

      try {
        console.log(`🔄 Creating 20x looped version with Shotstack...`)
        const loopRenderId = await createLoopedVideo(originalVideoUrl, videoDuration, 20)
        
        // Poll for completion (up to 10 minutes)
        const pollResult = await pollShotstackCompletion(loopRenderId, 60, 10000)
        
        if (pollResult.success) {
          loopedVideoUrl = pollResult.url
          console.log(`✅ Looped video created successfully: ${loopedVideoUrl}`)
        } else {
          loopedVideoError = pollResult.error
          console.error(`❌ Failed to create looped video: ${loopedVideoError}`)
        }
      } catch (error: any) {
        loopedVideoError = `Shotstack error: ${error.message}`
        console.error(`❌ Error creating looped video:`, error)
      }

      // Cleanup temp files
      await fs.unlink(tempFilePath)
      await fs.rmdir(tempDir)
      
      console.log(`🧹 Cleaned up temporary files`)

      return NextResponse.json({
        success: true,
        originalVideoUrl: originalVideoUrl,
        loopedVideoUrl: loopedVideoUrl,
        loopedVideoError: loopedVideoError,
        fileName: fileName,
        sanitizedFileName: sanitizedName,
        originalFileName: videoFile.name,
        filePath: filePath,
        fileSize: videoFile.size,
        videoDuration: videoDuration,
        message: loopedVideoUrl 
          ? 'Video uploaded and looped version created successfully'
          : 'Video uploaded successfully, but looped version failed to create'
      })

    } catch (error: any) {
      console.error(`❌ Error processing video:`, error)
      
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError)
      }

      return NextResponse.json(
        { error: `Failed to process video: ${error.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error(`❌ Error in upload-video route:`, error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
} 