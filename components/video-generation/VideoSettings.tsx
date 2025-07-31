'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Slider } from '../ui/slider'
import { Settings, Palette, AlertCircle, Loader2, VideoIcon, Upload, Music, Trash2, Play, Pause, Volume2 } from 'lucide-react'
import type { SegmentTiming, IntroImageConfig } from '@/types/video-generation'
import { VideoModeSelection } from './VideoModeSelection'

interface VideoSettingsProps {
  settings: any
  onSettingsChange: (settings: any) => void
  hasPrerequisites: boolean
  selectedImagesCount: number
  audioGeneration: any
  isGeneratingVideo: boolean
  onGenerateVideo: () => void
  // Segment timing props
  customSegmentTimings: SegmentTiming[]
  onUpdateSegmentTiming: (index: number, duration: number) => void
  onDistributeEquallyAcrossSegments: () => void
  totalSegmentDuration: number
  // Subtitle styling props
  subtitleSettings: any
  onSubtitleSettingsChange: (settings: any) => void
  // Image URLs for preview
  getOrderedImageUrls: () => string[]
  // Additional props for video mode selection
  imageSets: any[]
  selectedImagesOrder: string[]
  // Intro configuration props
  introImages: IntroImageConfig[]
  onIntroImagesChange: (introImages: IntroImageConfig[]) => void
  selectedLoopImageId: string
  onSelectedLoopImageIdChange: (imageId: string) => void
}

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

