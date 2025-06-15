import { NextResponse } from "next/server";

// Mock voices for testing when ElevenLabs API is not available
const mockVoices = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "Generated" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "Generated" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "Generated" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "Generated" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "Generated" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "Generated" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "Generated" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "Generated" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "Generated" },
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", category: "Generated" }
];

export async function GET() {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // If no API key, return mock voices
  if (!elevenLabsApiKey) {
    console.log("⚠️ ElevenLabs API key not found. Returning mock voices for testing.");
    return NextResponse.json({ 
      voices: mockVoices,
      mock: true,
      message: "Using mock voices - Set ELEVENLABS_API_KEY for real voices"
    });
  }

  try {
    // Try to use the real ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();
    
    const simplifiedVoices = data.voices.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      preview_url: voice.preview_url 
    }));

    console.log(`✅ Successfully fetched ${simplifiedVoices.length} voices from ElevenLabs.`);
    return NextResponse.json({ voices: simplifiedVoices });

  } catch (error) {
    console.error("❌ Error fetching ElevenLabs voices:", error);
    console.log("🔄 Falling back to mock voices");
    
    return NextResponse.json({ 
      voices: mockVoices,
      mock: true,
      message: "API error - Using mock voices. Check your ELEVENLABS_API_KEY.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 