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
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { VideoIcon, Download, PlayCircle, CheckCircle, AlertCircle, Loader2, FileText, Clock, Image as ImageIcon, Volume2, Subtitles, Settings } from 'lucide-react'
import { CreateVideoRequestBody, VideoRecord, SegmentTiming } from '@/types/video-generation'

export function VideoGenerator() {
  const dispatch = useAppDispatch()
  const { originalImages } = useAppSelector(state => state.images)
  const { scripts } = useAppSelector(state => state.scripts)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { 
    currentGeneration, 
    isGeneratingVideo,
    settings
  } = useAppSelector(state => state.video)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [customSegmentTimings, setCustomSegmentTimings] = useState<SegmentTiming[]>([])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Initialize custom segment timings when images or audio change
  useEffect(() => {
    if (originalImages.length > 0 && audioGeneration?.audioUrl) {
      if (audioGeneration.duration) {
        // Use actual duration if available
        const equalDuration = audioGeneration.duration / originalImages.length
        const timings = originalImages.map(() => ({ duration: equalDuration }))
        setCustomSegmentTimings(timings)
      } else {
        // Fallback to default timing if duration is missing
        console.warn('🎵 Audio duration not available, using default 3s per image')
        const defaultDuration = 3 // 3 seconds per image as fallback
        const timings = originalImages.map(() => ({ duration: defaultDuration }))
        setCustomSegmentTimings(timings)
      }
    }
  }, [originalImages.length, audioGeneration?.audioUrl, audioGeneration?.duration])

  // Debug logging for audio generation state
  useEffect(() => {
    console.log('🎵 Audio generation state:', audioGeneration)
    if (audioGeneration) {
      console.log('🎵 Audio URL:', audioGeneration.audioUrl)
      console.log('🎵 Audio duration:', audioGeneration.duration)
      console.log('🎵 Audio status:', audioGeneration.status)
    }
  }, [audioGeneration])

  // Get image URLs from Supabase storage
  const getImageUrls = () => {
    const urls = []
    
    for (const img of originalImages) {
      // Only use images that have been uploaded to Supabase
      if (img.supabasePath && img.savedToSupabase) {
        // Convert Supabase path to public URL - bucket name is 'images'
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${img.supabasePath}`
        urls.push(url)
      } else {
        // Image hasn't been uploaded to Supabase - this would cause base64 in payload
        console.warn(`Image ${img.name} hasn't been uploaded to Supabase storage yet`)
      }
    }
    
    return urls
  }

  // Check if all images are uploaded to Supabase
  const allImagesUploaded = originalImages.length > 0 && originalImages.every(img => img.supabasePath && img.savedToSupabase)

  // Check if we have all prerequisites for video generation
  const hasPrerequisites = originalImages.length > 0 && audioGeneration?.audioUrl && allImagesUploaded

  // Update segment timing duration
  const updateSegmentTiming = (index: number, duration: number) => {
    const updatedTimings = [...customSegmentTimings]
    updatedTimings[index] = { duration }
    setCustomSegmentTimings(updatedTimings)
  }

  // Distribute total duration equally across all segments
  const distributeEquallyAcrossSegments = async () => {
    if (originalImages.length === 0) {
      showMessage('No images available for timing distribution', 'error')
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
    
    const equalDuration = duration / originalImages.length
    const equalTimings = originalImages.map(() => ({ duration: equalDuration }))
    setCustomSegmentTimings(equalTimings)
    showMessage(`Distributed ${duration.toFixed(1)}s equally across ${originalImages.length} images`, 'success')
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
    if (!audioGeneration?.scriptDurations || !originalImages.length) {
      return []
    }

    // Map images to their corresponding script durations
    const timings: SegmentTiming[] = []
    
    originalImages.forEach((image, index) => {
      const scriptDuration = audioGeneration.scriptDurations?.find(sd => sd.imageId === image.id)
      if (scriptDuration) {
        timings.push({ duration: scriptDuration.duration })
      } else {
        // Fallback to equal timing if no script duration found
        const fallbackDuration = audioGeneration.duration ? audioGeneration.duration / originalImages.length : 3
        timings.push({ duration: fallbackDuration })
        console.warn(`No script duration found for image ${image.id}, using fallback: ${fallbackDuration}s`)
      }
    })

    return timings
  }

  // Check if script-based timing is available
  const scriptBasedTimingAvailable = audioGeneration?.scriptDurations && audioGeneration.scriptDurations.length > 0

  // Handle video generation
  const handleGenerateVideo = async () => {
    if (!hasPrerequisites) {
      showMessage('Please ensure you have processed images and generated audio first', 'error')
      return
    }

    if (!audioGeneration?.audioUrl) {
      showMessage('Audio generation required before creating video', 'error')
      return
    }

    if (!allImagesUploaded) {
      showMessage('All images must be uploaded to Supabase storage before creating video', 'error')
      return
    }

    try {
      dispatch(setIsGeneratingVideo(true))

      const imageUrls = getImageUrls()
      
      // Additional validation to ensure we have URLs
      if (imageUrls.length === 0) {
        throw new Error('No valid image URLs available. Please upload images to Supabase storage.')
      }

      if (imageUrls.length !== originalImages.length) {
        throw new Error(`Only ${imageUrls.length} of ${originalImages.length} images are uploaded to Supabase. Please upload all images first.`)
      }
      
      // Determine which timing mode to use and prepare segment timings
      let segmentTimings: SegmentTiming[] | undefined = undefined
      let videoType: 'traditional' | 'segmented' | 'script-based' = 'traditional'

      if (settings.useSegmentedTiming) {
        // Custom segmented timing (manual user input)
        segmentTimings = customSegmentTimings
        videoType = 'segmented'
      } else if (settings.useScriptBasedTiming && scriptBasedTimingAvailable) {
        // Script-based timing (automatic from audio generation)
        segmentTimings = getScriptBasedTimings()
        videoType = 'script-based'
      }
      // Otherwise, use traditional equal timing (no segmentTimings)

      // Prepare request body
      const requestBody: CreateVideoRequestBody = {
        imageUrls: imageUrls,
        audioUrl: audioGeneration.audioUrl,
        subtitlesUrl: settings.includeSubtitles && audioGeneration.subtitlesUrl ? audioGeneration.subtitlesUrl : undefined,
        userId: 'current_user',
        thumbnailUrl: imageUrls[0],
        segmentTimings: segmentTimings
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
          user_id: 'current_user',
          status: 'processing',
          shotstack_id: data.shotstack_id || '',
          image_urls: imageUrls,
          audio_url: audioGeneration.audioUrl,
          subtitles_url: settings.includeSubtitles && audioGeneration.subtitlesUrl ? audioGeneration.subtitlesUrl : undefined,
          thumbnail_url: imageUrls[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: segmentTimings ? {
            type: videoType,
            segment_timings: segmentTimings,
            total_duration: segmentTimings.reduce((sum, timing) => sum + timing.duration, 0),
            scenes_count: originalImages.length
          } : {
            type: 'traditional',
            scenes_count: originalImages.length,
            total_duration: audioGeneration.duration || 0
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
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate total duration for segmented timing
  const totalSegmentDuration = customSegmentTimings.reduce((sum, timing) => sum + timing.duration, 0)

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Video Generator</h1>
        <p className="text-gray-600">
          Create professional videos from your images and audio using Shotstack with dynamic slide effects
        </p>
      </div>

      {/* Prerequisites Check */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Prerequisites Status
          </CardTitle>
          <CardDescription>
            Ensure all required components are ready for video generation
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Images Status */}
          <div className={`p-3 rounded-lg border ${
            originalImages.length > 0 && allImagesUploaded 
              ? 'border-green-200 bg-green-50' 
              : originalImages.length > 0 
                ? 'border-orange-200 bg-orange-50'
                : 'border-orange-200 bg-orange-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className={`h-4 w-4 ${
                originalImages.length > 0 && allImagesUploaded 
                  ? 'text-green-600' 
                  : 'text-orange-600'
              }`} />
              <span className="font-medium">Images</span>
            </div>
            <p className="text-sm text-gray-600">
              {originalImages.length} images processed
              {originalImages.length > 0 && (
                <span className="block">
                  {originalImages.filter(img => img.savedToSupabase).length} uploaded to Supabase
                </span>
              )}
            </p>
            {originalImages.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">Process images first</p>
            )}
            {originalImages.length > 0 && !allImagesUploaded && (
              <p className="text-xs text-orange-600 mt-1">
                Upload all images to Supabase storage first
              </p>
            )}
          </div>

          {/* Audio Status */}
          <div className={`p-3 rounded-lg border ${audioGeneration?.audioUrl ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className={`h-4 w-4 ${audioGeneration?.audioUrl ? 'text-green-600' : 'text-orange-600'}`} />
              <span className="font-medium">Audio</span>
            </div>
            <p className="text-sm text-gray-600">
              {audioGeneration?.audioUrl ? (
                audioGeneration.duration ? 
                  `${audioGeneration.duration.toFixed(1)}s audio ready` : 
                  'Audio ready (duration unknown)'
              ) : 'No audio generated'}
            </p>
            {!audioGeneration?.audioUrl && (
              <p className="text-xs text-orange-600 mt-1">Generate audio first</p>
            )}
            {audioGeneration?.audioUrl && !audioGeneration.duration && (
              <p className="text-xs text-orange-600 mt-1">Duration missing - may need to regenerate audio</p>
            )}
          </div>

          {/* Subtitles Status */}
          <div className={`p-3 rounded-lg border ${audioGeneration?.subtitlesUrl ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Subtitles className={`h-4 w-4 ${audioGeneration?.subtitlesUrl ? 'text-green-600' : 'text-gray-400'}`} />
              <span className="font-medium">Subtitles</span>
            </div>
            <p className="text-sm text-gray-600">
              {audioGeneration?.subtitlesUrl ? 'Subtitles available' : 'Optional subtitles'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Video Settings */}
      {hasPrerequisites && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Video Generation Settings
            </CardTitle>
            <CardDescription>
              Configure timing, quality, and subtitle options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Video Quality</Label>
                <Select 
                  value={settings.videoQuality} 
                  onValueChange={(value: 'hd' | 'sd') => dispatch(setVideoSettings({ videoQuality: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hd">HD (1280x720)</SelectItem>
                    <SelectItem value="sd">SD (854x480)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Timing Mode</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="segmented-timing"
                      checked={settings.useSegmentedTiming}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          dispatch(setVideoSettings({ useSegmentedTiming: true, useScriptBasedTiming: false }))
                        } else {
                          dispatch(setVideoSettings({ useSegmentedTiming: false }))
                        }
                      }}
                    />
                    <Label htmlFor="segmented-timing" className="text-sm">Custom segment timing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="script-based-timing"
                      checked={settings.useScriptBasedTiming}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          dispatch(setVideoSettings({ useScriptBasedTiming: true, useSegmentedTiming: false }))
                        } else {
                          dispatch(setVideoSettings({ useScriptBasedTiming: false }))
                        }
                      }}
                      disabled={!scriptBasedTimingAvailable}
                    />
                    <Label htmlFor="script-based-timing" className="text-sm">
                      Script-based timing {!scriptBasedTimingAvailable && '(not available)'}
                    </Label>
                  </div>
                  {!scriptBasedTimingAvailable && (
                    <p className="text-xs text-gray-500 ml-6">
                      Script-based timing requires audio generation with individual script durations
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Subtitles</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-subtitles"
                    checked={settings.includeSubtitles}
                    onCheckedChange={(checked) => dispatch(setVideoSettings({ includeSubtitles: checked as boolean }))}
                    disabled={!audioGeneration?.subtitlesUrl}
                  />
                  <Label htmlFor="include-subtitles" className="text-sm">
                    Include subtitles {!audioGeneration?.subtitlesUrl && '(not available)'}
                  </Label>
                </div>
              </div>
            </div>

            {/* Segment Timing Configuration */}
            {settings.useSegmentedTiming && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Custom Segment Timing</h4>
                    <p className="text-sm text-gray-600">
                      Adjust how long each image appears in the video
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Total: {totalSegmentDuration.toFixed(1)}s
                    </div>
                    {audioGeneration?.duration && (
                      <div className={`text-xs ${
                        Math.abs(totalSegmentDuration - audioGeneration.duration) < 0.5 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        Audio: {audioGeneration.duration.toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={distributeEquallyAcrossSegments}
                  size="sm"
                  variant="outline"
                  disabled={!audioGeneration?.audioUrl}
                >
                  Distribute Equally
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {originalImages.map((image, index) => (
                    <div key={image.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={image.dataUrl}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Image {index + 1}</div>
                        <Input
                          type="number"
                          value={customSegmentTimings[index]?.duration.toFixed(1) || '0.0'}
                          onChange={(e) => updateSegmentTiming(index, parseFloat(e.target.value) || 0)}
                          className="h-6 text-xs"
                          step="0.1"
                          min="0.1"
                        />
                        <div className="text-xs text-gray-400">seconds</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Script-Based Timing Preview */}
            {settings.useScriptBasedTiming && scriptBasedTimingAvailable && (
              <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Script-Based Timing Preview</h4>
                    <p className="text-sm text-gray-600">
                      Each image will show for the duration of its script's audio
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Total: {getScriptBasedTimings().reduce((sum, timing) => sum + timing.duration, 0).toFixed(1)}s
                    </div>
                    <div className="text-xs text-green-600">
                      Matches audio duration
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {originalImages.map((image, index) => {
                    const scriptDuration = audioGeneration?.scriptDurations?.find(sd => sd.imageId === image.id)
                    return (
                      <div key={image.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                          <img
                            src={image.dataUrl}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">{scriptDuration?.imageName || `Image ${index + 1}`}</div>
                          <div className="text-sm font-medium">
                            {scriptDuration ? `${scriptDuration.duration.toFixed(1)}s` : 'No timing'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {scriptDuration ? `Starts at ${scriptDuration.startTime.toFixed(1)}s` : 'Missing script'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !hasPrerequisites}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <VideoIcon className="h-4 w-4 mr-2" />
                  Generate Video ({
                    settings.useSegmentedTiming ? 'Custom Timing' :
                    settings.useScriptBasedTiming && scriptBasedTimingAvailable ? 'Script-Based' :
                    'Traditional'
                  })
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Generation Status */}
      {currentGeneration && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoIcon className="h-5 w-5" />
              Current Video Generation
            </CardTitle>
            <CardDescription>
              Generated on {new Date(currentGeneration.created_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generation Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <p className="font-medium">{currentGeneration.metadata?.type || 'traditional'}</p>
              </div>
              <div>
                <span className="text-gray-500">Images:</span>
                <p className="font-medium">{currentGeneration.image_urls.length}</p>
              </div>
              <div>
                <span className="text-gray-500">Duration:</span>
                <p className="font-medium">
                  {currentGeneration.metadata?.total_duration?.toFixed(1) || 'Unknown'}s
                </p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <Badge 
                  variant={currentGeneration.status === 'completed' ? 'default' : 'secondary'}
                  className={
                    currentGeneration.status === 'completed' ? 'bg-green-100 text-green-800' :
                    currentGeneration.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }
                >
                  {currentGeneration.status}
                </Badge>
              </div>
            </div>

            {/* Processing Status */}
            {currentGeneration.status === 'processing' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="font-medium text-blue-800">Video is being processed by Shotstack</span>
                </div>
                <p className="text-sm text-blue-700">
                  This may take several minutes depending on video length and complexity. The page will update automatically when complete.
                </p>
              </div>
            )}

            {/* Completed Video */}
            {currentGeneration.status === 'completed' && currentGeneration.final_video_url && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Video Generated Successfully!</span>
                </div>
                <video controls className="w-full mb-3 rounded">
                  <source src={currentGeneration.final_video_url} type="video/mp4" />
                  Your browser does not support the video element.
                </video>
                <Button
                  onClick={() => handleDownloadVideo(currentGeneration.final_video_url!, `video-${currentGeneration.id}.mp4`)}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Video
                </Button>
              </div>
            )}

            {/* Error */}
            {currentGeneration.status === 'failed' && currentGeneration.error_message && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Generation Error:</span>
                </div>
                <p className="text-red-700 mt-1">{currentGeneration.error_message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Message */}
      {message && (
        <Card className={`border ${
          messageType === 'success' ? 'border-green-200 bg-green-50' :
          messageType === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {messageType === 'info' && <VideoIcon className="h-4 w-4 text-blue-600" />}
              <span className={`text-sm ${
                messageType === 'success' ? 'text-green-800' :
                messageType === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasPrerequisites && (
        <Card className="bg-gray-50 border border-gray-200">
          <CardContent className="pt-6 text-center py-12">
            <VideoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Create Videos</h3>
            <p className="text-gray-600 mb-4">
              Complete the prerequisite steps to generate professional videos
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              {originalImages.length === 0 && <div>1. Process images</div>}
              {!audioGeneration?.audioUrl && <div>2. Generate audio from scripts</div>}
              <div>3. Configure video settings and generate</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 