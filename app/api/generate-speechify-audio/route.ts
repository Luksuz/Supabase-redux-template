import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechifyAudio, isSpeechifyConfigured } from '@/lib/speechify-utils';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { uploadFileToSupabase } from '@/lib/upload-file';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    const { text, voiceId, chunkIndex, userId = 'unknown_user', sessionId, generateSubtitles } = await request.json();

    // Enhanced validation
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required for audio generation' },
        { status: 400 }
      );
    }

    if (!voiceId || voiceId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Voice ID is required for Speechify audio generation' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required for chunk management' },
        { status: 400 }
      );
    }

    if (chunkIndex === undefined || chunkIndex < 0) {
      return NextResponse.json(
        { error: 'Valid chunk index is required' },
        { status: 400 }
      );
    }

    if (!isSpeechifyConfigured()) {
      return NextResponse.json(
        { error: 'Speechify API key not configured. Please set SPEECHIFY_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    console.log(`🎵 Starting Speechify audio generation for chunk ${chunkIndex}`);
    console.log(`📝 Text length: ${text.length} characters`);
    console.log(`🎤 Voice ID: ${voiceId}`);

    // Create session-specific temp directory
    tempDir = path.join(os.tmpdir(), 'speechify-audio', sessionId);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Generate audio using Speechify with timeout
      console.log(`🎵 Calling Speechify API for text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      
      const speechifyResponse = await Promise.race([
        generateSpeechifyAudio(text, voiceId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Speechify API request timed out after 60 seconds')), 60000)
        )
      ]) as any;
      
      if (!speechifyResponse || !speechifyResponse.audioData) {
        throw new Error('No audio data received from Speechify');
      }

      console.log(`✅ Speechify audio generated (format: ${speechifyResponse.audioFormat})`);

      // Validate audio data
      if (typeof speechifyResponse.audioData !== 'string') {
        throw new Error('Invalid audio data format received from Speechify');
      }

      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(speechifyResponse.audioData, 'base64');
      } catch (base64Error) {
        throw new Error('Failed to decode base64 audio data from Speechify');
      }

      if (audioBuffer.length === 0) {
        throw new Error('Empty audio buffer received from Speechify');
      }

      const audioExtension = speechifyResponse.audioFormat || 'wav';
      const audioFileName = `speechify-chunk-${chunkIndex}-${Date.now()}.${audioExtension}`;
      const audioFilePath = path.join(tempDir, audioFileName);
      
      await fs.writeFile(audioFilePath, audioBuffer);
      console.log(`💾 Audio saved locally: ${audioFilePath} (${audioBuffer.length} bytes)`);
      
      // Get duration from audio file with error handling
      let duration: number;
      try {
        const { stdout } = await execAsync(`C:\\ffmpeg\\bin\\ffprobe.exe -v error -show_entries format=duration -of csv=p=0 "${audioFilePath}"`);
        duration = parseFloat(stdout.trim());
        if (isNaN(duration) || duration <= 0) {
          throw new Error(`Invalid duration: ${stdout.trim()}`);
        }
      } catch (ffprobeError: any) {
        console.error('FFprobe error:', ffprobeError);
        throw new Error(`Failed to get audio duration: ${ffprobeError.message}`);
      }
      
      console.log(`✅ Audio duration: ${duration.toFixed(2)}s`);

      // Upload original audio to Supabase
      const originalSupabasePath = `voiceover/original/speechify-chunk-${chunkIndex}-${Date.now()}.${audioExtension}`;
      const mimeType = audioExtension === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const originalPublicUrl = await uploadFileToSupabase(audioFilePath, originalSupabasePath, mimeType);
      if (!originalPublicUrl) {
        throw new Error('Failed to upload original audio to Supabase.');
      }
      console.log(`☁️ Uploaded original audio to Supabase: ${originalPublicUrl}`);

      let compressedPublicUrl: string | null = null;
      if (generateSubtitles) {
        // Compress the audio for subtitles
        const compressedFilePath = path.join(tempDir, `speechify-chunk-${chunkIndex}-compressed-${Date.now()}.mp3`);
        console.log(`🗜️ Compressing audio for subtitles: ${audioFilePath} -> ${compressedFilePath}`);
        
        try {
          const compressionCommand = `ffmpeg -i "${audioFilePath}" -b:a 48k -ar 24000 -ac 1 -y "${compressedFilePath}"`;
          await execAsync(compressionCommand);

          // Upload compressed audio
          const compressedSupabasePath = `voiceover/compressed/speechify-chunk-${chunkIndex}-${Date.now()}.mp3`;
          compressedPublicUrl = await uploadFileToSupabase(compressedFilePath, compressedSupabasePath, 'audio/mpeg');
          
          // Clean up local compressed file
          await fs.unlink(compressedFilePath);
        } catch (compressionError: any) {
          console.warn('Failed to compress audio for subtitles:', compressionError.message);
          // Continue without compressed audio - not critical
        }
      }

      // Clean up local original file
      await fs.unlink(audioFilePath);

      return NextResponse.json({
        success: true,
        audioUrl: originalPublicUrl,
        duration,
        chunkIndex,
        compressedAudioUrl: compressedPublicUrl,
        billable_characters: speechifyResponse.billableCharactersCount
      });

    } catch (error: any) {
      console.error(`❌ Error in Speechify audio generation for chunk ${chunkIndex}:`, error);
      
      // Clean up temp directory on error
      if (tempDir) {
        try {
          const files = await fs.readdir(tempDir);
          for (const file of files) {
            await fs.unlink(path.join(tempDir, file));
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up temp files:', cleanupError);
        }
      }
      
      throw error;
    }

  } catch (error: any) {
    console.error('Error in Speechify audio generation route:', error);
    
    // Provide more user-friendly error messages
    let errorMessage = error.message || 'An unknown error occurred during audio generation';
    
    if (errorMessage.includes('API key')) {
      errorMessage = 'Speechify API configuration issue. Please check your API key.';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'Speechify API request timed out. Please try again with shorter text.';
    } else if (errorMessage.includes('rate limit')) {
      errorMessage = 'Speechify API rate limit exceeded. Please try again later.';
    }
    
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 });
  }
} 