import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { GoogleGenAI } from '@google/genai'

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const googleAI = process.env.GOOGLE_AI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY }) : null

// Supported thumbnail models
type ThumbnailModel = 'gpt-image-1' | 'dalle-3' | 'imagen-4'

// Generate thumbnail using OpenAI models
async function generateOpenAIThumbnail(model: 'gpt-image-1' | 'dalle-3', prompt: string, images: any[]): Promise<string> {
  if (model === 'gpt-image-1') {
    // Use image editing API for GPT Image 1
    const response = await openaiClient.images.edit({
      model: "gpt-image-1",
      image: images[0], // GPT Image 1 only supports single image editing
      prompt: prompt,
      size: "1536x1024"
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI')
    }

    const imageBase64 = response.data[0].b64_json
    if (!imageBase64) {
      throw new Error('No base64 image data returned')
    }

    return imageBase64
  } else if (model === 'dalle-3') {
    // Use DALL-E 3 generation (text-to-image optimized for thumbnails)
    const thumbnailPrompt = `Create a high-quality, eye-catching thumbnail image: ${prompt}. Style: professional, vibrant, suitable for video thumbnail, aspect ratio 16:9.`
    
    const response = await openaiClient.images.generate({
      model: "dall-e-3",
      prompt: thumbnailPrompt,
      size: "1792x1024",
      quality: "standard",
      response_format: "b64_json"
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from DALL-E 3')
    }

    const imageBase64 = response.data[0].b64_json
    if (!imageBase64) {
      throw new Error('No base64 image data returned from DALL-E 3')
    }

    return imageBase64
  }

  throw new Error(`Unsupported OpenAI model: ${model}`)
}

// Generate thumbnail using Google Imagen 4
async function generateImagenThumbnail(prompt: string, referenceCount: number): Promise<string> {
  if (!googleAI) {
    throw new Error('Google GenAI client not initialized - check API key')
  }

  console.log(`🎨 Generating Google Imagen thumbnail`)
  
  // For Imagen, we can't directly use reference images, so we enhance the prompt
  const enhancedPrompt = `Create a high-quality thumbnail image: ${prompt}. Style: professional, eye-catching, suitable for video thumbnail. Aspect ratio: 16:9.`
  
  try {
    const response = await googleAI.models.generateImages({
      model: 'imagen-4.0-generate-preview-06-06',
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
      },
    })

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error('No image generated from Google Imagen')
    }

    const generatedImage = response.generatedImages[0]
    if (!generatedImage.image?.imageBytes) {
      throw new Error('No image data received from Google Imagen')
    }

    return generatedImage.image.imageBytes
  } catch (error) {
    console.error('Google Imagen generation error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const prompt = formData.get('prompt') as string
    const model = (formData.get('model') as ThumbnailModel) || 'gpt-image-1' // Default to GPT Image 1
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Check API keys based on model
    if ((model === 'gpt-image-1' || model === 'dalle-3') && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    if (model === 'imagen-4' && !process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Google AI API key is not configured' },
        { status: 500 }
      )
    }

    // Collect all image files
    const imageFiles: File[] = []
    let index = 0
    
    while (true) {
      const file = formData.get(`image_${index}`) as File
      if (!file) break
      imageFiles.push(file)
      index++
    }

    // Only check for images if model requires them
    if (model === 'gpt-image-1' && imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'GPT Image 1 requires at least one reference image' },
        { status: 400 }
      )
    }

    console.log(`🖼️ Processing ${imageFiles.length} reference images for ${model} thumbnail generation`)
    console.log(`📝 Generating thumbnail with prompt: "${prompt.substring(0, 100)}..."`)

    let imageBase64: string

    if (model === 'imagen-4') {
      // Google Imagen doesn't use reference images
      imageBase64 = await generateImagenThumbnail(prompt, imageFiles.length)
    } else if (model === 'dalle-3') {
      // DALL-E 3 works better with pure text prompts for thumbnails
      imageBase64 = await generateOpenAIThumbnail(model, prompt, [])
    } else {
      // GPT Image 1 requires reference images
      if (imageFiles.length === 0) {
        return NextResponse.json(
          { error: 'GPT Image 1 requires at least one reference image' },
          { status: 400 }
        )
      }

    // Convert files to OpenAI format
    const images = await Promise.all(
      imageFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        return await toFile(buffer, file.name, {
          type: file.type,
        })
      })
    )

      imageBase64 = await generateOpenAIThumbnail(model as 'gpt-image-1', prompt, images)
    }

    console.log(`✅ ${model} thumbnail generated successfully`)

    return NextResponse.json({
      imageBase64: imageBase64,
      prompt: prompt,
      model: model,
      referenceCount: imageFiles.length
    })

  } catch (error) {
    console.error('❌ Thumbnail generation error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate thumbnail',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 