import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/models ===')
  
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

    // Get completed sessions with fine-tuned models
    const { data: sessions, error } = await supabase
      .from('fine_tuning_sessions')
      .select('id, fine_tuned_model, model, status, created_at, openai_finished_at')
      .eq('user_id', user.id)
      .eq('status', 'succeeded')
      .not('fine_tuned_model', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching models:', error)
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
    }

    // Transform to a simpler format for model selection
    const models = sessions?.map(session => ({
      id: session.fine_tuned_model,
      name: session.fine_tuned_model,
      baseModel: session.model,
      createdAt: session.created_at,
      finishedAt: session.openai_finished_at
    })) || []

    return NextResponse.json({
      success: true,
      models,
      count: models.length
    })

  } catch (error) {
    console.error('Unexpected error in models GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 