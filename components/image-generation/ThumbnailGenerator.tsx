'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  ImageIcon,
  Upload,
  X,
  Trash2,
  Download,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'

type ThumbnailModel = 'gpt-image-1' | 'dalle-3' | 'imagen-4'

interface ThumbnailGeneratorProps {
  thumbnailPrompt: string
  onThumbnailPromptChange: (value: string) => void
  referenceImages: File[]
  onReferenceImagesChange: (files: File[]) => void
  isGeneratingThumbnail: boolean
  thumbnailResult: string | null
  thumbnailError: string | null
  onGenerateThumbnail: (model: ThumbnailModel) => void
  onDownloadThumbnail: () => void
  onClearThumbnailGenerator: () => void
}

export function ThumbnailGenerator({
  thumbnailPrompt,
  onThumbnailPromptChange,
  referenceImages,
  onReferenceImagesChange,
  isGeneratingThumbnail,
  thumbnailResult,
  thumbnailError,
  onGenerateThumbnail,
  onDownloadThumbnail,
  onClearThumbnailGenerator
}: ThumbnailGeneratorProps) {
  const [selectedModel, setSelectedModel] = useState<ThumbnailModel>('gpt-image-1')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    onReferenceImagesChange([...referenceImages, ...files])
  }

  const removeReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index)
    onReferenceImagesChange(newImages)
  }

  // Handle model change and clear images if new model doesn't need them
  const handleModelChange = (newModel: ThumbnailModel) => {
    setSelectedModel(newModel)
    const newModelInfo = modelInfo[newModel]
    
    // Clear reference images if switching to a model that doesn't use them
    if (!newModelInfo.showImageUpload && referenceImages.length > 0) {
      onReferenceImagesChange([])
    }
  }

  const modelInfo = {
    'gpt-image-1': {
      name: 'GPT Image 1',
      description: 'Advanced image editing with reference images (OpenAI)',
      requiresImages: true,
      showImageUpload: true,
      features: ['Image editing', 'Reference-based', 'High quality']
    },
    'dalle-3': {
      name: 'DALL-E 3',
      description: 'Creative image generation from text prompts (OpenAI)', 
      requiresImages: false,
      showImageUpload: false,
      features: ['Creative generation', 'Text-to-image', 'High quality']
    },
    'imagen-4': {
      name: 'Google Imagen 4',
      description: 'Google\'s most advanced text-to-image model',
      requiresImages: false,
      showImageUpload: false,
      features: ['Superior quality', 'Prompt adherence', 'Professional results']
    }
  }

  const currentModelInfo = modelInfo[selectedModel]
  const showImageRequirement = currentModelInfo.requiresImages && referenceImages.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-green-600" />
          Thumbnail Generator
        </CardTitle>
        <CardDescription>
          Generate custom thumbnails using AI models with reference images and custom prompts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model-select" className="text-sm font-medium">
            AI Model
          </Label>
          <Select value={selectedModel} onValueChange={(value: ThumbnailModel) => handleModelChange(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select AI model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelInfo).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col">
                    <span className="font-medium">{info.name}</span>
                    <span className="text-xs text-gray-500">{info.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Model Features */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">{currentModelInfo.name} Features</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {currentModelInfo.features.map((feature, index) => (
                <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  {feature}
                </span>
              ))}
            </div>
            {currentModelInfo.requiresImages && (
              <p className="text-xs text-blue-600 mt-2">
                ⚠️ This model requires at least one reference image
              </p>
            )}
          </div>
          </div>
          
        {/* Prompt Input */}
              <div className="space-y-2">
          <Label htmlFor="thumbnail-prompt" className="text-sm font-medium">
            Thumbnail Description
                </Label>
          <Textarea
            id="thumbnail-prompt"
            placeholder="Describe the thumbnail you want to create..."
            value={thumbnailPrompt}
            onChange={(e) => onThumbnailPromptChange(e.target.value)}
            className="min-h-[100px]"
                  disabled={isGeneratingThumbnail}
                />
        </div>

        {/* Reference Images Upload */}
        {currentModelInfo.showImageUpload && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="reference-images" className="text-sm font-medium">
                Reference Images
                {currentModelInfo.requiresImages && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {referenceImages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReferenceImagesChange([])}
                  className="text-red-600 hover:text-red-700"
                  disabled={isGeneratingThumbnail}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isGeneratingThumbnail}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {currentModelInfo.requiresImages 
                    ? 'Upload reference images (required)'
                    : 'Upload reference images (optional for inspiration)'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WebP up to 10MB each
                </p>
              </label>
          </div>

            {/* Show uploaded images */}
          {referenceImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {referenceImages.map((file, index) => (
                  <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Reference ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                      />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeReferenceImage(index)}
                      disabled={isGeneratingThumbnail}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

        {/* Error Display */}
        {thumbnailError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{thumbnailError}</span>
        </div>
        )}

        {/* Generation Button */}
        <Button
          onClick={() => onGenerateThumbnail(selectedModel)}
          disabled={
            isGeneratingThumbnail || 
            !thumbnailPrompt.trim() || 
            showImageRequirement
          }
          className="w-full"
          size="lg"
        >
          {isGeneratingThumbnail ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating with {currentModelInfo.name}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate with {currentModelInfo.name}
            </>
          )}
        </Button>

        {/* Image requirement warning */}
        {showImageRequirement && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              {currentModelInfo.name} requires at least one reference image to work properly.
            </span>
          </div>
        )}

        {/* Result Display */}
        {thumbnailResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                Thumbnail generated successfully with {currentModelInfo.name}!
                </span>
            </div>
            
            <div className="relative">
              <img
                src={thumbnailResult}
                alt="Generated thumbnail"
                className="w-full max-w-lg mx-auto rounded-lg border shadow-sm"
              />
            </div>

            <div className="flex gap-2">
                <Button
                onClick={onDownloadThumbnail}
                  variant="outline"
                className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              <Button
                onClick={onClearThumbnailGenerator}
                variant="outline"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 