import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/export-validation ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get training data and split for validation (20%)
    const { data: texts, error: textsError } = await supabase
      .from('fine_tuning_texts')
      .select(`
        *,
        outline_sections!inner(
          *,
          fine_tuning_jobs!inner(
            id,
            name,
            theme,
            user_id
          )
        )
      `)
      .eq('fine_tuning_outline_sections.fine_tuning_jobs.user_id', user.id)
      .not('generated_script', 'is', null)

    if (textsError) {
      console.error('Database error fetching texts:', textsError)
      return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 })
    }

    if (!texts || texts.length === 0) {
      console.log('No training data found')
      return NextResponse.json({ error: 'No training data available' }, { status: 404 })
    }

    // Sort texts by creation time for consistent splits
    const sortedTexts = texts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    // Calculate split indices for 80/20 split
    const totalCount = sortedTexts.length
    const trainEndIndex = Math.floor(totalCount * 0.8)
    
    // Get validation set (20%)
    const validationTexts = sortedTexts.slice(trainEndIndex)

    console.log(`Split summary: Total=${totalCount}, Training=${trainEndIndex}, Validation=${validationTexts.length}`)

    if (validationTexts.length === 0) {
      return NextResponse.json({ error: 'Not enough data for validation split' }, { status: 400 })
    }

    // Convert to JSONL format
    const jsonlLines = validationTexts.map(text => {
      const section = text.outline_sections
      const job = section.fine_tuning_jobs

      return JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a professional script writer who creates engaging, natural-sounding scripts for voiceover and video content. Always write in a conversational, engaging tone that flows naturally when spoken aloud."
          },
          {
            role: "user", 
            content: `Write a complete script section based on the following specifications:

PROJECT CONTEXT:
- Overall Theme: ${job.theme}
- Project Name: ${job.name}

SECTION DETAILS:
- Section Title: ${section.title}
- Writing Instructions: ${section.writing_instructions}

REQUIREMENTS:
- Write a complete and detailed script for this specific section
- Follow the writing instructions precisely
- Make it engaging, professional, and ready for production use
- Use natural, conversational language appropriate for voiceover
- Include proper pacing and flow
- Do not include stage directions or formatting - just the pure script content`
          },
          {
            role: "assistant",
            content: text.generated_script
          }
        ],
        metadata: {
          split: "validation",
          job_id: job.id,
          job_name: job.name,
          section_id: section.id,
          section_title: section.title,
          text_id: text.id,
          quality_score: text.quality_score || 5,
          is_validated: text.is_validated || false,
          character_count: text.character_count || 0,
          word_count: text.word_count || 0
        }
      })
    })

    const jsonlContent = jsonlLines.join('\n')

    console.log(`Generated validation JSONL with ${validationTexts.length} examples`)

    return new NextResponse(jsonlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': 'attachment; filename="script_generation_validation.jsonl"'
      }
    })

  } catch (error) {
    console.error('Unexpected error in export-validation GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/export-validation ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get training data and split for validation (20%)
    const { data: texts, error: textsError } = await supabase
      .from('fine_tuning_texts')
      .select(`
        *,
        outline_sections!inner(
          *,
          fine_tuning_jobs!inner(
            id,
            name,
            theme,
            user_id
          )
        )
      `)
      .eq('fine_tuning_outline_sections.fine_tuning_jobs.user_id', user.id)
      .not('generated_script', 'is', null)

    if (textsError) {
      console.error('Database error fetching texts:', textsError)
      return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 })
    }

    if (!texts || texts.length === 0) {
      console.log('No training data found')
      return NextResponse.json({ 
        success: false, 
        error: 'No training data available',
        summary: { totalTexts: 0, validationTexts: 0 }
      })
    }

    // Sort texts by creation time for consistent splits
    const sortedTexts = texts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    // Calculate split indices for 80/20 split
    const totalCount = sortedTexts.length
    const trainEndIndex = Math.floor(totalCount * 0.8)
    
    // Get validation set (20%)
    const validationTexts = sortedTexts.slice(trainEndIndex)

    console.log(`Split summary: Total=${totalCount}, Training=${trainEndIndex}, Validation=${validationTexts.length}`)

    // Convert to training format
    const trainingData = validationTexts.map(text => {
      const section = text.outline_sections
      const job = section.fine_tuning_jobs

      return {
        messages: [
          {
            role: "system",
            content: "You are a professional script writer who creates engaging, natural-sounding scripts for voiceover and video content. Always write in a conversational, engaging tone that flows naturally when spoken aloud."
          },
          {
            role: "user", 
            content: `Write a complete script section based on the following specifications:

PROJECT CONTEXT:
- Overall Theme: ${job.theme}
- Project Name: ${job.name}

SECTION DETAILS:
- Section Title: ${section.title}
- Writing Instructions: ${section.writing_instructions}

REQUIREMENTS:
- Write a complete and detailed script for this specific section
- Follow the writing instructions precisely
- Make it engaging, professional, and ready for production use
- Use natural, conversational language appropriate for voiceover
- Include proper pacing and flow
- Do not include stage directions or formatting - just the pure script content`
          },
          {
            role: "assistant",
            content: text.generated_script
          }
        ],
        metadata: {
          split: "validation",
          job_id: job.id,
          job_name: job.name,
          section_id: section.id,
          section_title: section.title,
          text_id: text.id,
          quality_score: text.quality_score || 5,
          is_validated: text.is_validated || false,
          character_count: text.character_count || 0,
          word_count: text.word_count || 0
        }
      }
    })

    const summary = {
      totalTexts: totalCount,
      validationTexts: validationTexts.length,
      split: "validation (20%)"
    }

    console.log(`Generated validation data with ${validationTexts.length} examples`)

    return NextResponse.json({
      success: true,
      trainingData,
      summary,
      totalTexts: validationTexts.length
    })

  } catch (error) {
    console.error('Unexpected error in export-validation POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 