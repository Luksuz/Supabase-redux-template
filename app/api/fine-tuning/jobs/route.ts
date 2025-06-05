import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DatabaseSection {
  fine_tuning_texts: any[]
  [key: string]: any
}

interface DatabaseJob {
  fine_tuning_outline_sections: DatabaseSection[]
  [key: string]: any
}

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/jobs ===')
  
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

    console.log('Fetching jobs for user:', user.id)
    // Fetch jobs with sections and texts
    const { data: jobs, error } = await supabase
      .from('fine_tuning_jobs')
      .select(`
        *,
        fine_tuning_outline_sections (
          *,
          fine_tuning_texts (*)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    console.log('Found jobs:', jobs?.length || 0)

    // Transform data to match frontend structure
    const transformedJobs = (jobs as DatabaseJob[]).map(job => ({
      ...job,
      sections: job.fine_tuning_outline_sections?.map((section: DatabaseSection) => ({
        ...section,
        texts: section.fine_tuning_texts || []
      })) || []
    }))

    console.log('Returning transformed jobs')
    return NextResponse.json({ jobs: transformedJobs })

  } catch (error) {
    console.error('Unexpected error in jobs GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/jobs ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body:', requestBody)
    
    const { name, description, theme } = requestBody

    if (!name || !theme) {
      console.log('Validation failed: missing name or theme')
      return NextResponse.json(
        { error: 'Name and theme are required' },
        { status: 400 }
      )
    }

    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Creating job for user:', user.id)
    console.log('Job data:', { name, description, theme, user_id: user.id })

    // Create new job
    const { data: job, error } = await supabase
      .from('fine_tuning_jobs')
      .insert({
        user_id: user.id,
        name,
        description,
        theme
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating job:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    console.log('Job created successfully:', job)
    return NextResponse.json({ job: { ...job, sections: [] } })

  } catch (error) {
    console.error('Unexpected error in jobs POST:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 