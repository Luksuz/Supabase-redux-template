'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { setPrompt, setScripts, initializeScripts, updateScript } from '../lib/features/scripts/scriptsSlice'
import type { GeneratedScript } from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { FileText, Copy, Download, Mic, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, RotateCcw } from 'lucide-react'

interface ProgressState {
  total: number
  completed: number
  currentImage: string
  completedImages: string[]
}

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { originalImages } = useAppSelector(state => state.images)
  const { prompt, scripts, hasGeneratedScripts } = useAppSelector(state => state.scripts)
  
  // UI-specific states (not stored in Redux)
  const [isGenerating, setIsGenerating] = useState(false)
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [progress, setProgress] = useState<ProgressState>({
    total: 0,
    completed: 0,
    currentImage: '',
    completedImages: []
  })

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Handle prompt changes
  const handlePromptChange = (value: string) => {
    dispatch(setPrompt(value))
  }

  // Regenerate a single script
  const regenerateScript = async (imageId: string) => {
    const image = originalImages.find(img => img.id === imageId)
    if (!image) {
      showMessage('Image not found for regeneration', 'error')
      return
    }

    if (!prompt.trim()) {
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
          prompt: prompt.trim()
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

  // Generate scripts for all images
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
    
    // Initialize progress
    setProgress({
      total: originalImages.length,
      completed: 0,
      currentImage: '',
      completedImages: []
    })

    showMessage(`Starting parallel processing of ${originalImages.length} images...`, 'info')

    try {
      // Initialize scripts array in Redux
      dispatch(initializeScripts(
        originalImages.map(img => ({
          imageId: img.id,
          imageName: img.originalName
        }))
      ))

      console.log(`🚀 Processing ${originalImages.length} images in parallel`)

      // Create all fetch promises immediately - NO STATE UPDATES in promise creation
      const scriptPromises = originalImages.map(async (image, index) => {
        console.log(`📸 Starting request ${index + 1}/${originalImages.length}: ${image.originalName}`)

        try {
          // Fire the request immediately - this is where parallel execution happens
          const response = await fetch('/api/generate-script', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageDataUrl: image.dataUrl,
              imageName: image.originalName,
              prompt: prompt.trim()
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to generate script for ${image.originalName}`)
          }

          const data = await response.json()
          
          console.log(`✅ Completed request ${index + 1}: ${image.originalName}`)
          
          // Update progress ONLY after request completes
          setProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            completedImages: [...prev.completedImages, image.originalName],
            currentImage: `Completed: ${image.originalName}`
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
          console.error(`❌ Error in request ${index + 1}:`, error)
          
          // Update progress even for failed requests
          setProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            completedImages: [...prev.completedImages, `${image.originalName} (failed)`],
            currentImage: `Failed: ${image.originalName}`
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

      console.log(`⚡ All ${originalImages.length} requests initiated in parallel, waiting for completion...`)
      
      // This is where all parallel requests are awaited
      const results = await Promise.all(scriptPromises)

      // Separate successful scripts from errors
      const successfulScripts: GeneratedScript[] = []
      const errors: Array<{ imageId: string; imageName: string; error: string }> = []

      for (const result of results) {
        if (result.success && result.data) {
          successfulScripts.push(result.data)
        } else if (!result.success && result.error) {
          errors.push(result.error)
          // Add error script to the list
          successfulScripts.push({
            imageId: result.error.imageId,
            imageName: result.error.imageName,
            script: `Error: ${result.error.error}`,
            generated: false
          })
        }
      }

      // Update all scripts in Redux
      dispatch(setScripts(successfulScripts))

      console.log(`🎉 Parallel processing complete: ${successfulScripts.filter(s => s.generated).length} successful, ${errors.length} failed`)

      if (errors.length === 0) {
        showMessage(`Successfully generated all ${successfulScripts.length} scripts!`, 'success')
      } else {
        showMessage(`Generated ${successfulScripts.filter(s => s.generated).length} scripts successfully, ${errors.length} failed`, 'success')
      }

    } catch (error) {
      showMessage('Error during script generation: ' + (error as Error).message, 'error')
    } finally {
      setIsGenerating(false)
      // Clear progress after completion
      setTimeout(() => {
        setProgress({ total: 0, completed: 0, currentImage: '', completedImages: [] })
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
    const allScripts = scripts
      .filter(s => s.generated && s.script)
      .map(s => `=== ${s.imageName} ===\n${s.script}\n\n`)
      .join('')
    
    if (!allScripts) {
      showMessage('No scripts available to download', 'error')
      return
    }

    const blob = new Blob([allScripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image-scripts-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage('Scripts downloaded successfully!', 'success')
  }

  const generatedCount = scripts.filter(s => s.generated).length
  const progressPercentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Script Generator</h1>
        <p className="text-gray-600">
          Generate narration scripts for your processed images using AI
        </p>
      </div>

      {/* Progress Card - Only show when generating */}
      {isGenerating && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Generating Scripts ({progress.completed}/{progress.total})
            </CardTitle>
            <CardDescription>
              Processing images in parallel for maximum speed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-blue-600">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {progress.completed} of {progress.total} requests completed
              </div>
            </div>

            {/* Current Status */}
            {progress.currentImage && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">Latest:</span>
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

          <div className="flex items-center gap-4">
            <Button 
              onClick={handleNarrateImages}
              disabled={isGenerating || originalImages.length === 0 || !prompt.trim()}
              className="bg-green-600 hover:bg-green-700"
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
              >
                <Download className="h-4 w-4 mr-2" />
                Download All Scripts
              </Button>
            )}
          </div>

          {/* Next Step Hint */}
          {generatedCount > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                ✨ Great! You have {generatedCount} scripts ready. Go to the <strong>Audio Generator</strong> to convert them to high-quality audio with WellSaid Labs.
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
            <CardDescription>
              View your images and their generated narration scripts
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
                              
                              {/* Regenerate Button */}
                              {script && (
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
                            <p className="whitespace-pre-wrap">{script.script}</p>
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