import { NextRequest, NextResponse } from 'next/server'

// Use require for mammoth since types are not available
const mammoth = require('mammoth')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.includes('wordprocessingml.document')) {
      return NextResponse.json({ error: 'File must be a DOCX document' }, { status: 400 })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ buffer })
    
    if (!result.value) {
      return NextResponse.json({ error: 'Failed to extract text from DOCX file' }, { status: 500 })
    }

    // Clean up the extracted text
    const cleanedText = result.value
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return NextResponse.json({
      success: true,
      content: cleanedText,
      warnings: result.messages.length > 0 ? result.messages : undefined
    })

  } catch (error) {
    console.error('Error parsing DOCX file:', error)
    return NextResponse.json(
      { error: 'Failed to parse DOCX file: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 