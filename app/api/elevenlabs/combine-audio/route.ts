import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  let tempDir: string | null = null
  const tempFiles: string[] = []

  try {
    const { audioUrls, projectName, projectId, sessionTitles } = await request.json()

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Audio URLs array is required'
      }, { status: 400 })
    }

    if (audioUrls.length === 1) {
      return NextResponse.json({
        success: false,
        error: 'At least 2 audio files are required for combination'
      }, { status: 400 })
    }

    console.log(`🎵 Combining ${audioUrls.length} audio files${projectName ? ` for project: ${projectName}` : ''}`)

    // Create temporary directory for processing
    tempDir = await mkdtemp(join(tmpdir(), 'audio-combine-'))
    console.log(`📁 Created temp directory: ${tempDir}`)

    // Download all audio files to temporary directory
    const inputFiles: string[] = []
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i]
      const fileName = `input_${i.toString().padStart(3, '0')}.mp3`
      const filePath = join(tempDir, fileName)
      
      console.log(`📥 Downloading audio file ${i + 1}/${audioUrls.length}: ${url}`)
      
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download audio from ${url}: ${response.status}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        await writeFile(filePath, buffer)
        inputFiles.push(filePath)
        tempFiles.push(filePath)
        
        console.log(`✅ Downloaded audio file ${i + 1}, size: ${Math.round(buffer.length / 1024)}KB`)
      } catch (error) {
        console.error(`❌ Failed to download audio file ${i + 1}:`, error)
        throw new Error(`Failed to download audio file ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Create FFmpeg concat file
    const concatFilePath = join(tempDir, 'concat_list.txt')
    const concatContent = inputFiles.map(file => `file '${file}'`).join('\n')
    await writeFile(concatFilePath, concatContent)
    tempFiles.push(concatFilePath)

    // Output file path
    const outputFileName = `${projectName?.replace(/[^a-zA-Z0-9]/g, '_') || 'combined_sessions'}_audio.mp3`
    const outputFilePath = join(tempDir, outputFileName)
    tempFiles.push(outputFilePath)

    console.log(`🔄 Combining ${inputFiles.length} audio files using FFmpeg...`)

    // Use FFmpeg to concatenate audio files
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputFilePath}"`
    
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

    // Read the combined audio file
    const fs = require('fs').promises
    const combinedBuffer = await fs.readFile(outputFilePath)
    const combinedSize = combinedBuffer.length

    console.log(`✅ Combined audio size: ${Math.round(combinedSize / 1024)}KB`)

    // Convert to base64 data URL for download
    const base64Audio = combinedBuffer.toString('base64')
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`

    // In production, you might want to upload to Supabase storage instead:
    /*
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const fileName = `combined-audio/${projectId}/${outputFileName}`
    const { data, error } = await supabase.storage
      .from('audio-files')
      .upload(fileName, combinedBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })
    
    if (error) throw error
    
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName)
    */

    return NextResponse.json({
      success: true,
      audioUrl: dataUrl,
      audioSize: combinedSize,
      filesProcessed: audioUrls.length,
      projectName,
      projectId,
      method: 'ffmpeg-concat'
    })

  } catch (error) {
    console.error('Audio combination error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to combine audio files'
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