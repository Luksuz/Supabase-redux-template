import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for video summary with enhanced dramatic elements
const VideoSummarySchema = z.object({
  videoId: z.string().describe("The video ID"),
  title: z.string().describe("The video title"),
  keyPoints: z.array(z.string()).describe("Main points with specific quotes and dramatic elements (3-5 points)"),
  mainTopic: z.string().describe("The primary topic or theme of the video"),
  timestamp: z.string().optional().describe("Most important timestamp if applicable"),
  narrativeElements: z.array(z.string()).describe("Story elements, characters, conflicts, or narrative structures with specific details"),
  emotionalTone: z.string().describe("The overall emotional tone or mood of the content"),
  dramaticElements: z.array(z.string()).describe("Key dramatic moments, conflicts, or tensions identified"),
  keyQuotes: z.array(z.string()).describe("Most impactful direct quotes from the transcript"),
  contextualInfo: z.string().describe("Background context and significance of the content")
})

// Zod schema for overall summary with enhanced dramatic format
const VideosSummarySchema = z.object({
  overallTheme: z.string().describe("Common theme with specific quotes and dramatic references"),
  keyInsights: z.array(z.string()).describe("Top 5-7 insights with specific quotes and references"),
  videoSummaries: z.array(VideoSummarySchema).describe("Individual summaries for each video"),
  commonPatterns: z.array(z.string()).describe("Common patterns with specific examples and quotes"),
  actionableItems: z.array(z.string()).describe("Actionable insights with supporting evidence"),
  narrativeThemes: z.array(z.string()).describe("Central themes with dramatic elements and quotes"),
  characterInsights: z.array(z.string()).describe("Character insights with specific behavioral examples"),
  conflictElements: z.array(z.string()).describe("Conflicts with specific quotes and dramatic moments"),
  storyIdeas: z.array(z.string()).describe("Story concepts with specific dramatic scenarios"),
  creativePrompt: z.string().describe("A compelling paragraph with specific references and dramatic elements")
})

interface SummarizeVideosRequest {
  videos: Array<{
    videoId: string
    title: string
    srtContent: string
  }>
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/summarize-videos ===')
  
  try {
    console.log('Parsing request body...')
    const requestBody: SummarizeVideosRequest = await request.json()
    console.log('Request body received:', {
      videoCount: requestBody.videos?.length || 0,
      videoTitles: requestBody.videos?.map(v => v.title) || []
    })
    
    const { videos } = requestBody

    if (!videos || videos.length === 0) {
      console.log('Validation failed: no videos provided')
      return NextResponse.json(
        { error: 'At least one video with transcript is required' },
        { status: 400 }
      )
    }

    console.log('Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock summary')
      const mockSummary = generateMockSummary(videos)
      console.log('Generated mock summary')
      return NextResponse.json({
        success: true,
        summary: mockSummary,
        usingMock: true
      })
    }

    console.log(`🚀 Summarizing ${videos.length} videos`)

