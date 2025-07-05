'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Settings, Palette, AlertCircle, Loader2, VideoIcon } from 'lucide-react'
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
  getScriptBasedTimings: () => SegmentTiming[]
  scriptBasedTimingAvailable: boolean
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
  getScriptBasedTimings,
  scriptBasedTimingAvailable,
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
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="script-based-timing"
                      checked={settings.useScriptBasedTiming || false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSettingsChange({ useScriptBasedTiming: true, useSegmentedTiming: false })
                        } else {
                          onSettingsChange({ useScriptBasedTiming: false })
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
                    checked={settings.includeSubtitles || false}
                    onCheckedChange={(checked) => onSettingsChange({ includeSubtitles: checked as boolean })}
                    disabled={!hasPrerequisites || !audioGeneration?.subtitlesUrl}
                  />
                  <Label htmlFor="include-subtitles" className="text-sm">
                    Include subtitles {!audioGeneration?.subtitlesUrl && '(not available)'}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dust Overlay</Label>
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
                  {selectedImagesCount > 0 ? getOrderedImageUrls().map((imageUrl: string, index: number) => {
                    // Use index-based matching for script durations
                    const scriptDuration = audioGeneration?.scriptDurations?.[index]
                    return (
                      <div key={imageUrl} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                          <img
                            src={imageUrl}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-grow">
                          <div className="text-sm font-medium">Image {index + 1}</div>
                          <div className="text-xs text-gray-500">
                            {scriptDuration ? `${scriptDuration.duration.toFixed(1)}s` : 'No timing data'}
                          </div>
                        </div>
                      </div>
                    )
                  }) : (
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
                  settings.useScriptBasedTiming && scriptBasedTimingAvailable ? 'Script-Based' :
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