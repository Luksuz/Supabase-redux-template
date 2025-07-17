import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// Zod schema for research summary (now generic, not Google-specific)
const ResearchSummarySchema = z.object({
  insights: z.string().describe("Comprehensive insights from research sources"),
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
  console.log('=== POST /api/research/generate-google-summary (Perplexity) ===')
  
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
        insights: `According to recent research analysis for "${query}", multiple sources indicate significant developments. Industry experts are calling this a breakthrough moment with unprecedented implications. Market analysts suggest this represents a paradigm shift that could reshape the landscape. The convergence of technological advancement and market forces creates a unique opportunity for innovation and growth.`,
        keyFindings: [
          `Recent analysis reveals: 'Breaking developments in ${query} have caught industry leaders off guard.' The announcement represents a significant shift in the market.`,
          `According to comprehensive research: 'Internal sources reveal months of preparation behind the scenes.' Timeline indicates accelerated implementation.`,
          `Current findings confirm: 'Multiple stakeholders expressed surprise at the rapid pace of changes.' Industry experts note this accelerates timelines significantly.`
        ],
        recommendations: [
          `Based on expert analysis: 'Companies should prepare for immediate implementation.' Rapid response protocols are essential for competitive positioning.`,
          `Research indicates: 'Organizations must adapt their strategies within the next quarter.' Timeline is critical for maintaining market advantage.`,
          `Advisory suggests: 'Stakeholders should monitor developments closely.' Additional announcements are expected in the coming weeks.`
        ],
        sources: [
          'Perplexity AI Research Analysis',
          'Industry Expert Consensus',
          'Market Analysis Reports'
        ],
        usingMock: true
      })
    }

    if (!webResults || !Array.isArray(webResults) || webResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Web search results are required for summary generation' },
        { status: 400 }
      )
    }

    console.log(`📊 Generating summary for "${query}" with ${webResults.length} search results`)

      const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
        temperature: 0.3,
      maxTokens: 2000
      })

    // Since Perplexity provides comprehensive results, we can work with them more directly
    const formattedResults = webResults.map((result: WebSearchResult, index: number) => {
      return `${index + 1}. **${result.title}**\n   Source: ${result.source || 'Unknown'}\n   ${result.description}\n   URL: ${result.link}\n`
    }).join('\n')

    const systemPrompt = `You are an expert research analyst. Your task is to analyze research results and create a comprehensive summary with insights, key findings, and actionable recommendations.

Focus on:
- Extracting meaningful insights that connect different pieces of information
- Identifying the most important findings that answer the research query
- Providing specific, actionable recommendations based on the evidence
- Being precise with facts and citing specific sources when available

The research results may come from Perplexity AI, which provides comprehensive analysis. Extract and synthesize the most valuable information.`

    const userPrompt = `Research Query: "${query}"
${context ? `Research Context: "${context}"` : ''}

Research Results:
${formattedResults}

Please analyze these research results and provide a comprehensive summary. Focus on extracting the most valuable insights, key findings, and actionable recommendations. Be specific and reference sources where appropriate.`

    console.log('🤖 Sending research analysis request to OpenAI...')

    const modelWithStructure = model.withStructuredOutput(ResearchSummarySchema)
    
    const structuredOutput = await modelWithStructure.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ])

    console.log('✅ Received structured output from OpenAI')
      
    // Validate the output
    const validatedSummary = ResearchSummarySchema.parse(structuredOutput)
      
    // Extract sources from the web results
    const sources = webResults
      .filter((result: WebSearchResult) => result.link && !result.link.startsWith('#'))
      .map((result: WebSearchResult) => result.link)
      .slice(0, 5) // Limit to top 5 sources
      
      return NextResponse.json({
        success: true,
        insights: validatedSummary.insights,
        keyFindings: validatedSummary.keyFindings,
        recommendations: validatedSummary.recommendations,
      sources: sources.length > 0 ? sources : validatedSummary.sources,
    })

  } catch (error) {
    console.error('Research summary generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate research summary'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Research summary generation API is running',
    endpoints: {
      POST: 'Generate comprehensive summaries from research results (powered by Perplexity AI)'
    }
  })
} 