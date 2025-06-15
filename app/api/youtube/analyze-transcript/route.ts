import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for individual timestamp result
const TimestampResultSchema = z.object({
  timestamp: z.string().describe("Timestamp in SRT format (HH:MM:SS,mmm) where the relevant content starts"),
  summary: z.string().describe("Summary of the relevant transcript section"),
  relevantContent: z.string().describe("The actual transcript content that matches the query"),
  confidence: z.number().min(0).max(1).describe("Confidence score of the match (0-1)")
})

// Zod schema for structured output with up to 3 results
const TranscriptAnalysisSchema = z.object({
  results: z.array(TimestampResultSchema).min(1).max(3).describe("Up to 3 most relevant timestamp results, ordered by relevance")
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

1. Find up to 3 most relevant sections in the transcript that match the user's query
2. Extract the precise timestamp where each relevant content starts
3. Provide a concise summary of what's discussed starting from each timestamp
4. Include the actual relevant transcript content for each result
5. Rate your confidence in each match
6. Order results by relevance (most relevant first)

Video Title: ${videoTitle}
User Query: "${query}"

SRT Transcript:
${srtContent}

Instructions:
- Look for content that directly relates to the user's query
- If the query mentions specific phrases, prioritize exact or near-exact matches
- If it's a topical query, find where that topic is discussed throughout the video
- Provide up to 3 different timestamps where relevant discussion occurs
- Each result should represent a distinct section or moment in the video
- Avoid duplicate or overlapping content - each result should be meaningfully different
- The summary for each should be concise but informative (2-3 sentences)
- Confidence should be high (0.8+) for exact matches, lower for topical matches
- Return only the timestamp where each content starts (not end timestamps)
- Order results from most relevant to least relevant

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
      
      // Add YouTube URLs if videoId is provided
      const results = validatedAnalysis.results.map(result => {
        const enhancedResult: any = { ...result }
      if (videoId) {
          enhancedResult.youtubeUrl = generateYouTubeUrl(videoId, result.timestamp)
      }
        return enhancedResult
      })
      
      console.log(`✅ Analysis completed for query: "${query}"`)
      console.log(`Found ${results.length} relevant timestamps`)
      results.forEach((result, index) => {
        console.log(`Result ${index + 1}: ${result.timestamp} (confidence: ${result.confidence})`)
      })
      
      return NextResponse.json({
        success: true,
        analysis: results, // Return array of results instead of single result
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

// Mock analysis generator for testing and fallback - now returns up to 3 results
function generateMockAnalysis(query: string, srtContent: string, videoId?: string) {
  console.log('Generating mock analysis for query:', query)
  
  // Extract multiple timestamp entries for mock data
  const lines = srtContent.split('\n')
  const timestamps: string[] = []
  
  for (let i = 0; i < lines.length && timestamps.length < 3; i++) {
    const line = lines[i].trim()
    if (line.includes(' --> ')) {
      const [start] = line.split(' --> ')
      timestamps.push(start)
    }
  }
  
  // Ensure we have at least one timestamp
  if (timestamps.length === 0) {
    timestamps.push("00:00:05,000")
  }

  // Create contextual mock results based on query
  const mockResults = timestamps.map((timestamp, index) => {
    let mockContent = `This is mock analysis result ${index + 1} for "${query}". `
    let confidence = 0.75 - (index * 0.1) // Decreasing confidence for subsequent results
  
  if (query.toLowerCase().includes('time') || query.toLowerCase().includes('when')) {
      mockContent += `The speaker discusses timing and scheduling in this segment (part ${index + 1}).`
      confidence = 0.8 - (index * 0.1)
  } else if (query.toLowerCase().includes('how')) {
      mockContent += `The speaker explains the process and methodology (aspect ${index + 1}).`
      confidence = 0.85 - (index * 0.1)
  } else if (query.toLowerCase().includes('what')) {
      mockContent += `The speaker defines and describes the concept (definition ${index + 1}).`
      confidence = 0.9 - (index * 0.1)
  } else {
      mockContent += `The speaker covers the topic mentioned in your query (section ${index + 1}).`
  }

  const result: any = {
    timestamp: timestamp,
      summary: `Mock summary ${index + 1}: ${mockContent} This is simulated content for demonstration purposes.`,
    relevantContent: `"${mockContent} [Mock transcript content would appear here]"`,
      confidence: Math.max(confidence, 0.5) // Ensure minimum confidence of 0.5
  }

  // Add YouTube URL if videoId is provided
  if (videoId) {
    result.youtubeUrl = generateYouTubeUrl(videoId, timestamp)
  }

  return result
  })

  return mockResults
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Transcript analysis API is running',
    endpoints: {
      POST: 'Analyze transcript content with a specific query'
    }
  })
} 