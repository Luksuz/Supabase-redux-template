import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for Gemini video analysis (moved from gemini-analyze route)
const GeminiVideoAnalysisSchema = z.object({
  videoId: z.string().describe("The YouTube video ID"),
  title: z.string().describe("The video title"),
  summary: z.string().describe("Comprehensive summary of the video content"),
  keyPoints: z.array(z.string()).describe("Main points and insights from the video (5-8 points)"),
  timestamps: z.array(z.object({
    startTime: z.string().describe("Start timestamp in format MM:SS or HH:MM:SS"),
    endTime: z.string().describe("End timestamp in format MM:SS or HH:MM:SS"),
    speaker: z.string().describe("Speaker name or [Unknown Speaker] if unclear"),
    quote: z.string().optional().describe("Exact quote if available"),
    extraInfo: z.string().describe("Context about who was speaking to whom and situation details"),
    description: z.string().describe("What happens during this time range"),
    significance: z.string().describe("Why this moment is important")
  })).describe("Key timestamp ranges and moments in the video with speaker information"),
  topics: z.array(z.string()).describe("Main topics and themes discussed"),
  emotionalTone: z.string().describe("Overall emotional tone and mood"),
  keyQuotes: z.array(z.object({
    startTime: z.string().describe("Start time of quote"),
    endTime: z.string().describe("End time of quote"),
    speaker: z.string().describe("Who said this quote"),
    quote: z.string().describe("The exact quote"),
    context: z.string().describe("Context about the situation and who they were speaking to")
  })).describe("Important quotes with full context"),
  actionableInsights: z.array(z.string()).describe("Practical takeaways and insights"),
  characterInsights: z.array(z.string()).describe("Insights about people or characters mentioned"),
  conflictElements: z.array(z.string()).describe("Conflicts, tensions, or dramatic moments"),
  storyIdeas: z.array(z.string()).describe("Potential story concepts inspired by the content"),
  creativePrompt: z.string().describe("A creative writing prompt based on the video content")
})

interface ParseGeminiRequest {
  videoId: string
  videoTitle: string
  videoUrl: string
  geminiRawResponse: string
  query?: string
}

