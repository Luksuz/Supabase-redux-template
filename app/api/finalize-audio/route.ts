"use server";

import { NextRequest, NextResponse } from 'next/server';
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToSupabase } from "@/lib/wellsaid-utils";

// Helper Functions
async function ensureDir(dirPath: string) {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
    console.log(`⬇️ Downloading ${url} to ${destPath}`);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fsp.writeFile(destPath, Buffer.from(arrayBuffer));
    console.log(`✅ Download complete: ${destPath}`);
}

async function joinAudioChunks(
  chunkFilePaths: string[],
  finalOutputFileName: string,
  baseOutputDir: string
): Promise<string> {
  if (!chunkFilePaths || chunkFilePaths.length === 0) {
    throw new Error("No audio chunk file paths provided for joining.");
  }
  if (chunkFilePaths.length === 1) {
    const finalPath = path.join(baseOutputDir, finalOutputFileName);
    console.log(`📦 Only one chunk, moving ${chunkFilePaths[0]} to ${finalPath}`);
    try {
      await ensureDir(baseOutputDir);
      await fsp.rename(chunkFilePaths[0], finalPath);
      return finalPath;
    } catch (renameError) {
      console.error(`❌ Error moving single chunk file: ${renameError}`);
      throw renameError;
    }
  }

  console.log(`🎬 Joining ${chunkFilePaths.length} audio chunks into ${finalOutputFileName}...`);
  await ensureDir(baseOutputDir);
  const finalOutputPath = path.join(baseOutputDir, finalOutputFileName);
  const listFileName = `ffmpeg-list-${uuidv4()}.txt`;
  const tempDirForList = path.dirname(chunkFilePaths[0]); 
  const listFilePath = path.join(tempDirForList, listFileName);

  const fileListContent = chunkFilePaths
    .map(filePath => `file '${path.resolve(filePath).replace(/\\/g, '/')}'`)
    .join('\n');

  try {
    await fsp.writeFile(listFilePath, fileListContent);
    console.log(`📄 Created ffmpeg file list: ${listFilePath}`);
  } catch (writeError) {
    console.error(`❌ Error writing ffmpeg list file: ${writeError}`);
    throw writeError;
  }

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFilePath,
      '-c', 'copy',
      '-y',
      finalOutputPath
    ];

    console.log(`🚀 Running ffmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let ffmpegOutput = '';
    ffmpegProcess.stdout.on('data', (data) => { ffmpegOutput += data.toString(); });
    ffmpegProcess.stderr.on('data', (data) => { ffmpegOutput += data.toString(); });

    ffmpegProcess.on('close', async (code) => {
      console.log(`ffmpeg process exited with code ${code}`);
      
      try {
        await fsp.rm(listFilePath);
        console.log(`🧹 Cleaned up ffmpeg list file: ${listFilePath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not clean up ffmpeg list file ${listFilePath}:`, cleanupError);
      }

      if (code === 0) {
        console.log(`✅ Audio chunks successfully joined into ${finalOutputPath}`);
        resolve(finalOutputPath);
      } else {
        console.error(`❌ ffmpeg failed with code ${code}. Output:\n${ffmpegOutput}`);
        reject(new Error(`ffmpeg failed to join audio chunks. Code: ${code}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('❌ Failed to start ffmpeg process:', err);
      reject(err);
    });
  });
}

