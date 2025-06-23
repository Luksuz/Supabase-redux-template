"use server";

import { NextResponse } from "next/server";
import { OpenAI } from 'openai';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { spawn } from 'child_process';
import { uploadFileToSupabase } from "@/lib/wellsaid-utils";
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { synthesizeGoogleTts } from "@/utils/google-tts-utils";

// Constants
const AUDIO_CHUNK_MAX_LENGTH = 2800;
const ELEVENLABS_AUDIO_CHUNK_MAX_LENGTH = 1000;
const MAX_CHUNK_GENERATION_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const DEFAULT_CHUNK_PROCESSING_BATCH_SIZE = 5;
const DEFAULT_DELAY_AFTER_CHUNK_BATCH_MS = 60 * 1100;

const ELEVENLABS_CHUNK_PROCESSING_BATCH_SIZE = 5;
const ELEVENLABS_DELAY_AFTER_CHUNK_BATCH_MS = 60 * 1100;

const FISH_AUDIO_CHUNK_PROCESSING_BATCH_SIZE = 3;
const FISH_AUDIO_DELAY_AFTER_CHUNK_BATCH_MS = 60 * 1000;

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || "4239d52824be4f088a406121777bb1ba";
const FISH_AUDIO_MODEL_DEFAULT = process.env.FISH_AUDIO_MODEL || "speech-1.6";

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = elevenLabsApiKey ? new ElevenLabsClient({ apiKey: elevenLabsApiKey }) : null;

const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || "1905235425920819721";
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJMRcODTyBDVVJJT1NPIiwiVXNlck5hbWUiOiJMRcODTyBDVVJJT1NPIiwiQWNjb3VudCI6IiIsIlN1YmplY3RJRCI6IjE5MDUyMzU0MjU5MjkyMDgzMjkiLCJQaG9uZSI6IiIsIkdyb3VwSUQiOiIxOTA1MjM1NDI1OTIwODE5NzIxIiwiUGFnZU5hbWUiOiIiLCJNYWlsIjoiMTB0b3Bkb211bmRvQGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTA0LTI5IDA1OjE5OjE3IiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.Xxqk6EK5mA1PbIFHwJIftjLL9fXzIUoZapTbaRy-6LYtL1DuYJht-cVUZHHbWw3jiGFA5HJqhWC6K1CiT5PbTr76P381gme5HKJBhzU_g578sB43AoK4gm7mSWf-mmNcOKeBQF_WhVzmFcWb7YCRbED3Zx0c2p3lunshZOflz_9d-3iEC0199ia6v2ted8jA1NtKc21E7xfJxnwAYEjL-bGIz4b3D_i-MStZsJBxcvtFQ0l77KB1KIUMemBnrOhsEIsE088LOFNfazU0v9-DZTvwjplH8uSojo2P2IHlsdpUYnV0aVUj8ckIBHAStFRkH2Cf9hobMpU1n8QvStDlPA";

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper Functions
async function ensureDir(dirPath: string) {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

function chunkText(text: string, maxLength: number = AUDIO_CHUNK_MAX_LENGTH): string[] {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    let chunkEnd = currentPosition + maxLength;
    if (chunkEnd >= text.length) {
      chunks.push(text.substring(currentPosition));
      break;
    }

    let splitPosition = -1;
    const sentenceEndChars = /[.?!]\s+|[\n\r]+/g;
    let match;
    let lastMatchPosition = -1;
    
    const searchSubstr = text.substring(currentPosition, chunkEnd);
    while((match = sentenceEndChars.exec(searchSubstr)) !== null) {
        lastMatchPosition = currentPosition + match.index + match[0].length;
    }

    if (lastMatchPosition > currentPosition && lastMatchPosition <= chunkEnd) {
        splitPosition = lastMatchPosition;
    } else {
        let spacePosition = text.lastIndexOf(' ', chunkEnd);
        if (spacePosition > currentPosition) {
            splitPosition = spacePosition + 1;
        } else {
            splitPosition = chunkEnd;
        }
    }
    chunks.push(text.substring(currentPosition, splitPosition).trim());
    currentPosition = splitPosition;
  }
  return chunks.filter(chunk => chunk.length > 0);
}

