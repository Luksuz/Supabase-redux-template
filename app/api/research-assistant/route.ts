import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { researchAnalysisSchema } from "../../../types/research";
import { createModelInstance } from "../../../lib/utils/model-factory";

// Google search function using SerpAPI
async function searchGoogle(query: string) {
  try {
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY environment variable is not set');
    }

    // Increase the number of results to 50
    const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=50`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    const results = data.organic_results || [];
    return results.map((result: any) => ({
      title: result.title || 'No title',
      link: result.link || '',
      description: result.snippet || 'No description'
    }));
  } catch (error) {
    console.error('Google search error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, selectedModel } = await request.json();
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not found" },
        { status: 500 }
      );
    }

    console.log(`🔍 Starting research for query: "${query}"`);

    // Step 1: Perform Google search
    console.log('📡 Fetching search results from Google...');
    const searchResults = await searchGoogle(query);
    console.log(`📊 Retrieved ${searchResults.length} search results`);

    if (searchResults.length === 0) {
      return NextResponse.json(
        { error: "No search results found for the given query" },
        { status: 404 }
      );
    }

    // Step 2: Analyze search results with LLM
    console.log('🤖 Analyzing search results with AI...');
    
    // Initialize the model using the factory
    const model = createModelInstance(selectedModel || 'gpt-4o-mini', 0.7);

    // Create a parser based on our Zod schema
    const parser = StructuredOutputParser.fromZodSchema(researchAnalysisSchema);

    // Prepare search results for analysis (limit to top 20 to stay within token limits)
    const topResults = searchResults.slice(0, 20);
    const searchResultsText = topResults
      .map((result: { title: string; description: string; link: string }, index: number) => `${index + 1}. Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.link}`)
      .join('\n\n');

    // Construct the analysis prompt
    const prompt = `You are an expert content strategist and video creator who specializes in creating viral, engaging content. Analyze the following Google search results and generate insights for creating a compelling video script.

SEARCH QUERY: "${query}"

SEARCH RESULTS:
${searchResultsText}

Based on these search results, analyze the trends, popular angles, and opportunities to create a unique, compelling video that will stand out. Consider:

1. What are the most common themes and angles being covered?
2. What gaps or unique perspectives could we exploit?
3. What emotional triggers and psychological hooks are most effective for this topic?
4. What narrative structure would be most engaging?
5. What specific details, facts, or insights could make our content more authoritative and compelling?

Your goal is to suggest a video concept that is:
- Highly clickable and shareable
- Emotionally engaging and psychologically compelling
- Unique enough to stand out from existing content
- Backed by research-driven insights
- Optimized for viewer retention and engagement

${parser.getFormatInstructions()}`;

    const response = await model.invoke(prompt);
    const analysis = await parser.parse(response.content as string);

    console.log(`✅ Research analysis completed for: "${query}"`);
    console.log(`📝 Suggested title: "${analysis.suggestedTitle}"`);
    console.log(`🎯 Theme: "${analysis.theme}"`);
    console.log(`👥 Target audience: "${analysis.targetAudience}"`);

    return NextResponse.json({
      success: true,
      query,
      searchResults: topResults, // Return only the top results we analyzed
      analysis,
      meta: {
        totalResults: searchResults.length,
        analyzedResults: topResults.length,
        searchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Research assistant error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to complete research analysis';
    if (error instanceof Error) {
      if (error.message.includes('SERPAPI_KEY')) {
        errorMessage = 'Search API key not configured. Please contact administrator.';
      } else if (error.message.includes('No search results')) {
        errorMessage = 'No search results found for this query. Try a different search term.';
      } else {
        errorMessage = `Research failed: ${error.message}`;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 