export function VideoSettings({
  settings,
  onSettingsChange,
  hasPrerequisites,
  selectedImagesCount,
  audioGeneration,
  isGeneratingVideo,
  onGenerateVideo,
  customSegmentTimings,
  onUpdateSegmentTiming,
  onDistributeEquallyAcrossSegments,
  totalSegmentDuration,
  subtitleSettings,
  onSubtitleSettingsChange,
  getOrderedImageUrls,
  imageSets,
  selectedImagesOrder,
  introImages,
  onIntroImagesChange,
  selectedLoopImageId,
  onSelectedLoopImageIdChange
}: VideoSettingsProps) {
  const [uploadingMusic, setUploadingMusic] = useState(false)
  const [customMusicFiles, setCustomMusicFiles] = useState<Array<{
    id: string
    name: string
    url: string
    duration?: number
  }>>(settings.customMusicFiles || [])
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)

  const handleMusicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploadingMusic(true)
    const uploadedFiles: Array<{
      id: string
      name: string
      url: string
      duration?: number
    }> = []

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('audio/')) {
          alert(`${file.name} is not a valid audio file`)
          continue
        }

        // Create FormData for upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'audio')
        formData.append('path', `custom-music/${Date.now()}-${file.name}`)

        // Upload to Supabase
        const response = await fetch('/api/upload-file', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        const { publicUrl } = await response.json()

        // Get audio duration
        const audio = new Audio()
        const duration = await new Promise<number>((resolve) => {
          audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration)
          })
          audio.src = URL.createObjectURL(file)
        })

        uploadedFiles.push({
          id: `music-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: publicUrl,
          duration: Math.round(duration)
        })
      }

      const updatedMusicFiles = [...customMusicFiles, ...uploadedFiles]
      setCustomMusicFiles(updatedMusicFiles)
      onSettingsChange({ 
        ...settings, 
        customMusicFiles: updatedMusicFiles,
        useCustomMusic: updatedMusicFiles.length > 0
      })

      alert(`Successfully uploaded ${uploadedFiles.length} music file(s)`)
    } catch (error) {
      console.error('Music upload error:', error)
      alert(`Failed to upload music: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingMusic(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleRemoveMusic = (musicId: string) => {
    const updatedFiles = customMusicFiles.filter(file => file.id !== musicId)
    setCustomMusicFiles(updatedFiles)
    onSettingsChange({ 
      ...settings, 
      customMusicFiles: updatedFiles,
      useCustomMusic: updatedFiles.length > 0
    })
  }

  const handlePlayPause = (url: string, musicId: string) => {
    if (playingAudio === musicId) {
      // Pause current audio
      const audio = document.getElementById(`audio-${musicId}`) as HTMLAudioElement
      if (audio) {
        audio.pause()
      }
      setPlayingAudio(null)
    } else {
      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }
      }
      
      // Play new audio
      const audio = document.getElementById(`audio-${musicId}`) as HTMLAudioElement
      if (audio) {
        audio.play()
        setPlayingAudio(musicId)
        
        // Reset when audio ends
        audio.onended = () => setPlayingAudio(null)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Video Mode Selection */}
      <VideoModeSelection
        settings={settings}
        onSettingsChange={onSettingsChange}
        getOrderedImageUrls={getOrderedImageUrls}
        selectedImagesCount={selectedImagesCount}
        imageSets={imageSets}
        selectedImagesOrder={selectedImagesOrder}
        hasPrerequisites={hasPrerequisites}
        introImages={introImages}
        onIntroImagesChange={onIntroImagesChange}
        selectedLoopImageId={selectedLoopImageId}
        onSelectedLoopImageIdChange={onSelectedLoopImageIdChange}
      />

      {/* Custom Music Upload */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-purple-600" />
            Custom Background Music
          </CardTitle>
          <CardDescription>
            Upload your own music files to use as background audio. Single file loops continuously, multiple files play in sequence and loop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="music-upload" className="text-sm font-medium">
                  Upload Audio Files (MP3, WAV, M4A)
                </Label>
                <Input
                  id="music-upload"
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleMusicUpload}
                  disabled={uploadingMusic || !hasPrerequisites}
                  className="mt-2"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-music"
                  checked={settings.useCustomMusic && customMusicFiles.length > 0}
                  onCheckedChange={(checked) => onSettingsChange({ 
                    ...settings, 
                    useCustomMusic: checked && customMusicFiles.length > 0
                  })}
                  disabled={!hasPrerequisites || customMusicFiles.length === 0}
                />
                <Label htmlFor="use-custom-music" className="text-sm">
                  Use custom music
                </Label>
              </div>
            </div>

            {uploadingMusic && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading music files...</span>
              </div>
            )}
          </div>

          {/* Music Files List */}
          {customMusicFiles.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Uploaded Music Files ({customMusicFiles.length})
              </Label>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {customMusicFiles.map((file, index) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                        <Music className="h-4 w-4 text-purple-500" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </div>
                        {file.duration && (
                          <div className="text-xs text-gray-500">
                            Duration: {Math.floor(file.duration / 60)}:{(file.duration % 60).toString().padStart(2, '0')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Hidden audio element for playback */}
                      <audio
                        id={`audio-${file.id}`}
                        src={file.url}
                        preload="none"
                      />
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePlayPause(file.url, file.id)}
                        className="h-8 w-8 p-0"
                      >
                        {playingAudio === file.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMusic(file.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {customMusicFiles.length > 1 && (
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <strong>Playback Mode:</strong> Files will play in the order shown above, looping the entire sequence throughout the video.
                </div>
              )}
            </div>
          )}

          {/* Volume Controls */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-4 w-4 text-gray-600" />
              <Label className="text-sm font-medium">Audio Volume Controls</Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Music Volume */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Background Music Volume
                  </Label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {Math.round((settings.musicVolume || 0.7) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.musicVolume || 0.7]}
                  onValueChange={(value) => onSettingsChange({ ...settings, musicVolume: value[0] })}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                  disabled={!hasPrerequisites}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Silent</span>
                  <span>Full Volume</span>
                </div>
              </div>

              {/* Voiceover Volume */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Voiceover Volume
                  </Label>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {Math.round((settings.voiceoverVolume || 1.0) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.voiceoverVolume || 1.0]}
                  onValueChange={(value) => onSettingsChange({ ...settings, voiceoverVolume: value[0] })}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                  disabled={!hasPrerequisites}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Silent</span>
                  <span>Full Volume</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              <strong>Note:</strong> Music volume is automatically reduced when voiceover is playing to ensure speech clarity. 
              These controls set the maximum volume levels for each audio type.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traditional Video Settings - Only show if not using new video modes */}
      {settings.videoMode === 'traditional' && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Traditional Video Settings
            </CardTitle>
            <CardDescription>
              Configure timing, quality, and subtitle options for traditional video generation
              {!hasPrerequisites && (
                <span className="block text-orange-600 mt-1">
                  Complete prerequisites above to enable video generation
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Traditional Video Specific Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Timing Mode</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="segmented-timing"
                      checked={settings.useSegmentedTiming || false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSettingsChange({ useSegmentedTiming: true, useScriptBasedTiming: false })
                        } else {
                          onSettingsChange({ useSegmentedTiming: false })
                        }
                      }}
                      disabled={!hasPrerequisites}
                    />
                    <Label htmlFor="segmented-timing" className="text-sm">Custom segment timing</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Visual Effects</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-overlay"
                    checked={settings.includeOverlay || false}
                    onCheckedChange={(checked) => onSettingsChange({ includeOverlay: checked as boolean })}
                    disabled={!hasPrerequisites}
                  />
                  <Label htmlFor="include-overlay" className="text-sm">
                    Add dust overlay effect to video
                  </Label>
                </div>
              </div>
            </div>

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
                  onClick={onDistributeEquallyAcrossSegments}
                  size="sm"
                  variant="outline"
                  disabled={!hasPrerequisites || !audioGeneration?.audioUrl}
                >
                  Distribute Equally
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedImagesCount > 0 ? getOrderedImageUrls().map((imageUrl: string, index: number) => (
                    <div key={imageUrl} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={imageUrl}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Image {index + 1}</div>
                        <Input
                          type="number"
                          value={customSegmentTimings[index]?.duration.toFixed(1) || '0.0'}
                          onChange={(e) => onUpdateSegmentTiming(index, parseFloat(e.target.value) || 0)}
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
                      No images selected for video
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Universal Settings Card - Quality and Subtitles */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Video Quality & Subtitles
          </CardTitle>
          <CardDescription>
            Configure video quality and subtitle options for all video modes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Video Quality</Label>
              <Select 
                value={settings.videoQuality} 
                onValueChange={(value: 'hd' | 'sd') => onSettingsChange({ videoQuality: value })}
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
              <Label className="text-sm">Subtitles</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-subtitles-universal"
                  checked={settings.includeSubtitles || false}
                  onCheckedChange={(checked) => onSettingsChange({ includeSubtitles: checked as boolean })}
                  disabled={!hasPrerequisites || !audioGeneration?.subtitlesUrl}
                />
                <Label htmlFor="include-subtitles-universal" className="text-sm">
                  Include subtitles {!audioGeneration?.subtitlesUrl && '(not available)'}
                </Label>
              </div>
            </div>
          </div>

          {/* Subtitle Styling Controls */}
          {settings.includeSubtitles && audioGeneration?.subtitlesUrl && (
            <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-yellow-800">Subtitle Styling</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Font Family */}
                <div className="space-y-2">
                  <Label className="text-sm">Font Family</Label>
                  <Select 
                    value={subtitleSettings.fontFamily} 
                    onValueChange={(value) => onSubtitleSettingsChange({ ...subtitleSettings, fontFamily: value })}
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
                    onValueChange={(value) => onSubtitleSettingsChange({ ...subtitleSettings, fontWeight: value })}
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
                    onValueChange={(value) => onSubtitleSettingsChange({ ...subtitleSettings, textTransform: value })}
                    disabled={!hasPrerequisites}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Normal</SelectItem>
                      <SelectItem value="uppercase">UPPERCASE</SelectItem>
                      <SelectItem value="lowercase">lowercase</SelectItem>
                      <SelectItem value="capitalize">Capitalize</SelectItem>
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
                      onChange={(e) => onSubtitleSettingsChange({ ...subtitleSettings, fontColor: e.target.value })}
                      className="w-12 h-8 p-0 border rounded cursor-pointer"
                      disabled={!hasPrerequisites}
                    />
                    <Input
                      type="text"
                      value={subtitleSettings.fontColor}
                      onChange={(e) => onSubtitleSettingsChange({ ...subtitleSettings, fontColor: e.target.value })}
                      placeholder="#ffffff"
                      className="flex-1 h-8 text-xs"
                      disabled={!hasPrerequisites}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Font Size */}
                <div className="space-y-2">
                  <Label className="text-sm">Font Size: {subtitleSettings.fontSize}px</Label>
                  <input
                    type="range"
                    min="12"
                    max="60"
                    step="2"
                    value={subtitleSettings.fontSize}
                    onChange={(e) => onSubtitleSettingsChange({ ...subtitleSettings, fontSize: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={!hasPrerequisites}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>12px</span>
                    <span>60px</span>
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="space-y-2">
                  <Label className="text-sm">Stroke Outline: {subtitleSettings.strokeWidth}px</Label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="0.5"
                    value={subtitleSettings.strokeWidth}
                    onChange={(e) => onSubtitleSettingsChange({ ...subtitleSettings, strokeWidth: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={!hasPrerequisites}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0px</span>
                    <span>8px</span>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="mt-4 p-4 bg-black rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-2">Subtitle Preview:</p>
                  <div 
                    style={{
                      fontFamily: subtitleSettings.fontFamily,
                      color: subtitleSettings.fontColor,
                      fontSize: `${Math.min(subtitleSettings.fontSize * 0.7, 24)}px`, // Scale down for preview
                      textShadow: subtitleSettings.strokeWidth > 0 
                        ? `${subtitleSettings.strokeWidth * 0.7}px ${subtitleSettings.strokeWidth * 0.7}px 0px #000000, -${subtitleSettings.strokeWidth * 0.7}px -${subtitleSettings.strokeWidth * 0.7}px 0px #000000, ${subtitleSettings.strokeWidth * 0.7}px -${subtitleSettings.strokeWidth * 0.7}px 0px #000000, -${subtitleSettings.strokeWidth * 0.7}px ${subtitleSettings.strokeWidth * 0.7}px 0px #000000`
                        : 'none',
                      fontWeight: subtitleSettings.fontWeight,
                      textTransform: subtitleSettings.textTransform as any
                    }}
                  >
                    Sample subtitle text appears here
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prerequisites Warning */}
          {!hasPrerequisites && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Prerequisites Required</span>
              </div>
              <div className="text-sm text-orange-700 space-y-1">
                {selectedImagesCount === 0 && <div>• Select images from Image Generator first</div>}
                {!audioGeneration?.audioUrl && <div>• Generate audio from scripts</div>}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={onGenerateVideo}
            disabled={isGeneratingVideo || !hasPrerequisites || selectedImagesCount === 0}
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
            ) : selectedImagesCount === 0 ? (
              <>
                <VideoIcon className="h-4 w-4 mr-2" />
                Select Images in Image Generator First
              </>
            ) : (
              <>
                <VideoIcon className="h-4 w-4 mr-2" />
                Generate Video with {selectedImagesCount} Selected Image{selectedImagesCount !== 1 ? 's' : ''} ({
                  settings.videoMode === 'option1' ? 'Loop All with Zoom' :
                  settings.videoMode === 'option2' ? 'Intro + Loop' :
                  settings.useSegmentedTiming ? 'Custom Timing' :
                  'Traditional'
                })
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 