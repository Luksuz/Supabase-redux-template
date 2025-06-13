import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/upload ===')
  
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

    const { trainingData, filename, type } = await request.json()

    if (!trainingData || !Array.isArray(trainingData)) {
      return NextResponse.json({ error: 'Training data is required and must be an array' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        success: false,
        usingMock: true,
        mockResponse: {
          id: `file-mock-${Date.now()}`,
          object: 'file',
          bytes: JSON.stringify(trainingData).length,
          created_at: Math.floor(Date.now() / 1000),
          filename: filename || 'training_data.jsonl',
          purpose: 'fine-tune',
          status: 'uploaded'
        }
      }, { status: 200 })
    }

    console.log(`Uploading ${trainingData.length} training examples to OpenAI`)

    // Convert training data to JSONL format
    const jsonlContent = trainingData.map((example: any) => {
      // Remove metadata if present (not needed for training)
      const { metadata, ...trainingExample } = example
      return JSON.stringify(trainingExample)
    }).join('\n')

    // Create a blob from the JSONL content
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' })
    
    // Create FormData for the OpenAI API
    const formData = new FormData()
    formData.append('purpose', 'fine-tune')
    formData.append('file', blob, filename || 'training_data.jsonl')

    console.log('Uploading to OpenAI Files API...')
    
    // Upload to OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    })

    const openaiData = await openaiResponse.json()

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiData)
      return NextResponse.json({ 
        error: `OpenAI API error: ${openaiData.error?.message || 'Unknown error'}`,
        details: openaiData
      }, { status: openaiResponse.status })
    }

    console.log('Successfully uploaded to OpenAI:', openaiData)

    // Optionally store the file reference in our database
    let uploadRecord = null
    try {
      const { data: upload, error: dbError } = await supabase
        .from('fine_tuning_uploads')
        .insert({
          openai_file_id: openaiData.id,
          filename: openaiData.filename,
          purpose: openaiData.purpose,
          bytes: openaiData.bytes,
          type: type || 'unknown',
          training_examples_count: trainingData.length,
          openai_response: openaiData
        })
        .select()
        .single()

      if (dbError) {
        console.error('Failed to store upload record in database:', dbError)
        // Don't fail the request if we can't store the record
      } else {
        uploadRecord = upload
      }
    } catch (dbError) {
      console.error('Database error storing upload record:', dbError)
      // Don't fail the request if we can't store the record
    }

    return NextResponse.json({
      success: true,
      file: openaiData,
      upload: uploadRecord,
      trainingExamplesCount: trainingData.length,
      message: `Successfully uploaded ${trainingData.length} training examples to OpenAI`
    })

  } catch (error) {
    console.error('Unexpected error in upload POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 