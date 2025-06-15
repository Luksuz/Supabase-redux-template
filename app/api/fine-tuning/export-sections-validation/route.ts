import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSectionDataSplit } from '@/lib/utils/section-data-splitter'

export async function GET(request: NextRequest) {
  console.log('=== GET /api/fine-tuning/export-sections-validation ===')
  
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

    console.log('Getting section data split for user:', user.id)
    
    try {
      const { validationData } = await getSectionDataSplit(user.id, 3)

      if (validationData.length === 0) {
        console.log('No validation data found')
        return NextResponse.json({ error: 'Not enough data for validation split' }, { status: 400 })
      }

      console.log(`Returning ${validationData.length} validation examples`)

      // Convert to JSONL format (one JSON object per line)
      const jsonlContent = validationData.map(example => JSON.stringify(example)).join('\n')
      
      // Return as downloadable file
      const headers = new Headers()
      headers.set('Content-Type', 'application/jsonl')
      headers.set('Content-Disposition', 'attachment; filename="section_generation_validation.jsonl"')
      
      return new Response(jsonlContent, { headers })
    } catch (splitError) {
      console.error('Error getting section data split:', splitError)
      return NextResponse.json({ error: 'Failed to process validation data' }, { status: 500 })
    }

  } catch (error) {
    console.error('Unexpected error in export-sections-validation GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/fine-tuning/export-sections-validation ===')
  
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

    const { minSections = 3 } = await request.json()

    console.log('Getting section data split with filters:', { minSections })
    
    try {
      const { validationData, summary } = await getSectionDataSplit(user.id, minSections)

      if (validationData.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No validation data available',
          summary
        })
      }

      console.log(`Generated section validation examples: ${summary.validationExamples}/${summary.totalExamples}`)

      return NextResponse.json({
        success: true,
        totalJobs: summary.totalJobs,
        filteredJobs: summary.filteredJobs,
        validationData,
        summary
      })
    } catch (splitError) {
      console.error('Error getting section data split:', splitError)
      return NextResponse.json({ 
        success: false,
        error: 'Failed to process validation data',
        summary: { totalJobs: 0, filteredJobs: 0, trainingExamples: 0, validationExamples: 0 }
      })
    }

  } catch (error) {
    console.error('Unexpected error in export-sections-validation POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 