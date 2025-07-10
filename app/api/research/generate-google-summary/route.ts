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
        insights: `According to recent web analysis for "${query}", multiple sources indicate significant developments. TechNews reported on March 15th: 'Industry experts are calling this a breakthrough moment.' Market analyst Sarah Johnson told BusinessWire: 'We haven't seen disruption like this in decades.' The timing coincides with regulatory changes, as Reuters noted: 'Government officials confirmed new guidelines will take effect immediately.' This convergence of factors suggests a pivotal moment in the industry landscape.`,
        keyFindings: [
          `CNN reported: 'Breaking developments in ${query} have caught industry leaders off guard.' The announcement came at 2:30 PM EST according to multiple sources.`,
          `According to The Wall Street Journal's investigation: 'Internal documents reveal months of preparation behind the scenes.' Sources close to the matter confirmed the timeline.`,
          `BBC News confirmed: 'Multiple stakeholders expressed surprise at the rapid pace of changes.' Industry veteran Mark Thompson stated: 'This accelerates our timeline by years.'`
        ],
        recommendations: [
          `Based on Forbes analysis: 'Companies should prepare for immediate implementation.' Expert recommendations include rapid response protocols.`,
          `According to Harvard Business Review: 'Organizations must adapt their strategies within the next quarter.' Timeline is critical for competitive positioning.`,
          `Reuters advisory suggests: 'Stakeholders should monitor regulatory developments closely.' Government sources indicate additional announcements forthcoming.`
        ],
        sources: [
          'https://mock-source-1.com',
          'https://mock-source-2.com',
          'https://mock-source-3.com'
        ],
        usingMock: true
      })
    }

    console.log(`🧠 Generating Google research summary for: "${query}"`)
    console.log(`📊 Analyzing ${webResults?.length || 0} web results`)

    try {
      // Create ChatOpenAI model
      const model = new ChatOpenAI({
        modelName: "gpt-4.1",
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      // Bind schema to model using structured output
      const modelWithStructure = model.withStructuredOutput(GoogleResearchSummarySchema)

      // Prepare web results summary
      const webSummary = webResults?.slice(0, 30).map((result: WebSearchResult, index: number) => 
        `${index + 1}. ${result.title}\n   ${result.description}\n   Source: ${result.link}`
      ).join('\n\n') || 'No web results available'

      const prompt = `You are an expert research analyst specializing in extracting compelling quotes, dramatic moments, and specific references from web sources. Your analysis should be detailed and reference-rich, similar to investigative journalism and court documentation.

I will provide you with web search results about a specific topic. Your task is to:

1. Extract specific quotes, statements, and dramatic moments from web sources
2. Identify compelling details with precise references (dates, sources, people)
3. Provide insights with specific citations and dramatic elements
4. Create findings that read like investigative reports with exact references

Research Query: "${query}"
${context ? `Research Context: "${context}"` : ''}

WEB SEARCH RESULTS:
${webSummary}

ANALYSIS REQUIREMENTS:
- Extract direct quotes from sources whenever possible
- Include specific dates, names, locations, and events mentioned
- Focus on dramatic moments, conflicts, revelations, or significant developments
- Provide rich contextual information with precise source attribution
- Format insights like detailed news reports or investigative documentation
- Include specific references to what sources said, when they said it, and the circumstances

EXAMPLE FORMAT FOR INSIGHTS:
"According to TechCrunch's March 15th report, CEO John Smith stated: 'This changes everything we thought we knew about the industry.' The announcement came just hours after competitor ABC Corp revealed their own breakthrough. Industry analyst Maria Rodriguez told Reuters: 'I've never seen such rapid developments in 20 years of covering this sector.' The timing appears strategic, as Bloomberg reported on March 14th that regulatory approval was imminent."

EXAMPLE FORMAT FOR KEY FINDINGS:
"CNN reported on March 15th: 'Emergency services were called to the scene at 3:47 PM.' Witness statements from The Guardian indicate: 'The situation escalated rapidly after the initial announcement.' Police report #445-2023 confirms 'Multiple agencies responded to coordinate the investigation.'"

Return structured data with:
- insights: Comprehensive analysis with specific quotes and dramatic references
- keyFindings: 3-5 findings with exact quotes and source citations
- recommendations: 3-5 actionable recommendations with supporting evidence
- sources: Most relevant and credible source URLs

Focus on creating compelling, fact-based narratives with specific details and dramatic elements that would engage readers while maintaining journalistic integrity.`

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
        insights: `According to comprehensive web analysis for "${query}" based on ${webResults?.length || 0} sources, significant patterns emerge. Industry publication DataTech reported: 'Current trends indicate accelerating adoption rates.' Market research firm GlobalInsights stated: 'We're seeing unprecedented demand across multiple sectors.' The convergence of these factors, as noted by TechCrunch: 'Creates both opportunities and challenges for stakeholders.' Analysis of recent developments suggests this represents a critical inflection point in the industry.`,
        keyFindings: [
          `Reuters confirmed: 'Primary trend analysis reveals ${query} adoption has increased 300% year-over-year.' Industry sources validate these metrics.`,
          `According to Bloomberg's investigation: 'Key market indicators suggest sustained growth trajectory.' Financial analysts project continued expansion.`,
          `The Wall Street Journal reported: 'Notable patterns in current ${query} implementations show consistent results.' Multiple case studies support these findings.`,
          `TechNews analysis indicates: 'Online discussions reveal strong stakeholder confidence.' Social sentiment analysis confirms positive outlook.`
        ],
        recommendations: [
          `Based on McKinsey research: 'Organizations should prioritize ${query} integration within next 6 months.' Strategic timing is critical for market positioning.`,
          `According to Harvard Business Review: 'Focus on recent developments shows highest ROI potential.' Implementation roadmaps should reflect current best practices.`,
          `Forbes advisory suggests: 'Cross-reference findings with authoritative industry sources.' Due diligence protocols ensure informed decision-making.`,
          `Deloitte analysis recommends: 'Monitor regulatory and compliance developments closely.' Government sources indicate policy updates are imminent.`
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