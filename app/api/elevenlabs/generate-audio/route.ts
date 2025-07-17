"use server";

import { NextResponse } from "next/server";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/server'
import { removeYouTubeTimestamps } from '@/utils/youtube-utils'

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = elevenLabsApiKey ? new ElevenLabsClient({ apiKey: elevenLabsApiKey }) : null;

function chunkText(text: string, maxChunkSize: number = 10000): string[] {
  // First, try to split by section boundaries if they exist
  const sectionBoundaries = detectSectionBoundaries(text);
  
  if (sectionBoundaries.length > 0) {
    console.log(`📝 Detected ${sectionBoundaries.length} section boundaries, splitting by sections`);
    return chunkBySections(text, sectionBoundaries, maxChunkSize);
  }
  
  // Fallback to sentence-based chunking if no section boundaries found
  console.log(`📝 No section boundaries detected, using sentence-based chunking`);
  return chunkBySentences(text, maxChunkSize);
}

function detectSectionBoundaries(text: string): Array<{start: number, end: number, title?: string}> {
  const boundaries: Array<{start: number, end: number, title?: string}> = [];
  
  // Look for common section markers (ordered by priority)
  const sectionPatterns = [
    // Script section markers with clear titles
    /^(INTRO|OPENING|HOOK|CONCLUSION|ENDING|OUTRO)[:;\s]/gmi,
    // Section titles with numbers or bullets
    /^(\d+\.\s+[A-Z].+|•\s+[A-Z].+|\*\s+[A-Z].+)/gm,
    // Section headers with caps (at least 3 words)
    /^[A-Z][A-Z\s]{15,}/gm,
    // Common section dividers
    /^(---+|===+|\*\*\*+)/gm,
    // Section breaks with clear indicators
    /^(SECTION\s+\d+|PART\s+\d+|CHAPTER\s+\d+)/gmi,
    // Paragraph breaks that might indicate section changes (3+ line breaks)
    /\n\n\n+/g,
    // Strong topic transitions (This is..., Now let's..., Moving on...)
    /\n\n(This is|Now let's|Moving on|Next up|In this section|The next|Another|Finally)/gmi
  ];
  
  let allMatches: Array<{index: number, text: string, pattern: number}> = [];
  
  // Collect all matches with their pattern priority
  sectionPatterns.forEach((pattern, patternIndex) => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        allMatches.push({
          index: match.index,
          text: match[0].trim(),
          pattern: patternIndex
        });
      }
    });
  });
  
  // Sort by position and filter overlapping matches (prefer higher priority patterns)
  allMatches.sort((a, b) => {
    if (Math.abs(a.index - b.index) < 50) {
      return a.pattern - b.pattern; // Lower pattern number = higher priority
    }
    return a.index - b.index;
  });
  
  // Remove overlapping matches
  const filteredMatches = allMatches.filter((match, index) => {
    if (index === 0) return true;
    const prevMatch = allMatches[index - 1];
    return Math.abs(match.index - prevMatch.index) >= 50;
  });
  
  // Convert to boundaries
  let lastEnd = 0;
  
  for (const match of filteredMatches) {
    if (match.index > lastEnd) {
      boundaries.push({
        start: lastEnd,
        end: match.index,
        title: match.text
      });
      lastEnd = match.index;
    }
  }
  
  // Add final section
  if (lastEnd < text.length) {
    boundaries.push({
      start: lastEnd,
      end: text.length
    });
  }
  
  // Filter out very small sections (less than 500 characters for better quality)
  const validBoundaries = boundaries.filter(b => b.end - b.start > 500);
  
  console.log(`📝 Section boundary detection: found ${boundaries.length} potential boundaries, ${validBoundaries.length} valid boundaries`);
  
  return validBoundaries;
}

function chunkBySections(text: string, boundaries: Array<{start: number, end: number, title?: string}>, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  console.log(`📝 Chunking by sections: ${boundaries.length} sections detected`);
  
  boundaries.forEach((boundary, index) => {
    const sectionText = text.substring(boundary.start, boundary.end).trim();
    const sectionTitle = boundary.title || `Section ${index + 1}`;
    
    console.log(`📝 Processing section ${index + 1}: "${sectionTitle}" (${sectionText.length} characters)`);
    
    if (sectionText.length <= maxChunkSize) {
      // Section fits in one chunk
      chunks.push(sectionText);
      console.log(`📝 Section ${index + 1} fits in one chunk`);
    } else {
      // Section is too large, split by sentences within the section
      console.log(`📝 Section ${index + 1} is too large (${sectionText.length} > ${maxChunkSize}), splitting by sentences`);
      const sectionChunks = chunkBySentences(sectionText, maxChunkSize);
      chunks.push(...sectionChunks);
      console.log(`📝 Section ${index + 1} split into ${sectionChunks.length} chunks`);
    }
  });
  
  const validChunks = chunks.filter(chunk => chunk.trim().length > 0);
  console.log(`📝 Total chunks created: ${validChunks.length}`);
  
  return validChunks;
}

function chunkBySentences(text: string, maxChunkSize: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');
        currentChunk = trimmedSentence;
      } else {
        // Handle very long sentences by breaking them at word boundaries
        const words = trimmedSentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxChunkSize) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + '.');
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

