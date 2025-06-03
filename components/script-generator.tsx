'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSectionedWorkflowField,
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingDetailedScript,
  setDetailedScript,
  clearSections,
  setFullScript
} from '../lib/features/scripts/scriptsSlice'
import type { ScriptSection } from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
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
  Lightbulb
} from 'lucide-react'
import { ResearchAssistant } from './research-assistant'
import { StyleFileUpload } from './style-file-upload'

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

    dispatch(startGeneratingSections())
    showMessage('Generating script sections...', 'info')

    try {
      const response = await fetch('/api/generate-script-sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoTitle: sectionedWorkflow.videoTitle,
          targetAudience: sectionedWorkflow.targetAudience,
          theme: sectionedWorkflow.theme,
          wordCount: sectionedWorkflow.wordCount,
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          additionalInstructions: sectionedWorkflow.additionalInstructions,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: sectionedWorkflow.uploadedStyle
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate sections')
      }

      const data = await response.json()
      
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
      
      dispatch(setSections(sections))
      showMessage(`Generated ${sections.length} script sections!`, 'success')
    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate sections: ${errorMessage}`, 'error')
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
          sectionTitle: section.title,
          writingInstructions: section.writingInstructions,
          videoTitle: sectionedWorkflow.videoTitle,
          targetAudience: sectionedWorkflow.targetAudience,
          theme: sectionedWorkflow.theme,
          emotionalTone: sectionedWorkflow.emotionalTone,
          additionalInstructions: sectionedWorkflow.additionalInstructions,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: sectionedWorkflow.uploadedStyle,
          allSections: sectionedWorkflow.sections.map(s => ({
            title: s.title,
            instructions: s.writingInstructions,
            order: s.order
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate detailed script')
      }

      const data = await response.json()
      
      dispatch(setDetailedScript({
        sectionId,
        script: data.script,
        wordCount: data.wordCount
      }))
      
      showMessage(`Generated detailed script for "${section.title}" (${data.wordCount} words)!`, 'success')
    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate script: ${errorMessage}`, 'error')
    }
  }

  // Generate full script based on all sections
  const handleGenerateFullScript = async () => {
    if (sectionedWorkflow.sections.length === 0) {
      showMessage('No sections available to generate script from', 'error')
      return
    }

    showMessage('Generating full script based on all sections...', 'info')

    try {
      const response = await fetch('/api/generate-detailed-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sections: sectionedWorkflow.sections.map(s => ({
            title: s.title,
            writingInstructions: s.writingInstructions
          })),
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          targetAudience: sectionedWorkflow.targetAudience,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: sectionedWorkflow.uploadedStyle
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate full script')
      }

      const data = await response.json()
      
      // Update the fullScript in Redux
      dispatch(setFullScript(data.fullScript))
      
      showMessage(`Generated full script (${data.meta.totalWords} words)!`, 'success')
    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate full script: ${errorMessage}`, 'error')
    }
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
Theme: ${sectionedWorkflow.theme}
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
  const totalWords = sectionsWithScripts.reduce((total, s) => total + s.wordCount, 0)

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
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Research Assistant */}
      <ResearchAssistant />

      {/* Style File Upload */}
      <StyleFileUpload />

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
              <Input
                id="theme"
                value={sectionedWorkflow.theme}
                onChange={(e) => handleFieldChange('theme', e.target.value)}
                placeholder="e.g., Educational, Motivational..."
                disabled={sectionedWorkflow.isGeneratingSections}
              />
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

      {/* Script Sections */}
      {sectionedWorkflow.sections.length > 0 && (
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
                    Generate Full Script
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

      {/* Empty State */}
      {sectionedWorkflow.sections.length === 0 && (
        <Card className="bg-gray-50 border border-gray-200">
          <CardContent className="pt-6 text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Script Sections</h3>
            <p className="text-gray-600 mb-4">
              Configure your script parameters and generate sections to get started
            </p>
            <Badge variant="outline">
              Fill out the configuration above and click "Generate Script Sections"
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 