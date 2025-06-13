import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Get single prompt by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`=== GET /api/prompts/${params.id} ===`)
  
  try {
    const { data: prompt, error } = await supabase
      .from('fine_tuning_prompts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching prompt:', error)
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Fetched prompt: ${prompt.title}`)
    return NextResponse.json({
      success: true,
      prompt
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/prompts/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    )
  }
}

// PUT - Update prompt
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`=== PUT /api/prompts/${params.id} ===`)
  
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

    const { data: updatedPrompt, error } = await supabase
      .from('fine_tuning_prompts')
      .update({ 
        title, 
        prompt, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating prompt:', error)
      return NextResponse.json(
        { error: 'Failed to update prompt' },
        { status: 500 }
      )
    }

    console.log(`✅ Updated prompt: ${updatedPrompt.title}`)
    return NextResponse.json({
      success: true,
      prompt: updatedPrompt
    })

  } catch (error) {
    console.error('Unexpected error in PUT /api/prompts/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

// DELETE - Delete prompt
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`=== DELETE /api/prompts/${params.id} ===`)
  
  try {
    const { error } = await supabase
      .from('fine_tuning_prompts')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting prompt:', error)
      return NextResponse.json(
        { error: 'Failed to delete prompt' },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted prompt with ID: ${params.id}`)
    return NextResponse.json({
      success: true,
      message: 'Prompt deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/prompts/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
} 