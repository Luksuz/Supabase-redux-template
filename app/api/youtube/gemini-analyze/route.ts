import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface GeminiAnalyzeRequest {
  videoId: string
  videoUrl: string
  title: string
  query?: string
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/youtube/gemini-analyze ===')
  
  try {
    console.log('Parsing request body...')
    const requestBody: GeminiAnalyzeRequest = await request.json()
    console.log('Request body received:', {
      videoId: requestBody.videoId,
      videoUrl: requestBody.videoUrl,
      title: requestBody.title,
      query: requestBody.query
    })
    
    const { videoId, videoUrl, title, query } = requestBody

    if (!videoId || !videoUrl) {
      console.log('Validation failed: missing required fields')
      return NextResponse.json(
        { error: 'Video ID and URL are required' },
        { status: 400 }
      )
    }

    console.log('Checking Google API key...')
    if (!process.env.GOOGLE_API_KEY) {
      console.error('Google API key not found')
      return NextResponse.json(
        { error: 'Google API key not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    console.log(`🚀 Analyzing video with Gemini: "${title}" (${videoId})`)

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" })

    // Create analysis prompt
    const analysisPrompt = query 
      ? `Analyze this YouTube video with a focus on: "${query}". Provide detailed analysis including timestamps, key moments, quotes, and insights. Pay special attention to elements related to the query while still providing comprehensive coverage of the video content.`
      : `Analyze this YouTube video comprehensively. Provide detailed analysis including timestamps, key moments, quotes, character insights, conflicts, and story elements. Focus on dramatic moments, important revelations, and content that would be valuable for storytelling or content creation.`

    const fullPrompt = `${analysisPrompt}

Please provide your analysis in a detailed format covering:
- Comprehensive summary of the video content
- Key points and insights with timestamp ranges
- Important timestamp ranges with descriptions, speaker information, and significance
- Main topics and themes
- Emotional tone and mood
- Key quotes with speaker context
- Actionable insights and takeaways
- Character insights (if applicable)
- Conflict elements or dramatic moments
- Story ideas inspired by the content
- A creative writing prompt based on the video

CRITICAL TIMESTAMP FORMAT REQUIREMENTS:
Throughout your analysis, you MUST use this exact format for timestamps:

(START_TIME - END_TIME): [Speaker Name if identifiable] "Exact quote if available"

Extra context: Who was speaking, who they were speaking to, situation details, etc.

Description and significance of this moment.

Examples of the required format:
- (00:01:54 - 00:01:57): [News Reporter] "4 people were shot and so were 2 cars."
  Extra info: Reporter speaking to camera during live broadcast, appears to be breaking news situation.
  This stark announcement sets a grim tone, emphasizing the severity of the incident.

- (00:05:23 - 00:05:31): [Interview Subject] "I never thought this would happen in our neighborhood."
  Extra info: Elderly resident speaking to news crew, visibly shaken, other neighbors gathering nearby.
  Shows the community impact and emotional response to the events.

FORMATTING RULES:
1. ALWAYS use timestamp ranges: (MM:SS - MM:SS) or (HH:MM:SS - HH:MM:SS)
2. Include speaker identification in [brackets] when possible, or [Unknown Speaker] if unclear
3. Put exact quotes in "quotation marks" when available
4. Follow with "Extra info:" line providing context about who was speaking to whom and situation
5. Then provide analysis of significance

Include at least 20-25 timestamp ranges throughout your analysis, marking:
- Important quotes and statements
- Topic changes and transitions
- Key moments and revelations
- Dramatic or emotional moments
- Significant insights or explanations
- Character introductions or interactions
- Conflict moments or resolutions

Be extremely thorough with speaker identification and contextual information. Pay attention to:
- Who is speaking (name, role, relationship to topic)
- Who they are addressing (interviewer, audience, other person)
- The setting and situation during the quote
- Body language or emotional state if visible
- Background context that adds meaning

Focus on elements that would be valuable for content creators, writers, or researchers who need detailed, time-stamped information with full context.`

    console.log('Sending request to Gemini AI...')
    
    // Generate content using Gemini with video URL
    const result = await model.generateContent([
      fullPrompt,
      {
        fileData: {
          fileUri: videoUrl,
          mimeType: 'video/mp4'
        },
      },
    ])

    console.log('Gemini AI response received')
    const responseText = result.response.text()
    
    console.log(`✅ Gemini analysis completed for video: "${title}"`)
    console.log('Raw response length:', responseText.length)
    
    return NextResponse.json({
      success: true,
      rawResponse: responseText,
      videoId,
      title,
      query: query || null,
      usingGemini: true
    })

  } catch (error) {
    console.error('Error in gemini-analyze:', error)
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    
    // Check if it's a specific Gemini API error
    if ((error as Error).message.includes('fileUri')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to analyze video: Video may not be accessible or supported by Gemini AI. Try using the standard analysis method instead.'
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze video with Gemini: ' + (error as Error).message
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Gemini video analysis API is running',
    endpoints: {
      POST: 'Analyze YouTube video using Google Gemini AI (returns raw response)'
    }
  })
} 