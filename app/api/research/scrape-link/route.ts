import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import FireCrawlApp from '@mendable/firecrawl-js'

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "fc-76340c36330641ebabc0b9ab85458d21"

// Enhanced Zod schema for rich research extraction (same as Perplexity)
const ArticleSummarySchema = z.object({
  articleId: z.string().describe("Unique identifier for the article"),
  title: z.string().describe("Article title"),
  url: z.string().describe("Article URL"),
  source: z.string().describe("Source publication name"),
  keyPoints: z.array(z.string()).describe("3-5 key points from this article"),
  mainTopic: z.string().describe("Primary topic/theme of the article"),
  keyQuotes: z.array(z.string()).describe("Important quotes from the article"),
  narrativeElements: z.array(z.string()).describe("Story elements, conflicts, or dramatic points"),
  emotionalTone: z.string().describe("Emotional tone of the article (e.g., urgent, optimistic, analytical)"),
  dramaticElements: z.array(z.string()).describe("Dramatic or compelling elements for storytelling"),
  contextualInfo: z.string().describe("Background context and significance"),
  overallTheme: z.string().describe("Overall theme or message of the article"),
  date: z.string().optional().describe("Publication date if available")
})

const ResearchExtractionSchema = z.object({
  overallTheme: z.string().describe("Central theme connecting all research findings"),
  keyInsights: z.array(z.string()).describe("5-7 major insights from the research"),
  articleSummaries: z.array(ArticleSummarySchema).describe("Detailed analysis of key articles"),
  commonPatterns: z.array(z.string()).describe("Patterns or trends across multiple sources"),
  actionableItems: z.array(z.string()).describe("Specific actionable recommendations"),
  narrativeThemes: z.array(z.string()).describe("Story themes for content creation"),
  characterInsights: z.array(z.string()).describe("Insights about people, organizations, or key figures"),
  conflictElements: z.array(z.string()).describe("Tensions, conflicts, or controversies discovered"),
  storyIdeas: z.array(z.string()).describe("Creative story ideas based on the research"),
  creativePrompt: z.string().describe("Creative writing prompt for content creation"),
  visualAudioCues: z.array(z.string()).describe("Visual or audio elements that could enhance content"),
  audienceQuestions: z.array(z.string()).describe("Engaging questions or hooks for audience engagement")
})

