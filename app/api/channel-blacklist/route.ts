import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface BlacklistEntry {
  id?: string
  channel_id?: string
  channel_url?: string
  channel_handle?: string
  channel_name: string
  reason?: string
  notes?: string
}

// Helper function to extract channel info from various YouTube URL formats
function parseChannelInfo(input: string): Partial<BlacklistEntry> {
  const trimmed = input.trim()
  
  // YouTube channel URL patterns
  const urlPatterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/channel\/([^\/\?\s]+)/,
    /https?:\/\/(?:www\.)?youtube\.com\/c\/([^\/\?\s]+)/,
    /https?:\/\/(?:www\.)?youtube\.com\/user\/([^\/\?\s]+)/,
    /https?:\/\/(?:www\.)?youtube\.com\/@([^\/\?\s]+)/,
    /https?:\/\/(?:www\.)?youtube\.com\/([^\/\?\s]+)/
  ]
  
  // Check if it's a URL
  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern)
    if (match) {
      const extracted = match[1]
      
      // Determine the type based on the URL pattern
      if (trimmed.includes('/channel/')) {
        return {
          channel_id: extracted,
          channel_url: trimmed,
          channel_name: extracted
        }
      } else if (trimmed.includes('/@')) {
        return {
          channel_handle: `@${extracted}`,
          channel_url: trimmed,
          channel_name: extracted
        }
      } else {
        return {
          channel_url: trimmed,
          channel_name: extracted
        }
      }
    }
  }
  
  // Check if it's a handle (starts with @)
  if (trimmed.startsWith('@')) {
    return {
      channel_handle: trimmed,
      channel_name: trimmed.substring(1)
    }
  }
  
  // Check if it's a channel ID (starts with UC)
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return {
      channel_id: trimmed,
      channel_name: trimmed
    }
  }
  
  // Default to treating as channel name
  return {
    channel_name: trimmed
  }
}

// GET - Fetch all blacklisted channels for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    // Fetch blacklisted channels for this user
    const { data: blacklist, error } = await supabase
      .from('youtube_channel_blacklist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching channel blacklist:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data: blacklist })
    
  } catch (error) {
    console.error('Unexpected error fetching channel blacklist:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new channel to blacklist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { input, reason, notes } = body
    
    if (!input || !input.trim()) {
      return NextResponse.json({ success: false, error: 'Channel information is required' }, { status: 400 })
    }
    
    // Parse the input to extract channel information
    const channelInfo = parseChannelInfo(input)
    
    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      ...channelInfo,
      reason: reason?.trim() || null,
      notes: notes?.trim() || null
    }
    
    // Insert the new blacklist entry
    const { data, error } = await supabase
      .from('youtube_channel_blacklist')
      .insert([insertData])
      .select()
      .single()
    
    if (error) {
      console.error('Error adding channel to blacklist:', error)
      
      // Check for unique constraint violations
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'This channel is already in your blacklist' }, { status: 409 })
      }
      
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('Unexpected error adding channel to blacklist:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a blacklisted channel
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { id, channel_name, reason, notes } = body
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Entry ID is required' }, { status: 400 })
    }
    
    if (!channel_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Channel name is required' }, { status: 400 })
    }
    
    // Update the blacklist entry
    const { data, error } = await supabase
      .from('youtube_channel_blacklist')
      .update({
        channel_name: channel_name.trim(),
        reason: reason?.trim() || null,
        notes: notes?.trim() || null
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own entries
      .select()
      .single()
    
    if (error) {
      console.error('Error updating blacklist entry:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    if (!data) {
      return NextResponse.json({ success: false, error: 'Entry not found or unauthorized' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('Unexpected error updating blacklist entry:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a channel from blacklist
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Entry ID is required' }, { status: 400 })
    }
    
    // Delete the blacklist entry
    const { error } = await supabase
      .from('youtube_channel_blacklist')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only delete their own entries
    
    if (error) {
      console.error('Error deleting blacklist entry:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Unexpected error deleting blacklist entry:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 