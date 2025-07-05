'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Settings, Video, Zap, Clock, ArrowUp, ArrowDown, X, Plus } from 'lucide-react'
import type { IntroImageConfig } from '@/types/video-generation'

interface VideoModeSelectionProps {
  settings: any
  onSettingsChange: (settings: any) => void
  getOrderedImageUrls: () => string[]
  selectedImagesCount: number
  imageSets: any[]
  selectedImagesOrder: string[]
  hasPrerequisites: boolean
  // Callbacks for intro configuration
  introImages: IntroImageConfig[]
  onIntroImagesChange: (introImages: IntroImageConfig[]) => void
  selectedLoopImageId: string
  onSelectedLoopImageIdChange: (imageId: string) => void
}

export function VideoModeSelection({
  settings,
  onSettingsChange,
  getOrderedImageUrls,
  selectedImagesCount,
  imageSets,
  selectedImagesOrder,
  hasPrerequisites,
  introImages,
  onIntroImagesChange,
  selectedLoopImageId,
  onSelectedLoopImageIdChange
}: VideoModeSelectionProps) {
  // Helper function to get image details
  const getImageDetails = (imageId: string) => {
    const [setId, imageIndex] = imageId.split(':')
    const imageSet = imageSets.find(set => set.id === setId)
    if (imageSet && imageSet.imageUrls[parseInt(imageIndex)]) {
      return {
        url: imageSet.imageUrls[parseInt(imageIndex)],
        prompt: imageSet.originalPrompt,
        provider: imageSet.provider
      }
    }
    return null
  }

  // Add image to intro sequence
  const addToIntroSequence = (imageId: string) => {
    const imageDetails = getImageDetails(imageId)
    if (!imageDetails) return

    const newIntroImage: IntroImageConfig = {
      imageId,
      imageUrl: imageDetails.url,
      duration: settings.introDuration / Math.max(selectedImagesCount, 1), // Equal distribution
      order: introImages.length + 1
    }

    onIntroImagesChange([...introImages, newIntroImage])
  }

  // Remove image from intro sequence
  const removeFromIntroSequence = (imageId: string) => {
    const filtered = introImages.filter(img => img.imageId !== imageId)
    // Reorder remaining images
    const reordered = filtered.map((img, index) => ({ ...img, order: index + 1 }))
    onIntroImagesChange(reordered)
  }

  // Move intro image up/down
  const moveIntroImage = (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = introImages.findIndex(img => img.imageId === imageId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= introImages.length) return

    const newIntroImages = [...introImages]
    ;[newIntroImages[currentIndex], newIntroImages[newIndex]] = [newIntroImages[newIndex], newIntroImages[currentIndex]]
    
    // Update order numbers
    const reordered = newIntroImages.map((img, index) => ({ ...img, order: index + 1 }))
    onIntroImagesChange(reordered)
  }

  // Update intro image duration
  const updateIntroDuration = (imageId: string, duration: number) => {
    const updated = introImages.map(img => 
      img.imageId === imageId ? { ...img, duration } : img
    )
    onIntroImagesChange(updated)
  }

  // Distribute intro duration equally
  const distributeIntroEqually = () => {
    if (introImages.length === 0) return

    const equalDuration = settings.introDuration / introImages.length
    const updated = introImages.map(img => ({ ...img, duration: equalDuration }))
    onIntroImagesChange(updated)
  }

  // Calculate total intro duration
  const totalIntroDuration = introImages.reduce((sum, img) => sum + img.duration, 0)

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Generation Mode
        </CardTitle>
        <CardDescription>
          Choose how your video should be generated with different visual effects and timing options
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Mode Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Video Mode</Label>
          
          <Tabs value={settings.videoMode} onValueChange={(value) => onSettingsChange({ videoMode: value })}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="traditional">Traditional</TabsTrigger>
              <TabsTrigger value="option1">Option 1: Loop All</TabsTrigger>
              <TabsTrigger value="option2">Option 2: Intro + Loop</TabsTrigger>
            </TabsList>

            {/* Traditional Mode */}
            <TabsContent value="traditional" className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Traditional Video Generation</h4>
                <p className="text-sm text-gray-600">
                  Standard video generation with images displayed sequentially based on your timing settings.
                </p>
              </div>
            </TabsContent>

            {/* Option 1: Loop All Images */}
            <TabsContent value="option1" className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium mb-2 text-blue-800">Option 1: Loop All Images with Zoom Effects</h4>
                <p className="text-sm text-blue-700 mb-3">
                  All selected images will loop throughout the video duration with zoom in/out effects.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="zoom-effect"
                      checked={settings.zoomEffect || false}
                      onCheckedChange={(checked) => onSettingsChange({ zoomEffect: checked })}
                      disabled={!hasPrerequisites}
                    />
                    <Label htmlFor="zoom-effect" className="text-sm">Enable zoom in/out effects</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dust-overlay-1"
                      checked={settings.dustOverlay || false}
                      onCheckedChange={(checked) => onSettingsChange({ dustOverlay: checked })}
                      disabled={!hasPrerequisites}
                    />
                    <Label htmlFor="dust-overlay-1" className="text-sm">Add dust overlay effect</Label>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Option 2: Intro + Loop */}
            <TabsContent value="option2" className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium mb-2 text-purple-800">Option 2: Intro Sequence + Loop Last Image</h4>
                <p className="text-sm text-purple-700 mb-3">
                  Show selected images in the first minute, then loop the last image with zoom effects for the remaining duration.
                </p>

                {/* Intro Duration Setting */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Intro Duration</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={settings.introDuration}
                        onChange={(e) => onSettingsChange({ introDuration: parseInt(e.target.value) || 60 })}
                        className="w-20"
                        min="30"
                        max="300"
                        step="10"
                        disabled={!hasPrerequisites}
                      />
                      <span className="text-sm text-gray-500">seconds</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Intro Timing</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="equal-intro-duration"
                        checked={settings.useEqualIntroDuration || false}
                        onCheckedChange={(checked) => onSettingsChange({ useEqualIntroDuration: checked })}
                        disabled={!hasPrerequisites}
                      />
                      <Label htmlFor="equal-intro-duration" className="text-sm">Equal duration for all intro images</Label>
                    </div>
                  </div>
                </div>

                {/* Effects */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="zoom-effect-2"
                      checked={settings.zoomEffect || false}
                      onCheckedChange={(checked) => onSettingsChange({ zoomEffect: checked })}
                      disabled={!hasPrerequisites}
                    />
                    <Label htmlFor="zoom-effect-2" className="text-sm">Enable zoom effects on loop image</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dust-overlay-2"
                      checked={settings.dustOverlay || false}
                      onCheckedChange={(checked) => onSettingsChange({ dustOverlay: checked })}
                      disabled={!hasPrerequisites}
                    />
                    <Label htmlFor="dust-overlay-2" className="text-sm">Add dust overlay effect</Label>
                  </div>
                </div>

                {/* Intro Images Configuration */}
                {selectedImagesCount > 0 && (
                  <div className="space-y-4 border-t border-purple-200 pt-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-purple-800">Configure Intro Sequence</h5>
                      <div className="flex gap-2">
                        <Button
                          onClick={distributeIntroEqually}
                          size="sm"
                          variant="outline"
                          disabled={introImages.length === 0}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Equal Duration
                        </Button>
                        <Badge variant="outline" className="border-purple-300 text-purple-700">
                          Total: {totalIntroDuration.toFixed(1)}s / {settings.introDuration}s
                        </Badge>
                      </div>
                    </div>

                    {/* Available Images */}
                    <div className="space-y-2">
                      <Label className="text-sm">Available Images</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {selectedImagesOrder.map((imageId, index) => {
                          const imageDetails = getImageDetails(imageId)
                          const isInIntro = introImages.some(img => img.imageId === imageId)
                          
                          if (!imageDetails) return null
                          
                          return (
                            <div key={imageId} className="relative group">
                              <div className={`aspect-square rounded border-2 overflow-hidden cursor-pointer transition-colors ${
                                isInIntro ? 'border-purple-500 bg-purple-100' : 'border-gray-200 hover:border-purple-300'
                              }`}>
                                <img
                                  src={imageDetails.url}
                                  alt={`Image ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onClick={() => isInIntro ? removeFromIntroSequence(imageId) : addToIntroSequence(imageId)}
                                />
                              </div>
                              <div className="absolute -top-1 -right-1">
                                {isInIntro ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-6 w-6 p-0 rounded-full"
                                    onClick={() => removeFromIntroSequence(imageId)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 w-6 p-0 rounded-full bg-purple-600 hover:bg-purple-700"
                                    onClick={() => addToIntroSequence(imageId)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Intro Sequence */}
                    {introImages.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Intro Sequence ({introImages.length} images)</Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                          {[...introImages]
                            .sort((a, b) => a.order - b.order)
                            .map((introImage, index) => (
                            <div key={introImage.imageId} className="flex items-center gap-3 p-2 bg-purple-50 rounded border">
                              <div className="flex-shrink-0">
                                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                  {introImage.order}
                                </Badge>
                              </div>
                              
                              <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                                <img
                                  src={introImage.imageUrl}
                                  alt={`Intro image ${introImage.order}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="flex-1">
                                <Input
                                  type="number"
                                  value={introImage.duration.toFixed(1)}
                                  onChange={(e) => updateIntroDuration(introImage.imageId, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  step="0.5"
                                  min="0.5"
                                  disabled={!hasPrerequisites || settings.useEqualIntroDuration}
                                />
                              </div>
                              
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => moveIntroImage(introImage.imageId, 'up')}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => moveIntroImage(introImage.imageId, 'down')}
                                  disabled={index === introImages.length - 1}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 w-8 p-0"
                                  onClick={() => removeFromIntroSequence(introImage.imageId)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Loop Image Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm">Loop Image (will be shown after intro)</Label>
                      <Select 
                        value={selectedLoopImageId} 
                        onValueChange={onSelectedLoopImageIdChange}
                        disabled={!hasPrerequisites}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select image to loop..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedImagesOrder.map((imageId, index) => {
                            const imageDetails = getImageDetails(imageId)
                            if (!imageDetails) return null
                            
                            return (
                              <SelectItem key={imageId} value={imageId}>
                                Image {index + 1} - {imageDetails.prompt.substring(0, 50)}...
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
} 