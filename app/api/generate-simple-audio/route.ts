import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import "dotenv/config";

const execAsync = promisify(exec);

// Initialize ElevenLabs client
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = elevenLabsApiKey ? new ElevenLabsClient({ apiKey: elevenLabsApiKey }) : null;

// MiniMax configuration
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || "1905235425920819721";
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJMRcODTyBDVVJJT1NPIiwiVXNlck5hbWUiOiJMRcODTyBDVVJJT1NPIiwiQWNjb3VudCI6IiIsIlN1YmplY3RJRCI6IjE5MDUyMzU0MjU5MjkyMDgzMjkiLCJQaG9uZSI6IiIsIkdyb3VwSUQiOiIxOTA1MjM1NDI1OTIwODE5NzIxIiwiUGFnZU5hbWUiOiIiLCJNYWlsIjoiMTB0b3Bkb211bmRvQGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTA0LTI5IDA1OjE5OjE3IiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.Xxqk6EK5mA1PbIFHwJIftjLL9fXzIUoZapTbaRy-6LYtL1DuYJht-cVUZHHbWw3jiGFA5HJqhWC6K1CiT5PbTr76P381gme5HKJBhzU_g578sB43AoK4gm7mSWf-mmNcOKeBQF_WhVzmFcWb7YCRbED3Zx0c2p3lunshZOflz_9d-3iEC0199ia6v2ted8jA1NtKc21E7xfJxnwAYEjL-bGIz4b3D_i-MStZsJBxcvtFQ0l77KB1KIUMemBnrOhsEIsE088LOFNfazU0v9-DZTvwjplH8uSojo2P2IHlsdpUYnV0aVUj8ckIBHAStFRkH2Cf9hobMpU1n8QvStDlPA";

// Voice ID mappings for ElevenLabs (name to ID)
const ELEVENLABS_VOICE_IDS: Record<string, string> = {
  'Rachel': 'JBFqnCBsd6RMkjVDRZzb',
  'Adam': 'pNInz6obpgDQGcFmaJgB',
  'Antoni': 'ErXwobaYiN019PkySvjV',
  'Arnold': 'VR6AewLTigWG4xSOukaG',
  'Bella': 'EXAVITQu4vr4xnSDxMaL',
  'Domi': 'AZnzlk1XvdvUeBnXmlld',
  'Elli': 'MF3mGyEYCl7XYWbV9V6O',
  'Josh': 'TxGEqnHWrfWFTfGW9XjX',
  'Nicole': 'piTKgcLEGmPE4e6mEKli',
  'Sam': 'yoZ06aMxZJJ28mfd3POQ'
};

// Constants for chunking and batching
const ELEVENLABS_CHUNK_MAX_LENGTH = 10000;
const MINIMAX_CHUNK_MAX_LENGTH = 3000;
const BATCH_SIZE = 5; // 5 requests per batch
const BATCH_DELAY = 60 * 1000; // 1 minute delay between batches

// Chunking function
const chunkText = (text: string, maxLength: number): string[] => {
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
};

