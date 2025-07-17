import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ResearchCard {
  id: string
  user_id: string
  title: string
  query: string
  type: 'google' | 'youtube' | 'firecrawl' | 'custom' | 'perplexity' | 'research'
  content: Record<string, any>
  tags?: string[]
  category?: string | null
  applied_to_script: boolean
  applied_at?: string | null
  created_at: string
  updated_at: string
  source: string
  source_metadata?: Record<string, any>
  url?: string | null
  scraped_content?: string | null
  research_method?: string | null
  confidence_score?: number | null
  word_count?: number | null
}

// GET - Fetch all research cards for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please sign in' 
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'google' or 'youtube' or null for all
    const unapplied = searchParams.get('unapplied') === 'true'

    // Build query
    let query = supabase
      .from('research_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Add type filter if specified
    if (type && ['google', 'youtube'].includes(type)) {
      query = query.eq('type', type)
    }

    // Add unapplied filter if specified
    if (unapplied) {
      query = query.eq('applied_to_script', false)
    }

    const { data: researchCards, error } = await query

    if (error) {
      console.error('Error fetching research cards:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch research cards'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: researchCards || [],
      count: (researchCards || []).length
    })

  } catch (error) {
    console.error('Error fetching research cards:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch research cards'
    }, { status: 500 })
  }
}

// POST - Create a new research card
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please sign in' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { 
      title, 
      query, 
      type, 
      content, 
      tags, 
      category, 
      source = 'custom', 
      source_metadata = {},
      url,
      scraped_content,
      research_method,
      confidence_score,
      word_count
    } = body

    // More flexible validation - only type and content are truly required
    if (!type || !content) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: type, content'
      }, { status: 400 })
    }

    // Generate defaults for missing required DB fields
    const finalTitle = title || query || 'Research Item'
    const finalQuery = query || title || 'No query available'

    const validTypes = ['google', 'youtube', 'firecrawl', 'custom', 'perplexity', 'research']
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `Type must be one of: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    // Calculate word count if content is provided
    const calculatedWordCount = word_count || (
      typeof content === 'object' && content.originalData?.scrapedContent 
        ? content.originalData.scrapedContent.split(/\s+/).length 
        : null
    )

    // Insert into database with new flexible fields
    const insertData = {
          user_id: user.id,
      title: finalTitle,
      query: finalQuery,
          type,
          content,
          tags: tags || [],
          category: category || null,
          source,
          source_metadata,
      applied_to_script: false,
      ...(url && { url }),
      ...(scraped_content && { scraped_content }),
      ...(research_method && { research_method }),
      ...(confidence_score !== undefined && { confidence_score }),
      ...(calculatedWordCount && { word_count: calculatedWordCount })
    }

    const { data: newCard, error } = await supabase
      .from('research_cards')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Error creating research card:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to create research card'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: newCard
    })

  } catch (error) {
    console.error('Error creating research card:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create research card'
    }, { status: 500 })
  }
}

// PUT - Update an existing research card
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please sign in' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, query, type, content, tags, category, applied_to_script } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: id'
      }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title = title
    if (query !== undefined) updateData.query = query
    if (type !== undefined) updateData.type = type
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = tags
    if (category !== undefined) updateData.category = category
    if (applied_to_script !== undefined) {
      updateData.applied_to_script = applied_to_script
      if (applied_to_script) {
        updateData.applied_at = new Date().toISOString()
      } else {
        updateData.applied_at = null
      }
    }

    // Update in database (with user isolation)
    const { data: updatedCard, error } = await supabase
      .from('research_cards')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own cards
      .select()
      .single()

    if (error) {
      console.error('Error updating research card:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update research card'
      }, { status: 500 })
    }

    if (!updatedCard) {
      return NextResponse.json({
        success: false,
        error: 'Research card not found or access denied'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: updatedCard
    })

  } catch (error) {
    console.error('Error updating research card:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update research card'
    }, { status: 500 })
  }
}

// DELETE - Delete a research card
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please sign in' 
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: id'
      }, { status: 400 })
    }

    // Delete from database (with user isolation)
    const { error } = await supabase
      .from('research_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only delete their own cards

    if (error) {
      console.error('Error deleting research card:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete research card'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Research card deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting research card:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete research card'
    }, { status: 500 })
  }
} 