import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { uploadFileToSupabase } from './upload-file';

const execAsync = promisify(exec);

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

// Check if ElevenLabs API key is configured
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

// Fetch available voices from ElevenLabs
export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  if (!isElevenLabsConfigured()) {
    console.error('ElevenLabs API key not configured');
    return [];
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ElevenLabs voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices as ElevenLabsVoice[];
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return [];
  }
}

// Generate audio using ElevenLabs API and return the local file path
export async function generateElevenLabsAudio(
  text: string,
  voiceId: string,
  chunkIndex: number,
  sessionId: string,
  generateSubtitles: boolean
): Promise<{ audioUrl: string; duration: number; compressedAudioUrl: string | null }> {
  if (!isElevenLabsConfigured()) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API request failed: ${response.status} ${errorText}`);
  }
  
  // Create session-specific temp directory
  const tempDir = path.join(os.tmpdir(), 'elevenlabs-audio', sessionId);
  await fs.mkdir(tempDir, { recursive: true });

  const audioBuffer = await response.arrayBuffer();
  const rawFilePath = path.join(tempDir, `eleven-chunk-${chunkIndex}-raw-${Date.now()}.mp3`);
  await fs.writeFile(rawFilePath, Buffer.from(audioBuffer));

  // Get duration using ffprobe
  const { stdout } = await execAsync(`C:\\ffmpeg\\bin\\ffprobe.exe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${rawFilePath}"`);
  const duration = parseFloat(stdout.trim());

  if (isNaN(duration) || duration <= 0) {
    await fs.unlink(rawFilePath);
    throw new Error(`Invalid duration detected for chunk ${chunkIndex}`);
  }
  
  // Upload original audio to Supabase
  const originalSupabasePath = `voiceover/original/eleven-chunk-${chunkIndex}-${Date.now()}.mp3`;
  const originalPublicUrl = await uploadFileToSupabase(rawFilePath, originalSupabasePath, 'audio/mpeg');
  if (!originalPublicUrl) {
    await fs.unlink(rawFilePath);
    throw new Error('Failed to upload original audio to Supabase.');
  }

  let compressedPublicUrl: string | null = null;
  if (generateSubtitles) {
    // Compress the audio for subtitles
    const compressedFilePath = path.join(tempDir, `eleven-chunk-${chunkIndex}-compressed-${Date.now()}.mp3`);
    console.log(`🗜️ Compressing audio for subtitles: ${rawFilePath} -> ${compressedFilePath}`)
    const compressionCommand = `ffmpeg -i "${rawFilePath}" -b:a 48k -ar 24000 -ac 1 -y "${compressedFilePath}"`;
    await execAsync(compressionCommand);

    // Upload compressed audio
    const compressedSupabasePath = `voiceover/compressed/eleven-chunk-${chunkIndex}-${Date.now()}.mp3`;
    compressedPublicUrl = await uploadFileToSupabase(compressedFilePath, compressedSupabasePath, 'audio/mpeg');
    
    // Clean up local compressed file
    await fs.unlink(compressedFilePath);
  }

  // Clean up local original file
  await fs.unlink(rawFilePath);

  return { audioUrl: originalPublicUrl, duration, compressedAudioUrl: compressedPublicUrl };
} 