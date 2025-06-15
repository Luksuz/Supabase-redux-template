"use server";

import { NextResponse } from "next/server";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/server'

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = elevenLabsApiKey ? new ElevenLabsClient({ apiKey: elevenLabsApiKey }) : null;

function chunkText(text: string, maxChunkSize: number = 10000): string[] {
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
  chunkIndex: number
): Promise<Buffer> {
  console.log(`🔊 Generating chunk ${chunkIndex} with ElevenLabs, length: ${textChunk.length}`);
  
  if (!elevenlabs) {
    throw new Error("ElevenLabs client not initialized");
  }
  
  try {
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: textChunk,
      modelId: modelId,
      outputFormat: 'mp3_44100_128'
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
      sectionId
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
        audioSize: text.length * 10, // Mock size calculation
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
      // Split text into manageable chunks
      const textChunks = chunkText(text);
      console.log(`📝 Split text into ${textChunks.length} chunks`);
      
      // Generate audio for each chunk in parallel
      console.log(`🚀 Starting parallel generation of ${textChunks.length} chunks...`);
      const chunkPromises = textChunks.map((chunk, index) => 
        generateSingleAudioChunk(chunk, voiceId, modelId, index + 1)
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