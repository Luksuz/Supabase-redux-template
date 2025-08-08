'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { IMAGE_STYLES, LIGHTING_TONES } from '@/data/image'
import { SingleGenerationTab, SceneExtractionTab, BatchGenerationTab } from './animation-generation'
import { Sun, Moon, Zap } from 'lucide-react'

interface ExtractedAnimationScene {
  id: string
  title: string
  prompt: string
  duration?: number
  effects?: string[]
}

interface BatchGenerationResult {
  id: string
  url: string
  prompt: string
  sceneId: string
  sceneTitle: string
}

export function UnifiedAnimationGenerator() {
  // Get script data from Redux
  const { scriptSections, fullScript } = useAppSelector(state => state.scripts)
  
  const [animationPrompt, setAnimationPrompt] = useState('')
  const [referenceImages, setReferenceImages] = useState<File[]>([])
  const [isGeneratingAnimation, setIsGeneratingAnimation] = useState(false)
  const [animationResult, setAnimationResult] = useState<{url: string, prompt: string} | null>(null)
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
  
  // Unified prompt management
  const [allPrompts, setAllPrompts] = useState<ExtractedAnimationScene[]>([])
  const [mainContext, setMainContext] = useState('')
  
  // Batch generation state
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [batchResults, setBatchResults] = useState<BatchGenerationResult[]>([])
  const [batchError, setBatchError] = useState<string | null>(null)
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0)
  const [batchDelayRemaining, setBatchDelayRemaining] = useState(0)
  
  // Edit prompt state
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingPromptText, setEditingPromptText] = useState('')

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



  const handleGenerateAnimation = async () => {
    try {
      setIsGeneratingAnimation(true)
      setAnimationError(null)
      
      // Create FormData for the request
      const formData = new FormData()
      formData.append('prompt', getStyledPrompt(animationPrompt))
      
      // Add reference images
      referenceImages.forEach((file, index) => {
        formData.append(`referenceImage${index}`, file)
      })
      
      const response = await fetch('/api/generate-animation', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate animation')
      }

      const data = await response.json()
      console.log('Animation API response:', data)
      
      if (data.success && data.animationUrl) {
        setAnimationResult({
          url: data.animationUrl,
          prompt: getStyledPrompt(animationPrompt)
        })
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
      link.href = animationResult.url
      link.download = `generated-image-${Date.now()}.png`
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
      // Add extracted scenes to the unified prompt list
      setAllPrompts(prev => [...prev, ...data.scenes])
      
    } catch (error: any) {
      console.error('Scene extraction error:', error)
      setSceneExtractionError(error.message || 'Failed to extract animation scenes')
    } finally {
      setIsExtractingScenes(false)
    }
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

  const handleUsePromptForGeneration = (prompt: string) => {
    setAnimationPrompt(prompt)
  }

  const handleClearAllPrompts = () => {
    setAllPrompts([])
  }

  const handleEditPrompt = (promptId: string) => {
    const prompt = allPrompts.find(p => p.id === promptId)
    if (prompt) {
      setEditingPromptId(promptId)
      setEditingPromptText(prompt.prompt)
    }
  }

  const handleSaveEditedPrompt = () => {
    if (editingPromptId && editingPromptText.trim()) {
      setAllPrompts(prev => prev.map(prompt => 
        prompt.id === editingPromptId 
          ? { ...prompt, prompt: editingPromptText.trim() }
          : prompt
      ))
      setEditingPromptId(null)
      setEditingPromptText('')
    }
  }

  const handleCancelEdit = () => {
    setEditingPromptId(null)
    setEditingPromptText('')
  }

  // Helper function to combine styles into final prompt
  const getStyledPrompt = (basePrompt: string) => {
    let finalPrompt = basePrompt
    
    // Apply Image Style
    if (selectedImageStyle && selectedImageStyle !== 'realistic') {
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

  // Batch generation function with frontend progress tracking
  const handleBatchGenerate = async () => {
    if (selectedPrompts.length === 0 || referenceImages.length === 0) return
    
    const promptsToGenerate = allPrompts.filter(prompt => selectedPrompts.includes(prompt.id))
    
    try {
      setIsBatchGenerating(true)
      setBatchError(null)
      setBatchResults([])
      setBatchProgress({ current: 0, total: promptsToGenerate.length })
      setCurrentBatchIndex(0)
      setBatchDelayRemaining(0)

      // Process in batches of 10 with 1 minute delay between batches
      const batchSize = 10
      const delayBetweenBatches = 60000 // 1 minute in milliseconds
      const totalBatches = Math.ceil(promptsToGenerate.length / batchSize)

      for (let i = 0; i < promptsToGenerate.length; i += batchSize) {
        const batch = promptsToGenerate.slice(i, i + batchSize)
        const currentBatch = Math.floor(i / batchSize) + 1
        setCurrentBatchIndex(currentBatch)
        
        console.log(`🚀 Processing batch ${currentBatch}/${totalBatches} (${batch.length} prompts)`)
        
        // Process current batch in parallel
        const batchPromises = batch.map(async (prompt, promptIndex) => {
          try {
            const formData = new FormData()
            
            // Apply styles to the prompt
            let styledPrompt = getStyledPrompt(prompt.prompt)
            
            formData.append('prompt', styledPrompt)
            
            // Add reference images
            referenceImages.forEach((file, index) => {
              formData.append(`referenceImage${index}`, file)
            })
            
            const response = await fetch('/api/generate-animation', {
              method: 'POST',
              body: formData
            })

            if (!response.ok) {
              throw new Error(`Failed to generate image for prompt: ${prompt.title}`)
            }

            const data = await response.json()
            
            if (data.success && data.animationUrl) {
              const result = {
                id: `${prompt.id}_${Date.now()}_${promptIndex}`,
                url: data.animationUrl,
                prompt: styledPrompt,
                sceneId: prompt.id,
                sceneTitle: prompt.title
              } as BatchGenerationResult
              
              // Update progress and results immediately
              setBatchResults(prev => [...prev, result])
              setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }))
              
              console.log(`✅ Generated ${prompt.title} (${i + promptIndex + 1}/${promptsToGenerate.length})`)
              return result
            } else {
              throw new Error(`Failed to generate image for prompt: ${prompt.title}`)
            }
          } catch (error: any) {
            console.error(`❌ Error generating ${prompt.title}:`, error.message)
            setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }))
            throw error
          }
        })

        // Wait for current batch to complete
        const batchResults = await Promise.allSettled(batchPromises)
        
        const successCount = batchResults.filter(result => result.status === 'fulfilled').length
        const errorCount = batchResults.filter(result => result.status === 'rejected').length
        
        console.log(`📊 Batch ${currentBatch} completed: ${successCount} success, ${errorCount} errors`)

        // If there are more batches, show countdown and wait
        if (i + batchSize < promptsToGenerate.length) {
          console.log(`⏳ Waiting 1 minute before next batch...`)
          
          // Countdown timer for user feedback
          for (let countdown = 60; countdown > 0; countdown--) {
            setBatchDelayRemaining(countdown)
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          setBatchDelayRemaining(0)
        }
      }

      const totalGenerated = batchResults.length
      console.log(`🎉 Batch generation completed! Generated ${totalGenerated}/${promptsToGenerate.length} images.`)
      
    } catch (error: any) {
      console.error('❌ Batch generation error:', error)
      setBatchError(error.message || 'Failed to complete batch generation')
    } finally {
      setIsBatchGenerating(false)
      setCurrentBatchIndex(0)
      setBatchDelayRemaining(0)
    }
  }

  const handleClearBatchResults = () => {
    setBatchResults([])
    setBatchProgress({ current: 0, total: 0 })
    setBatchError(null)
  }

  // Regenerate a single image
  const handleRegenerateImage = async (prompt: string, resultId: string) => {
    if (referenceImages.length === 0) {
      setBatchError('No reference images available for regeneration')
      return
    }

    try {
      const formData = new FormData()
      formData.append('prompt', prompt)
      
      // Add reference images
      referenceImages.forEach((file, index) => {
        formData.append(`referenceImage${index}`, file)
      })
      
      const response = await fetch('/api/generate-animation', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate image')
      }

      const data = await response.json()
      
      if (data.success && data.animationUrl) {
        // Update the result with new image URL
        setBatchResults(prev => prev.map(result => 
          result.id === resultId 
            ? { ...result, url: data.animationUrl, id: `${result.sceneId}_${Date.now()}` }
            : result
        ))
        console.log(`✅ Regenerated image successfully`)
      } else {
        throw new Error('Failed to regenerate image')
      }
      
    } catch (error: any) {
      console.error('❌ Regeneration error:', error)
      setBatchError(error.message || 'Failed to regenerate image')
    }
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

      {/* Tabs Interface */}
      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="single">Single Generation</TabsTrigger>
          <TabsTrigger value="extract">Extract & Manage</TabsTrigger>
          <TabsTrigger value="batch">Batch Generation</TabsTrigger>
        </TabsList>

        {/* Single Generation Tab */}
        <TabsContent value="single">
          <SingleGenerationTab
            animationPrompt={animationPrompt}
            setAnimationPrompt={setAnimationPrompt}
            referenceImages={referenceImages}
            setReferenceImages={setReferenceImages}
            isGeneratingAnimation={isGeneratingAnimation}
            animationResult={animationResult}
            animationError={animationError}
            selectedImageStyle={selectedImageStyle}
            setSelectedImageStyle={setSelectedImageStyle}
            selectedLightingTone={selectedLightingTone}
            setSelectedLightingTone={setSelectedLightingTone}
            customStylePrompt={customStylePrompt}
            setCustomStylePrompt={setCustomStylePrompt}
            onGenerateAnimation={handleGenerateAnimation}
            onDownloadAnimation={handleDownloadAnimation}
            onClearAnimationGenerator={handleClearAnimationGenerator}
          />
        </TabsContent>

        {/* Extract & Manage Tab */}
        <TabsContent value="extract">
          <SceneExtractionTab
            scriptInput={scriptInput}
            setScriptInput={setScriptInput}
            numberOfScenesToExtract={numberOfScenesToExtract}
            setNumberOfScenesToExtract={setNumberOfScenesToExtract}
            isExtractingScenes={isExtractingScenes}
            sceneExtractionError={sceneExtractionError}
            allPrompts={allPrompts}
            mainContext={mainContext}
            setMainContext={setMainContext}
            onExtractScenes={handleExtractScenes}
            onAddManualPrompt={handleAddManualPrompt}
            onRemovePrompt={handleRemovePrompt}
            onEditPrompt={handleEditPrompt}
            onUsePromptForGeneration={handleUsePromptForGeneration}
            onClearAllPrompts={handleClearAllPrompts}
            animationPrompt={animationPrompt}
            setAnimationPrompt={setAnimationPrompt}
            getScriptSourceInfo={getScriptSourceInfo}
            editingPromptId={editingPromptId}
            editingPromptText={editingPromptText}
            setEditingPromptText={setEditingPromptText}
            onSaveEditedPrompt={handleSaveEditedPrompt}
            onCancelEdit={handleCancelEdit}
          />
        </TabsContent>

        {/* Batch Generation Tab */}
        <TabsContent value="batch">
          <BatchGenerationTab
            allPrompts={allPrompts}
            selectedPrompts={selectedPrompts}
            setSelectedPrompts={setSelectedPrompts}
            referenceImages={referenceImages}
            isBatchGenerating={isBatchGenerating}
            batchProgress={batchProgress}
            batchResults={batchResults}
            batchError={batchError}
            currentBatchIndex={currentBatchIndex}
            batchDelayRemaining={batchDelayRemaining}
            onBatchGenerate={handleBatchGenerate}
            onClearBatchResults={handleClearBatchResults}
            onRegenerateImage={handleRegenerateImage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}