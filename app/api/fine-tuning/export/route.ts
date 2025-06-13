import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/export ===')
  
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

    console.log('Fetching jobs with sections and texts for user:', user.id)
    
    // Fetch all jobs with their sections and texts
    const { data: jobs, error } = await supabase
      .from('fine_tuning_jobs')
      .select(`
        id,
        name,
        theme,
        prompt_used,
        fine_tuning_outline_sections (
          id,
          title,
          writing_instructions,
          target_audience,
          tone,
          style_preferences,
          section_order,
          fine_tuning_texts (
            id,
            input_text,
            generated_script,
            is_validated,
            quality_score,
            text_order
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    console.log('Found jobs:', jobs?.length || 0)

    // Transform data into JSONL format for fine-tuning
    const trainingData: any[] = []
    
    jobs?.forEach((job: any) => {
      const jobPrompt = job.prompt_used || 'You are a professional script writer.'
      
      job.fine_tuning_outline_sections?.forEach((section: any) => {
        section.fine_tuning_texts?.forEach((text: any) => {
          // Include all texts regardless of validation or quality score
          const trainingExample = {
            messages: [
              {
                role: "system",
                content: jobPrompt
              },
              {
                role: "user", 
                content: `Theme: ${job.theme}\nSection: ${section.title}\nInstructions: ${text.input_text || section.writing_instructions}\n${section.target_audience ? `Target Audience: ${section.target_audience}\n` : ''}${section.tone ? `Tone: ${section.tone}\n` : ''}${section.style_preferences ? `Style: ${section.style_preferences}` : ''}`
              },
              {
                role: "assistant",
                content: text.generated_script
              }
            ]
          }
          
          trainingData.push(trainingExample)
        })
      })
    })

    console.log('Generated training examples:', trainingData.length)

    // Convert to JSONL format (one JSON object per line)
    const jsonlContent = trainingData.map(example => JSON.stringify(example)).join('\n')
    
    // Return as downloadable file
    const headers = new Headers()
    headers.set('Content-Type', 'application/jsonl')
    headers.set('Content-Disposition', 'attachment; filename="fine_tuning_data.jsonl"')
    
    return new Response(jsonlContent, { headers })

  } catch (error) {
    console.error('Unexpected error in export GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/export ===')
  
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

    console.log('Fetching all jobs with sections and texts')
    
    // Fetch all jobs with their sections and texts
    const { data: jobs, error } = await supabase
      .from('fine_tuning_jobs')
      .select(`
        id,
        name,
        theme,
        prompt_used,
        created_at,
        fine_tuning_outline_sections (
          id,
          title,
          writing_instructions,
          target_audience,
          tone,
          style_preferences,
          section_order,
          fine_tuning_texts (
            id,
            input_text,
            generated_script,
            is_validated,
            quality_score,
            text_order,
            character_count,
            word_count
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    console.log('Found jobs:', jobs?.length || 0)

    // Transform data into JSONL format for fine-tuning
    const trainingData: any[] = []
    let totalTexts = 0
    
    jobs?.forEach((job: any) => {
      const jobPrompt = job.prompt_used || 'You are a professional script writer specializing in Crime Dynasty style content.'
      
      job.fine_tuning_outline_sections?.forEach((section: any) => {
        section.fine_tuning_texts?.forEach((text: any) => {
          totalTexts++
          
          const trainingExample = {
            messages: [
              {
                role: "system",
                content: jobPrompt
              },
              {
                role: "user", 
                content: `Theme: ${job.theme}\nSection: ${section.title}\nInstructions: ${text.input_text || section.writing_instructions}\n${section.target_audience ? `Target Audience: ${section.target_audience}\n` : ''}${section.tone ? `Tone: ${section.tone}\n` : ''}${section.style_preferences ? `Style: ${section.style_preferences}` : ''}`
              },
              {
                role: "assistant",
                content: text.generated_script
              }
            ],
            // Metadata for debugging (not used in training)
            metadata: {
              job_id: job.id,
              job_name: job.name,
              section_id: section.id,
              section_title: section.title,
              text_id: text.id,
              quality_score: text.quality_score,
              is_validated: text.is_validated,
              character_count: text.character_count,
              word_count: text.word_count
            }
          }
          
          trainingData.push(trainingExample)
        })
      })
    })

    console.log(`Generated ${totalTexts} training examples`)

    return NextResponse.json({
      success: true,
      totalTexts,
      trainingData,
      summary: {
        totalJobs: jobs?.length || 0,
        totalSections: jobs?.reduce((acc: number, job: any) => acc + (job.fine_tuning_outline_sections?.length || 0), 0) || 0,
        totalTexts
      }
    })

  } catch (error) {
    console.error('Unexpected error in export POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 