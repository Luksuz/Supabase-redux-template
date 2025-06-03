import { NextRequest, NextResponse } from "next/server";
import { createModelInstance } from "../../../lib/utils/model-factory";
import mammoth from "mammoth";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const selectedModel = formData.get('selectedModel') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isValidType = fileName.endsWith('.txt') || fileName.endsWith('.docx');
    
    if (!isValidType) {
      return NextResponse.json(
        { error: "Only .txt and .docx files are supported" },
        { status: 400 }
      );
    }

    console.log(`📄 Analyzing script style from: ${file.name}`);

    // Extract text content based on file type
    let textContent: string;
    
    if (fileName.endsWith('.txt')) {
      // Handle TXT files
      textContent = await file.text();
    } else if (fileName.endsWith('.docx')) {
      // Handle DOCX files
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
    } else {
      throw new Error('Unsupported file type');
    }

    // Validate extracted content
    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json(
        { error: "File content is too short or empty. Please upload a script with at least 100 characters." },
        { status: 400 }
      );
    }

    console.log(`📝 Extracted ${textContent.length} characters from ${file.name}`);

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

    console.log(`✅ Style analysis completed for: ${file.name}`);
    console.log(`📊 Generated ${analyzedStyle.length} characters of style guide`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      originalLength: textContent.length,
      analyzedStyle,
      meta: {
        analyzedAt: new Date().toISOString(),
        modelUsed: selectedModel || 'gpt-4o-mini'
      }
    });

  } catch (error) {
    console.error('Style analysis error:', error);
    
    let errorMessage = 'Failed to analyze script style';
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY') || error.message.includes('ANTHROPIC_API_KEY')) {
        errorMessage = 'AI model API key not configured. Please contact administrator.';
      } else if (error.message.includes('mammoth')) {
        errorMessage = 'Failed to parse DOCX file. Please ensure the file is not corrupted.';
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