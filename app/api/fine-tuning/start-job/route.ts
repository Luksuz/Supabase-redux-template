import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/start-job ===')
  
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

    const { fileId, model, jobId, uploadId } = await request.json()

    if (!fileId || !model) {
      return NextResponse.json({ error: 'File ID and model are required' }, { status: 400 })
    }

    const validModels = ['gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14', 'gpt-4.1-nano-2025-04-14', 'gpt-4o-mini-2024-07-18']
    if (!validModels.includes(model)) {
      return NextResponse.json({ error: 'Invalid model. Must be one of: ' + validModels.join(', ') }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        success: false,
        usingMock: true,
        mockResponse: {
          id: `ftjob-mock-${Date.now()}`,
          object: 'fine_tuning.job',
          model: model,
          created_at: Math.floor(Date.now() / 1000),
          status: 'queued',
          training_file: fileId
        }
      }, { status: 200 })
    }

    console.log(`Starting fine-tuning job with file ${fileId} and model ${model}`)

    // Start fine-tuning job with OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        training_file: fileId,
        model: model,

      })
    })

    const openaiData = await openaiResponse.json()

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiData)
      return NextResponse.json({ 
        error: `OpenAI API error: ${openaiData.error?.message || 'Unknown error'}`,
        details: openaiData
      }, { status: openaiResponse.status })
    }

    console.log('Successfully started fine-tuning job:', openaiData)

    // Store the fine-tuning session in our database
    const { data: session, error: sessionError } = await supabase
      .from('fine_tuning_sessions')
      .insert({
        file_id: fileId,
        model: model,
        status: openaiData.status,
        job_id: openaiData.id
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Failed to store fine-tuning session:', sessionError)
      return NextResponse.json({ 
        error: 'Failed to store fine-tuning session',
        details: sessionError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session: session,
      openaiJob: openaiData,
      message: `Successfully started fine-tuning job ${openaiData.id}`
    })

  } catch (error) {
    console.error('Unexpected error in start-job POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 