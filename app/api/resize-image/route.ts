import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, operation } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    if (!operation || operation !== 'portrait') {
      return NextResponse.json(
        { error: 'Invalid operation. Only "portrait" is supported' },
        { status: 400 }
      )
    }

    // Fetch the image from the URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image from URL' },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()
    
    if (!metadata.width || !metadata.height) {
      return NextResponse.json(
        { error: 'Unable to determine image dimensions' },
        { status: 400 }
      )
    }

    // Calculate portrait dimensions (9:16 aspect ratio)
    const targetAspectRatio = 9 / 16 // width / height for portrait
    const currentAspectRatio = metadata.width / metadata.height

    let cropWidth: number
    let cropHeight: number
    let left = 0
    let top = 0

    if (currentAspectRatio > targetAspectRatio) {
      // Image is too wide, crop horizontally
      cropHeight = metadata.height
      cropWidth = Math.round(cropHeight * targetAspectRatio)
      left = Math.round((metadata.width - cropWidth) / 2)
    } else {
      // Image is too tall, crop vertically
      cropWidth = metadata.width
      cropHeight = Math.round(cropWidth / targetAspectRatio)
      top = Math.round((metadata.height - cropHeight) / 2)
    }

    // Resize and crop the image to portrait
    const resizedImageBuffer = await sharp(imageBuffer)
      .extract({
        left: left,
        top: top,
        width: cropWidth,
        height: cropHeight
      })
      .resize(540, 960) // Standard portrait size
      .jpeg({ quality: 85 })
      .toBuffer()

    // Convert to base64 data URL
    const base64Image = resizedImageBuffer.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64Image}`

    return NextResponse.json({
      success: true,
      resizedImageUrl: dataUrl,
      originalDimensions: {
        width: metadata.width,
        height: metadata.height
      },
      newDimensions: {
        width: 540,
        height: 960
      },
      cropArea: {
        left,
        top,
        width: cropWidth,
        height: cropHeight
      }
    })

  } catch (error) {
    console.error('Error resizing image:', error)
    return NextResponse.json(
      { error: 'Failed to resize image: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 