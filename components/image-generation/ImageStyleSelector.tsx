'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { IMAGE_STYLES } from '@/data/image'
import { Plus, Save, X } from 'lucide-react'
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
  const [showCustomStyle, setShowCustomStyle] = useState(false)
  const [customStyleName, setCustomStyleName] = useState('')
  const [customStylePrefix, setCustomStylePrefix] = useState('')
  const [customStyles, setCustomStyles] = useState<Array<{value: string, label: string, prefix: string}>>([])

  // Helper function to apply image style to prompt
  const applyImageStyle = (basePrompt: string) => {
    if (!selectedImageStyle || selectedImageStyle === 'none') return basePrompt
    
    // Check both built-in and custom styles
    const allStyles = [...IMAGE_STYLES, ...customStyles]
    const selectedStyle = allStyles.find(style => style.value === selectedImageStyle)
    if (!selectedStyle || !selectedStyle.prefix) return basePrompt
    
    return `${selectedStyle.prefix}${basePrompt}`
  }

  const handleAddCustomStyle = () => {
    if (customStyleName.trim() && customStylePrefix.trim()) {
      const newStyle = {
        value: `custom-${Date.now()}`,
        label: customStyleName.trim(),
        prefix: customStylePrefix.trim() + (customStylePrefix.trim().endsWith(' ') ? '' : ', ')
      }
      setCustomStyles(prev => [...prev, newStyle])
      onImageStyleChange(newStyle.value)
      setCustomStyleName('')
      setCustomStylePrefix('')
      setShowCustomStyle(false)
    }
  }

  const handleRemoveCustomStyle = (valueToRemove: string) => {
    setCustomStyles(prev => prev.filter(style => style.value !== valueToRemove))
    if (selectedImageStyle === valueToRemove) {
      onImageStyleChange('none')
    }
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Image Style Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="image-style">Image Style</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomStyle(!showCustomStyle)}
              disabled={isGenerating || isExtractingScenes}
            >
              <Plus className="h-4 w-4 mr-1" />
              Custom
            </Button>
          </div>
          <Select
            value={selectedImageStyle}
            onValueChange={onImageStyleChange}
            disabled={isGenerating || isExtractingScenes}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an image style..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {/* Built-in styles */}
              {IMAGE_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
              
              {/* Custom styles separator */}
              {customStyles.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t mt-1 pt-2">
                    Custom Styles
                  </div>
                  {customStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value} className="relative">
                      <div className="flex items-center justify-between w-full">
                        <span>{style.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveCustomStyle(style.value)
                          }}
                          className="h-4 w-4 p-0 ml-2 text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
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

      {/* Custom Style Creation */}
      {showCustomStyle && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Create Custom Style
            </CardTitle>
            <CardDescription>
              Add your own image style with a custom prefix that will be added to all prompts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-style-name">Style Name</Label>
                <Input
                  id="custom-style-name"
                  placeholder="e.g., Cyberpunk Neon, Vintage Photography..."
                  value={customStyleName}
                  onChange={(e) => setCustomStyleName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom-style-prefix">Style Prefix</Label>
                <Input
                  id="custom-style-prefix"
                  placeholder="e.g., Cyberpunk neon style, Vintage photograph..."
                  value={customStylePrefix}
                  onChange={(e) => setCustomStylePrefix(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Full Style Description (Optional)</Label>
              <Textarea
                placeholder="Add more detailed styling instructions like lighting, mood, camera settings, artistic techniques, etc."
                value={customStylePrefix}
                onChange={(e) => setCustomStylePrefix(e.target.value)}
                className="min-h-[80px]"
              />
              <p className="text-xs text-blue-600">
                💡 Examples: "Cinematic lighting, shallow depth of field, golden hour" or "Black and white film noir style, high contrast, dramatic shadows"
              </p>
            </div>

            {/* Preview */}
            {customStylePrefix.trim() && (
              <div className="p-3 bg-white border border-blue-200 rounded">
                <Label className="text-xs font-medium text-blue-700">Preview:</Label>
                <p className="text-sm font-mono text-gray-700 mt-1">
                  {customStylePrefix.trim() + (customStylePrefix.trim().endsWith(' ') ? '' : ', ')}[your image prompt here]
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleAddCustomStyle}
                disabled={!customStyleName.trim() || !customStylePrefix.trim()}
              >
                <Save className="h-4 w-4 mr-1" />
                Save Custom Style
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCustomStyle(false)
                  setCustomStyleName('')
                  setCustomStylePrefix('')
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                <span className="font-mono">
                  {[...IMAGE_STYLES, ...customStyles].find(style => style.value === selectedImageStyle)?.prefix}
                </span>
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