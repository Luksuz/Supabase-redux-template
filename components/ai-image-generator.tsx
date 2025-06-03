'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Checkbox } from './ui/checkbox'
import { ScrollArea } from './ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ImageIcon, Download, Trash2, RefreshCw, FileText, Sparkles } from 'lucide-react'
import { 
  setAspectRatio, 
  setNumberOfImages,
  setNumberOfScenesToExtract,
  startSceneExtraction,
  completeSceneExtraction,
  failSceneExtraction,
  clearExtractedScenes,
  startGeneration,
  updateGenerationInfo,
  completeGeneration,
  failGeneration,
  clearError,
  clearImageSets,
  removeImageSet
} from '../lib/features/imageGeneration/imageGenerationSlice'
import type { ExtractedScene, GeneratedImageSet } from '../types/image-generation'
import { v4 as uuidv4 } from 'uuid'

export function AIImageGenerator() {
  const dispatch = useAppDispatch()
  const { 
    imageSets, 
    isGenerating, 
    error, 
    generationInfo,
    aspectRatio,
    numberOfImages,
    extractedScenes,
    isExtractingScenes,
    sceneExtractionError,
    numberOfScenesToExtract
  } = useAppSelector(state => state.imageGeneration)
  
  // Get script from Redux state
  const { sectionedWorkflow, hasGeneratedScripts } = useAppSelector(state => state.scripts)
  
  const [prompt, setPrompt] = useState('')
  const [selectedScenes, setSelectedScenes] = useState<number[]>([])
  const [scriptInput, setScriptInput] = useState('')

  // Get available script sources (prioritized)
  const fullScript = sectionedWorkflow.fullScript || ''
  const sectionPrompts = sectionedWorkflow.sections.length > 0 
    ? sectionedWorkflow.sections.map(s => s.image_generation_prompt || '').filter(Boolean)
    : []
  
  // Determine what script source to use for extraction
  const getScriptForExtraction = () => {
    // Priority: custom input > full script > section prompts joined
    if (scriptInput.trim()) {
      return scriptInput.trim()
    }
    if (fullScript) {
      return fullScript
    }
    if (sectionPrompts.length > 0) {
      return sectionPrompts.join('\n\n')
    }
    return ''
  }

  const getScriptSourceInfo = () => {
    if (scriptInput.trim()) {
      return { source: 'custom', count: scriptInput.length, type: 'Custom script input' }
    }
    if (fullScript) {
      return { source: 'full', count: fullScript.length, type: 'Full generated script' }
    }
    if (sectionPrompts.length > 0) {
      return { source: 'sections', count: sectionPrompts.join('\n\n').length, type: `${sectionPrompts.length} section prompts` }
    }
    return { source: 'none', count: 0, type: 'No script available' }
  }

  const handleExtractScenes = async () => {
    const scriptToUse = getScriptForExtraction()
    
    if (!scriptToUse) {
      dispatch(failSceneExtraction('No script available. Please generate a script first or paste one below.'))
      return
    }

    dispatch(startSceneExtraction({ numberOfScenes: numberOfScenesToExtract }))

    try {
      const response = await fetch('/api/extract-scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: scriptToUse,
          numberOfScenes: numberOfScenesToExtract,
          userId: 'user-123'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract scenes')
      }

      const data = await response.json()
      dispatch(completeSceneExtraction({ scenes: data.scenes }))
    } catch (error) {
      console.error('Error extracting scenes:', error)
      dispatch(failSceneExtraction(
        error instanceof Error ? error.message : 'Failed to extract scenes'
      ))
    }
  }

  const handleGenerateFromScenes = async () => {
    if (selectedScenes.length === 0) return

    const selectedPrompts = selectedScenes.map(index => extractedScenes[index]?.imagePrompt).filter(Boolean)
    
    if (selectedPrompts.length === 0) return

    const generationId = uuidv4()
    
    // Start generation in Redux
    dispatch(startGeneration({ 
      id: generationId, 
      prompt: `Selected scenes: ${selectedPrompts.join(' | ')}`,
      numberOfImages: selectedPrompts.length
    }))

    try {
      dispatch(updateGenerationInfo(`Generating ${selectedPrompts.length} images from selected scenes...`))

      // Generate images for each selected scene
      for (let i = 0; i < selectedPrompts.length; i++) {
        const scenePrompt = selectedPrompts[i]
        dispatch(updateGenerationInfo(`Generating image ${i + 1} of ${selectedPrompts.length}: Scene ${selectedScenes[i] + 1}`))

        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: 'minimax',
            prompt: scenePrompt,
            numberOfImages: 1,
            minimaxAspectRatio: aspectRatio,
            userId: 'user-123'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`Failed to generate image for scene ${i + 1}:`, errorData.error)
          continue
        }

        const data = await response.json()
        
        // Add the generated images to our result
        if (data.imageUrls && data.imageUrls.length > 0) {
          // For now, we'll collect all URLs and complete at the end
          // In a more advanced implementation, you could update progress incrementally
        }
      }

      // For simplicity, generate all at once instead of individually
      const allPrompts = selectedPrompts.join(' ||||||| ')
      
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'minimax',
          prompt: allPrompts,
          numberOfImages: selectedPrompts.length,
          minimaxAspectRatio: aspectRatio,
          userId: 'user-123'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate images')
      }

      const data = await response.json()
      dispatch(completeGeneration({ imageUrls: data.imageUrls }))
      
      // Clear selections after successful generation
      setSelectedScenes([])
    } catch (error) {
      console.error('Error generating images from scenes:', error)
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to generate images from scenes'
      ))
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    const generationId = uuidv4()
    
    // Start generation in Redux
    dispatch(startGeneration({ 
      id: generationId, 
      prompt: prompt.trim(),
      numberOfImages
    }))

    try {
      // Update progress info
      dispatch(updateGenerationInfo(`Generating ${numberOfImages} image${numberOfImages > 1 ? 's' : ''}...`))

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'minimax',
          prompt: prompt.trim(),
          numberOfImages,
          minimaxAspectRatio: aspectRatio,
          userId: 'user-123'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate images')
      }

      const data = await response.json()
      
      // Complete generation with results
      dispatch(completeGeneration({ imageUrls: data.imageUrls }))
      
      // Clear the prompt after successful generation
      setPrompt('')
    } catch (error) {
      console.error('Error generating images:', error)
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to generate images'
      ))
    }
  }

  const downloadImage = (url: string, filename: string) => {
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
    dispatch(clearImageSets())
  }

  const handleRemoveSet = (setId: string) => {
    dispatch(removeImageSet(setId))
  }

  const toggleSceneSelection = (index: number) => {
    setSelectedScenes(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const scriptSourceInfo = getScriptSourceInfo()

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">AI Image Generator</h1>
        <p className="text-gray-600">
          Create stunning images using MiniMax AI - extract scenes from scripts or create from custom prompts
        </p>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Prompts</TabsTrigger>
          <TabsTrigger value="scenes">Scene Extraction</TabsTrigger>
        </TabsList>

        {/* Manual Prompt Generation */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-600" />
                Generate Images
              </CardTitle>
              <CardDescription>
                Describe what you want to see and let MiniMax AI create it for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Image Description</Label>
                <Textarea
                  id="prompt"
                  placeholder="A serene mountain landscape at sunset with a crystal clear lake reflecting the orange and pink sky..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific and descriptive for best results. Include details about style, lighting, and composition.
                </p>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Number of Images */}
                <div className="space-y-3">
                  <Label>Number of Images</Label>
                  <Select
                    value={numberOfImages.toString()}
                    onValueChange={(value: string) => dispatch(setNumberOfImages(parseInt(value)))}
                    disabled={isGenerating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select number of images" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} image{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        onClick={() => dispatch(setAspectRatio(ratio.value as '16:9' | '1:1' | '9:16'))}
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

              {/* Generate Button */}
              <Button 
                className="w-full" 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    {generationInfo || 'Generating...'}
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 mr-2" />
                    Generate {numberOfImages} Image{numberOfImages > 1 ? 's' : ''}
                  </>
                )}
              </Button>

              {/* Quick Settings Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">MiniMax AI</Badge>
                <Badge variant="secondary">{aspectRatio} Aspect Ratio</Badge>
                <Badge variant="secondary">{numberOfImages} Image{numberOfImages > 1 ? 's' : ''}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scene Extraction */}
        <TabsContent value="scenes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Scene Extraction
              </CardTitle>
              <CardDescription>
                Extract scenes from scripts and generate images for each scene
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Script Source Information */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-800">Script Source</span>
                </div>
                {scriptSourceInfo.source !== 'none' ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{scriptSourceInfo.type}</span> 
                      <span className="text-muted-foreground"> ({scriptSourceInfo.count.toLocaleString()} characters)</span>
                    </p>
                    {scriptSourceInfo.source === 'sections' && (
                      <p className="text-xs text-blue-600">Using image generation prompts from script sections</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">No script detected. Please paste a custom script below.</p>
                )}
              </div>

              {/* Custom Script Input */}
              <div className="space-y-2">
                <Label htmlFor="script-input">Custom Script (Optional)</Label>
                <Textarea
                  id="script-input"
                  placeholder="Paste your script here to override the detected script sources..."
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                  disabled={isExtractingScenes}
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  This will take priority over the detected script sources above.
                </p>
              </div>

              {/* Number of Scenes Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Number of Scenes to Extract</Label>
                  <Badge variant="outline">{numberOfScenesToExtract}</Badge>
                </div>
                <Slider
                  value={[numberOfScenesToExtract]}
                  onValueChange={(value) => dispatch(setNumberOfScenesToExtract(value[0]))}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isExtractingScenes}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 scene</span>
                  <span>100 scenes</span>
                </div>
              </div>

              {/* Extract Scenes Button */}
              <Button 
                className="w-full" 
                onClick={handleExtractScenes}
                disabled={isExtractingScenes || scriptSourceInfo.source === 'none'}
                size="lg"
              >
                {isExtractingScenes ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Extracting {numberOfScenesToExtract} Scenes...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Extract {numberOfScenesToExtract} Scenes
                  </>
                )}
              </Button>

              {/* Scene Extraction Error */}
              {sceneExtractionError && (
                <Card className="border-red-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-red-800">Scene Extraction Error</p>
                        <p className="text-sm text-red-600">{sceneExtractionError}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleClearError}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Extracted Scenes */}
              {extractedScenes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Extracted Scenes ({extractedScenes.length})</Label>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedScenes([])}
                        disabled={selectedScenes.length === 0}
                      >
                        Clear
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedScenes(Array.from({length: extractedScenes.length}, (_, i) => i))}
                        disabled={selectedScenes.length === extractedScenes.length}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-96 border rounded-md p-4">
                    <div className="space-y-4">
                      {extractedScenes.map((scene: ExtractedScene, index: number) => (
                        <div key={index} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`scene-${index}`} 
                              checked={selectedScenes.includes(index)}
                              onCheckedChange={() => toggleSceneSelection(index)}
                            />
                            <Label 
                              htmlFor={`scene-${index}`} 
                              className="font-medium cursor-pointer"
                            >
                              {scene.summary}
                            </Label>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <div className="font-medium mb-1">Image Prompt:</div>
                            <div className="italic pl-4 border-l-2 border-muted-foreground/30">{scene.imagePrompt}</div>
                          </div>
                          
                          <details className="text-sm">
                            <summary className="cursor-pointer font-medium">View Original Text</summary>
                            <div className="mt-2 p-2 bg-muted/30 rounded text-muted-foreground max-h-32 overflow-y-auto">
                              {scene.originalText}
                            </div>
                          </details>
                          
                          {scene.error && (
                            <div className="text-sm text-red-500">
                              Error: {scene.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <Button 
                    className="w-full" 
                    onClick={handleGenerateFromScenes}
                    disabled={isGenerating || selectedScenes.length === 0}
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        {generationInfo || 'Generating...'}
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-5 w-5 mr-2" />
                        Generate Images for {selectedScenes.length} Selected Scene{selectedScenes.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      {/* Generated Images */}
      {imageSets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Generated Images ({imageSets.length} sets)</h2>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>

          {imageSets.map((imageSet: GeneratedImageSet, setIndex: number) => (
            <Card key={imageSet.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">"{imageSet.originalPrompt}"</CardTitle>
                    <CardDescription>
                      Generated {new Date(imageSet.generatedAt).toLocaleString()} • 
                      {imageSet.imageUrls.length} image{imageSet.imageUrls.length > 1 ? 's' : ''} • 
                      {imageSet.aspectRatio}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveSet(imageSet.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imageSet.imageUrls.map((url: string, imageIndex: number) => (
                    <div key={imageIndex} className="relative group">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img 
                          src={url} 
                          alt={`Generated image ${imageIndex + 1} for: ${imageSet.originalPrompt}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => downloadImage(url, `minimax_image_${setIndex + 1}_${imageIndex + 1}.png`)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <Badge className="absolute top-2 left-2 bg-black/70 text-white">
                        {imageIndex + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {imageSets.length === 0 && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">No images generated yet</h3>
                <p className="text-gray-500">
                  Use manual prompts or extract scenes from scripts to get started
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isGenerating && imageSets.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <ImageIcon className="h-8 w-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {generationInfo || 'Generating images...'}
                </h3>
                <p className="text-gray-500">
                  MiniMax AI is creating your images. This usually takes 15-30 seconds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 