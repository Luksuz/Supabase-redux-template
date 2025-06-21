"use server";

import { NextResponse } from "next/server";
import { listGoogleTtsVoices, GoogleVoice } from "@/utils/google-tts-utils";

export async function GET(request: Request) {
  try {
    console.log("API: Fetching Google TTS voices...");
    const voices = await listGoogleTtsVoices();
    console.log(`API: Successfully fetched ${voices.length} Google TTS voices.`);
    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error("API: Error fetching Google TTS voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google TTS voices", details: error.message },
      { status: 500 }
    );
  }
} 