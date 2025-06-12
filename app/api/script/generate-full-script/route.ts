import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  console.log('=== POST /api/generate-full-script ===')
  
  try {
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body received:', requestBody)
    
    const { 
      title,
      writingInstructions, 
      theme,
      targetAudience,
      tone,
      stylePreferences,
      // Legacy parameter names for backward compatibility
      sectionTitle, 
      projectTheme, 
      projectTitle, 
      additionalContext 
    } = requestBody

    // Use new parameter names, fallback to legacy ones
    const finalTitle = title || sectionTitle
    const finalTheme = theme || projectTheme
    const finalInstructions = writingInstructions

    console.log('Extracted parameters:', {
      finalTitle,
      finalInstructions,
      finalTheme,
      targetAudience,
      tone,
      stylePreferences,
      additionalContext
    })

    if (!finalTitle || !finalInstructions) {
      console.log('Validation failed:', {
        title: !!finalTitle,
        writingInstructions: !!finalInstructions
      })
      return NextResponse.json(
        { error: 'Section title and writing instructions are required' },
        { status: 400 }
      )
    }

    console.log('Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock script')
      const mockScript = generateMockScript(
        finalTitle, 
        finalInstructions, 
        finalTheme, 
        targetAudience,
        tone,
        stylePreferences
      )
      console.log('Generated mock script length:', mockScript.length)
      return NextResponse.json({
        success: true,
        script: mockScript,
        usingMock: true
      })
    }

    console.log(`🚀 Generating full script for section: ${finalTitle}`)

    try {
      const prompt = `You are a professional script writer. Write a complete script section based on the following specifications:

PROJECT CONTEXT:
- Overall Theme: ${finalTheme || 'General content'}
- Target Audience: ${targetAudience || 'General audience'}
- Tone: ${tone || 'Professional'}
- Style Preferences: ${stylePreferences || 'Clear and engaging'}
- Additional Context: ${additionalContext || 'None provided'}

SECTION DETAILS:
- Section Title: ${finalTitle}
- Writing Instructions: ${finalInstructions}

REQUIREMENTS:
- Write a complete, polished script for this specific section
- Follow the writing instructions precisely
- Target the specified audience with the appropriate tone
- Ensure the content fits naturally within the overall project theme
- Make it engaging, professional, and ready for production use
- Use natural, conversational language appropriate for voiceover
- Include proper pacing and flow
- Do not include stage directions or formatting - just the pure script content

Write the script now:`

      console.log('Sending request to OpenAI...')
      console.log('Prompt preview:', prompt.substring(0, 300) + '...')

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional script writer who creates engaging, natural-sounding scripts for voiceover and video content. Always write in a conversational, engaging tone that flows naturally when spoken aloud."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.8
      })

      console.log('OpenAI response received')
      const script = response.choices[0]?.message?.content?.trim()
      console.log('Generated script length:', script?.length || 0)
      
      if (!script) {
        throw new Error('No script generated from OpenAI')
      }

      console.log(`✅ Generated full script for section: ${finalTitle}`)
      
      return NextResponse.json({
        success: true,
        script: script,
        usingMock: false
      })

    } catch (openaiError: any) {
      console.error(`❌ OpenAI API error for section ${finalTitle}:`, openaiError)
      console.error('OpenAI error details:', {
        name: openaiError.name,
        message: openaiError.message,
        status: openaiError.status,
        type: openaiError.type
      })
      
      // Fallback to mock if OpenAI fails
      console.log('Falling back to mock script...')
      const mockScript = generateMockScript(
        finalTitle, 
        finalInstructions, 
        finalTheme, 
        targetAudience,
        tone,
        stylePreferences
      )
      console.log('Generated fallback mock script length:', mockScript.length)
      
      return NextResponse.json({
        success: true,
        script: `[AI Unavailable - Mock Script]\n\n${mockScript}`,
        usingMock: true,
        error: openaiError.message
      })
    }

  } catch (error) {
    console.error('Unexpected error in generate-full-script:', error)
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    return NextResponse.json(
      { error: 'Failed to generate script: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// Mock script generator (fallback)
function generateMockScript(
  sectionTitle: string, 
  writingInstructions: string, 
  projectTheme?: string, 
  targetAudience?: string,
  tone?: string,
  stylePreferences?: string
): string {
  console.log('Generating mock script with:', {
    sectionTitle,
    projectTheme,
    targetAudience,
    tone,
    stylePreferences
  })
  
  const contextInfo = projectTheme ? ` related to ${projectTheme}` : ''
  const audienceInfo = targetAudience ? ` for ${targetAudience}` : ''
  const toneInfo = tone ? ` in a ${tone} tone` : ''
  
  const script = `This is the ${sectionTitle} section${contextInfo}${audienceInfo}. ${writingInstructions}

Welcome to this engaging content${contextInfo}. In this section, we explore the key concepts and ideas that make this topic both fascinating and relevant to your interests.

${toneInfo ? `Using a ${tone} approach, we ` : 'We '}present information that is designed to be both informative and accessible, ensuring that complex ideas are broken down into digestible, actionable insights.

${targetAudience ? `Speaking directly to ${targetAudience}, we ` : 'We '}dive deep into the subject matter while maintaining a conversational flow that keeps you engaged throughout this journey.

${stylePreferences ? `Following the style preference of ${stylePreferences}, this ` : 'This '}content has been crafted to flow naturally, with careful attention to pacing and clarity, making it perfect for audio delivery.

The section concludes by reinforcing the key messages while setting up a natural transition to the next part of our exploration, maintaining momentum and keeping the audience eager to continue.`

  console.log('Mock script generated, length:', script.length)
  return script
} 