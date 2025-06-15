import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for Google research summary
const GoogleResearchSummarySchema = z.object({
  insights: z.string().describe("Comprehensive insights from web sources"),
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

export async function POST(request: NextRequest) {
  console.log('=== POST /api/research/generate-google-summary ===')
  
  try {
    const { query, context, webResults } = await request.json()
    
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
        insights: `Mock Google research summary for "${query}". This would normally contain comprehensive insights from web sources only.`,
        keyFindings: [
          `Key finding 1 about ${query} from web sources`,
          `Key finding 2 about ${query} from web sources`,
          `Key finding 3 about ${query} from web sources`
        ],
        recommendations: [
          `Recommendation 1 for ${query} based on web research`,
          `Recommendation 2 for ${query} based on web research`,
          `Recommendation 3 for ${query} based on web research`
        ],
        sources: [
          'Mock source 1',
          'Mock source 2',
          'Mock source 3'
        ],
        usingMock: true
      })
    }

    console.log(`🧠 Generating Google research summary for: "${query}"`)
    console.log(`📊 Analyzing ${webResults?.length || 0} web results`)

    try {
      // Create ChatOpenAI model
      const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      // Bind schema to model using structured output
      const modelWithStructure = model.withStructuredOutput(GoogleResearchSummarySchema)

      // Prepare web results summary
      const webSummary = webResults?.slice(0, 30).map((result: WebSearchResult, index: number) => 
        `${index + 1}. ${result.title}\n   ${result.description}\n   Source: ${result.link}`
      ).join('\n\n') || 'No web results available'

      const prompt = `You are an expert research analyst. I will provide you with web search results about a specific topic. Your task is to:

1. Analyze and synthesize information from web sources
2. Identify key patterns, trends, and insights
3. Provide actionable findings and recommendations
4. Create a comprehensive research summary

Research Query: "${query}"
${context ? `Research Context: "${context}"` : ''}

WEB SEARCH RESULTS:
${webSummary}

Instructions:
- Focus on the most credible and relevant web information
- Identify key themes, trends, and insights from web sources
- Provide 3-5 key findings that are specific and actionable
- Suggest 3-5 practical recommendations based on the web research
- Write in a clear, professional tone
- Prioritize recent and authoritative sources
- Note any conflicting information or gaps in the research
- Extract the most relevant source URLs for reference

Return only the structured data without any additional text or formatting.`

      console.log('Sending request to OpenAI for Google research summary...')

      // Invoke the model to produce structured output
      const structuredOutput = await modelWithStructure.invoke(prompt)

      console.log('OpenAI Google research summary generated successfully')
      
      // Validate the structured output with our schema
      const validatedSummary = GoogleResearchSummarySchema.parse(structuredOutput)
      
      console.log(`✅ Google research summary completed for query: "${query}"`)
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
      console.error(`❌ OpenAI error for Google research summary:`, aiError)
      
      // Fallback to mock if OpenAI fails
      console.log('Falling back to mock Google research summary...')
      
      return NextResponse.json({
        success: true,
        insights: `Google research analysis for "${query}" based on ${webResults?.length || 0} web sources. This analysis provides insights from web sources to give a comprehensive overview of the topic.`,
        keyFindings: [
          `Primary trend identified in ${query} web research`,
          `Key insight from web source analysis`,
          `Important finding regarding ${query} applications from web sources`,
          `Notable pattern in current ${query} discussions online`
        ],
        recommendations: [
          `Consider exploring ${query} further through additional web sources`,
          `Focus on the most recent web developments in ${query}`,
          `Analyze authoritative sources for deeper insights`,
          `Cross-reference findings with academic and industry sources`
        ],
        sources: webResults?.slice(0, 5).map((result: WebSearchResult) => result.link) || [],
        usingMock: true,
        error: aiError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in Google research summary generation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error occurred while generating Google research summary' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Google research summary API is running',
    endpoints: {
      POST: 'Generate comprehensive research summary from web sources only'
    }
  })
} 