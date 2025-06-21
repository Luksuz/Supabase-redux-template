import { NextRequest, NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractScenesRequestBody {
  script: string;
  numberOfScenes: number;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExtractScenesRequestBody;
    const { script, numberOfScenes, userId = "unknown_user" } = body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      return NextResponse.json({ error: 'Script is required' }, { status: 400 });
    }

    if (!numberOfScenes || numberOfScenes < 1 || numberOfScenes > 200) {
      return NextResponse.json({ 
        error: 'Number of scenes must be between 1 and 20' 
      }, { status: 400 });
    }

    console.log(`🎬 Extracting ${numberOfScenes} scenes from script for user ${userId}`);

    // Calculate chunk size based on script length and desired number of scenes
    const textLength = script.length;
    const chunkSize = Math.ceil(textLength / numberOfScenes);
    const chunkOverlap = Math.min(Math.floor(chunkSize * 0.1), 200); // 10% overlap, max 200 chars

    console.log(`Text length: ${textLength}, Chunk size: ${chunkSize}, Chunk overlap: ${chunkOverlap}`);

    // Create text splitter with calculated parameters
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    // Split the text into chunks
    const chunks = await splitter.createDocuments([script]);

    // Limit to the requested number of scenes
    const limitedChunks = chunks.slice(0, numberOfScenes);
    
    console.log(`Created ${limitedChunks.length} chunks from script`);

    // Process each chunk to generate image prompts
    const scenePromises = limitedChunks.map(async (chunk, index) => {
      try {
        const chunkText = chunk.pageContent;
        
        // Generate image prompt for this chunk
        const promptResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: "You are a visual scene designer converting story text into concise image prompts for AI generation. Keep prompts under 100 words and focus on key visual elements."
            },
            {
              role: "user",
              content: `
Convert this story chunk into a SHORT, concise image prompt (max 100 words).
Focus only on: main subject, setting, key action, and mood.
Be specific but brief. No explanations or extra text.

Story chunk:
${chunkText}

Example format: "A [subject] [action] in [setting], [mood/lighting], [style]"
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 150, // Reduced from 300 to ensure shorter prompts
        });

        let promptText = promptResponse.choices[0]?.message.content?.trim() || 
          `A scene depicting: ${chunkText.substring(0, 50)}...`;

        // Ensure prompt is under 100 words and 500 characters for safety
        const words = promptText.split(' ');
        if (words.length > 100) {
          promptText = words.slice(0, 100).join(' ');
        }
        
        // Hard limit to 500 characters to ensure MiniMax compatibility
        if (promptText.length > 500) {
          promptText = promptText.substring(0, 500).trim();
          // Ensure we don't cut off mid-word
          const lastSpace = promptText.lastIndexOf(' ');
          if (lastSpace > 400) {
            promptText = promptText.substring(0, lastSpace);
          }
        }

        return {
          chunkIndex: index,
          originalText: chunkText,
          imagePrompt: promptText,
          summary: `Scene ${index + 1}`,
        };
      } catch (error: any) {
        console.error(`Error generating prompt for chunk ${index + 1}:`, error);
        
        // Provide fallback data for failed chunk analysis
        return {
          chunkIndex: index,
          originalText: chunk.pageContent,
          imagePrompt: `A scene from the story, section ${index + 1}`,
          summary: `Scene ${index + 1}`,
          error: error.message || 'Unknown error'
        };
      }
    });

    const scenes = await Promise.all(scenePromises);
    
    console.log(`✅ Successfully extracted ${scenes.length} scenes with image prompts`);
    
    return NextResponse.json({ 
      scenes,
      totalScenes: scenes.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in scene extraction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to extract scenes from script' 
    }, { status: 500 });
  }
} 