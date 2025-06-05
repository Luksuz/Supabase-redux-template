import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/texts ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body:', requestBody)
    
    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      outline_section_id, 
      input_text, 
      generated_script, 
      text_order = 0 
    } = requestBody

    if (!outline_section_id || !input_text || !generated_script) {
      console.log('Validation failed:', { 
        outline_section_id: !!outline_section_id, 
        input_text: !!input_text, 
        generated_script: !!generated_script 
      })
      return NextResponse.json(
        { error: 'Section ID, input text, and generated script are required' },
        { status: 400 }
      )
    }

    console.log('Verifying section ownership for section:', outline_section_id)
    // Verify section ownership through job
    const { data: section, error: sectionError } = await supabase
      .from('fine_tuning_outline_sections')
      .select(`
        id,
        fine_tuning_jobs!inner (
          user_id
        )
      `)
      .eq('id', outline_section_id)
      .single()

    console.log('Section verification result:', { section: !!section, sectionError })

    if (sectionError || !section || (section.fine_tuning_jobs as any).user_id !== user.id) {
      console.log('Section not found or unauthorized:', sectionError)
      return NextResponse.json({ error: 'Section not found or unauthorized' }, { status: 403 })
    }

    console.log('Inserting text with order:', text_order)
    // Insert text
    const { data: insertedText, error } = await supabase
      .from('fine_tuning_texts')
      .insert({
        outline_section_id,
        input_text,
        generated_script,
        text_order,
        is_validated: false
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating text:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to create text' }, { status: 500 })
    }

    console.log('Text created successfully:', insertedText?.id)

    // Update section training examples count
    console.log('Updating section training examples count...')
    const { data: allTexts } = await supabase
      .from('fine_tuning_texts')
      .select('id')
      .eq('outline_section_id', outline_section_id)

    console.log('Found texts for section:', allTexts?.length || 0)

    if (allTexts) {
      const { error: updateError } = await supabase
        .from('fine_tuning_outline_sections')
        .update({ training_examples_count: allTexts.length })
        .eq('id', outline_section_id)

      if (updateError) {
        console.error('Error updating training examples count:', updateError)
      }
    }

    console.log('Returning created text')
    return NextResponse.json({ text: insertedText })

  } catch (error) {
    console.error('Unexpected error in texts POST:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  console.log('=== PATCH /api/fine-tuning/texts ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    console.log('Parsing request body...')
    const requestBody = await request.json()
    console.log('Request body:', requestBody)
    
    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      text_id, 
      quality_score, 
      is_validated, 
      validation_notes 
    } = requestBody

    if (!text_id || quality_score === undefined || is_validated === undefined) {
      console.log('Validation failed:', { 
        text_id: !!text_id, 
        quality_score: quality_score !== undefined, 
        is_validated: is_validated !== undefined 
      })
      return NextResponse.json(
        { error: 'Text ID, quality score, and validation status are required' },
        { status: 400 }
      )
    }

    console.log('Verifying text ownership for text:', text_id)
    // Verify text ownership through section and job
    const { data: text, error: textError } = await supabase
      .from('fine_tuning_texts')
      .select(`
        id,
        fine_tuning_outline_sections!inner (
          id,
          fine_tuning_jobs!inner (
            user_id
          )
        )
      `)
      .eq('id', text_id)
      .single()

    console.log('Text verification result:', { text: !!text, textError })

    if (textError || !text || ((text.fine_tuning_outline_sections as any).fine_tuning_jobs as any).user_id !== user.id) {
      console.log('Text not found or unauthorized:', textError)
      return NextResponse.json({ error: 'Text not found or unauthorized' }, { status: 403 })
    }

    console.log('Updating text rating:', { quality_score, is_validated, validation_notes })
    // Update text rating
    const { data: updatedText, error } = await supabase
      .from('fine_tuning_texts')
      .update({
        quality_score,
        is_validated,
        validation_notes
      })
      .eq('id', text_id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating text rating:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to update text rating' }, { status: 500 })
    }

    console.log('Text rating updated successfully:', updatedText?.id)
    return NextResponse.json({ text: updatedText })

  } catch (error) {
    console.error('Unexpected error in texts PATCH:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 