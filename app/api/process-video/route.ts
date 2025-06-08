import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

interface ProcessVideoRequest {
  videoUrl: string
  audioUrl: string
  audioDuration: number
  subtitlesUrl?: string
  fontFamily?: string
  fontColor?: string
  fontSize?: number
  strokeWidth?: number
  quality: 'hd' | 'sd'
  userId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessVideoRequest = await request.json()
    const { videoUrl, audioUrl, audioDuration, subtitlesUrl, fontFamily = 'Arial', fontColor = '#ffffff', fontSize = 24, strokeWidth = 2, quality, userId } = body

    if (!videoUrl || !audioUrl || !audioDuration || !userId) {
      return NextResponse.json(
        { error: 'videoUrl, audioUrl, audioDuration, and userId are required' },
        { status: 400 }
      )
    }

    console.log(`🎬 Starting video metadata processing for user: ${userId}`)
    console.log(`📹 Video URL: ${videoUrl}`)
    console.log(`🎵 Audio URL: ${audioUrl}`)
    console.log(`⏱️ Target duration: ${audioDuration}s`)
    console.log(`🎨 Font: ${fontFamily}, Color: ${fontColor}, Size: ${fontSize}px, Stroke: ${strokeWidth}px`)
    console.log(`📺 Quality: ${quality}`)

    // Create temporary directory for getting video metadata
    const tempDir = path.join(os.tmpdir(), 'video-metadata', Date.now().toString())
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Download video file to get duration
      console.log(`📥 Downloading video to get metadata...`)
      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`)
      }
      
      const videoBuffer = await videoResponse.arrayBuffer()
      const videoFilePath = path.join(tempDir, 'input_video.mp4')
      await fs.writeFile(videoFilePath, new Uint8Array(videoBuffer))

      // Get video duration using ffprobe
      console.log(`⏱️ Getting video duration...`)
      const { stdout: videoDurationOutput } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoFilePath}"`)
      const videoDuration = parseFloat(videoDurationOutput.trim())
      
      if (isNaN(videoDuration) || videoDuration <= 0) {
        throw new Error(`Invalid video duration: ${videoDurationOutput.trim()}`)
      }
      
      console.log(`📹 Original video duration: ${videoDuration.toFixed(2)}s`)

      // Calculate how many loops we need (Shotstack will handle the actual looping)
      const loopCount = Math.ceil(audioDuration / videoDuration)
      console.log(`🔄 Video will need ${loopCount} loops to match audio duration (Shotstack will handle this)`)

      // Cleanup temp files
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log(`🧹 Cleaned up temporary files`)

      // Return metadata for Shotstack to use
      return NextResponse.json({
        success: true,
        videoUrl: videoUrl, // Original video URL for Shotstack
        audioUrl: audioUrl,
        subtitlesUrl: subtitlesUrl,
        originalVideoDuration: videoDuration,
        targetDuration: audioDuration,
        loopCount: loopCount,
        quality: quality,
        fontFamily: fontFamily,
        fontColor: fontColor,
        fontSize: fontSize,
        strokeWidth: strokeWidth,
        message: 'Video metadata processed successfully - ready for Shotstack rendering'
      })

    } catch (error: any) {
      console.error(`❌ Error processing video metadata:`, error)
      
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError)
      }

      return NextResponse.json(
        { error: `Failed to process video metadata: ${error.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error(`❌ Error in process-video route:`, error)
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
} 