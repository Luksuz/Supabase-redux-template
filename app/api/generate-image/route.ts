import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GenerateImageRequestBody, GenerateImageResponse } from '@/types/image-generation'
import { uploadFileToSupabase } from "@/utils/supabase-utils"
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const BATCH_SIZE = 5 // Process 3 images at a time (reduced for MiniMax stability)
const BATCH_INTERVAL_MS = 5000 // 8 seconds between batches (increased for MiniMax rate limits)

// Helper function for retrying an async operation
async function retryAsync<T>(
    fn: () => Promise<T>,
    retries: number = 5,
    delayMs: number = 1000, // Optional delay between retries
    attempt: number = 1
): Promise<T> {
    try {
        return await fn()
    } catch (error) {
        if (attempt > retries) {
            console.error(`Failed after ${retries} retries. Last error:`, error)
            throw error // Rethrow the last error after all retries fail
        }
        console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs / 1000}s... Error:`, error)
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt)) // Exponential backoff can be considered
        return retryAsync(fn, retries, delayMs, attempt + 1)
    }
}

// Helper function to process images in batches with rate limiting
async function processBatches<T>(
    items: (() => Promise<T>)[],
    batchSize: number = BATCH_SIZE,
    intervalMs: number = BATCH_INTERVAL_MS
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = []
    
    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, items.length)
        console.log(`Processing batch ${i/batchSize + 1}: items ${i+1} to ${batchEnd} of ${items.length}`)
        
        // Create a batch of promises
        const batch = items.slice(i, batchEnd).map(fn => fn())
        
        // Wait for the current batch to complete
        const batchResults = await Promise.allSettled(batch)
        results.push(...batchResults)
        
        // If not the last batch, wait before processing the next batch
        if (batchEnd < items.length) {
            console.log(`Rate limiting: waiting ${intervalMs/1000} seconds before next batch...`)
            await new Promise(resolve => setTimeout(resolve, intervalMs))
        }
    }
    
    return results
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as GenerateImageRequestBody
        const {
            provider,
            prompt,
            numberOfImages = 1,
            outputFormat = "url", // Keep outputFormat, default to url
            minimaxAspectRatio = "16:9", // Default to landscape
            userId = "unknown_user"
        } = body

        console.log(`🖼️ Received image generation request: provider=${provider}, userId=${userId}, prompt=${prompt.substring(0, 50)}...`)

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }
        if (provider !== 'openai' && provider !== 'minimax') {
            return NextResponse.json({ error: 'Invalid provider specified' }, { status: 400 })
        }

        // API key checks
        if (provider === "minimax" && !MINIMAX_API_KEY) {
            return NextResponse.json({ error: 'Minimax API key is not configured.' }, { status: 500 })
        }
        if (provider === "openai" && !process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 })
        }

        // Split prompts if they were combined with |||||
        const prompts = prompt.includes('|||||') ? prompt.split('|||||') : [prompt]
        const totalImages = prompts.length * numberOfImages

        let supabaseImageUrls: string[] = []

        // --- OpenAI Logic ---
        if (provider === 'openai') {
            console.log(`Generating ${totalImages} image(s) with OpenAI DALL-E 3...`)
            
            // Helper function for a single OpenAI generation + upload
            const generateAndUploadSingleOpenAIImage = async (promptVariation: string): Promise<string | null> => {
                const attemptGeneration = async (): Promise<string | null> => {
                    try {
                        const response = await openai.images.generate({
                            model: "gpt-image-1",
                            prompt: promptVariation,
                            n: 1, // DALL-E 3 supports only 1
                            size: "1536x1024",
                        })

                        console.log(`OpenAI response received for prompt: ${promptVariation.substring(0, 30)}...`)

                        if (response.data?.[0]?.b64_json) {
                            const imageBuffer = Buffer.from(response.data[0].b64_json, 'base64')
                            const destinationPath = `user_${userId}/images/${uuidv4()}.png`
                            const supabaseUrl = await uploadFileToSupabase(imageBuffer, destinationPath, 'image/png')
                            
                            if (!supabaseUrl) {
                                console.warn("Failed to upload an OpenAI generated image to Supabase.")
                                return null
                            }
                            return supabaseUrl
                        } else {
                            throw new Error('OpenAI response did not contain expected image data.')
                        }
                    } catch (error) {
                        console.error('Error during single OpenAI image generation/upload attempt:', error)
                        throw error
                    }
                }
                
                // Wrap the attemptGeneration with retryAsync
                return retryAsync(attemptGeneration)
            }

            // Create generation functions for all prompts and images
            const imageGenerationFunctions: (() => Promise<string | null>)[] = []
            
            prompts.forEach(singlePrompt => {
                for (let i = 0; i < numberOfImages; i++) {
                    const promptVariation = i === 0 ? singlePrompt : `${singlePrompt} (variation ${i})`
                    imageGenerationFunctions.push(() => generateAndUploadSingleOpenAIImage(promptVariation))
                }
            })

            console.log(`Starting batch processing for ${imageGenerationFunctions.length} OpenAI image generations...`)
            
            // Process in batches with rate limiting
            const settledResults = await processBatches(imageGenerationFunctions)

            settledResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    supabaseImageUrls.push(result.value)
                } else if (result.status === 'rejected') {
                    console.error(`Failed to generate/upload OpenAI image ${index + 1}:`, result.reason)
                } else if (result.status === 'fulfilled' && result.value === null) {
                    console.warn(`OpenAI image ${index + 1} generation completed but upload failed.`)
                }
            })
        }
        // --- MiniMax Logic ---
        else if (provider === 'minimax') {
            console.log(`Generating ${totalImages} image(s) with MiniMax...`)
            const minimaxApiUrl = "https://api.minimaxi.chat/v1/image_generation"

            // Helper function for a single MiniMax generation + upload
            const generateAndUploadSingleMinimaxImage = async (promptToUse: string): Promise<string | null> => {
                const attemptGeneration = async (): Promise<string | null> => {
                    const payload = {
                        model: "image-01",
                        prompt: promptToUse,
                        aspect_ratio: minimaxAspectRatio,
                        response_format: "base64", // Always get base64
                        width: 1536,
                        height: 1024, 
                        n: 1, // Generate one at a time
                        prompt_optimizer: true,
                    }
                    const headers = {
                        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                        'Content-Type': 'application/json',
                    }

                    // Log prompt length for debugging
                    console.log(`MiniMax request - Prompt length: ${promptToUse.length} characters`)
                    if (promptToUse.length > 1400) {
                        console.warn(`⚠️ Prompt is long (${promptToUse.length} chars), may hit MiniMax limit`)
                    }

                    try {
                        const minimaxResponse = await fetch(minimaxApiUrl, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
                        if (!minimaxResponse.ok) {
                            const errorData = await minimaxResponse.json().catch(() => ({}))
                            console.error('Minimax API error:', minimaxResponse.status, errorData)
                            throw new Error(`Minimax API request failed with status ${minimaxResponse.status}`)
                        }
                        const data = await minimaxResponse.json()
                        
                        // Log the actual response structure for debugging (but limit size)
                        const responsePreview = JSON.stringify(data, null, 2).substring(0, 500)
                        console.log('MiniMax API response preview:', responsePreview + (responsePreview.length >= 500 ? '...' : ''))

                        // Check for successful response with image data (multiple possible formats)
                        let base64String = null
                        
                        // Format 1: data.data.image_base64[0]
                        if (data.data?.image_base64?.[0]) {
                            base64String = data.data.image_base64[0]
                            console.log('✅ Found image in format: data.data.image_base64[0]')
                        }
                        // Format 2: data.image_base64[0] 
                        else if (data.image_base64?.[0]) {
                            base64String = data.image_base64[0]
                            console.log('✅ Found image in format: data.image_base64[0]')
                        }
                        // Format 3: data.data.images[0].image_base64
                        else if (data.data?.images?.[0]?.image_base64) {
                            base64String = data.data.images[0].image_base64
                            console.log('✅ Found image in format: data.data.images[0].image_base64')
                        }
                        // Format 4: data.images[0].image_base64
                        else if (data.images?.[0]?.image_base64) {
                            base64String = data.images[0].image_base64
                            console.log('✅ Found image in format: data.images[0].image_base64')
                        }
                        // Format 5: direct base64 in data
                        else if (data.base64_image) {
                            base64String = data.base64_image
                            console.log('✅ Found image in format: data.base64_image')
                        }
                        
                        if (base64String) {
                            const imageBuffer = Buffer.from(base64String, 'base64')
                            const destinationPath = `user_${userId}/images/${uuidv4()}.png`
                            const supabaseUrl = await uploadFileToSupabase(imageBuffer, destinationPath, 'image/png')
                            if (!supabaseUrl) {
                                console.warn("Failed to upload a MiniMax generated image to Supabase.")
                                return null // Indicate failure for this specific image
                            }
                            console.log('✅ Successfully generated and uploaded MiniMax image')
                            return supabaseUrl
                        }
                        
                        // Check for API error response (multiple possible error formats)
                        let errorMessage = null
                        
                        // Format 1: data.base_resp.status_code (from your error)
                        if (data.base_resp?.status_code !== undefined && data.base_resp.status_code !== 0) {
                            errorMessage = data.base_resp.status_msg || `API error code: ${data.base_resp.status_code}`
                            
                            // Special handling for prompt length error
                            if (data.base_resp.status_code === 2013 && data.base_resp.status_msg?.includes('prompt length')) {
                                console.error(`❌ Prompt too long (${promptToUse.length} chars): "${promptToUse.substring(0, 100)}..."`)
                                errorMessage = `Prompt too long (${promptToUse.length} characters). MiniMax limit is 1500.`
                            }
                        }
                        // Format 2: data.base.status_code 
                        else if (data.base?.status_code !== undefined && data.base.status_code !== 0) {
                            errorMessage = data.base.status_msg || `API error code: ${data.base.status_code}`
                        }
                        // Format 3: data.error
                        else if (data.error) {
                            errorMessage = typeof data.error === 'string' ? data.error : data.error.message || 'Unknown error'
                        }
                        
                        if (errorMessage) {
                            console.error('❌ Minimax API returned an error:', errorMessage)
                            throw new Error(`Minimax API error: ${errorMessage}`)
                        }
                        
                        // If we get here, the response format was unexpected
                        console.warn('❌ Minimax response format unexpected. Available keys:', Object.keys(data).join(', '))
                        console.warn('Full response structure:', JSON.stringify(data, null, 2))
                        throw new Error(`Minimax API returned unexpected response format. Available keys: ${Object.keys(data).join(', ')}`)
                    } catch (error) {
                        console.error('❌ Error during single MiniMax image generation/upload attempt:', error)
                        throw error
                    }
                }
                
                // Wrap the attemptGeneration with retryAsync
                return retryAsync(attemptGeneration)
            }

            // Create generation functions for all prompts and images
            const imageGenerationFunctions: (() => Promise<string | null>)[] = []
            
            prompts.forEach(singlePrompt => {
                for (let i = 0; i < numberOfImages; i++) {
                    imageGenerationFunctions.push(() => generateAndUploadSingleMinimaxImage(singlePrompt))
                }
            })

            console.log(`Starting batch processing for ${imageGenerationFunctions.length} MiniMax image generations...`)
            
            // Process in batches with rate limiting
            const settledResults = await processBatches(imageGenerationFunctions)

            settledResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    supabaseImageUrls.push(result.value)
                } else if (result.status === 'rejected') {
                    console.error(`Failed to generate/upload MiniMax image ${index + 1}:`, result.reason)
                } else if (result.status === 'fulfilled' && result.value === null) {
                    console.warn(`MiniMax image ${index + 1} generation/upload completed but resulted in null (e.g., upload failed).`)
                }
            })
        }

        // --- Final Response ---
        if (supabaseImageUrls.length === 0) {
             console.error("No images were successfully generated and uploaded.")
             if (totalImages > 0) {
                  return NextResponse.json({ error: 'Image generation failed. No images were successfully created or uploaded. Check provider status and API keys.' }, { status: 500 })
             }
        }

        console.log(`✅ Image generation complete. Returning ${supabaseImageUrls.length} Supabase URL(s).`)
        const responsePayload: GenerateImageResponse = { imageUrls: supabaseImageUrls }
        return NextResponse.json(responsePayload, { status: 200 })

    } catch (error: any) {
        console.error('Error generating image:', error)
        return NextResponse.json({ error: error.message || 'Failed to generate image' }, { status: 500 })
    }
}

// Keep existing env var checks
if (process.env.NODE_ENV !== 'test') {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("Warning: OPENAI_API_KEY environment variable is not set. OpenAI image generation will fail.")
    }
    if (!MINIMAX_API_KEY) {
        console.warn("Warning: MINIMAX_API_KEY environment variable is not set. Minimax image generation will fail.")
    }
} 