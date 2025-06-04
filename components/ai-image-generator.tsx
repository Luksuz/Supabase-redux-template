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
import { Progress } from './ui/progress'
import { 
  ImageIcon, 
  Download, 
  Trash2, 
  RefreshCw, 
  FileText, 
  Sparkles,
  Clock,
  Cpu,
  Info
} from 'lucide-react'
import { 
  setSelectedModel,
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
import type { ExtractedScene, GeneratedImageSet, ImageProvider } from '../types/image-generation'
import { v4 as uuidv4 } from 'uuid'

const MODEL_INFO: Record<ImageProvider, {
  name: string;
  description: string;
  batchSize: number;
  rateLimit?: string;
  features: string[];
}> = {
  'minimax': {
    name: 'MiniMax',
    description: 'Fast, reliable image generation with optimized prompts',
    batchSize: 5,
    features: ['Base64 output', 'Prompt optimization', 'Multiple aspect ratios']
  },
  'flux-dev': {
    name: 'FLUX.1 [dev]',
    description: '12B parameter flow transformer for high-quality images',
    batchSize: 10,
    rateLimit: '10/min per batch',
    features: ['High quality', 'Commercial use', 'Advanced prompting']
  },
  'recraft-v3': {
    name: 'Recraft V3',
    description: 'SOTA model with long text, vector art, and brand style',
    batchSize: 10,
    rateLimit: '10/min per batch',
    features: ['Long texts', 'Vector art', 'Brand styles', 'SOTA quality']
  },
  'stable-diffusion-v35-large': {
    name: 'Stable Diffusion 3.5 Large',
    description: 'MMDiT model with improved typography and efficiency',
    batchSize: 10,
    rateLimit: '10/min per batch',
    features: ['Typography', 'Complex prompts', 'Resource efficient']
  },
  'dalle-3': {
    name: 'DALL-E 3',
    description: 'OpenAI\'s most advanced image generation model',
    batchSize: 10,
    rateLimit: '10/min per batch',
    features: ['High quality', 'Text understanding', 'Creative interpretation', 'Base64 output']
  }
}

export function AIImageGenerator() {
  const dispatch = useAppDispatch()
  const { 
    imageSets, 
    isGenerating, 
    error, 
    generationInfo,
    selectedModel,
    aspectRatio,
    numberOfImages,
    extractedScenes,
    isExtractingScenes,
    sceneExtractionError,
    numberOfScenesToExtract
  } = useAppSelector(state => state.imageGeneration)
  
  // Get script from Redux state
  const { sectionedWorkflow, hasGeneratedScripts } = useAppSelector(state => state.scripts)
  
  const [selectedScenes, setSelectedScenes] = useState<number[]>([])
  const [scriptInput, setScriptInput] = useState('')
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentBatch: 0, totalBatches: 0 })

  // Get available script sources (prioritized)
  const fullScript = sectionedWorkflow.fullScript || ''
  const sectionPrompts = sectionedWorkflow.sections.length > 0 
    ? sectionedWorkflow.sections.map(s => s.image_generation_prompt || '').filter(Boolean)
    : []
  
  // Determine what script source to use for extraction
  const getScriptForExtraction = () => {
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

  const handleModelChange = (model: ImageProvider) => {
    dispatch(setSelectedModel(model))
  }

  // Utility function to split array into batches
  const createBatches = <T,>(array: T[], batchSize: number): T[][] => {
    const batches: T[][] = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  // Generate images with batch processing
  const generateImagesBatch = async (prompts: string[], batchIndex: number, totalBatches: number) => {
    const batchSize = MODEL_INFO[selectedModel].batchSize
    const batchPrompts = prompts.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)
    
    setBatchProgress({ 
      current: batchIndex * batchSize, 
      total: prompts.length, 
      currentBatch: batchIndex + 1, 
      totalBatches 
    })

    dispatch(updateGenerationInfo(
      `Processing batch ${batchIndex + 1}/${totalBatches} (${batchPrompts.length} images)...`
    ))

    if (selectedModel === 'minimax') {
      // For MiniMax: send requests sequentially with small delays
      const imageUrls: string[] = []
      
      for (let i = 0; i < batchPrompts.length; i++) {
        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: selectedModel,
            prompt: batchPrompts[i],
            numberOfImages: 1,
            minimaxAspectRatio: aspectRatio,
            userId: 'user-123'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`Failed to generate image ${i + 1} in batch ${batchIndex + 1}:`, errorData.error)
          continue
        }

        const data = await response.json()
        if (data.imageUrls && data.imageUrls.length > 0) {
          imageUrls.push(...data.imageUrls)
        }

        // Update progress for each image
        setBatchProgress(prev => ({ 
          ...prev, 
          current: prev.current + 1 
        }))

        // Small delay between MiniMax requests
        if (i < batchPrompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      return imageUrls
    } else if (selectedModel === 'dalle-3') {
      // For DALL-E 3: efficient parallel batch processing (batch size 20)
      const requestPromises = batchPrompts.map(async (prompt, index) => {
        try {
          const response = await fetch('/api/generate-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: selectedModel,
              prompt: prompt,
              numberOfImages: 1,
              minimaxAspectRatio: aspectRatio,
              userId: 'user-123'
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to generate DALL-E 3 image ${index + 1} in batch ${batchIndex + 1}:`, errorData.error)
            return []
          }

          const data = await response.json()
          return data.imageUrls || []
        } catch (error) {
          console.error(`Error generating DALL-E 3 image ${index + 1} in batch ${batchIndex + 1}:`, error)
          return []
        }
      })

      // Wait for all DALL-E 3 requests in the batch to complete
      const results = await Promise.all(requestPromises)
      const imageUrls = results.flat()

      // Update progress for the entire batch
      setBatchProgress(prev => ({ 
        ...prev, 
        current: prev.current + batchPrompts.length 
      }))

      return imageUrls
    } else {
      // For Flux models: send all requests in parallel
      const requestPromises = batchPrompts.map(async (prompt, index) => {
        try {
          const response = await fetch('/api/generate-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: selectedModel,
              prompt: prompt,
              numberOfImages: 1,
              minimaxAspectRatio: aspectRatio,
              userId: 'user-123'
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to generate image ${index + 1} in batch ${batchIndex + 1}:`, errorData.error)
            return []
          }

          const data = await response.json()
          return data.imageUrls || []
        } catch (error) {
          console.error(`Error generating image ${index + 1} in batch ${batchIndex + 1}:`, error)
          return []
        }
      })

      // Wait for all requests in the batch to complete
      const results = await Promise.all(requestPromises)
      const imageUrls = results.flat()

      // Update progress for the entire batch
      setBatchProgress(prev => ({ 
        ...prev, 
        current: prev.current + batchPrompts.length 
      }))

      return imageUrls
    }
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
    const batchSize = MODEL_INFO[selectedModel].batchSize
    const totalBatches = Math.ceil(selectedPrompts.length / batchSize)
    
    dispatch(startGeneration({ 
      id: generationId, 
      prompt: `Selected scenes: ${selectedPrompts.length} images`,
      numberOfImages: selectedPrompts.length
    }))

    // Reset batch progress
    setBatchProgress({ current: 0, total: selectedPrompts.length, currentBatch: 0, totalBatches })

    try {
      dispatch(updateGenerationInfo(`Starting batch processing: ${selectedPrompts.length} images in ${totalBatches} batches...`))

      const allImageUrls: string[] = []

      // Process each batch
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        try {
          const batchImageUrls = await generateImagesBatch(selectedPrompts, batchIndex, totalBatches)
          allImageUrls.push(...batchImageUrls)
          
          dispatch(updateGenerationInfo(
            `Completed batch ${batchIndex + 1}/${totalBatches}. Generated ${allImageUrls.length}/${selectedPrompts.length} images.`
          ))

          // Different wait times based on model capabilities
          if (selectedModel === 'minimax' || selectedModel === 'dalle-3') {
            // MiniMax and DALL-E 3 have different rate limits, shorter wait
            if (batchIndex < totalBatches - 1) {
              const waitTime = selectedModel === 'dalle-3' ? 10 : 5; // DALL-E 3: 10s, MiniMax: 5s
              dispatch(updateGenerationInfo(
                `Batch ${batchIndex + 1}/${totalBatches} complete. Waiting ${waitTime} seconds before next batch...`
              ))
              
              // Show countdown for the wait time
              for (let countdown = waitTime; countdown > 0; countdown--) {
                dispatch(updateGenerationInfo(
                  `Waiting ${countdown} seconds before processing batch ${batchIndex + 2}/${totalBatches}...`
                ))
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            }
          } else if (batchIndex < totalBatches - 1) {
            // Flux models need longer wait (60 seconds)
            dispatch(updateGenerationInfo(
              `Batch ${batchIndex + 1}/${totalBatches} complete. Waiting 60 seconds before next batch...`
            ))
            
            // Show countdown for the wait time
            for (let countdown = 60; countdown > 0; countdown--) {
              dispatch(updateGenerationInfo(
                `Waiting ${countdown} seconds before processing batch ${batchIndex + 2}/${totalBatches}...`
              ))
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        } catch (error) {
          console.error(`Error in batch ${batchIndex + 1}:`, error)
          // Continue with other batches even if one fails
          dispatch(updateGenerationInfo(
            `Batch ${batchIndex + 1} failed. Continuing with remaining batches...`
          ))
        }
      }

      if (allImageUrls.length > 0) {
        dispatch(completeGeneration({ imageUrls: allImageUrls }))
        setSelectedScenes([])
        setBatchProgress({ current: 0, total: 0, currentBatch: 0, totalBatches: 0 })
      } else {
        throw new Error('No images were successfully generated')
      }
      
    } catch (error) {
      console.error('Error generating images from scenes:', error)
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to generate images from scenes'
      ))
      setBatchProgress({ current: 0, total: 0, currentBatch: 0, totalBatches: 0 })
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
  const currentModel = MODEL_INFO[selectedModel]
  const estimatedBatches = selectedScenes.length > 0 ? Math.ceil(selectedScenes.length / currentModel.batchSize) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">AI Image Generator</h1>
        <p className="text-gray-600">
          Extract scenes from scripts and generate images for each scene using multiple AI models with batch processing
        </p>
      </div>

      {/* Model Selection */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-600" />
            AI Model Selection
          </CardTitle>
          <CardDescription>
            Choose your preferred AI model for image generation. Each model processes images in optimized batches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Object.entries(MODEL_INFO).map(([key, info]) => (
              <div
                key={key}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedModel === key
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => handleModelChange(key as ImageProvider)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{info.name}</h3>
                    {selectedModel === key && (
                      <Badge className="bg-purple-600">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{info.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {info.features.map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Batch size: {info.batchSize}
                    </span>
                    {info.rateLimit && (
                      <span>{info.rateLimit}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Batch Processing Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800">Batch Processing</p>
                <p className="text-sm text-blue-700">
                  {currentModel.name} processes images in batches of {currentModel.batchSize}. 
                  {selectedScenes.length > 0 && (
                    <span className="font-medium">
                      {' '}Your {selectedScenes.length} selected scenes will be processed in {estimatedBatches} batch{estimatedBatches !== 1 ? 'es' : ''}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scene Extraction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Scene Extraction & Image Generation
          </CardTitle>
          <CardDescription>
            Extract scenes from scripts and generate images for each scene
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Script Source Information */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-600" />
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

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {/* Batch Progress */}
              {isGenerating && batchProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {batchProgress.current}/{batchProgress.total} images</span>
                    <span>Batch: {batchProgress.currentBatch}/{batchProgress.totalBatches}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} className="w-full" />
                </div>
              )}
              
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
                    {selectedScenes.length > 0 && (
                      <Badge className="ml-2 bg-blue-600">
                        {estimatedBatches} batch{estimatedBatches !== 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </>
                )}
              </Button>

              {/* Quick Settings Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{currentModel.name}</Badge>
                <Badge variant="secondary">{aspectRatio} Aspect Ratio</Badge>
                <Badge variant="secondary">{selectedScenes.length} Selected Scene{selectedScenes.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  Batch size: {currentModel.batchSize}
                </Badge>
              </div>
            </div>
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
                      {MODEL_INFO[imageSet.provider as keyof typeof MODEL_INFO]?.name || imageSet.provider} • 
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
                            onClick={() => downloadImage(url, `${imageSet.provider}_image_${setIndex + 1}_${imageIndex + 1}.png`)}
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
                  Choose your AI model, extract scenes from your script, and generate images for selected scenes
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
                  {selectedModel === 'minimax' 
                    ? 'MiniMax processes images in batches of 5. Please wait while all batches complete.'
                    : selectedModel === 'dalle-3'
                    ? 'DALL-E 3 processes images in batches of 20 with parallel execution. Please wait while all batches complete.'
                    : `${currentModel.name} processes images in batches of 10. Please wait while all batches complete.`
                  }
                </p>
                {batchProgress.total > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Processing batch {batchProgress.currentBatch} of {batchProgress.totalBatches}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 