// Scrape content using Firecrawl
async function scrapeWithFirecrawl(url: string): Promise<{ content: string, title: string }> {
  console.log(`🔥 Scraping URL with Firecrawl: ${url}`)
  
  const app = new FireCrawlApp({ apiKey: FIRECRAWL_API_KEY })
  
  try {
    const scrapeResult = await app.scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      parsePDF: true,
      maxAge: 14400000 // 4 hours cache
    })
    
    // Check if scraping was successful and has data
    if (!scrapeResult.success || !scrapeResult.markdown) {
      throw new Error('Failed to extract content from URL')
    }
    
    console.log(`✅ Successfully scraped ${url}`)
    
    return {
      content: scrapeResult.markdown,
      title: scrapeResult.metadata?.title || 'Scraped Article'
    }
    
  } catch (error) {
    console.error(`❌ Firecrawl scraping failed for ${url}:`, error)
    throw new Error(`Failed to scrape URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Extract structured research data from scraped content
async function extractResearchFromContent(content: string, url: string, title: string, extractionPrompt?: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not found, using basic extraction')
    return {
      overallTheme: title,
      keyInsights: ['Content extracted from web page'],
      articleSummaries: [{
        articleId: `scraped-${Date.now()}`,
        title,
        url,
        source: new URL(url).hostname,
        keyPoints: ['Key information from the article'],
        mainTopic: title,
        keyQuotes: [],
        narrativeElements: [],
        emotionalTone: 'Informative',
        dramaticElements: [],
        contextualInfo: content.substring(0, 500) + '...',
        overallTheme: title,
        date: new Date().toISOString().split('T')[0]
      }],
      commonPatterns: [],
      actionableItems: ['Review the extracted content'],
      narrativeThemes: [],
      characterInsights: [],
      conflictElements: [],
      storyIdeas: [],
      creativePrompt: `Create content based on insights from: ${title}`,
      visualAudioCues: [],
      audienceQuestions: []
    }
  }

  console.log(`🤖 Extracting research data from scraped content using LLM`)

  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 4000
  })

  const systemPrompt = `You are an expert research analyst and fact extractor specializing in comprehensive content analysis. Your mission is to extract EVERY important fact, detail, and insight from web content with maximum thoroughness.

CORE RESPONSIBILITIES:
1. COMPREHENSIVE FACT EXTRACTION - Identify and capture ALL significant facts, statistics, dates, names, locations, events, and data points
2. CONTEXTUAL ANALYSIS - Provide deep context for why each fact matters and how it connects to broader themes
3. COMPLETE COVERAGE - Ensure no important information is overlooked or missed
4. RICH STORYTELLING ELEMENTS - Extract narrative angles, conflicts, and compelling human elements
5. CREATIVE CONTENT POTENTIAL - Identify visual, audio, and engagement opportunities

EXTRACTION PRIORITIES:
- Key facts, statistics, and data points (with specific numbers, dates, percentages)
- Important people, organizations, and entities mentioned
- Significant events, incidents, or developments described
- Quotes, statements, and direct information from sources
- Background context and historical significance
- Implications, consequences, and future outlook
- Conflicts, controversies, and dramatic elements
- Technical details, processes, and methodologies
- Geographic locations and relevant settings
- Timeline of events and chronological details

Be exhaustive in your fact extraction while maintaining clear organization and actionable insights for content creation.`

  const userPrompt = `Perform a COMPREHENSIVE analysis of this scraped web content. Extract ALL important facts and provide extensive summaries:

URL: ${url}
TITLE: ${title}

CONTENT:
${content}

${extractionPrompt ? `SPECIAL EXTRACTION FOCUS:
The user has specifically requested you to focus on: "${extractionPrompt}"

Please pay extra attention to this directive while still maintaining comprehensive coverage of the content. Prioritize information related to this focus area in your analysis.

` : ''}REQUIRED ANALYSIS:

1. COMPLETE FACT EXTRACTION:
   - Extract EVERY significant fact, statistic, date, name, and data point
   - Include specific numbers, percentages, monetary amounts, timeframes
   - Capture all mentioned people, organizations, locations, events
   - Note direct quotes and key statements from sources

2. EXTENSIVE SUMMARY:
   - Provide comprehensive overview covering all major points
   - Include detailed background context and significance
   - Explain connections between different facts and themes
   - Cover implications, consequences, and future outlook

3. STORYTELLING & CONTENT ELEMENTS:
   - Identify compelling narrative angles and human interest elements
   - Extract dramatic moments, conflicts, controversies, or tensions
   - Note visual/audio opportunities (scenes, interviews, demonstrations)
   - Create engaging audience hooks and discussion questions

4. ACTIONABLE INSIGHTS:
   - Provide specific recommendations based on the content
   - Suggest creative content ideas and story angles
   - Identify potential follow-up research directions
   - Note gaps or areas needing additional investigation

Be thorough and comprehensive - this analysis should capture the COMPLETE picture of what this content contains, ensuring no significant information is missed.`

  try {
    const modelWithStructure = model.withStructuredOutput(ResearchExtractionSchema)
    
    const structuredOutput = await modelWithStructure.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ])

    console.log(`✅ Extracted rich research data from scraped content`)
    return structuredOutput

  } catch (error) {
    console.error('LLM extraction error:', error)
    throw new Error(`Failed to extract research data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/research/scrape-link ===')
  
  try {
    const { url, title: providedTitle, extractionPrompt } = await request.json()
    
    if (!url || !url.trim()) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 })
    }

    console.log(`🔍 Starting link scraping for: ${url}`)

    // Step 1: Scrape content with Firecrawl
    const { content, title } = await scrapeWithFirecrawl(url)
    const finalTitle = providedTitle || title

    // Step 2: Extract structured research data
    const researchSummary = await extractResearchFromContent(content, url, finalTitle, extractionPrompt)

    // Step 3: Format response with standardized research format
    const wordCount = content.split(/\s+/).length
    const response = {
      id: `scraped-${Date.now()}`,
      title: finalTitle,
      query: `Scraped from: ${finalTitle}`,
      type: 'firecrawl', // Use new research type
      context: `Content scraped from ${url}`,
      webResults: [{
        title: finalTitle,
        link: url,
        description: content.substring(0, 300) + '...',
        source: new URL(url).hostname
      }],
      researchSummary,
      insights: researchSummary.overallTheme,
      keyFindings: researchSummary.keyInsights,
      recommendations: researchSummary.actionableItems,
      sources: [url],
      timestamp: new Date().toISOString(),
      usingMock: false,
      appliedToScript: false,
      // New standardized fields
      url,
      scraped_content: content,
      research_method: 'firecrawl_scraping',
      word_count: wordCount,
      source: 'firecrawl_api',
      category: 'Scraped Content'
    }

    console.log(`✅ Successfully completed link scraping for: ${url}`)

    return NextResponse.json({
      success: true,
      research: response
    })

  } catch (error) {
    console.error('❌ Link scraping error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred during scraping'
    }, { status: 500 })
  }
} 