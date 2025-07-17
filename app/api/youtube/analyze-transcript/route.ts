import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema matching the Gemini video analysis structure
const TranscriptAnalysisSchema = z.object({
  videoId: z.string().describe("The YouTube video ID"),
  title: z.string().describe("The video title"),
  summary: z.string().describe("Comprehensive summary of the video content"),
  keyPoints: z.array(z.string()).describe("Main points and insights from the video (5-8 points)"),
  timestamps: z.array(z.object({
    startTime: z.string().describe("Start timestamp in format 00:00:00"),
    endTime: z.string().describe("End timestamp in format 00:00:00"),
    speaker: z.string().describe("Speaker name, video element type, or [Unknown Speaker] if unclear"),
    quote: z.string().optional().describe("Exact quote if available, or description for video elements"),
    extraInfo: z.string().describe("Context about who was speaking to whom, situation details, or video element context"),
    description: z.string().describe("What happens during this time range or video element description"),
    significance: z.string().describe("Why this moment is important or significant for storytelling"),
    elementType: z.string().optional().describe("Type of video element: 'quote', 'background_footage', 'crime_scene', 'dramatic_moment', 'security_camera', 'news_footage', 'court_footage', 'evidence', etc.")
  })).describe("Key timestamp ranges including both quotes/dialogue and video elements like footage, dramatic moments, etc."),
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

interface AnalyzeTranscriptRequest {
  srtContent: string
  query: string
  videoTitle: string
  videoId?: string // Make videoId optional for backward compatibility
}

interface SRTEntry {
  index: number
  startTime: string
  endTime: string
  text: string
  startSeconds: number
  endSeconds: number
}

// Helper function to convert SRT timestamp to seconds
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

// Helper function to parse SRT content into structured entries
function parseSRTContent(srtContent: string): SRTEntry[] {
  const entries: SRTEntry[] = []
  const blocks = srtContent.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length >= 3) {
      const index = parseInt(lines[0])
      const [startTime, endTime] = lines[1].split(' --> ')
      const text = lines.slice(2).join('\n').trim()
      
      if (!isNaN(index) && startTime && endTime && text) {
        entries.push({
          index,
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          text,
          startSeconds: srtToSeconds(startTime.trim()),
          endSeconds: srtToSeconds(endTime.trim())
        })
      }
    }
  }
  
  return entries
}

// Helper function to convert entries back to SRT format
function entriesToSRT(entries: SRTEntry[]): string {
  return entries.map(entry => 
    `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`
  ).join('\n\n')
}

