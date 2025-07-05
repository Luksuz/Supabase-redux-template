import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('User auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 })
    }

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Try to create service role client for admin operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )
    
    const { data: authUsers, error: authError } = await supabaseService.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users: ' + authError.message }, { status: 500 })
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
    }

    // Check for API keys (without exposing the actual keys)
    const { data: apiKeys, error: apiKeysError } = await supabase
      .from('user_api_keys')
      .select('user_id')

    if (apiKeysError) {
      console.error('Error checking API keys:', apiKeysError)
    }

    // Fetch video records for all users
    const { data: videoRecords, error: videoError } = await supabase
      .from('video_records')
      .select('user_id, status, created_at, final_video_url, thumbnail_url, id')
      .order('created_at', { ascending: false })

    if (videoError) {
      console.error('Error fetching video records:', videoError)
    }

    // Combine data
    const usersWithProfiles = authUsers.users.map((authUser: any) => {
      const userProfile = profiles?.find(p => p.user_id === authUser.id)
      const hasApiKey = apiKeys?.some(key => key.user_id === authUser.id) || false
      const userVideos = videoRecords?.filter(video => video.user_id === authUser.id) || []
      
      return {
        id: authUser.id,
        email: authUser.email || 'No email',
        created_at: authUser.created_at,
        is_admin: userProfile?.is_admin || false,
        last_sign_in_at: authUser.last_sign_in_at || null,
        has_api_key: hasApiKey,
        videos: userVideos,
        video_count: userVideos.length,
        completed_videos: userVideos.filter(v => v.status === 'completed').length
      }
    })

    return NextResponse.json({ users: usersWithProfiles })

  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, isAdmin } = await request.json()
    
    console.log('PATCH request received:', { userId, isAdmin })
    
    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('User auth error in PATCH:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Current user:', user.email, 'Target user:', userId)

    // Check if current user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile check error:', profileError)
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 })
    }

    if (!profile?.is_admin) {
      console.error('User is not admin:', user.email)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Prevent self-modification
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot modify your own admin status' }, { status: 400 })
    }

    console.log('Updating admin status for user:', userId, 'to:', isAdmin)

    // Update user admin status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_admin: isAdmin 
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating admin status:', updateError)
      return NextResponse.json({ error: 'Failed to update admin status: ' + updateError.message }, { status: 500 })
    }

    console.log('Successfully updated admin status')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Admin status update error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userIdToDelete = url.searchParams.get('userId')
    
    if (!userIdToDelete) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('User auth error in DELETE:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile check error:', profileError)
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 })
    }

    if (!profile?.is_admin) {
      console.error('User is not admin:', user.email)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Prevent self-deletion
    if (userIdToDelete === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Use service role client for admin operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    console.log('Deleting user and related data for:', userIdToDelete)

    // Start a transaction by deleting related data first
    const deletionPromises = [
      // Delete user's profiles
      supabase.from('profiles').delete().eq('user_id', userIdToDelete),
      // Delete user's API keys
      supabase.from('user_api_keys').delete().eq('user_id', userIdToDelete),
      // Delete user's video records
      supabase.from('video_records').delete().eq('user_id', userIdToDelete),
    ]

    // Execute all deletions
    const deletionResults = await Promise.allSettled(deletionPromises)
    
    // Log results but don't fail if some cleanup operations fail
    deletionResults.forEach((result, index) => {
      const tables = ['profiles', 'user_api_keys', 'video_records']
      if (result.status === 'rejected') {
        console.warn(`Failed to delete from ${tables[index]}:`, result.reason)
      } else {
        console.log(`Successfully cleaned up ${tables[index]} for user ${userIdToDelete}`)
      }
    })

    // Finally, delete the user from auth
    const { error: deleteAuthError } = await supabaseService.auth.admin.deleteUser(userIdToDelete)

    if (deleteAuthError) {
      console.error('Error deleting user from auth:', deleteAuthError)
      return NextResponse.json({ 
        error: 'Failed to delete user from authentication: ' + deleteAuthError.message 
      }, { status: 500 })
    }

    console.log('Successfully deleted user:', userIdToDelete)
    return NextResponse.json({ 
      success: true, 
      message: 'User and all related data deleted successfully' 
    })

  } catch (error) {
    console.error('User deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 