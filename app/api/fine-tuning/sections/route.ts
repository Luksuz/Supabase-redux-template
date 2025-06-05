import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/sections ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created:', !!supabase)
    
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

    const { job_id, sections } = requestBody

    if (!job_id || !sections || !Array.isArray(sections)) {
      console.log('Validation failed:', { job_id: !!job_id, sections: Array.isArray(sections), sectionsLength: sections?.length })
      return NextResponse.json(
        { error: 'Job ID and sections array are required' },
        { status: 400 }
      )
    }

    console.log('Verifying job ownership for job:', job_id)
    // Verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('id')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single()

    console.log('Job verification result:', { job: !!job, jobError })

    if (jobError || !job) {
      console.log('Job not found or unauthorized:', jobError)
      return NextResponse.json({ error: 'Job not found or unauthorized' }, { status: 403 })
    }

    // Insert sections
    const sectionsToInsert = sections.map((section: any, index: number) => ({
      job_id,
      title: section.title,
      writing_instructions: section.writingInstructions || section.writing_instructions,
      target_audience: section.target_audience,
      tone: section.tone,
      style_preferences: section.style_preferences,
      section_order: index,
      is_completed: false,
      training_examples_count: 0
    }))

    console.log('Inserting sections:', sectionsToInsert.length)
    console.log('First section data:', sectionsToInsert[0])

    const { data: insertedSections, error } = await supabase
      .from('fine_tuning_outline_sections')
      .insert(sectionsToInsert)
      .select()

    if (error) {
      console.error('Database error creating sections:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to create sections' }, { status: 500 })
    }

    console.log('Sections created successfully:', insertedSections?.length)

    // Update job section count
    console.log('Updating job section count...')
    const { error: updateError } = await supabase
      .from('fine_tuning_jobs')
      .update({ 
        total_sections: insertedSections.length
      })
      .eq('id', job_id)

    if (updateError) {
      console.error('Error updating job section count:', updateError)
    }

    console.log('Returning sections')
    return NextResponse.json({ sections: insertedSections })

  } catch (error) {
    console.error('Unexpected error in sections POST:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  console.log('=== PATCH /api/fine-tuning/sections ===')
  
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

    const { section_id, updates } = requestBody

    if (!section_id || !updates) {
      console.log('Validation failed:', { section_id: !!section_id, updates: !!updates })
      return NextResponse.json(
        { error: 'Section ID and updates are required' },
        { status: 400 }
      )
    }

    console.log('Verifying section ownership for section:', section_id)
    // Verify section ownership through job
    const { data: section, error: sectionError } = await supabase
      .from('fine_tuning_outline_sections')
      .select(`
        id,
        fine_tuning_jobs!inner (
          user_id
        )
      `)
      .eq('id', section_id)
      .single()

    console.log('Section verification result:', { section: !!section, sectionError })

    if (sectionError || !section || (section.fine_tuning_jobs as any).user_id !== user.id) {
      console.log('Section not found or unauthorized:', sectionError)
      return NextResponse.json({ error: 'Section not found or unauthorized' }, { status: 403 })
    }

    console.log('Updating section with:', updates)
    
    // Validate rating fields if provided
    if ('quality_score' in updates && (updates.quality_score < 0 || updates.quality_score > 10)) {
      console.log('Invalid quality score:', updates.quality_score)
      return NextResponse.json({ error: 'Quality score must be between 0 and 10' }, { status: 400 })
    }
    
    const { data: updatedSection, error } = await supabase
      .from('fine_tuning_outline_sections')
      .update(updates)
      .eq('id', section_id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating section:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
    }

    console.log('Section updated successfully:', updatedSection)
    return NextResponse.json({ section: updatedSection })

  } catch (error) {
    console.error('Unexpected error in sections PATCH:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 