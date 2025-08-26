import { NextResponse } from "next/server";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import "dotenv/config";

const execAsync = promisify(exec);

export const runtime = 'nodejs';

// Audio concatenation using ffmpeg
async function concatenateAudioUrls(chunkUrls: string[]): Promise<string> {
  if (chunkUrls.length === 1) {
    return chunkUrls[0];
  }
  
  console.log(`🔗 Starting audio concatenation for ${chunkUrls.length} GenAI Pro chunks`);
  
  // Create temporary directory for processing
  const tempDir = path.join(os.tmpdir(), 'genaipro-concat', `session-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Convert base64 data URLs to temporary files
    const tempFiles: string[] = [];
    
    for (let i = 0; i < chunkUrls.length; i++) {
      const chunkUrl = chunkUrls[i];
      console.log(`📄 Processing GenAI Pro chunk ${i + 1}/${chunkUrls.length}`);
      
      // Extract base64 data from data URL (format: data:audio/mp3;base64,<base64data>)
      const base64Match = chunkUrl.match(/^data:audio\/mp3;base64,(.+)$/);
      if (!base64Match) {
        throw new Error(`Invalid base64 data URL format for chunk ${i + 1}`);
      }
      
      const base64Data = base64Match[1];
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      // Write to temporary file
      const tempFileName = `genaipro_chunk_${i.toString().padStart(3, '0')}.mp3`;
      const tempFilePath = path.join(tempDir, tempFileName);
      await fs.writeFile(tempFilePath, audioBuffer);
      
      tempFiles.push(tempFilePath);
      console.log(`✅ GenAI Pro chunk ${i + 1} written to: ${tempFilePath} (${audioBuffer.length} bytes)`);
    }
    
    // Create ffmpeg concat file
    console.log(`📝 Creating ffmpeg concat file for ${tempFiles.length} GenAI Pro chunks`);
    const concatFileName = 'genaipro_concat_list.txt';
    const concatFilePath = path.join(tempDir, concatFileName);
    
    const concatContent = tempFiles.map(filePath => `file '${filePath}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);
    
    console.log(`📝 GenAI Pro concat file created with content:\n${concatContent}`);
    
    // Run ffmpeg concatenation
    const outputFileName = 'genaipro_concatenated_output.mp3';
    const outputFilePath = path.join(tempDir, outputFileName);
    
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputFilePath}"`;
    console.log(`🎬 Running ffmpeg concatenation for GenAI Pro: ${ffmpegCommand}`);
    
    await execAsync(ffmpegCommand);
    console.log(`✅ GenAI Pro audio concatenation completed: ${outputFilePath}`);
    
    // Read the concatenated file and convert back to base64
    const concatenatedBuffer = await fs.readFile(outputFilePath);
    const base64Result = concatenatedBuffer.toString('base64');
    const dataUrl = `data:audio/mp3;base64,${base64Result}`;
    
    console.log(`🎉 Successfully concatenated ${chunkUrls.length} GenAI Pro chunks into single audio (${concatenatedBuffer.length} bytes)`);
    
    return dataUrl;
    
  } catch (error: any) {
    console.error(`❌ Error during GenAI Pro audio concatenation:`, error);
    throw new Error(`GenAI Pro audio concatenation failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      console.log(`🧹 Cleaning up GenAI Pro temporary directory: ${tempDir}`);
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
      console.log(`🧹 GenAI Pro cleanup completed successfully`);
    } catch (cleanupError) {
      console.warn(`⚠️ GenAI Pro cleanup failed:`, cleanupError);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { audioUrls, filename } = await request.json();

    console.log(`📥 Received GenAI Pro audio concatenation request for ${audioUrls?.length || 0} chunks`);

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json({ 
        error: "Missing or invalid audioUrls array" 
      }, { status: 400 });
    }

    // Concatenate all the audio chunks
    const finalAudioUrl = await concatenateAudioUrls(audioUrls);

    console.log(`✅ GenAI Pro audio concatenation completed successfully!`);

    return NextResponse.json({
      success: true,
      audioUrl: finalAudioUrl,
      filename: filename || 'genaipro_concatenated.mp3',
      chunksProcessed: audioUrls.length
    });

  } catch (error: any) {
    console.error("❌ Error in GenAI Pro audio concatenation:", error.message);
    return NextResponse.json(
      { error: `Failed to concatenate GenAI Pro audio: ${error.message}` },
      { status: 500 }
    );
  }
}



