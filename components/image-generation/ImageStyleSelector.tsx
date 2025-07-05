'use client'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { IMAGE_STYLES } from '@/data/image'
import type { ExtractedScene } from '@/types/image-generation'

interface ImageStyleSelectorProps {
  selectedImageStyle: string
  onImageStyleChange: (style: string) => void
  aspectRatio: string
  onAspectRatioChange: (ratio: '16:9' | '1:1' | '9:16') => void
  selectedScenes: number[]
  extractedScenes: ExtractedScene[]
  isGenerating: boolean
  isExtractingScenes: boolean
}

export function ImageStyleSelector({
  selectedImageStyle,
  onImageStyleChange,
  aspectRatio,
  onAspectRatioChange,
  selectedScenes,
  extractedScenes,
  isGenerating,
  isExtractingScenes
}: ImageStyleSelectorProps) {
  // Helper function to apply image style to prompt
  const applyImageStyle = (basePrompt: string) => {
    if (!selectedImageStyle || selectedImageStyle === 'none') return basePrompt
    
    const selectedStyle = IMAGE_STYLES.find(style => style.value === selectedImageStyle)
    if (!selectedStyle || !selectedStyle.prefix) return basePrompt
    
    return `${selectedStyle.prefix}${basePrompt}`
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Image Style Selection */}
        <div className="space-y-3">
          <Label htmlFor="image-style">Image Style</Label>
          <Select
            value={selectedImageStyle}
            onValueChange={onImageStyleChange}
            disabled={isGenerating || isExtractingScenes}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an image style..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {IMAGE_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Style will be applied to all generated images
          </p>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-3">
          <Label>Aspect Ratio</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: '16:9', label: 'Landscape', desc: '16:9' },
              { value: '1:1', label: 'Square', desc: '1:1' },
              { value: '9:16', label: 'Portrait', desc: '9:16' }
            ].map((ratio) => (
              <Button
                key={ratio.value}
                variant={aspectRatio === ratio.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onAspectRatioChange(ratio.value as '16:9' | '1:1' | '9:16')}
                disabled={isGenerating}
                className="flex flex-col h-auto py-3"
              >
                <span className="font-medium">{ratio.label}</span>
                <span className="text-xs opacity-70">{ratio.desc}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt Preview */}
      {selectedImageStyle && selectedImageStyle !== 'none' && (
        <div className="space-y-3">
          <Label>Style Preview</Label>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">
              ✨ Your prompts will be prefixed with the selected style:
            </p>
            <div className="text-xs text-blue-700 space-y-2">
              <div className="p-2 bg-white border border-blue-100 rounded">
                <span className="font-semibold text-blue-900">Style Prefix:</span>{' '}
                <span className="font-mono">{IMAGE_STYLES.find(style => style.value === selectedImageStyle)?.prefix}</span>
              </div>
              <div className="p-2 bg-white border border-blue-100 rounded">
                <span className="font-semibold text-blue-900">Example Final Prompt:</span>{' '}
                <span className="font-mono text-gray-800">
                  {selectedScenes.length > 0 && extractedScenes[selectedScenes[0]] 
                    ? applyImageStyle(extractedScenes[selectedScenes[0]].imagePrompt)
                    : applyImageStyle("A mystical figure meditating in an ancient temple surrounded by glowing symbols")
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 