// Helper function to split SRT content into chunks based on word count
function splitSRTIntoChunks(srtContent: string, maxWords: number = 15000): string[] {
  const entries = parseSRTContent(srtContent)
  const chunks: string[] = []
  let currentChunk: SRTEntry[] = []
  let currentWordCount = 0
  
  for (const entry of entries) {
    const entryWordCount = entry.text.split(/\s+/).length
    
    // If adding this entry would exceed the limit, start a new chunk
    if (currentWordCount + entryWordCount > maxWords && currentChunk.length > 0) {
      chunks.push(entriesToSRT(currentChunk))
      currentChunk = [entry]
      currentWordCount = entryWordCount
    } else {
      currentChunk.push(entry)
      currentWordCount += entryWordCount
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(entriesToSRT(currentChunk))
  }
  
  return chunks
}

// Helper function to generate YouTube URL with timestamp
function generateYouTubeUrl(videoId: string, srtTimestamp: string): string {
  const seconds = Math.floor(srtToSeconds(srtTimestamp))
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
}

// Helper function to analyze a single chunk of SRT content
async function analyzeChunk(srtContent: string, query: string, videoTitle: string, videoId?: string): Promise<any> {
  // Create ChatOpenAI model
  const model = new ChatOpenAI({
    modelName: "gpt-4.1",
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  // Bind schema to model using structured output
  const modelWithStructure = model.withStructuredOutput(TranscriptAnalysisSchema)

  const prompt = `You are an expert transcript analyzer specializing in comprehensive video analysis. Analyze the provided SRT subtitle file and create a detailed structured analysis similar to what would be produced by advanced video analysis AI.

Video Information:
- Video ID: ${videoId || 'unknown'}
- Title: ${videoTitle}
- User Query: "${query}"

Your task is to analyze the SRT transcript and create a comprehensive structured analysis with the following components:

1. **Summary**: A comprehensive overall summary of the video content
2. **Key Points**: 5-8 main points and insights from the video
3. **Timestamps**: Multiple timestamp ranges (aim for 15-25) with detailed information including both dialogue and video elements:
   - startTime and endTime in 00:00:00 format (convert from SRT timestamps)
   - speaker identification (extract from context or use "Unknown Speaker")
   - exact quotes when available for dialogue
   - elementType: Identify type of content ("quote", "background_footage", "crime_scene", "dramatic_moment", "security_camera", "news_footage", "court_footage", "evidence", etc.)
   - contextual information about who was speaking to whom or video element context
   - description of what happens during this time range
   - significance of why this moment is important for storytelling
4. **Topics**: Main topics and themes discussed
5. **Emotional Tone**: Overall emotional tone and mood
6. **Key Quotes**: Important quotes with full context (speaker, timing, situation)
7. **Actionable Insights**: Practical takeaways and insights
8. **Character Insights**: Insights about people or characters mentioned
9. **Conflict Elements**: Conflicts, tensions, or dramatic moments
10. **Story Ideas**: Potential story concepts inspired by the content
11. **Creative Prompt**: A creative writing prompt based on the video content

ENHANCED TIMESTAMP EXTRACTION GUIDELINES:
- Look for natural conversation breaks, topic changes, important statements
- Extract speaker information from context clues in the transcript
- Identify dramatic moments, revelations, key explanations
- Focus on content that matches the user's query: "${query}"
- Create timestamp ranges that are meaningful (30 seconds to 3 minutes each)
- Ensure timestamps don't overlap and cover the most important parts
- Classify each timestamp with appropriate elementType:
  * "quote" - For dialogue and spoken content
  * "background_footage" - For B-roll or supplementary visual content
  * "crime_scene" - For footage of crime scenes or investigations
  * "dramatic_moment" - For emotional breakdowns, confrontations, revelations
  * "security_camera" - For CCTV or surveillance footage
  * "news_footage" - For news reports or broadcasts
  * "court_footage" - For courtroom scenes and legal proceedings
  * "evidence" - For presentation of evidence or documentation
  * "the_moment" - For critical turning points or specific events
- Convert SRT timestamps (00:01:23,456) to clean format (00:01:23)
- Focus on moments that would be valuable for content creation and storytelling

ANALYSIS FOCUS:
Pay special attention to content related to: "${query}"
But also provide comprehensive coverage of the entire video content.

SRT Transcript Content:
${srtContent}

Return a complete structured analysis that matches the comprehensive format expected by the frontend.`

  console.log('Sending transcript to OpenAI for comprehensive analysis...')
  
  // Invoke the model to produce structured output
  const structuredOutput = await modelWithStructure.invoke(prompt)
  
  console.log('Comprehensive analysis received from OpenAI')
  
  // Validate the structured output with our schema
  const validatedAnalysis = TranscriptAnalysisSchema.parse(structuredOutput)
  
  // Add YouTube URLs to timestamps if videoId is provided
  if (videoId) {
    validatedAnalysis.timestamps = validatedAnalysis.timestamps.map(timestamp => ({
      ...timestamp,
      youtubeUrl: generateYouTubeUrl(videoId, timestamp.startTime)
    }))
    
    validatedAnalysis.keyQuotes = validatedAnalysis.keyQuotes.map(quote => ({
      ...quote,
      youtubeUrl: generateYouTubeUrl(videoId, quote.startTime)
    }))
  }
  
  return validatedAnalysis
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
      const mockAnalysis = generateMockAnalysis(query, srtContent, videoId, videoTitle)
      console.log('Generated mock analysis')
      return NextResponse.json({
        success: true,
        analysis: mockAnalysis,
        usingMock: true
      })
    }

    console.log(`🚀 Analyzing transcript for query: "${query}" in video: "${videoTitle}"`)

    try {
      // Check if SRT content needs to be split
      const wordCount = srtContent.split(/\s+/).length
      console.log(`SRT content word count: ${wordCount}`)
      
      let finalAnalysis: any
      
      if (wordCount > 15000) {
        // For large content, we'll analyze the first chunk and use it as a representative sample
        console.log('SRT content is large, analyzing first chunk as representative sample...')
        const chunks = splitSRTIntoChunks(srtContent, 15000)
        console.log(`Split into ${chunks.length} chunks, analyzing first chunk`)
        
        finalAnalysis = await analyzeChunk(chunks[0], query, videoTitle, videoId)
        
        // Add a note about the analysis being based on a sample
        finalAnalysis.summary += ` [Note: This analysis is based on a representative sample of the full transcript due to length constraints.]`
        
      } else {
        // Process normally for smaller content
        console.log('SRT content is manageable size, processing full transcript...')
        finalAnalysis = await analyzeChunk(srtContent, query, videoTitle, videoId)
      }
      
      console.log(`✅ Comprehensive analysis completed for query: "${query}"`)
      console.log('Analysis structure:', {
        summaryLength: finalAnalysis.summary.length,
        keyPointsCount: finalAnalysis.keyPoints.length,
        timestampsCount: finalAnalysis.timestamps.length,
        topicsCount: finalAnalysis.topics.length,
        keyQuotesCount: finalAnalysis.keyQuotes.length
      })
      
      return NextResponse.json({
        success: true,
        analysis: finalAnalysis,
        usingMock: false
      })

    } catch (langchainError: any) {
      console.error(`❌ LangChain error for query "${query}":`, langchainError)
      console.error('LangChain error details:', {
        name: langchainError.name,
        message: langchainError.message,
        stack: langchainError.stack?.split('\n').slice(0, 3).join('\n')
      })
      
      // Fallback to mock if LangChain fails
      console.log('Falling back to mock analysis...')
      const mockAnalysis = generateMockAnalysis(query, srtContent, videoId, videoTitle)
      
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

// Mock analysis generator matching the comprehensive structure
function generateMockAnalysis(query: string, srtContent: string, videoId?: string, videoTitle?: string) {
  console.log('Generating comprehensive mock analysis for query:', query)
  
  // Extract multiple timestamp entries for mock data
  const lines = srtContent.split('\n')
  const timestamps: string[] = []
  
  for (let i = 0; i < lines.length && timestamps.length < 20; i++) {
    const line = lines[i].trim()
    if (line.includes(' --> ')) {
      const [start] = line.split(' --> ')
      timestamps.push(start)
    }
  }
  
  // Ensure we have at least some timestamps
  if (timestamps.length === 0) {
    timestamps.push("00:00:05,000", "00:02:30,000", "00:05:15,000", "00:08:45,000", "00:12:20,000")
  }

  // Generate comprehensive mock analysis
  const mockAnalysis = {
    videoId: videoId || 'unknown',
    title: videoTitle || 'Unknown Video',
    summary: `This video provides comprehensive coverage of the topic related to "${query}". The content explores multiple perspectives and includes detailed discussions, expert insights, and practical examples. Throughout the video, various speakers contribute their knowledge and experiences, creating a rich tapestry of information that addresses both theoretical concepts and real-world applications. The presentation style is engaging and informative, with clear explanations and supporting evidence for key points discussed.`,
    keyPoints: [
      `Primary focus on ${query} with detailed explanations`,
      'Expert commentary and analysis throughout',
      'Multiple perspectives presented on key issues',
      'Practical examples and case studies included',
      'Clear progression from basic concepts to advanced topics',
      'Interactive elements and audience engagement',
      'Comprehensive coverage of related subtopics'
    ],
    timestamps: timestamps.slice(0, 15).map((timestamp, index) => {
      const speakers = ['Expert Analyst', 'Host', 'Guest Speaker', 'Interviewer', 'Subject Matter Expert', 'Commentator']
      const speaker = speakers[index % speakers.length]
      
      return {
        startTime: timestamp.replace(',', ':').substring(0, 8),
        endTime: timestamp.replace(',', ':').substring(0, 8).replace(/(\d{2}):(\d{2}):(\d{2})/, (match, h, m, s) => {
          const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + 30
          const newH = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
          const newM = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
          const newS = (totalSeconds % 60).toString().padStart(2, '0')
          return `${newH}:${newM}:${newS}`
        }),
        speaker: speaker,
        quote: `This is a key point about ${query} that demonstrates the complexity of the topic.`,
        extraInfo: `${speaker} speaking to the audience during a detailed explanation segment, providing context and background information.`,
        description: `Detailed discussion of ${query} with specific examples and analysis.`,
        significance: `This moment is crucial for understanding the broader implications of ${query} in the overall context.`,
        ...(videoId && { youtubeUrl: generateYouTubeUrl(videoId, timestamp) })
      }
    }),
    topics: [
      `Core concepts of ${query}`,
      'Historical context and background',
      'Current trends and developments',
      'Expert opinions and analysis',
      'Practical applications',
      'Future implications',
      'Related technologies and methods'
    ],
    emotionalTone: 'Professional and informative with moments of enthusiasm and engagement. The overall tone is educational and authoritative, with speakers demonstrating expertise while maintaining accessibility for the audience.',
    keyQuotes: timestamps.slice(0, 8).map((timestamp, index) => {
      const speakers = ['Lead Expert', 'Industry Professional', 'Research Specialist', 'Thought Leader']
      const speaker = speakers[index % speakers.length]
      
      return {
        startTime: timestamp.replace(',', ':').substring(0, 8),
        endTime: timestamp.replace(',', ':').substring(0, 8).replace(/(\d{2}):(\d{2}):(\d{2})/, (match, h, m, s) => {
          const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + 15
          const newH = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
          const newM = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
          const newS = (totalSeconds % 60).toString().padStart(2, '0')
          return `${newH}:${newM}:${newS}`
        }),
        speaker: speaker,
        quote: `The most important thing to understand about ${query} is that it requires careful consideration of multiple factors.`,
        context: `${speaker} addressing the audience during a key explanatory segment, emphasizing critical concepts.`,
        ...(videoId && { youtubeUrl: generateYouTubeUrl(videoId, timestamp) })
      }
    }),
    actionableInsights: [
      `Apply the principles of ${query} in practical scenarios`,
      'Consider multiple perspectives when evaluating solutions',
      'Stay updated with latest developments in the field',
      'Engage with expert communities and resources',
      'Document and share learnings with others',
      'Continuously refine understanding through practice'
    ],
    characterInsights: [
      'Experts demonstrate deep knowledge and experience',
      'Speakers show passion and commitment to the subject',
      'Audience engagement indicates strong interest in the topic',
      'Professional presentation style builds credibility',
      'Collaborative approach enhances learning outcomes'
    ],
    conflictElements: [
      'Differing opinions on implementation approaches',
      'Debate over best practices and methodologies',
      'Tension between traditional and modern approaches',
      'Challenges in balancing competing priorities',
      'Disagreement on future predictions and trends'
    ],
    storyIdeas: [
      `A documentary exploring the evolution of ${query}`,
      'Personal journey of someone mastering the subject',
      'Behind-the-scenes look at expert decision-making',
      'Comparative analysis across different contexts',
      'Future scenarios and potential developments'
    ],
    creativePrompt: `Write a compelling narrative about someone who discovers the transformative power of ${query}. Explore their journey from initial curiosity to deep understanding, including the challenges they face, the mentors they meet, and the breakthrough moments that change their perspective. Consider how this knowledge impacts their personal and professional life, and what they choose to do with their newfound expertise.`
  }

  return mockAnalysis
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Transcript analysis API is running',
    endpoints: {
      POST: 'Analyze transcript content with comprehensive structured output'
    }
  })
} 