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
import { Download, FileText, Loader2, Eye, AlertCircle, CheckCircle, Database, Settings, Layers, Upload, Cloud, Zap, X } from 'lucide-react'

interface TrainingDataItem {
  messages: Array<{
    role: string
    content: string
  }>
  metadata?: {
    filename?: string
    source?: string
  }
}

interface ProcessedFile {
  filename: string
  status: 'pending' | 'parsing' | 'processing' | 'completed' | 'error'
  content?: string
  trainingData?: {
    systemPrompt: string
    userPrompt: string
    assistantResponse: string
  }
  error?: string
}

export function FineTuningExport() {
  const user = useAppSelector(state => state.user)
  
  // DOCX processing state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [docxTrainingData, setDocxTrainingData] = useState<TrainingDataItem[]>([])
  
  // Auto dataset state
  const [isGeneratingDataset, setIsGeneratingDataset] = useState(false)
  const [autoDataset, setAutoDataset] = useState<TrainingDataItem[]>([])
  const [datasetSummary, setDatasetSummary] = useState<any>(null)
  
  // Fine-tuning state
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini-2024-07-18')
  const [isFineTuningDocx, setIsFineTuningDocx] = useState(false)
  const [isFineTuningAuto, setIsFineTuningAuto] = useState(false)
  const [fineTuningResults, setFineTuningResults] = useState<any>(null)
  
  // Fine-tuned models state
  const [fineTunedModels, setFineTunedModels] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  
  // Message state
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

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

  useEffect(() => {
    loadFineTunedModels()
  }, [user.isLoggedIn])

  // Handle DOCX file selection
  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const docxFiles = files.filter(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    if (docxFiles.length !== files.length) {
      showMessage('Only DOCX files are supported', 'error')
    }
    
    setSelectedFiles(prev => [...prev, ...docxFiles])
    setProcessedFiles(prev => [
      ...prev,
      ...docxFiles.map(file => ({
        filename: file.name,
        status: 'pending' as const
      }))
    ])
  }

  // Remove a file from the list
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setProcessedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Process all DOCX files
  const processAllFiles = async () => {
    if (selectedFiles.length === 0) {
      showMessage('Please select DOCX files first', 'error')
      return
    }

    setIsProcessingFiles(true)
    const trainingDataItems: TrainingDataItem[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      
      // Update status to parsing
      setProcessedFiles(prev => prev.map((pf, idx) => 
        idx === i ? { ...pf, status: 'parsing' } : pf
      ))

      try {
        // Parse DOCX
        const formData = new FormData()
        formData.append('file', file)

        const parseResponse = await fetch('/api/parse-docx', {
          method: 'POST',
          body: formData
        })

        const parseData = await parseResponse.json()

        if (!parseResponse.ok || !parseData.success) {
          throw new Error(parseData.error || 'Failed to parse DOCX')
        }

        // Update status to processing
        setProcessedFiles(prev => prev.map((pf, idx) => 
          idx === i ? { ...pf, status: 'processing', content: parseData.content } : pf
        ))

        // Generate training data
        const structureResponse = await fetch('/api/structure-data-from-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: parseData.content,
            startFineTuning: false
          })
        })

        const structureData = await structureResponse.json()

        if (!structureResponse.ok || !structureData.success) {
          throw new Error(structureData.error || 'Failed to generate training data')
        }

        const trainingDataItem: TrainingDataItem = {
          messages: [
            { role: "system", content: structureData.systemPrompt },
            { role: "user", content: structureData.userPrompt },
            { role: "assistant", content: structureData.assistantResponse }
          ],
          metadata: {
            filename: file.name,
            source: 'docx'
          }
        }

        trainingDataItems.push(trainingDataItem)

        // Update status to completed
        setProcessedFiles(prev => prev.map((pf, idx) => 
          idx === i ? { 
            ...pf, 
            status: 'completed',
            trainingData: {
              systemPrompt: structureData.systemPrompt,
              userPrompt: structureData.userPrompt,
              assistantResponse: structureData.assistantResponse
            }
          } : pf
        ))

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        setProcessedFiles(prev => prev.map((pf, idx) => 
          idx === i ? { 
            ...pf, 
            status: 'error',
            error: (error as Error).message
          } : pf
        ))
      }
    }

    setDocxTrainingData(trainingDataItems)
    setIsProcessingFiles(false)
    
    if (trainingDataItems.length > 0) {
      showMessage(`Successfully processed ${trainingDataItems.length} files into training data`, 'success')
    }
  }

  // Generate automatic dataset from existing jobs
  const generateAutoDataset = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate dataset', 'error')
      return
    }

    setIsGeneratingDataset(true)
    try {
      const response = await fetch('/api/fine-tuning/export-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minSections: 3
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAutoDataset(data.trainingData)
        setDatasetSummary(data.summary)
        showMessage(`Generated dataset with ${data.trainingData.length} training examples`, 'success')
      } else {
        showMessage(data.error || 'Failed to generate dataset', 'error')
      }
    } catch (error) {
      showMessage('Failed to generate dataset', 'error')
    } finally {
      setIsGeneratingDataset(false)
    }
  }

  // Start fine-tuning with DOCX data
  const startDocxFineTuning = async () => {
    if (docxTrainingData.length === 0) {
      showMessage('Please process DOCX files first', 'error')
      return
    }

    setIsFineTuningDocx(true)
    try {
      const response = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: docxTrainingData,
          filename: 'docx_training_data.jsonl',
          type: 'docx'
        })
      })

      const uploadData = await response.json()

      if (!response.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload training data')
      }

      // Start fine-tuning job
      const jobResponse = await fetch('/api/fine-tuning/start-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.file.id,
          model: selectedModel,
          uploadId: uploadData.upload?.id
        })
      })

      const jobData = await jobResponse.json()

      if (jobResponse.ok && jobData.success) {
        setFineTuningResults(jobData)
        showMessage(`Fine-tuning job started successfully! Job ID: ${jobData.openaiJob.id}`, 'success')
      } else {
        throw new Error(jobData.error || 'Failed to start fine-tuning job')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning: ' + (error as Error).message, 'error')
    } finally {
      setIsFineTuningDocx(false)
    }
  }

  // Start fine-tuning with auto dataset
  const startAutoFineTuning = async () => {
    if (autoDataset.length === 0) {
      showMessage('Please generate dataset first', 'error')
      return
    }

    setIsFineTuningAuto(true)
    try {
      const response = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: autoDataset,
          filename: 'auto_dataset_training.jsonl',
          type: 'sections'
        })
      })

      const uploadData = await response.json()

      if (!response.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload training data')
      }

      // Start fine-tuning job
      const jobResponse = await fetch('/api/fine-tuning/start-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.file.id,
          model: selectedModel,
          uploadId: uploadData.upload?.id
        })
      })

      const jobData = await jobResponse.json()

      if (jobResponse.ok && jobData.success) {
        setFineTuningResults(jobData)
        showMessage(`Fine-tuning job started successfully! Job ID: ${jobData.openaiJob.id}`, 'success')
      } else {
        throw new Error(jobData.error || 'Failed to start fine-tuning job')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning: ' + (error as Error).message, 'error')
    } finally {
      setIsFineTuningAuto(false)
    }
  }

  // Download JSONL data
  const downloadJsonl = (data: TrainingDataItem[], filename: string) => {
    const jsonlContent = data.map(item => JSON.stringify(item)).join('\n')
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!user.isLoggedIn) {
    return (
      <div className="flex-1 p-6">
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-500 mb-4">
              Please log in to create fine-tuning datasets.
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
        <h1 className="text-2xl font-bold text-gray-900">Fine-Tuning Dataset Creation</h1>
        <p className="text-gray-600 mt-1">Create training datasets from DOCX files or existing jobs</p>
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="docx" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="docx" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            DOCX Upload
          </TabsTrigger>
          <TabsTrigger value="auto" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Auto Dataset
          </TabsTrigger>
        </TabsList>

        {/* DOCX Upload Tab */}
        <TabsContent value="docx" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                DOCX Document Processing
              </CardTitle>
              <CardDescription>
                Upload multiple DOCX documents to generate training data for fine-tuning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="docx-upload">Upload DOCX Files</Label>
                <Input
                  id="docx-upload"
                  type="file"
                  accept=".docx"
                  multiple
                  onChange={handleFileSelection}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Select multiple DOCX files to process into training data
                </p>
              </div>

              {/* File List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files</Label>
                  <div className="space-y-2">
                    {processedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{file.filename}</span>
                          <Badge variant={
                            file.status === 'completed' ? 'default' :
                            file.status === 'error' ? 'destructive' :
                            file.status === 'processing' || file.status === 'parsing' ? 'secondary' :
                            'outline'
                          }>
                            {file.status === 'parsing' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {file.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {file.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isProcessingFiles}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={processAllFiles}
                  disabled={isProcessingFiles || selectedFiles.length === 0}
                  className="flex items-center gap-2"
                >
                  {isProcessingFiles ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing Files...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Process All Files
                    </>
                  )}
                </Button>

                {docxTrainingData.length > 0 && (
                  <Button
                    onClick={() => downloadJsonl(docxTrainingData, 'docx_training_data.jsonl')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download JSONL
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DOCX Training Data Display */}
          {docxTrainingData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Training Data</CardTitle>
                <CardDescription>
                  {docxTrainingData.length} training examples generated from DOCX files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {docxTrainingData.slice(0, 3).map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.metadata?.filename}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong className="text-blue-600">System:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[0].content.substring(0, 200)}...
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-green-600">User:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[1].content.substring(0, 200)}...
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-purple-600">Assistant:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[2].content.substring(0, 200)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {docxTrainingData.length > 3 && (
                  <div className="text-center text-sm text-gray-600">
                    ... and {docxTrainingData.length - 3} more training examples
                  </div>
                )}

                {/* Model Selection and Fine-Tuning */}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select-docx">Select Model for Fine-Tuning</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
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
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading your fine-tuned models...
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={startDocxFineTuning}
                    disabled={isFineTuningDocx}
                    className="w-full"
                    size="lg"
                  >
                    {isFineTuningDocx ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting Fine-Tuning...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start Fine-Tuning with {selectedModel}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Auto Dataset Tab */}
        <TabsContent value="auto" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Automatic Dataset Generation
              </CardTitle>
              <CardDescription>
                Generate training data from your existing jobs and sections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={generateAutoDataset}
                  disabled={isGeneratingDataset}
                  className="flex items-center gap-2"
                >
                  {isGeneratingDataset ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Dataset...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Generate Dataset
                    </>
                  )}
                </Button>

                {autoDataset.length > 0 && (
                  <Button
                    onClick={() => downloadJsonl(autoDataset, 'auto_dataset.jsonl')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download JSONL
                  </Button>
                )}
              </div>

              {/* Dataset Summary */}
              {datasetSummary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{datasetSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{datasetSummary.filteredJobs}</div>
                    <div className="text-sm text-gray-600">Training Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{datasetSummary.totalSections}</div>
                    <div className="text-sm text-gray-600">Total Sections</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto Dataset Display */}
          {autoDataset.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Auto Dataset</CardTitle>
                <CardDescription>
                  {autoDataset.length} training examples generated from existing jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {autoDataset.slice(0, 3).map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-green-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          Auto Generated
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong className="text-blue-600">System:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[0].content.substring(0, 200)}...
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-green-600">User:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[1].content.substring(0, 200)}...
                          </div>
                        </div>
                        
                        <div>
                          <strong className="text-purple-600">Assistant:</strong>
                          <div className="bg-white p-2 rounded border mt-1 max-h-20 overflow-y-auto">
                            {item.messages[2].content.substring(0, 200)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {autoDataset.length > 3 && (
                  <div className="text-center text-sm text-gray-600">
                    ... and {autoDataset.length - 3} more training examples
                  </div>
                )}

                {/* Model Selection and Fine-Tuning */}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select-auto">Select Model for Fine-Tuning</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
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
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading your fine-tuned models...
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={startAutoFineTuning}
                    disabled={isFineTuningAuto}
                    className="w-full"
                    size="lg"
                  >
                    {isFineTuningAuto ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting Fine-Tuning...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start Fine-Tuning with {selectedModel}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Fine-Tuning Results */}
      {fineTuningResults && (
        <Card>
          <CardHeader>
            <CardTitle>Fine-Tuning Job Started</CardTitle>
            <CardDescription>Your fine-tuning job has been successfully initiated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">✓</div>
                <div className="text-sm text-gray-600">Data Uploaded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">✓</div>
                <div className="text-sm text-gray-600">Job Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">⏳</div>
                <div className="text-sm text-gray-600">Training Started</div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Fine-tuning job started successfully!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Your training data has been uploaded and fine-tuning is now in progress.
              </p>
              {fineTuningResults.openaiJob?.id && (
                <p className="text-xs text-green-600 mt-2 font-mono">
                  Job ID: {fineTuningResults.openaiJob.id}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 