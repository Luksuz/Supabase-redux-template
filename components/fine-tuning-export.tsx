'use client'

import { useState, useEffect } from 'react'
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
  trainingTexts: number
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
  
  // Fine-tuned models state
  const [fineTunedModels, setFineTunedModels] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  
  // UI state for script generation
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null)
  const [previewData, setPreviewData] = useState<TrainingExample[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // UI state for validation export
  const [isValidationLoading, setIsValidationLoading] = useState(false)
  const [isValidationPreviewLoading, setIsValidationPreviewLoading] = useState(false)
  const [validationExportSummary, setValidationExportSummary] = useState<any>(null)
  const [validationPreviewData, setValidationPreviewData] = useState<TrainingExample[]>([])
  const [showValidationPreview, setShowValidationPreview] = useState(false)

  // UI state for section generation
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const [isSectionPreviewLoading, setIsSectionPreviewLoading] = useState(false)
  const [isSectionUploading, setIsSectionUploading] = useState(false)
  const [sectionExportSummary, setSectionExportSummary] = useState<SectionExportSummary | null>(null)
  const [sectionPreviewData, setSectionPreviewData] = useState<SectionTrainingExample[]>([])
  const [showSectionPreview, setShowSectionPreview] = useState(false)

  // UI state for section training/validation splits
  const [isSectionTrainingLoading, setIsSectionTrainingLoading] = useState(false)
  const [isSectionValidationLoading, setIsSectionValidationLoading] = useState(false)
  const [isSectionTrainingPreviewLoading, setIsSectionTrainingPreviewLoading] = useState(false)
  const [isSectionValidationPreviewLoading, setIsSectionValidationPreviewLoading] = useState(false)
  const [sectionTrainingExportSummary, setSectionTrainingExportSummary] = useState<any>(null)
  const [sectionValidationExportSummary, setSectionValidationExportSummary] = useState<any>(null)
  const [sectionTrainingPreviewData, setSectionTrainingPreviewData] = useState<SectionTrainingExample[]>([])
  const [sectionValidationPreviewData, setSectionValidationPreviewData] = useState<SectionTrainingExample[]>([])
  const [showSectionTrainingPreview, setShowSectionTrainingPreview] = useState(false)
  const [showSectionValidationPreview, setShowSectionValidationPreview] = useState(false)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Load fine-tuned models on component mount
  const loadFineTunedModels = async () => {
    if (!user.isLoggedIn) return

    setLoadingModels(true)
    try {
      const response = await fetch('/api/fine-tuning/models')
      const data = await response.json()

      if (response.ok && data.success) {
        setFineTunedModels(data.models)
      } else {
        console.error('Failed to load fine-tuned models:', data.error)
      }
    } catch (error) {
      console.error('Failed to load fine-tuned models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  // Load models when user logs in
  useEffect(() => {
    loadFineTunedModels()
  }, [user.isLoggedIn])

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
        showMessage(`Preview loaded: ${data.trainingData.length} training examples ready (80% split)`, 'success')
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

  // Preview the validation export data
  const handleValidationPreview = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to preview validation data', 'error')
      return
    }

    setIsValidationPreviewLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setValidationExportSummary(data.summary)
        setValidationPreviewData(data.trainingData.slice(0, 5)) // Show first 5 examples
        setShowValidationPreview(true)
        showMessage(`Preview loaded: ${data.trainingData.length} validation examples ready (20% split)`, 'success')
      } else {
        showMessage(data.error || 'Failed to preview validation data', 'error')
      }
    } catch (error) {
      showMessage('Failed to preview validation data', 'error')
    } finally {
      setIsValidationPreviewLoading(false)
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
        
        showMessage('Training data downloaded successfully! (80% split)', 'success')
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

  // Download the validation JSONL file
  const handleValidationDownload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to download validation data', 'error')
      return
    }

    setIsValidationLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-validation', {
        method: 'GET'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'script_generation_validation.jsonl'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showMessage('Validation data downloaded successfully! (20% split)', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to download validation data', 'error')
      }
    } catch (error) {
      showMessage('Failed to download validation data', 'error')
    } finally {
      setIsValidationLoading(false)
    }
  }

  // Preview the section training data (80% split)
  const handleSectionTrainingPreview = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to preview section training data', 'error')
      return
    }

    setIsSectionTrainingPreviewLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minSections
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSectionTrainingExportSummary(data.summary)
        setSectionTrainingPreviewData(data.trainingData.slice(0, 3)) // Show first 3 examples
        setShowSectionTrainingPreview(true)
        showMessage(`Preview loaded: ${data.summary.trainingExamples} section training examples ready (80% split)`, 'success')
      } else {
        showMessage(data.error || 'Failed to preview section training data', 'error')
      }
    } catch (error) {
      showMessage('Failed to preview section training data', 'error')
    } finally {
      setIsSectionTrainingPreviewLoading(false)
    }
  }

  // Preview the section validation data (20% split)
  const handleSectionValidationPreview = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to preview section validation data', 'error')
      return
    }

    setIsSectionValidationPreviewLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minSections
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSectionValidationExportSummary(data.summary)
        setSectionValidationPreviewData(data.validationData.slice(0, 3)) // Show first 3 examples
        setShowSectionValidationPreview(true)
        showMessage(`Preview loaded: ${data.summary.validationExamples} section validation examples ready (20% split)`, 'success')
      } else {
        showMessage(data.error || 'Failed to preview section validation data', 'error')
      }
    } catch (error) {
      showMessage('Failed to preview section validation data', 'error')
    } finally {
      setIsSectionValidationPreviewLoading(false)
    }
  }

  // Download the section training JSONL file (80% split)
  const handleSectionTrainingDownload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to download section training data', 'error')
      return
    }

    setIsSectionTrainingLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections-training', {
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
        
        showMessage('Section training data (80%) downloaded successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to download section training data', 'error')
      }
    } catch (error) {
      showMessage('Failed to download section training data', 'error')
    } finally {
      setIsSectionTrainingLoading(false)
    }
  }

  // Download the section validation JSONL file (20% split)
  const handleSectionValidationDownload = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to download section validation data', 'error')
      return
    }

    setIsSectionValidationLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections-validation', {
        method: 'GET'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'section_generation_validation.jsonl'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showMessage('Section validation data (20%) downloaded successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to download section validation data', 'error')
      }
    } catch (error) {
      showMessage('Failed to download section validation data', 'error')
    } finally {
      setIsSectionValidationLoading(false)
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

              {/* Training/Validation Split Section */}
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Training/Validation Split (80/20)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Export your section data split into training (80%) and validation (20%) sets for better model evaluation.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Training Data (80%) */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-blue-900">Training Data (80%)</h5>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleSectionTrainingPreview}
                        disabled={isSectionTrainingPreviewLoading}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {isSectionTrainingPreviewLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        Preview Training
                      </Button>
                      
                      <Button
                        onClick={handleSectionTrainingDownload}
                        disabled={isSectionTrainingLoading}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {isSectionTrainingLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Download Training
                      </Button>
                    </div>
                  </div>

                  {/* Validation Data (20%) */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-green-900">Validation Data (20%)</h5>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleSectionValidationPreview}
                        disabled={isSectionValidationPreviewLoading}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {isSectionValidationPreviewLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        Preview Validation
                      </Button>
                      
                      <Button
                        onClick={handleSectionValidationDownload}
                        disabled={isSectionValidationLoading}
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        {isSectionValidationLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Download Validation
                      </Button>
                    </div>
                  </div>
                </div>
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
                          {fineTunedModels.length > 0 && (
                            <>
                              <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                                --- Your Fine-Tuned Models ---
                              </SelectItem>
                              {fineTunedModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name.split(':').pop()} (based on {model.baseModel})
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {loadingModels && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading your fine-tuned models...
                        </p>
                      )}
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

          {/* Section Training Export Summary */}
          {sectionTrainingExportSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Section Training Export Summary (80% Split)</CardTitle>
                <CardDescription>Overview of your section generation training data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sectionTrainingExportSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sectionTrainingExportSummary.filteredJobs}</div>
                    <div className="text-sm text-gray-600">Filtered Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{sectionTrainingExportSummary.totalExamples}</div>
                    <div className="text-sm text-gray-600">Total Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sectionTrainingExportSummary.trainingExamples}</div>
                    <div className="text-sm text-gray-600">Training (80%)</div>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline">
                    Min Sections: {sectionTrainingExportSummary.filters.minSections}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    Training Split: 80%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Validation Export Summary */}
          {sectionValidationExportSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Section Validation Export Summary (20% Split)</CardTitle>
                <CardDescription>Overview of your section generation validation data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sectionValidationExportSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sectionValidationExportSummary.filteredJobs}</div>
                    <div className="text-sm text-gray-600">Filtered Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{sectionValidationExportSummary.totalExamples}</div>
                    <div className="text-sm text-gray-600">Total Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sectionValidationExportSummary.validationExamples}</div>
                    <div className="text-sm text-gray-600">Validation (20%)</div>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline">
                    Min Sections: {sectionValidationExportSummary.filters.minSections}
                  </Badge>
                  <Badge variant="outline" className="bg-green-50">
                    Validation Split: 20%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Original Section Export Summary */}
          {sectionExportSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Section Export Summary (All Data)</CardTitle>
                <CardDescription>Overview of your complete section generation training data</CardDescription>
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
                  <Badge variant="outline" className="bg-gray-50">
                    Complete Dataset
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Training Preview Data */}
          {showSectionTrainingPreview && sectionTrainingPreviewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Section Training Data Preview (80% Split)</CardTitle>
                <CardDescription>First 3 section generation training examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sectionTrainingPreviewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Training Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.job_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.sections_count} sections
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-100">
                          80% Split
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
                
                {sectionTrainingExportSummary && sectionTrainingExportSummary.trainingExamples > 3 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {sectionTrainingExportSummary.trainingExamples - 3} more training examples
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section Validation Preview Data */}
          {showSectionValidationPreview && sectionValidationPreviewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Section Validation Data Preview (20% Split)</CardTitle>
                <CardDescription>First 3 section generation validation examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sectionValidationPreviewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-green-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Validation Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.job_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {example.metadata.sections_count} sections
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-green-100">
                          20% Split
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
                
                {sectionValidationExportSummary && sectionValidationExportSummary.validationExamples > 3 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {sectionValidationExportSummary.validationExamples - 3} more validation examples
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Original Section Preview Data */}
          {showSectionPreview && sectionPreviewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Section Training Data Preview (All Data)</CardTitle>
                <CardDescription>First 3 section generation examples from complete dataset</CardDescription>
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
                        <Badge variant="outline" className="text-xs bg-gray-100">
                          Complete Dataset
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
                Script Generation Training Data (80/20 Split)
              </CardTitle>
              <CardDescription>
                Export data with proper train/validation splits for machine learning best practices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Training Data Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-600">Training (80%)</Badge>
                  <span className="text-sm text-gray-600">For fine-tuning the model</span>
                </div>
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
                    Preview Training
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
                    Download Training JSONL
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
              </div>

              {/* Validation Data Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">Validation (20%)</Badge>
                  <span className="text-sm text-gray-600">For model evaluation during training</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleValidationPreview}
                    disabled={isValidationPreviewLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isValidationPreviewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Preview Validation
                  </Button>
                  
                  <Button
                    onClick={handleValidationDownload}
                    disabled={isValidationLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isValidationLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download Validation JSONL
                  </Button>
                </div>
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
                          {fineTunedModels.length > 0 && (
                            <>
                              <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                                --- Your Fine-Tuned Models ---
                              </SelectItem>
                              {fineTunedModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name.split(':').pop()} (based on {model.baseModel})
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {loadingModels && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading your fine-tuned models...
                        </p>
                      )}
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
                <CardDescription>Overview of your script generation training data splits</CardDescription>
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
                    <div className="text-sm text-gray-600">Total Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{exportSummary.trainingTexts}</div>
                    <div className="text-sm text-gray-600">Training (80%)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Script Preview Data */}
          {showPreview && previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Training Data Preview</CardTitle>
                <CardDescription>First 5 training examples (80% split)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {previewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Training Example {index + 1}</Badge>
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
                
                {exportSummary && exportSummary.trainingTexts > 5 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {exportSummary.trainingTexts - 5} more training examples
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation Preview Data */}
          {showValidationPreview && validationPreviewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Validation Data Preview</CardTitle>
                <CardDescription>First 5 validation examples (20% split)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {validationPreviewData.map((example, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-orange-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Validation Example {index + 1}</Badge>
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
                
                {validationExportSummary && validationExportSummary.validationTexts > 5 && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    ... and {validationExportSummary.validationTexts - 5} more validation examples
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