import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/poll-status ===')
  
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

    const { sessionId, openaiJobId } = await request.json()

    if (!sessionId && !openaiJobId) {
      return NextResponse.json({ error: 'Session ID or OpenAI Job ID is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        success: false,
        usingMock: true,
        mockResponse: {
          id: openaiJobId || `ftjob-mock-${Date.now()}`,
          object: 'fine_tuning.job',
          status: 'succeeded',
          fine_tuned_model: `ft:gpt-4o-mini:org:custom:${Date.now()}`
        }
      }, { status: 200 })
    }

    // Get the session from our database
    let session
    if (sessionId) {
      const { data, error } = await supabase
        .from('fine_tuning_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      session = data
    } else {
      const { data, error } = await supabase
        .from('fine_tuning_sessions')
        .select('*')
        .eq('openai_job_id', openaiJobId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      session = data
    }

    console.log(`Polling status for OpenAI job ${session.job_id}`)

    // Poll OpenAI for job status
    const openaiResponse = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${session.openai_job_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    })

    const openaiData = await openaiResponse.json()

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiData)
      return NextResponse.json({ 
        error: `OpenAI API error: ${openaiData.error?.message || 'Unknown error'}`,
        details: openaiData
      }, { status: openaiResponse.status })
    }

    console.log('OpenAI job status:', openaiData)

    // Update our database with the latest status
    const updateData: any = {
      status: openaiData.status,
      updated_at: new Date().toISOString()
    }

    if (openaiData.fine_tuned_model) {
      updateData.fine_tuned_model = openaiData.fine_tuned_model
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('fine_tuning_sessions')
      .update(updateData)
      .eq('id', session.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update session:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update session',
        details: updateError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
      openaiJob: openaiData,
      statusChanged: session.status !== openaiData.status
    })

  } catch (error) {
    console.error('Unexpected error in poll-status POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/poll-status ===')
  
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

    // Get all active sessions for the user
    const { data: sessions, error } = await supabase
      .from('fine_tuning_sessions')
      .select('*')
      .in('status', ['queued', 'running', 'validating'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      count: sessions?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in poll-status GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 