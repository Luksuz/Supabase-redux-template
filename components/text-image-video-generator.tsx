'use client'

import { useState, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  startBatchGeneration,
  updateBatchProgress,
  updateGenerationInfo,
  addVideoToBatch,
  updateVideoInBatch,
  completeBatchGeneration,
  failBatchGeneration,
  clearError,
  setDefaultDuration,
  updateRateLimit
} from '@/lib/features/textImageVideo/textImageVideoSlice'
import { 
  TextToVideoRequest, 
  ImageToVideoRequest, 
  GeneratedVideo,
  VIDEO_PROVIDERS 
} from '@/types/text-image-video-generation'
import { v4 as uuidv4 } from 'uuid'
import { uploadVideoToSupabase, saveVideoToLocalStorage } from '@/utils/video-storage-utils'

// Import modular components
import { TextToVideoTab } from './text-image-video/TextToVideoTab'
import { ImageToVideoTab } from './text-image-video/ImageToVideoTab'
import { VideoGenerationDisplay } from './text-image-video/VideoGenerationDisplay'
import { VideoHistoryTab } from './text-image-video/VideoHistoryTab'

export function TextImageVideoGenerator() {
  const dispatch = useAppDispatch()
  const { 
    currentBatch,
    isGenerating,
    error,
    generationInfo,
    batchProgress,
    selectedProvider,
    defaultDuration,
    batchSize,
    videoHistory,
    batches,
    remainingRequests
  } = useAppSelector(state => state.textImageVideo)
  
  // Local state for batch processing
  const [currentBatchRequests, setCurrentBatchRequests] = useState<(TextToVideoRequest | ImageToVideoRequest)[]>([])

  // Background function to upload video to Supabase
  const uploadVideoToSupabaseBackground = async (videoUrl: string, video: GeneratedVideo) => {
    try {
      const storedVideo = await uploadVideoToSupabase(videoUrl, video.id, {
        type: video.type,
        prompt: video.prompt,
        duration: video.duration,
        generatedAt: video.generatedAt,
        originalImageUrl: video.imageInput
      })

      if (storedVideo) {
        saveVideoToLocalStorage(storedVideo)
        console.log('📁 Video saved to Supabase and localStorage')
      }
    } catch (error) {
      console.error('❌ Background upload failed:', error)
    }
  }

  // Helper function to convert image file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix to get just the base64 data
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = error => reject(error)
    })
  }

  // Process a single batch of videos
  const processVideoBatch = async (
    requests: (TextToVideoRequest | ImageToVideoRequest)[], 
    batchIndex: number, 
    totalBatches: number
  ) => {
    const batchSize = VIDEO_PROVIDERS[selectedProvider].batchSize
    const batchRequests = requests.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)
    
    dispatch(updateBatchProgress({ 
      current: batchIndex * batchSize, 
      total: requests.length, 
      currentBatch: batchIndex + 1, 
      totalBatches 
    }))

    dispatch(updateGenerationInfo(
      `Processing batch ${batchIndex + 1}/${totalBatches} (${batchRequests.length} videos)...`
    ))

    const requestPromises = batchRequests.map(async (request, index) => {
      try {
        const videoId = uuidv4()
        
        // Create placeholder video object
        const video: GeneratedVideo = {
          id: videoId,
          type: 'image' in request ? 'image-to-video' : 'text-to-video',
          prompt: request.prompt,
          imageInput: 'image' in request ? request.image : undefined,
          duration: request.duration,
          videoUrl: '',
          provider: request.provider,
          model: request.model || 'bytedance/seedance-1-lite',
          generatedAt: new Date().toISOString(),
          status: 'generating'
        }

        // Add to batch immediately with generating status
        dispatch(addVideoToBatch(video))

        // Make API call
        const endpoint = 'image' in request ? '/api/image-to-video' : '/api/text-to-video'
        const body = 'image' in request 
          ? { prompt: request.prompt, image: request.image, duration: request.duration }
          : { prompt: request.prompt, duration: request.duration }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`Failed to generate video ${index + 1} in batch ${batchIndex + 1}:`, errorData.error)
          
          dispatch(updateVideoInBatch({
            videoId,
            status: 'failed',
            error: errorData.error || 'Failed to generate video'
          }))
          
          return null
        }

        const data = await response.json()
        
        // Direct completion - both endpoints now return videoUrl immediately
        const videoUrl = data.videoUrl
        if (videoUrl) {
          // Upload to Supabase storage in the background
          uploadVideoToSupabaseBackground(videoUrl, video)

          dispatch(updateVideoInBatch({
            videoId,
            status: 'completed',
            videoUrl
          }))
        } else {
          dispatch(updateVideoInBatch({
            videoId,
            status: 'failed',
            error: 'No video URL returned'
          }))
          return null
        }

        return { videoId, videoUrl }
      } catch (error) {
        console.error(`Error generating video ${index + 1} in batch ${batchIndex + 1}:`, error)
        return null
      }
    })

    // Wait for all requests in the batch to complete
    const results = await Promise.all(requestPromises)
    const successfulVideos = results.filter(result => result !== null)

    // Update rate limiting
    dispatch(updateRateLimit({ used: batchRequests.length }))

    // Update progress for the entire batch
    dispatch(updateBatchProgress({ 
      current: batchProgress.current + batchRequests.length,
      total: batchProgress.total,
      currentBatch: batchProgress.currentBatch,
      totalBatches: batchProgress.totalBatches
    }))

    return successfulVideos
  }



  // Handle batch generation
  const handleGenerateVideos = async (requests: (TextToVideoRequest | ImageToVideoRequest)[]) => {
    if (requests.length === 0) return

    const generationId = uuidv4()
    const batchSize = VIDEO_PROVIDERS[selectedProvider].batchSize
    const totalBatches = Math.ceil(requests.length / batchSize)
    
    dispatch(startBatchGeneration({ 
      id: generationId, 
      requests
    }))

    try {
      dispatch(updateGenerationInfo(`Starting batch processing: ${requests.length} videos in ${totalBatches} batches...`))

      const allResults: any[] = []

      // Process each batch
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        try {
          const batchResults = await processVideoBatch(requests, batchIndex, totalBatches)
          allResults.push(...batchResults)
          
          dispatch(updateGenerationInfo(
            `Completed batch ${batchIndex + 1}/${totalBatches}. Generated ${allResults.length}/${requests.length} videos.`
          ))

          // Wait between batches (1 minute like image generation)
          if (batchIndex < totalBatches - 1) {
            const waitTime = 60 // 1 minute wait between batches
            
            dispatch(updateGenerationInfo(
              `Batch ${batchIndex + 1}/${totalBatches} complete. Waiting ${waitTime} seconds before next batch...`
            ))
            
            // Show countdown for the wait time
            for (let countdown = waitTime; countdown > 0; countdown--) {
              dispatch(updateGenerationInfo(
                `Waiting ${countdown} seconds before processing batch ${batchIndex + 2}/${totalBatches}...`
              ))
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        } catch (error) {
          console.error(`Error in batch ${batchIndex + 1}:`, error)
          dispatch(updateGenerationInfo(
            `Batch ${batchIndex + 1} failed. Continuing with remaining batches...`
          ))
        }
      }

      dispatch(completeBatchGeneration())
      
    } catch (error) {
      console.error('Error generating videos:', error)
      dispatch(failBatchGeneration(
        error instanceof Error ? error.message : 'Failed to generate videos'
      ))
    }
  }

  // Handle text-to-video generation
  const handleTextToVideo = useCallback(async (prompts: string[], duration: 5 | 10) => {
    const requests: TextToVideoRequest[] = prompts.map(prompt => ({
      prompt,
      duration,
      provider: selectedProvider,
      model: 'bytedance/seedance-1-lite'
    }))

    await handleGenerateVideos(requests)
  }, [selectedProvider])

  // Handle image-to-video generation
  const handleImageToVideo = useCallback(async (
    prompts: string[], 
    images: File[], 
    duration: 5 | 10
  ) => {
    try {
      // Convert images to base64
      const base64Images = await Promise.all(images.map(file => fileToBase64(file)))
      
      const requests: ImageToVideoRequest[] = prompts.map((prompt, index) => ({
        prompt,
        image: base64Images[index] || base64Images[0], // Use first image if not enough images
        duration,
        provider: selectedProvider,
        model: 'bytedance/seedance-1-lite'
      }))

      await handleGenerateVideos(requests)
    } catch (error) {
      dispatch(failBatchGeneration('Failed to process images for video generation'))
    }
  }, [selectedProvider])

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Text & Image to Video Generator
        </h1>
        <p className="text-gray-600">
          Generate videos from text prompts or images using AI. Batch processing with {VIDEO_PROVIDERS[selectedProvider].batchSize} videos per batch.
        </p>
        <div className="mt-2 text-sm text-blue-600">
          Rate limit: {remainingRequests} requests remaining
        </div>
      </div>

      <Tabs defaultValue="text-to-video">
        <TabsList className="flex w-full justify-center gap-2 mb-6">
          <TabsTrigger value="text-to-video">Text to Video</TabsTrigger>
          <TabsTrigger value="image-to-video">Image to Video</TabsTrigger>
          <TabsTrigger value="generation">Current Generation</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="text-to-video" className="space-y-6">
          <TextToVideoTab
            defaultDuration={defaultDuration}
            isGenerating={isGenerating}
            onGenerate={handleTextToVideo}
            onDurationChange={(duration: 5 | 10) => dispatch(setDefaultDuration(duration))}
          />
        </TabsContent>

        <TabsContent value="image-to-video" className="space-y-6">
          <ImageToVideoTab
            defaultDuration={defaultDuration}
            isGenerating={isGenerating}
            onGenerate={handleImageToVideo}
            onDurationChange={(duration: 5 | 10) => dispatch(setDefaultDuration(duration))}
          />
        </TabsContent>

        <TabsContent value="generation" className="space-y-6">
          <VideoGenerationDisplay
            currentBatch={currentBatch}
            isGenerating={isGenerating}
            error={error}
            generationInfo={generationInfo}
            batchProgress={batchProgress}
            onClearError={() => dispatch(clearError())}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <VideoHistoryTab
            videoHistory={videoHistory}
            batches={batches}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
} 