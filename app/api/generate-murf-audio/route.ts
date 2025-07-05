import { NextRequest, NextResponse } from 'next/server'
import { generateMurfAudio, isMurfConfigured } from '@/lib/murf-utils'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { uploadFileToSupabase } from '@/lib/upload-file'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, chunkIndex, userId = 'unknown_user', sessionId, generateSubtitles } = await request.json()

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

    if (!isMurfConfigured()) {
      return NextResponse.json(
        { error: 'Murf.ai API key not configured. Please set MURF_API_KEY in your environment variables.' },
        { status: 500 }
      )
    }

    console.log(`🎵 Starting Murf.ai audio generation for chunk ${chunkIndex}`)
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎤 Voice ID: ${voiceId}`)

    // Create session-specific temp directory
    const tempDir = path.join(os.tmpdir(), 'murf-audio', sessionId)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Generate audio using Murf.ai
      console.log(`🎵 Calling Murf.ai API for text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`)
      
      const murfResponse = await generateMurfAudio(text, voiceId)
      
      if (!murfResponse.audioFile) {
        throw new Error('No audio file URL received from Murf.ai')
      }

      console.log(`✅ Murf.ai audio generated: ${murfResponse.audioFile}`)

      // Download the audio file from Murf.ai
      const audioResponse = await fetch(murfResponse.audioFile)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio from Murf.ai: ${audioResponse.status}`)
      }

      // Save the audio file locally
      const audioFileName = `murf-chunk-${chunkIndex}-${Date.now()}.wav`
      const audioFilePath = path.join(tempDir, audioFileName)
      
      const audioBuffer = await audioResponse.arrayBuffer()
      await fs.writeFile(audioFilePath, Buffer.from(audioBuffer))

      console.log(`💾 Original audio saved locally: ${audioFilePath}`)
      
      // Get duration from original local file
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFilePath}"`)
      const duration = parseFloat(stdout.trim())
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Invalid duration detected from local file.`)
      }
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`)

      // Upload original audio to Supabase
      const originalSupabasePath = `voiceover/original/murf-chunk-${chunkIndex}-${Date.now()}.wav`;
      const originalPublicUrl = await uploadFileToSupabase(audioFilePath, originalSupabasePath, 'audio/wav');
      if (!originalPublicUrl) {
        throw new Error('Failed to upload original audio to Supabase.');
      }
      console.log(`☁️ Uploaded original audio to Supabase: ${originalPublicUrl}`);

      let compressedPublicUrl: string | null = null;

      if (generateSubtitles) {
        // Convert to MP3 and compress for subtitles
        const compressedFileName = `murf-chunk-${chunkIndex}-compressed-${Date.now()}.mp3`
        const compressedFilePath = path.join(tempDir, compressedFileName)
        
        console.log(`🗜️ Compressing audio for subtitles: ${audioFilePath} -> ${compressedFilePath}`)
        const compressionCommand = `ffmpeg -i "${audioFilePath}" -b:a 48k -ar 24000 -ac 1 -y "${compressedFilePath}"`
        await execAsync(compressionCommand)

        // Upload compressed audio to Supabase
        const compressedSupabasePath = `voiceover/compressed/murf-chunk-${chunkIndex}-${Date.now()}.mp3`;
        compressedPublicUrl = await uploadFileToSupabase(compressedFilePath, compressedSupabasePath, 'audio/mpeg');
        if (!compressedPublicUrl) {
          console.warn('⚠️ Failed to upload compressed audio for subtitles. Proceeding without it.');
        } else {
          console.log(`☁️ Uploaded compressed audio to Supabase: ${compressedPublicUrl}`);
        }
        
        // Clean up local compressed file
        await fs.unlink(compressedFilePath);
      }
      
      // Clean up original local file
      await fs.unlink(audioFilePath)

      console.log(`🎉 Murf.ai audio generation completed successfully!`)

      return NextResponse.json({
        success: true,
        chunkIndex: chunkIndex,
        audioUrl: originalPublicUrl,
        compressedAudioUrl: compressedPublicUrl,
        duration: duration,
        text: text,
        message: `Murf.ai audio chunk ${chunkIndex} processed and uploaded.`
      })

    } catch (error: any) {
      console.error(`❌ Error generating Murf.ai audio chunk:`, error)
      
      return NextResponse.json(
        { 
          error: `Failed to generate Murf.ai audio chunk: ${error.message}`,
          retryable: false,
          chunkIndex: chunkIndex
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in Murf.ai audio chunk generation:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error during Murf.ai audio generation',
        retryable: false
      },
      { status: 500 }
    )
  }
} 