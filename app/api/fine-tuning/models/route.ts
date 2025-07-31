import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/models ===')
  
  try {
    // Verify authentication with Supabase
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured')
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    console.log('Fetching models from OpenAI API...')
    
    // Get all models from OpenAI
    const modelsResponse = await openai.models.list()
    console.log(`Found ${modelsResponse.data.length} total models from OpenAI`)

    // Filter for custom models (not owned by "openai")
    const customModels = modelsResponse.data
      .filter(model => model.owned_by == 'pletfree-creations-ltd')
      .sort((a, b) => b.created - a.created) // Sort by creation date, newest first
    
    console.log(`Found ${customModels.length} custom models (not owned by openai)`)
    
    // Transform to a format suitable for UI
    const models = customModels.map(model => ({
      id: model.id,
      name: model.id,
      baseModel: model.id.includes(':') ? model.id.split(':')[1] : 'unknown', // Extract base model from ID
      ownedBy: model.owned_by,
      created: model.created,
      createdAt: new Date(model.created * 1000).toISOString() // Convert Unix timestamp to ISO string
    }))

    console.log('Returning models:', models.map(m => ({ id: m.id, ownedBy: m.ownedBy })))

    return NextResponse.json({
      success: true,
      models,
      count: models.length
    })

  } catch (error: any) {
    console.error('Error fetching models from OpenAI:', error)
    
    // Handle OpenAI API errors specifically
    if (error?.status) {
      return NextResponse.json({ 
        error: `OpenAI API error: ${error.message}`,
        status: error.status 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch models from OpenAI',
      details: error.message 
    }, { status: 500 })
  }
} 