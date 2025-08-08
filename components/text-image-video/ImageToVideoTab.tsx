'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { ProviderModelSelector } from './ProviderModelSelector'
import { 
  Plus, 
  Trash2, 
  Video, 
  Image as ImageIcon, 
  Clock,
  Zap,
  RefreshCw,
  Upload,
  X
} from 'lucide-react'

interface ImageToVideoTabProps {
  defaultDuration: 5 | 10
  isGenerating: boolean
  onGenerate: (prompts: string[], images: File[], duration: 5 | 10) => Promise<void>
  onDurationChange: (duration: 5 | 10) => void
}

export function ImageToVideoTab({
  defaultDuration,
  isGenerating,
  onGenerate,
  onDurationChange
}: ImageToVideoTabProps) {
  const [prompts, setPrompts] = useState<string[]>([''])
  const [images, setImages] = useState<File[]>([])
  const [duration, setDuration] = useState<5 | 10>(defaultDuration)
  const [dragActive, setDragActive] = useState(false)

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts]
    newPrompts[index] = value
    setPrompts(newPrompts)
  }

  const addPrompt = () => {
    setPrompts([...prompts, ''])
  }

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index))
    }
  }

  const handleFiles = (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    setImages(prev => [...prev, ...imageFiles])
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    const validPrompts = prompts.filter(p => p.trim().length > 0)
    if (validPrompts.length === 0 || images.length === 0) return

    onDurationChange(duration)
    await onGenerate(validPrompts, images, duration)
  }

  const validPrompts = prompts.filter(p => p.trim().length > 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-purple-600" />
            Image to Video Generation
          </CardTitle>
          <CardDescription>
            Generate videos from images with text prompts. Each image will create a {duration}-second video.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Provider and Model Selection */}
      <ProviderModelSelector mode="image-to-video" />

      {/* Duration Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4 text-green-600" />
            Video Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={duration === 5 ? 'default' : 'outline'}
              onClick={() => setDuration(5)}
              disabled={isGenerating}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              5 Seconds
            </Button>
            <Button
              variant={duration === 10 ? 'default' : 'outline'}
              onClick={() => setDuration(10)}
              disabled={isGenerating}
              className="flex-1"
            >
              <Clock className="h-4 w-4 mr-2" />
              10 Seconds
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-4 w-4 text-blue-600" />
            Upload Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              handleFiles(e.dataTransfer.files)
            }}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Drag and drop images here, or</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload">
              <Button variant="outline" className="cursor-pointer">
                Choose Images
              </Button>
            </label>
          </div>

          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-4 w-4 text-purple-600" />
            Video Prompts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prompts.map((prompt, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1">
                <Label className="text-sm font-medium">
                  Prompt {index + 1}
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Describe how the image should animate..."
                    value={prompt}
                    onChange={(e) => updatePrompt(index, e.target.value)}
                    disabled={isGenerating}
                  />
                  {prompts.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePrompt(index)}
                      disabled={isGenerating}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <Button
            variant="outline"
            onClick={addPrompt}
            disabled={isGenerating || prompts.length >= 10}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Prompt
          </Button>
        </CardContent>
      </Card>

      {/* Generation Summary */}
      {validPrompts.length > 0 && images.length > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{validPrompts.length} Videos</Badge>
                  <Badge variant="secondary">{images.length} Images</Badge>
                  <Badge variant="secondary">{duration}s Each</Badge>
                </div>
                <p className="text-sm text-purple-700">
                  Each prompt will be paired with images (reusing first image if needed)
                </p>
              </div>
              
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || validPrompts.length === 0 || images.length === 0}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Generate Videos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 