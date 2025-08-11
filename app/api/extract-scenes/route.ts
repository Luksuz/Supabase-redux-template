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
  imageStylePrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExtractScenesRequestBody;
    const { script, numberOfScenes, userId = "unknown_user", imageStylePrompt = "" } = body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      return NextResponse.json({ error: 'Script is required' }, { status: 400 });
    }

    if (!numberOfScenes || numberOfScenes < 1 || numberOfScenes > 500) {
      return NextResponse.json({ 
        error: 'Number of scenes must be between 1 and 500' 
      }, { status: 400 });
    }

    console.log(`🎬 Extracting ${numberOfScenes} scenes from script for user ${userId}`);

    // First, create a comprehensive summary of the script to maintain character consistency
    console.log('📝 Creating script summary for character consistency...');
    
    let scriptSummary = '';
    try {
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a script analysis expert. Create a detailed summary that focuses on character descriptions and consistent details for visual representation. This summary will be used to ensure consistent character appearance across multiple image generations.`
          },
          {
            role: "user",
            content: `Analyze this script and create a comprehensive summary focusing on:

1. MAIN CHARACTERS: Name, age, gender, physical appearance, clothing style, personality traits
2. SETTING: Time period, location, atmosphere, recurring environments
3. VISUAL STYLE: Overall mood, tone, visual themes
4. RECURRING ELEMENTS: Objects, symbols, or visual motifs that appear throughout

Script to analyze:
${script}

Provide a concise but detailed summary (max 300 words) that will help maintain visual consistency across scene-by-scene image generation.`
          }
        ],
        temperature: 0.3,
        max_tokens: 400,
      });
      
      scriptSummary = summaryResponse.choices[0]?.message.content?.trim() || '';
      console.log('✅ Script summary created successfully');
    } catch (error) {
      console.warn('⚠️ Failed to create script summary, proceeding without it:', error);
      scriptSummary = '';
    }

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

    // Process chunks in batches to prevent timeouts and rate limiting
    const batchSize = 5; // Process 5 scenes at a time
    const totalBatches = Math.ceil(limitedChunks.length / batchSize);
    const scenes: any[] = [];
    
    console.log(`Processing ${limitedChunks.length} scenes in ${totalBatches} batches of ${batchSize}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, limitedChunks.length);
      const batchChunks = limitedChunks.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (scenes ${startIndex + 1}-${endIndex})`);
      
      const batchPromises = batchChunks.map(async (chunk, batchLocalIndex) => {
        const globalIndex = startIndex + batchLocalIndex;
        try {
          const chunkText = chunk.pageContent;
          
          // Generate detailed image prompt for this chunk
          const promptResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert visual scene designer creating detailed image prompts for AI generation. Your prompts must be HIGHLY SPECIFIC and include precise character details to prevent AI defaults (like generating males instead of females).

CRITICAL REQUIREMENTS:
- Always specify character's gender, age, and physical description
- Include specific clothing, posture, and facial expressions
- Describe exact setting details, lighting, and atmosphere
- Mention camera angle and composition
- Keep under 200 words but be as descriptive as possible
- Focus on visual accuracy over brevity
- MAINTAIN CHARACTER CONSISTENCY using the provided script summary

${scriptSummary ? `SCRIPT SUMMARY FOR CONSISTENCY:
${scriptSummary}

USE THIS SUMMARY to ensure characters appear consistently across all scenes.` : ''}

${imageStylePrompt ? `ADDITIONAL STYLE GUIDELINES:
${imageStylePrompt}` : ''}`
              },
              {
                role: "user",
                content: `
Convert this story chunk into a DETAILED, specific image prompt (max 200 words).

MANDATORY DETAILS TO INCLUDE:
1. Character specifics: age, gender, physical appearance, clothing, posture (USE SCRIPT SUMMARY FOR CONSISTENCY)
2. Setting: specific location, time of day, weather, objects
3. Action: exact body position, facial expression, what they're doing
4. Atmosphere: lighting type, mood, shadows, colors
5. Camera: angle, distance, focus point
6. Style: realistic, cinematic, photographic

Story chunk:
${chunkText}

Example format: "A [specific age] year old [gender] with [hair/features] wearing [specific clothing], [specific posture/action] in [detailed setting], [specific lighting], [camera angle], [artistic style]"

IMPORTANT: Use the script summary above to maintain consistent character descriptions across all scenes. Be extremely specific about gender, age, and physical details to ensure accurate AI generation.
                `
              }
            ],
            temperature: 0.3, // Lower temperature for more consistent, detailed output
            max_tokens: 3000, // Increased for more detailed prompts
          });

          let promptText = promptResponse.choices[0]?.message.content?.trim() || 
            `A detailed scene depicting: ${chunkText.substring(0, 100)}...`;

          // Ensure prompt is under 200 words and 1000 characters for detailed descriptions
          const words = promptText.split(' ');
          if (words.length > 200) {
            promptText = words.slice(0, 200).join(' ');
          }
          
          // Hard limit to 1000 characters for detailed prompts (most models support this)
          if (promptText.length > 1000) {
            promptText = promptText.substring(0, 1000).trim();
            // Ensure we don't cut off mid-word
            const lastSpace = promptText.lastIndexOf(' ');
            if (lastSpace > 900) {
              promptText = promptText.substring(0, lastSpace);
            }
          }

          return {
            chunkIndex: globalIndex,
            originalText: chunkText,
            imagePrompt: promptText,
            summary: `Scene ${globalIndex + 1}`,
          };
        } catch (error: any) {
          console.error(`Error generating prompt for chunk ${globalIndex + 1}:`, error);
          
          // Provide fallback data for failed chunk analysis
          return {
            chunkIndex: globalIndex,
            originalText: chunk.pageContent,
            imagePrompt: `A scene from the story, section ${globalIndex + 1}`,
            summary: `Scene ${globalIndex + 1}`,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Wait for this batch to complete before starting the next
      const batchResults = await Promise.all(batchPromises);
      scenes.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        console.log('Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Scenes are already populated from the batch processing above
    
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