// Sleep function for batch delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateMinimaxAudio(text: string, voice: string, model: string): Promise<string> {
  console.log(`🎵 Generating MiniMax audio with voice: ${voice}, model: ${model}`);
  
  const response = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      text: text,
      stream: false,
      subtitle_enable: false,
      voice_setting: {
        voice_id: voice,
        speed: 1,
        vol: 1,
        pitch: 0
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1
      }
    })
  });

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch (e) {
      // ignore
    }
    throw new Error(`MiniMax API error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
  }

  const data = await response.json();
  
  if (!data.data?.audio) {
    throw new Error(`No audio data from MiniMax. Response: ${JSON.stringify(data)}`);
  }

  // Convert hex string to base64 for direct playback
  const hexString = data.data.audio;
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  
  const base64Audio = Buffer.from(bytes).toString('base64');
  return `data:audio/mp3;base64,${base64Audio}`;
}

async function generateElevenLabsAudio(text: string, voice: string, model: string, language: string): Promise<string> {
  if (!elevenlabs) {
    throw new Error("ElevenLabs client not initialized - check API key");
  }
  
  console.log(`🎵 Generating ElevenLabs audio with voice: ${voice}, model: ${model}, language: ${language}`);
  
  // Get the voice ID from the mapping, fallback to the provided voice if it's already an ID
  const voiceId = ELEVENLABS_VOICE_IDS[voice] || voice;
  
  console.log(`🎤 Using voice ID: ${voiceId} for voice: ${voice}`);
  
  // Prepare conversion options
  const conversionOptions: any = {
    text: text,
    voiceId: voiceId,
    modelId: model || "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  };
  
  // Add language code for flash model
  if (model === "eleven_flash_v2_5" && language) {
    conversionOptions.languageCode = language;
  }
  
  console.log(`🔧 Conversion options:`, conversionOptions);
  
  try {
    // Use the modern ElevenLabs SDK approach
    const audio = await elevenlabs.textToSpeech.convert(voiceId, conversionOptions);
    
    // Convert the audio stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk as Uint8Array);
    }
    
    // Concatenate all chunks
    const concatenatedArray = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concatenatedArray.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Convert to base64 for data URL
    const base64Audio = Buffer.from(concatenatedArray).toString('base64');
    console.log(`✅ ElevenLabs audio generated successfully (${concatenatedArray.length} bytes)`);
    
    return `data:audio/mp3;base64,${base64Audio}`;
    
  } catch (error: any) {
    console.error(`❌ ElevenLabs API error:`, error);
    throw new Error(`ElevenLabs generation failed: ${error.message}`);
  }
}

// Generate single chunk
async function generateSingleChunk(
  textChunk: string,
  chunkIndex: number,
  provider: string,
  voice: string,
  model: string,
  language?: string
): Promise<string> {
  console.log(`🎵 [Chunk ${chunkIndex + 1}] Generating: "${textChunk.substring(0, 50)}..." (${textChunk.length} chars)`);
  
  switch (provider) {
    case 'minimax':
      return await generateMinimaxAudio(textChunk, voice, model || 'speech-02-hd');
      
    case 'elevenlabs':
      return await generateElevenLabsAudio(textChunk, voice, model || 'eleven_multilingual_v2', language || 'en');
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Type for chunk processing results
interface ChunkResult {
  chunkIndex: number;
  status: 'completed' | 'failed';
  chunkUrl?: string;
  error?: string;
}

// Process chunks in batches
async function processBatches(
  textChunks: string[],
  provider: string,
  voice: string,
  model: string,
  language?: string
): Promise<string[]> {
  const chunkUrls: string[] = new Array(textChunks.length);
  const totalBatches = Math.ceil(textChunks.length / BATCH_SIZE);
  
  console.log(`📦 Processing ${textChunks.length} chunks in ${totalBatches} batches`);

  for (let batchStart = 0; batchStart < textChunks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, textChunks.length);
    const currentBatchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    
    console.log(`🔄 Processing batch ${currentBatchNumber}/${totalBatches} (chunks ${batchStart + 1}-${batchEnd})`);

    // Process current batch in parallel
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const promise = generateSingleChunk(textChunks[i], i, provider, voice, model, language)
        .then(chunkUrl => ({ chunkIndex: i, chunkUrl, status: 'completed' as const }))
        .catch(error => {
          console.error(`❌ Chunk ${i + 1} failed:`, error);
          return { chunkIndex: i, error: error.message, status: 'failed' as const };
        });
      batchPromises.push(promise);
    }

    // Wait for all chunks in this batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Process results and store in the correct positions
    for (const result of batchResults) {
      if (result.status === 'completed' && result.chunkUrl) {
        chunkUrls[result.chunkIndex] = result.chunkUrl;
        console.log(`✅ Chunk ${result.chunkIndex + 1} completed successfully`);
      } else if (result.status === 'failed') {
        console.error(`❌ Chunk ${result.chunkIndex + 1} failed: ${result.error}`);
        throw new Error(`Chunk ${result.chunkIndex + 1} processing failed: ${result.error}`);
      }
    }

    console.log(`✅ Batch ${currentBatchNumber}/${totalBatches} completed successfully`);

    // Wait between batches (except for the last batch)
    if (batchEnd < textChunks.length) {
      console.log(`⏱️ Waiting ${BATCH_DELAY / 1000}s before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  // Filter out any undefined values and return only completed chunks
  const completedChunks = chunkUrls.filter(url => url);
  console.log(`🎉 All batches completed! Generated ${completedChunks.length}/${textChunks.length} chunks successfully`);
  
  return completedChunks;
}

