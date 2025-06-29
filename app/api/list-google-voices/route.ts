"use server";

import { NextResponse } from "next/server";
import { listGoogleTtsVoices, GoogleVoice } from "@/utils/google-tts-utils";

export async function GET(request: Request) {
  try {
    console.log("API: Fetching Google TTS voices...");
    const googleVoices = await listGoogleTtsVoices();
    console.log(`API: Successfully fetched ${googleVoices.length} Google TTS voices.`);
    
    // Transform Google voices to match the expected format (id + name)
    const voices = googleVoices.map((voice: GoogleVoice) => ({
      id: voice.name, // Use the voice name as the ID
      name: `${voice.name} (${voice.languageCodes.join(', ')}) - ${voice.ssmlGender}` // Create a descriptive name
    }));
    
    console.log(`API: Transformed to ${voices.length} formatted voices`);
    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error("API: Error fetching Google TTS voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google TTS voices", details: error.message },
      { status: 500 }
    );
  }
} 