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
      additionalResearch, // YouTube research data
      youtubeLinks, // YouTube video links with timestamps
      timestamps, // Specific timestamps for this section
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
      additionalResearch: additionalResearch ? `${additionalResearch.length} characters` : 'none',
      youtubeLinks: youtubeLinks ? `${youtubeLinks.length} links` : 'none',
      timestamps: timestamps ? `${timestamps.length} timestamps` : 'none',
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
        usingMock: true,
        requiresApproval: true // Add flag to indicate approval needed
      })
    }

    console.log(`🚀 Generating full script for section: ${finalTitle}`)

    // Determine which model to use
    const modelToUse = requestedModel || "gpt-4.1-mini";
    console.log(`Using model: ${modelToUse}`);

    try {
      // Use custom prompt if provided, otherwise use the default style guide
      let prompt = `
Follow these style rules for every script and section you write:

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

YOUTUBE CLIP INTEGRATION:
- Place clips throughout the script where they naturally enhance the narrative
- For rap/hip-hop content: alternate between narration → clip → connecting narration → clip
- For true crime content: use clips to show evidence/moments, then provide analysis
- Narration should connect clips seamlessly without spoiling what's shown
- Use format: [[CLIP: video_url | start_time-end_time | brief_description]]
- Only use timestamps that exist within the actual video length
- Extract timestamps from the research data provided

GENERAL PRINCIPLES:
- Remain unbiased, especially on sensitive topics
- Use adverbs to sensationalize main events, but don't overdo it
- The best trick is knowing what to leave out - avoid unnecessary details
- Stay on topic and pick the most interesting, valuable, and exciting information
- Focus on quality and engagement, NOT word count or length requirements
- Avoid artificial padding or repetition to meet arbitrary length goals

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
- Write a complete, polished script for this specific section
- Follow the writing instructions precisely
- Target the specified audience with the appropriate tone
- Ensure the content fits naturally within the overall project theme
- Make it engaging, professional, and ready for production use
- Use natural, conversational language appropriate for voiceover
- Include proper pacing and flow
- Do not include stage directions or formatting - just the pure script content
- Focus on QUALITY over quantity - no artificial word count padding`

      // Add research data if provided
      if (additionalResearch) {
        prompt += `\n\nRESEARCH DATA AND CLIP INFORMATION:
Use the following research data to ground your script in real facts, quotes, and insights. Pay special attention to YouTube clips with their timestamps and descriptions:

${additionalResearch}

CLIP PLACEMENT INSTRUCTIONS:
- Extract actual timestamps and descriptions from the research data above
- Place clips throughout your script where they naturally fit the narrative
- Use the format: [[CLIP: video_url | actual_timestamp_from_research | description]]
- Ensure timestamps are within the actual video length (check research data)
- Don't place all clips at the beginning - distribute them throughout the script
- Let the narrative flow guide clip placement, not arbitrary rules`
      }

      // Handle legacy YouTube links format
      if (youtubeLinks && youtubeLinks.length > 0) {
        prompt += `\n\nLEGACY YOUTUBE LINKS PROVIDED:
${youtubeLinks.map((link: any, index: number) => 
  `${index + 1}. ${link.url} - Timestamps: ${link.timestamps || 'Full video'}`
).join('\n')}

NOTE: Use these links but verify timestamps against the research data above for accuracy.`
      }

      prompt += `\n\nWrite the script now, incorporating clips naturally throughout the content:`

      console.log('Sending request to OpenAI...')
      console.log('Prompt preview:', prompt.substring(0, 300) + '...')

      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: "You are a professional script writer who creates engaging, natural-sounding scripts for voiceover and video content. Always write in a conversational, engaging tone that flows naturally when spoken aloud. When research data includes YouTube clips with timestamps and descriptions, integrate them throughout the script where they naturally enhance the narrative - not just at the beginning. Use the format [[CLIP: url | timestamp | description]] and ensure timestamps are accurate based on the research data provided. Focus on quality content that uses clips effectively to tell a compelling story."
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
        usingStoredPrompt: !!finalPrompt,
        requiresApproval: true // Add flag to indicate approval needed
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
        requiresApproval: true, // Add flag to indicate approval needed
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
  
  // Generate different patterns based on theme
  let script = ''
  
  if (projectTheme === 'rap') {
    script = `This is the ${sectionTitle} section${contextInfo}${audienceInfo}. ${writingInstructions}

Welcome to this engaging content about hip-hop culture and street dynamics${toneInfo ? `, presented${toneInfo}` : ''}. 

[[CLIP: mock_youtube_url | 0:15-0:45 | dramatic_opening_moment]]

What you just saw sets the stage for everything that's about to unfold. The streets don't play games, and neither do the artists who represent them.

[[CLIP: mock_youtube_url | 1:20-2:10 | main_incident_footage]]

That escalation happened faster than anyone expected. This is exactly what we're talking about when we say the internet changes everything.

The connection between social media and street credibility has created a dangerous new reality for artists trying to balance authenticity with safety.

[[CLIP: mock_youtube_url | 3:05-3:35 | aftermath_reaction]]

And that's how quickly everything can change in this game.`
  } else if (projectTheme === 'crime') {
    script = `This is the ${sectionTitle} section${contextInfo}${audienceInfo}. ${writingInstructions}

[[CLIP: mock_youtube_url | 0:00-0:30 | courtroom_incident_begins]]

What you just witnessed was the moment everything changed in that courtroom. The tension that had been building for weeks finally erupted${toneInfo ? `, and the ${tone} reality` : ', and the reality'} of what happened next would shock everyone present.

Legal experts had been watching this case closely, but nobody anticipated the dramatic turn it would take. The defendant's reaction revealed the depth of emotion that had been simmering beneath the surface throughout the proceedings.

[[CLIP: mock_youtube_url | 2:15-3:00 | security_response]]

The swift response from court security demonstrates just how quickly situations can escalate in high-stakes legal proceedings. This incident would later become a case study in courtroom security protocols.

The implications of what happened that day continue to influence how similar cases are handled, making this a pivotal moment in legal history.`
  } else {
    script = `This is the ${sectionTitle} section${contextInfo}${audienceInfo}. ${writingInstructions}

Welcome to this engaging exploration${contextInfo}${toneInfo ? `, presented${toneInfo}` : ''}. 

[[CLIP: mock_youtube_url | 0:30-1:15 | key_demonstration]]

As you can see from that example, the concepts we're discussing have real-world applications that directly impact our understanding of the subject.

This section provides insights that are both informative and accessible, ensuring that complex ideas are broken down into digestible, actionable information.

[[CLIP: mock_youtube_url | 2:45-3:20 | supporting_evidence]]

That additional context helps reinforce the key points we've been exploring. The evidence speaks for itself and provides a solid foundation for our conclusions.

${targetAudience ? `For ${targetAudience}, this ` : 'This '}information offers practical value that can be applied immediately, making the content both educational and useful.`
  }

  console.log('Mock script generated, length:', script.length)
  return script
} 