async function generateSingleAudioChunk(
  textChunk: string,
  voiceId: string,
  modelId: string,
  chunkIndex: number,
  voiceSettings?: any
): Promise<Buffer> {
  console.log(`🔊 Generating chunk ${chunkIndex} with ElevenLabs, length: ${textChunk.length}`);
  
  if (!elevenlabs) {
    throw new Error("ElevenLabs client not initialized");
  }
  
  try {
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: textChunk,
      modelId: modelId,
      outputFormat: 'mp3_44100_128',
      ...(voiceSettings && { voice_settings: voiceSettings })
    });

    const streamChunks: Uint8Array[] = [];
    for await (const streamChunk of audioStream) {
      streamChunks.push(streamChunk as Uint8Array);
    }

    const concatenatedUint8Array = new Uint8Array(
      streamChunks.reduce((acc, streamChunk) => acc + streamChunk.length, 0)
    );
    
    let offset = 0;
    for (const streamChunk of streamChunks) {
      concatenatedUint8Array.set(streamChunk, offset);
      offset += streamChunk.length;
    }
    
    const audioBuffer = Buffer.from(concatenatedUint8Array);
    console.log(`✅ Generated chunk ${chunkIndex}, size: ${audioBuffer.length} bytes`);
    return audioBuffer;

  } catch (error: any) {
    console.error(`❌ Error generating audio chunk ${chunkIndex}:`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestBody = await request.json();
    const { 
      text, 
      voiceId, 
      modelId = "eleven_multilingual_v2",
      sectionId,
      voiceSettings
    } = requestBody;

    console.log(`📥 Received audio generation request for section ${sectionId}`);
    console.log(`Text length: ${text?.length || 0}, Voice: ${voiceId}, Model: ${modelId}`);

    if (!text || !voiceId) {
      return NextResponse.json({ error: "Missing required fields: text and voiceId" }, { status: 400 });
    }

    // Check if ElevenLabs API key is available
    if (!elevenLabsApiKey) {
      // Return mock success response for testing
      console.log("⚠️ ElevenLabs API key not found. Returning mock audio generation response.");
      
      // Clean text for consistent behavior
      const cleanedText = removeYouTubeTimestamps(text);
      console.log(`📝 Mock generation using cleaned text: ${cleanedText.substring(0, 100)}...`);
      
      // Update section with mock audio generation status if sectionId provided
      if (sectionId) {
        try {
          await supabase
            .from('fine_tuning_outline_sections')
            .update({ 
              audio_generated: true,
              audio_voice_id: voiceId,
              audio_model_id: modelId,
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId)
            .eq('user_id', user.id);
        } catch (error) {
          console.error('Error updating section:', error);
        }
      }

      // Return mock audio data (empty base64)
      return NextResponse.json({
        success: true,
        audioData: "", // Empty for mock
        audioSize: cleanedText.length * 10, // Mock size calculation
        chunksGenerated: 1,
        totalChunks: 1,
        voiceId,
        modelId,
        mock: true,
        message: "Mock audio generation - Set ELEVENLABS_API_KEY for real audio"
      });
    }

    // Real ElevenLabs audio generation
    console.log("🎵 Starting real ElevenLabs audio generation...");
    
    try {
      // Clean text
      const cleanedText = removeYouTubeTimestamps(text);
      console.log(`📝 Cleaned text: ${cleanedText}`);
      
      // Split text into manageable chunks
      const textChunks = chunkText(cleanedText);
      console.log(`📝 Split text into ${textChunks.length} chunks`);
      
      // Generate audio for each chunk in parallel
      console.log(`🚀 Starting parallel generation of ${textChunks.length} chunks...`);
      const chunkPromises = textChunks.map((chunk, index) => 
        generateSingleAudioChunk(chunk, voiceId, modelId, index + 1, voiceSettings)
      );
      
      // Wait for all chunks to complete (or fail)
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Process results
      const audioChunks: Buffer[] = [];
      const errors: string[] = [];
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          audioChunks.push(result.value);
          console.log(`✅ Chunk ${index + 1} completed successfully`);
        } else {
          console.error(`❌ Chunk ${index + 1} failed:`, result.reason);
          errors.push(`Chunk ${index + 1}: ${result.reason.message || result.reason}`);
        }
      });
      
      if (audioChunks.length === 0) {
        throw new Error("Failed to generate any audio chunks");
      }
      
      // Combine all audio chunks in correct order
      const orderedAudioChunks: Buffer[] = [];
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          orderedAudioChunks.push(result.value);
        }
      });
      
      const totalAudioBuffer = Buffer.concat(orderedAudioChunks);
      const audioBase64 = totalAudioBuffer.toString('base64');
      
      console.log(`✅ Successfully generated ${audioChunks.length}/${textChunks.length} audio chunks`);
      console.log(`📊 Total audio size: ${totalAudioBuffer.length} bytes`);
      
      // Update section with audio generation status if sectionId provided
      if (sectionId && !sectionId.startsWith('custom-')) {
        try {
          await supabase
            .from('fine_tuning_outline_sections')
            .update({ 
              audio_generated: true,
              audio_voice_id: voiceId,
              audio_model_id: modelId,
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId)
            .eq('user_id', user.id);
        } catch (error) {
          console.error('Error updating section:', error);
        }
      }
      
      return NextResponse.json({
        success: true,
        audioData: audioBase64,
        audioSize: totalAudioBuffer.length,
        chunksGenerated: audioChunks.length,
        totalChunks: textChunks.length,
        voiceId,
        modelId,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error: any) {
      console.error("❌ Error in ElevenLabs audio generation:", error);
      return NextResponse.json({
        success: false,
        error: `ElevenLabs generation failed: ${error.message}`
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("❌ Error generating audio:", error);
    return NextResponse.json(
      { error: `Failed to generate audio: ${error.message}` },
      { status: 500 }
    );
  }
} 