// Audio concatenation using ffmpeg
async function concatenateAudioUrls(chunkUrls: string[]): Promise<string> {
  if (chunkUrls.length === 1) {
    return chunkUrls[0];
  }
  
  console.log(`🔗 Starting audio concatenation for ${chunkUrls.length} chunks`);
  
  // Create temporary directory for processing
  const tempDir = path.join(os.tmpdir(), 'audio-concat', `session-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Convert base64 data URLs to temporary files
    const tempFiles: string[] = [];
    
    for (let i = 0; i < chunkUrls.length; i++) {
      const chunkUrl = chunkUrls[i];
      console.log(`📄 Processing chunk ${i + 1}/${chunkUrls.length}`);
      
      // Extract base64 data from data URL (format: data:audio/mp3;base64,<base64data>)
      const base64Match = chunkUrl.match(/^data:audio\/mp3;base64,(.+)$/);
      if (!base64Match) {
        throw new Error(`Invalid base64 data URL format for chunk ${i + 1}`);
      }
      
      const base64Data = base64Match[1];
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      // Write to temporary file
      const tempFileName = `chunk_${i.toString().padStart(3, '0')}.mp3`;
      const tempFilePath = path.join(tempDir, tempFileName);
      await fs.writeFile(tempFilePath, audioBuffer);
      
      tempFiles.push(tempFilePath);
      console.log(`✅ Chunk ${i + 1} written to: ${tempFilePath} (${audioBuffer.length} bytes)`);
    }
    
    // Create ffmpeg concat file
    console.log(`📝 Creating ffmpeg concat file for ${tempFiles.length} chunks`);
    const concatFileName = 'concat_list.txt';
    const concatFilePath = path.join(tempDir, concatFileName);
    
    const concatContent = tempFiles.map(filePath => `file '${filePath}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);
    
    console.log(`📝 Concat file created with content:\n${concatContent}`);
    
    // Run ffmpeg concatenation
    const outputFileName = 'concatenated_output.mp3';
    const outputFilePath = path.join(tempDir, outputFileName);
    
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputFilePath}"`;
    console.log(`🎬 Running ffmpeg concatenation: ${ffmpegCommand}`);
    
    await execAsync(ffmpegCommand);
    console.log(`✅ Audio concatenation completed: ${outputFilePath}`);
    
    // Read the concatenated file and convert back to base64
    const concatenatedBuffer = await fs.readFile(outputFilePath);
    const base64Result = concatenatedBuffer.toString('base64');
    const dataUrl = `data:audio/mp3;base64,${base64Result}`;
    
    console.log(`🎉 Successfully concatenated ${chunkUrls.length} chunks into single audio (${concatenatedBuffer.length} bytes)`);
    
    return dataUrl;
    
  } catch (error: any) {
    console.error(`❌ Error during audio concatenation:`, error);
    throw new Error(`Audio concatenation failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      console.log(`🧹 Cleaning up temporary directory: ${tempDir}`);
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
      console.log(`🧹 Cleanup completed successfully`);
    } catch (cleanupError) {
      console.warn(`⚠️ Cleanup failed:`, cleanupError);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { 
      text, 
      provider, 
      voice, 
      model, 
      language,
      scriptTitle,
      customFilename
    } = await request.json();

    console.log(`📥 Received batch audio generation request: provider=${provider}, voice=${voice}, model=${model}, language=${language}`);
    console.log(`📝 Text length: ${text?.length || 0} characters`);

    if (!text || !provider || !voice) {
      return NextResponse.json({ 
        error: "Missing required fields: text, provider, voice" 
      }, { status: 400 });
    }

    // Determine chunk size based on provider
    const maxChunkLength = provider === 'elevenlabs' ? ELEVENLABS_CHUNK_MAX_LENGTH : MINIMAX_CHUNK_MAX_LENGTH;
    
    // Split text into chunks
    const textChunks = chunkText(text, maxChunkLength);
    console.log(`📝 Text split into ${textChunks.length} chunks (max length: ${maxChunkLength})`);

    if (textChunks.length === 0) {
      throw new Error("No text content to process after chunking.");
    }

    // Process chunks in batches
    const chunkUrls = await processBatches(textChunks, provider, voice, model, language);
    
    if (chunkUrls.length === 0) {
      throw new Error("No audio chunks were generated successfully.");
    }

    // Concatenate chunks (simplified for now)
    const finalAudioUrl = await concatenateAudioUrls(chunkUrls);

    // Generate proper filename - use custom filename if provided, otherwise generate from script title
    let filename: string;
    
    if (customFilename && customFilename.trim()) {
      // Use custom filename, ensure it has .mp3 extension
      const cleanCustomFilename = customFilename.trim()
        .replace(/[^a-zA-Z0-9\s-_@]/g, '') // Allow @ symbol for the generator suffix
        .replace(/\s+/g, '-');
      
      filename = cleanCustomFilename.endsWith('.mp3') 
        ? cleanCustomFilename 
        : `${cleanCustomFilename}.mp3`;
    } else {
      // Generate filename from script title and language
      const languageCode = language || 'en';
      const cleanTitle = (scriptTitle || 'untitled-script')
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase()
        .substring(0, 50); // Limit length
      
      filename = `${languageCode.toUpperCase()}_${cleanTitle}.mp3`;
    }

    console.log(`✅ Batch audio generation completed successfully!`);

    return NextResponse.json({
      success: true,
      audioUrl: finalAudioUrl,
      filename: filename,
      provider,
      voice,
      model: model || (provider === 'minimax' ? 'speech-02-hd' : 'eleven_multilingual_v2'),
      language: language || 'en',
      chunksGenerated: chunkUrls.length,
      totalChunks: textChunks.length
    });

  } catch (error: any) {
    console.error("❌ Error in batch audio generation:", error.message);
    return NextResponse.json(
      { error: `Failed to generate audio: ${error.message}` },
      { status: 500 }
    );
  }
}