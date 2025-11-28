import { NextRequest, NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";
import { uploadFileToSupabase } from "@/lib/upload-file";
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import path from 'path';
import fs from 'fs';

const FAL_API_KEY = process.env.FAL_API_KEY;

// Configure fal.ai
if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  if (!FAL_API_KEY) {
    return NextResponse.json({ error: 'FAL API key not configured' }, { status: 500 });
  }

  try {
    const { text, model, voice, chunkIndex, sessionId } = await request.json();

    if (!text || !model || !sessionId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`🎤 Starting FAL AI audio generation with model: ${model}`);

    let result;
    let audioUrl = '';

    // Handle different FAL AI TTS models
    switch (model) {
      case 'playai-tts-v3':
        result = await fal.subscribe("fal-ai/playai/tts/v3", {
          input: {
            input: text,
            voice: voice || "Jennifer (English (US)/American)"
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs.map((log) => log.message).forEach(console.log);
            }
          },
        });

        console.log(result);
        
        // Extract audio URL from PlayAI response
        if ((result.data as any)?.audio?.url) {
          audioUrl = (result.data as any).audio.url;
        } else if ((result.data as any)?.url) {
          audioUrl = (result.data as any).url;
        } else {
          throw new Error('No audio URL found in PlayAI response');
        }
        break;

      case 'minimax-speech-02-turbo':
        console.log('🎤 FAL Minimax - Received voice parameter:', voice);
        console.log('🎤 FAL Minimax - Will use voice:', voice || "male_narrator");
        
        result = await fal.subscribe("fal-ai/minimax/speech-02-turbo", {
          input: {
            text: text,
            voice: voice || "male_narrator"
          } as any, // Type assertion: voice parameter may not be in type definitions but is supported by API
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs.map((log) => log.message).forEach(console.log);
            }
          },
        });
        
        console.log('🎤 FAL Minimax result:', result);
        
        // Extract audio URL from Minimax response
        if ((result.data as any)?.audio?.url) {
          audioUrl = (result.data as any).audio.url;
        } else if ((result.data as any)?.url) {
          audioUrl = (result.data as any).url;
        } else {
          throw new Error('No audio URL found in Minimax response');
        }
        break;

      default:
        return NextResponse.json({ error: `Unsupported FAL AI model: ${model}` }, { status: 400 });
    }

    console.log(`✅ FAL AI audio generation complete. Audio URL: ${audioUrl}`);

    // Download and upload to Supabase
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioData = Buffer.from(audioBuffer);

    // Create temporary file
    const tempDir = os.tmpdir();
    const tempFileName = `fal-audio-${uuidv4()}.mp3`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Write to temporary file
    fs.writeFileSync(tempFilePath, audioData);

    // Upload to Supabase
    const chunkSuffix = chunkIndex !== undefined ? `_chunk_${chunkIndex}` : '';
    const fileName = `fal_${model}_${sessionId}${chunkSuffix}.mp3`;
    const storagePath = `audio/${fileName}`;
    
    const supabaseUrl = await uploadFileToSupabase(tempFilePath, storagePath, 'audio/mpeg');
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);

    if (!supabaseUrl) {
      throw new Error('Failed to upload audio to Supabase');
    }

    // Get audio duration from FAL AI response or estimate from buffer
    let duration: number;
    if ((result.data as any)?.audio?.duration) {
      duration = (result.data as any).audio.duration;
      console.log(`🕐 Using actual duration from FAL AI: ${duration}s`);
    } else {
      // Fallback to rough estimate from audio buffer size
      duration = audioBuffer.byteLength / (16000 * 2);
      console.log(`🕐 Using estimated duration: ${duration}s`);
    }

    console.log(`✅ Audio uploaded to Supabase: ${supabaseUrl}`);

    return NextResponse.json({
      success: true,
      audioUrl: supabaseUrl,
      duration: duration,
      chunkIndex: chunkIndex,
      model: model,
      voice: voice
    });

  } catch (error: any) {
    console.error('Error in FAL AI audio generation route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 