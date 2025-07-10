import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all voices for the current user
    const { data: voices, error } = await supabase
      .from('ai_voices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching voices:', error)
      return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
    }

    return NextResponse.json({ voices })

  } catch (error) {
    console.error('Unexpected error in voices GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { voice_id, name, provider } = await request.json()

    if (!voice_id || !name || !provider) {
      return NextResponse.json(
        { error: 'voice_id, name, and provider are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['elevenlabs', 'voicemaker', 'fishaudio']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be one of: elevenlabs, voicemaker, fishaudio' },
        { status: 400 }
      )
    }

    // Create new voice
    const { data: voice, error } = await supabase
      .from('ai_voices')
      .insert({
        voice_id,
        name,
        provider
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating voice:', error)
      return NextResponse.json({ error: 'Failed to create voice' }, { status: 500 })
    }

    return NextResponse.json({ voice })

  } catch (error) {
    console.error('Unexpected error in voices POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, voice_id, name, provider } = await request.json()

    if (!id || !voice_id || !name || !provider) {
      return NextResponse.json(
        { error: 'id, voice_id, name, and provider are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['elevenlabs', 'voicemaker', 'fishaudio']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be one of: elevenlabs, voicemaker, fishaudio' },
        { status: 400 }
      )
    }

    // Update voice (only if it belongs to the current user)
    const { data: voice, error } = await supabase
      .from('ai_voices')
      .update({
        voice_id,
        name,
        provider
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating voice:', error)
      return NextResponse.json({ error: 'Failed to update voice' }, { status: 500 })
    }

    if (!voice) {
      return NextResponse.json({ error: 'Voice not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ voice })

  } catch (error) {
    console.error('Unexpected error in voices PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    // Delete voice (only if it belongs to the current user)
    const { error } = await supabase
      .from('ai_voices')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error deleting voice:', error)
      return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in voices DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 