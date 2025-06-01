'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { setPrompt, setScripts, initializeScripts, updateScript } from '../lib/features/scripts/scriptsSlice'
import { startScriptGeneration, updateScriptGenerationProgress, finishScriptGeneration, clearScriptGenerationProgress } from '../lib/features/progress/progressSlice'
import type { GeneratedScript } from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Textarea } from './ui/textarea'
import { FileText, Copy, Download, Mic, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, RotateCcw, Edit, Save, X } from 'lucide-react'

const BATCH_SIZE = 10
const BATCH_DELAY = 60000 // 60 seconds in milliseconds


interface ProgressState {
  total: number
  completed: number
  currentImage: string
  completedImages: string[]
  currentBatch: number
  totalBatches: number
  batchProgress: number
  timeUntilNextBatch?: number
}

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { originalImages } = useAppSelector(state => state.images)
  const { prompt, scripts, hasGeneratedScripts } = useAppSelector(state => state.scripts)
  const { scriptGeneration: progress } = useAppSelector(state => state.progress)
  
  // UI-specific states (not stored in Redux)
  const [isGenerating, setIsGenerating] = useState(false)
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [editingScripts, setEditingScripts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [wordCountPerImage, setWordCountPerImage] = useState(150) // Default word count
  // Individual prompts for each image
  const [individualPrompts, setIndividualPrompts] = useState<Record<string, string>>({})
  const [individualWordCounts, setIndividualWordCounts] = useState<Record<string, number>>({})
  const [showIndividualPrompts, setShowIndividualPrompts] = useState(false)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Handle prompt changes
  const handlePromptChange = (value: string) => {
    dispatch(setPrompt(value))
  }

  // Handle individual prompt changes
  const handleIndividualPromptChange = (imageId: string, value: string) => {
    setIndividualPrompts(prev => ({
      ...prev,
      [imageId]: value
    }))
  }

  // Apply global prompt to all individual prompts
  const applyPromptToAll = () => {
    if (!prompt.trim()) {
      showMessage('Please enter a global prompt first', 'error')
      return
    }
    
    const newIndividualPrompts: Record<string, string> = {}
    originalImages.forEach(image => {
      newIndividualPrompts[image.id] = prompt
    })
    setIndividualPrompts(newIndividualPrompts)
    showMessage(`Applied global prompt to all ${originalImages.length} segments`, 'success')
  }

  // Apply word count to all individual prompts
  const applyWordCountToAll = () => {
    const newIndividualWordCounts: Record<string, number> = {}
    originalImages.forEach(image => {
      newIndividualWordCounts[image.id] = wordCountPerImage
    })
    setIndividualWordCounts(newIndividualWordCounts)
    showMessage(`Applied ${wordCountPerImage} word count to all ${originalImages.length} segments`, 'success')
  }

  // Handle individual word count changes
  const handleIndividualWordCountChange = (imageId: string, value: number) => {
    setIndividualWordCounts(prev => ({
      ...prev,
      [imageId]: value
    }))
  }

  // Start editing a script
  const startEditingScript = (imageId: string, currentScript: string) => {
    setEditingIds(prev => new Set(prev).add(imageId))
    setEditingScripts(prev => ({
      ...prev,
      [imageId]: currentScript
    }))
  }

  // Cancel editing a script
  const cancelEditingScript = (imageId: string) => {
    setEditingIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(imageId)
      return newSet
    })
    setEditingScripts(prev => {
      const newScripts = { ...prev }
      delete newScripts[imageId]
      return newScripts
    })
  }

  // Save edited script
  const saveEditedScript = (imageId: string) => {
    const editedScript = editingScripts[imageId]
    if (!editedScript || !editedScript.trim()) {
      showMessage('Script cannot be empty', 'error')
      return
    }

    // Update the script in Redux
    dispatch(updateScript({
      imageId: imageId,
      script: editedScript.trim(),
      generated: true
    }))

    // Clear editing state
    cancelEditingScript(imageId)
    showMessage('Script updated successfully!', 'success')
  }

  // Handle editing script text changes
  const handleEditingScriptChange = (imageId: string, value: string) => {
    setEditingScripts(prev => ({
      ...prev,
      [imageId]: value
    }))
  }

  // Regenerate a single script with custom prompt
  const regenerateScript = async (imageId: string, customPrompt?: string, customWordCount?: number) => {
    const image = originalImages.find(img => img.id === imageId)
    if (!image) {
      showMessage('Image not found for regeneration', 'error')
      return
    }

    const promptToUse = customPrompt || individualPrompts[imageId] || prompt
    const wordCountToUse = customWordCount || individualWordCounts[imageId] || wordCountPerImage
    
    if (!promptToUse.trim()) {
      showMessage('Please enter a prompt before regenerating', 'error')
      return
    }

    // Add to regenerating set
    setRegeneratingIds(prev => new Set(prev).add(imageId))
    showMessage(`Regenerating script for ${image.originalName}...`, 'info')

    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl: image.dataUrl,
          imageName: image.originalName,
          prompt: promptToUse.trim(),
          wordCount: wordCountToUse
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to regenerate script for ${image.originalName}`)
      }

      const data = await response.json()
      
      // Update the specific script in Redux
      dispatch(updateScript({
        imageId: imageId,
        script: data.usingMock 
          ? `${data.script}\n\n[Generated using mock data - Set OPENAI_API_KEY for real AI analysis]`
          : data.script,
        generated: true
      }))

      showMessage(`Successfully regenerated script for ${image.originalName}!`, 'success')
    } catch (error) {
      showMessage(`Failed to regenerate script: ${(error as Error).message}`, 'error')
      
      // Update with error script
      dispatch(updateScript({
        imageId: imageId,
        script: `Error: ${(error as Error).message}`,
        generated: false
      }))
    } finally {
      // Remove from regenerating set
      setRegeneratingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(imageId)
        return newSet
      })
    }
  }

  // Regenerate all scripts with individual prompts
  const regenerateAllWithIndividualPrompts = async () => {
    const imagesToUpdate = originalImages.filter(image => {
      const individualPrompt = individualPrompts[image.id]
      return individualPrompt && individualPrompt.trim()
    })

    if (imagesToUpdate.length === 0) {
      showMessage('No individual prompts found. Set prompts for specific segments first.', 'error')
      return
    }

    setIsGenerating(true)
    
    // Initialize progress
    dispatch(startScriptGeneration({
      total: imagesToUpdate.length,
      totalBatches: 1 // Single batch for regeneration
    }))

    showMessage(`Regenerating ${imagesToUpdate.length} scripts with individual prompts...`, 'info')

    try {
      const scriptPromises = imagesToUpdate.map(async (image, index) => {
        const individualPrompt = individualPrompts[image.id]
        const individualWordCount = individualWordCounts[image.id] || wordCountPerImage
        
        try {
          const response = await fetch('/api/generate-script', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageDataUrl: image.dataUrl,
              imageName: image.originalName,
              prompt: individualPrompt.trim(),
              wordCount: individualWordCount
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to regenerate script for ${image.originalName}`)
          }

          const data = await response.json()
          
          dispatch(updateScriptGenerationProgress({
            completed: index + 1,
            currentImage: `Completed: ${image.originalName}`
          }))
          
          // Immediately update the script in Redux
          dispatch(updateScript({
            imageId: image.id,
            script: data.usingMock 
              ? `${data.script}\n\n[Generated using mock data - Set OPENAI_API_KEY for real AI analysis]`
              : data.script,
            generated: true
          }))
          
          return {
            success: true,
            data: {
              imageId: image.id,
              script: data.usingMock 
                ? `${data.script}\n\n[Generated using mock data - Set OPENAI_API_KEY for real AI analysis]`
                : data.script,
              generated: true
            }
          }
        } catch (error) {
          dispatch(updateScriptGenerationProgress({
            completed: index + 1,
            currentImage: `Failed: ${image.originalName}`
          }))
          
          // Immediately update the script in Redux with error message
          const errorMessage = `Error: ${error instanceof Error ? error.message : 'Failed to regenerate script'}`
          dispatch(updateScript({
            imageId: image.id,
            script: errorMessage,
            generated: false
          }))
          
          return {
            success: false,
            error: {
              imageId: image.id,
              imageName: image.originalName,
              error: error instanceof Error ? error.message : 'Failed to regenerate script'
            }
          }
        }
      })

      const results = await Promise.all(scriptPromises)
      
      // Count results since scripts are already updated immediately
      const successCount = results.filter(r => r.success).length
      showMessage(`Regenerated ${successCount}/${imagesToUpdate.length} scripts with individual prompts!`, 'success')

    } catch (error) {
      showMessage('Error during bulk regeneration: ' + (error as Error).message, 'error')
    } finally {
      setIsGenerating(false)
      dispatch(finishScriptGeneration())
      // Clear progress after completion
      setTimeout(() => {
        dispatch(clearScriptGenerationProgress())
      }, 3000)
    }
  }

  // Generate scripts for all images with rate limiting
  const handleNarrateImages = async () => {
    if (!prompt.trim()) {
      showMessage('Please enter a prompt for script generation', 'error')
      return
    }

    if (originalImages.length === 0) {
      showMessage('No images available for narration', 'error')
      return
    }

    setIsGenerating(true)
    const totalBatches = Math.ceil(originalImages.length / BATCH_SIZE)
    
    // Initialize progress
    dispatch(startScriptGeneration({
      total: originalImages.length,
      totalBatches
    }))
    
    showMessage(`Starting batched processing of ${originalImages.length} images in ${totalBatches} batch(es) of ${BATCH_SIZE}...`, 'info')

    try {
      // Initialize scripts array in Redux
      dispatch(initializeScripts(
        originalImages.map(img => ({
          imageId: img.id,
          imageName: img.originalName
        }))
      ))

      console.log(`🚀 Processing ${originalImages.length} images in ${totalBatches} batches`)

      const allResults: Array<{
        success: boolean
        data?: any
        error?: any
      }> = []
      
      let completedCount = 0 // Shared counter for completed items

      // Process images in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE
        const endIndex = Math.min(startIndex + BATCH_SIZE, originalImages.length)
        const batchImages = originalImages.slice(startIndex, endIndex)
        
        console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches}: ${batchImages.length} images`)
        
        // Update progress for current batch
        dispatch(updateScriptGenerationProgress({
          currentBatch: batchIndex + 1,
          batchProgress: 0,
          currentImage: `Processing batch ${batchIndex + 1}/${totalBatches}...`
        }))

        // Create promises for current batch
        const batchPromises = batchImages.map(async (image, imageIndex) => {
          const globalIndex = startIndex + imageIndex
          console.log(`📸 Starting request ${globalIndex + 1}/${originalImages.length}: ${image.originalName}`)

          try {
            const response = await fetch('/api/generate-script', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                imageDataUrl: image.dataUrl,
                imageName: image.originalName,
                prompt: prompt.trim(),
                wordCount: wordCountPerImage,
                batchInfo: {
                  batchIndex: batchIndex + 1,
                  totalBatches,
                  imageIndex: imageIndex + 1,
                  batchSize: batchImages.length
                }
              }),
            })

            if (!response.ok) {
              throw new Error(`Failed to generate script for ${image.originalName}`)
            }

            const data = await response.json()
            
            console.log(`✅ Completed request ${globalIndex + 1}: ${image.originalName}`)
            
            // Increment shared counter and update progress
            completedCount++
            dispatch(updateScriptGenerationProgress({
              completed: completedCount,
              batchProgress: imageIndex + 1,
              currentImage: `Batch ${batchIndex + 1}: Completed ${image.originalName}`
            }))
            
            // Immediately update the script in Redux so it shows in the UI
            dispatch(updateScript({
              imageId: image.id,
              script: data.usingMock 
                ? `${data.script}\n\n[Generated using mock data - Set OPENAI_API_KEY for real AI analysis]`
                : data.script,
              generated: true
            }))
            
            return {
              success: true,
              data: {
                imageId: image.id,
                imageName: image.originalName,
                script: data.usingMock 
                  ? `${data.script}\n\n[Generated using mock data - Set OPENAI_API_KEY for real AI analysis]`
                  : data.script,
                generated: true,
                usingMock: data.usingMock
              }
            }
          } catch (error) {
            console.error(`❌ Error in request ${globalIndex + 1}:`, error)
            
            // Increment shared counter even for failures
            completedCount++
            dispatch(updateScriptGenerationProgress({
              completed: completedCount,
              batchProgress: imageIndex + 1,
              currentImage: `Batch ${batchIndex + 1}: Failed ${image.originalName}`
            }))
            
            // Immediately update the script in Redux with error message
            const errorMessage = `Error: ${error instanceof Error ? error.message : 'Failed to generate script'}`
            dispatch(updateScript({
              imageId: image.id,
              script: errorMessage,
              generated: false
            }))
            
            return {
              success: false,
              error: {
                imageId: image.id,
                imageName: image.originalName,
                error: error instanceof Error ? error.message : 'Failed to generate script'
              }
            }
          }
        })

        // Process current batch in parallel
        const batchResults = await Promise.all(batchPromises)
        allResults.push(...batchResults)
        
        console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} complete`)

        // Add delay between batches (except for the last batch)
        if (batchIndex < totalBatches - 1) {
          console.log(`⏱️ Waiting ${BATCH_DELAY / 1000} seconds before next batch...`)
          
          // Countdown timer for user feedback
          for (let seconds = Math.floor(BATCH_DELAY / 1000); seconds > 0; seconds--) {
            dispatch(updateScriptGenerationProgress({
              timeUntilNextBatch: seconds,
              currentImage: `Waiting ${seconds}s before next batch...`
            }))
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          dispatch(updateScriptGenerationProgress({
            timeUntilNextBatch: 0
          }))
        }
      }

      // Process all results - just count successes and errors since scripts are already updated
      const successCount = allResults.filter(r => r.success).length
      const errorCount = allResults.filter(r => !r.success).length

      console.log(`🎉 Batched processing complete: ${successCount} successful, ${errorCount} failed`)

      if (errorCount === 0) {
        showMessage(`Successfully generated all ${successCount} scripts using ${totalBatches} batch(es)!`, 'success')
      } else {
        showMessage(`Generated ${successCount} scripts successfully, ${errorCount} failed using ${totalBatches} batch(es)`, 'success')
      }

    } catch (error) {
      showMessage('Error during script generation: ' + (error as Error).message, 'error')
    } finally {
      setIsGenerating(false)
      dispatch(finishScriptGeneration())
      // Clear progress after completion
      setTimeout(() => {
        dispatch(clearScriptGenerationProgress())
      }, 3000)
    }
  }

  // Copy script to clipboard
  const copyScript = async (script: string) => {
    try {
      await navigator.clipboard.writeText(script)
      showMessage('Script copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy script', 'error')
    }
  }

  // Download all scripts as text file
  const downloadAllScripts = () => {
    const validScripts = scripts.filter(s => s.generated && s.script)
    
    if (validScripts.length === 0) {
      showMessage('No scripts available to download', 'error')
      return
    }

    // Calculate statistics
    const totalWords = validScripts.reduce((total, s) => 
      total + s.script.split(/\s+/).filter(word => word.length > 0).length, 0
    )
    const averageWords = Math.round(totalWords / validScripts.length)

    // Create file content with statistics header
    const statsHeader = `=== SCRIPT GENERATION SUMMARY ===
Total Scripts: ${validScripts.length}
Total Words: ${totalWords}
Average Words per Script: ${averageWords}
Generated on: ${new Date().toLocaleString()}
Target Word Count: ${wordCountPerImage} words per script

=== SCRIPTS ===

`

    const allScripts = validScripts
      .map((s, index) => {
        const wordCount = s.script.split(/\s+/).filter(word => word.length > 0).length
        return `=== ${s.imageName} ===
Word Count: ${wordCount} words
${s.script}

`
      })
      .join('')
    
    const fullContent = statsHeader + allScripts

    const blob = new Blob([fullContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image-scripts-${validScripts.length}-scripts-${totalWords}-words-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage(`Downloaded ${validScripts.length} scripts (${totalWords} total words)!`, 'success')
  }

  const generatedCount = scripts.filter(s => s.generated).length
  const progressPercentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="w-full max-w-full p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Script Generator</h1>
        <p className="text-gray-600">
          Generate narration scripts for your processed images using AI
        </p>
      </div>

      {/* Progress Card - Only show when generating */}
      {progress.isActive && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Generating Scripts ({progressPercentage}%)
            </CardTitle>
            <CardDescription>
              Processing images in batches of 10 to respect API rate limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Progress</span>
                <span className="font-medium text-blue-600">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {progress.completed} of {progress.total} requests completed
              </div>
            </div>

            {/* Countdown Timer */}
            {progress.timeUntilNextBatch && progress.timeUntilNextBatch > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-medium">Rate Limit Pause</span>
                  <Badge variant="secondary" className="bg-orange-100">
                    {progress.timeUntilNextBatch}s
                  </Badge>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Waiting before processing next batch to respect API limits
                </p>
              </div>
            )}

            {/* Current Status */}
            {progress.currentImage && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">Status:</span>
                <span className="font-medium">{progress.currentImage}</span>
              </div>
            )}

            {/* Completed Images List */}
            {progress.completedImages.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Recently Completed:</div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {progress.completedImages.slice(-5).map((imageName, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600 truncate">{imageName}</span>
                    </div>
                  ))}
                  {progress.completedImages.length > 5 && (
                    <div className="text-xs text-gray-400">
                      ...and {progress.completedImages.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prompt Input Card */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Script Prompt
          </CardTitle>
          <CardDescription>
            Enter a prompt to guide the script generation for your images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Narration Prompt</Label>
            <div className="flex gap-2">
              <Input
                id="prompt"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="e.g., Create an engaging narration script that describes the visual elements, mood, and story of this image..."
                className="flex-1"
                disabled={isGenerating}
              />
            </div>
            <p className="text-xs text-gray-500">
              This prompt will be used to generate scripts for all {originalImages.length} images
            </p>
          </div>

          {/* Word Count Control */}
          <div className="space-y-2">
            <Label htmlFor="wordCount">Word Count Per Image</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="wordCount"
                type="text"
                value={wordCountPerImage}
                onChange={(e) => setWordCountPerImage(parseInt(e.target.value) || 150)}
                className="w-24"
                disabled={isGenerating}
                placeholder="150"
              />
              <span className="text-sm text-gray-600">words per script</span>
              <Button
                onClick={applyWordCountToAll}
                size="sm"
                variant="outline"
                disabled={isGenerating}
                className="whitespace-nowrap"
              >
                Apply to All Images
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Target word count for each generated script (actual count may vary slightly)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button 
              onClick={handleNarrateImages}
              disabled={isGenerating || originalImages.length === 0 || !prompt.trim()}
              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating... ({progressPercentage}%)
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Generate Scripts for {originalImages.length} Images
                </>
              )}
            </Button>
            
            {generatedCount > 0 && (
              <Button 
                onClick={downloadAllScripts}
                variant="outline"
                disabled={isGenerating}
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-2" />
                Download All Scripts
              </Button>
            )}

            {originalImages.length > 0 && (
              <Button 
                onClick={() => setShowIndividualPrompts(!showIndividualPrompts)}
                variant="outline"
                disabled={isGenerating}
                className="whitespace-nowrap"
              >
                <FileText className="h-4 w-4 mr-2" />
                {showIndividualPrompts ? 'Hide' : 'Show'} Individual Prompts
              </Button>
            )}
          </div>

          {/* Individual Prompt Controls */}
          {showIndividualPrompts && originalImages.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <h4 className="font-medium text-gray-900">Individual Segment Prompts</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={applyPromptToAll}
                    size="sm"
                    variant="outline"
                    disabled={!prompt.trim() || isGenerating}
                    className="whitespace-nowrap"
                  >
                    Apply Global Prompt to All
                  </Button>
                  <Button
                    onClick={applyWordCountToAll}
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    className="whitespace-nowrap"
                  >
                    Apply Word Count to All
                  </Button>
                  <Button
                    onClick={regenerateAllWithIndividualPrompts}
                    size="sm"
                    disabled={isGenerating || Object.keys(individualPrompts).filter(id => individualPrompts[id]?.trim()).length === 0}
                    className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Regenerate All with Individual Prompts
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 break-words">
                Customize prompts and word counts for specific segments. Empty prompts will use the global prompt above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Message */}
      {message && (
        <Card className={`border ${
          messageType === 'success' ? 'border-green-200 bg-green-50' :
          messageType === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {messageType === 'info' && <FileText className="h-4 w-4 text-blue-600" />}
              <span className={`text-sm ${
                messageType === 'success' ? 'text-green-800' :
                messageType === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images and Scripts */}
      {originalImages.length > 0 && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images & Generated Scripts ({generatedCount}/{originalImages.length})
            </CardTitle>
            <CardDescription className="space-y-1">
              <div>View your images and their generated narration scripts</div>
              {generatedCount > 0 && (
                <div className="text-sm text-green-600 font-medium">
                  Total words generated: {scripts
                    .filter(s => s.generated && s.script)
                    .reduce((total, s) => total + s.script.split(/\s+/).filter(word => word.length > 0).length, 0)
                  } words across {generatedCount} scripts • 
                  Average: {Math.round(scripts
                    .filter(s => s.generated && s.script)
                    .reduce((total, s) => total + s.script.split(/\s+/).filter(word => word.length > 0).length, 0) / generatedCount
                  )} words per script
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {originalImages.map((image, index) => {
                const script = scripts.find(s => s.imageId === image.id)
                const isCompleted = progress.completedImages.some(img => img.includes(image.originalName))
                const isRegenerating = regeneratingIds.has(image.id)
                
                return (
                  <div key={image.id} className={`border rounded-lg p-4 ${
                    isRegenerating ? 'border-orange-200 bg-orange-50' :
                    isCompleted ? 'border-green-200 bg-green-50' : 
                    isGenerating ? 'border-blue-200 bg-blue-50' :
                    'border-gray-200'
                  }`}>
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={image.dataUrl}
                            alt={image.originalName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mt-2 text-center">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Script Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 truncate" title={image.originalName}>
                            {image.originalName}
                          </h3>
                          <div className="flex items-center gap-2">
                            {isRegenerating && (
                              <Badge variant="secondary" className="text-xs">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Regenerating
                              </Badge>
                            )}
                            {isGenerating && !script?.generated && !isRegenerating && (
                              <Badge variant="secondary" className="text-xs">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Processing
                              </Badge>
                            )}
                            {script?.generated && !isRegenerating && (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Generated
                              </Badge>
                            )}
                            
                            {/* Word Count Badge */}
                            {script?.script && script.generated && (
                              <Badge variant="outline" className="text-xs">
                                {script.script.split(/\s+/).filter(word => word.length > 0).length} words
                              </Badge>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              {script?.script && script.generated && (
                                <Button
                                  onClick={() => copyScript(script.script)}
                                  size="sm"
                                  variant="outline"
                                  disabled={isRegenerating}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Edit Button */}
                              {script?.script && script.generated && !editingIds.has(image.id) && (
                                <Button
                                  onClick={() => startEditingScript(image.id, script.script)}
                                  size="sm"
                                  variant="outline"
                                  disabled={isRegenerating || isGenerating}
                                  title="Edit script"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Save Edit Button */}
                              {editingIds.has(image.id) && (
                                <Button
                                  onClick={() => saveEditedScript(image.id)}
                                  size="sm"
                                  variant="outline"
                                  disabled={!editingScripts[image.id]?.trim()}
                                  title="Save changes"
                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Cancel Edit Button */}
                              {editingIds.has(image.id) && (
                                <Button
                                  onClick={() => cancelEditingScript(image.id)}
                                  size="sm"
                                  variant="outline"
                                  title="Cancel editing"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Regenerate Button */}
                              {script && !editingIds.has(image.id) && (
                                <Button
                                  onClick={() => regenerateScript(image.id)}
                                  size="sm"
                                  variant="outline"
                                  disabled={isRegenerating || isGenerating || !prompt.trim()}
                                  title="Regenerate script with current prompt"
                                >
                                  {isRegenerating ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {script?.script ? (
                          <div className={`p-3 rounded-lg text-sm ${
                            isRegenerating ? 'bg-orange-100 border border-orange-200' :
                            script.generated 
                              ? 'bg-green-50 border border-green-200' 
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            {isRegenerating && (
                              <div className="flex items-center gap-2 mb-2 text-orange-700">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs">Regenerating with current prompt...</span>
                              </div>
                            )}
                            
                            {/* Edit Mode */}
                            {editingIds.has(image.id) ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2 text-blue-700">
                                  <Edit className="h-3 w-3" />
                                  <span className="text-xs">Editing script...</span>
                                </div>
                                <Textarea
                                  value={editingScripts[image.id] || ''}
                                  onChange={(e) => handleEditingScriptChange(image.id, e.target.value)}
                                  className="min-h-[100px] text-sm"
                                  placeholder="Edit your script here..."
                                />
                                <div className="text-xs text-gray-500">
                                  Word count: {editingScripts[image.id]?.split(/\s+/).filter(word => word.length > 0).length || 0} words
                                </div>
                              </div>
                            ) : (
                              /* Display Mode */
                              <div className="space-y-2">
                                <p className="whitespace-pre-wrap">{script.script}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                  <div className="text-xs text-gray-500">
                                    Word count: {script.script.split(/\s+/).filter(word => word.length > 0).length} words
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    Target: {individualWordCounts[image.id] || wordCountPerImage} words
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`p-3 rounded-lg text-sm ${
                            isGenerating ? 'bg-blue-100 border border-blue-200 text-blue-700' :
                            'bg-gray-50 border border-gray-200 text-gray-500'
                          }`}>
                            {isGenerating ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Processing in parallel...
                              </div>
                            ) : (
                              'No script generated yet'
                            )}
                          </div>
                        )}

                        {/* Individual Prompt Input */}
                        {showIndividualPrompts && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                            <Label htmlFor={`prompt-${image.id}`} className="text-xs font-medium text-gray-700">
                              Custom prompt for "{image.originalName}":
                            </Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                id={`prompt-${image.id}`}
                                value={individualPrompts[image.id] || ''}
                                onChange={(e) => handleIndividualPromptChange(image.id, e.target.value)}
                                placeholder={`Custom prompt for ${image.originalName}... (leave empty to use global prompt)`}
                                className="flex-1 text-sm min-w-0"
                                disabled={isRegenerating || isGenerating}
                              />
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  value={individualWordCounts[image.id] || wordCountPerImage}
                                  onChange={(e) => handleIndividualWordCountChange(image.id, parseInt(e.target.value) || wordCountPerImage)}
                                  className="w-20 text-sm"
                                  disabled={isRegenerating || isGenerating}
                                  placeholder="Words"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">words</span>
                                <Button
                                  onClick={() => regenerateScript(image.id, individualPrompts[image.id], individualWordCounts[image.id])}
                                  size="sm"
                                  disabled={isRegenerating || isGenerating || (!individualPrompts[image.id]?.trim() && !prompt.trim())}
                                  className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                                  title="Regenerate with this specific prompt and word count"
                                >
                                  {isRegenerating ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Regenerate
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 break-words">
                              {individualPrompts[image.id]?.trim() 
                                ? 'Will use this custom prompt' 
                                : 'Will use global prompt if empty'
                              } • Target: {individualWordCounts[image.id] || wordCountPerImage} words
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {originalImages.length === 0 && (
        <Card className="bg-gray-50 border border-gray-200">
          <CardContent className="pt-6 text-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Images Available</h3>
            <p className="text-gray-600 mb-4">
              Process some images first to generate narration scripts
            </p>
            <Badge variant="outline">
              Go to Process Images to get started
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 