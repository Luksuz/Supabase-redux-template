import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== DELETE /api/fine-tuning/sections/[id] ===')
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created successfully')
    
    const sectionId = params.id

    // Get current user
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user?.id, email: user?.email, userError })
    
    if (userError || !user) {
      console.log('Authentication failed:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Verifying section ownership for section:', sectionId)
    // Verify section ownership through job
    const { data: section, error: sectionError } = await supabase
      .from('fine_tuning_outline_sections')
      .select(`
        id,
        fine_tuning_jobs!inner (
          user_id
        )
      `)
      .eq('id', sectionId)
      .single()

    console.log('Section verification result:', { section: !!section, sectionError })

    if (sectionError || !section || (section.fine_tuning_jobs as any).user_id !== user.id) {
      console.log('Section not found or unauthorized:', sectionError)
      return NextResponse.json({ error: 'Section not found or unauthorized' }, { status: 403 })
    }

    console.log('Deleting section:', sectionId)
    // Delete section (cascade will handle texts)
    const { data: deletedSection, error } = await supabase
      .from('fine_tuning_outline_sections')
      .delete()
      .eq('id', sectionId)
      .select()
      .single()

    if (error) {
      console.error('Database error deleting section:', error)
      return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
    }

    console.log('Section deleted successfully:', deletedSection)
    return NextResponse.json({ success: true, message: 'Section deleted successfully' })

  } catch (error) {
    console.error('Unexpected error in sections DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 