import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  console.log('=== POST /api/prompts/merge-data ===')
  
  try {
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body received:', requestBody)
    
    const { 
      currentPrompt,
      youtubeData,
      theme
    } = requestBody

    console.log('Extracted parameters:', {
      currentPrompt: currentPrompt ? `${currentPrompt.substring(0, 100)}...` : null,
      youtubeDataCount: youtubeData?.length || 0,
      theme
    })

    if (!currentPrompt || !youtubeData || !Array.isArray(youtubeData) || youtubeData.length === 0) {
      console.log('Validation failed: missing required parameters')
      return NextResponse.json(
        { error: 'Current prompt and YouTube data are required' },
        { status: 400 }
      )
    }

    console.log('Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock merged prompt')
      const mockMergedPrompt = generateMockMergedPrompt(currentPrompt, youtubeData, theme)
      console.log('Generated mock merged prompt length:', mockMergedPrompt.length)
      return NextResponse.json({
        success: true,
        mergedPrompt: mockMergedPrompt,
        usingMock: true
      })
    }

    console.log(`🚀 Merging YouTube data with prompt for theme: ${theme}`)

    try {
      const prompt = `You are an expert prompt engineer and content strategist. Your task is to merge YouTube research data with an existing prompt to create an enhanced, data-driven prompt that incorporates real insights and hooks.

CURRENT PROMPT:
${currentPrompt}

YOUTUBE RESEARCH DATA:
${youtubeData.map((item, index) => `
${index + 1}. ${item.type?.toUpperCase() || 'DATA'}:
   Title: ${item.title || 'N/A'}
   ${item.summary ? `Summary: ${item.summary}` : ''}
   ${item.keyInsights ? `Key Insights: ${item.keyInsights.join(', ')}` : ''}
   ${item.narrativeThemes ? `Narrative Themes: ${item.narrativeThemes.join(', ')}` : ''}
   ${item.characterInsights ? `Character Insights: ${item.characterInsights.join(', ')}` : ''}
   ${item.conflictElements ? `Conflicts: ${item.conflictElements.join(', ')}` : ''}
   ${item.storyIdeas ? `Story Ideas: ${item.storyIdeas.join(', ')}` : ''}
   ${item.analysis ? `Analysis: ${item.analysis}` : ''}
   ${item.relevantContent ? `Relevant Content: "${item.relevantContent}"` : ''}
   ${item.timestamp ? `Timestamp: ${item.timestamp}` : ''}
`).join('\n')}

THEME: ${theme || 'General content'}

INSTRUCTIONS:
1. Analyze the YouTube research data to identify:
   - Compelling hooks and opening lines
   - Specific facts, statistics, or quotes that can be used
   - Character details and motivations
   - Conflict elements and dramatic tensions
   - Narrative patterns and themes
   - Emotional moments and turning points

2. Enhance the current prompt by:
   - Adding specific data integration instructions
   - Including compelling hooks derived from the research
   - Incorporating character insights and motivations
   - Adding conflict elements and dramatic tensions
   - Providing specific examples and quotes to use
   - Maintaining the original prompt's style and structure

3. Create a comprehensive prompt that:
   - Instructs the AI to use the specific research data provided
   - Includes ready-to-use hooks and opening lines
   - Provides character backgrounds and motivations
   - Suggests dramatic conflicts and story arcs
   - Maintains authenticity and factual accuracy
   - Follows the original prompt's guidelines and style

4. Format the enhanced prompt clearly with:
   - Clear sections for data usage instructions
   - Specific hooks and opening suggestions
   - Character and conflict guidance
   - Examples of how to integrate the research
   - Maintained original style guidelines

Return ONLY the enhanced prompt text, ready to be used for content generation. Do not include explanations or meta-commentary.`

      console.log('Sending request to OpenAI...')
      console.log('Prompt preview:', prompt.substring(0, 300) + '...')

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert prompt engineer who specializes in merging research data with content generation prompts. Create enhanced prompts that seamlessly integrate real data while maintaining the original style and effectiveness."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })

      console.log('OpenAI response received')
      const mergedPrompt = response.choices[0]?.message?.content?.trim()
      console.log('Generated merged prompt length:', mergedPrompt?.length || 0)
      
      if (!mergedPrompt) {
        throw new Error('No merged prompt generated from OpenAI')
      }

      console.log(`✅ Successfully merged YouTube data with prompt`)
      
      return NextResponse.json({
        success: true,
        mergedPrompt: mergedPrompt,
        usingMock: false
      })

    } catch (openaiError: any) {
      console.error(`❌ OpenAI API error:`, openaiError)
      console.error('OpenAI error details:', {
        name: openaiError.name,
        message: openaiError.message,
        status: openaiError.status,
        type: openaiError.type
      })
      
      // Fallback to mock if OpenAI fails
      console.log('Falling back to mock merged prompt...')
      const mockMergedPrompt = generateMockMergedPrompt(currentPrompt, youtubeData, theme)
      console.log('Generated fallback mock merged prompt length:', mockMergedPrompt.length)
      
      return NextResponse.json({
        success: true,
        mergedPrompt: mockMergedPrompt,
        usingMock: true,
        error: openaiError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in merge-data:', error)
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    return NextResponse.json(
      { error: 'Failed to merge data with prompt: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// Mock merged prompt generator (fallback)
function generateMockMergedPrompt(
  currentPrompt: string,
  youtubeData: any[],
  theme?: string
): string {
  console.log('Generating mock merged prompt with:', {
    currentPromptLength: currentPrompt.length,
    youtubeDataCount: youtubeData.length,
    theme
  })
  
  const hooks = youtubeData
    .filter(item => item.title)
    .slice(0, 3)
    .map(item => `"${item.title}"`)
    .join(', ')
  
  const insights = youtubeData
    .flatMap(item => item.keyInsights || [])
    .slice(0, 5)
    .join(', ')
  
  const conflicts = youtubeData
    .flatMap(item => item.conflictElements || [])
    .slice(0, 3)
    .join(', ')

  const mergedPrompt = `${currentPrompt}

ENHANCED WITH YOUTUBE RESEARCH DATA:

COMPELLING HOOKS TO USE:
- Start with one of these proven engaging openings: ${hooks || 'Use dramatic moments from the research'}
- Reference specific moments and timestamps from the video analysis
- Build tension using the conflict elements identified in the research

RESEARCH-BASED CONTENT INTEGRATION:
- Use these key insights: ${insights || 'Character motivations, plot developments, and dramatic tensions from the research'}
- Incorporate specific quotes and moments from the video transcripts
- Reference the following conflicts and tensions: ${conflicts || 'Personal struggles, external challenges, and dramatic confrontations'}

DATA USAGE INSTRUCTIONS:
- Always fact-check against the provided research data
- Use specific timestamps and quotes when available
- Maintain authenticity by staying true to the source material
- Build narrative tension using the identified conflict elements
- Incorporate character insights and motivations from the analysis

THEME FOCUS: ${theme || 'General content'}
- Ensure all content aligns with the theme while using the research data
- Create compelling narratives that blend the research insights with engaging storytelling
- Use the YouTube data as the foundation for factual accuracy and compelling hooks

[Mock Enhancement - Set OPENAI_API_KEY for AI-powered prompt merging]`

  console.log('Mock merged prompt generated, length:', mergedPrompt.length)
  return mergedPrompt
} 