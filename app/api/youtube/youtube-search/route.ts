import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyBZxCR32V4JAWYUF0dZmh1lNAPqlW1e-Ew'

interface SearchParams {
  searchQuery?: string
  channelUrl?: string
  maxResults?: number
  sortOrder?: string
}

interface CustomSession {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

// Function to refresh access token if needed
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const data = await response.json()
    
    if (response.ok && data.access_token) {
      console.log('Successfully refreshed access token')
      return data.access_token
    } else {
      console.error('Failed to refresh token:', data)
      return null
    }
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

// Function to get valid access token
async function getValidAccessToken(session: CustomSession): Promise<string | null> {
  if (!session.accessToken) {
    console.log('No access token in session')
    return null
  }

  // Check if token is expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = session.expiresAt || 0
  const isExpired = now >= (expiresAt - 300) // 5 minute buffer

  if (isExpired) {
    console.log('Access token is expired, attempting to refresh')
    if (session.refreshToken) {
      const newToken = await refreshAccessToken(session.refreshToken)
      if (newToken) {
        return newToken
      }
    }
    console.log('Failed to refresh token')
    return null
  }

  console.log('Using existing access token')
  return session.accessToken
}

// Extract channel ID from various YouTube URL formats
function extractChannelId(url: string): string | null {
  if (!url) return null
  
  // If it's already a channel ID (starts with UC and is 24 characters)
  if (url.match(/^UC[\w-]{22}$/)) {
    return url
  }
  
  // Remove any trailing slashes and query parameters
  url = url.split('?')[0].replace(/\/$/, '')
  
  // Extract from different URL formats
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      if (pattern.source.includes('channel')) {
        return match[1] // Direct channel ID
      } else {
        return match[1] // Username/handle - will need to resolve
      }
    }
  }
  
  return null
}

// Resolve username/handle to channel ID
async function resolveChannelId(usernameOrHandle: string, urlType: string, accessToken?: string): Promise<string | null> {
  try {
    let url: string
    
    if (urlType === 'handle') {
      // For @handles, we need to search
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(usernameOrHandle)}&type=channel&maxResults=1`
    } else {
      // For usernames and custom URLs, try channels endpoint
      url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(usernameOrHandle)}`
    }
    
    // Use OAuth token if available, otherwise fall back to API key
    if (accessToken) {
      url += `&access_token=${accessToken}`
    } else {
      url += `&key=${API_KEY}`
    }
    
    console.log('Resolving channel ID for:', usernameOrHandle, 'URL:', url)
    
    const response = await fetch(url)
    const data = await response.json()
    
    console.log('Channel resolution response:', data)
    
    if (data.items && data.items.length > 0) {
      const channelId = urlType === 'handle' ? data.items[0].snippet.channelId : data.items[0].id
      console.log('Resolved channel ID:', channelId)
      return channelId
    }
    
    return null
  } catch (error) {
    console.error('Error resolving channel ID:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  console.log('YouTube search API endpoint hit')
  
  try {
    const session = await getServerSession(authOptions) as CustomSession | null
    const { searchQuery, channelUrl, maxResults = 50, sortOrder = 'date' }: SearchParams = await request.json()
    
    console.log('Request params:', { searchQuery, channelUrl, maxResults, sortOrder })
    
    if (!searchQuery && !channelUrl) {
      return NextResponse.json(
        { error: 'Please provide either a search query or a channel URL (or both).' },
        { status: 400 }
      )
    }

    let channelId: string | null = null
    let validAccessToken: string | null = null

    // Get valid access token if session exists
    if (session) {
      validAccessToken = await getValidAccessToken(session)
    }
    
    // If channel URL is provided, resolve it to channel ID
    if (channelUrl) {
      console.log('Processing channel URL:', channelUrl)
      channelId = extractChannelId(channelUrl)
      console.log('Extracted channel ID:', channelId)
      
      if (!channelId) {
        return NextResponse.json(
          { error: 'Could not extract channel ID from the provided URL. Please check the format.' },
          { status: 400 }
        )
      }
      
      // If it's not a direct channel ID, try to resolve it
      if (!channelId.match(/^UC[\w-]{22}$/)) {
        console.log('Need to resolve channel ID for:', channelId)
        const urlType = channelUrl.includes('@') ? 'handle' : 'username'
        const resolvedId = await resolveChannelId(channelId, urlType, validAccessToken || undefined)
        
        if (!resolvedId) {
          return NextResponse.json(
            { error: 'Could not find channel. Please verify the URL is correct.' },
            { status: 404 }
          )
        }
        
        channelId = resolvedId
      }
    }

    // Build search parameters
    const searchParams = new URLSearchParams({
      part: 'snippet,id',
      order: sortOrder,
      maxResults: maxResults.toString(),
      type: 'video'
    })

    // Add search query if provided
    if (searchQuery) {
      searchParams.append('q', searchQuery)
    }

    // Add channel ID if provided
    if (channelId) {
      console.log('Adding channelId to search:', channelId)
      searchParams.append('channelId', channelId)
    }

    // Use OAuth token if available, otherwise fall back to API key
    if (validAccessToken) {
      searchParams.append('access_token', validAccessToken)
      console.log('Using OAuth token for search')
    } else {
      searchParams.append('key', API_KEY)
      console.log('Using API key for search')
    }

    console.log('Final search URL params:', searchParams.toString())

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    const data = await response.json()

    console.log('YouTube API response status:', response.status)
    console.log('YouTube API response data:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'YouTube API error', details: data },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      searchInfo: {
        query: searchQuery,
        channelId,
        maxResults
      },
      authenticated: !!validAccessToken
    })
    
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'YouTube search API is working',
    method: 'GET',
    usage: 'Use POST method to search for videos'
  })
} 