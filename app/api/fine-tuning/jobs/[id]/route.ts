import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== PATCH /api/fine-tuning/jobs/[id] ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body:', requestBody)
    
    const { name, description, theme } = requestBody
    const jobId = params.id

    if (!name?.trim() || !theme?.trim()) {
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

    console.log('Updating job:', jobId)
    // Update job
    const { data: job, error } = await supabase
      .from('fine_tuning_jobs')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        theme: theme.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating job:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    if (!job) {
      console.log('Job not found or unauthorized')
      return NextResponse.json({ error: 'Job not found or unauthorized' }, { status: 404 })
    }

    console.log('Job updated successfully:', job)
    return NextResponse.json({ job })

  } catch (error) {
    console.error('Unexpected error in jobs PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== DELETE /api/fine-tuning/jobs/[id] ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    const jobId = params.id

    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Deleting job:', jobId)
    // Delete job (cascade will handle sections and texts)
    const { data: job, error } = await supabase
      .from('fine_tuning_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error deleting job:', error)
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    if (!job) {
      console.log('Job not found or unauthorized')
      return NextResponse.json({ error: 'Job not found or unauthorized' }, { status: 404 })
    }

    console.log('Job deleted successfully:', job)
    return NextResponse.json({ success: true, message: 'Job deleted successfully' })

  } catch (error) {
    console.error('Unexpected error in jobs DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 