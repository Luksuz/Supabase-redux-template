import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { uploadFileToSupabase } from '@/lib/upload-file';

const execAsync = promisify(exec);

interface JoinAudioRequest {
  chunkUrls: Array<{
    chunkIndex: number
    audioUrl: string
    duration: number
  }>
  sessionId: string
  userId: string
  generateSubtitles: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { chunkUrls, sessionId, userId, generateSubtitles } = await request.json() as JoinAudioRequest;

    if (!chunkUrls || chunkUrls.length === 0) {
      return NextResponse.json(
        { error: 'No audio chunks provided' },
        { status: 400 }
      );
    }

    console.log(`🔗 Starting audio joining for ${chunkUrls.length} chunks`);

    // Create session-specific temp directory
    const tempDir = path.join(os.tmpdir(), 'audio-joining', sessionId);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Sort chunks by index to ensure correct order
      const sortedChunks = chunkUrls.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      // Download all audio chunks to local temp files
      const downloadedChunks: Array<{ filePath: string; duration: number }> = [];
      
      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i];
        console.log(`⬇️ Downloading chunk ${chunk.chunkIndex}: ${chunk.audioUrl}`);
        
        const response = await fetch(chunk.audioUrl);
        if (!response.ok) {
          throw new Error(`Failed to download chunk ${chunk.chunkIndex}: ${response.statusText}`);
        }
        
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const chunkFilePath = path.join(tempDir, `chunk-${chunk.chunkIndex.toString().padStart(3, '0')}.wav`);
        await fs.writeFile(chunkFilePath, audioBuffer);
        
        downloadedChunks.push({
          filePath: chunkFilePath,
          duration: chunk.duration
        });
        
        console.log(`✅ Downloaded chunk ${chunk.chunkIndex} (${chunk.duration.toFixed(2)}s)`);
      }

      // Create ffmpeg input list file
      const inputListPath = path.join(tempDir, 'input-list.txt');
      const inputListContent = downloadedChunks
        .map(chunk => `file '${chunk.filePath}'`)
        .join('\n');
      await fs.writeFile(inputListPath, inputListContent);
      
      console.log(`📝 Created input list with ${downloadedChunks.length} files`);

      // Calculate total duration
      const totalDuration = downloadedChunks.reduce((sum, chunk) => sum + chunk.duration, 0);
      console.log(`⏱️ Total duration: ${totalDuration.toFixed(2)}s`);

      // Join audio chunks using ffmpeg
      const joinedFileName = `joined-audio-${Date.now()}.wav`;
      const joinedFilePath = path.join(tempDir, joinedFileName);
      
      console.log(`🔗 Joining audio chunks with ffmpeg...`);
      const joinCommand = `ffmpeg -f concat -safe 0 -i "${inputListPath}" -c copy "${joinedFilePath}"`;
      await execAsync(joinCommand);
      
      console.log(`✅ Audio chunks joined successfully`);

      // Verify joined audio duration
      const { stdout: durationOutput } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${joinedFilePath}"`);
      const actualDuration = parseFloat(durationOutput.trim());
      
      if (Math.abs(actualDuration - totalDuration) > 1.0) {
        console.warn(`⚠️ Duration mismatch: expected ${totalDuration.toFixed(2)}s, got ${actualDuration.toFixed(2)}s`);
      }

      // Upload original joined audio to Supabase
      const originalSupabasePath = `voiceover/joined/original-${Date.now()}.wav`;
      const originalPublicUrl = await uploadFileToSupabase(joinedFilePath, originalSupabasePath, 'audio/wav');
      if (!originalPublicUrl) {
        throw new Error('Failed to upload joined audio to Supabase.');
      }
      console.log(`☁️ Uploaded original joined audio: ${originalPublicUrl}`);

      let compressedPublicUrl: string | null = null;
      
      if (generateSubtitles) {
        // Create compressed version for subtitles
        const compressedFileName = `compressed-audio-${Date.now()}.mp3`;
        const compressedFilePath = path.join(tempDir, compressedFileName);
        
        console.log(`🗜️ Creating compressed version for subtitles...`);
        const compressionCommand = `ffmpeg -i "${joinedFilePath}" -b:a 48k -ar 24000 -ac 1 -y "${compressedFilePath}"`;
        await execAsync(compressionCommand);
        
        // Upload compressed audio
        const compressedSupabasePath = `voiceover/joined/compressed-${Date.now()}.mp3`;
        compressedPublicUrl = await uploadFileToSupabase(compressedFilePath, compressedSupabasePath, 'audio/mpeg');
        if (!compressedPublicUrl) {
          throw new Error('Failed to upload compressed audio to Supabase.');
        }
        console.log(`☁️ Uploaded compressed audio: ${compressedPublicUrl}`);
        
        // Clean up compressed file
        await fs.unlink(compressedFilePath);
      }

      // Clean up all temporary files
      for (const chunk of downloadedChunks) {
        await fs.unlink(chunk.filePath);
      }
      await fs.unlink(joinedFilePath);
      await fs.unlink(inputListPath);
      
      // Remove temp directory if empty
      try {
        await fs.rmdir(tempDir);
      } catch (error) {
        console.warn('Could not remove temp directory:', error);
      }

      return NextResponse.json({
        success: true,
        audioUrl: originalPublicUrl,
        compressedAudioUrl: compressedPublicUrl,
        duration: actualDuration,
        totalChunks: sortedChunks.length
      });

    } catch (error: any) {
      console.error(`❌ Error joining audio chunks:`, error);
      throw error;
    }

  } catch (error: any) {
    console.error('Error in audio joining route:', error);
    return NextResponse.json({ 
      error: error.message || 'An unknown error occurred during audio joining' 
    }, { status: 500 });
  }
} 