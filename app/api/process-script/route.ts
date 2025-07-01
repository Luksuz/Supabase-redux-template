import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Zod schema for structured output
const SceneAnalysisSchema = z.object({
  visualPrompt: z.string().describe("A detailed visual prompt (15-30 words) for AI image generation describing the key visual elements, setting, composition, and atmosphere"),
  searchQuery: z.string().describe("A concise search query (4-5 words max) for finding stock footage/images on platforms like Pixabay or Storyblocks")
})

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received POST request to /api/process-script')
    
    const body = await request.json()
    console.log('📋 Request body keys:', Object.keys(body))
    
    // Handle new script processor flow
    if ('chunkText' in body) {
      console.log('🎬 Handling script chunk processing')
      return handleScriptChunkProcessing(body);
    }
    
    // Handle other flows if needed
    console.log('❌ Invalid request format - no chunkText found')
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    )
  } catch (error) {
    console.error('💥 Error in script processing route:', error)
    return NextResponse.json(
      { error: 'Failed to process script: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

async function handleScriptChunkProcessing(body: any) {
  const { 
    chunkText, 
    chunkIndex, 
    totalChunks, 
    visualStyle, 
    mood, 
    lighting, 
    customParameters,
    chunkId
  } = body;
  
  console.log(`🎬 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunkId})`)
  console.log(`📝 Chunk text length: ${chunkText?.length || 0}`)
  
  if (!chunkText || chunkText.trim() === '') {
    console.log('❌ No chunk text provided')
    return NextResponse.json(
      { error: "Chunk text is required" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OpenAI API key not configured')
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.' }, 
      { status: 500 }
    )
  }

  console.log('✅ OpenAI API key is configured')

  try {
    console.log(`🎬 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunkId})`)

    // Build the prompt for generating visual prompts and search queries
    let systemPrompt = `You are an expert visual content analyst for AI image generation and stock media search. Your task is to analyze script content and generate two types of outputs:

1. A detailed visual prompt for AI image generation (15-30 words)
2. A concise search query for stock media platforms (4-5 words max)

Based on the script chunk provided, analyze the key visual elements, setting, mood, and atmosphere, then generate both outputs.

Visual Style: ${visualStyle || 'photorealistic'}
Mood & Atmosphere: ${mood || 'dramatic'}
Lighting: ${lighting || 'natural'}

For the visual prompt:
- Focus on visual elements: setting, composition, framing, colors, textures
- Include the specified visual style, mood, and lighting characteristics
- Describe what would be seen in the image, not what is happening narratively
- Make it suitable for AI image generation (Midjourney, DALL-E, etc.)
- Keep it concise but descriptive (15-30 words)
- Ensure it's safe and appropriate content (NSFW)
- Avoid text, dialogue, or narrative elements
- Think like a cinematographer or photographer

For the search query:
- Create a simple, searchable term (4-5 words maximum)
- Focus on the main subject or setting
- Use common stock media keywords
- Think about what someone would search for on Pixabay, Storyblocks, or Shutterstock
- Avoid overly specific or narrative terms
- Use generic, visual descriptors


this is the type of prompt you should NOT do for image generation. dont be gory or point anything out of the family friendly:
A dramatic battlefield scene at dusk, castle walls silhouetted against a darkening sky. Soldiers clash, shields splinter, banners wave, and a red moat churns with bodies. Natural lighting highlights the chaos.
`
    if (customParameters && customParameters.trim()) {
      systemPrompt += `\n\nAdditional visual instructions: ${customParameters.trim()}`
    }

      const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
          content: systemPrompt
          },
          {
            role: "user",
          content: `Analyze this script chunk and generate both a visual prompt and search query:\n\n${chunkText}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scene_analysis",
          schema: {
            type: "object",
            properties: {
              visualPrompt: {
                type: "string",
                description: "A detailed visual prompt (15-30 words) for AI image generation describing the key visual elements, setting, composition, and atmosphere"
              },
              searchQuery: {
                type: "string", 
                description: "A concise search query (4-5 words max) for finding stock footage/images on platforms like Pixabay or Storyblocks"
              }
            },
            required: ["visualPrompt", "searchQuery"],
            additionalProperties: false
          }
        }
      },
      max_tokens: 200,
      temperature: 0.7,
    })

    const responseContent = response.choices[0]?.message?.content?.trim()
    
    if (responseContent) {
      // Parse and validate the structured output
      const parsedResponse = JSON.parse(responseContent)
      const validatedResponse = SceneAnalysisSchema.parse(parsedResponse)
      
      console.log(`✅ Generated content for chunk ${chunkIndex + 1}:`)
      console.log(`   Visual Prompt: ${validatedResponse.visualPrompt}`)
      console.log(`   Search Query: ${validatedResponse.searchQuery}`)
      
      return NextResponse.json({
        success: true,
        prompt: validatedResponse.visualPrompt,
        searchQuery: validatedResponse.searchQuery,
        chunkId: chunkId,
        chunkIndex: chunkIndex
      })
  } else {
      throw new Error('No content generated from OpenAI')
    }

  } catch (openaiError: any) {
    console.error(`❌ OpenAI API error for chunk ${chunkIndex + 1}:`, openaiError)
    
    return NextResponse.json({
      success: false,
      error: `Failed to generate content: ${openaiError.message}`,
      chunkId: chunkId,
      chunkIndex: chunkIndex
    }, { status: 500 })
  }
}