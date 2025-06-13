import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fal } from "@fal-ai/client";

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;
const LEONARDO_API_URL = 'https://cloud.leonardo.ai/api/rest/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI client
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Configure fal.ai
if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY,
  });
}

type ThumbnailProvider = 'openai' | 'leonardo' | 'leonardo-phoenix' | 'flux-dev' | 'recraft-v3' | 'stable-diffusion-v35-large' | 'minimax';

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

// Helper function for retrying an async operation
async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
  attempt: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt > retries) {
      console.error(`Failed after ${retries} retries. Last error:`, error);
      throw error;
    }
    console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs / 1000}s... Error:`, error);
    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    return retryAsync(fn, retries, delayMs, attempt + 1);
  }
}

// Generate thumbnail using OpenAI DALL-E 3
async function generateOpenAIThumbnail(prompt: string, width: number, height: number): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized - check API key');
  }

  console.log(`🎨 Generating OpenAI DALL-E 3 thumbnail with size: ${width}x${height}`);
  
  // Determine the closest supported size for DALL-E 3
  let dalleSize: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
  const aspectRatio = width / height;
  
  if (aspectRatio > 1.5) {
    dalleSize = '1792x1024'; // Landscape
  } else if (aspectRatio < 0.7) {
    dalleSize = '1024x1792'; // Portrait
  } else {
    dalleSize = '1024x1024'; // Square
  }

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: dalleSize,
    quality: "hd", // Use HD quality for thumbnails
    response_format: "b64_json"
  });

  if (!response.data?.[0]?.b64_json) {
    throw new Error('No image data received from DALL-E 3');
  }

  return `data:image/png;base64,${response.data[0].b64_json}`;
}

// Generate thumbnail using Flux models via fal.ai
async function generateFluxThumbnail(provider: string, prompt: string, width: number, height: number): Promise<string> {
  let modelEndpoint: string;
  
  switch (provider) {
    case 'flux-dev':
      modelEndpoint = 'fal-ai/flux/dev';
      break;
    case 'recraft-v3':
      modelEndpoint = 'fal-ai/recraft-v3';
      break;
    case 'stable-diffusion-v35-large':
      modelEndpoint = 'fal-ai/stable-diffusion-v35-large';
      break;
    default:
      throw new Error(`Unsupported flux model: ${provider}`);
  }

  const result = await fal.subscribe(modelEndpoint, {
    input: {
      prompt,
      image_size: { width, height },
      num_inference_steps: 28,
      guidance_scale: 7.5, // Higher guidance for better thumbnails
      num_images: 1,
      enable_safety_checker: false
    },
  });

  if (result.data?.images?.[0]?.url) {
    return result.data.images[0].url;
  } else if (result.data?.image?.url) {
    return result.data.image.url;
  } else {
    console.error('Unexpected fal.ai response structure:', result);
    throw new Error('No image URL found in fal.ai response');
  }
}

// Generate thumbnail using MiniMax
async function generateMinimaxThumbnail(prompt: string, aspectRatio: string, referenceImage?: string): Promise<string> {
  const minimaxApiUrl = "https://api.minimaxi.chat/v1/image_generation";
  
  const payload: any = {
    model: "image-01",
    prompt: prompt,
    aspect_ratio: aspectRatio,
    response_format: "base64",
    width: 1536,
    height: 1024,
    n: 1,
    prompt_optimizer: true,
  };

  // Add character reference if provided
  if (referenceImage) {
    payload.subject_reference = [{
      type: "character",
      image_file: referenceImage
    }];
  }

  const headers = {
    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(minimaxApiUrl, { 
    method: 'POST', 
    headers: headers, 
    body: JSON.stringify(payload) 
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('MiniMax API error:', response.status, errorData);
    throw new Error(`MiniMax API request failed with status ${response.status}`);
  }
  
  const data = await response.json();

  if (data.data?.image_base64?.[0]) {
    const base64String = data.data.image_base64[0];
    return `data:image/png;base64,${base64String}`;
  }
  
  if (data.base && data.base.status_code !== 0) {
    console.error('MiniMax API returned an error status:', data.base);
    throw new Error(`MiniMax API error: ${data.base?.status_msg || 'Unknown error'}`);
  }
  
  throw new Error('No image data received from MiniMax API');
}

// Generate thumbnail using Leonardo Phoenix
async function generateLeonardoPhoenixThumbnail(prompt: string, width: number, height: number, contrast: number = 3.5, referenceImageId?: string, guidanceStrength?: number): Promise<{ thumbnailUrl: string; imageId: string }> {
  const generationPayload: any = {
    modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", // Leonardo Phoenix 1.0 model
    prompt: prompt,
    contrast: contrast,
    num_images: 1,
    width: width,
    height: height,
    alchemy: true,
    styleUUID: "111dc692-d470-4eec-b791-3475abac4c46", // Dynamic style for thumbnails
    enhancePrompt: false, // Keep original prompt for thumbnails
  };

  // Add reference image parameters if available
  if (referenceImageId) {
    generationPayload.init_generation_image_id = referenceImageId;
    generationPayload.init_strength = Math.max(0.1, Math.min(0.9, guidanceStrength || 0.5));
    console.log(`🎨 Using reference image ID ${referenceImageId} with strength: ${generationPayload.init_strength}`);
  }

  console.log('🚀 Starting Leonardo Phoenix thumbnail generation...');

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
    console.error('Leonardo Phoenix API error (generation):', errorData);
    throw new Error(`Leonardo Phoenix API request failed with status ${generationResponse.status}`);
  }

  const generationResult: LeonardoGenerationResponse = await generationResponse.json();
  const generationId = generationResult.sdGenerationJob?.generationId;

  if (!generationId) {
    throw new Error('Failed to get generation ID from Leonardo Phoenix');
  }

  console.log(`🔄 Polling for Leonardo Phoenix generation completion: ${generationId}`);
  const finalStatus = await pollForGenerationCompletion(generationId);

  let errorDetail = '';
  if (finalStatus.generations_by_pk?.status === 'FAILED') errorDetail = 'Image generation failed on Leonardo Phoenix.';
  if (finalStatus.generations_by_pk?.status === 'CONTENT_FILTERED') errorDetail = 'Image generation was filtered by Leonardo Phoenix due to content policy.';

  const imageUrl = finalStatus.generations_by_pk?.generated_images?.[0]?.url;
  const imageId = finalStatus.generations_by_pk?.generated_images?.[0]?.id;

  if (!imageUrl || !imageId) {
    throw new Error(errorDetail || 'No image URL found in Leonardo Phoenix response');
  }

  console.log('✅ Leonardo Phoenix thumbnail generated successfully');
  return { thumbnailUrl: imageUrl, imageId: imageId };
}

export async function POST(request: Request) {
  try {
    const { 
      prompt, 
      referenceImageId, 
      guidanceStrength = 0.5,
      stylePrefix = "",
      customStylePrefix = "",
      enhancePrompt = true,
      aspectRatio = "16:9",
      provider = "openai" as ThumbnailProvider // OpenAI as preferred default
    } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required and must be a string' }, { status: 400 });
    }

    // Check API keys based on provider
    if (provider === 'openai' && !OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 });
    }

    if (provider === 'leonardo' && !LEONARDO_API_KEY) {
      return NextResponse.json({ error: 'Leonardo API key is not configured.' }, { status: 500 });
    }

    if (provider === 'leonardo-phoenix' && !LEONARDO_API_KEY) {
      return NextResponse.json({ error: 'Leonardo API key is not configured for Phoenix model.' }, { status: 500 });
    }

    if (['flux-dev', 'recraft-v3', 'stable-diffusion-v35-large'].includes(provider) && !FAL_API_KEY) {
      return NextResponse.json({ error: 'FAL API key is not configured for flux models.' }, { status: 500 });
    }

    if (provider === 'minimax' && !MINIMAX_API_KEY) {
      return NextResponse.json({ error: 'MiniMax API key is not configured.' }, { status: 500 });
    }

    // Validate reference image usage
    if (referenceImageId && !['leonardo', 'leonardo-phoenix', 'minimax'].includes(provider)) {
      return NextResponse.json({ 
        error: 'Reference images are only supported with Leonardo.ai, Leonardo Phoenix, and MiniMax providers.' 
      }, { status: 400 });
    }

    // Define style prefixes for thumbnails
    const thumbnailStylePrefixes = {
      'esoteric-medieval': "Esoteric 1400s medieval style drawing, mystical ancient manuscript illumination, ",
      'dark-demonic': "Esoteric Dark Demonic ancient drawing style, occult symbols, dark mystical atmosphere, ",
      'renaissance': "Renaissance classical painting style, masterpiece quality, detailed artistic composition, ",
      'gothic': "Gothic dark atmospheric style, dramatic lighting, mysterious ambiance, ",
      'mystical': "Mystical ethereal spiritual art style, divine light, transcendent imagery, ",
      'ancient': "Ancient manuscript illumination style, sacred geometry, timeless wisdom, ",
      'occult': "Occult symbolic esoteric artwork style, hidden knowledge, mystical symbols, ",
      'youtube-thumbnail': "High-impact YouTube thumbnail style, bold text overlay space, eye-catching composition, dramatic lighting, ",
      'cinematic': "Cinematic movie poster style, dramatic composition, professional lighting, high contrast, ",
      'none': ""
    };

    // Build the final prompt with style prefix and thumbnail optimization
    let finalPrompt = prompt;
    
    // Apply custom style prefix if provided
    if (customStylePrefix.trim()) {
      finalPrompt = `${customStylePrefix.trim()}, ${prompt}`;
    }
    // Apply predefined style prefix if selected
    else if (stylePrefix && thumbnailStylePrefixes[stylePrefix as keyof typeof thumbnailStylePrefixes]) {
      finalPrompt = `${thumbnailStylePrefixes[stylePrefix as keyof typeof thumbnailStylePrefixes]}${prompt}`;
    }

    // Add thumbnail-specific enhancements
    finalPrompt += ", high quality, detailed, professional, engaging composition, vibrant colors, sharp focus";

    // Determine dimensions based on aspect ratio
    let width = 1280, height = 720; // Default 16:9
    switch (aspectRatio) {
      case '1:1':
        width = 1024;
        height = 1024;
        break;
      case '9:16':
        width = 720;
        height = 1280;
        break;
      case '4:3':
        width = 1024;
        height = 768;
        break;
      default: // 16:9
        width = 1280;
        height = 720;
    }

    console.log(`🎨 Generating thumbnail with ${provider.toUpperCase()}: ${finalPrompt.substring(0, 100)}...`);

    let thumbnailUrl: string;
    let imageId: string | null = null;
    let usedReferenceImage = false;

    // Generate thumbnail based on selected provider
    switch (provider) {
      case 'openai':
        thumbnailUrl = await generateOpenAIThumbnail(finalPrompt, width, height);
        console.log('✅ OpenAI DALL-E 3 thumbnail generated successfully');
        break;

      case 'flux-dev':
      case 'recraft-v3':
      case 'stable-diffusion-v35-large':
        thumbnailUrl = await generateFluxThumbnail(provider, finalPrompt, width, height);
        console.log(`✅ ${provider.toUpperCase()} thumbnail generated successfully`);
        break;

      case 'minimax':
        // Convert aspect ratio for MiniMax
        let minimaxAspectRatio = "16:9";
        switch (aspectRatio) {
          case '1:1':
            minimaxAspectRatio = "1:1";
            break;
          case '9:16':
            minimaxAspectRatio = "9:16";
            break;
          default:
            minimaxAspectRatio = "16:9";
        }
        thumbnailUrl = await retryAsync(() => generateMinimaxThumbnail(finalPrompt, minimaxAspectRatio, referenceImageId));
        console.log('✅ MiniMax thumbnail generated successfully');
        break;

      case 'leonardo':
        // Leonardo.ai generation (original logic)
        const generationPayload: any = {
          modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", // Leonardo Kino XL model for high quality
          prompt: finalPrompt,
          num_images: 1,
          width: width,
          height: height,
          alchemy: true,
          styleUUID: "111dc692-d470-4eec-b791-3475abac4c46", // Cinematic style
          enhancePrompt: enhancePrompt,
          guidance_scale: 7, // Higher guidance for better prompt adherence
          num_inference_steps: 30, // More steps for better quality
          scheduler: "LEONARDO", // Leonardo's optimized scheduler
        };

        // Add reference image parameters if available (Leonardo only)
        if (referenceImageId) {
          generationPayload.init_generation_image_id = referenceImageId;
          generationPayload.init_strength = Math.max(0.1, Math.min(0.9, guidanceStrength));
          usedReferenceImage = true;
          console.log(`🎨 Using reference image ID ${referenceImageId} with strength: ${generationPayload.init_strength}`);
        }

        console.log('🚀 Starting Leonardo thumbnail generation...');

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

        thumbnailUrl = generatedImages[0].url;
        imageId = generatedImages[0].id;
        console.log('✅ Leonardo thumbnail generated successfully');
        break;

      case 'leonardo-phoenix':
        const { thumbnailUrl: leonardoPhoenixThumbnailUrl, imageId: leonardoPhoenixImageId } = await generateLeonardoPhoenixThumbnail(finalPrompt, width, height, 3.5, referenceImageId, guidanceStrength);
        thumbnailUrl = leonardoPhoenixThumbnailUrl;
        imageId = leonardoPhoenixImageId;
        console.log('✅ Leonardo Phoenix thumbnail generated successfully');
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Return the thumbnail URL and metadata
    return NextResponse.json({ 
      thumbnailUrl: thumbnailUrl,
      imageId: imageId,
      provider: provider,
      usedReferenceImage: usedReferenceImage,
      guidanceStrength: usedReferenceImage ? guidanceStrength : null,
      aspectRatio: aspectRatio,
      stylePrefix: stylePrefix || customStylePrefix || 'none'
    });

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal server error in thumbnail generation', details: errorMessage }, { status: 500 });
  }
}

// Environment variable checks
if (process.env.NODE_ENV !== 'test') {
  if (!OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY environment variable is not set. OpenAI thumbnail generation will fail.");
  }
  if (!LEONARDO_API_KEY) {
    console.warn("Warning: LEONARDO_API_KEY environment variable is not set. Leonardo thumbnail generation will fail.");
  }
  if (!FAL_API_KEY) {
    console.warn("Warning: FAL_API_KEY environment variable is not set. Flux model thumbnail generation will fail.");
  }
  if (!MINIMAX_API_KEY) {
    console.warn("Warning: MINIMAX_API_KEY environment variable is not set. MiniMax thumbnail generation will fail.");
  }
} 