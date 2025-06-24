import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt, assistantResponse, model = 'gpt-4o-mini-2024-07-18' } = await request.json()

    if (!systemPrompt || !userPrompt || !assistantResponse) {
      return NextResponse.json({ 
        error: "System prompt, user prompt, and assistant response are required" 
      }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable." },
        { status: 500 }
      )
    }

    console.log('Starting fine-tuning with provided training data...')

    // Create JSONL training data
    const trainingData = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: assistantResponse }
      ]
    }
    
    const jsonlContent = JSON.stringify(trainingData)
    
    console.log('Uploading training data to OpenAI...')
    
    // Upload file to OpenAI
    const formData = new FormData()
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' })
    formData.append('file', blob, 'training_data.jsonl')
    formData.append('purpose', 'fine-tune')
    
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    })
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      console.error('OpenAI file upload error:', error)
      return NextResponse.json({
        error: `Failed to upload training data: ${error.error?.message || 'Unknown error'}`
      }, { status: 500 })
    }
    
    const uploadResult = await uploadResponse.json()
    console.log('Training data uploaded successfully:', uploadResult.id)
    
    // Start fine-tuning job
    console.log('Starting fine-tuning job...')
    
    const fineTuningResponse = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        training_file: uploadResult.id,
        model: model
      })
    })
    
    if (!fineTuningResponse.ok) {
      const error = await fineTuningResponse.json()
      console.error('OpenAI fine-tuning error:', error)
      return NextResponse.json({
        error: `Failed to start fine-tuning: ${error.error?.message || 'Unknown error'}`
      }, { status: 500 })
    }
    
    const fineTuningResult = await fineTuningResponse.json()
    console.log('Fine-tuning job started successfully:', fineTuningResult.id)
    
    return NextResponse.json({
      success: true,
      fileId: uploadResult.id,
      jobId: fineTuningResult.id,
      status: fineTuningResult.status,
      model: model
    })

  } catch (error) {
    console.error('Error starting fine-tuning:', error)
    return NextResponse.json(
      { error: 'Failed to start fine-tuning: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 