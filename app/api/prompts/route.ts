import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - List all prompts
export async function GET() {
  console.log('=== GET /api/prompts ===')
  
  try {
    const { data: prompts, error } = await supabase
      .from('fine_tuning_prompts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prompts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch prompts' },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${prompts?.length || 0} prompts`)
    return NextResponse.json({
      success: true,
      prompts: prompts || []
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

// POST - Create new prompt
export async function POST(request: NextRequest) {
  console.log('=== POST /api/prompts ===')
  
  try {
    const body = await request.json()
    console.log('Request body:', body)
    
    const { title, prompt } = body

    if (!title || !prompt) {
      console.log('Validation failed:', { title: !!title, prompt: !!prompt })
      return NextResponse.json(
        { error: 'Title and prompt are required' },
        { status: 400 }
      )
    }

    const { data: newPrompt, error } = await supabase
      .from('fine_tuning_prompts')
      .insert([{ title, prompt }])
      .select()
      .single()

    if (error) {
      console.error('Error creating prompt:', error)
      return NextResponse.json(
        { error: 'Failed to create prompt' },
        { status: 500 }
      )
    }

    console.log(`✅ Created new prompt: ${newPrompt.title}`)
    return NextResponse.json({
      success: true,
      prompt: newPrompt
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/prompts:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
} 