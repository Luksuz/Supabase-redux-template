import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      promptId, // New parameter for using stored prompts
      customPrompt: customPromptParam, // New parameter for edited prompt content
      model: requestedModel, // Add support for custom model
      // Legacy parameter names for backward compatibility
      sectionTitle, 
      projectTheme, 
      projectTitle, 
      additionalContext 
    } = requestBody

    // Use new parameter names, fallback to legacy ones
    const finalTitle = title || sectionTitle
    const finalTheme = theme || projectTheme
    let finalInstructions = writingInstructions
    let finalPrompt = null

    // If customPrompt is provided, use it directly (edited prompt from frontend)
    if (customPromptParam) {
      finalPrompt = customPromptParam
      console.log('Using edited prompt from frontend')
    } else if (promptId) {
      // Otherwise, if promptId is provided, fetch the stored prompt
      console.log(`Fetching stored prompt with ID: ${promptId}`)
      const { data: storedPrompt, error } = await supabase
        .from('fine_tuning_prompts')
        .select('*')
        .eq('id', promptId)
        .single()

      if (error) {
        console.error('Error fetching stored prompt:', error)
        return NextResponse.json(
          { error: 'Stored prompt not found' },
          { status: 404 }
        )
      }

      finalPrompt = storedPrompt.prompt
      console.log(`Using stored prompt: ${storedPrompt.title}`)
    }

    console.log('Extracted parameters:', {
      finalTitle,
      finalInstructions,
      finalTheme,
      targetAudience,
      tone,
      stylePreferences,
      additionalContext,
      usingStoredPrompt: !!finalPrompt,
      model: requestedModel
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

    // Determine which model to use
    const modelToUse = requestedModel || "gpt-4.1-mini";
    console.log(`Using model: ${modelToUse}`);

    try {
      // Use custom prompt if provided, otherwise use the default style guide
      const prompt = finalPrompt || `CRIME DYNASTY SCRIPTWRITING STYLE GUIDE:

Follow these style rules for every script and section you write.

INTROS:
- Keep intros short (30-50 words max), in medias res, simple, and straight to the point
- Avoid long sentences and complex words - if a 5th grader can't understand it, it's too complex
- Fit the "what", "who", "how", and "when" without being verbose
- Dive straight into action instead of lengthy introductions
- Make it appealing to the ear for voiceover

CONVERSATIONAL WRITING:
- Write like you talk, for voiceover narration
- Use short sentences, active voice, simple words, and natural transitions
- Avoid filler like 'uhh'/'umm', but add personal narrator comments when appropriate
- Read your script out loud - it should sound like talking, not writing
- Use transitional words/devices to improve flow

DATES AND STRUCTURE:
- Use dates at the start of sentences when applicable, but never write 'On May 15th' - just 'May 15th'
- Use in medias res often, especially for intros and top 10/5 entries
- Vary entry structure - don't follow the same format for every entry
- For top 5/10 scripts about people, use only the person's name as the subheading

GENERAL PRINCIPLES:
- Remain unbiased, especially on sensitive topics
- Use adverbs to sensationalize main events, but don't overdo it
- The best trick is knowing what to leave out - avoid unnecessary details
- Stay on topic and pick the most interesting, valuable, and exciting information

EXAMPLES:
- "July 7th, 2022, a Tiktoker shut down a bridge in Mexico... Here are five times TikTokers messed with the wrong cartel." (49 words, all key info, in medias res)
- Add personal narrator comments for emphasis when appropriate
- Keep background stories brief to maintain engagement

ALWAYS follow these rules. Focus on creating engaging, conversational content that flows naturally when spoken aloud.

You are a professional script writer. Write a complete script section based on the following specifications:

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
- Write a complete and detalied(at least 1000 words), polished script for this specific section
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
        model: modelToUse,
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
        usingMock: false,
        usingStoredPrompt: !!finalPrompt
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