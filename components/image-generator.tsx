'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setManualPrompt,
  setSelectedProvider,
  setNewCustomPrompt,
  addCustomPrompt,
  removeCustomPrompt,
  toggleSectionSelection,
  clearSelectedSections,
  selectAllSections,
  setSelectedImageStyle,
  setCustomStyleInput,
  setImageTonePreference,
  startSceneExtraction,
  setExtractedScenes,
  setSceneExtractionError,
  setNumberOfScenesToExtract,
  toggleSceneSelection,
  clearSelectedScenes,
  selectAllScenes,
  setActiveImageSource,
  setThumbnailPrompt,
  startThumbnailGeneration,
  setThumbnailUrl,
  setThumbnailError,
  setThumbnailStyle,
  setCustomThumbnailStyle,
  setThumbnailTone,
  startImageGeneration,
  updateGenerationProgress,
  addGeneratedImageSet,
  completeImageGeneration,
  setImageGenerationError,
  toggleImageSelectionForRegeneration,
  clearSelectedImagesForRegeneration,
  startRegeneration,
  completeRegeneration,
  startEditingImage,
  setEditedPrompt,
  cancelEditing,
  clearGeneratedImages
} from '../lib/features/images/imageGenerationSlice'
import type { GeneratedImageSet, ExtractedScene } from '../lib/features/images/imageGenerationSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Slider } from './ui/slider'
import { ImageIcon, Download, RefreshCw, Plus, Check, X, FileText, CheckCircle } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export function ImageGenerator() {
  const dispatch = useAppDispatch()
  
  // Get state from Redux
  const {
    imageSets,
    isGenerating,
    selectedProvider,
    manualPrompt,
    selectedImages,
    selectedSections,
    customPrompts,
    newCustomPrompt,
    selectedImageStyle,
    customStyleInput,
    imageTonePreference,
    extractedScenes,
    isExtractingScenes,
    sceneExtractionError,
    numberOfScenesToExtract,
    selectedScenes,
    activeImageSource,
    thumbnailPrompt,
    isGeneratingThumbnail,
    thumbnailUrl,
    thumbnailError,
    thumbnailStyle,
    customThumbnailStyle,
    thumbnailTone,
    regenerating,
    regeneratingPrompt,
    regeneratingType,
    editingImageIndex,
    editedPrompt,
    generatingInfo,
    generationError
  } = useAppSelector(state => state.imageGeneration)

  // Get script sections from script Redux state
  const { scriptSections, hasScriptSections, fullScript, hasFullScript } = useAppSelector(state => state.scripts)

  // Local state for new features
  const [selectedImagesForVideo, setSelectedImagesForVideo] = useState<Set<string>>(new Set())

  // Handle extract scenes button click
  const handleExtractScenesClick = async () => {
    if (!hasFullScript || !fullScript) {
      // Provide sample script for demonstration
      const sampleScript = "A mysterious figure walks through a foggy forest. The trees tower overhead, creating dramatic shadows. In the distance, a castle can be seen through the mist."
      
      dispatch(startSceneExtraction(numberOfScenesToExtract))
      
      try {
        const response = await fetch('/api/extract-scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: sampleScript,
            numberOfScenes: numberOfScenesToExtract
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to extract scenes')
        }
        
        const data = await response.json()
        dispatch(setExtractedScenes(data.scenes))
      } catch (error: any) {
        dispatch(setSceneExtractionError(error.message))
      }
      return
    }
    
    dispatch(startSceneExtraction(numberOfScenesToExtract))
    
    try {
      // Use the cleaned script from Redux state
      const scriptToUse = fullScript.scriptCleaned || fullScript.scriptWithMarkdown
      
      const response = await fetch('/api/extract-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptToUse,
          numberOfScenes: numberOfScenesToExtract
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract scenes')
      }
      
      const data = await response.json()
      dispatch(setExtractedScenes(data.scenes))
    } catch (error: any) {
      dispatch(setSceneExtractionError(error.message))
    }
  }

  // Get selected prompts based on active source
  const getSelectedPrompts = () => {
    if (activeImageSource === 'scenes') {
      return selectedScenes
        .map(index => extractedScenes[index]?.imagePrompt)
        .filter(Boolean) as string[]
    } else {
      const sectionPrompts = selectedSections
        .map(index => scriptSections[index]?.image_generation_prompt)
        .filter(Boolean) as string[]
      
      return [...sectionPrompts, ...customPrompts]
    }
  }

  // Handle generate images
  const handleGenerateClick = async () => {
    const selectedPrompts = getSelectedPrompts()
    
    // Add style enhancements to image generation
    let styleEnhancement = ""
    if (imageTonePreference === "light") {
      styleEnhancement = ", bright lighting, well-lit scene, vibrant, daytime"
    } else if (imageTonePreference === "dark") {
      styleEnhancement = ", dramatic lighting, dark atmosphere, shadows, low-key lighting"
    } else {
      styleEnhancement = ", balanced lighting, natural light"
    }
    
    let promptsToUse: string[] = []
    
    if (selectedPrompts.length > 0) {
      promptsToUse = selectedPrompts
    } else if (manualPrompt.trim() !== "") {
      promptsToUse = [manualPrompt.trim()]
    } else {
      console.error("No prompt provided for image generation.")
      return
    }

    // Enhance prompts with style
    const enhancedPrompts = promptsToUse.map(prompt => {
      return customStyleInput 
        ? `${prompt} (Style: ${customStyleInput}${styleEnhancement})`
        : `${prompt} (Style: ${selectedImageStyle}${styleEnhancement})`
    })

    const generationId = uuidv4()
    dispatch(startImageGeneration({
      id: generationId,
      prompts: enhancedPrompts,
      provider: selectedProvider,
      numberOfImages: 1
    }))

    try {
      const combinedPrompt = enhancedPrompts.join('|||||')
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          prompt: combinedPrompt,
          numberOfImages: 1
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate images')
      }

      const data = await response.json()
      
      // Add each prompt's results as separate image sets
      enhancedPrompts.forEach((prompt, index) => {
        const imageSet: GeneratedImageSet = {
          originalPrompt: prompt,
          imageUrls: data.imageUrls ? [data.imageUrls[index]] : [],
          imageData: data.imageData ? [data.imageData[index]] : [],
          generatedAt: new Date().toISOString(),
          provider: selectedProvider
        }
        dispatch(addGeneratedImageSet(imageSet))
      })

      dispatch(completeImageGeneration())
    } catch (error: any) {
      dispatch(setImageGenerationError(error.message))
    }
  }

  // Handle thumbnail generation
  const handleGenerateThumbnail = async () => {
    if (!thumbnailPrompt.trim()) return
    
    dispatch(startThumbnailGeneration())
    
    try {
      let styleEnhancement = ""
      if (thumbnailTone === "light") {
        styleEnhancement = ", bright lighting, well-lit scene, vibrant, daytime"
      } else if (thumbnailTone === "dark") {
        styleEnhancement = ", dramatic lighting, dark atmosphere, shadows, low-key lighting"
      }
      
      const enhancedPrompt = customThumbnailStyle 
        ? `${thumbnailPrompt.trim()} (Style: ${customThumbnailStyle}${styleEnhancement})`
        : `${thumbnailPrompt.trim()} (Style: ${thumbnailStyle}${styleEnhancement})`
      
      const response = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancedPrompt })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate thumbnail')
      }
      
      const data = await response.json()
      dispatch(setThumbnailUrl(data.thumbnailUrl))
    } catch (error: any) {
      dispatch(setThumbnailError(error.message))
    }
  }

  // Download image function
  const downloadImage = (url: string, filename: string) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename || 'generated-image.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
      })
      .catch(err => console.error("Failed to download image:", err))
  }

  // Image selection for video generation
  const toggleImageForVideo = (imageId: string) => {
    setSelectedImagesForVideo(prev => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  const selectAllImagesForVideo = () => {
    const allImageIds = new Set<string>()
    imageSets.forEach((set, setIndex) => {
      set.imageUrls.forEach((_, imageIndex) => {
        allImageIds.add(`${setIndex}-url-${imageIndex}`)
      })
      set.imageData.forEach((_, imageIndex) => {
        allImageIds.add(`${setIndex}-b64-${imageIndex}`)
      })
    })
    setSelectedImagesForVideo(allImageIds)
  }

  const clearSelectedImagesForVideo = () => {
    setSelectedImagesForVideo(new Set())
  }

  // Regenerate individual image
  const regenerateImage = async (setIndex: number, imageIndex: number, isBase64: boolean = false) => {
    const imageSet = imageSets[setIndex]
    if (!imageSet) return
    
    try {
      dispatch(startRegeneration({
        type: 'single',
        prompt: imageSet.originalPrompt
      }))

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          prompt: imageSet.originalPrompt,
          numberOfImages: 1
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate image')
      }

      const data = await response.json()
      
      // Create a new image set with the updated image
      const newImageSets = imageSets.map((set, index) => {
        if (index === setIndex) {
          if (isBase64 && data.imageData && data.imageData[0]) {
            return {
              ...set,
              imageData: set.imageData.map((img, imgIndex) => 
                imgIndex === imageIndex ? data.imageData[0] : img
              )
            }
          } else if (!isBase64 && data.imageUrls && data.imageUrls[0]) {
            return {
              ...set,
              imageUrls: set.imageUrls.map((url, urlIndex) => 
                urlIndex === imageIndex ? data.imageUrls[0] : url
              )
            }
          }
        }
        return set
      })

      // Update Redux state with new image sets
      dispatch(clearGeneratedImages())
      newImageSets.forEach(set => dispatch(addGeneratedImageSet(set)))
      dispatch(completeRegeneration())
      
    } catch (error: any) {
      dispatch(setImageGenerationError(error.message))
    }
  }

  // Regenerate all images
  const regenerateAllImages = async () => {
    if (imageSets.length === 0) return

    try {
      dispatch(startRegeneration({
        type: 'all',
        prompt: 'Regenerating all images'
      }))

      // Clear existing images
      dispatch(clearGeneratedImages())

      // Regenerate all with original prompts
      const allPrompts = imageSets.map(set => set.originalPrompt)
      await handleGenerateFromPrompts(allPrompts)

      dispatch(completeRegeneration())
      
    } catch (error: any) {
      dispatch(setImageGenerationError(error.message))
    }
  }

  // Helper function to generate from specific prompts
  const handleGenerateFromPrompts = async (prompts: string[]) => {
    const generationId = uuidv4()
    dispatch(startImageGeneration({
      id: generationId,
      prompts: prompts,
      provider: selectedProvider,
      numberOfImages: 1
    }))

    try {
      const combinedPrompt = prompts.join('|||||')
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          prompt: combinedPrompt,
          numberOfImages: 1
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate images')
      }

      const data = await response.json()
      
      // Add each prompt's results as separate image sets
      prompts.forEach((prompt, index) => {
        const imageSet: GeneratedImageSet = {
          originalPrompt: prompt,
          imageUrls: data.imageUrls ? [data.imageUrls[index]] : [],
          imageData: data.imageData ? [data.imageData[index]] : [],
          generatedAt: new Date().toISOString(),
          provider: selectedProvider
        }
        dispatch(addGeneratedImageSet(imageSet))
      })

      dispatch(completeImageGeneration())
    } catch (error: any) {
      dispatch(setImageGenerationError(error.message))
    }
  }

  // Determine if we have prompts available based on active source
  const promptsAvailable = activeImageSource === 'scenes'
    ? selectedScenes.length > 0
    : (selectedSections.length > 0 || customPrompts.length > 0 || manualPrompt.trim() !== '')
  
  // Count of prompts to be used
  const selectedPromptCount = activeImageSource === 'scenes'
    ? selectedScenes.length
    : (selectedSections.length + customPrompts.length || (manualPrompt.trim() !== '' ? 1 : 0))

  return (
    <Tabs defaultValue="image-generation" className="space-y-8">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="image-generation">Image Generation</TabsTrigger>
        <TabsTrigger value="scene-extraction">Scene Extraction</TabsTrigger>
        <TabsTrigger value="thumbnail-generation">Thumbnail Generation</TabsTrigger>
      </TabsList>

      {/* Scene Extraction Tab */}
      <TabsContent value="scene-extraction">
        <Card>
          <CardHeader>
            <CardTitle>AI Scene Extraction</CardTitle>
            <CardDescription>
              Extract scenes from your script and generate image prompts for each scene.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="number-of-scenes">Number of Scenes</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="number-of-scenes"
                  min={1}
                  max={200}
                  step={1}
                  value={[numberOfScenesToExtract]}
                  onValueChange={(value: number[]) => dispatch(setNumberOfScenesToExtract(value[0]))}
                  disabled={isExtractingScenes}
                  className="flex-grow"
                />
                <span className="w-12 text-center">{numberOfScenesToExtract}</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleExtractScenesClick}
              disabled={isExtractingScenes || !scriptSections.length}
            >
              {isExtractingScenes ? "Extracting Scenes..." : `Extract ${numberOfScenesToExtract} Scenes`}
            </Button>
            
            {sceneExtractionError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                <p className="font-semibold">Error:</p>
                <pre className="whitespace-pre-wrap text-sm">{sceneExtractionError}</pre>
              </div>
            )}
            
            {extractedScenes.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Extracted Scenes ({extractedScenes.length})</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(clearSelectedScenes())}
                      disabled={selectedScenes.length === 0}
                    >
                      Clear
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(selectAllScenes())}
                      disabled={selectedScenes.length === extractedScenes.length}
                    >
                      Select All
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-96 border rounded-md p-4">
                  <div className="space-y-4">
                    {extractedScenes.map((scene, index) => (
                      <div key={index} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id={`scene-${index}`} 
                            checked={selectedScenes.includes(index)}
                            onCheckedChange={() => dispatch(toggleSceneSelection(index))}
                          />
                          <Label htmlFor={`scene-${index}`} className="font-medium cursor-pointer">
                            {scene.summary || `Scene ${index + 1}`}
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
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Image Generation Tab */}
      <TabsContent value="image-generation">
        <Card>
          <CardHeader>
            <CardTitle>AI Image Generator</CardTitle>
            <CardDescription>
              Generate images from script sections, extracted scenes, or custom prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source Selection */}
            {extractedScenes.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={activeImageSource === 'scenes' ? "default" : "outline"}
                  onClick={() => dispatch(setActiveImageSource('scenes'))}
                >
                  <div className="flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2" />
                    Use Extracted Scenes ({extractedScenes.length})
                  </div>
                </Button>
                
                <Button
                  variant={activeImageSource === 'prompts' ? "default" : "outline"}
                  onClick={() => dispatch(setActiveImageSource('prompts'))}
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Use Script Sections ({scriptSections.length})
                </Button>
              </div>
            )}

            {/* Scene Selection */}
            {activeImageSource === 'scenes' && extractedScenes.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Extracted Scenes</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(clearSelectedScenes())}
                      disabled={selectedScenes.length === 0}
                    >
                      Clear
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(selectAllScenes())}
                      disabled={selectedScenes.length === extractedScenes.length}
                    >
                      Select All
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-52 border rounded-md p-4">
                  <div className="space-y-2">
                    {extractedScenes.map((scene, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox 
                          id={`image-scene-${index}`} 
                          checked={selectedScenes.includes(index)}
                          onCheckedChange={() => dispatch(toggleSceneSelection(index))}
                        />
                        <Label htmlFor={`image-scene-${index}`} className="flex-grow cursor-pointer text-sm">
                          <div className="font-medium">{scene.summary || `Scene ${index + 1}`}</div>
                          <div className="text-muted-foreground truncate">{scene.imagePrompt}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Script Section Selection */}
            {activeImageSource === 'prompts' && scriptSections.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Script Sections</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(clearSelectedSections())}
                      disabled={selectedSections.length === 0}
                    >
                      Clear
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => dispatch(selectAllSections(scriptSections.length))}
                      disabled={selectedSections.length === scriptSections.length}
                    >
                      Select All
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-52 border rounded-md p-4">
                  <div className="space-y-2">
                    {scriptSections.map((section, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox 
                          id={`section-${index}`} 
                          checked={selectedSections.includes(index)}
                          onCheckedChange={() => dispatch(toggleSectionSelection(index))}
                        />
                        <Label htmlFor={`section-${index}`} className="flex-grow cursor-pointer text-sm">
                          <div className="font-medium">{section.title}</div>
                          <div className="text-muted-foreground truncate">{section.image_generation_prompt}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Custom Prompts */}
            {activeImageSource === 'prompts' && (
              <div className="space-y-4">
                <Label>Custom Prompts</Label>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a custom image prompt..."
                    value={newCustomPrompt}
                    onChange={(e) => dispatch(setNewCustomPrompt(e.target.value))}
                    disabled={isGenerating || regenerating}
                    className="flex-grow"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => dispatch(addCustomPrompt())}
                    disabled={isGenerating || regenerating || !newCustomPrompt.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {customPrompts.length > 0 && (
                  <div className="space-y-2">
                    {customPrompts.map((prompt, index) => (
                      <div key={index} className="flex items-center gap-2 border rounded-md p-2">
                        <div className="flex-grow text-sm">{prompt}</div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0" 
                          onClick={() => dispatch(removeCustomPrompt(index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual Prompt */}
            {(activeImageSource === 'prompts' && selectedSections.length === 0 && customPrompts.length === 0) || 
             (activeImageSource === 'scenes' && selectedScenes.length === 0) ? (
              <div className="space-y-2">
                <Label htmlFor="manual-prompt">Image Description</Label>
                <Textarea
                  id="manual-prompt"
                  placeholder="Describe an image in detail..."
                  value={manualPrompt}
                  onChange={(e) => dispatch(setManualPrompt(e.target.value))}
                  disabled={isGenerating || regenerating}
                  className="min-h-[100px]"
                />
              </div>
            ) : null}

            {/* Style Options */}
            <div className="space-y-2 border-t pt-4">
              <Label>Image Style</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ["realistic", "Realistic", "Photorealistic style"],
                  ["artistic", "Artistic", "Creative, painterly style"],
                  ["cinematic", "Cinematic", "Movie-like composition"],
                  ["animation", "Animation", "3D/cartoon style"],
                  ["graphic", "Graphic", "Bold, graphic design style"],
                  ["fantasy", "Fantasy", "Fantasy art style"]
                ].map(([value, name, desc]) => (
                  <div 
                    key={value} 
                    onClick={() => dispatch(setSelectedImageStyle(value))}
                    className={`border rounded-md p-3 cursor-pointer text-center transition-colors ${
                      selectedImageStyle === value && !customStyleInput
                        ? "bg-blue-50 border-blue-300" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Style Input */}
            <div className="space-y-2">
              <Label htmlFor="custom-style-input">Custom Style (Optional)</Label>
              <Input
                id="custom-style-input"
                placeholder="E.g., oil painting, watercolor, cyberpunk neon"
                value={customStyleInput}
                onChange={(e) => dispatch(setCustomStyleInput(e.target.value))}
                disabled={isGenerating || regenerating}
              />
            </div>

            {/* Lighting Tone */}
            <div className="space-y-2">
              <Label>Lighting Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["light", "Light", "Bright, well-lit scenes"],
                  ["balanced", "Balanced", "Natural lighting (default)"],
                  ["dark", "Dark", "Dramatic, darker scenes"]
                ].map(([value, name, desc]) => (
                  <div 
                    key={value} 
                    onClick={() => dispatch(setImageTonePreference(value))}
                    className={`border rounded-md p-3 cursor-pointer text-center transition-colors ${
                      imageTonePreference === value
                        ? "bg-blue-50 border-blue-300" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider and Generate Button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="provider-select">Provider</Label>
                <select
                  id="provider-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProvider}
                  onChange={(e) => dispatch(setSelectedProvider(e.target.value))}
                  disabled={isGenerating || regenerating}
                >
                  <option value="openai">OPENAI</option>
                  <option value="minimax">MINIMAX</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Button 
                  className="w-full" 
                  onClick={handleGenerateClick}
                  disabled={isGenerating || regenerating || !promptsAvailable}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                      {generatingInfo || "Generating..."}
                    </>
                  ) : `Generate Image${selectedPromptCount > 1 ? 's' : ''} (${selectedPromptCount} prompt${selectedPromptCount > 1 ? 's' : ''})`}
                </Button>
              </div>
            </div>
            
            {/* Summary Badge */}
            {selectedPromptCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeImageSource === 'scenes' && selectedScenes.length > 0 && (
                  <Badge variant="secondary">
                    {selectedScenes.length} scene{selectedScenes.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                
                {activeImageSource === 'prompts' && selectedSections.length > 0 && (
                  <Badge variant="secondary">
                    {selectedSections.length} script section{selectedSections.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                
                {activeImageSource === 'prompts' && customPrompts.length > 0 && (
                  <Badge variant="secondary">
                    {customPrompts.length} custom prompt{customPrompts.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {generationError && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-semibold">Error:</p>
            <pre className="whitespace-pre-wrap text-sm">{generationError}</pre>
          </div>
        )}

        {/* Generated Images */}
        <div className="space-y-6">
          {isGenerating && imageSets.length === 0 && (
            <div className="h-[400px] flex flex-col items-center justify-center border rounded-lg bg-muted/50 text-center p-6">
              <div className="relative w-32 h-32 mb-6">
                <div className="absolute animate-ping w-full h-full rounded-full bg-primary/30"></div>
                <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/50">
                  <ImageIcon size={48} className="text-white" />
                </div>
              </div>
              
              <div className="w-full max-w-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {generatingInfo || "Generating images..."}
                </h3>
              </div>
            </div>
          )}

          {/* Image Selection Controls */}
          {imageSets.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Image Selection for Video
                    </CardTitle>
                    <CardDescription>
                      Select any number of images to use for video generation
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelectedImagesForVideo}
                      disabled={selectedImagesForVideo.size === 0}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllImagesForVideo}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={regenerateAllImages}
                      disabled={isGenerating || regenerating}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                      Regenerate All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{selectedImagesForVideo.size} of {imageSets.reduce((total, set) => total + set.imageUrls.length + set.imageData.length, 0)} images selected</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* All Images Grid - Display all images from all sets in a single grid */}
          {imageSets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Images</CardTitle>
                <CardDescription>
                  All generated images displayed in a grid (3 per row)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {imageSets.map((set, setIndex) => [
                    // Map through imageUrls
                    ...set.imageUrls.map((url, imageIndex) => {
                      const imageId = `${setIndex}-url-${imageIndex}`
                      const isSelected = selectedImagesForVideo.has(imageId)
                      return (
                        <div key={imageId} className="space-y-2">
                          <div className={`relative group border-2 rounded-lg overflow-hidden shadow-lg aspect-square transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}>
                            {/* Selection checkbox */}
                            <div className="absolute top-2 left-2 z-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleImageForVideo(imageId)}
                                className="bg-white/90 border-gray-400"
                              />
                            </div>
                            
                            <img 
                              src={url} 
                              alt={`Generated image ${setIndex}-${imageIndex}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => downloadImage(url, `generated_image_${setIndex}_${imageIndex}.png`)}
                              >
                                <Download size={16} className="mr-2" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => regenerateImage(setIndex, imageIndex, false)}
                                disabled={isGenerating || regenerating}
                              >
                                <RefreshCw size={16} className={`mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                                Regenerate
                              </Button>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="text-xs text-blue-600 text-center font-medium">
                              ✓ Selected
                            </div>
                          )}
                          <div className="text-xs text-gray-500 text-center truncate">
                            {set.originalPrompt.substring(0, 40)}...
                          </div>
                        </div>
                      )
                    }),
                    // Map through imageData (base64)
                    ...set.imageData.map((b64, imageIndex) => {
                      const imageId = `${setIndex}-b64-${imageIndex}`
                      const isSelected = selectedImagesForVideo.has(imageId)
                      return (
                        <div key={imageId} className="space-y-2">
                          <div className={`relative group border-2 rounded-lg overflow-hidden shadow-lg aspect-square transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}>
                            {/* Selection checkbox */}
                            <div className="absolute top-2 left-2 z-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleImageForVideo(imageId)}
                                className="bg-white/90 border-gray-400"
                              />
                            </div>
                            
                            <img 
                              src={`data:image/png;base64,${b64}`}
                              alt={`Generated image ${setIndex}-${imageIndex} (base64)`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => downloadImage(`data:image/png;base64,${b64}`, `generated_image_b64_${setIndex}_${imageIndex}.png`)}
                              >
                                <Download size={16} className="mr-2" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => regenerateImage(setIndex, imageIndex, true)}
                                disabled={isGenerating || regenerating}
                              >
                                <RefreshCw size={16} className={`mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                                Regenerate
                              </Button>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="text-xs text-blue-600 text-center font-medium">
                              ✓ Selected
                            </div>
                          )}
                          <div className="text-xs text-gray-500 text-center truncate">
                            {set.originalPrompt.substring(0, 40)}...
                          </div>
                        </div>
                      )
                    })
                  ]).flat()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      {/* Thumbnail Generation Tab */}
      <TabsContent value="thumbnail-generation">
        <Card>
          <CardHeader>
            <CardTitle>AI Thumbnail Generator</CardTitle>
            <CardDescription>
              Create high-quality video thumbnails using Leonardo.ai
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thumbnail-prompt">Thumbnail Description</Label>
              <Textarea
                id="thumbnail-prompt"
                placeholder="Describe your thumbnail in detail..."
                value={thumbnailPrompt}
                onChange={(e) => dispatch(setThumbnailPrompt(e.target.value))}
                disabled={isGeneratingThumbnail}
                className="min-h-[100px]"
              />
            </div>

            {/* Thumbnail Style Options */}
            <div className="space-y-2">
              <Label>Thumbnail Style</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ["realistic", "Realistic", "Photorealistic style"],
                  ["artistic", "Artistic", "Creative, painterly style"],
                  ["cinematic", "Cinematic", "Movie-like composition"],
                  ["animation", "Animation", "3D/cartoon style"],
                  ["graphic", "Graphic", "Bold, graphic design style"],
                  ["fantasy", "Fantasy", "Fantasy art style"]
                ].map(([value, name, desc]) => (
                  <div 
                    key={value} 
                    onClick={() => dispatch(setThumbnailStyle(value))}
                    className={`border rounded-md p-3 cursor-pointer text-center transition-colors ${
                      thumbnailStyle === value && !customThumbnailStyle
                        ? "bg-blue-50 border-blue-300" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Thumbnail Style */}
            <div className="space-y-2">
              <Label htmlFor="custom-thumbnail-style">Custom Style (Optional)</Label>
              <Input
                id="custom-thumbnail-style"
                placeholder="E.g., oil painting, watercolor, cyberpunk neon"
                value={customThumbnailStyle}
                onChange={(e) => dispatch(setCustomThumbnailStyle(e.target.value))}
                disabled={isGeneratingThumbnail}
              />
            </div>

            {/* Thumbnail Lighting Tone */}
            <div className="space-y-2">
              <Label>Lighting Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["light", "Light", "Bright, well-lit scenes"],
                  ["balanced", "Balanced", "Natural lighting (default)"],
                  ["dark", "Dark", "Dramatic, darker scenes"]
                ].map(([value, name, desc]) => (
                  <div 
                    key={value} 
                    onClick={() => dispatch(setThumbnailTone(value))}
                    className={`border rounded-md p-3 cursor-pointer text-center transition-colors ${
                      thumbnailTone === value
                        ? "bg-blue-50 border-blue-300" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerateThumbnail}
              disabled={isGeneratingThumbnail || !thumbnailPrompt.trim()}
            >
              {isGeneratingThumbnail ? (
                <>
                  <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                  Generating Thumbnail...
                </>
              ) : "Generate Thumbnail"}
            </Button>

            {thumbnailError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                <p className="font-semibold">Error:</p>
                <pre className="whitespace-pre-wrap text-sm">{thumbnailError}</pre>
              </div>
            )}

            {thumbnailUrl && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generated Thumbnail:</h3>
                <div className="relative group border rounded-lg overflow-hidden shadow-lg aspect-video">
                  <img 
                    src={thumbnailUrl} 
                    alt="Generated Thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => downloadImage(thumbnailUrl, `thumbnail_${thumbnailPrompt.substring(0,20).replace(/\s+/g, '_')}.png`)}
                    >
                      <Download size={16} className="mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
} 