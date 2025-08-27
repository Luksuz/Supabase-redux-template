import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
let elevenlabs: ElevenLabsClient | null = null;

if (elevenLabsApiKey) {
  elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsApiKey });
} else {
  console.warn("⚠️ ElevenLabs API key not found. Voice listing will not be available.");
}

export async function GET() {
  if (!elevenlabs) {
    return NextResponse.json(
      { error: "ElevenLabs client not initialized. Check API key." },
      { status: 500 }
    );
  }

  try {
    console.log("🗣️ Fetching ALL ElevenLabs voices using paginated search API...");
    
    let allVoices: any[] = [];
    let nextPageToken: string | undefined = undefined;
    let currentPage = 1;
    const maxPages = 50; // Safety limit to prevent infinite loops
    
    do {
      console.log(`📄 Fetching page ${currentPage}${nextPageToken ? ` (token: ${nextPageToken.substring(0, 20)}...)` : ''}...`);
      
      const voicesResponse = await elevenlabs.voices.search({
        includeTotalCount: true,
        ...(nextPageToken && { nextPageToken })
      });
      
      console.log(`📦 Page ${currentPage}: Got ${voicesResponse.voices.length} voices`);
      allVoices.push(...voicesResponse.voices);
      
      nextPageToken = voicesResponse.nextPageToken;
      currentPage++;
      
      // Log progress
      if (voicesResponse.totalCount) {
        console.log(`📊 Progress: ${allVoices.length}/${voicesResponse.totalCount} voices loaded`);
      }
      
    } while (nextPageToken && currentPage <= maxPages);
    
    console.log(`🎉 Finished fetching! Total voices collected: ${allVoices.length}`);
    
    const simplifiedVoices = allVoices.map(voice => ({
      value: voice.voiceId,
      label: voice.name || 'Unknown Voice',
      category: voice.category,
      preview_url: voice.previewUrl || undefined,
      description: voice.description || undefined,
      labels: voice.labels || {},
      is_legacy: voice.isLegacy || false
    }));

    // Sort voices: put custom/cloned voices first, then default voices
    const sortedVoices = simplifiedVoices.sort((a, b) => {
      // Prioritize custom/generated voices over premade
      if (a.category === 'generated' && b.category !== 'generated') return -1;
      if (a.category !== 'generated' && b.category === 'generated') return 1;
      // Then sort alphabetically by name
      return (a.label || '').localeCompare(b.label || '');
    });

    console.log(`✅ Successfully processed ${sortedVoices.length} voices from ElevenLabs API.`);
    console.log(`📈 Categories breakdown:`, sortedVoices.reduce((acc, voice) => {
      acc[voice.category] = (acc[voice.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));
    
    return NextResponse.json({ 
      voices: sortedVoices,
      total_count: allVoices.length,
      pages_fetched: currentPage - 1,
      has_more: false // We fetched all available voices
    });

  } catch (error) {
    console.error("❌ Error fetching ElevenLabs voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch ElevenLabs voices" },
      { status: 500 }
    );
  }
} 