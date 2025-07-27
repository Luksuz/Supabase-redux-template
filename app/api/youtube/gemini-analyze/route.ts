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

CRITICAL ENHANCED NOTATION FORMATS:
Throughout your analysis, identify different types of video elements and use these enhanced formats:

1. **Standard Timestamps** (for quotes and regular moments):
   (00h00m15s): [Speaker Name] "Exact quote if available"
   Extra info: Context about who was speaking to whom and situation details.
Description and significance of this moment.

2. **Enhanced Video Element Formats** (choose the appropriate type):
   - [[BACKGROUND FOOTAGE: 00h00m30s | Description of background footage or B-roll]]
   - [[CRIME SCENE FOOTAGE: 00h02m45s | Police investigation at the scene]]
   - [[THE MOMENT [EVENT]: 00h04m10s | Critical dramatic moment description]]
   - [[SECURITY CAMERA: 00h05m22s | CCTV footage showing the incident]]
   - [[NEWS FOOTAGE: 00h06m15s | News report about the event]]
   - [[COURT FOOTAGE: 00h07m30s | Defendant's reaction in courtroom]]
   - [[DRAMATIC MOMENT: 00h09m20s | Emotional breakdown or confrontation]]
   - [[EVIDENCE FOOTAGE: 00h10m05s | Presentation of key evidence]]

SPEAKER SEPARATION AND DIALOGUE PRECISION REQUIREMENTS:
When analyzing conversations, dialogues, or multiple speakers discussing the same topic:

1. **NEVER COMBINE DIFFERENT SPEAKERS** into a single timestamp entry
2. **CREATE SEPARATE TIMESTAMP ENTRIES** for each speaker, even if they're discussing the same topic
3. **BE PRECISE WITH INDIVIDUAL SPEAKER TIMESTAMPS** - each speaker gets their own specific time range
4. **IDENTIFY CONVERSATION PARTICIPANTS** clearly (e.g., [Interviewer], [Celebrity Name], [Expert], [Witness])
5. **SEPARATE SEQUENTIAL SPEAKERS** even if the topic continues - treat each speaker's contribution as an individual moment

DIALOGUE SEPARATION EXAMPLES:
❌ WRONG - Combining speakers:
(00h06m19s): [Rihanna and Kim Kardashian] "Both advocate for Brown's release"

✅ CORRECT - Separate speakers:
(00h06m19s): [Rihanna] "Specific quote about Brown's release"
Extra info: Rihanna speaking directly to interviewer about her position on the case.
Description and significance of her specific stance.

(00h06m48s): [Kim Kardashian] "Different quote about Brown's release"  
Extra info: Kim Kardashian giving her separate statement to the reporter.
Description and significance of her distinct perspective.

CONVERSATION FLOW ANALYSIS:
- When speakers are having a back-and-forth conversation, create separate entries for each exchange
- When someone responds to another person, note the response relationship in "Extra info"
- When multiple people discuss the same event, treat each person's contribution individually
- Pay attention to cuts between different interviews or settings

TIMESTAMP FORMAT REQUIREMENTS:
1. **ALWAYS use hours/minutes/seconds format with 's' suffix**: 00h00m00s (for single timestamps only)
2. **Examples of CORRECT format**: 00h01m23s, 00h00m05s, 00h15m30s, 01h05m30s
3. **NEVER use time ranges**: Use single timestamps only, not ranges like "00m15 - 00m18"
4. **For times under 1 minute**: Use 00s format (e.g., 05s, 18s)
5. **For times over 1 hour**: Include hours (e.g., 01h05m30s, 02h15m45s)

Examples of the required enhanced formats:
- (00h00m15s): [News Reporter] "4 people were shot and so were 2 cars."
  Extra info: Reporter speaking to camera during live broadcast, appears to be breaking news situation.
  This stark announcement sets a grim tone, emphasizing the severity of the incident.

- [[CRIME SCENE FOOTAGE: 00h02m30s | Police cordoning off the area where the shooting occurred]]

- [[THE MOMENT RAPPER GOT KILLED: 00h05m22s | Security footage capturing the fatal shooting]]

- (00h08m45s): [Witness] "I heard the shots and immediately called 911."
  Extra info: Eyewitness speaking to police detective, hands visibly shaking during interview.
  Provides crucial timeline evidence for the investigation.

- [[COURT FOOTAGE: 00h12m10s | Defendant's emotional breakdown during sentencing]]

FORMATTING RULES:
1. Use the enhanced notation [[TYPE: timestamp | description]] for visual elements, footage, and dramatic moments
2. Use standard (timestamp): [Speaker] format for quotes and dialogue
3. ALWAYS use 00h00m00s timestamp format with 's' suffix - single timestamps only, never ranges
4. Include speaker identification when possible
5. Provide rich context about visual elements, locations, and dramatic significance

Include at least 20-25 timestamp ranges throughout your analysis, marking:
- Important quotes and statements (SEPARATE ENTRY FOR EACH SPEAKER)
- Topic changes and transitions
- Key moments and revelations
- Dramatic or emotional moments
- Significant insights or explanations
- Character introductions or interactions
- Conflict moments or resolutions

CRITICAL QUOTE AND TRANSCRIPT ACCURACY RULES:
1. **NEVER quote from transcripts** - only quote what you actually see/hear in the video
2. **ONLY use direct video quotes** - what speakers actually say on camera
3. **AVOID transcript assumptions** - if you can't clearly hear/see it in the video, don't quote it
4. **SEPARATE ALL SPEAKERS** - even if they discuss the same topic, create individual timestamp entries
5. **PRECISE TIMESTAMP BOUNDARIES** - each speaker gets their exact speaking time, not combined ranges
6. **VERIFY SPEAKER IDENTITY** - only identify speakers you can clearly see/hear, otherwise use [Unknown Speaker]

ENHANCED SPEAKER IDENTIFICATION PROTOCOL:
Be extremely thorough with speaker identification and contextual information. Pay attention to:
- Who is speaking (name, role, relationship to topic) - ONLY if clearly identifiable in video
- Who they are addressing (interviewer, audience, other person)
- The setting and situation during the quote
- Body language or emotional state if visible
- Background context that adds meaning
- Whether this is a separate interview/setting from previous speaker
- If speaker is responding to or building on previous speaker's point

DIALOGUE SEPARATION ENFORCEMENT:
- Each speaker = One timestamp entry
- No combining speakers even for same topic
- Precise individual speaking times
- Clear speaker identification
- Separate context for each speaker's contribution

Focus on elements that would be valuable for content creators, writers, or researchers who need detailed, time-stamped information with full context and precise speaker attribution.`

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