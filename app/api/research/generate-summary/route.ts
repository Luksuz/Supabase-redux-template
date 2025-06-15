import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for research summary
const ResearchSummarySchema = z.object({
  insights: z.string().describe("Comprehensive insights combining web and video sources"),
  keyFindings: z.array(z.string()).describe("3-5 key findings from the research"),
  recommendations: z.array(z.string()).describe("3-5 actionable recommendations based on the research"),
  sources: z.array(z.string()).describe("Most relevant sources used in the analysis")
})

interface WebSearchResult {
  title: string
  link: string
  description: string
  source?: string
}

interface YouTubeResult {
  id: { videoId: string }
  snippet: {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/research/generate-summary ===')
  
  try {
    const { query, context, webResults, youtubeResults } = await request.json()
    
    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Research query is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock summary')
      return NextResponse.json({
        success: true,
        insights: `Mock research summary for "${query}". This would normally contain comprehensive insights from web and video sources.`,
        keyFindings: [
          `Key finding 1 about ${query}`,
          `Key finding 2 about ${query}`,
          `Key finding 3 about ${query}`
        ],
        recommendations: [
          `Recommendation 1 for ${query}`,
          `Recommendation 2 for ${query}`,
          `Recommendation 3 for ${query}`
        ],
        usingMock: true
      })
    }

    console.log(`🧠 Generating research summary for: "${query}"`)
    console.log(`📊 Analyzing ${webResults?.length || 0} web results and ${youtubeResults?.length || 0} YouTube videos`)

    try {
      // Create ChatOpenAI model
      const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      // Bind schema to model using structured output
      const modelWithStructure = model.withStructuredOutput(ResearchSummarySchema)

      // Prepare web results summary
      const webSummary = webResults?.slice(0, 20).map((result: WebSearchResult, index: number) => 
        `${index + 1}. ${result.title}\n   ${result.description}\n   Source: ${result.link}`
      ).join('\n\n') || 'No web results available'

      // Prepare YouTube results summary
      const youtubeSummary = youtubeResults?.slice(0, 10).map((video: YouTubeResult, index: number) => 
        `${index + 1}. ${video.snippet.title}\n   Channel: ${video.snippet.channelTitle}\n   Description: ${video.snippet.description.slice(0, 200)}...`
      ).join('\n\n') || 'No YouTube results available'

      const prompt = `You are an expert research analyst. I will provide you with web search results and YouTube video information about a specific topic. Your task is to:

1. Analyze and synthesize information from both web sources and video content
2. Identify key patterns, trends, and insights
3. Provide actionable findings and recommendations
4. Create a comprehensive research summary

Research Query: "${query}"
${context ? `Research Context: "${context}"` : ''}

WEB SEARCH RESULTS:
${webSummary}

YOUTUBE VIDEO RESULTS:
${youtubeSummary}

Instructions:
- Synthesize information from both web and video sources
- Focus on the most credible and relevant information
- Identify key themes, trends, and insights
- Provide 3-5 key findings that are specific and actionable
- Suggest 3-5 practical recommendations based on the research
- Write in a clear, professional tone
- Prioritize recent and authoritative sources
- Note any conflicting information or gaps in the research

Return only the structured data without any additional text or formatting.`

      console.log('Sending request to OpenAI for research summary...')

      // Invoke the model to produce structured output
      const structuredOutput = await modelWithStructure.invoke(prompt)

      console.log('OpenAI research summary generated successfully')
      
      // Validate the structured output with our schema
      const validatedSummary = ResearchSummarySchema.parse(structuredOutput)
      
      console.log(`✅ Research summary completed for query: "${query}"`)
      console.log(`📋 Generated ${validatedSummary.keyFindings.length} key findings and ${validatedSummary.recommendations.length} recommendations`)
      
      return NextResponse.json({
        success: true,
        insights: validatedSummary.insights,
        keyFindings: validatedSummary.keyFindings,
        recommendations: validatedSummary.recommendations,
        sources: validatedSummary.sources,
        usingMock: false
      })

    } catch (aiError: any) {
      console.error(`❌ OpenAI error for research summary:`, aiError)
      
      // Fallback to mock if OpenAI fails
      console.log('Falling back to mock research summary...')
      
      return NextResponse.json({
        success: true,
        insights: `Research analysis for "${query}" based on ${webResults?.length || 0} web sources and ${youtubeResults?.length || 0} video sources. This analysis combines insights from multiple sources to provide a comprehensive overview of the topic.`,
        keyFindings: [
          `Primary trend identified in ${query} research`,
          `Key insight from web and video source analysis`,
          `Important finding regarding ${query} applications`,
          `Notable pattern in current ${query} discussions`
        ],
        recommendations: [
          `Consider exploring ${query} further through additional sources`,
          `Focus on the most recent developments in ${query}`,
          `Analyze video content for practical insights`,
          `Cross-reference findings with authoritative sources`
        ],
        usingMock: true,
        error: aiError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in research summary generation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error occurred while generating research summary' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Research summary API is running',
    endpoints: {
      POST: 'Generate comprehensive research summary from web and video sources'
    }
  })
} 