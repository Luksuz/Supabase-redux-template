'use client'

import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  createNewJob,
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingScript,
  addGeneratedText,
  startGeneratingAllScripts,
  setLoading,
  setError,
  loadJobs,
  type FineTuningJob,
  type FineTuningSection
} from '@/lib/features/scripts/scriptsSlice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Copy, Download, Plus, Wand2, FileText } from 'lucide-react'

export default function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { currentJob, jobs, isLoading, error } = useAppSelector((state) => state.scripts)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('')
  const [stylePreferences, setStylePreferences] = useState('')

  // Load jobs on component mount
  useEffect(() => {
    loadJobsFromDB()
  }, [])

  const loadJobsFromDB = async () => {
    try {
      dispatch(setLoading(true))
      const response = await fetch('/api/fine-tuning/jobs')
      const data = await response.json()
      
      if (response.ok) {
        dispatch(loadJobs(data.jobs))
      } else {
        dispatch(setError(data.error || 'Failed to load jobs'))
      }
    } catch (error) {
      dispatch(setError('Failed to load jobs'))
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleCreateJob = async () => {
    if (!name || !theme) return

    try {
      dispatch(setLoading(true))
      
      // Create job in database
      const response = await fetch('/api/fine-tuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, theme })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        dispatch(createNewJob({ name, description, theme }))
        // Reset form
        setName('')
        setDescription('')
        setTheme('')
        setTargetAudience('')
        setTone('')
        setStylePreferences('')
      } else {
        dispatch(setError(data.error || 'Failed to create job'))
      }
    } catch (error) {
      dispatch(setError('Failed to create job'))
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleGenerateSections = async () => {
    if (!currentJob) return

    try {
      dispatch(startGeneratingSections())

      // Generate sections using OpenAI
      const response = await fetch('/api/script/generate-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: currentJob.theme,
          target_audience: targetAudience,
          tone: tone,
          style_preferences: stylePreferences
        })
      })

      const data = await response.json()

      if (response.ok && data.sections) {
        // Save sections to database
        const sectionsResponse = await fetch('/api/fine-tuning/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: currentJob.id,
            sections: data.sections.map((section: any) => ({
              ...section,
              target_audience: targetAudience,
              tone: tone,
              style_preferences: stylePreferences
            }))
          })
        })

        const sectionsData = await sectionsResponse.json()

        if (sectionsResponse.ok) {
          dispatch(setSections(sectionsData.sections.map((section: any) => ({
            ...section,
            texts: []
          }))))
        } else {
          dispatch(setError(sectionsData.error || 'Failed to save sections'))
        }
      } else {
        dispatch(setError(data.error || 'Failed to generate sections'))
      }
    } catch (error) {
      dispatch(setError('Failed to generate sections'))
    }
  }

  const handleUpdateSection = async (sectionId: string, updates: any) => {
    try {
      const response = await fetch('/api/fine-tuning/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          updates
        })
      })

      if (response.ok) {
        dispatch(updateSection({ sectionId, updates }))
      } else {
        const data = await response.json()
        dispatch(setError(data.error || 'Failed to update section'))
      }
    } catch (error) {
      dispatch(setError('Failed to update section'))
    }
  }

  const handleGenerateScript = async (section: FineTuningSection) => {
    try {
      dispatch(startGeneratingScript(section.id))

      const response = await fetch('/api/script/generate-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: section.title,
          writingInstructions: section.writing_instructions,
          theme: currentJob?.theme,
          targetAudience: section.target_audience,
          tone: section.tone,
          stylePreferences: section.style_preferences
        })
      })

      const data = await response.json()

      if (response.ok && data.script) {
        // Save text to database
        const textResponse = await fetch('/api/fine-tuning/texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline_section_id: section.id,
            input_text: `Theme: ${currentJob?.theme}\nTitle: ${section.title}\nInstructions: ${section.writing_instructions}`,
            generated_script: data.script,
            text_order: section.texts?.length || 0
          })
        })

        const textData = await textResponse.json()

        if (textResponse.ok) {
          dispatch(addGeneratedText({
            sectionId: section.id,
            text: {
              input_text: textData.text.input_text,
              generated_script: textData.text.generated_script,
              text_order: textData.text.text_order,
              is_validated: false,
              character_count: textData.text.generated_script.length,
              word_count: textData.text.generated_script.split(' ').length
            }
          }))
        } else {
          dispatch(setError(textData.error || 'Failed to save generated text'))
        }
      } else {
        dispatch(setError(data.error || 'Failed to generate script'))
      }
    } catch (error) {
      dispatch(setError('Failed to generate script'))
    }
  }

  const handleGenerateAllScripts = async () => {
    if (!currentJob?.sections) return

    dispatch(startGeneratingAllScripts())
    
    try {
      await Promise.all(
        currentJob.sections.map(section => handleGenerateScript(section))
      )
    } catch (error) {
      dispatch(setError('Failed to generate some scripts'))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadScript = (script: string, filename: string) => {
    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fine-Tuning Script Generator</h1>
          <p className="text-gray-600">Create training data for your custom script generation model</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Job Selection/Creation */}
        {!currentJob && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Fine-Tuning Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Job Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Marketing Copy Generator"
                  />
                </div>
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g., Product descriptions, Blog posts"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this fine-tuning job will accomplish"
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleCreateJob}
                disabled={!name || !theme || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Job
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Current Job Overview */}
        {currentJob && (
          <Card>
            <CardHeader>
              <CardTitle>{currentJob.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Theme</p>
                  <p>{currentJob.theme}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Sections</p>
                  <p>{currentJob.total_sections}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Training Examples</p>
                  <p>{currentJob.total_training_examples}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Model</p>
                  <p>{currentJob.model_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Generation */}
        {currentJob && !currentJob.sectionsGenerated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Configure Script Sections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g., Young professionals"
                  />
                </div>
                <div>
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="style">Style Preferences</Label>
                  <Input
                    id="style"
                    value={stylePreferences}
                    onChange={(e) => setStylePreferences(e.target.value)}
                    placeholder="e.g., Short sentences, bullet points"
                  />
                </div>
              </div>

              <Button 
                onClick={handleGenerateSections}
                disabled={currentJob.isGeneratingSections || isLoading}
                className="w-full"
              >
                {currentJob.isGeneratingSections ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Sections...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Script Sections
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generated Sections */}
        {currentJob?.sections && currentJob.sections.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Script Sections</h2>
              <Button 
                onClick={handleGenerateAllScripts}
                disabled={isLoading}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate All Scripts
              </Button>
            </div>

            {currentJob.sections.map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Input
                      value={section.title}
                      onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                      className="text-lg font-semibold border-none p-0 focus:ring-0"
                    />
                    <div className="flex gap-2">
                      <span className="text-sm text-gray-500">
                        {section.texts?.length || 0} examples
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleGenerateScript(section)}
                        disabled={section.isGeneratingScript || isLoading}
                      >
                        {section.isGeneratingScript ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Writing Instructions</Label>
                    <Textarea
                      value={section.writing_instructions}
                      onChange={(e) => handleUpdateSection(section.id, { writing_instructions: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Generated Scripts */}
                  {section.texts && section.texts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Generated Scripts:</h4>
                      {section.texts.map((text, index) => (
                        <div key={text.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">Version {index + 1}</span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(text.generated_script)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadScript(text.generated_script, `${section.title}-v${index + 1}`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{text.generated_script}</p>
                          <div className="mt-2 text-xs text-gray-500">
                            {text.character_count} characters • {text.word_count} words
                            {text.quality_score && (
                              <span className="ml-2">• Rating: {text.quality_score}/10</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Job List */}
        {jobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((job: FineTuningJob) => (
                  <div key={job.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-sm text-gray-500">{job.theme}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {job.total_training_examples} examples
                      </p>
                      <p className="text-xs text-gray-500">
                        {job.total_sections} sections
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 