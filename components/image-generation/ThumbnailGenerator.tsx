'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
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

interface ThumbnailGeneratorProps {
  thumbnailPrompt: string
  onThumbnailPromptChange: (value: string) => void
  referenceImages: File[]
  onReferenceImagesChange: (files: File[]) => void
  isGeneratingThumbnail: boolean
  thumbnailResult: string | null
  thumbnailError: string | null
  onGenerateThumbnail: () => void
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
  const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    onReferenceImagesChange([...referenceImages, ...files])
  }

  const removeReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index)
    onReferenceImagesChange(newImages)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-green-600" />
          Thumbnail Generator
        </CardTitle>
        <CardDescription>
          Generate custom thumbnails using OpenAI's image editing with reference images and custom prompts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reference Images Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Reference Images</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearThumbnailGenerator}
              disabled={isGeneratingThumbnail}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <div className="space-y-2">
                <Label htmlFor="reference-upload" className="cursor-pointer">
                  <div className="text-lg font-medium text-gray-900">Upload Reference Images</div>
                  <div className="text-sm text-gray-500">PNG, JPG up to 10MB each</div>
                </Label>
                <Input
                  id="reference-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleReferenceImageUpload}
                  className="hidden"
                  disabled={isGeneratingThumbnail}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('reference-upload')?.click()}
                  disabled={isGeneratingThumbnail}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
              </div>
            </div>
          </div>

          {/* Reference Images Preview */}
          {referenceImages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Uploaded Images ({referenceImages.length})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {referenceImages.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-full object-cover"
                        onLoad={(e) => {
                          // Clean up the object URL after the image loads
                          const img = e.target as HTMLImageElement
                          if (img.src.startsWith('blob:')) {
                            setTimeout(() => URL.revokeObjectURL(img.src), 100)
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeReferenceImage(index)}
                      disabled={isGeneratingThumbnail}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2">
          <Label htmlFor="thumbnail-prompt" className="text-base font-medium">
            Custom Prompt
          </Label>
          <Textarea
            id="thumbnail-prompt"
            placeholder="Describe how you want to combine the reference images. For example: 'Generate a photorealistic image of a gift basket on a white background labeled 'Relax & Unwind' with a ribbon and handwriting-like font, containing all the items in the reference pictures.'"
            value={thumbnailPrompt}
            onChange={(e) => onThumbnailPromptChange(e.target.value)}
            className="min-h-[120px]"
            disabled={isGeneratingThumbnail}
          />
          <p className="text-xs text-gray-500">
            Be specific about the composition, style, background, and how the reference images should be combined.
          </p>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerateThumbnail}
          disabled={isGeneratingThumbnail || !thumbnailPrompt.trim() || referenceImages.length === 0}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {isGeneratingThumbnail ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Generating Thumbnail...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Generate Thumbnail
            </>
          )}
        </Button>

        {/* Error Display */}
        {thumbnailError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800">Error</span>
            </div>
            <p className="text-red-700 mt-1 text-sm">{thumbnailError}</p>
          </div>
        )}

        {/* Result Display */}
        {thumbnailResult && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Generated Thumbnail
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadThumbnail}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="aspect-video bg-white rounded-lg overflow-hidden border">
                  <img
                    src={thumbnailResult}
                    alt="Generated thumbnail"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>Prompt used:</strong> {thumbnailPrompt}</p>
                  <p><strong>Reference images:</strong> {referenceImages.length} files</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-800">How it works:</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Upload 1-4 reference images that you want to combine</li>
                <li>• Write a detailed prompt describing the final composition</li>
                <li>• OpenAI's GPT Image 1 model will create a new image based on your references</li>
                <li>• Perfect for creating thumbnails, product compositions, or artistic combinations</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 