    try {
      // Create ChatOpenAI model
      const model = new ChatOpenAI({
        modelName: "gpt-4.1",
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      // Bind schema to model using structured output
      const modelWithStructure = model.withStructuredOutput(VideosSummarySchema)

      // Prepare video content for analysis
      const videoContents = videos.map(video => `
### Video: ${video.title} (ID: ${video.videoId})

Transcript:
${video.srtContent}

---
`).join('\n')

      const prompt = `You are an expert story consultant and content analyst specializing in extracting dramatic moments, compelling quotes, and specific details from video transcripts. Your analysis should be detailed and reference-rich, similar to court transcripts, investigative journalism, and news reports.

I will provide you with transcripts from multiple YouTube videos. Your task is to analyze them from a storytelling perspective and extract narrative elements with specific quotes, dramatic moments, and detailed references.

Your analysis should focus on:
1. Extracting direct quotes verbatim from the transcripts
2. Identifying dramatic moments, conflicts, confrontations, or emotionally charged content
3. Providing specific details like names, locations, events, and timestamps
4. Creating rich contextual information about what's happening
5. Formatting summaries like detailed news reports or court documentation
6. Including specific references to what people said, when they said it, and the circumstances

Video Count: ${videos.length}

${videoContents}

ANALYSIS REQUIREMENTS:
- Extract direct quotes verbatim from transcripts whenever possible
- Focus on dramatic moments, conflicts, revelations, or emotionally charged content
- Identify specific details like names, locations, events mentioned
- Look for moments of tension, surprise, revelation, or conflict
- Provide rich contextual information about what's happening
- Format summaries like detailed news reports or court documentation
- Include specific references to what people said, when they said it, and the circumstances

EXAMPLE FORMAT FOR KEY INSIGHTS:
"At timestamp 00:15:23, the speaker revealed: 'I never thought this would happen to me.' This moment marked a dramatic shift in the narrative as tensions escalated. The speaker's voice became noticeably strained, and background voices can be heard expressing shock. This revelation occurred immediately after [context], making it particularly significant because [explanation]."

EXAMPLE FORMAT FOR DRAMATIC ELEMENTS:
"According to the transcript at 00:08:45, the confrontation reached its peak when the participant declared: 'This ends right now!' The emotional intensity was palpable as multiple voices began speaking over each other. Witness accounts from the video show visible tension in body language, with the speaker's hands gesturing emphatically during this exchange."

Instructions:
- For each video, extract specific quotes and dramatic moments with timestamps
- Identify narrative elements with precise details and emotional context
- Look for conflicts, challenges, and tensions with specific quotes
- Generate story concepts grounded in actual dramatic moments from the content
- Create a final creative prompt that incorporates real quotes and dramatic elements
- Focus on moments that would translate well to dramatic storytelling
- Consider how real conflicts and tensions could inspire compelling narratives
- Extract character insights from actual behavior and statements observed

Return only the structured data without any additional text or formatting.`

      console.log('Sending request to OpenAI via LangChain...')
      console.log('Total content length:', videoContents.length)

      // Invoke the model to produce structured output
      const structuredOutput = await modelWithStructure.invoke(prompt)

      console.log('LangChain structured output received')
      console.log('Structured output keys:', Object.keys(structuredOutput))
      
      // Validate the structured output with our schema
      const validatedSummary = VideosSummarySchema.parse(structuredOutput)
      
      console.log(`✅ Summary completed for ${videos.length} videos`)
      console.log('Overall theme:', validatedSummary.overallTheme)
      console.log('Key insights count:', validatedSummary.keyInsights.length)
      
      return NextResponse.json({
        success: true,
        summary: validatedSummary,
        usingMock: false
      })

    } catch (langchainError: any) {
      console.error(`❌ LangChain error:`, langchainError)
      console.error('LangChain error details:', {
        name: langchainError.name,
        message: langchainError.message,
        stack: langchainError.stack?.split('\n').slice(0, 3).join('\n')
      })
      
      // Fallback to mock if LangChain fails
      console.log('Falling back to mock summary...')
      const mockSummary = generateMockSummary(videos)
      
      return NextResponse.json({
        success: true,
        summary: mockSummary,
        usingMock: true,
        error: langchainError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in summarize-videos:', error)
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error occurred while summarizing videos' 
      },
      { status: 500 }
    )
  }
}

// Mock summary generator with enhanced dramatic format
function generateMockSummary(videos: Array<{ videoId: string; title: string; srtContent: string }>) {
  console.log('Generating enhanced mock summary for', videos.length, 'videos')
  
  const videoSummaries = videos.map((video, index) => ({
    videoId: video.videoId,
    title: video.title,
    keyPoints: [
      `At timestamp 00:05:23, the speaker declared: "This changes everything we thought we knew about ${video.title.substring(0, 20)}..." The statement was followed by a dramatic pause, suggesting the weight of the revelation.`,
      `According to the transcript at 00:12:45: "I've never seen anything like this before." The speaker's voice carried a mixture of excitement and apprehension, indicating a pivotal moment in the discussion.`,
      `The most compelling moment occurred at 00:18:30 when the participant admitted: "I was completely wrong about this." This confession marked a significant shift in perspective.`,
      `Evidence from 00:25:15 shows the speaker stating: "The implications are staggering." The context suggests this was a moment of genuine realization about the topic's significance.`
    ],
    mainTopic: `Dramatic analysis of ${video.title} with compelling revelations and emotional moments`,
    timestamp: `00:${String(5 + index * 3).padStart(2, '0')}:${String(15 + index * 10).padStart(2, '0')},000`,
    narrativeElements: [
      `Character transformation evidenced by direct quotes showing evolution of perspective`,
      `Conflict resolution patterns with specific moments of tension and release`,
      `Emotional journey documented through voice tone changes and dramatic pauses`,
      `Revelation sequences with precise timestamps and contextual significance`
    ],
    emotionalTone: `Intensely dramatic with moments of revelation, conflict, and emotional breakthrough`,
    dramaticElements: [
      `Heated confrontation at timestamp 00:08:45`,
      `Emotional breakdown with visible distress at 00:15:30`,
      `Shocking revelation that changed the entire narrative`,
      `Confrontational exchange with raised voices and interruptions`
    ],
    keyQuotes: [
      `"This changes everything we thought we knew!"`,
      `"I never expected this to happen to me"`,
      `"The truth is finally coming out"`,
      `"I can't believe what I'm seeing right now"`
    ],
    contextualInfo: `This video represents a critical turning point in the speaker's journey, occurring during a period of heightened emotional intensity. The dramatic elements suggest authentic human responses to significant revelations, making it particularly valuable for understanding real-world conflict and resolution patterns. [Mock analysis for demonstration purposes]`
  }))

  return {
    overallTheme: `According to comprehensive transcript analysis across ${videos.length} video${videos.length > 1 ? 's' : ''}, a pattern of dramatic human transformation emerges. At timestamp 00:03:45 in Video #1, the speaker stated: "Everything I believed was wrong." This sentiment was echoed in Video #2 at 00:07:22: "The revelation hit me like a truck." These moments of profound realization create a compelling narrative of personal evolution and dramatic awakening.`,
    keyInsights: [
      `Court transcript analysis reveals: "Multiple participants experienced similar emotional breakthroughs." Evidence from timestamps 00:05:30, 00:12:45, and 00:18:20 confirms this pattern.`,
      `According to recorded statements: "The confrontational moments were the most revealing." Witness accounts from the videos show visible tension and authentic emotional responses.`,
      `Investigation of voice patterns indicates: "Speakers became increasingly vulnerable as discussions progressed." Audio analysis confirms emotional escalation at key moments.`,
      `Documentary evidence shows: "Participants often contradicted their initial statements." This pattern suggests genuine intellectual and emotional growth throughout the recordings.`,
      `Behavioral analysis reveals: "The most dramatic moments occurred when speakers felt cornered or challenged." These confrontational sequences provide rich material for conflict-driven narratives.`,
      `According to psychological assessment: "Authentic emotional responses were triggered by specific topics." The genuine nature of these reactions makes them valuable for character development.`
    ],
    videoSummaries: videoSummaries,
    commonPatterns: [
      `CNN-style analysis reveals: "Recurring pattern of initial denial followed by gradual acceptance." Multiple videos show this emotional progression with specific timestamps.`,
      `According to behavioral documentation: "Similar defensive mechanisms appeared across different participants." Evidence includes raised voices, interrupted speech, and emotional deflection.`,
      `Investigation shows: "Common breakthrough moments occurred around the 15-minute mark." This timing suggests optimal emotional vulnerability for dramatic revelations.`,
      `Witness testimony indicates: "Participants consistently experienced moments of profound realization." These epiphanies are documented with precise quotes and contextual information.`
    ],
    actionableItems: [
      `Based on transcript evidence: "Writers should focus on moments of genuine emotional vulnerability." These authentic reactions provide the most compelling dramatic material.`,
      `According to dramatic analysis: "The most powerful scenes emerge from real confrontational dialogue." Direct quotes from heated exchanges offer rich source material.`,
      `Investigation recommends: "Character development should mirror the authentic emotional progressions observed." Real human responses provide templates for believable character arcs.`,
      `Documentary evidence suggests: "Conflict resolution patterns from real conversations create authentic narrative structures." These observed patterns enhance story credibility.`,
      `Expert analysis indicates: "The most dramatic moments often involve personal admissions or confessions." These vulnerable moments provide peak emotional content for storytelling.`
    ],
    narrativeThemes: [
      `According to case study #1: "The struggle between public facade and private truth." Evidence shows speakers maintaining composure before dramatic emotional breaks.`,
      `Court document analysis reveals: "Personal transformation through confrontational dialogue." Multiple instances show characters evolving through challenging conversations.`,
      `Investigation report indicates: "The power of authentic human connection in breaking down barriers." Documented moments show genuine emotional breakthroughs.`,
      `Witness statements confirm: "Finding courage to speak truth in difficult circumstances." Multiple examples show participants overcoming fear to make important revelations.`
    ],
    characterInsights: [
      `According to behavioral analysis: "Subjects displayed classic defensive patterns before emotional breakthrough." Evidence includes deflection, denial, and eventual vulnerability.`,
      `Psychological assessment shows: "Individuals consistently sought validation while maintaining independence." This paradox creates compelling internal conflict for character development.`,
      `Documentation reveals: "Participants exhibited both strength and fragility in confrontational moments." These complex emotional states provide rich material for nuanced characterization.`,
      `Investigation confirms: "Leaders emerged from those who could admit mistakes and show vulnerability." This pattern suggests authentic leadership qualities for protagonist development.`
    ],
    conflictElements: [
      `Case file #2847 documents: "Heated exchange at 00:12:30 when participant shouted 'You don't understand what happened!' before emotional breakdown." Security footage confirms visible distress.`,
      `According to incident report: "Confrontation escalated when speaker declared 'This is where I draw the line!' at timestamp 00:18:45." Multiple witnesses confirm the dramatic nature of this moment.`,
      `Investigation reveals: "Tension reached breaking point during admission: 'I can't keep lying about this anymore.'" The confession occurred at 00:22:15 with visible emotional impact.`,
      `Court transcript shows: "Conflict intensified when participant accused others: 'You all knew this was wrong!'" The accusation at 00:25:30 created immediate defensive responses from others.`
    ],
    storyIdeas: [
      `According to case study analysis: "A character forced to confront their deepest fears when someone declares 'The truth about you is finally coming out!' This moment of exposure creates immediate dramatic tension with real-world authenticity."`,
      `Investigation report suggests: "Someone discovering their life's purpose when a mentor states 'You're capable of so much more than this.' The revelation scene includes genuine emotional breakthrough with documented behavioral changes."`,
      `Court document inspiration: "A community crisis emerges when a leader admits 'I've been lying to all of you.' The confession scene provides authentic dramatic material with real consequences and emotional fallout."`,
      `Documentary evidence shows: "An individual's transformation when they finally declare 'I'm done pretending to be someone I'm not.' This moment of authenticity creates compelling character development grounded in real human experience."`
    ],
    creativePrompt: `According to comprehensive analysis of human behavioral patterns documented across multiple video testimonies, your story should explore the moment when someone's carefully constructed facade finally crumbles. At timestamp 00:15:23, Subject A declared: "I can't keep living this lie anymore," followed by visible emotional breakdown. This authentic moment of vulnerability, witnessed and documented, provides the foundation for your narrative. Court transcript #2847 shows how truth emerges under pressure: "The defendant's composure broke when confronted with evidence, leading to full confession." Your characters should experience similar moments of authentic emotional breakthrough, grounded in the real human responses observed in these documented cases. The most compelling drama emerges when people can no longer maintain their protective barriers, creating genuine moments of connection and transformation that resonate because they mirror actual human experience.`
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Video summarization API is running',
    endpoints: {
      POST: 'Summarize multiple video transcripts and extract key insights'
    }
  })
} 