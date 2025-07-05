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
import { VideoIcon, Download, PlayCircle, CheckCircle, AlertCircle, Loader2, FileText, Clock, Image as ImageIcon, Volume2, Subtitles, Settings, Music, Palette, VolumeX } from 'lucide-react'
import { CreateVideoRequestBody, VideoRecord, SegmentTiming } from '@/types/video-generation'

// Load Google Fonts for preview
const loadGoogleFonts = () => {
  if (typeof document !== 'undefined') {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&family=Roboto:wght@400;700&family=Open+Sans:wght@700&family=Work+Sans:wght@300&family=Didact+Gothic&family=Permanent+Marker&display=swap'
    link.rel = 'stylesheet'
    if (!document.querySelector(`link[href="${link.href}"]`)) {
      document.head.appendChild(link)
    }
  }
}

// Map our font names to CSS font families (with fallbacks)
const getFontFamily = (fontName: string): string => {
  const fontMap: Record<string, string> = {
    'Arapey Regular': '"Times New Roman", Times, serif', // Fallback to serif
    'Clear Sans': '"Helvetica Neue", Helvetica, Arial, sans-serif', // Fallback to clean sans-serif
    'Didact Gothic': '"Didact Gothic", "Arial", sans-serif',
    'Montserrat ExtraBold': '"Montserrat", Arial, sans-serif',
    'Montserrat SemiBold': '"Montserrat", Arial, sans-serif', 
    'OpenSans Bold': '"Open Sans", Arial, sans-serif',
    'Permanent Marker': '"Permanent Marker", "Comic Sans MS", cursive',
    'Roboto': '"Roboto", Arial, sans-serif',
    'Sue Ellen Francisco': '"Brush Script MT", cursive', // Handwriting-style fallback
    'UniNeue': '"Helvetica Neue", Helvetica, Arial, sans-serif', // Clean modern fallback
    'WorkSans Light': '"Work Sans", Arial, sans-serif'
  }
  
  return fontMap[fontName] || '"Arial", sans-serif'
}

// Get appropriate font weight for preview
const getFontWeight = (fontName: string): string => {
  const weightMap: Record<string, string> = {
    'Arapey Regular': '400',
    'Clear Sans': '400',
    'Didact Gothic': '400',
    'Montserrat ExtraBold': '800',
    'Montserrat SemiBold': '600', 
    'OpenSans Bold': '700',
    'Permanent Marker': '400',
    'Roboto': '400',
    'Sue Ellen Francisco': '400',
    'UniNeue': '400',
    'WorkSans Light': '300'
  }
  
  return weightMap[fontName] || '400'
}