async function createCompressedAudio(originalAudioPath: string, outputDir: string): Promise<string> {
  const compressedFileName = `compressed-${path.basename(originalAudioPath)}`;
  const compressedFilePath = path.join(outputDir, compressedFileName);
  
  try {
    console.log(`🗜️ Creating compressed audio: ${originalAudioPath} -> ${compressedFilePath}`);
    const ffmpegCommand = `ffmpeg -i "${originalAudioPath}" -ar 16000 -ac 1 -b:a 32k -f mp3 "${compressedFilePath}"`;
    
    await new Promise<void>((resolve, reject) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ FFmpeg compression error: ${stderr}`);
          reject(new Error(`FFmpeg compression failed: ${stderr}`));
          return;
        }
        console.log(`✅ Audio compressed successfully: ${compressedFilePath}`);
        resolve();
      });
    });
    
    return compressedFilePath;
  } catch (error: any) {
    console.error(`❌ Error compressing audio: ${error.message}`);
    throw error;
  }
}

async function generateSubtitlesFromAudio(audioUrl: string, userId: string, origin: string): Promise<string> {
  console.log(`🔤 Generating subtitles for audio: ${audioUrl}`);
  try {
    const resolvedOrigin = "https://welcome-exact-satyr.ngrok-free.app"
    console.log("resolvedOrigin", resolvedOrigin)
    const apiUrl = new URL('/api/generate-subtitles', resolvedOrigin).toString();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: audioUrl, userId: userId })
    });
    console.log("response", response)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Subtitle generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.subtitlesUrl) {
      throw new Error('Subtitle generation failed: No subtitles URL returned');
    }

    console.log(`✅ Subtitles generated successfully: ${data.subtitlesUrl}`);
    return data.subtitlesUrl;
  } catch (error: any) {
    console.error('❌ Error generating subtitles:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
    const { chunkUrls, userId = "unknown_user", provider, voice, elevenLabsVoiceId, fishAudioVoiceId, googleTtsVoiceName, generateSubtitles = false } = await request.json();

    console.log("*************************************************")
    console.log(`🎵 Finalize Audio Request:`, {
        provider,
        chunkUrlsCount: chunkUrls?.length || 0,
        chunkUrls: chunkUrls?.slice(0, 3)?.concat(chunkUrls?.length > 3 ? ['...'] : []) || [],
        voice,
        elevenLabsVoiceId,
        fishAudioVoiceId,
        googleTtsVoiceName,
        generateSubtitles
    });
    console.log("*************************************************")
    
    if (!chunkUrls || !Array.isArray(chunkUrls) || chunkUrls.length === 0) {
        console.error(`❌ Empty or invalid chunkUrls for provider ${provider}:`, {
            chunkUrls,
            type: typeof chunkUrls,
            isArray: Array.isArray(chunkUrls),
            length: chunkUrls?.length
        });
        return NextResponse.json({ 
            error: `chunkUrls is required and must be a non-empty array. Received ${chunkUrls?.length || 0} chunks for provider ${provider}` 
        }, { status: 400 });
    }

    const tempDir = path.join(process.cwd(), 'temp-audio-finalizing', `req-${uuidv4()}`);
    
    try {
        await ensureDir(tempDir);
        console.log(`📂 Created temp directory: ${tempDir}`);

        // 1. Download all chunks
        console.log(`Downloading ${chunkUrls.length} chunks...`);
        const downloadedChunkPaths = await Promise.all(
            chunkUrls.map(async (url, index) => {
                const localPath = path.join(tempDir, `chunk-${index}.mp3`);
                await downloadFile(url, localPath);
                return localPath;
            })
        );
        console.log("✅ All chunks downloaded.");

        // 2. Join chunks to temporary file
        const voiceName = (googleTtsVoiceName || elevenLabsVoiceId || fishAudioVoiceId || voice || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_');
        const tempJoinedFileName = `${provider}-${voiceName}-${uuidv4()}-temp.mp3`;
        const tempJoinedAudioPath = await joinAudioChunks(downloadedChunkPaths, tempJoinedFileName, tempDir);

        // 3. Upload original concatenated audio (for video generation)
        console.log(`☁️ Uploading original audio for video generation...`);
        const originalSupabasePath = `user_${userId}/audio/original/${path.basename(tempJoinedAudioPath)}`;
        const originalAudioSupabaseUrl = await uploadFileToSupabase(tempJoinedAudioPath, originalSupabasePath, 'audio/mpeg');
        
        if (!originalAudioSupabaseUrl) {
            throw new Error("Failed to upload original audio to Supabase Storage.");
        }
        
        console.log(`☁️ Original audio uploaded: ${originalAudioSupabaseUrl}`);
        
        // 4. Create compressed audio (for subtitles only)
        console.log(`🗜️ Creating compressed audio for subtitles...`);
        const compressedAudioPath = await createCompressedAudio(tempJoinedAudioPath, tempDir);
        
        // 5. Get audio duration using ffprobe (from original audio)
        console.log(`⏱️ Getting audio duration from original audio...`);
        let duration: number | null = null;
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${tempJoinedAudioPath}"`);
            duration = parseFloat(stdout.trim());
            
            if (isNaN(duration) || duration <= 0) {
                console.warn(`⚠️ Invalid duration detected: ${stdout.trim()}, will use null`);
                duration = null;
            } else {
                console.log(`✅ Audio duration: ${duration.toFixed(2)} seconds`);
            }
        } catch (durationError) {
            console.warn(`⚠️ Could not get audio duration:`, durationError);
            duration = null;
        }
        
        // 6. Upload compressed audio (for subtitles)
        const compressedSupabasePath = `user_${userId}/audio/compressed/${path.basename(compressedAudioPath)}`;
        const compressedAudioSupabaseUrl = await uploadFileToSupabase(compressedAudioPath, compressedSupabasePath, 'audio/mpeg');
        
        if (!compressedAudioSupabaseUrl) {
            throw new Error("Failed to upload compressed audio to Supabase Storage.");
        }
        
        console.log(`☁️ Compressed audio uploaded: ${compressedAudioSupabaseUrl}`);
        
        // 7. Generate subtitles using compressed audio (if requested)
        let subtitlesUrl: string | null = null;
        if (generateSubtitles) {
            console.log(`🔤 Generating subtitles using compressed audio...`);
            try {
                const origin = request.nextUrl?.origin;
                subtitlesUrl = await generateSubtitlesFromAudio(compressedAudioSupabaseUrl, userId, origin);
            } catch(subtitleError) {
                console.warn(`⚠️ Could not generate subtitles.`, subtitleError)
            }
        } else {
            console.log(`⏭️ Skipping subtitle generation (not requested)`);
        }
        
        // 8. Return original audio as main audio_url, compressed for subtitles
        return NextResponse.json({
            success: true,
            audioUrl: originalAudioSupabaseUrl, // Original audio for video generation
            compressedAudioUrl: compressedAudioSupabaseUrl, // Compressed audio for subtitles
            duration: duration, // Duration from original audio
            subtitlesUrl: subtitlesUrl,
            subtitlesGenerated: !!subtitlesUrl
        });

    } catch (error: any) {
        console.error("❌ Error finalizing audio:", error);
        return NextResponse.json({ error: "Failed to finalize audio: " + error.message }, { status: 500 });
    } finally {
        // Cleanup temp dir
        try {
            if (fs.existsSync(tempDir)) {
                await fsp.rm(tempDir, { recursive: true, force: true });
                console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
            }
        } catch (e) {
            console.warn(`⚠️ Failed to cleanup temp directory ${tempDir}:`, e);
        }
    }
} 