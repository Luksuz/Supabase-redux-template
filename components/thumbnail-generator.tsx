'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { 
  ImageIcon, 
  Download, 
  Trash2, 
  RefreshCw, 
  Upload,
  X,
  Eye,
  Sparkles
} from 'lucide-react'
import { 
  startGeneration,
  updateGenerationInfo,
  completeGeneration,
  failGeneration,
  clearError,
  clearThumbnails,
  removeThumbnail
} from '../lib/features/thumbnailGeneration/thumbnailGenerationSlice'
import type { GeneratedThumbnail } from '../lib/features/thumbnailGeneration/thumbnailGenerationSlice'
import { Slider } from './ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export function ThumbnailGenerator() {
  const dispatch = useAppDispatch()
  const { 
    thumbnails, 
    isGenerating, 
    error, 
    generationInfo
  } = useAppSelector(state => state.thumbnailGeneration)
  
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>('')
  const [guidanceStrength, setGuidanceStrength] = useState(0.5)
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'leonardo' | 'leonardo-phoenix' | 'flux-dev' | 'recraft-v3' | 'stable-diffusion-v35-large' | 'minimax'>('openai')
  const [stylePrefix, setStylePrefix] = useState<string>('')
  const [customStylePrefix, setCustomStylePrefix] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '9:16' | '4:3'>('16:9')

  const generateFinalPrompt = () => {
    const parts: string[] = []
    
    if (title.trim()) {
      parts.push(`Title: "${title.trim()}"`)
    }
    
    if (prompt.trim()) {
      parts.push(prompt.trim())
    }
    
    if (selectedReferenceId) {
      const referenceThumbnail = thumbnails.find(t => t.imageId === selectedReferenceId)
      if (referenceThumbnail) {
        parts.push(`Using previous thumbnail "${referenceThumbnail.title || 'Generated Thumbnail'}" as style guide.`)
      }
    }
    
    const finalPrompt = parts.join('. ')
    return finalPrompt || 'Create an engaging thumbnail'
  }

  const canGenerate = () => {
    return title.trim() || prompt.trim()
  }

  const handleGenerate = async () => {
    if (!canGenerate()) return

    const finalPrompt = generateFinalPrompt()
    
    dispatch(startGeneration({ 
      prompt: finalPrompt, 
      title: title.trim() || undefined,
      referenceImageId: selectedReferenceId || undefined
    }))

    try {
      dispatch(updateGenerationInfo(`Generating thumbnail with ${selectedProvider.toUpperCase()}...`))

      const response = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          referenceImageId: selectedReferenceId || undefined,
          guidanceStrength: guidanceStrength,
          provider: selectedProvider,
          stylePrefix: stylePrefix || undefined,
          customStylePrefix: customStylePrefix || undefined,
          aspectRatio: aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate thumbnail')
      }

      const data = await response.json()
      
      dispatch(completeGeneration({
        thumbnailUrl: data.thumbnailUrl,
        imageId: data.imageId,
        prompt: finalPrompt,
        title: title.trim() || undefined,
        referenceImageId: selectedReferenceId || undefined,
        guidanceStrength: selectedReferenceId ? guidanceStrength : undefined
      }))

      // Clear inputs after successful generation
      setTitle('')
      setPrompt('')
      setSelectedReferenceId('')
      
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to generate thumbnail'
      ))
    }
  }

  const handleRegenerateWithPrompt = async (thumbnail: GeneratedThumbnail, newPrompt: string) => {
    if (!newPrompt.trim()) return

    dispatch(startGeneration({ 
      prompt: newPrompt, 
      title: thumbnail.title,
      referenceImageId: thumbnail.referenceImageId
    }))

    try {
      dispatch(updateGenerationInfo(`Regenerating thumbnail with ${selectedProvider.toUpperCase()}...`))

      const response = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: newPrompt,
          referenceImageId: thumbnail.referenceImageId,
          guidanceStrength: thumbnail.guidanceStrength || 0.5,
          provider: selectedProvider,
          stylePrefix: stylePrefix || undefined,
          customStylePrefix: customStylePrefix || undefined,
          aspectRatio: aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate thumbnail')
      }

      const data = await response.json()
      
      dispatch(completeGeneration({
        thumbnailUrl: data.thumbnailUrl,
        imageId: data.imageId,
        prompt: newPrompt,
        title: thumbnail.title,
        referenceImageId: thumbnail.referenceImageId,
        guidanceStrength: thumbnail.guidanceStrength
      }))
      
    } catch (error) {
      console.error('Error regenerating thumbnail:', error)
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to regenerate thumbnail'
      ))
    }
  }

  const downloadThumbnail = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClearError = () => {
    dispatch(clearError())
  }

  const handleClearAll = () => {
    dispatch(clearThumbnails())
  }

  const handleRemoveThumbnail = (thumbnailId: string) => {
    dispatch(removeThumbnail(thumbnailId))
  }

  useEffect(() => {
    setSelectedReferenceId('')
  }, [selectedProvider])

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Thumbnail Generator</h1>
        <p className="text-gray-600">
          Create compelling thumbnails using multiple AI models including OpenAI DALL-E 3, Leonardo.ai, Flux, and more
        </p>
      </div>

      {/* Generator Form */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Create Thumbnail
          </CardTitle>
          <CardDescription>
            Add a title, description, or reference image to generate your thumbnail. All fields are optional - you can use any combination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              placeholder="Enter your video/content title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerating}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              The title will be incorporated into the visual design of the thumbnail
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI model..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI DALL-E 3 (Recommended)</SelectItem>
                <SelectItem value="leonardo">Leonardo.ai</SelectItem>
                <SelectItem value="leonardo-phoenix">Leonardo Phoenix</SelectItem>
                <SelectItem value="flux-dev">Flux Dev</SelectItem>
                <SelectItem value="recraft-v3">Recraft V3</SelectItem>
                <SelectItem value="stable-diffusion-v35-large">Stable Diffusion 3.5 Large</SelectItem>
                <SelectItem value="minimax">MiniMax</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              OpenAI DALL-E 3 provides the highest quality results for thumbnails
            </p>
          </div>

          {/* Aspect Ratio Selection */}
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select aspect ratio..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (YouTube Thumbnail)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                <SelectItem value="4:3">4:3 (Classic)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              16:9 is recommended for YouTube thumbnails
            </p>
          </div>

          {/* Style Prefix Selection */}
          <div className="space-y-2">
            <Label>Style Preset (Optional)</Label>
            <Select value={stylePrefix || "none"} onValueChange={(value) => setStylePrefix(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a style preset..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No style preset</SelectItem>
                <SelectItem value="youtube-thumbnail">YouTube Thumbnail Style</SelectItem>
                <SelectItem value="cinematic">Cinematic Movie Poster</SelectItem>
                <SelectItem value="esoteric-medieval">Esoteric Medieval</SelectItem>
                <SelectItem value="dark-demonic">Dark Demonic</SelectItem>
                <SelectItem value="renaissance">Renaissance Classical</SelectItem>
                <SelectItem value="gothic">Gothic Dark</SelectItem>
                <SelectItem value="mystical">Mystical Ethereal</SelectItem>
                <SelectItem value="ancient">Ancient Manuscript</SelectItem>
                <SelectItem value="occult">Occult Symbolic</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Style presets automatically enhance your prompt with specific artistic directions
            </p>
          </div>

          {/* Custom Style Prefix */}
          <div className="space-y-2">
            <Label htmlFor="customStylePrefix">Custom Style Prefix (Optional)</Label>
            <Input
              id="customStylePrefix"
              placeholder="e.g., 'Vibrant neon cyberpunk style, futuristic design'"
              value={customStylePrefix}
              onChange={(e) => setCustomStylePrefix(e.target.value)}
              disabled={isGenerating}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              Custom style instructions that will be added before your prompt. Overrides style presets.
            </p>
          </div>

          {/* Additional Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Additional Prompt (Optional)</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the style, mood, colors, or specific elements you want in your thumbnail..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              className="min-h-[100px] text-base"
            />
            <p className="text-xs text-muted-foreground">
              Add specific styling instructions, mood, colors, or visual elements
            </p>
          </div>

          {/* Reference Image Selection */}
          <div className="space-y-2">
            <Label>Reference Image (Optional)</Label>
            <div className="space-y-3">
              {/* Provider-specific reference image info */}
              {selectedProvider === 'leonardo' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">Leonardo.ai: Style Reference</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Use previous thumbnails to guide the style and composition of new generations.
                  </p>
                </div>
              )}
              
              {selectedProvider === 'leonardo-phoenix' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">Leonardo Phoenix: Style Reference</p>
                  <p className="text-xs text-purple-600 mt-1">
                    Use previous thumbnails to guide the style and composition with enhanced contrast and quality.
                  </p>
                </div>
              )}
              
              {selectedProvider === 'minimax' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">MiniMax: Character Reference</p>
                  <p className="text-xs text-purple-600 mt-1">
                    Upload a front-facing person photo to use as character reference. Best with clear face photos.
                  </p>
                </div>
              )}

              {!['leonardo', 'leonardo-phoenix', 'minimax'].includes(selectedProvider) && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Reference images are not supported with {selectedProvider.toUpperCase()}. 
                    Switch to Leonardo.ai, Leonardo Phoenix (style reference) or MiniMax (character reference) to use this feature.
                  </p>
                </div>
              )}

              {/* Reference image selection for Leonardo and Leonardo Phoenix */}
              {(selectedProvider === 'leonardo' || selectedProvider === 'leonardo-phoenix') && thumbnails.length > 0 && (
                <div className="space-y-3">
                  <Select 
                    value={selectedReferenceId || 'none'} 
                    onValueChange={(value) => setSelectedReferenceId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a previous thumbnail as style reference..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No reference image</SelectItem>
                      {thumbnails.map((thumbnail) => (
                        <SelectItem key={thumbnail.imageId} value={thumbnail.imageId}>
                          {thumbnail.title || 'Generated Thumbnail'} - {new Date(thumbnail.generatedAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedReferenceId && (
                    <div className="relative inline-block">
                      <div className="w-48 h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                        <img 
                          src={thumbnails.find(t => t.imageId === selectedReferenceId)?.thumbnailUrl || ''} 
                          alt="Reference" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                        onClick={() => setSelectedReferenceId('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* File upload for MiniMax character reference */}
              {selectedProvider === 'minimax' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload Character Reference Image</p>
                    <p className="text-xs text-gray-500 mb-4">
                      JPG, JPEG, PNG • Max 10MB • Front-facing person photos work best
                    </p>
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Convert to base64 for MiniMax
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            setSelectedReferenceId(base64);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      disabled={isGenerating}
                      className="max-w-xs"
                    />
                  </div>
                  
                  {selectedReferenceId && selectedReferenceId.startsWith('data:image') && (
                    <div className="relative inline-block">
                      <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                        <img 
                          src={selectedReferenceId} 
                          alt="Character Reference" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                        onClick={() => setSelectedReferenceId('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state for Leonardo and Leonardo Phoenix when no thumbnails */}
              {(selectedProvider === 'leonardo' || selectedProvider === 'leonardo-phoenix') && thumbnails.length === 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Generate your first thumbnail to use as style reference</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Previous thumbnails can guide the style of new generations
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Guidance Strength Slider - For Leonardo and Leonardo Phoenix */}
          {selectedReferenceId && (selectedProvider === 'leonardo' || selectedProvider === 'leonardo-phoenix') && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Reference Image Strength</Label>
                <Badge variant="outline">{Math.round(guidanceStrength * 100)}%</Badge>
              </div>
              <Slider
                value={[guidanceStrength]}
                onValueChange={(value) => setGuidanceStrength(value[0])}
                min={0.1}
                max={1.0}
                step={0.1}
                disabled={isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtle influence (10%)</span>
                <span>Strong influence (100%)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Controls how much the reference image influences the generated thumbnail. Higher values follow the reference more closely.
              </p>
            </div>
          )}

          {/* Preview of Final Prompt */}
          {canGenerate() && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800">Generated Prompt Preview</p>
                  <p className="text-sm text-blue-700">"{generateFinalPrompt()}"</p>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedReferenceId && (selectedProvider === 'leonardo' || selectedProvider === 'leonardo-phoenix') && (
                      <Badge variant="outline" className="text-xs">
                        Style Reference: {Math.round(guidanceStrength * 100)}% strength
                      </Badge>
                    )}
                    {selectedReferenceId && selectedProvider === 'minimax' && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                        Character Reference: Uploaded
                      </Badge>
                    )}
                    {stylePrefix && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                        Style: {stylePrefix}
                      </Badge>
                    )}
                    {customStylePrefix && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                        Custom Style
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button 
            className="w-full" 
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate()}
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                {generationInfo || 'Generating Thumbnail...'}
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5 mr-2" />
                Generate Thumbnail ({aspectRatio}) with {selectedProvider.toUpperCase()}
              </>
            )}
          </Button>

          {!canGenerate() && (
            <p className="text-center text-sm text-muted-foreground">
              Please add a title, prompt, or reference image to generate a thumbnail
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-red-800">Generation Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearError}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Thumbnails */}
      {thumbnails.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Generated Thumbnails ({thumbnails.length})</h2>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>

          <ScrollArea className="h-[600px] space-y-4">
            <div className="space-y-4 pr-4">
              {thumbnails.map((thumbnail: GeneratedThumbnail) => (
                <ThumbnailCard 
                  key={thumbnail.id}
                  thumbnail={thumbnail}
                  onRemove={handleRemoveThumbnail}
                  onRegenerate={handleRegenerateWithPrompt}
                  onDownload={downloadThumbnail}
                  isGenerating={isGenerating}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty State */}
      {thumbnails.length === 0 && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">No thumbnails generated yet</h3>
                <p className="text-gray-500">
                  Add a title, prompt, or reference image above to create your first thumbnail
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isGenerating && thumbnails.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 mx-auto border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <ImageIcon className="h-8 w-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {generationInfo || 'Generating thumbnail...'}
                </h3>
                <p className="text-gray-500">
                  {selectedProvider.toUpperCase()} is creating your custom thumbnail. This may take 30-60 seconds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Separate component for individual thumbnail cards
interface ThumbnailCardProps {
  thumbnail: GeneratedThumbnail
  onRemove: (id: string) => void
  onRegenerate: (thumbnail: GeneratedThumbnail, newPrompt: string) => void
  onDownload: (url: string, filename: string) => void
  isGenerating: boolean
}

function ThumbnailCard({ thumbnail, onRemove, onRegenerate, onDownload, isGenerating }: ThumbnailCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratePrompt, setRegeneratePrompt] = useState(thumbnail.prompt)

  const handleRegenerate = () => {
    if (regeneratePrompt.trim() && regeneratePrompt !== thumbnail.prompt) {
      onRegenerate(thumbnail, regeneratePrompt.trim())
      setIsRegenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {thumbnail.title || 'Generated Thumbnail'}
            </CardTitle>
            <CardDescription>
              Generated {new Date(thumbnail.generatedAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsRegenerating(!isRegenerating)}
              disabled={isGenerating}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Adjust
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRemove(thumbnail.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thumbnail Image */}
        <div className="relative group">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
            <img 
              src={thumbnail.thumbnailUrl} 
              alt={thumbnail.title || 'Generated thumbnail'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => onDownload(thumbnail.thumbnailUrl, `thumbnail_${thumbnail.id}.png`)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <Badge className="absolute top-2 left-2 bg-green-600 text-white">
            16:9 Landscape
          </Badge>
        </div>

        {/* Original Prompt */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Original Prompt</Label>
          <div className="p-2 bg-gray-50 rounded text-sm text-gray-700">
            {thumbnail.prompt}
          </div>
        </div>

        {/* Regeneration Interface */}
        {isRegenerating && (
          <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Label className="text-sm font-medium text-blue-800">Adjust and Regenerate</Label>
            <Textarea
              value={regeneratePrompt}
              onChange={(e) => setRegeneratePrompt(e.target.value)}
              placeholder="Modify the prompt to adjust the thumbnail..."
              className="text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleRegenerate}
                disabled={isGenerating || !regeneratePrompt.trim() || regeneratePrompt === thumbnail.prompt}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsRegenerating(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 