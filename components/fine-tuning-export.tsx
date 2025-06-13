'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, FileText, Loader2, Eye, AlertCircle, CheckCircle, Database, Settings, Layers, Upload, Cloud } from 'lucide-react'

interface ExportSummary {
  totalJobs: number
  totalSections: number
  totalTexts: number
}

interface SectionExportSummary {
  totalJobs: number
  filteredJobs: number
  totalSections: number
  filters: {
    minSections: number
  }
}

interface TrainingExample {
  messages: Array<{
    role: string
    content: string
  }>
  metadata: {
    job_id: string
    job_name: string
    section_id: string
    section_title: string
    text_id: string
    quality_score: number
    is_validated: boolean
    character_count: number
    word_count: number
  }
}

interface SectionTrainingExample {
  messages: Array<{
    role: string
    content: string
  }>
  metadata: {
    job_id: string
    job_name: string
    job_theme: string
    sections_count: number
    created_at: string
  }
}

export function FineTuningExport() {
  const user = useAppSelector(state => state.user)
  
  // Section generation form state
  const [minSections, setMinSections] = useState(3)
  
  // Model selection for fine-tuning
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-nano-2025-04-14')
  const [isStartingJob, setIsStartingJob] = useState(false)
  const [lastUploadResult, setLastUploadResult] = useState<any>(null)
  
  // UI state for script generation
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null)
  const [previewData, setPreviewData] = useState<TrainingExample[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // UI state for section generation
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const [isSectionPreviewLoading, setIsSectionPreviewLoading] = useState(false)
  const [isSectionUploading, setIsSectionUploading] = useState(false)
  const [sectionExportSummary, setSectionExportSummary] = useState<SectionExportSummary | null>(null)
  const [sectionPreviewData, setSectionPreviewData] = useState<SectionTrainingExample[]>([])
  const [showSectionPreview, setShowSectionPreview] = useState(false)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Preview the script generation export data
  const handlePreview = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to preview export data', 'error')
      return
    }

    setIsPreviewLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setExportSummary(data.summary)
        setPreviewData(data.trainingData.slice(0, 5)) // Show first 5 examples
        setShowPreview(true)
        showMessage(`Preview loaded: ${data.totalTexts} script training examples ready`, 'success')
      } else {
        showMessage(data.error || 'Failed to preview export data', 'error')
      }
    } catch (error) {
      showMessage('Failed to preview export data', 'error')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Preview the section generation export data
  const handleSectionPreview = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to preview section export data', 'error')
      return
    }

    setIsSectionPreviewLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minSections
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSectionExportSummary(data.summary)
        setSectionPreviewData(data.trainingData.slice(0, 3)) // Show first 3 examples
        setShowSectionPreview(true)
        showMessage(`Preview loaded: ${data.filteredJobs} section training examples ready`, 'success')
      } else {
        showMessage(data.error || 'Failed to preview section export data', 'error')
      }
    } catch (error) {
      showMessage('Failed to preview section export data', 'error')
    } finally {
      setIsSectionPreviewLoading(false)
    }
  }

  // Download the script generation JSONL file
  const handleDownload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to download export data', 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export', {
        method: 'GET'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'script_generation_training.jsonl'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showMessage('Script generation training data downloaded successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to download export data', 'error')
      }
    } catch (error) {
      showMessage('Failed to download export data', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Download the section generation JSONL file
  const handleSectionDownload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to download section export data', 'error')
      return
    }

    setIsSectionLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections', {
        method: 'GET'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'section_generation_training.jsonl'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showMessage('Section generation training data downloaded successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to download section export data', 'error')
      }
    } catch (error) {
      showMessage('Failed to download section export data', 'error')
    } finally {
      setIsSectionLoading(false)
    }
  }

  // Upload the script generation training data to OpenAI
  const handleUpload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to upload training data', 'error')
      return
    }

    if (!previewData || previewData.length === 0) {
      showMessage('Please preview the data first to ensure it loads correctly', 'error')
      return
    }

    setIsUploading(true)
    try {
      // First get the full training data
      const response = await fetch('/api/fine-tuning/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        showMessage(data.error || 'Failed to get training data', 'error')
        return
      }

      // Upload to OpenAI
      const uploadResponse = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: data.trainingData,
          filename: 'script_generation_training.jsonl',
          type: 'scripts'
        })
      })

      const uploadData = await uploadResponse.json()

      if (uploadResponse.ok && uploadData.success) {
        const mockMessage = uploadData.file?.id?.startsWith('file-mock-') ? ' (Mock upload - Set OPENAI_API_KEY for real upload)' : ''
        showMessage(`Successfully uploaded ${uploadData.trainingExamplesCount} script training examples to OpenAI!${mockMessage}`, 'success')
        setLastUploadResult({ ...uploadData, type: 'scripts' })
      } else {
        showMessage(uploadData.error || 'Failed to upload training data', 'error')
      }
    } catch (error) {
      showMessage('Failed to upload training data', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // Upload the section generation training data to OpenAI
  const handleSectionUpload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to upload section training data', 'error')
      return
    }

    if (!sectionPreviewData || sectionPreviewData.length === 0) {
      showMessage('Please preview the section data first to ensure it loads correctly', 'error')
      return
    }

    setIsSectionUploading(true)
    try {
      // First get the full section training data
      const response = await fetch('/api/fine-tuning/export-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minSections
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        showMessage(data.error || 'Failed to get section training data', 'error')
        return
      }

      // Upload to OpenAI
      const uploadResponse = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: data.trainingData,
          filename: 'section_generation_training.jsonl',
          type: 'sections'
        })
      })

      const uploadData = await uploadResponse.json()

      if (uploadResponse.ok && uploadData.success) {
        const mockMessage = uploadData.file?.id?.startsWith('file-mock-') ? ' (Mock upload - Set OPENAI_API_KEY for real upload)' : ''
        showMessage(`Successfully uploaded ${uploadData.trainingExamplesCount} section training examples to OpenAI!${mockMessage}`, 'success')
        setLastUploadResult({ ...uploadData, type: 'sections' })
      } else {
        showMessage(uploadData.error || 'Failed to upload section training data', 'error')
      }
    } catch (error) {
      showMessage('Failed to upload section training data', 'error')
    } finally {
      setIsSectionUploading(false)
    }
  }

  // Start a fine-tuning job with the uploaded file
  const handleStartFineTuning = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to start fine-tuning', 'error')
      return
    }

    if (!lastUploadResult || !lastUploadResult.file?.id) {
      showMessage('Please upload training data first', 'error')
      return
    }

    setIsStartingJob(true)
    try {
      const response = await fetch('/api/fine-tuning/start-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: lastUploadResult.file.id,
          model: selectedModel,
          uploadId: lastUploadResult.upload?.id
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const mockMessage = data.openaiJob?.id?.startsWith('ftjob-mock-') ? ' (Mock job - Set OPENAI_API_KEY for real fine-tuning)' : ''
        showMessage(`Successfully started fine-tuning job ${data.openaiJob.id}!${mockMessage}`, 'success')
        setLastUploadResult(null) // Clear after starting job
      } else {
        showMessage(data.error || 'Failed to start fine-tuning job', 'error')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning job', 'error')
    } finally {
      setIsStartingJob(false)
    }
  }

  if (!user.isLoggedIn) {
    return (
      <div className="flex-1 p-6">
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-500 mb-4">
              Please log in to export fine-tuning data.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fine-Tuning Data Export</h1>
        <p className="text-gray-600 mt-1">Export training data in JSONL format for OpenAI fine-tuning</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
            {messageType === 'error' && <AlertCircle className="h-4 w-4" />}
            {messageType === 'info' && <FileText className="h-4 w-4" />}
            {message}
          </div>
        </div>
      )}

      {/* Export Types */}
      <Tabs defaultValue="sections" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sections" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Section Generation
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Script Generation
          </TabsTrigger>
        </TabsList>

        {/* Section Generation Export */}
        <TabsContent value="sections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Section Generation Training Data
              </CardTitle>
              <CardDescription>
                Export data to train a model that generates script sections from themes and parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minSections">Minimum Sections per Job</Label>
                <Input
                  id="minSections"
                  type="number"
                  min="1"
                  max="20"
                  value={minSections}
                  onChange={(e) => setMinSections(parseInt(e.target.value) || 1)}
                  placeholder="3"
                />
                <p className="text-xs text-muted-foreground">
                  Only include jobs with at least this many sections
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSectionPreview}
                  disabled={isSectionPreviewLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isSectionPreviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Preview Section Export
                </Button>
                
                <Button
                  onClick={handleSectionDownload}
                  disabled={isSectionLoading}
                  className="flex items-center gap-2"
                >
                  {isSectionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Section JSONL
                </Button>

                <Button
                  onClick={handleSectionUpload}
                  disabled={isSectionUploading || !sectionPreviewData.length}
                  className="flex items-center gap-2"
                >
                  {isSectionUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload to OpenAI
                </Button>
              </div>

              {/* Model Selection and Fine-Tuning Job Start */}
              {lastUploadResult && lastUploadResult.type === 'sections' && (
                <div className="mt-4 p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-medium text-blue-900 mb-3">Start Fine-Tuning Job</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="model-select">Select Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        File: {lastUploadResult.file.filename}
                      </Badge>
                      <Badge variant="outline">
                        {lastUploadResult.trainingExamplesCount} examples
                      </Badge>
                    </div>

                    <Button
                      onClick={handleStartFineTuning}
                      disabled={isStartingJob}
                      className="w-full"
                    >
                      {isStartingJob ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Starting Fine-Tuning Job...
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4 mr-2" />
                          Start Fine-Tuning with {selectedModel}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Export Summary */}
          {sectionExportSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Section Export Summary</CardTitle>
                <CardDescription>Overview of your section generation training data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sectionExportSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sectionExportSummary.filteredJobs}</div>
                    <div className="text-sm text-gray-600">Training Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{sectionExportSummary.totalSections}</div>
                    <div className="text-sm text-gray-600">Total Sections</div>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline">
                    Min Sections: {sectionExportSummary.filters.minSections}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Preview Data */}
          {showSectionPreview && sectionPreviewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Section Training Data Preview</CardTitle>
                <CardDescription>First 3 section generation examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sectionPreviewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.job_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.sections_count} sections
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong className="text-blue-600">System:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {example.messages[0].content}
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-green-600">User:</strong>
                          <div className="bg-white p-2 rounded border mt-1">
                            {example.messages[1].content}
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-purple-600">Assistant (JSON):</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-40 overflow-y-auto">
                            <pre className="text-xs">{example.messages[2].content}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {sectionExportSummary && sectionExportSummary.filteredJobs > 3 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {sectionExportSummary.filteredJobs - 3} more section training examples
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Script Generation Export */}
        <TabsContent value="scripts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Script Generation Training Data
              </CardTitle>
              <CardDescription>
                Export data to train a model that generates full scripts from section instructions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isPreviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Preview Script Export
                </Button>
                
                <Button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Script JSONL
                </Button>

                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !previewData.length}
                  className="flex items-center gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload to OpenAI
                </Button>
              </div>

              {/* Model Selection and Fine-Tuning Job Start */}
              {lastUploadResult && lastUploadResult.type === 'scripts' && (
                <div className="mt-4 p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-medium text-blue-900 mb-3">Start Fine-Tuning Job</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="model-select-scripts">Select Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                          <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        File: {lastUploadResult.file.filename}
                      </Badge>
                      <Badge variant="outline">
                        {lastUploadResult.trainingExamplesCount} examples
                      </Badge>
                    </div>

                    <Button
                      onClick={handleStartFineTuning}
                      disabled={isStartingJob}
                      className="w-full"
                    >
                      {isStartingJob ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Starting Fine-Tuning Job...
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4 mr-2" />
                          Start Fine-Tuning with {selectedModel}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Script Export Summary */}
          {exportSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Script Export Summary</CardTitle>
                <CardDescription>Overview of your script generation training data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{exportSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{exportSummary.totalSections}</div>
                    <div className="text-sm text-gray-600">Sections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{exportSummary.totalTexts}</div>
                    <div className="text-sm text-gray-600">Total Texts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{exportSummary.totalTexts}</div>
                    <div className="text-sm text-gray-600">Training Examples</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Script Preview Data */}
          {showPreview && previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Script Training Data Preview</CardTitle>
                <CardDescription>First 5 script generation examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {previewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.job_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Score: {example.metadata.quality_score}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong className="text-blue-600">System:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {example.messages[0].content}
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-green-600">User:</strong>
                          <div className="bg-white p-2 rounded border mt-1">
                            {example.messages[1].content}
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-purple-600">Assistant:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-32 overflow-y-auto">
                            {example.messages[2].content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {exportSummary && exportSummary.totalTexts > 5 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {exportSummary.totalTexts - 5} more script training examples
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 