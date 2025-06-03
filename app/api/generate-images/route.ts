import { NextRequest, NextResponse } from 'next/server';
import { GenerateImageRequestBody, GenerateImageResponse } from '@/types/image-generation';
import { v4 as uuidv4 } from 'uuid';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateImageRequestBody;
    const {
      prompt,
      numberOfImages = 1,
      minimaxAspectRatio = "16:9",
      userId = "unknown_user"
    } = body;

    console.log(`🖼️ Received MiniMax image generation request: userId=${userId}, prompt=${prompt.substring(0, 50)}...`);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!MINIMAX_API_KEY) {
      return NextResponse.json({ error: 'MiniMax API key is not configured.' }, { status: 500 });
    }

    const imageUrls: string[] = [];
    const minimaxApiUrl = "https://api.minimaxi.chat/v1/image_generation";

    console.log(`Generating ${numberOfImages} image(s) with MiniMax...`);

    // Helper function for a single MiniMax generation
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
          console.log('MiniMax API response:', JSON.stringify(data, null, 2));

          // Check if we have the expected data structure for images
          if (data.data?.image_base64?.[0]) {
            const base64String = data.data.image_base64[0];
            // Convert to data URL for immediate display
            return `data:image/png;base64,${base64String}`;
          }
          
          // Check for error in response
          if (data.base && data.base.status_code !== 0) {
            console.error('MiniMax API returned an error status:', data.base);
            throw new Error(`MiniMax API error: ${data.base?.status_msg || 'Unknown error'}`);
          }
          
          // If we reach here, the response format is unexpected
          console.warn('MiniMax response format unexpected - no image data found:', data);
          throw new Error('No image data received from MiniMax API');
        } catch (error) {
          console.error('Error during single MiniMax image generation attempt:', error);
          throw error;
        }
      };
      
      return retryAsync(attemptGeneration);
    };

    // Generate all images sequentially
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
        // Continue with other images even if one fails
      }
      
      // Small delay between requests to be respectful to the API
      if (i < numberOfImages - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (imageUrls.length === 0) {
      console.error("No images were successfully generated.");
      return NextResponse.json({ 
        error: 'Image generation failed. No images were successfully created.' 
      }, { status: 500 });
    }

    console.log(`✅ MiniMax image generation complete. Generated ${imageUrls.length} image(s).`);
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
} 