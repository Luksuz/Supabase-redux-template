import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";

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
const ELEVENLABS_CHUNK_MAX_LENGTH = 1000;
const MINIMAX_CHUNK_MAX_LENGTH = 2800;
const BATCH_SIZE = 5; // 5 requests per minute for both providers
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
  const chunkUrls: string[] = [];
  const totalBatches = Math.ceil(textChunks.length / BATCH_SIZE);
  
  console.log(`📦 Processing ${textChunks.length} chunks in ${totalBatches} batches`);

  for (let batchStart = 0; batchStart < textChunks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, textChunks.length);
    const currentBatchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    
    console.log(`🔄 Processing batch ${currentBatchNumber}/${totalBatches}`);

    // Process current batch in parallel
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(
        generateSingleChunk(textChunks[i], i, provider, voice, model, language)
          .then(chunkUrl => ({ chunkIndex: i, chunkUrl, status: 'completed' as const }))
          .catch(error => {
            console.error(`❌ Chunk ${i} failed:`, error);
            return { chunkIndex: i, error: error.message, status: 'failed' as const };
          })
      );
    }

    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const chunkResult = result.value;
        if (chunkResult.status === 'completed' && chunkResult.chunkUrl) {
          chunkUrls[chunkResult.chunkIndex] = chunkResult.chunkUrl;
        } else if (chunkResult.status === 'failed') {
          console.error(`❌ Failed chunk result:`, chunkResult.error);
          throw new Error(`Chunk processing failed: ${chunkResult.error}`);
        }
      } else {
        console.error(`❌ Promise rejected:`, result.reason);
        throw new Error(`Chunk processing failed: ${result.reason}`);
      }
    }

    // Wait between batches (except for the last batch)
    if (batchEnd < textChunks.length) {
      console.log(`⏱️ Waiting ${BATCH_DELAY / 1000}s before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  return chunkUrls.filter(url => url); // Filter out any undefined values
}

// Simple concatenation (for this demo, we'll just return the first chunk or implement basic joining)
function concatenateAudioUrls(chunkUrls: string[]): string {
  // For data URLs, we can't easily concatenate them without complex audio processing
  // For now, return the first chunk or implement a simple solution
  // In production, you'd want to decode, concatenate audio buffers, and re-encode
  
  if (chunkUrls.length === 1) {
    return chunkUrls[0];
  }
  
  // For multiple chunks, we'd need to implement actual audio concatenation
  // This is a simplified approach - in practice you'd need ffmpeg or audio processing
  console.log(`⚠️ Multiple chunks detected (${chunkUrls.length}). Returning first chunk for now.`);
  console.log(`🔗 In production, implement proper audio concatenation here.`);
  
  return chunkUrls[0]; // Simplified - return first chunk
}

export async function POST(request: Request) {
  try {
    const { 
      text, 
      provider, 
      voice, 
      model, 
      language 
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
    const finalAudioUrl = concatenateAudioUrls(chunkUrls);

    console.log(`✅ Batch audio generation completed successfully!`);

    return NextResponse.json({
      success: true,
      audioUrl: finalAudioUrl,
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