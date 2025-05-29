import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import sharp from 'sharp'

// Helper function to check if file is an image
function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

// Helper function to check if file should be skipped
function shouldSkipFile(filename: string): boolean {
  // Skip macOS metadata files
  if (filename.includes('__MACOSX/') || filename.includes('/._')) {
    return true
  }
  
  // Skip files that start with ._ (macOS resource forks)
  const basename = filename.split('/').pop() || ''
  if (basename.startsWith('._')) {
    return true
  }
  
  // Skip hidden files
  if (basename.startsWith('.')) {
    return true
  }
  
  return false
}

// Helper function to resize image to 1280x720 maintaining aspect ratio
async function resizeImageTo16x9(imageBuffer: Buffer): Promise<Buffer> {
  const targetWidth = 1280
  const targetHeight = 720

  try {
    // First, validate that this is actually an image
    const metadata = await sharp(imageBuffer).metadata()
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not read image dimensions')
    }

    const originalAspectRatio = metadata.width / metadata.height
    const targetAspectRatio = targetWidth / targetHeight

    let resizeWidth: number
    let resizeHeight: number

    if (originalAspectRatio > targetAspectRatio) {
      // Image is wider than 16:9, fit by width
      resizeWidth = targetWidth
      resizeHeight = Math.round(targetWidth / originalAspectRatio)
    } else {
      // Image is taller than 16:9, fit by height
      resizeHeight = targetHeight
      resizeWidth = Math.round(targetHeight * originalAspectRatio)
    }

    // Resize the image maintaining aspect ratio
    const resizedImage = await sharp(imageBuffer)
      .resize(resizeWidth, resizeHeight, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .jpeg({ quality: 90 })
      .toBuffer()

    return resizedImage
  } catch (error) {
    console.error('Error resizing image:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const zipFile = formData.get('zipFile') as File

    if (!zipFile) {
      return NextResponse.json({ error: 'No zip file provided' }, { status: 400 })
    }

    // Read the zip file
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuffer)

    const processedImages: Array<{
      id: string
      name: string
      originalName: string
      dataUrl: string
      processed: boolean
    }> = []

    // Process each file in the zip
    const promises = Object.keys(zip.files).map(async (filename) => {
      const file = zip.files[filename]
      
      // Skip directories, non-image files, and system files
      if (file.dir || !isImageFile(filename) || shouldSkipFile(filename)) {
        return null
      }

      try {
        // Get file content as buffer
        const fileBuffer = await file.async('nodebuffer')
        
        // Validate buffer is not empty
        if (fileBuffer.length === 0) {
          console.warn(`Skipping empty file: ${filename}`)
          return null
        }
        
        // Resize image to fit 1280x720 while maintaining aspect ratio
        const resizedBuffer = await resizeImageTo16x9(fileBuffer)
        
        // Convert to base64 data URL
        const base64 = resizedBuffer.toString('base64')
        const dataUrl = `data:image/jpeg;base64,${base64}`
        
        // Generate unique ID
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Extract just the filename without path
        const name = filename.split('/').pop() || filename
        
        return {
          id,
          name: `${name.split('.')[0]}_processed.jpg`,
          originalName: name,
          dataUrl,
          processed: true
        }
      } catch (error) {
        console.error(`Error processing image ${filename}:`, error)
        return null
      }
    })

    // Wait for all images to be processed
    const results = await Promise.all(promises)
    
    // Filter out null results
    results.forEach(result => {
      if (result) {
        processedImages.push(result)
      }
    })

    return NextResponse.json({
      success: true,
      images: processedImages,
      message: `Processed ${processedImages.length} images`
    })

  } catch (error) {
    console.error('Error processing zip file:', error)
    return NextResponse.json(
      { error: 'Failed to process zip file: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 