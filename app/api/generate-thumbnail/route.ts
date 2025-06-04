import { NextResponse } from 'next/server';

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;
const LEONARDO_API_URL = 'https://cloud.leonardo.ai/api/rest/v1';

interface LeonardoGenerationResponse {
  sdGenerationJob: {
    generationId: string;
    apiCreditCost?: number;
  };
}

interface LeonardoImage {
  id: string;
  url: string;
  nsfw: boolean;
  likeCount: number;
  motionMP4URL?: string | null;
  prompt_id?: string;
}

interface LeonardoGenerationStatus {
  generations_by_pk: {
    generated_images: LeonardoImage[];
    modelId: string;
    prompt: string;
    status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'CONTENT_FILTERED';
    id?: string;
  } | null;
}

async function pollForGenerationCompletion(generationId: string): Promise<LeonardoGenerationStatus> {
  let attempts = 0;
  const maxAttempts = 20; // Poll for up to 100 seconds (20 * 5s)
  const pollInterval = 5000; // 5 seconds

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${LEONARDO_API_URL}/generations/${generationId}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${LEONARDO_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Leonardo API error while polling:', errorData);
        throw new Error(`Leonardo API error while polling: ${response.statusText}`);
      }

      const data: LeonardoGenerationStatus = await response.json();

      if (data.generations_by_pk && (data.generations_by_pk.status === 'COMPLETE' || data.generations_by_pk.status === 'FAILED' || data.generations_by_pk.status === 'CONTENT_FILTERED')) {
        return data;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error('Polling error:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      if (attempts >= maxAttempts) throw error;
    }
  }
  throw new Error('Image generation timed out or polling failed.');
}

export async function POST(request: Request) {
  if (!LEONARDO_API_KEY) {
    return NextResponse.json({ error: 'Leonardo API key not configured' }, { status: 500 });
  }

  try {
    const { prompt, referenceImageId, guidanceStrength = 0.5 } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required and must be a string' }, { status: 400 });
    }

    // Generate Image with Leonardo.ai
    const generationPayload: any = {
      modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
      prompt: prompt,
      num_images: 1,
      width: 1280,
      height: 720,
      alchemy: true,
      styleUUID: "111dc692-d470-4eec-b791-3475abac4c46",
      enhancePrompt: false,
    };

    // Add reference image parameters if available
    if (referenceImageId) {
      generationPayload.init_generation_image_id = referenceImageId;
      generationPayload.init_strength = Math.max(0.1, Math.min(0.9, guidanceStrength)); // Clamp between 0.1 and 0.9
      console.log(`🎨 Using reference image ID ${referenceImageId} with strength: ${generationPayload.init_strength}`);
    }

    console.log('🚀 Starting thumbnail generation with payload:', {
      ...generationPayload,
      prompt: prompt.substring(0, 50) + '...'
    });

    const generationResponse = await fetch(`${LEONARDO_API_URL}/generations`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${LEONARDO_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(generationPayload),
    });

    if (!generationResponse.ok) {
      const errorData = await generationResponse.json();
      console.error('Leonardo API error (generation):', errorData);
      return NextResponse.json({ error: 'Failed to start image generation', details: errorData }, { status: 500 });
    }

    const generationResult: LeonardoGenerationResponse = await generationResponse.json();
    const generationId = generationResult.sdGenerationJob?.generationId;

    if (!generationId) {
      return NextResponse.json({ error: 'Failed to get generation ID from Leonardo.ai' }, { status: 500 });
    }

    console.log('⏳ Polling for completion of generation:', generationId);

    // Poll for generation completion
    const finalStatus = await pollForGenerationCompletion(generationId);

    if (!finalStatus.generations_by_pk || finalStatus.generations_by_pk.status !== 'COMPLETE') {
      let errorDetail = 'Image generation did not complete successfully.';
      if (finalStatus.generations_by_pk?.status === 'FAILED') errorDetail = 'Image generation failed on Leonardo.ai.';
      if (finalStatus.generations_by_pk?.status === 'CONTENT_FILTERED') errorDetail = 'Image generation was filtered by Leonardo.ai due to content policy.';
      return NextResponse.json({ error: errorDetail, details: finalStatus.generations_by_pk }, { status: 500 });
    }

    const generatedImages = finalStatus.generations_by_pk.generated_images;
    if (!generatedImages || generatedImages.length === 0 || !generatedImages[0].url) {
      return NextResponse.json({ error: 'No image URL found in Leonardo.ai response' }, { status: 500 });
    }

    const imageUrl = generatedImages[0].url;
    const imageId = generatedImages[0].id; // This ID can be used for future reference
    console.log('✅ Thumbnail generated successfully:', imageUrl);

    // Return the Leonardo.ai image URL and ID for future reference
    return NextResponse.json({ 
      thumbnailUrl: imageUrl,
      imageId: imageId,
      usedReferenceImage: !!referenceImageId,
      guidanceStrength: referenceImageId ? generationPayload.init_strength : null
    });

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal server error in thumbnail generation', details: errorMessage }, { status: 500 });
  }
} 