export async function POST(request: NextRequest) {
  console.log('🤖 GPT-4o-mini Gemini parsing endpoint hit')
  
  try {
    const { videoId, videoTitle, videoUrl, geminiRawResponse, query }: ParseGeminiRequest = await request.json()
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    if (!geminiRawResponse || !videoId || !videoTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, videoTitle, and geminiRawResponse' },
        { status: 400 }
      )
    }

    console.log(`📝 Parsing Gemini response for video: ${videoTitle}`)
    console.log('Raw response length:', geminiRawResponse.length)

    // Create ChatOpenAI model
    const model = new ChatOpenAI({
      modelName: "gpt-4.1",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    // Bind schema to model using structured output
    const modelWithStructure = model.withStructuredOutput(GeminiVideoAnalysisSchema)

    const prompt = `You are a structured data parser specializing in video analysis. Parse the provided Gemini AI video analysis response into the exact structured format required.

Video Information:
- Video ID: ${videoId}
- Title: ${videoTitle}
- Video URL: ${videoUrl}
${query ? `- Analysis Focus: ${query}` : ''}

Your task is to extract and organize the following information from the Gemini response:
- summary: A comprehensive overall summary
- keyPoints: Array of 5-8 main points and insights
- timestamps: Array of objects with {startTime, endTime, speaker, quote, extraInfo, description, significance} - CAREFULLY extract any timestamps mentioned in MM:SS or HH:MM:SS format
- topics: Array of main topics and themes covered
- emotionalTone: Overall emotional tone and mood description
- keyQuotes: Array of objects with full quote context including {startTime, endTime, speaker, quote, context}
- actionableInsights: Array of practical takeaways and insights
- characterInsights: Array of insights about people/characters mentioned
- conflictElements: Array of conflicts, tensions, or dramatic moments
- storyIdeas: Array of creative story concepts inspired by the content
- creativePrompt: A creative writing prompt based on the video content

SPECIAL ATTENTION TO ENHANCED NOTATION FORMATS:
Look for both standard timestamps and enhanced video element formats:

1. **Standard Timestamps**:
- (00m15 - 00m18): [Speaker] "Quote"
- (01m23 - 01m45): [Speaker Name] "Exact quote"

2. **Enhanced Video Elements**:
- [[BACKGROUND FOOTAGE: 00m30 - 01m15 | Description]]
- [[CRIME SCENE FOOTAGE: 02m45 - 03m20 | Description]]
- [[THE MOMENT [EVENT]: 04m10 - 04m35 | Description]]
- [[SECURITY CAMERA: 05m22 - 05m40 | Description]]
- [[NEWS FOOTAGE: 06m15 - 06m45 | Description]]
- [[COURT FOOTAGE: 07m30 - 08m10 | Description]]
- [[DRAMATIC MOMENT: 09m20 - 09m50 | Description]]
- [[EVIDENCE FOOTAGE: 10m05 - 10m35 | Description]]

For standard timestamps, extract:
- startTime: Convert from 00m00 format to "00:00:00" (e.g., "00m15" → "00:00:15")
- endTime: Convert from 00m00 format to "00:00:00" (e.g., "00m18" → "00:00:18")
- speaker: Speaker name from [brackets] or "Unknown Speaker"
- quote: Exact quote from "quotation marks" (optional if not available)
- extraInfo: Context from "Extra info:" or surrounding context about who was speaking to whom
- description: What happens during this time range
- significance: Why this moment is important

For enhanced video elements, create timestamp objects with:
- startTime: Convert from 00m00 format to "00:00:00"
- endTime: Convert from 00m00 format to "00:00:00"
- speaker: Use the element type (e.g., "Background Footage", "Crime Scene", "Security Camera")
- quote: Use the description after the | symbol
- extraInfo: Use the element type and context
- description: Use the full description after the |
- significance: Infer from the element type and content

For keyQuotes, create objects with:
- startTime: Convert from 00m00 format to "00:00:00"
- endTime: Convert from 00m00 format to "00:00:00"
- speaker: Who said the quote
- quote: The exact quote text
- context: Full context about the situation and who they were speaking to

TIMESTAMP CONVERSION EXAMPLES:
- "00m15" → "00:00:15"
- "01m23" → "00:01:23" 
- "15m30" → "00:15:30"
- "01h05m30" → "01:05:30"

PARSING EXAMPLES:
Standard format: "(00m15 - 00m18): [News Reporter] '4 people were shot and so were 2 cars.' Extra info: Reporter speaking to camera..."
Extract as:
- startTime: "00:00:15"
- endTime: "00:00:18"
- speaker: "News Reporter"
- quote: "4 people were shot and so were 2 cars."
- extraInfo: "Reporter speaking to camera during live broadcast"
- description: "News reporter announces shooting incident"
- significance: "Sets grim tone and emphasizes severity of incident"

Enhanced format: "[[CRIME SCENE FOOTAGE: 02m30 - 03m15 | Police cordoning off the area where the shooting occurred]]"
Extract as:
- startTime: "00:02:30"
- endTime: "00:03:15"
- speaker: "Crime Scene Footage"
- quote: "Police cordoning off the area where the shooting occurred"
- extraInfo: "Crime scene footage showing police investigation"
- description: "Police cordoning off the area where the shooting occurred"
- significance: "Visual evidence of crime scene investigation"

Be very careful to parse the exact format and extract all available context information. If the new format isn't found, try to extract any timestamp information available and convert it to the required structure.

Gemini AI Response to Parse:
${geminiRawResponse}`

    console.log('Sending to GPT-4o-mini with LangChain structured output...')
    
    // Invoke the model to produce structured output
    const structuredOutput = await modelWithStructure.invoke(prompt)
    
    console.log('LangChain structured output received')
    
    // Validate the structured output with our schema
    const validatedAnalysis = GeminiVideoAnalysisSchema.parse(structuredOutput)

    console.log('Validated analysis:', validatedAnalysis)
    
    console.log('✅ Successfully parsed Gemini response with GPT-4o-mini and LangChain')
    console.log('Parsed analysis:', {
      summaryLength: validatedAnalysis.summary.length,
      keyPointsCount: validatedAnalysis.keyPoints.length,
      timestampsCount: validatedAnalysis.timestamps.length,
      topicsCount: validatedAnalysis.topics.length
    })

    return NextResponse.json({
      success: true,
      analysis: validatedAnalysis,
      parsedWithGPT: true,
      originalGeminiResponse: geminiRawResponse
    })

  } catch (error) {
    console.error('💥 Error parsing Gemini response:', error)
    return NextResponse.json(
      { 
        error: 'Failed to parse Gemini response', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
} 