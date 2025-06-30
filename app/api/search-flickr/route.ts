import { NextRequest, NextResponse } from 'next/server'

const FLICKR_API_KEY = process.env.FLICKR_API_KEY
const FLICKR_API_ENDPOINT = 'https://api.flickr.com/services/rest/'

interface FlickrPhoto {
  id: string
  title: string
  ownername?: string
  url_m?: string
  url_z?: string
  url_l?: string
  owner: string
  dateupload: string
  views?: string
  tags?: string
}

interface FlickrSearchResponse {
  photos: {
    photo: FlickrPhoto[]
    total: string
    page: number
    per_page: number
  }
  stat: string
  message?: string
  code?: number
}

/**
 * Search for photos on Flickr using the flickr.photos.search API
 */
async function searchFlickrPhotos(query: string, options: any = {}): Promise<FlickrSearchResponse> {
  const params = new URLSearchParams({
    method: 'flickr.photos.search',
    api_key: FLICKR_API_KEY || '',
    format: 'json',
    nojsoncallback: '1',
    text: query,
    per_page: options.perPage || '20',
    page: options.page || '1',
    sort: options.sort || 'relevance',
    safe_search: options.safeSearch || '1',
    extras: 'url_m,url_z,url_l,owner_name,date_upload,views,tags', // Get medium, large URLs and metadata
    ...options.additionalParams
  })

  const response = await fetch(`${FLICKR_API_ENDPOINT}?${params}`)
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.stat === 'fail') {
    throw new Error(`Flickr API error: ${data.message} (Code: ${data.code})`)
  }
  
  return data
}

/**
 * Format photo data for display
 */
function formatPhotoData(photo: FlickrPhoto) {
  return {
    id: photo.id,
    title: photo.title || 'Untitled',
    photographer: photo.ownername || 'Unknown',
    url: photo.url_z || photo.url_l || photo.url_m || '',
    thumbnail: photo.url_m || photo.url_z || photo.url_l || '',
    type: 'image',
    source: 'flickr',
    flickr_page: `https://www.flickr.com/photos/${photo.owner}/${photo.id}/`,
    upload_date: photo.dateupload ? new Date(parseInt(photo.dateupload) * 1000).toLocaleDateString() : '',
    views: photo.views || '0',
    tags: photo.tags || ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, type } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (!FLICKR_API_KEY) {
      return NextResponse.json({ 
        error: 'Flickr API key not configured. Please set FLICKR_API_KEY environment variable.' 
      }, { status: 500 })
    }

    // Note: Flickr API only supports image search, not video
    if (type === 'video') {
      return NextResponse.json({ 
        error: 'Flickr only supports image search. Please select "image" as the media type.' 
      }, { status: 400 })
    }

    console.log(`🔍 Searching Flickr for: "${query}"`)

    // Perform the search
    const results = await searchFlickrPhotos(query, {
      perPage: 20,
      sort: 'interestingness-desc', // Most interesting photos first
      safeSearch: '1' // Safe content only
    })

    // Format the results
    const formattedResults = results.photos.photo.map(formatPhotoData).filter(photo => photo.url) // Only include photos with valid URLs

    console.log(`📸 Found ${formattedResults.length} Flickr photos for "${query}"`)

    return NextResponse.json({
      results: formattedResults,
      total: parseInt(results.photos.total),
      page: results.photos.page,
      per_page: results.photos.per_page,
      provider: 'flickr'
    })

  } catch (error: any) {
    console.error('Flickr search error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search Flickr photos',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic' 