export function VideoGenerator() {
  const dispatch = useAppDispatch()
  const { originalImages } = useAppSelector(state => state.images)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { selectedMusicTrack, uploadedMusicTracks } = useAppSelector(state => state.audio)
  const { 
    currentGeneration, 
    isGeneratingVideo,
    settings
  } = useAppSelector(state => state.video)
  const { id: userId } = useAppSelector(state => state.user)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [customSegmentTimings, setCustomSegmentTimings] = useState<SegmentTiming[]>([])
  
  // Subtitle styling state
  const [subtitleSettings, setSubtitleSettings] = useState({
    fontFamily: 'Montserrat ExtraBold',
    fontSize: 24,
    fontColor: '#ffffff',
    fontWeight: '700',
    textTransform: 'uppercase' as 'none' | 'uppercase',
    strokeWidth: 2,
    // Positioning settings (margins as percentages 0-1)
    marginTop: 0.75,    // 75% from top (bottom placement)
    marginLeft: 0.05,   // 5% from left (slight padding)
    marginRight: 0.05,  // 5% from right (slight padding)
    position: 'bottom' as 'top' | 'center' | 'bottom'
  })

  // Font family options
  const fontFamilyOptions = [
    { value: 'Arapey Regular', label: 'Arapey Regular' },
    { value: 'Clear Sans', label: 'Clear Sans' },
    { value: 'Didact Gothic', label: 'Didact Gothic' },
    { value: 'Montserrat ExtraBold', label: 'Montserrat ExtraBold' },
    { value: 'Montserrat SemiBold', label: 'Montserrat SemiBold' },
    { value: 'OpenSans Bold', label: 'OpenSans Bold' },
    { value: 'Permanent Marker', label: 'Permanent Marker' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Sue Ellen Francisco', label: 'Sue Ellen Francisco' },
    { value: 'UniNeue', label: 'UniNeue' },
    { value: 'WorkSans Light', label: 'WorkSans Light' }
  ]

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Load fonts when component mounts
  useEffect(() => {
    loadGoogleFonts()
  }, [])

  // Handle subtitle position presets
  const handleSubtitlePositionChange = (position: string) => {
    let marginSettings = { marginTop: 0.75, marginLeft: 0.05, marginRight: 0.05 }
    
    switch (position) {
      case 'bottom':
        marginSettings = { marginTop: 0.75, marginLeft: 0.05, marginRight: 0.05 }
        break
      case 'top':
        marginSettings = { marginTop: 0.05, marginLeft: 0.05, marginRight: 0.05 }
        break
      case 'center':
        marginSettings = { marginTop: 0.4, marginLeft: 0.05, marginRight: 0.05 }
        break
    }
    
    setSubtitleSettings(prev => ({ 
      ...prev, 
      position: position as any,
      ...marginSettings
    }))
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
        // supabasePath contains the complete public URL ready for use
        const url = img.supabasePath
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

  // Helper function to clean music URLs
  const cleanMusicUrl = (url: string): string => {
    // Remove query parameters
    const cleanUrl = url.split('?')[0]
    
    // If it doesn't end with .mp3, add it
    if (!cleanUrl.endsWith('.mp3')) {
      return cleanUrl + '.mp3'
    }
    
    return cleanUrl
  }

  // Get available music URL from audio generator
  const getAvailableMusicUrl = (): string | null => {
    // Priority: selected uploaded tracks first, then selected track from search
    const selectedUploadedTrack = uploadedMusicTracks.find(track => track.isSelected)
    if (selectedUploadedTrack) {
      return cleanMusicUrl(selectedUploadedTrack.url)
    }
    if (selectedMusicTrack?.preview_url) {
      return cleanMusicUrl(selectedMusicTrack.preview_url)
    }
    return null
  }

  // Check if music is available
  const musicAvailable = getAvailableMusicUrl() !== null
  const selectedUploadedTrack = uploadedMusicTracks.find(track => track.isSelected)
  const musicSource = selectedUploadedTrack ? selectedUploadedTrack.name : selectedMusicTrack?.title || 'No music selected'

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
      
      // Debug: Log the image URLs being sent to Shotstack
      console.log('🖼️ Image URLs being sent to Shotstack:', imageUrls)
      imageUrls.forEach((url, index) => {
        console.log(`   Image ${index + 1}: ${url}`)
      })

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
        mediaTypes: originalImages.map(img => img.mediaType || 'image'),
        audioUrl: audioGeneration.audioUrl,
        audioDuration: audioGeneration.duration || undefined,
        subtitlesUrl: settings.includeSubtitles && audioGeneration.subtitlesUrl ? audioGeneration.subtitlesUrl : undefined,
        thumbnailUrl: imageUrls[0],
        segmentTimings: segmentTimings,
        musicUrl: settings.includeMusic ? getAvailableMusicUrl() || undefined : undefined,
        musicVolume: settings.includeMusic ? settings.musicVolume : undefined,
        muteStockVideo: settings.muteStockVideo,
        // Include subtitle styling settings when subtitles are enabled
        ...(settings.includeSubtitles && audioGeneration.subtitlesUrl && {
          fontFamily: subtitleSettings.fontFamily,
          fontSize: subtitleSettings.fontSize,
          fontColor: subtitleSettings.fontColor,
          fontWeight: subtitleSettings.fontWeight,
          strokeWidth: subtitleSettings.strokeWidth,
          textTransform: subtitleSettings.textTransform,
          marginTop: subtitleSettings.marginTop,
          marginLeft: subtitleSettings.marginLeft,
          marginRight: subtitleSettings.marginRight
        })
      }

      console.log('🎬 Starting video generation with:', requestBody)
      const musicInfo = settings.includeMusic ? ` with ${musicSource}` : ''
      showMessage(`Starting ${videoType} video generation${musicInfo}...`, 'info')

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
        const musicInfo = settings.includeMusic ? ` with ${musicSource}` : ''
        showMessage(`🎬 Video rendering started! Shotstack is processing your ${videoType} video${musicInfo}...`, 'success')
        
        // Create video record for Redux state
        const videoRecord: VideoRecord = {
          id: data.video_id,
          user_id: userId || 'anonymous',
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
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Video Generation Settings
          </CardTitle>
          <CardDescription>
            Configure timing, quality, and subtitle options
            {!hasPrerequisites && (
              <span className="block text-orange-600 mt-1">
                Complete prerequisites above to enable video generation
              </span>
            )}
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
                disabled={!hasPrerequisites}
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
                    disabled={!hasPrerequisites}
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
                    disabled={!hasPrerequisites || !scriptBasedTimingAvailable}
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
                  disabled={!hasPrerequisites || !audioGeneration?.subtitlesUrl}
                />
                <Label htmlFor="include-subtitles" className="text-sm">
                  Include subtitles {!audioGeneration?.subtitlesUrl && '(not available)'}
                </Label>
              </div>
            </div>

            {/* Subtitle Styling Controls */}
            {settings.includeSubtitles && audioGeneration?.subtitlesUrl && (
              <div className="col-span-full space-y-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Subtitle Styling</h4>
                </div>
                
                {/* First row - Font settings */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Font Family */}
                  <div className="space-y-2">
                    <Label className="text-sm">Font Family</Label>
                    <Select 
                      value={subtitleSettings.fontFamily} 
                      onValueChange={(value) => setSubtitleSettings(prev => ({ ...prev, fontFamily: value }))}
                      disabled={!hasPrerequisites}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontFamilyOptions.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font Weight */}
                  <div className="space-y-2">
                    <Label className="text-sm">Font Weight</Label>
                    <Select 
                      value={subtitleSettings.fontWeight} 
                      onValueChange={(value) => setSubtitleSettings(prev => ({ ...prev, fontWeight: value }))}
                      disabled={!hasPrerequisites}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal (400)</SelectItem>
                        <SelectItem value="500">Medium (500)</SelectItem>
                        <SelectItem value="600">Semi Bold (600)</SelectItem>
                        <SelectItem value="700">Bold (700)</SelectItem>
                        <SelectItem value="800">Extra Bold (800)</SelectItem>
                        <SelectItem value="900">Black (900)</SelectItem>
                        <SelectItem value="1000">Ultra Black (1000)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text Transform */}
                  <div className="space-y-2">
                    <Label className="text-sm">Text Style</Label>
                    <Select 
                      value={subtitleSettings.textTransform} 
                      onValueChange={(value) => setSubtitleSettings(prev => ({ ...prev, textTransform: value as 'none' | 'uppercase' }))}
                      disabled={!hasPrerequisites}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Normal</SelectItem>
                        <SelectItem value="uppercase">UPPERCASE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font Color */}
                  <div className="space-y-2">
                    <Label className="text-sm">Font Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={subtitleSettings.fontColor}
                        onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontColor: e.target.value }))}
                        className="w-12 h-8 p-0 border rounded cursor-pointer"
                        disabled={!hasPrerequisites}
                      />
                      <Input
                        type="text"
                        value={subtitleSettings.fontColor}
                        onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontColor: e.target.value }))}
                        placeholder="#ffffff"
                        className="flex-1 h-8 text-xs"
                        disabled={!hasPrerequisites}
                      />
                    </div>
                  </div>
                </div>

                {/* Second row - Size and stroke settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Font Size */}
                  <div className="space-y-3">
                    <Label className="text-sm">Font Size: {subtitleSettings.fontSize}px</Label>
                    <input
                      type="range"
                      min="12"
                      max="60"
                      step="2"
                      value={subtitleSettings.fontSize}
                      onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      disabled={!hasPrerequisites}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>12px</span>
                      <span>60px</span>
                    </div>
                  </div>

                  {/* Stroke Width */}
                  <div className="space-y-3">
                    <Label className="text-sm">Stroke Outline: {subtitleSettings.strokeWidth}px</Label>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={subtitleSettings.strokeWidth}
                      onChange={(e) => setSubtitleSettings(prev => ({ ...prev, strokeWidth: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      disabled={!hasPrerequisites}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0px</span>
                      <span>8px</span>
                    </div>
                  </div>
                </div>

                {/* Third row - Positioning controls */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Subtitle Position</span>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Position Presets */}
                    <div className="space-y-2">
                      <Label className="text-sm">Position Preset</Label>
                      <Select 
                        value={subtitleSettings.position} 
                        onValueChange={handleSubtitlePositionChange}
                        disabled={!hasPrerequisites}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Visual Position Preview */}
                    <div className="space-y-2">
                      <Label className="text-sm">Position Preview</Label>
                      <div className="w-full h-16 bg-gray-300 rounded relative overflow-hidden">
                        <div 
                          className="absolute bg-blue-500 text-white text-xs px-2 py-1 rounded"
                          style={{
                            top: `${subtitleSettings.marginTop * 100}%`,
                            left: `${subtitleSettings.marginLeft * 100}%`,
                            right: `${subtitleSettings.marginRight * 100}%`,
                            transform: 'translateY(-50%)'
                          }}
                        >
                          Subtitle
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="p-4 bg-gray-200 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-2">Subtitle Preview:</p>
                    <div 
                      style={{
                        fontFamily: getFontFamily(subtitleSettings.fontFamily),
                        color: subtitleSettings.fontColor,
                        fontSize: `${Math.min(subtitleSettings.fontSize * 0.7, 24)}px`, // Scale down for preview
                        textShadow: subtitleSettings.strokeWidth > 0 
                          ? `${subtitleSettings.strokeWidth * 0.7}px ${subtitleSettings.strokeWidth * 0.7}px 0px #000000, -${subtitleSettings.strokeWidth * 0.7}px -${subtitleSettings.strokeWidth * 0.7}px 0px #000000, ${subtitleSettings.strokeWidth * 0.7}px -${subtitleSettings.strokeWidth * 0.7}px 0px #000000, -${subtitleSettings.strokeWidth * 0.7}px ${subtitleSettings.strokeWidth * 0.7}px 0px #000000`
                          : 'none',
                        fontWeight: getFontWeight(subtitleSettings.fontFamily),
                        textTransform: subtitleSettings.textTransform as any
                      }}
                    >
                      {subtitleSettings.textTransform === 'uppercase' 
                        ? 'SAMPLE SUBTITLE TEXT APPEARS HERE'
                        : 'Sample subtitle text appears here'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Background Music</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-music"
                    checked={settings.includeMusic}
                    onCheckedChange={(checked) => dispatch(setVideoSettings({ includeMusic: checked as boolean }))}
                    disabled={!hasPrerequisites || !musicAvailable}
                  />
                  <Label htmlFor="include-music" className="text-sm">
                    Add background music {!musicAvailable && '(no music available)'}
                  </Label>
                </div>
                
                {/* Music Status */}
                <div className={`ml-6 p-2 text-xs rounded ${
                  musicAvailable 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  {musicAvailable ? (
                    <div className="flex items-center gap-2">
                      <Music className="h-3 w-3" />
                      <span>Music ready: {musicSource}</span>
                    </div>
                  ) : (
                    <div>
                      <span>No music selected. Go to Audio Generator to search or upload music.</span>
                    </div>
                  )}
                </div>
                
                {settings.includeMusic && musicAvailable && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <Label htmlFor="music-volume" className="text-xs">
                        Music Volume: {Math.round(settings.musicVolume * 100)}%
                      </Label>
                      <Input
                        id="music-volume"
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={settings.musicVolume}
                        onChange={(e) => dispatch(setVideoSettings({ musicVolume: parseFloat(e.target.value) }))}
                        className="mt-1"
                        disabled={!hasPrerequisites}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>5%</span>
                        <span>30%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Stock Video Audio</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mute-stock-video"
                    checked={settings.muteStockVideo}
                    onCheckedChange={(checked) => dispatch(setVideoSettings({ muteStockVideo: checked as boolean }))}
                    disabled={!hasPrerequisites}
                  />
                  <Label htmlFor="mute-stock-video" className="text-sm">
                    Mute stock video footage
                  </Label>
                </div>
                
                {/* Stock Video Audio Status */}
                <div className={`ml-6 p-2 text-xs rounded ${
                  settings.muteStockVideo 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {settings.muteStockVideo ? (
                      <>
                        <VolumeX className="h-3 w-3" />
                        <span>Stock video audio will be muted (recommended for narration)</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span>Stock video audio will be preserved (may interfere with narration)</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="ml-6 text-xs text-gray-600">
                  <p>This option affects videos from Pexels, Pixabay, and other stock footage sources. 
                  When enabled, the original audio from stock videos will be muted to prevent interference with your narration.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Prerequisites Warning */}
          {!hasPrerequisites && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Prerequisites Required</span>
              </div>
              <div className="text-sm text-orange-700 space-y-1">
                {originalImages.length === 0 && <div>• Process images first</div>}
                {originalImages.length > 0 && !allImagesUploaded && (
                  <div>• Upload all images to Supabase storage (currently {originalImages.filter(img => img.savedToSupabase).length}/{originalImages.length} uploaded)</div>
                )}
                {!audioGeneration?.audioUrl && <div>• Generate audio from scripts</div>}
              </div>
            </div>
          )}

          {/* Segment Timing Configuration */}
          {settings.useSegmentedTiming && (
            <div className={`space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg ${!hasPrerequisites ? 'opacity-60' : ''}`}>
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
                disabled={!hasPrerequisites || !audioGeneration?.audioUrl}
              >
                Distribute Equally
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {originalImages.length > 0 ? originalImages.map((image, index) => (
                  <div key={`${image.id}-segment-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border">
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
                        disabled={!hasPrerequisites}
                      />
                      <div className="text-xs text-gray-400">seconds</div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full text-center text-gray-500 py-4">
                    No images processed yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Script-Based Timing Preview */}
          {settings.useScriptBasedTiming && (
            <div className={`space-y-4 p-4 border rounded-lg ${
              scriptBasedTimingAvailable && hasPrerequisites 
                ? 'bg-green-50 border-green-200' 
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Script-Based Timing Preview</h4>
                  <p className="text-sm text-gray-600">
                    Each image will show for the duration of its script's audio
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    Total: {scriptBasedTimingAvailable ? getScriptBasedTimings().reduce((sum, timing) => sum + timing.duration, 0).toFixed(1) : '0.0'}s
                  </div>
                  <div className={`text-xs ${scriptBasedTimingAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                    {scriptBasedTimingAvailable ? 'Matches audio duration' : 'Not available'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {originalImages.length > 0 ? originalImages.map((image, index) => {
                  const scriptDuration = audioGeneration?.scriptDurations?.find(sd => sd.imageId === image.id)
                  return (
                    <div key={`${image.id}-script-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border">
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
                }) : (
                  <div className="col-span-full text-center text-gray-500 py-4">
                    No images processed yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo || !hasPrerequisites}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
            size="lg"
          >
            {isGeneratingVideo ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Video...
              </>
            ) : !hasPrerequisites ? (
              <>
                <VideoIcon className="h-4 w-4 mr-2" />
                Complete Prerequisites to Generate Video
              </>
            ) : (
              <>
                <VideoIcon className="h-4 w-4 mr-2" />
                Generate Video ({
                  settings.useSegmentedTiming ? 'Custom Timing' :
                  settings.useScriptBasedTiming && scriptBasedTimingAvailable ? 'Script-Based' :
                  'Traditional'
                }{settings.includeMusic ? ' + Music' : ''})
              </>
            )}
          </Button>
        </CardContent>
      </Card>

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