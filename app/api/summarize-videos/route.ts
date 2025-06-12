import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for video summary
const VideoSummarySchema = z.object({
  videoId: z.string().describe("The video ID"),
  title: z.string().describe("The video title"),
  keyPoints: z.array(z.string()).describe("Main points discussed in this video (3-5 points)"),
  mainTopic: z.string().describe("The primary topic or theme of the video"),
  timestamp: z.string().optional().describe("Most important timestamp if applicable"),
  narrativeElements: z.array(z.string()).describe("Story elements, characters, conflicts, or narrative structures mentioned"),
  emotionalTone: z.string().describe("The overall emotional tone or mood of the content")
})

// Zod schema for overall summary
const VideosSummarySchema = z.object({
  overallTheme: z.string().describe("Common theme or topic across all videos, written for storytellers"),
  keyInsights: z.array(z.string()).describe("Top 5-7 key insights extracted from all videos"),
  videoSummaries: z.array(VideoSummarySchema).describe("Individual summaries for each video"),
  commonPatterns: z.array(z.string()).describe("Common patterns or recurring ideas across videos"),
  actionableItems: z.array(z.string()).describe("Actionable insights or recommendations based on the content"),
  narrativeThemes: z.array(z.string()).describe("Central themes that could drive a story or script"),
  characterInsights: z.array(z.string()).describe("Character types, motivations, or personality traits discussed"),
  conflictElements: z.array(z.string()).describe("Conflicts, challenges, or tensions that could create drama"),
  storyIdeas: z.array(z.string()).describe("Specific story or script concepts inspired by the content"),
  creativePrompt: z.string().describe("A compelling paragraph that gives a writer creative direction for their story/script")
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
        modelName: "gpt-4o-mini",
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

      const prompt = `You are an expert story consultant and content analyst. I will provide you with transcripts from multiple YouTube videos. Your task is to analyze them from a storytelling perspective and extract narrative elements that could inspire creative writing.

Your analysis should focus on:
1. Story-worthy themes and human experiences
2. Character types, motivations, and personality insights
3. Conflicts, tensions, and dramatic elements
4. Emotional journeys and transformations
5. Narrative structures and storytelling techniques
6. Creative inspiration for writers and scriptwriters

Video Count: ${videos.length}

${videoContents}

Instructions:
- For each video, identify narrative elements, emotional tones, and story-worthy content
- Extract themes that could drive compelling stories or scripts
- Identify character insights, personality types, and human motivations discussed
- Look for conflicts, challenges, and tensions that could create dramatic tension
- Generate specific story concepts inspired by the content
- Create a final creative prompt that would inspire a writer to craft a compelling story
- Focus on universal human experiences and emotions that resonate across cultures
- Consider both dramatic and comedic potential in the content
- Think about different genres: drama, comedy, thriller, romance, sci-fi, etc.

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

// Mock summary generator for testing and fallback
function generateMockSummary(videos: Array<{ videoId: string; title: string; srtContent: string }>) {
  console.log('Generating mock summary for', videos.length, 'videos')
  
  const videoSummaries = videos.map(video => ({
    videoId: video.videoId,
    title: video.title,
    keyPoints: [
      `Key insight from "${video.title.substring(0, 30)}..."`,
      "Discussion of main concepts and ideas",
      "Practical applications and examples",
      "Important takeaways and conclusions"
    ],
    mainTopic: `Analysis of ${video.title}`,
    timestamp: "00:05:30,000",
    narrativeElements: [
      "Character development themes",
      "Conflict resolution examples",
      "Emotional journey patterns"
    ],
    emotionalTone: "Informative yet engaging"
  }))

  return {
    overallTheme: `A rich tapestry of human experiences and insights from ${videos.length} video${videos.length > 1 ? 's' : ''} that reveals universal themes perfect for storytelling`,
    keyInsights: [
      "Multiple perspectives on the human condition",
      "Practical wisdom that could guide character decisions",
      "Common challenges that create relatable conflicts",
      "Emotional patterns that drive compelling narratives",
      "Real-world scenarios that inspire authentic storytelling",
      "Universal truths that resonate across different audiences"
    ],
    videoSummaries: videoSummaries,
    commonPatterns: [
      "Recurring human struggles and triumphs",
      "Similar emotional journeys across different contexts",
      "Common decision-making frameworks people use",
      "Patterns of growth and transformation"
    ],
    actionableItems: [
      "Use these insights to create authentic character motivations",
      "Build conflicts around the real challenges discussed",
      "Incorporate the emotional patterns into character arcs",
      "Draw inspiration from the diverse perspectives presented",
      "Consider how these themes could work across different genres"
    ],
    narrativeThemes: [
      "The struggle between tradition and innovation",
      "Personal growth through overcoming challenges",
      "The power of community and relationships",
      "Finding purpose in uncertain times"
    ],
    characterInsights: [
      "People driven by both fear and ambition",
      "Characters who must choose between safety and growth",
      "Individuals learning to balance personal and professional life",
      "Leaders emerging from unexpected circumstances"
    ],
    conflictElements: [
      "Internal conflicts between values and desires",
      "External pressures from society or family",
      "Professional challenges that test character",
      "Relationships strained by different worldviews"
    ],
    storyIdeas: [
      "A person forced to choose between personal success and family loyalty",
      "Someone discovering their life's purpose through unexpected mentorship",
      "A community coming together to solve a crisis that affects everyone",
      "An individual's journey from skepticism to belief in a cause"
    ],
    creativePrompt: "Your story explores the tension between what we're told we should want and what we actually need to be fulfilled. Through characters facing real-world pressures and opportunities, examine how people navigate the complex dance between ambition and authenticity, tradition and innovation, individual desires and collective responsibility. What happens when someone must choose between the path everyone expects them to take and the one their heart tells them is right?"
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