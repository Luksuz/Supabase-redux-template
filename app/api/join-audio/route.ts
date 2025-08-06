import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createClient } from '../../../lib/supabase/server'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  let tempDir: string | null = null
  const tempFiles: string[] = []

  try {
    console.log('🎵 [JOIN-AUDIO] API endpoint called')
    console.log('🌍 [JOIN-AUDIO] Environment:', process.env.NODE_ENV)
    console.log('🔧 [JOIN-AUDIO] Platform:', process.platform)
    console.log('📁 [JOIN-AUDIO] Temp directory:', tmpdir())

    // Check FFmpeg availability first
    try {
      const { stdout } = await execAsync('ffmpeg -version')
      console.log('✅ [JOIN-AUDIO] FFmpeg is available:', stdout.split('\n')[0])
    } catch (ffmpegError) {
      console.error('❌ [JOIN-AUDIO] FFmpeg not found or not accessible:', ffmpegError)
      return NextResponse.json({
        success: false,
        error: 'FFmpeg is not installed or not accessible on this server. Please install FFmpeg to use audio joining functionality.',
        details: ffmpegError instanceof Error ? ffmpegError.message : 'Unknown FFmpeg error'
      }, { status: 500 })
    }

    // Get the user from the authenticated session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ [JOIN-AUDIO] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ [JOIN-AUDIO] User authenticated:', user.id)

    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error('❌ [JOIN-AUDIO] Failed to parse request body:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 })
    }

    const { audioUrls, projectName } = requestBody

    console.log('📦 [JOIN-AUDIO] Request details:', {
      audioUrlsCount: audioUrls?.length || 0,
      projectName,
      audioUrlTypes: audioUrls?.map((url: string) => 
        url.startsWith('data:') ? 'data' : 
        url.startsWith('blob:') ? 'blob' : 
        url.startsWith('http') ? 'http' : 'unknown'
      ) || []
    })

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      console.error('❌ [JOIN-AUDIO] Invalid audioUrls:', audioUrls)
      return NextResponse.json({
        success: false,
        error: 'Audio URLs array is required'
      }, { status: 400 })
    }

    if (audioUrls.length === 1) {
      console.log('ℹ️ [JOIN-AUDIO] Single audio file, returning as-is')
      // If only one file, just return it as-is
      return NextResponse.json({
        success: true,
        audioUrl: audioUrls[0],
        message: 'Single audio file returned'
      })
    }

    console.log(`🎵 [JOIN-AUDIO] Starting join process for ${audioUrls.length} audio files${projectName ? ` for project: ${projectName}` : ''}`)

    // Create temporary directory for processing
    tempDir = await mkdtemp(join(tmpdir(), 'audio-join-'))
    console.log(`📁 Created temp directory: ${tempDir}`)

    // Process all audio files to temporary directory
    const inputFiles: string[] = []
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i]
      
      // Skip blob URLs as they can't be fetched from server side
      if (url.startsWith('blob:')) {
        throw new Error(`Cannot process blob URL. Please provide direct storage URLs or data URLs.`)
      }
      
      const fileName = `input_${i.toString().padStart(3, '0')}.mp3`
      const filePath = join(tempDir, fileName)
      
      console.log(`📥 Processing audio file ${i + 1}/${audioUrls.length}`)
      
      try {
        let buffer: Buffer
        
        if (url.startsWith('data:')) {
          // Handle data URL (base64 encoded)
          console.log(`   Converting data URL to buffer...`)
          const base64Data = url.split(',')[1]
          buffer = Buffer.from(base64Data, 'base64')
        } else {
          // Handle regular URL - fetch from server
          console.log(`   Downloading from URL: ${url.substring(0, 100)}...`)
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AudioJoiner/1.0)'
            }
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const arrayBuffer = await response.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
        }
        
        await writeFile(filePath, buffer)
        inputFiles.push(filePath)
        tempFiles.push(filePath)
        
        console.log(`✅ Processed audio file ${i + 1}, size: ${Math.round(buffer.length / 1024)}KB`)
      } catch (error) {
        console.error(`❌ Failed to process audio file ${i + 1}:`, error)
        throw new Error(`Failed to process audio file ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Create FFmpeg concat file
    const concatFilePath = join(tempDir, 'concat_list.txt')
    const concatContent = inputFiles.map(file => `file '${file}'`).join('\n')
    await writeFile(concatFilePath, concatContent)
    tempFiles.push(concatFilePath)

    // Output file path
    const outputFileName = `${projectName?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'joined_audio'}_${Date.now()}.mp3`
    const outputFilePath = join(tempDir, outputFileName)
    tempFiles.push(outputFilePath)

    console.log(`🔄 Joining ${inputFiles.length} audio files using FFmpeg...`)

    // Use FFmpeg to concatenate audio files with re-encoding for compatibility
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c:a libmp3lame -b:a 128k "${outputFilePath}"`
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand)
      console.log(`✅ FFmpeg completed successfully`)
      if (stderr) {
        console.log(`FFmpeg stderr: ${stderr}`)
      }
    } catch (error) {
      console.error('FFmpeg error:', error)
      throw new Error(`FFmpeg failed: ${error instanceof Error ? error.message : 'Unknown FFmpeg error'}`)
    }

    // Read the joined audio file
    const fs = require('fs').promises
    const joinedBuffer = await fs.readFile(outputFilePath)
    const joinedSize = joinedBuffer.length

    console.log(`✅ Joined audio size: ${Math.round(joinedSize / 1024)}KB`)

    // Upload to Supabase storage with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const baseFileName = outputFileName.replace('.mp3', '')
    const storageFileName = `joined-audio/${user.id}/${baseFileName}_${timestamp}.mp3`
    console.log(`📤 Uploading to Supabase storage: ${storageFileName}`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio') // Using images bucket as requested
      .upload(storageFileName, joinedBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Failed to upload to storage: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(storageFileName)

    const publicUrl = urlData.publicUrl
    console.log(`✅ Audio uploaded successfully: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      audioSize: joinedSize,
      filesProcessed: audioUrls.length,
      projectName: projectName || 'Joined Audio',
      filename: outputFileName,
      method: 'ffmpeg-concat',
      storageFileName: storageFileName
    })

  } catch (error) {
    console.error('Audio joining error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to join audio files'
    }, { status: 500 })
  } finally {
    // Clean up temporary files
    if (tempFiles.length > 0) {
      console.log(`🧹 Cleaning up ${tempFiles.length} temporary files...`)
      for (const file of tempFiles) {
        try {
          await unlink(file)
        } catch (error) {
          console.warn(`Failed to delete temp file ${file}:`, error)
        }
      }
    }

    // Clean up temporary directory
    if (tempDir) {
      try {
        await execAsync(`rm -rf "${tempDir}"`)
        console.log(`🧹 Cleaned up temp directory: ${tempDir}`)
      } catch (error) {
        console.warn(`Failed to delete temp directory ${tempDir}:`, error)
      }
    }
  }
}