import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for individual timestamp result
const TimestampResultSchema = z.object({
  timestamp: z.string().describe("Timestamp in SRT format (HH:MM:SS,mmm) where the relevant content starts"),
  summary: z.string().describe("Detailed summary with specific quotes and dramatic elements"),
  relevantContent: z.string().describe("The actual transcript content that matches the query with exact quotes"),
  confidence: z.number().min(0).max(1).describe("Confidence score of the match (0-1)"),
  dramaticElements: z.array(z.string()).describe("Key dramatic moments, conflicts, or tensions identified"),
  keyQuotes: z.array(z.string()).describe("Most impactful direct quotes from the transcript"),
  contextualInfo: z.string().describe("Background context and significance of this moment")
})

// Zod schema for structured output with up to 3 results
const TranscriptAnalysisSchema = z.object({
  results: z.array(TimestampResultSchema).min(1).max(3).describe("Up to 3 most relevant timestamp results, ordered by relevance, no longer than 3 minutes each")
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

      const prompt = `You are an expert transcript analyzer specializing in extracting dramatic moments, conflicts, and compelling quotes from video content. Your analysis should be detailed and reference-rich, similar to court transcripts and news reports.

I will provide you with an SRT subtitle file and a specific query. Your task is to:

1. Find up to 10 most relevant sections that match the user's query
2. Extract precise timestamps where dramatic or relevant content occurs, no longer than 3 minutes each
3. Provide detailed summaries with specific quotes and dramatic elements
4. Identify key conflicts, tensions, or compelling moments
5. Extract the most impactful direct quotes from the transcript
6. Provide contextual background for each moment's significance

Video Title: ${videoTitle}
User Query: "${query}"

SRT Transcript:
${srtContent}

ANALYSIS REQUIREMENTS:
- Focus on dramatic moments, conflicts, confrontations, or emotionally charged content
- Extract direct quotes verbatim from the transcript
- Identify specific details like names, locations, events mentioned
- Look for moments of tension, surprise, revelation, or conflict
- Provide rich contextual information about what's happening
- Format summaries like detailed news reports or court documentation
- Include specific references to what people said, when they said it, and the circumstances

EXAMPLE FORMAT FOR SUMMARIES:
"At timestamp 00:15:23, the speaker revealed: 'I never thought this would happen to me.' This moment marked a dramatic shift in the narrative as tensions escalated. The speaker's voice became noticeably strained, and background voices can be heard expressing shock. This revelation occurred immediately after [context], making it particularly significant because [explanation]."

Return structured data with:
- timestamp: Exact SRT timestamp
- summary: Detailed narrative summary with quotes and dramatic elements
- relevantContent: Exact transcript text with quotation marks around spoken words
- confidence: Your confidence in the relevance (0-1)
- dramaticElements: Array of key dramatic moments identified
- keyQuotes: Array of the most impactful direct quotes
- contextualInfo: Background context and significance

Order results by dramatic impact and relevance to the query.`

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

  // Create contextual mock results based on query with dramatic elements
  const mockResults = timestamps.map((timestamp, index) => {
    let mockContent = ''
    let dramaticElements: string[] = []
    let keyQuotes: string[] = []
    let contextualInfo = ''
    let confidence = 0.75 - (index * 0.1) // Decreasing confidence for subsequent results
  
    if (query.toLowerCase().includes('confrontation') || query.toLowerCase().includes('fight') || query.toLowerCase().includes('drama')) {
      mockContent = `At timestamp ${timestamp}, tensions reached a breaking point when the speaker declared: 'This ends right now!' The confrontation escalated as voices became increasingly agitated. Background audio reveals multiple people speaking over each other, creating a chaotic atmosphere.`
      dramaticElements = ['Heated confrontation', 'Escalating tensions', 'Multiple voices arguing', 'Emotional outburst']
      keyQuotes = ['This ends right now!', 'You don\'t understand what\'s happening', 'I can\'t believe this is real']
      contextualInfo = 'This moment represents a critical turning point in the narrative, occurring during a period of heightened stress and conflict.'
      confidence = 0.9 - (index * 0.1)
    } else if (query.toLowerCase().includes('reveal') || query.toLowerCase().includes('secret') || query.toLowerCase().includes('truth')) {
      mockContent = `At timestamp ${timestamp}, a shocking revelation emerged when the speaker admitted: 'I never told anyone this before, but...' The admission was followed by a long pause, suggesting the weight of the disclosure. The speaker's tone shifted noticeably, becoming more vulnerable and hesitant.`
      dramaticElements = ['Shocking revelation', 'Emotional vulnerability', 'Long dramatic pause', 'Tone shift']
      keyQuotes = ['I never told anyone this before', 'The truth is finally coming out', 'I can\'t keep this secret anymore']
      contextualInfo = 'This disclosure appears to be a pivotal moment of honesty and transparency, breaking down previously maintained barriers.'
      confidence = 0.85 - (index * 0.1)
    } else if (query.toLowerCase().includes('reaction') || query.toLowerCase().includes('response')) {
      mockContent = `At timestamp ${timestamp}, an intense reaction unfolded as the speaker exclaimed: 'I can't believe what I'm seeing!' The response was immediate and visceral, with audible gasps and exclamations from others present. The emotional intensity of the moment is palpable through the audio.`
      dramaticElements = ['Visceral reaction', 'Audible gasps', 'Immediate response', 'Emotional intensity']
      keyQuotes = ['I can\'t believe what I\'m seeing!', 'This is absolutely insane', 'My heart is racing right now']
      contextualInfo = 'This reaction suggests a moment of genuine surprise or shock, captured in real-time with authentic emotional responses.'
      confidence = 0.8 - (index * 0.1)
    } else {
      mockContent = `At timestamp ${timestamp}, a significant moment occurred when the speaker stated: 'This changes everything we thought we knew.' The declaration was made with conviction, followed by a detailed explanation of the implications. Other participants can be heard expressing agreement and concern.`
      dramaticElements = ['Paradigm shift', 'Conviction in voice', 'Group concern', 'Detailed explanation']
      keyQuotes = ['This changes everything we thought we knew', 'Nothing will be the same after this', 'We need to rethink our approach']
      contextualInfo = 'This moment appears to mark a significant shift in understanding or perspective, with implications for future developments.'
      confidence = 0.75 - (index * 0.1)
    }

    const result: any = {
      timestamp: timestamp,
      summary: mockContent + ` [Mock analysis result ${index + 1} for demonstration purposes]`,
      relevantContent: `"${keyQuotes[0]}" - [Mock transcript content showing the dramatic exchange and surrounding context]`,
      confidence: Math.max(confidence, 0.5), // Ensure minimum confidence of 0.5
      dramaticElements: dramaticElements,
      keyQuotes: keyQuotes,
      contextualInfo: contextualInfo + ` This is simulated analysis data for testing purposes.`
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