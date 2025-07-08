'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setVideoSettings,
  startVideoGeneration,
  setVideoGenerationError,
  saveVideoToHistory,
  setIsGeneratingVideo
} from '../lib/features/video/videoSlice'
import { CreateVideoRequestBody, VideoRecord, SegmentTiming, IntroImageConfig } from '@/types/video-generation'

// Import modular components
import { VideoPrerequisites } from './video-generation/VideoPrerequisites'
import { VideoSettings } from './video-generation/VideoSettings'
import { VideoGenerationStatus } from './video-generation/VideoGenerationStatus'
import { VideoStatusMessage } from './video-generation/VideoStatusMessage'
import { VideoEmptyState } from './video-generation/VideoEmptyState'

export function VideoGenerator() {
  const dispatch = useAppDispatch()
  
  // Use Redux state for user instead of NextAuth session
  const { id: userId } = useAppSelector(state => state.user)
  
  // Use Redux states from imageGeneration, audio, and video slices
  const { imageSets, selectedImagesOrder } = useAppSelector(state => state.imageGeneration)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { 
    currentGeneration, 
    isGeneratingVideo,
    settings
  } = useAppSelector(state => state.video)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [customSegmentTimings, setCustomSegmentTimings] = useState<SegmentTiming[]>([])

  // Add subtitle styling state
  const [subtitleSettings, setSubtitleSettings] = useState({
    fontFamily: 'Roboto',
    fontColor: '#ffffff',
    fontSize: 24,
    strokeWidth: 2,
    fontWeight: '1000',
    textTransform: 'none'
  })

  // Add state for intro images configuration (for Option 2)
  const [introImages, setIntroImages] = useState<IntroImageConfig[]>([])
  const [selectedLoopImageId, setSelectedLoopImageId] = useState<string>('')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    // Auto-clear success and info messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => setMessage(""), 5000)
    }
  }

  // Get image URLs from selected images order in Redux
  const getOrderedImageUrls = (): string[] => {
    const urls: string[] = []
    
    // Use the ordered selection from Redux state
    if (selectedImagesOrder.length > 0) {
      selectedImagesOrder.forEach((imageId: string) => {
        const [setId, imageIndex] = imageId.split(':')
        const imageSet = imageSets.find(set => set.id === setId)
        if (imageSet && imageSet.imageUrls[parseInt(imageIndex)]) {
          urls.push(imageSet.imageUrls[parseInt(imageIndex)])
        }
      })
      return urls
    }
    
    console.log(`🖼️ Found ${urls.length} ordered image URLs from Redux state`)
    return urls
  }

  // Check if we have generated images
  const hasGeneratedImages = imageSets.length > 0 && selectedImagesOrder.length > 0

  // Initialize custom segment timings when images or audio change
  useEffect(() => {
    const imageUrls = getOrderedImageUrls()
    if (imageUrls.length > 0 && audioGeneration?.audioUrl) {
      if (audioGeneration.duration) {
        // Use actual duration if available
        const equalDuration = audioGeneration.duration / imageUrls.length
        const timings = imageUrls.map(() => ({ duration: equalDuration }))
        setCustomSegmentTimings(timings)
      } else {
        // Fallback to default timing if duration is missing
        console.warn('🎵 Audio duration not available, using default 3s per image')
        const defaultDuration = 3 // 3 seconds per image as fallback
        const timings = imageUrls.map(() => ({ duration: defaultDuration }))
        setCustomSegmentTimings(timings)
      }
    }
  }, [selectedImagesOrder, imageSets.length, audioGeneration?.audioUrl, audioGeneration?.duration])

  // Debug logging for audio generation state
  useEffect(() => {
    console.log('🎵 Audio generation state:', audioGeneration)
    if (audioGeneration) {
      console.log('🎵 Audio URL:', audioGeneration.audioUrl)
      console.log('🎵 Audio duration:', audioGeneration.duration)
      console.log('🎵 Audio status:', audioGeneration.status)
    }
  }, [audioGeneration])

  // Debug logging for image generation state
  useEffect(() => {
    console.log('🖼️ Image generation state:', { 
      imageSetsCount: imageSets.length, 
      selectedImagesOrder: selectedImagesOrder.length,
      totalImages: getOrderedImageUrls().length,
      hasGeneratedImages 
    })
  }, [imageSets, selectedImagesOrder, hasGeneratedImages])

  // Check if we have all prerequisites for video generation
  const hasPrerequisites = hasGeneratedImages && audioGeneration?.audioUrl

  // Show messages for state changes
  useEffect(() => {
    if (hasGeneratedImages && audioGeneration?.audioUrl) {
      showMessage('Ready to generate video! All prerequisites are met.', 'success')
    } else if (!hasGeneratedImages) {
      showMessage('Select images in Image Generator first to create a video.', 'info')
    } else if (!audioGeneration?.audioUrl) {
      showMessage('Generate audio first to create a video.', 'info')
    }
  }, [hasGeneratedImages, audioGeneration?.audioUrl])

  // Update segment timing duration
  const updateSegmentTiming = (index: number, duration: number) => {
    const updatedTimings = [...customSegmentTimings]
    updatedTimings[index] = { duration }
    setCustomSegmentTimings(updatedTimings)
  }

  // Distribute total duration equally across all segments
  const distributeEquallyAcrossSegments = async () => {
    if (getOrderedImageUrls().length === 0) {
      showMessage('No images selected for timing distribution', 'error')
      return
    }

    let duration = audioGeneration?.duration
    
    // If duration is not available in Redux, try to fetch it
    if (!duration) {
      showMessage('Fetching audio duration...', 'info')
      duration = await getAudioDuration()
      
      if (!duration) {
        showMessage('Audio duration not available. Please regenerate audio first.', 'error')
        console.warn('🎵 Audio duration missing from state:', audioGeneration)
        return
      }
    }
    
    const equalDuration = duration / getOrderedImageUrls().length
    const equalTimings = getOrderedImageUrls().map(() => ({ duration: equalDuration }))
    setCustomSegmentTimings(equalTimings)
    showMessage(`Distributed ${duration.toFixed(1)}s equally across ${getOrderedImageUrls().length} images`, 'success')
  }

  // Get audio duration with fallback to fetch from audio file
  const getAudioDuration = async (): Promise<number | null> => {
    if (audioGeneration?.duration) {
      return audioGeneration.duration
    }
    
    // If no duration is available in Redux, try to get it from the audio file
    if (audioGeneration?.audioUrl) {
      try {
        console.log('🎵 Fetching audio duration from file:', audioGeneration.audioUrl)
        return new Promise((resolve) => {
          const audio = new Audio(audioGeneration.audioUrl!)
          audio.addEventListener('loadedmetadata', () => {
            console.log('🎵 Audio duration fetched:', audio.duration)
            resolve(audio.duration)
          })
          audio.addEventListener('error', () => {
            console.warn('🎵 Failed to load audio metadata')
            resolve(null)
          })
          // Set timeout to avoid hanging
          setTimeout(() => resolve(null), 5000)
        })
      } catch (error) {
        console.warn('🎵 Error fetching audio duration:', error)
      }
    }
    
    console.warn('🎵 No audio duration available')
    return null
  }

  // Convert script durations to segment timings for video generation
  const getScriptBasedTimings = (): SegmentTiming[] => {
    if (!audioGeneration?.scriptDurations || getOrderedImageUrls().length === 0) {
      return []
    }

    // Map images to their corresponding script durations
    const timings: SegmentTiming[] = []
    
    getOrderedImageUrls().forEach((imageUrl, index) => {
      // For now, we'll use index-based matching since imageUrl doesn't directly map to imageId
      // In a real implementation, you'd need to maintain the relationship between imageUrl and imageId
      const scriptDuration = audioGeneration.scriptDurations?.[index]
      if (scriptDuration) {
        timings.push({ duration: scriptDuration.duration })
      } else {
        // Fallback to equal timing if no script duration found
        const fallbackDuration = audioGeneration.duration ? audioGeneration.duration / getOrderedImageUrls().length : 3
        timings.push({ duration: fallbackDuration })
        console.warn(`No script duration found for image ${index}, using fallback: ${fallbackDuration}s`)
      }
    })

    return timings
  }

  // Check if script-based timing is available
  const scriptBasedTimingAvailable = audioGeneration?.scriptDurations && audioGeneration.scriptDurations.length > 0

  // Handle video generation with ordered images from Redux
  const handleGenerateVideo = async () => {
    try {
      dispatch(setIsGeneratingVideo(true))

      // Use ordered images from Redux state
      const orderedImageUrls = getOrderedImageUrls()
      
      // Validate that at least one image is selected
      if (orderedImageUrls.length === 0) {
        showMessage('Please select images in the Image Generator first.', 'error')
        dispatch(setIsGeneratingVideo(false))
        return
      }
      
      console.log(`🎬 Starting video generation with ${orderedImageUrls.length} ordered images in ${settings.videoMode} mode`)
      showMessage(`Starting ${settings.videoMode} video generation with ${orderedImageUrls.length} images...`, 'info')
      
      // Determine which timing mode to use and prepare segment timings
      let segmentTimings: SegmentTiming[] | undefined = undefined
      let videoType: 'traditional' | 'segmented' | 'script-based' | 'option1' | 'option2' = 'traditional'

      // Handle new video modes
      if (settings.videoMode === 'option1') {
        videoType = 'option1'
        // Option 1: Loop all images with zoom effects - no specific segment timings needed
      } else if (settings.videoMode === 'option2') {
        videoType = 'option2'
        // Option 2: Intro sequence + loop - validate intro images and loop image
        if (introImages.length === 0) {
          showMessage('Please configure intro images for Option 2 video mode.', 'error')
          dispatch(setIsGeneratingVideo(false))
          return
        }
        if (!selectedLoopImageId) {
          showMessage('Please select a loop image for Option 2 video mode.', 'error')
          dispatch(setIsGeneratingVideo(false))
          return
        }
      } else if (settings.useSegmentedTiming) {
        // Custom segmented timing (manual user input) - adjust for selected images
        const selectedTimings = customSegmentTimings.slice(0, orderedImageUrls.length)
        segmentTimings = selectedTimings
        videoType = 'segmented'
      } else if (settings.useScriptBasedTiming && scriptBasedTimingAvailable) {
        // Script-based timing (automatic from audio generation) - adjust for selected images
        const scriptTimings = getScriptBasedTimings()
        segmentTimings = scriptTimings.slice(0, orderedImageUrls.length)
        videoType = 'script-based'
      }
      // Otherwise, use traditional equal timing (no segmentTimings)

      // Get loop image URL for Option 2
      let loopImageUrl: string | undefined = undefined
      if (settings.videoMode === 'option2' && selectedLoopImageId) {
        const [setId, imageIndex] = selectedLoopImageId.split(':')
        const imageSet = imageSets.find(set => set.id === setId)
        if (imageSet && imageSet.imageUrls[parseInt(imageIndex)]) {
          loopImageUrl = imageSet.imageUrls[parseInt(imageIndex)]
        }
      }

      // Prepare request body with ordered images
      const requestBody: CreateVideoRequestBody = {
        imageUrls: orderedImageUrls,
        audioUrl: audioGeneration?.audioUrl || 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        compressedAudioUrl: audioGeneration?.compressedAudioUrl || undefined,
        subtitlesUrl: settings.includeSubtitles && audioGeneration?.subtitlesUrl ? audioGeneration.subtitlesUrl : undefined,
        userId: userId || 'current_user',
        thumbnailUrl: orderedImageUrls[0],
        segmentTimings: segmentTimings,
        includeOverlay: settings.includeOverlay || false,
        fontFamily: subtitleSettings.fontFamily,
        fontColor: subtitleSettings.fontColor,
        fontSize: subtitleSettings.fontSize,
        strokeWidth: subtitleSettings.strokeWidth,
        fontWeight: subtitleSettings.fontWeight,
        textTransform: subtitleSettings.textTransform,
        audioDuration: audioGeneration?.duration ?? undefined,
        // New video mode options
        videoMode: settings.videoMode,
        zoomEffect: settings.zoomEffect || false,
        dustOverlay: settings.dustOverlay || false,
        // Option 2 specific
        introImages: settings.videoMode === 'option2' ? introImages : undefined,
        introDuration: settings.videoMode === 'option2' ? settings.introDuration : undefined,
        loopImageUrl: settings.videoMode === 'option2' ? loopImageUrl : undefined,
        useEqualIntroDuration: settings.videoMode === 'option2' ? settings.useEqualIntroDuration : undefined
      }

      console.log('🎬 Starting video generation with:', requestBody)
      showMessage(`Starting ${videoType} video generation...`, 'info')

      // Call video creation API
      const response = await fetch('/api/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.video_id) {
        // Show immediate success feedback about Shotstack accepting the job
        showMessage(`🎬 Video rendering started! Shotstack is processing your ${videoType} video...`, 'success')
        
        // Create video record for Redux state
        const videoRecord: VideoRecord = {
          id: data.video_id,
          user_id: userId || 'current_user',
          status: 'processing',
          shotstack_id: data.shotstack_id || '',
          image_urls: orderedImageUrls,
          audio_url: requestBody.audioUrl,
          subtitles_url: requestBody.subtitlesUrl,
          thumbnail_url: orderedImageUrls[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            type: videoType,
            video_mode: settings.videoMode,
            intro_images: settings.videoMode === 'option2' ? introImages : undefined,
            loop_image: settings.videoMode === 'option2' ? loopImageUrl : undefined,
            segment_timings: segmentTimings,
            total_duration: segmentTimings ? 
              segmentTimings.reduce((sum, timing) => sum + timing.duration, 0) : 
              audioGeneration?.duration || 30,
            scenes_count: orderedImageUrls.length
          }
        }

        dispatch(startVideoGeneration(videoRecord))
        dispatch(saveVideoToHistory(videoRecord))
        
        // Reset generating state since the request was successful
        dispatch(setIsGeneratingVideo(false))

        // Additional detailed message after a short delay
        setTimeout(() => {
          const shotstackInfo = data.shotstack_id ? ` | Shotstack Job: ${data.shotstack_id}` : ''
          showMessage(
            `Video ID: ${data.video_id}${shotstackInfo} | Processing typically takes 2-5 minutes. You'll be notified when complete.`,
            'info'
          )
        }, 2000)
        
      } else {
        throw new Error('No video ID returned from API')
      }

    } catch (error: any) {
      console.error('Video generation error:', error)
      dispatch(setVideoGenerationError({ 
        videoId: currentGeneration?.id || 'unknown',
        error: error.message 
      }))
      dispatch(setIsGeneratingVideo(false))
      showMessage(`Video generation failed: ${error.message}`, 'error')
    }
  }

  // Download video
  const handleDownloadVideo = (videoUrl: string, filename: string = 'generated-video.mp4') => {
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Settings change handler
  const handleSettingsChange = (newSettings: any) => {
    dispatch(setVideoSettings(newSettings))
  }

  // Calculate total duration for segmented timing
  const totalSegmentDuration = customSegmentTimings.reduce((sum, timing) => sum + timing.duration, 0)

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Video Generator</h1>
        <p className="text-gray-600">
          Create professional videos from your selected images and audio using Shotstack with dynamic slide effects, zoom animations, and advanced timing options
        </p>
      </div>

      {/* Prerequisites Check */}
      <VideoPrerequisites
        hasGeneratedImages={hasGeneratedImages}
        imageSetsCount={selectedImagesOrder.length}
        audioGeneration={audioGeneration}
      />

      {/* Video Settings */}
      <VideoSettings
        settings={settings}
        onSettingsChange={handleSettingsChange}
        hasPrerequisites={hasPrerequisites as boolean}
        selectedImagesCount={selectedImagesOrder.length}
        audioGeneration={audioGeneration}
        isGeneratingVideo={isGeneratingVideo}
        onGenerateVideo={handleGenerateVideo}
        customSegmentTimings={customSegmentTimings}
        onUpdateSegmentTiming={updateSegmentTiming}
        onDistributeEquallyAcrossSegments={distributeEquallyAcrossSegments}
        totalSegmentDuration={totalSegmentDuration}
        subtitleSettings={subtitleSettings}
        onSubtitleSettingsChange={setSubtitleSettings}
        getOrderedImageUrls={getOrderedImageUrls}
        imageSets={imageSets}
        selectedImagesOrder={selectedImagesOrder}
        introImages={introImages}
        onIntroImagesChange={setIntroImages}
        selectedLoopImageId={selectedLoopImageId}
        onSelectedLoopImageIdChange={setSelectedLoopImageId}
      />

      {/* Current Generation Status */}
      <VideoGenerationStatus
        currentGeneration={currentGeneration}
        onDownloadVideo={handleDownloadVideo}
      />

      {/* Status Message */}
      <VideoStatusMessage
        message={message}
        messageType={messageType}
      />

      {/* Empty State */}
      <VideoEmptyState
        hasPrerequisites={hasPrerequisites as boolean}
        hasGeneratedImages={hasGeneratedImages}
        audioGeneration={audioGeneration}
      />
    </div>
  )
} 