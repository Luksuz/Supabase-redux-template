import { NextRequest, NextResponse } from 'next/server';
import { GenerateImageRequestBody, GenerateImageResponse } from '@/types/image-generation';
import { v4 as uuidv4 } from 'uuid';
import { fal } from "@fal-ai/client";

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

// Configure fal.ai
if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY,
  });
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

// Get image dimensions based on aspect ratio
const getImageDimensions = (aspectRatio: '16:9' | '1:1' | '9:16', provider: string) => {
  if (provider === 'minimax') {
    // MiniMax uses aspect_ratio parameter
    return null;
  }

  // For flux models, use specific dimensions
  switch (aspectRatio) {
    case '16:9':
      return { width: 1344, height: 768 };
    case '1:1':
      return { width: 1024, height: 1024 };
    case '9:16':
      return { width: 768, height: 1344 };
    default:
      return { width: 1024, height: 1024 };
  }
};

// Generate image using flux models via fal.ai
async function generateFluxImage(provider: string, prompt: string, dimensions: { width: number; height: number }): Promise<string> {
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
      image_size: dimensions,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false
    },
  });

  // Extract image URL from fal.ai response
  if (result.data?.images?.[0]?.url) {
    return result.data.images[0].url;
  } else if (result.data?.image?.url) {
    return result.data.image.url;
  } else {
    console.error('Unexpected fal.ai response structure:', result);
    throw new Error('No image URL found in fal.ai response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateImageRequestBody;
    const {
      provider = 'minimax',
      prompt,
      numberOfImages = 1,
      minimaxAspectRatio = "16:9",
      userId = "unknown_user"
    } = body;

    console.log(`🖼️ Received ${provider} image generation request: userId=${userId}, images=${numberOfImages}, prompt=${prompt.substring(0, 50)}...`);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Check API keys based on provider
    if (provider === 'minimax' && !MINIMAX_API_KEY) {
      return NextResponse.json({ error: 'MiniMax API key is not configured.' }, { status: 500 });
    }

    if (provider !== 'minimax' && !FAL_API_KEY) {
      return NextResponse.json({ error: 'FAL API key is not configured for flux models.' }, { status: 500 });
    }

    const imageUrls: string[] = [];

    if (provider === 'minimax') {
      // Existing MiniMax logic
      const minimaxApiUrl = "https://api.minimaxi.chat/v1/image_generation";
      console.log(`Generating ${numberOfImages} image(s) with MiniMax...`);

      const generateSingleMinimaxImage = async (): Promise<string | null> => {
        const attemptGeneration = async (): Promise<string | null> => {
          const payload = {
            model: "image-01",
            prompt: prompt,
            aspect_ratio: minimaxAspectRatio,
            response_format: "base64",
            width: 1536,
            height: 1024,
            n: 1,
            prompt_optimizer: true,
          };
          const headers = {
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          };

          try {
            const minimaxResponse = await fetch(minimaxApiUrl, { 
              method: 'POST', 
              headers: headers, 
              body: JSON.stringify(payload) 
            });
            
            if (!minimaxResponse.ok) {
              const errorData = await minimaxResponse.json().catch(() => ({}));
              console.error('MiniMax API error:', minimaxResponse.status, errorData);
              throw new Error(`MiniMax API request failed with status ${minimaxResponse.status}`);
            }
            
            const data = await minimaxResponse.json();

            if (data.data?.image_base64?.[0]) {
              const base64String = data.data.image_base64[0];
              return `data:image/png;base64,${base64String}`;
            }
            
            if (data.base && data.base.status_code !== 0) {
              console.error('MiniMax API returned an error status:', data.base);
              throw new Error(`MiniMax API error: ${data.base?.status_msg || 'Unknown error'}`);
            }
            
            console.warn('MiniMax response format unexpected - no image data found:', data);
            throw new Error('No image data received from MiniMax API');
          } catch (error) {
            console.error('Error during single MiniMax image generation attempt:', error);
            throw error;
          }
        };
        
        return retryAsync(attemptGeneration);
      };

      // Generate all images sequentially for MiniMax
      for (let i = 0; i < numberOfImages; i++) {
        console.log(`Generating image ${i + 1} of ${numberOfImages}...`);
        
        try {
          const imageUrl = await generateSingleMinimaxImage();
          if (imageUrl) {
            imageUrls.push(imageUrl);
            console.log(`✅ Successfully generated image ${i + 1}`);
          } else {
            console.warn(`⚠️ Failed to generate image ${i + 1}`);
          }
        } catch (error) {
          console.error(`❌ Error generating image ${i + 1}:`, error);
        }
        
        // Small delay between requests
        if (i < numberOfImages - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Flux models using fal.ai
      console.log(`Generating ${numberOfImages} image(s) with ${provider}...`);
      
      const dimensions = getImageDimensions(minimaxAspectRatio, provider);
      if (!dimensions) {
        throw new Error('Invalid dimensions for flux model');
      }

      // Generate images with rate limiting for flux (10 per minute)
      for (let i = 0; i < numberOfImages; i++) {
        console.log(`Generating flux image ${i + 1} of ${numberOfImages}...`);
        
        try {
          const imageUrl = await generateFluxImage(provider, prompt, dimensions);
          imageUrls.push(imageUrl);
          console.log(`✅ Successfully generated flux image ${i + 1}`);
        } catch (error) {
          console.error(`❌ Error generating flux image ${i + 1}:`, error);
        }
        
        // Rate limiting: Wait 6 seconds between requests (10 per minute)
        if (i < numberOfImages - 1) {
          console.log('Waiting 6 seconds for flux rate limiting...');
          await new Promise(resolve => setTimeout(resolve, 6000));
        }
      }
    }

    if (imageUrls.length === 0) {
      console.error("No images were successfully generated.");
      return NextResponse.json({ 
        error: 'Image generation failed. No images were successfully created.' 
      }, { status: 500 });
    }

    console.log(`✅ ${provider} image generation complete. Generated ${imageUrls.length} image(s).`);
    const responsePayload: GenerateImageResponse = { imageUrls };
    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate image' 
    }, { status: 500 });
  }
}

// Environment variable check
if (process.env.NODE_ENV !== 'test') {
  if (!MINIMAX_API_KEY) {
    console.warn("Warning: MINIMAX_API_KEY environment variable is not set. MiniMax image generation will fail.");
  }
  if (!FAL_API_KEY) {
    console.warn("Warning: FAL_API_KEY environment variable is not set. Flux model generation will fail.");
  }
} 