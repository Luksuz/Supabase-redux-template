'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSectionedWorkflowField,
  startGeneratingSections,
  updateSectionsProgress,
  setSections,
  updateSection,
  startGeneratingDetailedScript,
  setDetailedScript,
  clearSections,
  setFullScript,
  setCTAEnabled,
  setCTAPlacement,
  setCTAType,
  startGeneratingAllDetailedScripts,
  setAllDetailedScripts,
  startGeneratingBatch,
  startDetailedScriptGeneration,
  updateDetailedScriptProgress,
  completeDetailedScriptGeneration,
  setBatchResults,
  THEME_OPTIONS
} from '../lib/features/scripts/scriptsSlice'
import type { ScriptSection } from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Progress } from './ui/progress'
import { 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Edit, 
  Save, 
  X, 
  Plus,
  Trash2,
  RotateCcw,
  Settings,
  Target,
  Users,
  Zap,
  Lightbulb,
  Languages,
  List,
  Search,
  Megaphone,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { ResearchAssistant } from './research-assistant'
import { StyleFileUpload } from './style-file-upload'
import { ScriptTranslator } from './script-translator'

// Progress Bar Component
interface ProgressBarProps {
  current: number
  total: number
  message: string
  className?: string
}

function ProgressBar({ current, total, message, className = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{message}</span>
        <span className="text-gray-600">{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{current} of {total}</span>
        <span>{total - current} remaining</span>
      </div>
    </div>
  )
}

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingInstructions, setEditingInstructions] = useState("")

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    // Clear message after 5 seconds
    setTimeout(() => setMessage(""), 5000)
  }

  // Handle field changes
  const handleFieldChange = (field: keyof typeof sectionedWorkflow, value: any) => {
    dispatch(setSectionedWorkflowField({ field, value }))
  }

  // Generate script sections based on parameters
  const handleGenerateSections = async () => {
    if (!sectionedWorkflow.videoTitle.trim()) {
      showMessage('Please enter a video title', 'error')
      return
    }
    
    const MAX_RETRIES = 3
    let success = false
    let lastError = null

    // Retry logic for generating sections
    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
    dispatch(startGeneratingSections())
      
      // Simulate progress for sections generation
      const updateProgress = (current: number, message: string) => {
        dispatch(updateSectionsProgress({ current, total: 100, message }))
      }

      updateProgress(10, `Preparing request${attempt > 1 ? ` - Retry ${attempt}/${MAX_RETRIES}` : ''}...`)
      
      showMessage(
        `Generating script sections...${attempt > 1 ? ` - Retry ${attempt}/${MAX_RETRIES}` : ''}`,
        'info'
      )

    try {
        updateProgress(25, 'Sending request to AI model...')
        
      const response = await fetch('/api/generate-script-sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoTitle: sectionedWorkflow.videoTitle,
          targetAudience: sectionedWorkflow.targetAudience,
            themeId: sectionedWorkflow.themeId,
          wordCount: sectionedWorkflow.wordCount,
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          additionalInstructions: sectionedWorkflow.additionalInstructions,
          selectedModel: sectionedWorkflow.selectedModel,
            uploadedStyle: sectionedWorkflow.uploadedStyle,
            cta: sectionedWorkflow.cta
        }),
      })

        updateProgress(60, 'Processing AI response...')

      if (!response.ok) {
        const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate sections`)
      }

        updateProgress(80, 'Parsing sections data...')
      const data = await response.json()
        
        // Validate response data
        if (!data.sections || !Array.isArray(data.sections)) {
          throw new Error('Invalid response format: missing or invalid sections array')
        }

        if (data.sections.length === 0) {
          throw new Error('No sections were generated in the response')
        }
        
        updateProgress(95, 'Finalizing sections...')
      
      const sections: ScriptSection[] = data.sections.map((section: any, index: number) => ({
        id: `section-${Date.now()}-${index}`,
        title: section.title,
        writingInstructions: section.writingInstructions,
        image_generation_prompt: section.image_generation_prompt || '',
        generatedScript: '',
        isGenerating: false,
        wordCount: section.wordCount || 0,
        order: index + 1
      }))
        
        updateProgress(100, 'Sections generated successfully!')
      
      dispatch(setSections(sections))
        showMessage(
          `Generated ${sections.length} script sections!${attempt > 1 ? ` (succeeded on retry ${attempt})` : ''}`,
          'success'
        )
        success = true

    } catch (error) {
        lastError = error as Error
        const errorMessage = lastError.message
        
        if (attempt < MAX_RETRIES) {
          updateProgress(0, `Attempt ${attempt} failed, preparing retry...`)
          showMessage(
            `Section generation attempt ${attempt} failed: ${errorMessage}. Retrying in 5 seconds...`,
            'error'
          )
          // Wait 5 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else {
          // Clear progress on final failure
          dispatch(setSections([]))
          showMessage(
            `Failed to generate sections after ${MAX_RETRIES} attempts: ${errorMessage}`,
            'error'
          )
        }
      }
    }
  }

  // Generate detailed script for a section
  const handleGenerateDetailedScript = async (sectionId: string) => {
    const section = sectionedWorkflow.sections.find(s => s.id === sectionId)
    if (!section) return

    dispatch(startGeneratingDetailedScript(sectionId))
    showMessage(`Generating detailed script for: ${section.title}...`, 'info')

    try {
      const response = await fetch('/api/generate-detailed-script', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
          sections: [{ // Send as array to match API
            title: section.title,
            writingInstructions: section.writingInstructions
          }],
          title: sectionedWorkflow.videoTitle,
          targetAudience: sectionedWorkflow.targetAudience,
          themeId: sectionedWorkflow.themeId,
          emotionalTone: sectionedWorkflow.emotionalTone,
          additionalInstructions: sectionedWorkflow.additionalInstructions,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: sectionedWorkflow.uploadedStyle,
          cta: sectionedWorkflow.cta // Include CTA configuration
            }),
          })

          if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate detailed script')
          }

          const data = await response.json()
          
      // Extract the first section from the response
      const sectionData = data.detailedSections[0]
      
      dispatch(setDetailedScript({
        sectionId,
        script: sectionData.detailedContent,
        wordCount: sectionData.wordCount
      }))
      
      showMessage(`Generated detailed script for "${section.title}" (${sectionData.wordCount} words)!`, 'success')
        } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate script: ${errorMessage}`, 'error')
    }
  }

  // Generate full script based on all sections with batching for all models
  const handleGenerateFullScript = async () => {
    if (sectionedWorkflow.sections.length === 0) {
      showMessage('No sections available to generate script from', 'error')
      return
    }

    const modelId = sectionedWorkflow.selectedModel || 'gpt-4o-mini'
    const isClaudeModel = modelId.includes('claude') || modelId.includes('anthropic')
    const sectionsToGenerate = sectionedWorkflow.sections.filter(s => !s.generatedScript.trim())
    
    if (sectionsToGenerate.length === 0) {
      showMessage('All sections already have generated scripts', 'info')
      return
    }

    // Use batched processing for all models with different configurations
    await handleBatchedGeneration(sectionsToGenerate, isClaudeModel)
  }

  // Handle batched generation for all models (Claude and OpenAI with different settings)
  const handleBatchedGeneration = async (sectionsToGenerate: typeof sectionedWorkflow.sections, isClaudeModel: boolean) => {
    // Different batch settings based on model type
    const BATCH_SIZE = isClaudeModel ? 15 : 30 // OpenAI can handle larger batches
    const BATCH_DELAY_MS = isClaudeModel ? 60 * 1000 : 10 * 1000 // 1 min for Claude, 10 sec for OpenAI
    const MAX_RETRIES = 3

    const totalBatches = Math.ceil(sectionsToGenerate.length / BATCH_SIZE)
    const modelType = isClaudeModel ? 'Claude' : 'OpenAI'
    
    // Initialize progress tracking
    dispatch(startDetailedScriptGeneration({ 
      totalBatches, 
      totalSections: sectionsToGenerate.length 
    }))
    
    showMessage(
      `Starting batched generation for ${modelType} model: ${sectionsToGenerate.length} sections in ${totalBatches} batch(es) (${BATCH_SIZE} sections per batch)`,
      'info'
    )

    let completedSections = 0

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE
      const endIdx = Math.min((batchIndex + 1) * BATCH_SIZE, sectionsToGenerate.length)
      const batchSections = sectionsToGenerate.slice(startIdx, endIdx)
      
      let batchSuccess = false
      let lastError = null

      // Update progress for current batch
      dispatch(updateDetailedScriptProgress({
        currentBatch: batchIndex + 1,
        currentSection: completedSections,
        message: `Processing batch ${batchIndex + 1}/${totalBatches}...`
      }))

      // Retry logic for each batch
      for (let attempt = 1; attempt <= MAX_RETRIES && !batchSuccess; attempt++) {
        // Start generating for this batch
        dispatch(startGeneratingBatch(batchSections.map(s => s.id)))
        
        const progressMessage = `Processing batch ${batchIndex + 1}/${totalBatches}: sections ${startIdx + 1}-${endIdx} (${batchSections.length} sections)${attempt > 1 ? ` - Retry ${attempt}/${MAX_RETRIES}` : ''}`
        
        dispatch(updateDetailedScriptProgress({
          currentBatch: batchIndex + 1,
          currentSection: completedSections,
          message: progressMessage
        }))
        
        showMessage(progressMessage, 'info')

    try {
      const response = await fetch('/api/generate-detailed-script', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
              sections: batchSections.map(s => ({
            title: s.title,
            writingInstructions: s.writingInstructions
          })),
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          targetAudience: sectionedWorkflow.targetAudience,
          selectedModel: sectionedWorkflow.selectedModel,
              uploadedStyle: sectionedWorkflow.uploadedStyle,
              cta: sectionedWorkflow.cta
              }),
            })

            if (!response.ok) {
        const errorData = await response.json()
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate batch`)
            }

            const data = await response.json()
            
          // Validate response data
          if (!data.detailedSections || !Array.isArray(data.detailedSections)) {
            throw new Error('Invalid response format: missing or invalid detailedSections array')
          }

          if (data.detailedSections.length !== batchSections.length) {
            throw new Error(`Response mismatch: expected ${batchSections.length} sections, got ${data.detailedSections.length}`)
          }
          
          // Update Redux with batch results
          const batchResults = batchSections.map((section, idx) => ({
            id: section.id,
            script: data.detailedSections[idx]?.detailedContent || '[Error: No content generated]',
            wordCount: data.detailedSections[idx]?.wordCount || 0,
            error: !data.detailedSections[idx]?.detailedContent
          }))
          
          dispatch(setBatchResults(batchResults))
          
          // Update completed sections count
          completedSections += batchSections.length
          
          const successCount = batchResults.filter(r => !r.error).length
          const completionMessage = `Batch ${batchIndex + 1}/${totalBatches} complete: ${successCount}/${batchSections.length} sections generated successfully${attempt > 1 ? ` (succeeded on retry ${attempt})` : ''}`
          
          dispatch(updateDetailedScriptProgress({
            currentBatch: batchIndex + 1,
            currentSection: completedSections,
            message: completionMessage
          }))
          
          showMessage(completionMessage, successCount === batchSections.length ? 'success' : 'error')

          batchSuccess = true

    } catch (error) {
          lastError = error as Error
          const errorMessage = lastError.message
          
          if (attempt < MAX_RETRIES) {
            const retryMessage = `Batch ${batchIndex + 1} attempt ${attempt} failed: ${errorMessage}. Retrying in 5 seconds...`
            dispatch(updateDetailedScriptProgress({
              currentBatch: batchIndex + 1,
              currentSection: completedSections,
              message: retryMessage
            }))
            showMessage(retryMessage, 'error')
            // Wait 5 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 5000))
          } else {
            const failMessage = `Batch ${batchIndex + 1} failed after ${MAX_RETRIES} attempts: ${errorMessage}`
            dispatch(updateDetailedScriptProgress({
              currentBatch: batchIndex + 1,
              currentSection: completedSections,
              message: failMessage
            }))
            showMessage(failMessage, 'error')
            
            // Mark all sections in this batch as failed
            const failedResults = batchSections.map(section => ({
              id: section.id,
              script: `[Error generating content after ${MAX_RETRIES} attempts: ${errorMessage}]`,
              wordCount: 0,
              error: true
            }))
            dispatch(setBatchResults(failedResults))
          }
        }
      }

      // Add delay between batches (except for the last batch)
      if (batchIndex < totalBatches - 1) {
        const delaySeconds = BATCH_DELAY_MS / 1000
        const delayMessage = `Waiting ${delaySeconds} seconds before next batch${isClaudeModel ? ' to respect Claude rate limits' : ' for optimal performance'}... (${totalBatches - batchIndex - 1} batches remaining)`
        
        dispatch(updateDetailedScriptProgress({
          currentBatch: batchIndex + 1,
          currentSection: completedSections,
          message: delayMessage
        }))
        
        showMessage(delayMessage, 'info')
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    const allSections = sectionedWorkflow.sections
    const successfulSections = allSections.filter(s => s.generatedScript.trim() && !s.generatedScript.includes('[Error'))
    const totalWords = successfulSections.reduce((sum, s) => sum + s.wordCount, 0)
    
    const finalMessage = `Batched generation complete! ${successfulSections.length}/${allSections.length} sections generated (${totalWords} total words)`
    
    // Complete progress tracking
    dispatch(completeDetailedScriptGeneration())
    
    showMessage(finalMessage, 'success')
  }

  // Edit section
  const startEditingSection = (section: ScriptSection) => {
    setEditingSectionId(section.id)
    setEditingTitle(section.title)
    setEditingInstructions(section.writingInstructions)
  }

  const saveEditingSection = () => {
    if (!editingSectionId) return
    
    dispatch(updateSection({ id: editingSectionId, field: 'title', value: editingTitle }))
    dispatch(updateSection({ id: editingSectionId, field: 'writingInstructions', value: editingInstructions }))
    
    cancelEditingSection()
    showMessage('Section updated successfully!', 'success')
  }

  const cancelEditingSection = () => {
    setEditingSectionId(null)
    setEditingTitle("")
    setEditingInstructions("")
  }

  // Remove section
  const removeSection = (sectionId: string) => {
    const updatedSections = sectionedWorkflow.sections.filter(s => s.id !== sectionId)
    dispatch(setSections(updatedSections))
    showMessage('Section removed', 'info')
  }

  // Add new section
  const addNewSection = () => {
    const newSection: ScriptSection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      writingInstructions: 'Describe the writing instructions for this section...',
      image_generation_prompt: 'Describe the visual scene for this section...',
      generatedScript: '',
      isGenerating: false,
      wordCount: 0,
      order: sectionedWorkflow.sections.length + 1
    }
    
    dispatch(setSections([...sectionedWorkflow.sections, newSection]))
    showMessage('New section added', 'success')
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

  // Download all scripts
  const downloadAllScripts = () => {
    const sectionsWithScripts = sectionedWorkflow.sections.filter(s => s.generatedScript.trim())
    
    if (sectionsWithScripts.length === 0) {
      showMessage('No scripts available to download', 'error')
      return
    }

    const totalWords = sectionsWithScripts.reduce((total, s) => total + s.wordCount, 0)

    const statsHeader = `=== VIDEO SCRIPT: ${sectionedWorkflow.videoTitle} ===
Target Audience: ${sectionedWorkflow.targetAudience}
Theme: ${sectionedWorkflow.themeId ? THEME_OPTIONS.find(t => t.id === sectionedWorkflow.themeId)?.name || sectionedWorkflow.themeId : 'Not specified'}
Emotional Tone: ${sectionedWorkflow.emotionalTone}
Total Sections: ${sectionsWithScripts.length}
Total Words: ${totalWords}
Generated on: ${new Date().toLocaleString()}

${sectionedWorkflow.additionalInstructions ? `Additional Instructions: ${sectionedWorkflow.additionalInstructions}\n` : ''}
=== SCRIPT SECTIONS ===

`

    const allScripts = sectionsWithScripts
      .map((section, index) => `=== ${section.order}. ${section.title} ===
Word Count: ${section.wordCount} words
Writing Instructions: ${section.writingInstructions}

${section.generatedScript}

`)
      .join('')
    
    const fullContent = statsHeader + allScripts

    const blob = new Blob([fullContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sectionedWorkflow.videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-script-${sectionsWithScripts.length}-sections-${totalWords}-words.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage(`Downloaded ${sectionsWithScripts.length} sections (${totalWords} total words)!`, 'success')
  }

  // Clear all sections
  const handleClearSections = () => {
    dispatch(clearSections())
    showMessage('All sections cleared', 'info')
  }

  const sectionsWithScripts = sectionedWorkflow.sections.filter(s => s.generatedScript.trim())
  const totalWords = sectionedWorkflow.fullScript 
    ? sectionedWorkflow.fullScript.split(/\s+/).filter(word => word.length > 0).length 
    : sectionsWithScripts.reduce((total, s) => total + s.wordCount, 0)

  return (
    <div className="w-full max-w-full p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Script Generator</h1>
        <p className="text-gray-600">
          Create structured video scripts with AI research assistance and detailed section generation
        </p>
      </div>

      {/* Script Summary */}
      {sectionedWorkflow.sections.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{sectionedWorkflow.sections.length}</div>
                <div className="text-sm text-blue-700">Total Sections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{sectionsWithScripts.length}</div>
                <div className="text-sm text-green-700">Generated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{totalWords.toLocaleString()}</div>
                <div className="text-sm text-purple-700">Total Words</div>
            </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {totalWords > 0 ? `${Math.ceil(totalWords / 150)}` : '0'}
                </div>
                <div className="text-sm text-orange-700">Est. Minutes</div>
              </div>
              </div>
            {totalWords > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  Average: {sectionsWithScripts.length > 0 ? Math.round(totalWords / sectionsWithScripts.length) : 0} words/section
                </Badge>
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Reading speed: ~150 WPM
                </Badge>
                {sectionedWorkflow.videoTitle && (
                  <Badge variant="outline" className="text-purple-700 border-purple-300">
                    "{sectionedWorkflow.videoTitle}"
                  </Badge>
                )}
                {sectionedWorkflow.cta.enabled && (
                  <Badge variant="outline" className="text-orange-700 border-orange-300">
                    <Megaphone className="h-3 w-3 mr-1" />
                    {sectionedWorkflow.cta.type === 'newsletter' ? 'Newsletter' : 'Engagement'} CTA @ {sectionedWorkflow.cta.placement}w
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Setup & Research
          </TabsTrigger>
          <TabsTrigger value="sections" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Script Sections
          </TabsTrigger>
          <TabsTrigger value="translation" className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            Translation
          </TabsTrigger>
        </TabsList>

        {/* Setup & Research Tab */}
        <TabsContent value="setup" className="space-y-6">
      {/* Research Assistant */}
      <ResearchAssistant />

      {/* Style File Upload */}
      <StyleFileUpload />

          {/* Sections Generation Progress - Show in Setup tab */}
          {sectionedWorkflow.sectionsProgress.isActive && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  Generating Script Sections
                </CardTitle>
                <CardDescription>
                  Creating structured sections for your video script...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProgressBar
                  current={sectionedWorkflow.sectionsProgress.current}
                  total={sectionedWorkflow.sectionsProgress.total}
                  message={sectionedWorkflow.sectionsProgress.message}
                />
              </CardContent>
            </Card>
          )}

      {/* Script Configuration */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Script Configuration
          </CardTitle>
          <CardDescription>
            Define the parameters for your video script
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Title */}
          <div className="space-y-2">
            <Label htmlFor="videoTitle" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Video Title *
            </Label>
              <Input
              id="videoTitle"
              value={sectionedWorkflow.videoTitle}
              onChange={(e) => handleFieldChange('videoTitle', e.target.value)}
              placeholder="Enter your video title..."
              disabled={sectionedWorkflow.isGeneratingSections}
              />
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="targetAudience" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Target Audience
              </Label>
              <Input
                id="targetAudience"
                value={sectionedWorkflow.targetAudience}
                onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
                placeholder="e.g., Young adults, Entrepreneurs..."
                disabled={sectionedWorkflow.isGeneratingSections}
              />
          </div>

            {/* Word Count */}
          <div className="space-y-2">
              <Label htmlFor="wordCount" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Target Word Count
              </Label>
              <Input
                id="wordCount"
                type="number"
                value={sectionedWorkflow.wordCount || ''}
                onChange={(e) => handleFieldChange('wordCount', parseInt(e.target.value) || 0)}
                placeholder="e.g., 1000, 2000..."
                min="100"
                max="10000"
                disabled={sectionedWorkflow.isGeneratingSections}
              />
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={sectionedWorkflow.themeId}
                    onValueChange={(value) => handleFieldChange('themeId', value)}
                disabled={sectionedWorkflow.isGeneratingSections}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a theme..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {THEME_OPTIONS.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          <div className="space-y-1">
                            <div className="font-medium">{theme.name}</div>
                            <div className="text-xs text-gray-600 max-w-xs">
                              {theme.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sectionedWorkflow.themeId && (
                    <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded border">
                      <strong>Selected:</strong> {THEME_OPTIONS.find(t => t.id === sectionedWorkflow.themeId)?.description}
                    </div>
                  )}
            </div>

            {/* Emotional Tone */}
            <div className="space-y-2">
              <Label htmlFor="emotionalTone" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Emotional Tone
              </Label>
              <Input
                id="emotionalTone"
                value={sectionedWorkflow.emotionalTone}
                onChange={(e) => handleFieldChange('emotionalTone', e.target.value)}
                placeholder="e.g., Exciting, Calm, Mysterious..."
                disabled={sectionedWorkflow.isGeneratingSections}
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="selectedModel">AI Model</Label>
              <Select
                value={sectionedWorkflow.selectedModel}
                onValueChange={(value) => handleFieldChange('selectedModel', value)}
                disabled={sectionedWorkflow.isGeneratingSections}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Instructions */}
          <div className="space-y-2">
            <Label htmlFor="additionalInstructions" className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Additional Instructions
            </Label>
            <Textarea
              id="additionalInstructions"
              value={sectionedWorkflow.additionalInstructions}
              onChange={(e) => handleFieldChange('additionalInstructions', e.target.value)}
              placeholder="Any specific requirements or style preferences..."
              rows={3}
              disabled={sectionedWorkflow.isGeneratingSections}
            />
          </div>

          {/* Generate Sections Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button 
              onClick={handleGenerateSections}
              disabled={sectionedWorkflow.isGeneratingSections || !sectionedWorkflow.videoTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sectionedWorkflow.isGeneratingSections ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Sections...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Script Sections
                </>
              )}
            </Button>
            
            {sectionedWorkflow.sections.length > 0 && (
              <>
              <Button 
                  onClick={addNewSection}
                variant="outline"
                  disabled={sectionedWorkflow.isGeneratingSections}
              >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
              </Button>

              <Button 
                  onClick={handleClearSections}
                variant="outline"
                  disabled={sectionedWorkflow.isGeneratingSections}
              >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
              </Button>
                      </>
                    )}
                </div>
        </CardContent>
      </Card>

          {/* CTA Configuration */}
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Call To Action (CTA) Configuration
              </CardTitle>
              <CardDescription>
                Configure when and how to include calls-to-action in your script
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CTA Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    {sectionedWorkflow.cta.enabled ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                    )}
                    Include CTA in Script
                  </Label>
                  <p className="text-sm text-gray-600">
                    {sectionedWorkflow.cta.enabled 
                      ? 'CTA will be included at the specified placement' 
                      : 'Script will be generated without any call-to-action'}
                  </p>
                </div>
                <Button
                  onClick={() => dispatch(setCTAEnabled(!sectionedWorkflow.cta.enabled))}
                  variant={sectionedWorkflow.cta.enabled ? "default" : "outline"}
                  size="sm"
                  disabled={sectionedWorkflow.isGeneratingSections}
                >
                  {sectionedWorkflow.cta.enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              {/* CTA Configuration (only show when enabled) */}
              {sectionedWorkflow.cta.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  {/* CTA Type Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="ctaType">CTA Type</Label>
                    <Select
                      value={sectionedWorkflow.cta.type}
                      onValueChange={(value: 'newsletter' | 'engagement') => dispatch(setCTAType(value))}
                      disabled={sectionedWorkflow.isGeneratingSections}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newsletter">Newsletter Signup (Insights Academy)</SelectItem>
                        <SelectItem value="engagement">Engagement (Comment Request)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CTA Placement */}
                  <div className="space-y-2">
                    <Label htmlFor="ctaPlacement">CTA Placement (Word Count)</Label>
                    <input
                      type="number"
                      id="ctaPlacement"
                      value={sectionedWorkflow.cta.placement}
                      onChange={(e) => {
                        const value = Math.min(100000, Math.max(0, parseInt(e.target.value)));
                        dispatch(setCTAPlacement(value));
                      }}
                      disabled={sectionedWorkflow.isGeneratingSections}
                      className="w-full p-2 border border-gray-300 rounded"
                      placeholder="Enter word count for CTA placement"
                      max={100000}
                    />
                  </div>

                  {/* CTA Preview */}
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-sm font-medium text-gray-700">CTA Preview:</Label>
                    <div className="p-3 bg-white border border-green-300 rounded text-sm">
                      {sectionedWorkflow.cta.type === 'newsletter' ? (
                        <p className="text-gray-700">
                          <strong>Newsletter CTA:</strong> Promotes "Insights Academy" newsletter with free "The Kybalion" ebook. 
                          Frames exclusive content as "too confidential for YouTube" to drive signups. 
                          <em className="text-green-700"> (2 sentences max, seamlessly integrated)</em>
                        </p>
                      ) : (
                        <p className="text-gray-700">
                          <strong>Engagement CTA:</strong> "If this video resonated with you, let us know by commenting, 'I understood it.'" 
                          <em className="text-green-700"> (Simple engagement request)</em>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Placement Info */}
                  {sectionedWorkflow.wordCount > 0 && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Target className="h-3 w-3" />
                        <span>
                          With {sectionedWorkflow.wordCount} total words and CTA at {sectionedWorkflow.cta.placement} words, 
                          the CTA will appear in section {Math.min(Math.floor(sectionedWorkflow.cta.placement / Math.round(sectionedWorkflow.wordCount / Math.max(1, Math.floor(sectionedWorkflow.wordCount / 800)))) + 1, Math.max(1, Math.floor(sectionedWorkflow.wordCount / 800)))} of {Math.max(1, Math.floor(sectionedWorkflow.wordCount / 800))}.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Script Sections Tab */}
        <TabsContent value="sections" className="space-y-6">
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

          {/* Sections Generation Progress */}
          {sectionedWorkflow.sectionsProgress.isActive && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <ProgressBar
                  current={sectionedWorkflow.sectionsProgress.current}
                  total={sectionedWorkflow.sectionsProgress.total}
                  message={sectionedWorkflow.sectionsProgress.message}
                />
              </CardContent>
            </Card>
          )}

          {/* Detailed Script Generation Progress */}
          {sectionedWorkflow.detailedScriptProgress.isActive && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                    <span className="font-medium text-purple-800">Detailed Script Generation</span>
                  </div>
                  
                  {/* Batch Progress */}
                  <ProgressBar
                    current={sectionedWorkflow.detailedScriptProgress.currentBatch}
                    total={sectionedWorkflow.detailedScriptProgress.totalBatches}
                    message={`Batch Progress - ${sectionedWorkflow.detailedScriptProgress.message}`}
                  />
                  
                  {/* Section Progress */}
                  <ProgressBar
                    current={sectionedWorkflow.detailedScriptProgress.currentSection}
                    total={sectionedWorkflow.detailedScriptProgress.totalSections}
                    message="Overall Section Progress"
                  />
                </div>
              </CardContent>
            </Card>
          )}

      {/* Script Sections */}
          {sectionedWorkflow.sections.length > 0 ? (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
            <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Script Sections ({sectionedWorkflow.sections.length})
            </CardTitle>
                <CardDescription>
                  Edit section titles and instructions, then generate detailed scripts
                </CardDescription>
                </div>
              <div className="flex items-center gap-2">
                {sectionedWorkflow.sections.length > 0 && (
                  <Button
                    onClick={handleGenerateFullScript}
                    disabled={sectionedWorkflow.sections.length === 0}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                        {(() => {
                          const modelId = sectionedWorkflow.selectedModel || 'gpt-4o-mini'
                          const isClaudeModel = modelId.includes('claude') || modelId.includes('anthropic')
                          const sectionsToGenerate = sectionedWorkflow.sections.filter(s => !s.generatedScript.trim())
                          
                          if (sectionsToGenerate.length === 0) {
                            return 'All Scripts Generated'
                          }
                          
                          const batchSize = isClaudeModel ? 15 : 30
                          const batches = Math.ceil(sectionsToGenerate.length / batchSize)
                          const estimatedMinutes = isClaudeModel ? 
                            batches : // Claude: 1 minute per batch
                            Math.ceil(batches * 0.17) // OpenAI: ~10 seconds per batch
                          
                          return `Generate Scripts (${batches} batches, ~${estimatedMinutes} min)`
                        })()}
                  </Button>
                )}
                {sectionsWithScripts.length > 0 && (
                  <Button
                    onClick={downloadAllScripts}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All ({totalWords} words)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
                {/* Model-specific generation info */}
                {(() => {
                  const modelId = sectionedWorkflow.selectedModel || 'gpt-4o-mini'
                  const isClaudeModel = modelId.includes('claude') || modelId.includes('anthropic')
                  const sectionsToGenerate = sectionedWorkflow.sections.filter(s => !s.generatedScript.trim())
                  
                  if (sectionsToGenerate.length > 0) {
                    const batchSize = isClaudeModel ? 15 : 30
                    const batches = Math.ceil(sectionsToGenerate.length / batchSize)
                    const delayTime = isClaudeModel ? '1 minute' : '10 seconds'
                    
                    return (
                      <Card className={`mb-4 ${isClaudeModel ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-1 rounded-full ${isClaudeModel ? 'bg-amber-100' : 'bg-blue-100'}`}>
                              {isClaudeModel ? (
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Zap className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-medium text-sm ${isClaudeModel ? 'text-amber-800' : 'text-blue-800'}`}>
                                {isClaudeModel ? 'Claude Model - Conservative Batching' : 'OpenAI Model - Optimized Batching'}
                              </h4>
                              <p className={`text-xs mt-1 ${isClaudeModel ? 'text-amber-700' : 'text-blue-700'}`}>
                                {isClaudeModel ? (
                                  <>
                                    Claude models will process <strong>{batchSize} sections per batch</strong> with {delayTime} delays to respect rate limits. 
                                    Your {sectionsToGenerate.length} sections will be processed in <strong>{batches} batch(es)</strong> over approximately {batches} minute(s).
                                  </>
                                ) : (
                                  <>
                                    OpenAI models will process <strong>{batchSize} sections per batch</strong> with {delayTime} delays for optimal performance. 
                                    Your {sectionsToGenerate.length} sections will be processed in <strong>{batches} batch(es)</strong> over approximately {Math.ceil(batches * 0.17)} minute(s).
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }
                  return null
                })()}
                
            <div className="space-y-4">
              {sectionedWorkflow.sections.map((section, index) => (
                <div 
                  key={section.id} 
                  className={`border rounded-lg p-4 ${
                    section.isGenerating ? 'border-blue-200 bg-blue-50' :
                    section.generatedScript ? 'border-green-200 bg-green-50' :
                    'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Section Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{section.order}
                              </Badge>
                        {editingSectionId === section.id ? (
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="font-medium max-w-md"
                          />
                        ) : (
                          <h3 className="font-medium text-gray-900">{section.title}</h3>
                        )}
                            {/* CTA Indicator */}
                            {sectionedWorkflow.cta.enabled && sectionedWorkflow.wordCount > 0 && (
                              (() => {
                                const avgWordsPerSection = Math.round(sectionedWorkflow.wordCount / Math.max(1, Math.floor(sectionedWorkflow.wordCount / 800)));
                                const ctaSectionIndex = Math.min(Math.floor(sectionedWorkflow.cta.placement / avgWordsPerSection), Math.max(1, Math.floor(sectionedWorkflow.wordCount / 800)) - 1);
                                const isCtaSection = section.order === ctaSectionIndex + 1;
                                
                                return isCtaSection ? (
                                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                    <Megaphone className="h-3 w-3 mr-1" />
                                    {sectionedWorkflow.cta.type === 'newsletter' ? 'Newsletter CTA' : 'Engagement CTA'}
                                  </Badge>
                                ) : null;
                              })()
                            )}
                        {section.generatedScript && (
                          <>
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              {section.wordCount.toLocaleString()} words
                              </Badge>
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                              ~{Math.ceil(section.wordCount / 150)} min read
                              </Badge>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {section.isGenerating && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Generating
                              </Badge>
                            )}
                            
                        {editingSectionId === section.id ? (
                          <>
                                <Button
                              onClick={saveEditingSection}
                                  size="sm"
                                  variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                                >
                              <Save className="h-3 w-3" />
                                </Button>
                                <Button
                              onClick={cancelEditingSection}
                                  size="sm"
                                  variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                              <X className="h-3 w-3" />
                                </Button>
                          </>
                        ) : (
                          <>
                                <Button
                              onClick={() => startEditingSection(section)}
                                  size="sm"
                                  variant="outline"
                              disabled={section.isGenerating}
                                >
                              <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                              onClick={() => handleGenerateDetailedScript(section.id)}
                                  size="sm"
                              disabled={section.isGenerating}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {section.isGenerating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : section.generatedScript ? (
                                <RotateCcw className="h-3 w-3" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                            </Button>
                                <Button
                              onClick={() => removeSection(section.id)}
                                  size="sm"
                                  variant="outline"
                              disabled={section.isGenerating}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                                </Button>
                          </>
                              )}
                          </div>
                        </div>
                        
                    {/* Writing Instructions */}
                              <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Writing Instructions:</Label>
                      {editingSectionId === section.id ? (
                                <Textarea
                          value={editingInstructions}
                          onChange={(e) => setEditingInstructions(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                          {section.writingInstructions}
                        </p>
                      )}
                    </div>

                    {/* Generated Script */}
                    {section.generatedScript && (
                              <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-medium text-gray-700">Generated Script:</Label>
                            <div className="flex gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {section.wordCount.toLocaleString()} words
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                ~{Math.ceil(section.wordCount / 150)} min
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {section.generatedScript.length.toLocaleString()} chars
                              </Badge>
                                  </div>
                                  </div>
                          <Button
                            onClick={() => copyScript(section.generatedScript)}
                            size="sm"
                            variant="outline"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                          <p className="whitespace-pre-wrap">{section.generatedScript}</p>
                                </div>
                              </div>
                            )}
                          </div>
                              </div>
              ))}
                          </div>
          </CardContent>
        </Card>
          ) : (
            /* Empty State for Sections */
            <Card className="bg-gray-50 border border-gray-200">
              <CardContent className="pt-6 text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Script Sections</h3>
                <p className="text-gray-600 mb-4">
                  Configure your script parameters in the Setup tab and generate sections to get started
                </p>
                <Badge variant="outline">
                  Go to Setup & Research tab to configure your script
                </Badge>
              </CardContent>
            </Card>
      )}

      {/* Full Script Display */}
      {sectionedWorkflow.fullScript && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Generated Full Script
                </CardTitle>
                <CardDescription>
                  Complete script generated from all sections
                </CardDescription>
              </div>
                              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-purple-700 border-purple-300">
                  {sectionedWorkflow.fullScript.split(/\s+/).length.toLocaleString()} words
                </Badge>
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  ~{Math.ceil(sectionedWorkflow.fullScript.split(/\s+/).length / 150)} min read
                </Badge>
                                <Button
                  onClick={() => copyScript(sectionedWorkflow.fullScript)}
                  variant="outline"
                                  size="sm"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Copy Full Script
                                </Button>
                              </div>
                            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {sectionedWorkflow.fullScript}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Translation Tab */}
        <TabsContent value="translation" className="space-y-6">
          <ScriptTranslator />
        </TabsContent>
      </Tabs>
    </div>
  )
} 