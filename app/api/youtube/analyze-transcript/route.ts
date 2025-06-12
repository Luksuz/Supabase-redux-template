import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for structured output
const TranscriptAnalysisSchema = z.object({
  timestamp: z.string().describe("Timestamp in SRT format (HH:MM:SS,mmm) where the relevant content starts"),
  summary: z.string().describe("Summary of the relevant transcript section"),
  relevantContent: z.string().describe("The actual transcript content that matches the query"),
  confidence: z.number().min(0).max(1).describe("Confidence score of the match (0-1)")
})

interface AnalyzeTranscriptRequest {
  srtContent: string
  query: string
  videoTitle: string
  videoId?: string // Make videoId optional for backward compatibility
}

// Helper function to convert SRT timestamp to YouTube seconds
function srtToSeconds(srtTimestamp: string): number {
  try {
    // Parse HH:MM:SS,mmm format
    const [time, milliseconds] = srtTimestamp.split(',')
    const [hours, minutes, seconds] = time.split(':').map(Number)
    const ms = parseInt(milliseconds) || 0
    
    return hours * 3600 + minutes * 60 + seconds + ms / 1000
  } catch (error) {
    console.error('Error parsing SRT timestamp:', srtTimestamp, error)
    return 0
  }
}

// Helper function to generate YouTube URL with timestamp
function generateYouTubeUrl(videoId: string, srtTimestamp: string): string {
  const seconds = Math.floor(srtToSeconds(srtTimestamp))
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/analyze-transcript ===')
  
  try {
    console.log('Parsing request body...')
    const requestBody: AnalyzeTranscriptRequest = await request.json()
    console.log('Request body received:', {
      query: requestBody.query,
      videoTitle: requestBody.videoTitle,
      videoId: requestBody.videoId,
      srtContentLength: requestBody.srtContent?.length || 0
    })
    
    const { srtContent, query, videoTitle, videoId } = requestBody

    if (!srtContent || !query) {
      console.log('Validation failed: missing required fields')
      return NextResponse.json(
        { error: 'SRT content and query are required' },
        { status: 400 }
      )
    }

    console.log('Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock analysis')
      const mockAnalysis = generateMockAnalysis(query, srtContent, videoId)
      console.log('Generated mock analysis')
      return NextResponse.json({
        success: true,
        analysis: mockAnalysis,
        usingMock: true
      })
    }

    console.log(`🚀 Analyzing transcript for query: "${query}" in video: "${videoTitle}"`)

    try {
      // Create ChatOpenAI model
      const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.3, // Lower temperature for more precise analysis
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      // Bind schema to model using structured output
      const modelWithStructure = model.withStructuredOutput(TranscriptAnalysisSchema)

      const prompt = `You are an expert transcript analyzer. I will provide you with an SRT subtitle file and a specific query. Your task is to:

1. Find the most relevant section in the transcript that matches the user's query
2. Extract the precise timestamp where that relevant content starts
3. Provide a concise summary of what's discussed starting from that timestamp
4. Include the actual relevant transcript content
5. Rate your confidence in the match

Video Title: ${videoTitle}
User Query: "${query}"

SRT Transcript:
${srtContent}

Instructions:
- Look for content that directly relates to the user's query
- If the query mentions specific phrases, prioritize exact or near-exact matches
- If it's a topical query, find where that topic is most thoroughly discussed
- Provide the timestamp where the relevant discussion begins
- The summary should be concise but informative (2-3 sentences)
- Confidence should be high (0.8+) for exact matches, lower for topical matches
- Return only the timestamp where the content starts (not an end timestamp)

Return only the structured data without any additional text or formatting.`

      console.log('Sending request to OpenAI via LangChain...')
      console.log('Query:', query)
      console.log('SRT content length:', srtContent.length)

      // Invoke the model to produce structured output
      const structuredOutput = await modelWithStructure.invoke(prompt)

      console.log('LangChain structured output received')
      console.log('Structured output:', structuredOutput)
      
      // Validate the structured output with our schema
      const validatedAnalysis = TranscriptAnalysisSchema.parse(structuredOutput)
      
      // Add YouTube URL if videoId is provided
      const result: any = {
        ...validatedAnalysis
      }
      
      if (videoId) {
        result.youtubeUrl = generateYouTubeUrl(videoId, validatedAnalysis.timestamp)
        console.log('Generated YouTube URL:', result.youtubeUrl)
      }
      
      console.log(`✅ Analysis completed for query: "${query}"`)
      console.log('Timestamp:', validatedAnalysis.timestamp)
      console.log('Confidence:', validatedAnalysis.confidence)
      
      return NextResponse.json({
        success: true,
        analysis: result,
        usingMock: false
      })

    } catch (langchainError: any) {
      console.error(`❌ LangChain error for query "${query}":`, langchainError)
      console.error('LangChain error details:', {
        name: langchainError.name,
        message: langchainError.message,
        stack: langchainError.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      })
      
      // Fallback to mock if LangChain fails
      console.log('Falling back to mock analysis...')
      const mockAnalysis = generateMockAnalysis(query, srtContent, videoId)
      
      return NextResponse.json({
        success: true,
        analysis: mockAnalysis,
        usingMock: true,
        error: langchainError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in analyze-transcript:', error)
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error occurred while analyzing transcript' 
      },
      { status: 500 }
    )
  }
}

// Mock analysis generator for testing and fallback
function generateMockAnalysis(query: string, srtContent: string, videoId?: string) {
  console.log('Generating mock analysis for query:', query)
  
  // Extract first timestamp entry for mock data
  const lines = srtContent.split('\n')
  let timestamp = "00:00:05,000"
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.includes(' --> ')) {
      const [start] = line.split(' --> ')
      timestamp = start
      break
    }
  }

  // Create contextual mock based on query
  let mockContent = `This is a mock analysis for "${query}". `
  let confidence = 0.75
  
  if (query.toLowerCase().includes('time') || query.toLowerCase().includes('when')) {
    mockContent += "The speaker discusses timing and scheduling in this segment."
    confidence = 0.8
  } else if (query.toLowerCase().includes('how')) {
    mockContent += "The speaker explains the process and methodology."
    confidence = 0.85
  } else if (query.toLowerCase().includes('what')) {
    mockContent += "The speaker defines and describes the concept."
    confidence = 0.9
  } else {
    mockContent += "The speaker covers the topic mentioned in your query."
  }

  const result: any = {
    timestamp: timestamp,
    summary: `Mock summary: ${mockContent} This is simulated content for demonstration purposes.`,
    relevantContent: `"${mockContent} [Mock transcript content would appear here]"`,
    confidence: confidence
  }

  // Add YouTube URL if videoId is provided
  if (videoId) {
    result.youtubeUrl = generateYouTubeUrl(videoId, timestamp)
  }

  return result
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Transcript analysis API is running',
    endpoints: {
      POST: 'Analyze transcript content with a specific query'
    }
  })
} 