import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, duration = 5, model = 'bytedance/seedance-1-lite' } = body

    console.log('🎬 Replicate Text-to-video request:', { prompt, duration, model })

    // Validate inputs
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      )
    }

    if (![5, 10].includes(duration)) {
      return NextResponse.json(
        { error: 'Duration must be 5 or 10 seconds' },
        { status: 400 }
      )
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      )
    }

    // Prepare input for Replicate
    const input = {
      prompt: prompt.trim(),
      duration: duration
    }

    console.log('🚀 Starting Replicate text-to-video generation...')

    // Start the generation using ByteDance SeeDance Lite
    const output = await replicate.run("bytedance/seedance-1-lite", { input })

    console.log('✅ Replicate generation completed')

    // Handle the output - could be a URL or FileOutput object
    let videoUrl = ''
    if (typeof output === 'string') {
      videoUrl = output
    } else if (output && typeof output === 'object' && 'url' in output) {
      videoUrl = (output as any).url()
    } else if (Array.isArray(output) && output.length > 0) {
      videoUrl = output[0]
    }

    if (!videoUrl) {
      throw new Error('No video URL returned from Replicate')
    }

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
      provider: 'replicate',
      model: 'bytedance/seedance-1-lite',
      message: 'Text-to-video generation completed successfully'
    })

  } catch (error) {
    console.error('❌ Replicate Text-to-video generation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate text-to-video with Replicate',
        provider: 'replicate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}