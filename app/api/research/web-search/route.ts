import { NextRequest, NextResponse } from 'next/server'

const SERPAPI_KEY = process.env.SERPAPI_KEY

interface WebSearchResult {
  title: string
  link: string
  description: string
  source?: string
}

// Google search function using SerpAPI
async function searchGoogle(query: string, maxResults: number = 30): Promise<WebSearchResult[]> {
  try {
    const response = await fetch(
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=${Math.min(maxResults, 50)}`
    )
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error)
    }
    
    const results = data.organic_results || []
    return results.map((result: any) => ({
      title: result.title || 'No title',
      link: result.link || '',
      description: result.snippet || 'No description',
      source: 'Google'
    }))
  } catch (error) {
    console.error('Google search error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/research/web-search ===')
  
  try {
    const { query, context, maxResults = 30 } = await request.json()
    
    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      )
    }

    if (!SERPAPI_KEY) {
      return NextResponse.json(
        { success: false, error: 'SerpAPI key not configured' },
        { status: 500 }
      )
    }

    console.log(`🔍 Searching web for: "${query}" (max: ${maxResults} results)`)
    
    // Enhance query with context if provided
    const enhancedQuery = context ? `${query} ${context}` : query
    
    const results = await searchGoogle(enhancedQuery, maxResults)
    
    console.log(`✅ Found ${results.length} web search results`)
    
    return NextResponse.json({
      success: true,
      results,
      query: enhancedQuery,
      totalResults: results.length
    })

  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search web'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Web search API is running',
    endpoints: {
      POST: 'Search the web using Google/SerpAPI'
    }
  })
} 