import { NextRequest, NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

interface SplitScriptRequestBody {
  script: string;
  numberOfScenes: number;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SplitScriptRequestBody;
    const { script, numberOfScenes, userId = "unknown_user" } = body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      return NextResponse.json({ error: 'Script is required' }, { status: 400 });
    }

    if (!numberOfScenes || numberOfScenes < 1 || numberOfScenes > 500) {
      return NextResponse.json({ 
        error: 'Number of scenes must be between 1 and 500' 
      }, { status: 400 });
    }

    console.log(`📄 Splitting script into ${numberOfScenes} chunks for user ${userId}`);

    // Calculate chunk size based on script length and desired number of scenes
    const textLength = script.length;
    const chunkSize = Math.ceil(textLength / numberOfScenes);
    const chunkOverlap = Math.min(Math.floor(chunkSize * 0.1), 200); // 10% overlap, max 200 chars

    console.log(`Text length: ${textLength}, Chunk size: ${chunkSize}, Chunk overlap: ${chunkOverlap}`);

    // Create text splitter with calculated parameters
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    // Split the text into chunks
    const chunks = await splitter.createDocuments([script]);

    // Limit to the requested number of scenes
    const limitedChunks = chunks.slice(0, numberOfScenes);
    
    console.log(`✅ Created ${limitedChunks.length} chunks from script`);

    // Convert to simple array of text chunks
    const textChunks = limitedChunks.map((chunk, index) => ({
      index,
      text: chunk.pageContent
    }));

    return NextResponse.json({
      chunks: textChunks,
      totalChunks: textChunks.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in script splitting:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to split script into chunks' 
    }, { status: 500 });
  }
}