async function generateSingleAudioChunk(
  chunkIndex: number,
  textChunk: string,
  provider: string,
  providerArgs: any,
  baseTempDir: string
): Promise<string> {
  console.log(`🔊 [Chunk ${chunkIndex}] Generating for provider: ${provider}, length: ${textChunk.length}`);
  const { voice, model, fishAudioVoiceId, fishAudioModel, elevenLabsVoiceId, elevenLabsModelId, languageCode, googleTtsVoiceName } = providerArgs;
  
  const tempFileName = `${provider}-${
    provider === "google-tts" ? 
      (googleTtsVoiceName || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') : 
      provider === "elevenlabs" ?
        (elevenLabsVoiceId || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') :
        provider === "fish-audio" ?
          (fishAudioVoiceId || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') :
          (voice || 'unknown_voice').replace(/\s+/g, '_')
  }-chunk${chunkIndex}-${Date.now()}.mp3`;
  const tempFilePath = path.join(baseTempDir, tempFileName);
  
  let audioBuffer: Buffer;

  try {
    switch (provider) {
      case "openai":
        const openaiSelectedVoice = voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" | "ash" | "ballad" | "coral" | "sage";
        const openaiTTSModel = model || "tts-1"; 
        console.log(`🤖 [Chunk ${chunkIndex}] OpenAI: voice=${openaiSelectedVoice}, model=${openaiTTSModel}`);
        const mp3 = await openai.audio.speech.create({
          model: openaiTTSModel,
          voice: openaiSelectedVoice,
          input: textChunk,
        });
        audioBuffer = Buffer.from(await mp3.arrayBuffer());
        break;

      case "minimax":
        const minimaxTTSModel = model || "speech-02";
        console.log(`🤖 [Chunk ${chunkIndex}] MiniMax: voice=${voice}, model=${minimaxTTSModel}`);
        const minimaxResponse = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
          body: JSON.stringify({
            model: minimaxTTSModel, text: textChunk, stream: false, subtitle_enable: false,
            voice_setting: { voice_id: voice, speed: 1, vol: 1, pitch: 0 },
            audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 }
          })
        });
        if (!minimaxResponse.ok) {
          let errorBody = '';
          try { errorBody = await minimaxResponse.text(); } catch (e) { /* ignore */ }
          throw new Error(`MiniMax API error [Chunk ${chunkIndex}]: ${minimaxResponse.status} ${minimaxResponse.statusText}. Body: ${errorBody}`);
        }
        const minimaxData = await minimaxResponse.json();
        if (!minimaxData.data?.audio) throw new Error(`No audio data from MiniMax [Chunk ${chunkIndex}]. Response: ${JSON.stringify(minimaxData)}`);
        const hexString = minimaxData.data.audio;
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
        }
        audioBuffer = Buffer.from(bytes);
        break;

      case "fish-audio":
        if (!fishAudioVoiceId) throw new Error(`Missing fishAudioVoiceId for Fish Audio [Chunk ${chunkIndex}]`);
        const fishModelToUse = fishAudioModel || FISH_AUDIO_MODEL_DEFAULT;
        console.log(`🐠 [Chunk ${chunkIndex}] Fish Audio: voiceId=${fishAudioVoiceId}, model=${fishModelToUse}`);
        const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: { "Authorization": `Bearer ${FISH_AUDIO_API_KEY}`, "Content-Type": "application/json", "Model": fishModelToUse },
          body: JSON.stringify({
            text: textChunk, chunk_length: 200, format: "mp3", mp3_bitrate: 128,
            reference_id: fishAudioVoiceId, normalize: true, latency: "normal",
          })
        });
        if (!fishResponse.ok || !fishResponse.body) {
          let errorBody = '';
          try { errorBody = await fishResponse.text(); } catch (e) { /* ignore */ }
          throw new Error(`Fish Audio API error [Chunk ${chunkIndex}]: ${fishResponse.status} ${fishResponse.statusText}. Body: ${errorBody}`);
        }
        const fishReader = fishResponse.body.getReader();
        const fishChunks: Buffer[] = [];
        while (true) {
          const { done, value } = await fishReader.read();
          if (done) break;
          fishChunks.push(Buffer.from(value)); 
        }
        audioBuffer = Buffer.concat(fishChunks as any);
        break;

      case "elevenlabs":
        if (!elevenlabs) throw new Error(`ElevenLabs client not initialized [Chunk ${chunkIndex}]`);
        if (!elevenLabsVoiceId) throw new Error(`Missing elevenLabsVoiceId [Chunk ${chunkIndex}]`);
        const elModelId = elevenLabsModelId || "eleven_multilingual_v2";
        console.log(`🧪 [Chunk ${chunkIndex}] ElevenLabs: voiceId=${elevenLabsVoiceId}, modelId=${elModelId}${languageCode && elModelId === "eleven_flash_v2_5" ? `, language=${languageCode}` : ""}`);
        
        const elConversionParams: any = {
          text: textChunk,
          modelId: elModelId,
          outputFormat: "mp3_44100_128"
        };
        
        if (elModelId === "eleven_flash_v2_5" && languageCode) {
          elConversionParams.languageCode = languageCode;
        }
        
        const elAudioStream = await elevenlabs.textToSpeech.convert(elevenLabsVoiceId, elConversionParams);
        const elStreamChunks: Uint8Array[] = [];
        
        // Handle ReadableStream properly
        const reader = elAudioStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            elStreamChunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        
        const elConcatenatedUint8Array = new Uint8Array(elStreamChunks.reduce((acc, streamChunk) => acc + streamChunk.length, 0));
        let offset = 0;
        for (const streamChunk of elStreamChunks) { 
          elConcatenatedUint8Array.set(streamChunk, offset); 
          offset += streamChunk.length; 
        }
        audioBuffer = Buffer.from(elConcatenatedUint8Array);
        break;
        
      case "google-tts":
        if (!googleTtsVoiceName) throw new Error(`Missing googleTtsVoiceName for Google TTS [Chunk ${chunkIndex}]`);
        if (!languageCode) throw new Error(`Missing languageCode for Google TTS [Chunk ${chunkIndex}]`);
        console.log(`🇬☁️ [Chunk ${chunkIndex}] Google TTS: voice=${googleTtsVoiceName}, language=${languageCode}`);
        
        try {
          audioBuffer = await synthesizeGoogleTts(textChunk, googleTtsVoiceName, languageCode);
        } catch (error: any) {
          // Handle language code mismatch errors specifically
          if (error.message && error.message.includes("doesn't match the voice")) {
            const friendlyError = `Google TTS Error [Chunk ${chunkIndex}]: Language code mismatch. ${error.message}`;
            console.error(`❌ ${friendlyError}`);
            throw new Error(friendlyError);
          }
          // Handle other Google TTS specific errors
          if (error.details || error.message) {
            const friendlyError = `Google TTS Error [Chunk ${chunkIndex}]: ${error.details || error.message}`;
            console.error(`❌ ${friendlyError}`);
            throw new Error(friendlyError);
          }
          throw error;
        }
        break;

      default:
        throw new Error(`Unsupported provider: ${provider} [Chunk ${chunkIndex}]`);
    }

    await fsp.writeFile(tempFilePath, audioBuffer as any); 
    console.log(`💾 [Chunk ${chunkIndex}] Saved to: ${tempFilePath}`);
    return tempFilePath;

  } catch (error: any) {
    console.error(`❌ Error in generateSingleAudioChunk for provider ${provider} [Chunk ${chunkIndex}]: ${error.message}`);
    try { if (fs.existsSync(tempFilePath)) await fsp.rm(tempFilePath); } catch (e) { console.warn(`🧹 Failed to cleanup temp file ${tempFilePath} after error:`, e); }
    throw error; 
  }
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
    .map(filePath => {
      if (typeof filePath !== 'string') {
        throw new Error(`Invalid file path in chunkFilePaths: ${JSON.stringify(filePath)}`);
      }
      // Defensive: ensure filePath is defined and a string before calling replace
      return `file '${path.resolve(filePath).replace(/\\/g, '/')}'`;
    })
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
      '-b:a', '64k',
      '-ar', '44100',
      '-ac', '1',
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
        console.log(`🧹 Cleaning up ${chunkFilePaths.length} individual chunk files...`);
        let cleanupFailures = 0;
        for (const chunkPath of chunkFilePaths) {
          try {
            await fsp.rm(chunkPath);
          } catch (chunkCleanupError) {
            cleanupFailures++;
            console.warn(`⚠️ Failed to clean up chunk file ${chunkPath}:`, chunkCleanupError);
          }
        }
        if (cleanupFailures > 0) {
           console.warn(`⚠️ Failed to clean up ${cleanupFailures} chunk files.`);
        }
        resolve(finalOutputPath);
      } else {
        console.error(`❌ ffmpeg failed with code ${code}.`);
        try { 
            if (fs.existsSync(finalOutputPath)) {
                await fsp.rm(finalOutputPath); 
                console.log(`🧹 Cleaned up potentially incomplete output file: ${finalOutputPath}`);
            } 
        } catch (e) { 
            console.warn(`⚠️ Could not clean up failed output file ${finalOutputPath}:`, e);
        } 
        reject(new Error(`ffmpeg failed to join audio chunks. Code: ${code}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('❌ Failed to start ffmpeg process:', err);
      fsp.rm(listFilePath).catch(cleanupError => {
        console.warn(`⚠️ Could not clean up ffmpeg list file ${listFilePath} after spawn error:`, cleanupError);
      });
      fsp.rm(finalOutputPath).catch(() => {}); 
      reject(err);
    });
  });
}

async function createCompressedAudio(originalAudioPath: string, outputDir: string): Promise<string> {
  const compressedFileName = `compressed-${path.basename(originalAudioPath)}`;
  const compressedFilePath = path.join(outputDir, compressedFileName);
  
  try {
    console.log(`🗜️ Creating compressed audio: ${originalAudioPath} -> ${compressedFilePath}`);
    
    // Use ffmpeg to create a compressed version suitable for subtitle generation
    // Lower bitrate and quality for faster processing by Whisper
    const ffmpegCommand = `ffmpeg -i "${originalAudioPath}" -ar 16000 -ac 1 -b:a 32k -f mp3 "${compressedFilePath}"`;
    
    await new Promise<void>((resolve, reject) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ FFmpeg compression error: ${error.message}`);
          reject(error);
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

async function generateSubtitlesFromAudio(audioUrl: string, userId: string): Promise<string> {
  console.log(`🔤 Generating subtitles for audio: ${audioUrl}`);
  
  try {
    // Call our existing subtitle generation endpoint (fix the endpoint URL)
    const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-subtitles`;
    console.log(`🌐 Making request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioUrl: audioUrl,
        userId: userId
      })
    });

    console.log(`📡 Subtitle API response status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to get the response text to see what's actually being returned
      const responseText = await response.text();
      console.error(`❌ Subtitle API error response: ${responseText.substring(0, 500)}...`);
      
      // Check if it's HTML (likely an error page)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error(`Subtitle API returned HTML error page (${response.status}). The API endpoint may not exist or be accessible.`);
      }
      
      // Try to parse as JSON if it's not HTML
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Subtitle generation failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
      } catch (parseError) {
        throw new Error(`Subtitle generation failed: ${response.status} ${response.statusText} - ${responseText.substring(0, 200)}`);
      }
    }

    const responseText = await response.text();
    console.log(`📡 Subtitle API response (first 200 chars): ${responseText.substring(0, 200)}...`);
    
    // Try to parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ Failed to parse subtitle API response as JSON: ${parseError}`);
      console.error(`❌ Response content: ${responseText.substring(0, 500)}...`);
      throw new Error(`Subtitle API returned invalid JSON response`);
    }
    
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

