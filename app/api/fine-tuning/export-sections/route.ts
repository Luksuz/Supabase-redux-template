import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/export-sections ===')
  
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

    console.log('Fetching jobs with sections for user:', user.id)
    
    // Fetch all jobs with their sections (no need for texts here)
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
          section_order
        )
      `)
      .eq('user_id', user.id)
      .not('prompt_used', 'is', null) // Only jobs that have a prompt_used
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    console.log('Found jobs:', jobs?.length || 0)

    // Transform data into JSONL format for section generation fine-tuning
    const trainingData: any[] = []
    
    jobs?.forEach((job: any) => {
      // Only include jobs that have sections and a prompt
      if (job.fine_tuning_outline_sections && job.fine_tuning_outline_sections.length > 0 && job.prompt_used) {
        // Get the first section's metadata for context (target_audience, tone, style_preferences)
        const firstSection = job.fine_tuning_outline_sections[0] || {}
        
        // Create the sections array as it would be generated
        const sectionsOutput = job.fine_tuning_outline_sections
          .sort((a: any, b: any) => a.section_order - b.section_order)
          .map((section: any) => ({
            title: section.title,
            writingInstructions: section.writing_instructions
          }))

        const trainingExample = {
          messages: [
            {
              role: "system",
              content: job.prompt_used
            },
            {
              role: "user", 
              content: `Theme: ${job.theme}\n${firstSection.target_audience ? `Target Audience: ${firstSection.target_audience}\n` : ''}${firstSection.tone ? `Tone: ${firstSection.tone}\n` : ''}${firstSection.style_preferences ? `Style: ${firstSection.style_preferences}\n` : ''}Generate script sections for this theme.`
            },
            {
              role: "assistant",
              content: JSON.stringify({ sections: sectionsOutput }, null, 2)
            }
          ]
        }
        
        trainingData.push(trainingExample)
      }
    })

    console.log('Generated section training examples:', trainingData.length)

    // Convert to JSONL format (one JSON object per line)
    const jsonlContent = trainingData.map(example => JSON.stringify(example)).join('\n')
    
    // Return as downloadable file
    const headers = new Headers()
    headers.set('Content-Type', 'application/jsonl')
    headers.set('Content-Disposition', 'attachment; filename="section_generation_training.jsonl"')
    
    return new Response(jsonlContent, { headers })

  } catch (error) {
    console.error('Unexpected error in export-sections GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/export-sections ===')
  
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

    const { minSections = 3 } = await request.json()

    console.log('Fetching jobs with filters:', { minSections })
    
    // Fetch all jobs with their sections
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
          section_order
        )
      `)
      .eq('user_id', user.id)
    //   .not('prompt_used', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    console.log('Found jobs:', jobs?.length || 0)

    // Transform data into JSONL format for section generation fine-tuning with filtering
    const trainingData: any[] = []
    let totalJobs = 0
    let filteredJobs = 0
    
    jobs?.forEach((job: any) => {
      totalJobs++
      
      // Apply filters - only include jobs with enough sections and a prompt
      const hasEnoughSections = job.fine_tuning_outline_sections && job.fine_tuning_outline_sections.length >= minSections
      const hasPrompt = job.prompt_used
      
      if (hasEnoughSections && hasPrompt) {
        filteredJobs++
        
        // Get the first section's metadata for context (target_audience, tone, style_preferences)
        const firstSection = job.fine_tuning_outline_sections[0] || {}
        
        // Create the sections array as it would be generated
        const sectionsOutput = job.fine_tuning_outline_sections
          .sort((a: any, b: any) => a.section_order - b.section_order)
          .map((section: any) => ({
            title: section.title,
            writingInstructions: section.writing_instructions
          }))

        const trainingExample = {
          messages: [
            {
              role: "system",
              content: job.prompt_used
            },
            {
              role: "user", 
              content: `Theme: ${job.theme}\n${firstSection.target_audience ? `Target Audience: ${firstSection.target_audience}\n` : ''}${firstSection.tone ? `Tone: ${firstSection.tone}\n` : ''}${firstSection.style_preferences ? `Style: ${firstSection.style_preferences}\n` : ''}Generate script sections for this theme.`
            },
            {
              role: "assistant",
              content: JSON.stringify({ sections: sectionsOutput }, null, 2)
            }
          ],
          // Metadata for debugging (not used in training)
          metadata: {
            job_id: job.id,
            job_name: job.name,
            job_theme: job.theme,
            sections_count: job.fine_tuning_outline_sections.length,
            created_at: job.created_at
          }
        }
        
        trainingData.push(trainingExample)
      }
    })

    console.log(`Generated ${filteredJobs}/${totalJobs} section training examples`)

    return NextResponse.json({
      success: true,
      totalJobs,
      filteredJobs,
      trainingData,
      summary: {
        totalJobs: jobs?.length || 0,
        filteredJobs,
        totalSections: jobs?.reduce((acc: number, job: any) => acc + (job.fine_tuning_outline_sections?.length || 0), 0) || 0,
        filters: { minSections }
      }
    })

  } catch (error) {
    console.error('Unexpected error in export-sections POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 