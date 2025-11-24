import { NextRequest, NextResponse } from "next/server";
const mammoth = require("mammoth");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if it's a DOCX file
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Only .docx files are supported' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content found in document' },
        { status: 400 }
      );
    }

    console.log(`✅ Extracted ${text.length} characters from ${file.name}`);

    return NextResponse.json({
      success: true,
      text: text.trim(),
      filename: file.name,
      length: text.length
    });

  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from document: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

