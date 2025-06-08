import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

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

      // Upload video to Supabase storage
      const supabase = await createClient()
      const videoData = await fs.readFile(tempFilePath)
      
      const fileName = `${Date.now()}_${videoFile.name}`
      const filePath = `${userId}/videos/${fileName}`

      console.log(`☁️ Uploading to Supabase: ${filePath}`)
      
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

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl
      
      console.log(`✅ Video uploaded successfully: ${publicUrl}`)

      // Cleanup temp files
      await fs.unlink(tempFilePath)
      await fs.rmdir(tempDir)
      
      console.log(`🧹 Cleaned up temporary files`)

      return NextResponse.json({
        success: true,
        videoUrl: publicUrl,
        fileName: fileName,
        originalFileName: videoFile.name,
        filePath: filePath,
        fileSize: videoFile.size,
        message: 'Video uploaded successfully'
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