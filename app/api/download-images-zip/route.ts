import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, setName, provider, aspectRatio } = await request.json()

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Image URLs are required' },
        { status: 400 }
      )
    }

    console.log(`📦 Creating ZIP for ${imageUrls.length} images`)

    const zip = new JSZip()
    const folder = zip.folder(setName || 'images')

    // Download each image and add to zip with proper numbering
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      const imageNumber = (i + 1).toString().padStart(3, '0')
      
      try {
        console.log(`⬇️ Downloading image ${imageNumber}/${imageUrls.length}`)
        
        // Handle both base64 data URLs and regular URLs
        if (imageUrl.startsWith('data:image/')) {
          // Base64 data URL
          const base64Data = imageUrl.split(',')[1]
          const imageBuffer = Buffer.from(base64Data, 'base64')
          
          // Determine file extension from data URL
          const mimeType = imageUrl.match(/data:image\/([^;]+)/)?.[1] || 'png'
          const extension = mimeType === 'jpeg' ? 'jpg' : mimeType
          
          folder?.file(`${imageNumber}_${provider}_${aspectRatio}.${extension}`, imageBuffer)
        } else {
          // Regular URL - fetch the image
          const response = await fetch(imageUrl)
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch image ${imageNumber}: ${response.status}`)
            continue
          }
          
          const imageBuffer = await response.arrayBuffer()
          
          // Try to determine file extension from URL or content-type
          let extension = 'png'
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('jpeg')) extension = 'jpg'
          else if (contentType?.includes('webp')) extension = 'webp'
          else if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) extension = 'jpg'
          else if (imageUrl.includes('.webp')) extension = 'webp'
          
          folder?.file(`${imageNumber}_${provider}_${aspectRatio}.${extension}`, imageBuffer)
        }
        
        console.log(`✅ Added image ${imageNumber} to ZIP`)
      } catch (error) {
        console.error(`❌ Error processing image ${imageNumber}:`, error)
        // Continue with other images even if one fails
      }
    }

    // Generate the ZIP file
    console.log(`🗜️ Generating ZIP file`)
    const zipContent = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    console.log(`✅ ZIP created successfully (${zipContent.length} bytes)`)

    // Return the ZIP file
    return new NextResponse(zipContent, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${setName || 'images'}.zip"`,
        'Content-Length': zipContent.length.toString()
      }
    })

  } catch (error: any) {
    console.error('❌ Error creating ZIP:', error)
    return NextResponse.json(
      { error: `Failed to create ZIP: ${error.message}` },
      { status: 500 }
    )
  }
} 