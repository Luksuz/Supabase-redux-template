'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { IMAGE_STYLES, LIGHTING_TONES } from '@/data/image'
import { AnimationSceneExtraction } from './animation-generation/AnimationSceneExtraction'
import {
  Zap,
  Upload,
  X,
  Trash2,
  Download,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Palette,
  Sun,
  Moon,
  Play,
  FileText
} from 'lucide-react'

interface ExtractedAnimationScene {
  id: string
  title: string
  prompt: string
  duration?: number
  effects?: string[]
}

export function AnimationGenerator() {
  // Get script data from Redux
  const { scriptSections, fullScript } = useAppSelector(state => state.scripts)
  
  const [animationPrompt, setAnimationPrompt] = useState('')
  const [referenceImages, setReferenceImages] = useState<File[]>([])
  const [isGeneratingAnimation, setIsGeneratingAnimation] = useState(false)
  const [animationResult, setAnimationResult] = useState<string | null>(null)
  const [animationError, setAnimationError] = useState<string | null>(null)
  const [showStyleOptions, setShowStyleOptions] = useState(false)
  
  // Style options
  const [selectedImageStyle, setSelectedImageStyle] = useState('realistic')
  const [selectedLightingTone, setSelectedLightingTone] = useState('balanced')
  const [customStylePrompt, setCustomStylePrompt] = useState('')

  // Scene extraction state
  const [scriptInput, setScriptInput] = useState('')
  const [numberOfScenesToExtract, setNumberOfScenesToExtract] = useState(5)
  const [isExtractingScenes, setIsExtractingScenes] = useState(false)
  const [sceneExtractionError, setSceneExtractionError] = useState<string | null>(null)
  const [extractedScenes, setExtractedScenes] = useState<ExtractedAnimationScene[]>([])
  const [selectedScenes, setSelectedScenes] = useState<number[]>([])
  
  // Unified prompt management
  const [allPrompts, setAllPrompts] = useState<ExtractedAnimationScene[]>([])
  const [mainContext, setMainContext] = useState('')

  // Initialize script input from Redux
  useEffect(() => {
    if (fullScript?.scriptCleaned && !scriptInput.trim()) {
      setScriptInput(fullScript.scriptCleaned)
    } else if (scriptSections.length > 0 && !scriptInput.trim()) {
      // Use the combined writing instructions from all sections
      const combinedScript = scriptSections
        .map(section => section.writingInstructions)
        .filter(instruction => instruction && instruction.trim())
        .join('\n\n')
      setScriptInput(combinedScript)
    }
  }, [fullScript, scriptSections, scriptInput])

  // Get script source info
  const getScriptSourceInfo = () => {
    if (fullScript?.scriptCleaned) {
      return {
        source: 'Full Script',
        count: 1,
        type: 'script'
      }
    } else if (scriptSections.length > 0) {
      return {
        source: 'Script Sections',
        count: scriptSections.length,
        type: 'sections'
      }
    }
    return {
      source: 'Manual Input',
      count: 0,
      type: 'manual'
    }
  }

  const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setReferenceImages([...referenceImages, ...files])
  }

  const removeReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index)
    setReferenceImages(newImages)
  }

  const getImageStyleIcon = (styleKey: string) => {
    switch (styleKey) {
      case 'realistic': return '📸'
      case 'artistic': return '🎨'
      case 'cinematic': return '🎬'
      case 'animation': return '🎭'
      case 'graphic': return '📊'
      case 'fantasy': return '🧙‍♂️'
      default: return '🖼️'
    }
  }

  const getLightingIcon = (tone: string) => {
    switch (tone) {
      case 'light': return <Sun className="h-4 w-4" />
      case 'dark': return <Moon className="h-4 w-4" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  // Helper function to combine styles into final prompt
  const getStyledPrompt = () => {
    let finalPrompt = animationPrompt
    
    // Apply Image Style
    if (selectedImageStyle && selectedImageStyle !== 'none') {
      const style = IMAGE_STYLES[selectedImageStyle as keyof typeof IMAGE_STYLES]
      if (style) {
        finalPrompt = `${style.prefix}${finalPrompt}`
      }
    }
    
    // Apply Lighting Tone
    if (selectedLightingTone && selectedLightingTone !== 'balanced') {
      const tone = LIGHTING_TONES[selectedLightingTone as keyof typeof LIGHTING_TONES]
      if (tone) {
        finalPrompt = `${tone.prefix}${finalPrompt}`
      }
    }
    
    // Apply Custom Style
    if (customStylePrompt && customStylePrompt.trim()) {
      finalPrompt = `${customStylePrompt.trim()}, ${finalPrompt}`
    }
    
    return finalPrompt
  }

  const handleGenerateAnimation = async () => {
    try {
      setIsGeneratingAnimation(true)
      setAnimationError(null)
      
      // Create FormData for the request
      const formData = new FormData()
      formData.append('prompt', getStyledPrompt())
      
      // Add reference images
      referenceImages.forEach((file, index) => {
        formData.append(`referenceImage${index}`, file)
      })
      
      const response = await fetch('/api/generate-animation', {
        method: 'POST',
        body: formData
      })

      console.log('Response:', response)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate animation')
      }

      const data = await response.json()
      console.log('Animation API response:', data)
      
      if (data.success && data.animationUrl) {
        setAnimationResult(data.animationUrl)
      } else {
        throw new Error(data.error || 'Failed to generate animation')
      }
      
    } catch (error: any) {
      console.error('Animation generation error:', error)
      setAnimationError(error.message || 'Failed to generate animation')
    } finally {
      setIsGeneratingAnimation(false)
    }
  }

  const handleDownloadAnimation = () => {
    if (animationResult) {
      const link = document.createElement('a')
      link.href = animationResult
      link.download = `animation-${Date.now()}.mp4`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleClearAnimationGenerator = () => {
    setAnimationPrompt('')
    setReferenceImages([])
    setAnimationResult(null)
    setAnimationError(null)
    setSelectedImageStyle('realistic')
    setSelectedLightingTone('balanced')
    setCustomStylePrompt('')
  }

  // Scene extraction functions
  const handleExtractScenes = async () => {
    try {
      setIsExtractingScenes(true)
      setSceneExtractionError(null)

      const response = await fetch('/api/extract-animation-scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: scriptInput,
          numberOfScenes: numberOfScenesToExtract,
          mainContext: mainContext,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract animation scenes')
      }

      const data = await response.json()
      setExtractedScenes(data.scenes)
      // Add extracted scenes to the unified prompt list
      setAllPrompts(prev => [...prev, ...data.scenes])
      setSelectedScenes(data.scenes.map((_: any, index: number) => index)) // Select all by default
      
    } catch (error: any) {
      console.error('Scene extraction error:', error)
      setSceneExtractionError(error.message || 'Failed to extract animation scenes')
    } finally {
      setIsExtractingScenes(false)
    }
  }

  const handleToggleSceneSelection = (index: number) => {
    setSelectedScenes(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const handleUpdateScenePrompt = (index: number, newPrompt: string) => {
    setExtractedScenes(prev => prev.map((scene, i) => 
      i === index ? { ...scene, prompt: newPrompt } : scene
    ))
  }

  const handleAddCustomScene = (prompt: string, title: string, duration?: number) => {
    const newScene: ExtractedAnimationScene = {
      id: `custom_scene_${Date.now()}`,
      title,
      prompt,
      duration: duration || 5,
      effects: ['custom']
    }
    setExtractedScenes(prev => [...prev, newScene])
    setSelectedScenes(prev => [...prev, extractedScenes.length]) // Select the new scene
  }

  const handleClearSceneError = () => {
    setSceneExtractionError(null)
  }

  // Unified prompt management functions
  const handleAddManualPrompt = () => {
    if (!animationPrompt.trim()) return
    
    const newPrompt: ExtractedAnimationScene = {
      id: `manual_${Date.now()}`,
      title: `Manual Prompt ${allPrompts.length + 1}`,
      prompt: animationPrompt.trim(),
      duration: 5,
      effects: ['manual']
    }
    
    setAllPrompts(prev => [...prev, newPrompt])
    setAnimationPrompt('') // Clear the input after adding
  }

  const handleRemovePrompt = (promptId: string) => {
    setAllPrompts(prev => prev.filter(p => p.id !== promptId))
  }

  const handleUpdatePrompt = (promptId: string, newPrompt: string) => {
    setAllPrompts(prev => prev.map(p => 
      p.id === promptId ? { ...p, prompt: newPrompt } : p
    ))
  }

  const handleUsePromptForGeneration = (prompt: string) => {
    setAnimationPrompt(prompt)
  }

  const handleClearAllPrompts = () => {
    setAllPrompts([])
    setExtractedScenes([])
    setSelectedScenes([])
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Animation Generator</h1>
        <p className="text-gray-600">
          Create animations from reference images with AI-powered motion and effects
        </p>
      </div>

      {/* Unified Animation Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Animation Generator
          </CardTitle>
          <CardDescription>
            Create animations from reference images with custom prompts and style options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Style Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Animation Style Options</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStyleOptions(!showStyleOptions)}
                disabled={isGeneratingAnimation}
              >
                <Palette className="h-4 w-4 mr-2" />
                {showStyleOptions ? 'Hide' : 'Show'} Styles
              </Button>
            </div>

            {showStyleOptions && (
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-6 space-y-6">
                  {/* Image Style Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-purple-600" />
                      <Label className="font-semibold">Animation Style</Label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(IMAGE_STYLES).map(([key, style]) => (
                        <Button
                          key={key}
                          variant={selectedImageStyle === key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedImageStyle(key)}
                          disabled={isGeneratingAnimation}
                          className="flex flex-col h-auto py-3 px-2 text-center"
                        >
                          <span className="text-sm mb-1">{getImageStyleIcon(key)}</span>
                          <span className="font-medium text-xs">{style.name}</span>
                          <span className="text-[10px] opacity-70 leading-tight mt-1">{style.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Lighting Tone Section */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Lighting Tone</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(LIGHTING_TONES).map(([key, tone]) => (
                        <Button
                          key={key}
                          variant={selectedLightingTone === key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedLightingTone(key)}
                          disabled={isGeneratingAnimation}
                          className="flex flex-col h-auto py-3"
                        >
                          <div className="mb-1">{getLightingIcon(key)}</div>
                          <span className="font-medium text-xs">{tone.name}</span>
                          <span className="text-[10px] opacity-70 text-center leading-tight mt-1">{tone.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Style Prompt */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Custom Style (Optional)</Label>
                    <Textarea
                      placeholder="Add custom animation style (e.g., 'smooth camera movement, particle effects, glowing elements')"
                      value={customStylePrompt}
                      onChange={(e) => setCustomStylePrompt(e.target.value)}
                      disabled={isGeneratingAnimation}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Style Preview */}
                  {(selectedImageStyle !== 'realistic' || selectedLightingTone !== 'balanced' || customStylePrompt) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <Label className="text-xs font-medium text-green-800">Active Styles:</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedImageStyle && selectedImageStyle !== 'realistic' && (
                          <Badge variant="outline" className="text-xs">
                            {getImageStyleIcon(selectedImageStyle)} {IMAGE_STYLES[selectedImageStyle as keyof typeof IMAGE_STYLES]?.name}
                          </Badge>
                        )}
                        {selectedLightingTone && selectedLightingTone !== 'balanced' && (
                          <Badge variant="outline" className="text-xs">
                            {getLightingIcon(selectedLightingTone)} {LIGHTING_TONES[selectedLightingTone as keyof typeof LIGHTING_TONES]?.name}
                          </Badge>
                        )}
                        {customStylePrompt && (
                          <Badge variant="outline" className="text-xs">
                            Custom Style
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Animation Prompt */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Animation Description</Label>
            <Textarea
              placeholder="Describe how you want the reference image to animate (e.g., 'slow zoom in with particles floating around, gentle camera movement from left to right')"
              value={animationPrompt}
              onChange={(e) => setAnimationPrompt(e.target.value)}
              disabled={isGeneratingAnimation}
              rows={4}
              className="text-sm"
            />
            {(selectedImageStyle !== 'realistic' || selectedLightingTone !== 'balanced' || customStylePrompt) && (
              <div className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
                <strong>Final Prompt Preview:</strong> {getStyledPrompt()}
              </div>
            )}
          </div>

          {/* Reference Images Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Reference Images (Required)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAnimationGenerator}
                disabled={isGeneratingAnimation}
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
                    disabled={isGeneratingAnimation}
                  />
                </div>
              </div>
            </div>

            {/* Reference Images Preview */}
            {referenceImages.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Reference Images ({referenceImages.length})
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {referenceImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeReferenceImage(index)}
                        disabled={isGeneratingAnimation}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded">
                        {file.name.length > 12 ? file.name.substring(0, 12) + '...' : file.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateAnimation}
            disabled={isGeneratingAnimation || !animationPrompt.trim() || referenceImages.length === 0}
            className="w-full"
            size="lg"
          >
            {isGeneratingAnimation ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating Animation...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Animation
              </>
            )}
          </Button>

          {/* Results */}
          {animationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">Generation Failed</h4>
                  <p className="text-sm text-red-700 mt-1">{animationError}</p>
                </div>
              </div>
            </div>
          )}

          {animationResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <Label className="text-base font-medium text-green-900">Generated Animation</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAnimation}
                  disabled={isGeneratingAnimation}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <video
                  src={animationResult}
                  controls
                  className="w-full max-w-lg mx-auto rounded-lg shadow-lg"
                  autoPlay
                  loop
                  muted
                />
              </div>
            </div>
          )}

          {/* Usage Tips */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-purple-900">Animation Tips</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Upload 1-3 reference images for best results</li>
                  <li>• Describe the motion and effects you want to see</li>
                  <li>• Use style options to match your content's aesthetic</li>
                  <li>• Mention camera movements like "zoom in", "pan left", "rotate"</li>
                  <li>• Add effects like "particles", "glow", "blur", "sparkles"</li>
                  <li>• Specify timing like "slow motion", "fast", "smooth"</li>
                </ul>
              </div>
            </div>
          </div>
          </CardContent>
          </Card>
        </TabsContent>

        {/* Scene Extraction Tab */}
        <TabsContent value="scenes">
          <AnimationSceneExtraction
            scriptInput={scriptInput}
            onScriptInputChange={setScriptInput}
            numberOfScenesToExtract={numberOfScenesToExtract}
            onNumberOfScenesChange={setNumberOfScenesToExtract}
            isExtractingScenes={isExtractingScenes}
            sceneExtractionError={sceneExtractionError}
            extractedScenes={extractedScenes}
            selectedScenes={selectedScenes}
            onToggleSceneSelection={handleToggleSceneSelection}
            onExtractScenes={handleExtractScenes}
            onClearError={handleClearSceneError}
            onUpdateScenePrompt={handleUpdateScenePrompt}
            onAddCustomScene={handleAddCustomScene}
            scriptSourceInfo={getScriptSourceInfo()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}