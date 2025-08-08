import { NextRequest, NextResponse } from 'next/server'

// Available providers and their models
const PROVIDERS = {
  replicate: {
    name: 'Replicate',
    models: ['bytedance/seedance-1-lite'],
    endpoint: '/api/image-to-video/providers/replicate'
  },
  fal: {
    name: 'FAL AI',
    models: ['wan-v2.2-5b', 'svd-xt', 'svd-1.1', 'haiper', 'luma-dream-machine'],
    endpoint: '/api/image-to-video/providers/fal'
  }
}

export async function GET() {
  return NextResponse.json({
    providers: PROVIDERS,
    message: 'Available image-to-video providers and models'
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider = 'replicate', ...otherParams } = body

    console.log('🎬 Image-to-video dispatcher request:', { provider, hasOtherParams: Object.keys(otherParams).length > 0 })

    // Validate provider
    if (!PROVIDERS[provider as keyof typeof PROVIDERS]) {
      return NextResponse.json(
        { 
          error: `Invalid provider. Available providers: ${Object.keys(PROVIDERS).join(', ')}`,
          providers: PROVIDERS
        },
        { status: 400 }
      )
    }

    const selectedProvider = PROVIDERS[provider as keyof typeof PROVIDERS]

    // Forward request to specific provider
    const providerUrl = `${request.nextUrl.origin}${selectedProvider.endpoint}`
    
    console.log('🔄 Forwarding to provider:', providerUrl)

    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(otherParams)
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Provider request failed')
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Image-to-video dispatcher error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process image-to-video request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

 