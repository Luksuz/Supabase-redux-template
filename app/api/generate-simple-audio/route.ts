import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Initialize ElevenLabs client
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = elevenLabsApiKey ? new ElevenLabsClient({ apiKey: elevenLabsApiKey }) : null;

// MiniMax configuration
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || "1905235425920819721";
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJMRcODTyBDVVJJT1NPIiwiVXNlck5hbWUiOiJMRcODTyBDVVJJT1NPIiwiQWNjb3VudCI6IiIsIlN1YmplY3RJRCI6IjE5MDUyMzU0MjU5MjkyMDgzMjkiLCJQaG9uZSI6IiIsIkdyb3VwSUQiOiIxOTA1MjM1NDI1OTIwODE5NzIxIiwiUGFnZU5hbWUiOiIiLCJNYWlsIjoiMTB0b3Bkb211bmRvQGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTA0LTI5IDA1OjE5OjE3IiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.Xxqk6EK5mA1PbIFHwJIftjLL9fXzIUoZapTbaRy-6LYtL1DuYJht-cVUZHHbWw3jiGFA5HJqhWC6K1CiT5PbTr76P381gme5HKJBhzU_g578sB43AoK4gm7mSWf-mmNcOKeBQF_WhVzmFcWb7YCRbED3Zx0c2p3lunshZOflz_9d-3iEC0199ia6v2ted8jA1NtKc21E7xfJxnwAYEjL-bGIz4b3D_i-MStZsJBxcvtFQ0l77KB1KIUMemBnrOhsEIsE088LOFNfazU0v9-DZTvwjplH8uSojo2P2IHlsdpUYnV0aVUj8ckIBHAStFRkH2Cf9hobMpU1n8QvStDlPA";

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
  
  const conversionParams: any = {
    text: text,
    model_id: model,
    output_format: "mp3_44100_128"
  };
  
  if (model === "eleven_flash_v2_5" && language) {
    conversionParams.language_code = language;
  }
  
  const audioStream = await elevenlabs.textToSpeech.convert(voice, conversionParams);
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk as Uint8Array);
  }
  
  const concatenatedArray = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    concatenatedArray.set(chunk, offset);
    offset += chunk.length;
  }
  
  const base64Audio = Buffer.from(concatenatedArray).toString('base64');
  return `data:audio/mp3;base64,${base64Audio}`;
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

    console.log(`📥 Received audio generation request: provider=${provider}, voice=${voice}, model=${model}`);

    if (!text || !provider || !voice) {
      return NextResponse.json({ 
        error: "Missing required fields: text, provider, voice" 
      }, { status: 400 });
    }

    let audioUrl: string;

    switch (provider) {
      case 'minimax':
        audioUrl = await generateMinimaxAudio(text, voice, model || 'speech-02-hd');
        break;
        
      case 'elevenlabs':
        audioUrl = await generateElevenLabsAudio(text, voice, model || 'eleven_multilingual_v2', language || 'en');
        break;
        
      default:
        return NextResponse.json({ 
          error: `Unsupported provider: ${provider}. Only 'minimax' and 'elevenlabs' are supported.` 
        }, { status: 400 });
    }

    console.log(`✅ Audio generated successfully with ${provider}`);

    return NextResponse.json({
      success: true,
      audioUrl,
      provider,
      voice,
      model: model || (provider === 'minimax' ? 'speech-02-hd' : 'eleven_multilingual_v2')
    });

  } catch (error: any) {
    console.error("❌ Error generating audio:", error.message);
    return NextResponse.json(
      { error: `Failed to generate audio: ${error.message}` },
      { status: 500 }
    );
  }
} 