export async function POST(request: Request) {
  const requestBody = await request.json();
  const { text, provider, voice, model, fishAudioVoiceId, fishAudioModel, elevenLabsVoiceId, elevenLabsModelId, languageCode, userId = "unknown_user", googleTtsVoiceName, googleTtsLanguageCode, googleTtsSsmlGender } = requestBody;

  console.log("📥 Received audio generation request (comprehensive)");
  console.log(`🔍 Request details: provider=${provider}, voice=${voice}, userId=${userId}, text length=${text?.length || 0}`);

  // Validate required fields based on provider
  if (!text || !provider) {
    return NextResponse.json({ error: "Missing required fields: text and provider are required" }, { status: 400 });
  }

  // Provider-specific validation
  switch (provider) {
    case "openai":
    case "minimax":
      if (!voice) {
        return NextResponse.json({ error: `Missing required field 'voice' for ${provider}` }, { status: 400 });
      }
      break;
    case "fish-audio":
      if (!fishAudioVoiceId) {
        return NextResponse.json({ error: "Missing required field 'fishAudioVoiceId' for Fish Audio" }, { status: 400 });
      }
      break;
    case "elevenlabs":
      if (!elevenLabsVoiceId) {
        return NextResponse.json({ error: "Missing required field 'elevenLabsVoiceId' for ElevenLabs" }, { status: 400 });
      }
      break;
    case "google-tts":
      if (!googleTtsVoiceName) {
        return NextResponse.json({ error: "Missing required field 'googleTtsVoiceName' for Google TTS" }, { status: 400 });
      }
      break;
    default:
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  const baseTempDirRoot = path.join(process.cwd(), 'temp-audio-processing');
  const tempDirForRequest = path.join(baseTempDirRoot, `req-${uuidv4()}`);

  await ensureDir(tempDirForRequest);

  let finalAudioSupabaseUrl: string | null = null;
  const allGeneratedChunkPathsForCleanup: string[] = [];
  let audioDuration = 0;

  try {
    const currentChunkMaxLength = provider === "elevenlabs" ? ELEVENLABS_AUDIO_CHUNK_MAX_LENGTH : AUDIO_CHUNK_MAX_LENGTH;
    const textChunks = chunkText(text, currentChunkMaxLength);
    console.log(`📝 Text split into ${textChunks.length} chunks (max length: ${currentChunkMaxLength}).`);

    if (textChunks.length === 0) {
      return NextResponse.json({ error: "No text content to process after chunking." }, { status: 400 });
    }

    const providerSpecificArgs: any = { voice, model, fishAudioVoiceId, fishAudioModel, elevenLabsVoiceId, elevenLabsModelId, languageCode, provider };
    if (provider === "google-tts") {
      providerSpecificArgs.googleTtsVoiceName = googleTtsVoiceName;
      providerSpecificArgs.languageCode = googleTtsLanguageCode || languageCode;
    }
    const successfulChunkPaths: (string | null)[] = new Array(textChunks.length).fill(null);
    let allChunksSucceeded = false;

    for (let attempt = 1; attempt <= MAX_CHUNK_GENERATION_ATTEMPTS; attempt++) {
      console.log(`🔄 Overall Attempt ${attempt}/${MAX_CHUNK_GENERATION_ATTEMPTS} for generating audio chunks.`);
      
      const tasksForThisAttempt: { originalIndex: number; textChunk: string }[] = [];
      for (let i = 0; i < textChunks.length; i++) {
        if (successfulChunkPaths[i] === null) {
          tasksForThisAttempt.push({ originalIndex: i, textChunk: textChunks[i] });
        }
      }

      if (tasksForThisAttempt.length === 0) {
        allChunksSucceeded = true;
        console.log("✅ All chunks generated successfully in previous overall attempts.");
        break;
      }

      const currentBatchSize = provider === "elevenlabs" ? ELEVENLABS_CHUNK_PROCESSING_BATCH_SIZE : 
                               provider === "fish-audio" ? FISH_AUDIO_CHUNK_PROCESSING_BATCH_SIZE : 
                               DEFAULT_CHUNK_PROCESSING_BATCH_SIZE;
      const currentDelayAfterBatch = provider === "elevenlabs" ? ELEVENLABS_DELAY_AFTER_CHUNK_BATCH_MS : 
                                     provider === "fish-audio" ? FISH_AUDIO_DELAY_AFTER_CHUNK_BATCH_MS : 
                                     DEFAULT_DELAY_AFTER_CHUNK_BATCH_MS;

      console.log(`🌀 In Overall Attempt ${attempt}, ${tasksForThisAttempt.length} chunks pending. Processing in batches of up to ${currentBatchSize}.`);

      for (let batchStartIndex = 0; batchStartIndex < tasksForThisAttempt.length; batchStartIndex += currentBatchSize) {
        const currentBatchTasks = tasksForThisAttempt.slice(batchStartIndex, batchStartIndex + currentBatchSize);

        console.log(`  Attempting batch of ${currentBatchTasks.length} chunks`);
        
        const chunkGenerationPromises = currentBatchTasks.map(task => 
          generateSingleAudioChunk(task.originalIndex, task.textChunk, provider, providerSpecificArgs, tempDirForRequest)
        );

        const results = await Promise.allSettled(chunkGenerationPromises);

        results.forEach((result, promiseIndex) => {
          const task = currentBatchTasks[promiseIndex];
          if (result.status === 'fulfilled') {
            console.log(`    ✅ Chunk ${task.originalIndex} (Overall Attempt ${attempt}) succeeded: ${result.value}`);
            successfulChunkPaths[task.originalIndex] = result.value;
            if (!allGeneratedChunkPathsForCleanup.includes(result.value)) {
              allGeneratedChunkPathsForCleanup.push(result.value);
            }
          } else {
            console.error(`    ❌ Chunk ${task.originalIndex} (Overall Attempt ${attempt}) failed:`, result.reason);
          }
        });

        if (successfulChunkPaths.every(p => p !== null)) {
          allChunksSucceeded = true;
          console.log("✅ All chunks generated successfully after this batch.");
          break;
        }

        if (batchStartIndex + currentBatchSize < tasksForThisAttempt.length) {
          console.log(`  ⏱️ Batch processed. Waiting ${currentDelayAfterBatch / 1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, currentDelayAfterBatch));
        }
      }

      if (allChunksSucceeded) {
        break;
      }

      const remainingFailedChunks = successfulChunkPaths.filter(p => p === null).length;
      if (attempt < MAX_CHUNK_GENERATION_ATTEMPTS && remainingFailedChunks > 0) {
        console.log(`⏱️ Overall Attempt ${attempt} finished. Waiting ${RETRY_DELAY_MS}ms before next overall attempt for remaining ${remainingFailedChunks} chunks...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    const finalGeneratedPaths = successfulChunkPaths.filter(p => p !== null) as string[];

    if (finalGeneratedPaths.length === 0) {
      throw new Error("All audio chunks failed to generate after all attempts.");
    }

    if (finalGeneratedPaths.length < textChunks.length) {
      console.warn(`⚠️ Only ${finalGeneratedPaths.length}/${textChunks.length} chunks generated successfully after all attempts. Proceeding with available chunks.`);
    }
    
    const localFinalFileName = `${provider}-${
      provider === "google-tts" ? 
        (googleTtsVoiceName || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') : 
        provider === "elevenlabs" ?
          (elevenLabsVoiceId || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') :
          provider === "fish-audio" ?
            (fishAudioVoiceId || 'unknown_voice').replace(/[^a-zA-Z0-9]/g, '_') :
            (voice || 'unknown_voice').replace(/\s+/g, '_')
    }-${uuidv4()}-final.mp3`;
    const localFinalFilePath = path.join(tempDirForRequest, localFinalFileName);

    let fileToUploadPath: string;

    if (finalGeneratedPaths.length > 1) {
      fileToUploadPath = await joinAudioChunks(finalGeneratedPaths, localFinalFileName, tempDirForRequest);
    } else {
      const singleChunkPath = finalGeneratedPaths[0];
      await fsp.rename(singleChunkPath, localFinalFilePath);
      console.log(`🎵 Single chunk moved to temporary final location: ${localFinalFilePath}`);
      fileToUploadPath = localFinalFilePath;
      const movedFileIndex = allGeneratedChunkPathsForCleanup.indexOf(singleChunkPath);
      if (movedFileIndex > -1) {
        allGeneratedChunkPathsForCleanup.splice(movedFileIndex, 1);
      }
    }

    const supabaseDestinationPath = `user_${userId}/audio/${uuidv4()}.mp3`;
    finalAudioSupabaseUrl = await uploadFileToSupabase(fileToUploadPath, supabaseDestinationPath, 'audio/mpeg');

    if (!finalAudioSupabaseUrl) {
        throw new Error("Failed to upload the final audio file to Supabase Storage.");
    }

    // Create compressed audio for subtitle generation
    let compressedAudioSupabaseUrl: string | null = null;
    try {
      console.log("🗜️ Creating compressed audio for subtitle generation");
      const compressedAudioPath = await createCompressedAudio(fileToUploadPath, tempDirForRequest);
      
      // Upload compressed audio to Supabase
      const compressedSupabaseDestinationPath = `user_${userId}/audio/compressed/${uuidv4()}.mp3`;
      compressedAudioSupabaseUrl = await uploadFileToSupabase(compressedAudioPath, compressedSupabaseDestinationPath, 'audio/mpeg');
      
      if (compressedAudioSupabaseUrl) {
        console.log(`✅ Compressed audio uploaded: ${compressedAudioSupabaseUrl}`);
      } else {
        console.warn("⚠️ Failed to upload compressed audio, will use original for subtitles");
      }
    } catch (compressionError: any) {
      console.warn("⚠️ Audio compression failed, will use original for subtitles:", compressionError.message);
    }

    audioDuration = Math.ceil(text.length / 15); 

    let subtitlesUrl = null;
    let isSrtSaved = false;
    
    // Generate subtitles using the compressed audio (if available) or original audio
    const audioUrlForSubtitles = compressedAudioSupabaseUrl || finalAudioSupabaseUrl;
    if (audioUrlForSubtitles) {
      try {
        console.log(`🔤 Starting subtitle generation using ${compressedAudioSupabaseUrl ? 'compressed' : 'original'} audio`);
        
        // Re-enable subtitle generation
        subtitlesUrl = await generateSubtitlesFromAudio(audioUrlForSubtitles, userId);
        isSrtSaved = true;
        console.log(`✅ Subtitle generation complete: ${subtitlesUrl}`);
        
      } catch (subtitleError: any) {
        console.error("⚠️ Error generating subtitles:", subtitleError.message);
        console.log("⚠️ Continuing with audio generation result despite subtitle error");
      }
    }

    console.log(`✅ Audio generated and uploaded successfully.`);
    console.log(`📤 Sending response: audioUrl=${finalAudioSupabaseUrl}, compressedAudioUrl=${compressedAudioSupabaseUrl}, subtitlesUrl=${subtitlesUrl}, estimated duration=${audioDuration}s`);
    return NextResponse.json({
      success: true,
      audioUrl: finalAudioSupabaseUrl,
      compressedAudioUrl: compressedAudioSupabaseUrl,
      subtitlesUrl: subtitlesUrl,
      subtitlesGenerated: isSrtSaved,
      duration: audioDuration,
      provider,
      voice,
    });

  } catch (error: any) {
    console.error("❌ Error generating audio:", error.message, error.stack);
    console.log(`🧹 Cleaning up ${allGeneratedChunkPathsForCleanup.length} leftover temporary chunk files due to error...`);
    for (const tempFile of allGeneratedChunkPathsForCleanup) {
        try { 
          if(fs.existsSync(tempFile)) { 
            await fsp.rm(tempFile); 
            console.log(`🚮 Deleted temp file: ${tempFile}`);
          }
        } catch (e) { 
          console.warn(`🧹 Cleanup failed for temp chunk: ${tempFile}`, e); 
        }
    }
    return NextResponse.json(
      { error: `Failed to generate audio: ${error.message}` },
      { status: 500 }
    );
  } finally {
      try {
          if (fs.existsSync(tempDirForRequest)) {
              await fsp.rm(tempDirForRequest, { recursive: true, force: true });
              console.log(`🚮 Cleaned up request temp directory: ${tempDirForRequest}`);
          }
      } catch (e) {
          console.warn(`⚠️ Failed to cleanup request temp directory ${tempDirForRequest}:`, e);
      }
  }
} 