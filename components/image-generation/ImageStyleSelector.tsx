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
import type { ExtractedScene, RecraftStyle, IdeogramStyle, LeonardoStyleUUID } from '@/types/image-generation'

interface ImageStyleSelectorProps {
  selectedImageStyle: string
  onImageStyleChange: (style: string) => void
  aspectRatio: string
  onAspectRatioChange: (ratio: '16:9' | '1:1' | '9:16') => void
  selectedScenes: number[]
  extractedScenes: ExtractedScene[]
  isGenerating: boolean
  isExtractingScenes: boolean
  customStyles?: Array<{value: string, label: string, prefix: string}>
  onCustomStylesChange?: (styles: Array<{value: string, label: string, prefix: string}>) => void
  selectedModel?: string
  recraftStyle?: string
  onRecraftStyleChange?: (style: string) => void
  ideogramStyle?: string
  onIdeogramStyleChange?: (style: string) => void
  negativePrompt?: string
  onNegativePromptChange?: (prompt: string) => void
  leonardoStyleUUID?: string
  onLeonardoStyleUUIDChange?: (uuid: string) => void
}

export function ImageStyleSelector({
  selectedImageStyle,
  onImageStyleChange,
  aspectRatio,
  onAspectRatioChange,
  selectedScenes,
  extractedScenes,
  isGenerating,
  isExtractingScenes,
  customStyles = [],
  onCustomStylesChange,
  selectedModel,
  recraftStyle = 'realistic_image',
  onRecraftStyleChange,
  ideogramStyle = 'AUTO',
  onIdeogramStyleChange,
  negativePrompt = '',
  onNegativePromptChange,
  leonardoStyleUUID = '111dc692-d470-4eec-b791-3475abac4c46',
  onLeonardoStyleUUIDChange
}: ImageStyleSelectorProps) {
  const [showCustomStyle, setShowCustomStyle] = useState(false)
  const [customStyleName, setCustomStyleName] = useState('')
  const [customStylePrefix, setCustomStylePrefix] = useState('')
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null)
  const [editingStyleName, setEditingStyleName] = useState('')
  const [editingStylePrefix, setEditingStylePrefix] = useState('')

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
    if (customStyleName.trim() && customStylePrefix.trim() && onCustomStylesChange) {
      const newStyle = {
        value: `custom-${Date.now()}`,
        label: customStyleName.trim(),
        prefix: customStylePrefix.trim() + (customStylePrefix.trim().endsWith(' ') ? '' : ', ')
      }
      onCustomStylesChange([...customStyles, newStyle])
      onImageStyleChange(newStyle.value)
      setCustomStyleName('')
      setCustomStylePrefix('')
      setShowCustomStyle(false)
    }
  }

  const handleRemoveCustomStyle = (valueToRemove: string) => {
    if (onCustomStylesChange) {
      onCustomStylesChange(customStyles.filter(style => style.value !== valueToRemove))
    }
    if (selectedImageStyle === valueToRemove) {
      onImageStyleChange('none')
    }
  }

  const handleEditCustomStyle = (style: {value: string, label: string, prefix: string}) => {
    setEditingStyleId(style.value)
    setEditingStyleName(style.label)
    setEditingStylePrefix(style.prefix.replace(/, $/, '')) // Remove trailing comma and space
    setShowCustomStyle(true)
  }

  const handleSaveEditedStyle = () => {
    if (editingStyleId && customStyleName.trim() && customStylePrefix.trim() && onCustomStylesChange) {
      const updatedStyle = {
        value: editingStyleId,
        label: customStyleName.trim(),
        prefix: customStylePrefix.trim() + (customStylePrefix.trim().endsWith(' ') ? '' : ', ')
      }
      onCustomStylesChange(customStyles.map(style => 
        style.value === editingStyleId ? updatedStyle : style
      ))
      
      // Reset editing state
      setEditingStyleId(null)
      setCustomStyleName('')
      setCustomStylePrefix('')
      setShowCustomStyle(false)
    }
  }
  
  const handleCancelEdit = () => {
    setEditingStyleId(null)
    setCustomStyleName('')
    setCustomStylePrefix('')
    setShowCustomStyle(false)
  }

  // Recraft V3 style options grouped by category
  const recraftStyleOptions = [
    {
      category: 'Realistic Image',
      styles: [
        { value: 'realistic_image', label: 'Realistic Image (Default)' },
        { value: 'realistic_image/b_and_w', label: 'Black & White' },
        { value: 'realistic_image/hard_flash', label: 'Hard Flash' },
        { value: 'realistic_image/hdr', label: 'HDR' },
        { value: 'realistic_image/natural_light', label: 'Natural Light' },
        { value: 'realistic_image/studio_portrait', label: 'Studio Portrait' },
        { value: 'realistic_image/enterprise', label: 'Enterprise' },
        { value: 'realistic_image/motion_blur', label: 'Motion Blur' },
        { value: 'realistic_image/evening_light', label: 'Evening Light' },
        { value: 'realistic_image/faded_nostalgia', label: 'Faded Nostalgia' },
        { value: 'realistic_image/forest_life', label: 'Forest Life' },
        { value: 'realistic_image/mystic_naturalism', label: 'Mystic Naturalism' },
        { value: 'realistic_image/natural_tones', label: 'Natural Tones' },
        { value: 'realistic_image/organic_calm', label: 'Organic Calm' },
        { value: 'realistic_image/real_life_glow', label: 'Real Life Glow' },
        { value: 'realistic_image/retro_realism', label: 'Retro Realism' },
        { value: 'realistic_image/retro_snapshot', label: 'Retro Snapshot' },
        { value: 'realistic_image/urban_drama', label: 'Urban Drama' },
        { value: 'realistic_image/village_realism', label: 'Village Realism' },
        { value: 'realistic_image/warm_folk', label: 'Warm Folk' }
      ]
    },
    {
      category: 'Digital Illustration', 
      styles: [
        { value: 'digital_illustration', label: 'Digital Illustration (Default)' },
        { value: 'digital_illustration/pixel_art', label: 'Pixel Art' },
        { value: 'digital_illustration/hand_drawn', label: 'Hand Drawn' },
        { value: 'digital_illustration/grain', label: 'Grain' },
        { value: 'digital_illustration/infantile_sketch', label: 'Infantile Sketch' },
        { value: 'digital_illustration/2d_art_poster', label: '2D Art Poster' },
        { value: 'digital_illustration/handmade_3d', label: 'Handmade 3D' },
        { value: 'digital_illustration/hand_drawn_outline', label: 'Hand Drawn Outline' },
        { value: 'digital_illustration/engraving_color', label: 'Engraving Color' },
        { value: 'digital_illustration/2d_art_poster_2', label: '2D Art Poster 2' },
        { value: 'digital_illustration/antiquarian', label: 'Antiquarian' },
        { value: 'digital_illustration/bold_fantasy', label: 'Bold Fantasy' },
        { value: 'digital_illustration/child_book', label: 'Child Book' },
        { value: 'digital_illustration/child_books', label: 'Child Books' },
        { value: 'digital_illustration/cover', label: 'Cover' },
        { value: 'digital_illustration/crosshatch', label: 'Crosshatch' },
        { value: 'digital_illustration/digital_engraving', label: 'Digital Engraving' },
        { value: 'digital_illustration/expressionism', label: 'Expressionism' },
        { value: 'digital_illustration/freehand_details', label: 'Freehand Details' },
        { value: 'digital_illustration/grain_20', label: 'Grain 20' },
        { value: 'digital_illustration/graphic_intensity', label: 'Graphic Intensity' },
        { value: 'digital_illustration/hard_comics', label: 'Hard Comics' },
        { value: 'digital_illustration/long_shadow', label: 'Long Shadow' },
        { value: 'digital_illustration/modern_folk', label: 'Modern Folk' },
        { value: 'digital_illustration/multicolor', label: 'Multicolor' },
        { value: 'digital_illustration/neon_calm', label: 'Neon Calm' },
        { value: 'digital_illustration/noir', label: 'Noir' },
        { value: 'digital_illustration/nostalgic_pastel', label: 'Nostalgic Pastel' },
        { value: 'digital_illustration/outline_details', label: 'Outline Details' },
        { value: 'digital_illustration/pastel_gradient', label: 'Pastel Gradient' },
        { value: 'digital_illustration/pastel_sketch', label: 'Pastel Sketch' },
        { value: 'digital_illustration/pop_art', label: 'Pop Art' },
        { value: 'digital_illustration/pop_renaissance', label: 'Pop Renaissance' },
        { value: 'digital_illustration/street_art', label: 'Street Art' },
        { value: 'digital_illustration/tablet_sketch', label: 'Tablet Sketch' },
        { value: 'digital_illustration/urban_glow', label: 'Urban Glow' },
        { value: 'digital_illustration/urban_sketching', label: 'Urban Sketching' },
        { value: 'digital_illustration/vanilla_dreams', label: 'Vanilla Dreams' },
        { value: 'digital_illustration/young_adult_book', label: 'Young Adult Book' },
        { value: 'digital_illustration/young_adult_book_2', label: 'Young Adult Book 2' }
      ]
    },
    {
      category: 'Vector Illustration',
      styles: [
        { value: 'vector_illustration', label: 'Vector Illustration (Default - 2X Cost)' },
        { value: 'vector_illustration/bold_stroke', label: 'Bold Stroke' },
        { value: 'vector_illustration/chemistry', label: 'Chemistry' },
        { value: 'vector_illustration/colored_stencil', label: 'Colored Stencil' },
        { value: 'vector_illustration/contour_pop_art', label: 'Contour Pop Art' },
        { value: 'vector_illustration/cosmics', label: 'Cosmics' },
        { value: 'vector_illustration/cutout', label: 'Cutout' },
        { value: 'vector_illustration/depressive', label: 'Depressive' },
        { value: 'vector_illustration/editorial', label: 'Editorial' },
        { value: 'vector_illustration/emotional_flat', label: 'Emotional Flat' },
        { value: 'vector_illustration/infographical', label: 'Infographical' },
        { value: 'vector_illustration/marker_outline', label: 'Marker Outline' },
        { value: 'vector_illustration/mosaic', label: 'Mosaic' },
        { value: 'vector_illustration/naivector', label: 'Naivector' },
        { value: 'vector_illustration/roundish_flat', label: 'Roundish Flat' },
        { value: 'vector_illustration/segmented_colors', label: 'Segmented Colors' },
        { value: 'vector_illustration/sharp_contrast', label: 'Sharp Contrast' },
        { value: 'vector_illustration/thin', label: 'Thin' },
        { value: 'vector_illustration/vector_photo', label: 'Vector Photo' },
        { value: 'vector_illustration/vivid_shapes', label: 'Vivid Shapes' },
        { value: 'vector_illustration/engraving', label: 'Engraving' },
        { value: 'vector_illustration/line_art', label: 'Line Art' },
        { value: 'vector_illustration/line_circuit', label: 'Line Circuit' },
        { value: 'vector_illustration/linocut', label: 'Linocut' }
      ]
    },
    {
      category: 'Special',
      styles: [
        { value: 'any', label: 'Any Style' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Recraft V3 Style Selection - Show only when Recraft V3 is selected */}
        {selectedModel === 'recraft-v3' && onRecraftStyleChange && (
          <div className="space-y-3 md:col-span-2 lg:col-span-3">
            <Label htmlFor="recraft-style">Recraft V3 Style</Label>
            <Select
              value={recraftStyle}
              onValueChange={onRecraftStyleChange}
              disabled={isGenerating || isExtractingScenes}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a Recraft V3 style..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {recraftStyleOptions.map((category) => (
                  <div key={category.category}>
                    <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t mt-1 pt-2">
                      {category.category}
                      {category.category === 'Vector Illustration' && (
                        <span className="text-red-500 ml-1">(2X Cost)</span>
                      )}
                    </div>
                    {category.styles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Recraft V3 style will be applied to all generated images. Vector styles cost 2X as much.
            </p>
          </div>
        )}

        {/* Ideogram V3 Style Selection */}
        {selectedModel === 'ideogram-v3' && onIdeogramStyleChange && (
          <div className="space-y-3">
            <Label htmlFor="ideogram-style">Ideogram V3 Style</Label>
            <Select
              value={ideogramStyle}
              onValueChange={onIdeogramStyleChange}
              disabled={isGenerating || isExtractingScenes}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an Ideogram V3 style..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto (Default)</SelectItem>
                <SelectItem value="GENERAL">General</SelectItem>
                <SelectItem value="REALISTIC">Realistic</SelectItem>
                <SelectItem value="DESIGN">Design</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the style type for Ideogram V3 image generation.
            </p>
          </div>
        )}

        {/* Stable Diffusion Negative Prompt */}
        {(selectedModel === 'stable-diffusion-v35-large' || selectedModel === 'stable-diffusion-v35-medium') && onNegativePromptChange && (
          <div className="space-y-3 md:col-span-2 lg:col-span-3">
            <Label htmlFor="negative-prompt">Negative Prompt</Label>
            <Textarea
              id="negative-prompt"
              placeholder="e.g., 'blurry, low resolution, moustache, bad anatomy, distorted'"
              value={negativePrompt}
              onChange={(e) => onNegativePromptChange(e.target.value)}
              disabled={isGenerating || isExtractingScenes}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Specify what you don't want in the image (colors, objects, details, quality issues).
            </p>
          </div>
        )}

        {/* Leonardo Phoenix Style Selection */}
        {selectedModel === 'leonardo-phoenix' && onLeonardoStyleUUIDChange && (
          <div className="space-y-3 md:col-span-2 lg:col-span-3">
            <Label htmlFor="leonardo-style">Leonardo Phoenix Style</Label>
            <Select
              value={leonardoStyleUUID}
              onValueChange={onLeonardoStyleUUIDChange}
              disabled={isGenerating || isExtractingScenes}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a Leonardo Phoenix style..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <div className="px-2 py-1 text-xs font-medium text-blue-600 border-b mb-2">
                  Photography Styles
                </div>
                <SelectItem value="7c3f932b-a572-47cb-9b9b-f20211e63b5b">Pro Color Photography</SelectItem>
                <SelectItem value="22a9a7d2-2166-4d86-80ff-22e2643adbcf">Pro B&W Photography</SelectItem>
                <SelectItem value="581ba6d6-5aac-4492-bebe-54c424a0d46e">Pro Film Photography</SelectItem>
                <SelectItem value="8e2bc543-6ee2-45f9-bcd9-594b6ce84dcd">Portrait</SelectItem>
                <SelectItem value="0d34f8e1-46d4-428f-8ddd-4b11811fa7c9">Portrait Fashion</SelectItem>
                <SelectItem value="9fdc5e8c-4d13-49b4-9ce6-5a74cbb19177">Bokeh</SelectItem>
                <SelectItem value="30c1d34f-e3a9-479a-b56f-c018bbc9c02a">Macro</SelectItem>
                <SelectItem value="5bdc3f2a-1be6-4d1c-8e77-992a30824a2c">Stock Photo</SelectItem>
                
                <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t border-b mt-2 mb-2 pt-2">
                  Cinematic & Artistic
                </div>
                <SelectItem value="a5632c7c-ddbb-4e2f-ba34-8456ab3ac436">Cinematic</SelectItem>
                <SelectItem value="33abbb99-03b9-4dd7-9761-ee98650b2c88">Cinematic Concept</SelectItem>
                <SelectItem value="111dc692-d470-4eec-b791-3475abac4c46">Dynamic (Default)</SelectItem>
                <SelectItem value="6fedbf1f-4a17-45ec-84fb-92fe524a29ef">Creative</SelectItem>
                <SelectItem value="621e1c9a-6319-4bee-a12d-ae40659162fa">Moody</SelectItem>
                <SelectItem value="dee282d3-891f-4f73-ba02-7f8131e5541b">Vibrant</SelectItem>
                <SelectItem value="97c20e5c-1af6-4d42-b227-54d03d8f0727">HDR</SelectItem>
                <SelectItem value="b504f83c-3326-4947-82e1-7fe9e839ec0f">Ray Traced</SelectItem>
                
                <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t border-b mt-2 mb-2 pt-2">
                  Illustration & Design
                </div>
                <SelectItem value="645e4195-f63d-4715-a3f2-3fb1e6eb8c70">Illustration</SelectItem>
                <SelectItem value="be8c6b58-739c-4d44-b9c1-b032ed308b61">Sketch (B&W)</SelectItem>
                <SelectItem value="093accc3-7633-4ffd-82da-d34000dfc0d6">Sketch (Color)</SelectItem>
                <SelectItem value="2e74ec31-f3a4-4825-b08b-2894f6d13941">Graphic Design Pop Art</SelectItem>
                <SelectItem value="1fbb6a68-9319-44d2-8d56-2957ca0ece6a">Graphic Design Vector</SelectItem>
                
                <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t border-b mt-2 mb-2 pt-2">
                  Fashion & 3D
                </div>
                <SelectItem value="594c4a08-a522-4e0e-b7ff-e4dac4b6b622">Fashion</SelectItem>
                <SelectItem value="debdf72a-91a4-467b-bf61-cc02bdeb69c6">3D Render</SelectItem>
                
                <div className="px-2 py-1 text-xs font-medium text-blue-600 border-t border-b mt-2 mb-2 pt-2">
                  Minimalist & Other
                </div>
                <SelectItem value="cadc8cd6-7838-4c99-b645-df76be8ba8d8">Minimalist</SelectItem>
                <SelectItem value="556c1ee5-ec38-42e8-955a-1e82dad0ffa1">None</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose a preset style for Leonardo Phoenix image generation.
            </p>
          </div>
        )}

        {/* Image Style Selection - Hide when model has its own style system */}
        {!['recraft-v3', 'ideogram-v3', 'stable-diffusion-v35-large', 'stable-diffusion-v35-medium', 'leonardo-phoenix'].includes(selectedModel || '') && (
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCustomStyle(style)
                            }}
                            className="h-4 w-4 p-0 text-blue-500 hover:text-blue-700"
                            title="Edit style"
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveCustomStyle(style.value)
                            }}
                            className="h-4 w-4 p-0 ml-1 text-red-500 hover:text-red-700"
                            title="Remove style"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
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
        )}

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
              {editingStyleId ? 'Edit Custom Style' : 'Create Custom Style'}
            </CardTitle>
            <CardDescription>
              {editingStyleId ? 'Edit your custom image style' : 'Add your own image style with a custom prefix that will be added to all prompts'}
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
                onClick={editingStyleId ? handleSaveEditedStyle : handleAddCustomStyle}
                disabled={!customStyleName.trim() || !customStylePrefix.trim()}
              >
                <Save className="h-4 w-4 mr-1" />
                {editingStyleId ? 'Save Changes' : 'Save Custom Style'}
              </Button>
              <Button 
                variant="outline" 
                onClick={editingStyleId ? handleCancelEdit : () => {
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