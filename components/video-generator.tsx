'use client'

import { useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setIsUploading,
  setUploadedAudio,
  clearUploadedAudio,
  setIsGeneratingSubtitles,
  setSubtitles,
  clearSubtitles
} from '../lib/features/audio/audioSlice'
import {
  setVideoSettings,
  setIsUploadingVideo,
  setUploadedVideo,
  clearUploadedVideo,
  setIsProcessingVideo,
  setIsCreatingVideo,
  setProcessingMetadata,
  clearProcessingMetadata,
  startVideoGeneration
} from '../lib/features/video/videoSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { 
  VideoIcon, 
  Upload, 
  Volume2, 
  Subtitles, 
  Settings, 
  PlayCircle, 
  Download,
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileText,
  Palette,
  Cloud,
  BarChart3
} from 'lucide-react'

interface VideoGeneratorProps {
  onNavigate?: (view: 'video-generator' | 'video-status' | 'settings') => void
}

export function VideoGenerator({ onNavigate }: VideoGeneratorProps) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const { 
    uploadedAudio, 
    subtitles, 
    isUploading: isUploadingAudio, 
    isGeneratingSubtitles 
  } = useAppSelector(state => state.audio)
  const { 
    uploadedVideo, 
    processingMetadata,
    isUploadingVideo, 
    isProcessingVideo,
    isCreatingVideo,
    settings 
  } = useAppSelector(state => state.video)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [isDragActive, setIsDragActive] = useState(false)
  const [dragType, setDragType] = useState<'audio' | 'video' | null>(null)
  const [showSuccessCard, setShowSuccessCard] = useState(false)
  const [createdVideoId, setCreatedVideoId] = useState<string | null>(null)
  
  const audioInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Handle audio file upload
  const handleAudioUpload = async (file: File) => {
    if (!user.isLoggedIn || !user.id) {
      showMessage('Please log in to upload audio', 'error')
      return
    }

    dispatch(setIsUploading(true))
    showMessage('Uploading and compressing audio...', 'info')

    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('userId', user.id)

      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload audio')
      }

      const data = await response.json()
      dispatch(setUploadedAudio(data))
      showMessage(`Audio uploaded successfully! Duration: ${data.duration.toFixed(1)}s`, 'success')
    } catch (error) {
      showMessage('Error uploading audio: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsUploading(false))
    }
  }

  // Handle video file upload
  const handleVideoUpload = async (file: File) => {
    if (!user.isLoggedIn || !user.id) {
      showMessage('Please log in to upload video', 'error')
      return
    }

    dispatch(setIsUploadingVideo(true))
    showMessage('Uploading video...', 'info')

    try {
      const formData = new FormData()
      formData.append('video', file)
      formData.append('userId', user.id)

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload video')
      }

      const data = await response.json()
      dispatch(setUploadedVideo(data))
      showMessage(`Video uploaded successfully! Size: ${(data.fileSize / 1024 / 1024).toFixed(1)}MB`, 'success')
    } catch (error) {
      showMessage('Error uploading video: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsUploadingVideo(false))
    }
  }

  // Generate subtitles from audio
  const handleGenerateSubtitles = async () => {
    if (!uploadedAudio) {
      showMessage('Please upload audio first', 'error')
      return
    }

    dispatch(setIsGeneratingSubtitles(true))
    showMessage('Generating subtitles from audio...', 'info')

    try {
      const response = await fetch('/api/generate-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: uploadedAudio.audioUrl,
          userId: user.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate subtitles')
      }

      const data = await response.json()
      dispatch(setSubtitles(data))
      showMessage('Subtitles generated successfully!', 'success')
    } catch (error) {
      showMessage('Error generating subtitles: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsGeneratingSubtitles(false))
    }
  }

  // Process video metadata for Shotstack
  const handleProcessVideoMetadata = async () => {
    if (!uploadedAudio || !uploadedVideo) {
      showMessage('Please upload both audio and video first', 'error')
      return
    }

    dispatch(setIsProcessingVideo(true))
    showMessage('Processing video metadata...', 'info')

    try {
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: uploadedVideo.videoUrl,
          audioUrl: uploadedAudio.audioUrl,
          audioDuration: uploadedAudio.duration,
          subtitlesUrl: subtitles?.subtitlesUrl,
          fontFamily: settings.fontFamily,
          fontColor: settings.fontColor,
          fontSize: settings.fontSize,
          strokeWidth: settings.strokeWidth,
          quality: settings.videoQuality,
          userId: user.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process video metadata')
      }

      const data = await response.json()
      dispatch(setProcessingMetadata(data))
      showMessage(`Metadata processed! Video will loop ${data.loopCount} times for Shotstack.`, 'success')
    } catch (error) {
      showMessage('Error processing video metadata: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsProcessingVideo(false))
    }
  }

  // Render final video with Shotstack
  const handleRenderWithShotstack = async () => {
    if (!processingMetadata || !uploadedAudio) {
      showMessage('Please process video metadata first', 'error')
      return
    }

    dispatch(setIsCreatingVideo(true))
    showMessage('Starting cloud rendering with Shotstack...', 'info')

    try {
      const response = await fetch('/api/create-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: processingMetadata.videoUrl,
          audioUrl: processingMetadata.audioUrl,
          subtitlesUrl: settings.includeSubtitles ? processingMetadata.subtitlesUrl : undefined,
          quality: processingMetadata.quality,
          fontFamily: processingMetadata.fontFamily,
          fontColor: processingMetadata.fontColor,
          fontSize: processingMetadata.fontSize,
          strokeWidth: processingMetadata.strokeWidth,
          videoDuration: processingMetadata.originalVideoDuration,
          audioDuration: processingMetadata.targetDuration,
          loopCount: processingMetadata.loopCount,
          userId: user.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start video rendering')
      }

      const data = await response.json()
      setCreatedVideoId(data.video_id)
      setShowSuccessCard(true)
      setMessage('')
      
      // Track the rendering job
      if (data.video_id) {
        const videoRecord = {
          id: data.video_id,
          user_id: user.id!,
          status: 'processing' as const,
          image_urls: [],
          audio_url: processingMetadata.audioUrl,
          subtitles_url: processingMetadata.subtitlesUrl || null,
          final_video_url: null,
          thumbnail_url: null,
          shotstack_id: data.shotstack_id || null,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        dispatch(startVideoGeneration(videoRecord))
      }
      
    } catch (error) {
      showMessage('Error starting cloud rendering: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsCreatingVideo(false))
    }
  }

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent, type: 'audio' | 'video') => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
    setDragType(type)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    setDragType(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent, type: 'audio' | 'video') => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    setDragType(null)

    const files = Array.from(e.dataTransfer.files)
    const file = files[0]

    if (!file) return

    if (type === 'audio') {
      if (file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.webm')) {
        handleAudioUpload(file)
      } else {
        showMessage('Please drop an audio file (MP3, WAV, M4A, WEBM, etc.)', 'error')
      }
    } else {
      if (file.type.startsWith('video/')) {
        handleVideoUpload(file)
      } else {
        showMessage('Please drop a video file', 'error')
      }
    }
  }

  // Handle file input changes
  const handleAudioInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleAudioUpload(file)
    }
  }

  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleVideoUpload(file)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Generator</h1>
        <p className="text-gray-600">Upload audio and video, generate subtitles, and create your final video</p>
      </div>

      {/* Success Card */}
      {showSuccessCard && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  Video Rendering Started Successfully! 🎉
                </h3>
                <p className="text-green-700 mb-4">
                  Your video is now being processed in the cloud. Video ID: <code className="bg-green-100 px-2 py-1 rounded text-sm">{createdVideoId}</code>
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => onNavigate?.('video-status')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Go to Video Status
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSuccessCard(false)}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Continue Creating
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {messageType === 'success' && <CheckCircle className="h-5 w-5" />}
            {messageType === 'error' && <AlertCircle className="h-5 w-5" />}
            {messageType === 'info' && <Loader2 className="h-5 w-5 animate-spin" />}
            {message}
          </div>
        </div>
      )}

      {/* Step 1: Audio Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Step 1: Upload Audio
          </CardTitle>
          <CardDescription>
            Upload your audio file. It will be compressed and optimized automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadedAudio ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">{uploadedAudio.originalFileName}</p>
                  <p className="text-sm text-green-600">Duration: {uploadedAudio.duration.toFixed(1)}s</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch(clearUploadedAudio())}
                  >
                    Remove
                  </Button>
                  <audio controls className="h-8">
                    <source src={uploadedAudio.audioUrl} type={uploadedAudio.audioUrl.endsWith('.webm') ? 'audio/webm' : 'audio/mpeg'} />
                  </audio>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragActive && dragType === 'audio'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={(e) => handleDragEnter(e, 'audio')}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'audio')}
            >
              <Volume2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isUploadingAudio ? 'Uploading audio...' : 'Upload Audio File'}
              </p>
              <p className="text-gray-500 mb-4">
                Drag and drop an audio file here, or click to browse
              </p>
              <Button
                onClick={() => audioInputRef.current?.click()}
                disabled={isUploadingAudio}
                className="mb-2"
              >
                {isUploadingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Audio File
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                Supports MP3, WAV, M4A, WEBM and other audio formats
              </p>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.webm"
                onChange={handleAudioInputChange}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Video Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VideoIcon className="h-5 w-5" />
            Step 2: Upload Video
          </CardTitle>
          <CardDescription>
            Upload your video file. Shotstack will loop it to match the audio duration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadedVideo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">{uploadedVideo.originalFileName}</p>
                  <p className="text-sm text-green-600">Size: {(uploadedVideo.fileSize / 1024 / 1024).toFixed(1)}MB</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch(clearUploadedVideo())}
                  >
                    Remove
                  </Button>
                  <video controls className="h-20 w-32">
                    <source src={uploadedVideo.videoUrl} type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragActive && dragType === 'video'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={(e) => handleDragEnter(e, 'video')}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'video')}
            >
              <VideoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isUploadingVideo ? 'Uploading video...' : 'Upload Video File'}
              </p>
              <p className="text-gray-500 mb-4">
                Drag and drop a video file here, or click to browse
              </p>
              <Button
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploadingVideo}
                className="mb-2"
              >
                {isUploadingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Video File
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                Supports MP4, MOV, AVI and other video formats
              </p>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoInputChange}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Generate Subtitles (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Subtitles className="h-5 w-5" />
            Step 3: Generate Subtitles (Optional)
          </CardTitle>
          <CardDescription>
            Generate subtitles from your audio using AI transcription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subtitles ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">Subtitles generated successfully</p>
                  <p className="text-sm text-green-600">Ready to be added to video</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch(clearSubtitles())}
                  >
                    Remove
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(subtitles.subtitlesUrl, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={handleGenerateSubtitles}
                disabled={!uploadedAudio || isGeneratingSubtitles}
                className="w-full"
              >
                {isGeneratingSubtitles ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Subtitles...
                  </>
                ) : (
                  <>
                    <Subtitles className="h-4 w-4 mr-2" />
                    Generate Subtitles
                  </>
                )}
              </Button>
              {!uploadedAudio && (
                <p className="text-sm text-gray-500 text-center">
                  Upload audio first to generate subtitles
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Step 4: Video Settings
          </CardTitle>
          <CardDescription>
            Configure your video output settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quality">Video Quality</Label>
              <Select
                value={settings.videoQuality}
                onValueChange={(value: 'hd' | 'sd') => 
                  dispatch(setVideoSettings({ videoQuality: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hd">HD (1920x1080)</SelectItem>
                  <SelectItem value="sd">SD (1280x720)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="font">Subtitle Font</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(value: string) => 
                  dispatch(setVideoSettings({ fontFamily: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fontColor">Subtitle Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="fontColor"
                  value={settings.fontColor}
                  onChange={(e) => dispatch(setVideoSettings({ fontColor: e.target.value }))}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.fontColor}
                  onChange={(e) => dispatch(setVideoSettings({ fontColor: e.target.value }))}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Choose subtitle text color</p>
            </div>

            <div>
              <Label htmlFor="fontSize">Font Size</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="fontSize"
                  min="12"
                  max="100"
                  step="2"
                  value={settings.fontSize}
                  onChange={(e) => dispatch(setVideoSettings({ fontSize: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="12"
                  max="100"
                  value={settings.fontSize}
                  onChange={(e) => dispatch(setVideoSettings({ fontSize: parseInt(e.target.value) || 24 }))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Subtitle text size (12-100px)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="strokeWidth">Stroke Width</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="strokeWidth"
                  min="0"
                  max="8"
                  step="1"
                  value={settings.strokeWidth}
                  onChange={(e) => dispatch(setVideoSettings({ strokeWidth: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  max="8"
                  value={settings.strokeWidth}
                  onChange={(e) => dispatch(setVideoSettings({ strokeWidth: parseInt(e.target.value) || 2 }))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Text outline width (0-8px)</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSubtitles"
                checked={settings.includeSubtitles}
                onCheckedChange={(checked) => 
                  dispatch(setVideoSettings({ includeSubtitles: !!checked }))
                }
              />
              <Label htmlFor="includeSubtitles">Include subtitles in video</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Process Video Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Step 5: Process Video Metadata
          </CardTitle>
          <CardDescription>
            Prepare video metadata for cloud rendering with Shotstack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processingMetadata ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-green-800">Metadata processed successfully!</p>
                    <p className="text-sm text-green-600">
                      Video will loop {processingMetadata.loopCount} times to match {processingMetadata.targetDuration.toFixed(1)}s audio
                    </p>
                  </div>
                  <Badge variant="secondary">{processingMetadata.quality.toUpperCase()}</Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Original Video Duration:</p>
                    <p className="font-medium">{processingMetadata.originalVideoDuration.toFixed(1)}s</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Target Duration:</p>
                    <p className="font-medium">{processingMetadata.targetDuration.toFixed(1)}s</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Loop Count:</p>
                    <p className="font-medium">{processingMetadata.loopCount}x</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Font & Color:</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{processingMetadata.fontFamily}</span>
                      <span className="text-sm text-gray-500">({processingMetadata.fontSize}px)</span>
                      <div 
                        className="w-4 h-4 border border-gray-300 rounded" 
                        style={{ backgroundColor: processingMetadata.fontColor }}
                        title={processingMetadata.fontColor}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Stroke Width:</p>
                    <p className="font-medium">{processingMetadata.strokeWidth}px</p>
                  </div>
                </div>
                
                <div className="flex gap-2 justify-center mt-4">
                  <Button 
                    onClick={handleRenderWithShotstack}
                    disabled={isCreatingVideo}
                    className="min-w-[180px]"
                  >
                    {isCreatingVideo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Video...
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 mr-2" />
                        Render with Shotstack
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dispatch(clearProcessingMetadata())}
                    disabled={isCreatingVideo}
                  >
                    Process Again
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={handleProcessVideoMetadata}
                disabled={!uploadedAudio || !uploadedVideo || isProcessingVideo}
                className="w-full"
                size="lg"
              >
                {isProcessingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Metadata...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Process Video Metadata
                  </>
                )}
              </Button>
              
              {(!uploadedAudio || !uploadedVideo) && (
                <p className="text-sm text-gray-500 text-center">
                  Upload both audio and video files to process
                </p>
              )}
              
              {uploadedAudio && uploadedVideo && (
                <div className="text-sm text-gray-600 text-center space-y-1">
                  <p>✓ Audio: {uploadedAudio.originalFileName} ({uploadedAudio.duration.toFixed(1)}s)</p>
                  <p>✓ Video: {uploadedVideo.originalFileName}</p>
                  {subtitles && <p>✓ Subtitles: Generated</p>}
                  {settings.includeSubtitles && !subtitles && (
                    <p className="text-amber-600">⚠ Subtitles will be skipped (not generated)</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 