import { NextRequest, NextResponse } from "next/server";
import { createModelInstance } from "../../../lib/utils/model-factory";
import mammoth from "mammoth";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    let textContent: string;
    let fileName: string;
    let selectedModel: string;

    // Handle both form data (file upload) and JSON (text input)
    if (contentType?.includes('multipart/form-data')) {
      // File upload mode
      const formData = await request.formData();
      const file = formData.get('file') as File;
      selectedModel = formData.get('selectedModel') as string;
      
      if (!file) {
        return NextResponse.json(
          { error: "No file uploaded" },
          { status: 400 }
        );
      }

      // Validate file type and size
      const fileNameLower = file.name.toLowerCase();
      const isValidType = fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.docx');
      
      if (!isValidType) {
        return NextResponse.json(
          { error: "Only .txt and .docx files are supported" },
          { status: 400 }
        );
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size too large. Maximum size is 10MB." },
          { status: 400 }
        );
      }

      console.log(`📄 Analyzing script style from file: ${file.name} (${file.size} bytes)`);
      fileName = file.name;

      // Extract text content based on file type
      if (fileNameLower.endsWith('.txt')) {
        try {
          // Handle TXT files
          textContent = await file.text();
        } catch (error) {
          console.error('Error reading TXT file:', error);
          return NextResponse.json(
            { error: "Failed to read TXT file. Please ensure the file is not corrupted and uses UTF-8 encoding." },
            { status: 400 }
          );
        }
      } else if (fileNameLower.endsWith('.docx')) {
        try {
          console.log('📄 Analyzing DOCX file:', file.name);
          // Handle DOCX files with better error handling
          const arrayBuffer = await file.arrayBuffer();
          
          // Basic validation for DOCX file structure
          if (arrayBuffer.byteLength < 100) {
            return NextResponse.json(
              { error: "DOCX file appears to be too small or corrupted. Please upload a valid DOCX file." },
              { status: 400 }
            );
          }
          
          const buffer = Buffer.from(arrayBuffer);
          
          // Check if it's a valid ZIP file (DOCX files are ZIP archives)
          const zipSignature = buffer.subarray(0, 4);
          const isValidZip = zipSignature[0] === 0x50 && zipSignature[1] === 0x4B && 
                            (zipSignature[2] === 0x03 || zipSignature[2] === 0x05 || zipSignature[2] === 0x07);
          console.log('📄 isValidZip:', isValidZip);
          if (!isValidZip) {
            return NextResponse.json(
              { error: "Invalid DOCX file format. The file does not appear to be a valid Microsoft Word document." },
              { status: 400 }
            );
          }
          
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          
          // Check if mammoth found any issues
          if (result.messages && result.messages.length > 0) {
            console.warn('Mammoth parsing warnings:', result.messages);
          }
          
        } catch (error: any) {
          console.error('Error reading DOCX file:', error);
          
          // Provide specific error messages based on the error type
          if (error.message.includes('end of central directory')) {
            return NextResponse.json(
              { error: "DOCX file is corrupted or not a valid Microsoft Word document. Please save the file again and try uploading." },
              { status: 400 }
            );
          } else if (error.message.includes('zip')) {
            return NextResponse.json(
              { error: "DOCX file format is not supported or corrupted. Please ensure you're uploading a valid .docx file created by Microsoft Word." },
              { status: 400 }
            );
          } else {
            return NextResponse.json(
              { error: "Failed to process DOCX file. Please try converting it to TXT format or re-saving as a new DOCX file." },
              { status: 400 }
            );
          }
        }
      } else {
        throw new Error('Unsupported file type');
      }
    } else {
      // Text input mode
      const body = await request.json();
      textContent = body.text;
      selectedModel = body.selectedModel;
      fileName = body.source || 'pasted text';

      if (!textContent) {
        return NextResponse.json(
          { error: "No text provided" },
          { status: 400 }
        );
      }

      console.log(`📝 Analyzing script style from text input (${textContent.length} characters)`);
    }

    // Validate extracted content
    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: "No text content found. Please ensure the content contains readable text." },
        { status: 400 }
      );
    }

    if (textContent.trim().length < 100) {
      return NextResponse.json(
        { error: "Content is too short. Please provide at least 100 characters for meaningful analysis." },
        { status: 400 }
      );
    }

    // Check for extremely long content that might cause issues
    if (textContent.length > 50000) {
      console.warn(`Large content detected: ${textContent.length} characters`);
      // Truncate if too long, but warn the user
      textContent = textContent.substring(0, 50000) + '\n\n[Content truncated due to length limits]';
    }

    console.log(`📝 Processing ${textContent.length} characters from ${fileName}`);

    // Analyze writing style with LLM
    console.log('🤖 Analyzing writing style with AI...');
    
    const model = createModelInstance(selectedModel || 'gpt-4o-mini', 0.7);

    const prompt = `Analyze the following script and extract the writing style, emotion, writing instructions, remarks and a chunk of text that would be enough for anyone to copy and produce a similar script.

SCRIPT TO ANALYZE:
${textContent}

Please provide a comprehensive analysis that includes:
1. Writing style characteristics
2. Emotional tone and approach
3. Specific writing instructions and techniques used
4. Structural patterns and rhetorical devices
5. Sample text chunk that exemplifies the style
6. Any notable remarks about the approach

Format your response as a style guide that could be used to train someone to write in the same manner. Focus on capturing the essence of how this script communicates with its audience.`;

    const response = await model.invoke(prompt);
    const analyzedStyle = response.content as string;

    console.log(`✅ Style analysis completed for: ${fileName}`);
    console.log(`📊 Generated ${analyzedStyle.length} characters of style guide`);

    return NextResponse.json({
      success: true,
      fileName: fileName,
      originalLength: textContent.length,
      analyzedStyle,
      meta: {
        analyzedAt: new Date().toISOString(),
        modelUsed: selectedModel || 'gpt-4o-mini',
        inputType: contentType?.includes('multipart/form-data') ? 'file' : 'text',
        contentLength: textContent.length
      }
    });

  } catch (error) {
    console.error('Style analysis error:', error);
    
    let errorMessage = 'Failed to analyze script style';
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY') || error.message.includes('ANTHROPIC_API_KEY')) {
        errorMessage = 'AI model API key not configured. Please contact administrator.';
      } else if (error.message.includes('mammoth') || error.message.includes('zip') || error.message.includes('central directory')) {
        errorMessage = 'Failed to parse DOCX file. The file may be corrupted or not a valid Microsoft Word document. Please try saving it as a TXT file instead.';
      } else if (error.message.includes('File size') || error.message.includes('too large')) {
        errorMessage = 'File is too large to process. Please upload a smaller file.';
      } else {
        errorMessage = `Analysis failed: ${error.message}`;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 