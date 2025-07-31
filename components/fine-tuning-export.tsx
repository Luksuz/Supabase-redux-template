'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import {
  // Import Redux actions
  addSelectedFilesMetadata,
  removeFile,
  updateProcessedFileStatus,
  setIsProcessingFiles,
  setDocxTrainingData,
  addDocxTrainingDataItem,
  clearDocxData,
  setIsGeneratingDataset,
  setAutoDataset,
  setDatasetSummary,
  clearAutoDataset,
  setSelectedModel,
  setIsFineTuningDocx,
  setIsFineTuningAuto,
  setFineTuningResults,
  setFineTunedModels,
  setLoadingModels,
  setMessage,
  clearMessage,
  resetDocxTab,
  resetAutoTab,
  // Import types and selectors
  type TrainingDataItem,
  type FileMetadata,
  selectFineTuningExport,
  selectDocxProcessing,
  selectAutoDataset,
  selectFineTuningState
} from '../lib/features/fineTuningExport/fineTuningExportSlice'
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

export function FineTuningExport() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  
  // Get Redux state
  const fineTuningExport = useAppSelector(selectFineTuningExport)
  const docxProcessing = useAppSelector(selectDocxProcessing)
  const autoDataset = useAppSelector(selectAutoDataset)
  const fineTuningState = useAppSelector(selectFineTuningState)
  
  // Local state for File objects (can't be serialized in Redux)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Handle message auto-clearing
  useEffect(() => {
    if (fineTuningExport.message) {
      const timer = setTimeout(() => dispatch(clearMessage()), 5000)
      return () => clearTimeout(timer)
    }
  }, [fineTuningExport.message, dispatch])

  // Handle state mismatch after navigation (when processing state exists but no local files)
  useEffect(() => {
    // If Redux shows we're processing files or have processed files, but no local files exist
    const hasReduxFileState = docxProcessing.processedFiles.length > 0
    const hasLocalFiles = selectedFiles.length > 0
    const isProcessing = docxProcessing.isProcessingFiles
    
    if (hasReduxFileState && !hasLocalFiles && !isProcessing) {
      // Files exist in Redux but not locally - show info message for reselection if needed
      showMessage('Your files are ready. Select the same files again if you want to reprocess any of them.', 'info')
    }
  }, [docxProcessing.processedFiles.length, selectedFiles.length, docxProcessing.isProcessingFiles, dispatch])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    dispatch(setMessage({ message: msg, type }))
  }

  // Load fine-tuned models on component mount
  const loadFineTunedModels = async () => {
    if (!user.isLoggedIn) return

    dispatch(setLoadingModels(true))
    try {
      const response = await fetch('/api/fine-tuning/models')
      const data = await response.json()

      if (response.ok && data.success) {
        dispatch(setFineTunedModels(data.models))
      } else {
        console.error('Failed to load fine-tuned models:', data.error)
      }
    } catch (error) {
      console.error('Failed to load fine-tuned models:', error)
    } finally {
      dispatch(setLoadingModels(false))
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
    
    // If Redux already has files, try to match them with selected files
    const existingFiles = docxProcessing.processedFiles
    if (existingFiles.length > 0) {
      // Match files by name and size
      const matchedFiles: File[] = []
      const newFiles: File[] = []
      
      docxFiles.forEach(file => {
        const existingFile = existingFiles.find(ef => 
          ef.filename === file.name && 
          docxProcessing.selectedFilesMetadata.find(meta => 
            meta.name === file.name && meta.size === file.size
          )
        )
        
        if (existingFile) {
          matchedFiles.push(file)
        } else {
          newFiles.push(file)
        }
      })
      
      // Update local state with all files (matched + new)
      setSelectedFiles(prev => [...prev, ...docxFiles])
      
      // Only add metadata for truly new files
      if (newFiles.length > 0) {
        const newFilesMetadata: FileMetadata[] = newFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }))
        dispatch(addSelectedFilesMetadata(newFilesMetadata))
      }
      
      if (matchedFiles.length > 0) {
        showMessage(`Matched ${matchedFiles.length} existing files. Ready to continue processing.`, 'success')
      }
    } else {
      // No existing files, add all as new
      setSelectedFiles(prev => [...prev, ...docxFiles])
      
      const filesMetadata: FileMetadata[] = docxFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }))
      dispatch(addSelectedFilesMetadata(filesMetadata))
    }
  }

  // Remove a file from the list
  const removeFileFromList = (index: number) => {
    // Update local File state
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    // Update Redux state
    dispatch(removeFile(index))
  }

  // Process all DOCX files
  const processAllFiles = async () => {
    if (selectedFiles.length === 0) {
      showMessage('Please select DOCX files first', 'error')
      return
    }

    dispatch(setIsProcessingFiles(true))
    
    // Process all files in parallel
    const processingPromises = selectedFiles.map(async (file, index) => {
      // Update status to parsing
      dispatch(updateProcessedFileStatus({
        index,
        status: 'parsing'
      }))

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
        dispatch(updateProcessedFileStatus({
          index,
          status: 'processing',
          content: parseData.content
        }))

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

        // Update status to completed
        dispatch(updateProcessedFileStatus({
          index,
          status: 'completed',
          trainingData: {
            systemPrompt: structureData.systemPrompt,
            userPrompt: structureData.userPrompt,
            assistantResponse: structureData.assistantResponse
          }
        }))

        return trainingDataItem

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        dispatch(updateProcessedFileStatus({
          index,
          status: 'error',
          error: (error as Error).message
        }))
        return null
      }
    })

    // Wait for all files to complete processing
    try {
      const results = await Promise.all(processingPromises)
      const successfulItems = results.filter(item => item !== null) as TrainingDataItem[]
      
      // Update training data with all successful results
      dispatch(setDocxTrainingData(successfulItems))
      
      const totalFiles = selectedFiles.length
      const successfulFiles = successfulItems.length
      const failedFiles = totalFiles - successfulFiles
      
      if (successfulFiles > 0) {
        if (failedFiles > 0) {
          showMessage(`Processing completed: ${successfulFiles} succeeded, ${failedFiles} failed`, 'info')
        } else {
          showMessage(`Successfully processed all ${successfulFiles} files into training data`, 'success')
        }
      } else {
        showMessage('All files failed to process. Please check the error messages above.', 'error')
      }
    } catch (error) {
      console.error('Error in parallel processing:', error)
      showMessage('An unexpected error occurred during processing', 'error')
    } finally {
      dispatch(setIsProcessingFiles(false))
    }
  }

  // Generate automatic dataset from existing jobs
  const generateAutoDataset = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate dataset', 'error')
      return
    }

    dispatch(setIsGeneratingDataset(true))
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
        dispatch(setAutoDataset(data.trainingData))
        dispatch(setDatasetSummary(data.summary))
        showMessage(`Generated dataset with ${data.trainingData.length} training examples`, 'success')
      } else {
        showMessage(data.error || 'Failed to generate dataset', 'error')
      }
    } catch (error) {
      showMessage('Failed to generate dataset', 'error')
    } finally {
      dispatch(setIsGeneratingDataset(false))
    }
  }

  // Start fine-tuning with DOCX data
  const startDocxFineTuning = async () => {
    if (docxProcessing.docxTrainingData.length === 0) {
      showMessage('Please process DOCX files first', 'error')
      return
    }

    dispatch(setIsFineTuningDocx(true))
    try {
      const response = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: docxProcessing.docxTrainingData,
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
          model: fineTuningState.selectedModel,
          uploadId: uploadData.upload?.id
        })
      })

      const jobData = await jobResponse.json()

      if (jobResponse.ok && jobData.success) {
        dispatch(setFineTuningResults(jobData))
        showMessage(`Fine-tuning job started successfully! Job ID: ${jobData.openaiJob.id}`, 'success')
      } else {
        throw new Error(jobData.error || 'Failed to start fine-tuning job')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsFineTuningDocx(false))
    }
  }

  // Start fine-tuning with auto dataset
  const startAutoFineTuning = async () => {
    if (autoDataset.autoDataset.length === 0) {
      showMessage('Please generate dataset first', 'error')
      return
    }

    dispatch(setIsFineTuningAuto(true))
    try {
      const response = await fetch('/api/fine-tuning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingData: autoDataset.autoDataset,
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
          model: fineTuningState.selectedModel,
          uploadId: uploadData.upload?.id
        })
      })

      const jobData = await jobResponse.json()

      if (jobResponse.ok && jobData.success) {
        dispatch(setFineTuningResults(jobData))
        showMessage(`Fine-tuning job started successfully! Job ID: ${jobData.openaiJob.id}`, 'success')
      } else {
        throw new Error(jobData.error || 'Failed to start fine-tuning job')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning: ' + (error as Error).message, 'error')
    } finally {
      dispatch(setIsFineTuningAuto(false))
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
      {fineTuningExport.message && (
        <div className={`p-4 rounded-lg ${
          fineTuningExport.messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          fineTuningExport.messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {fineTuningExport.messageType === 'success' && <CheckCircle className="h-4 w-4" />}
            {fineTuningExport.messageType === 'error' && <AlertCircle className="h-4 w-4" />}
            {fineTuningExport.messageType === 'info' && <FileText className="h-4 w-4" />}
            {fineTuningExport.message}
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
              {docxProcessing.processedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Files</Label>
                  <div className="space-y-2">
                    {docxProcessing.processedFiles.map((file, index) => (
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
                          onClick={() => removeFileFromList(index)}
                          disabled={docxProcessing.isProcessingFiles}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show message if files exist but no local File objects */}
                  {selectedFiles.length === 0 && docxProcessing.processedFiles.length > 0 && !docxProcessing.isProcessingFiles && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        💡 To reprocess files or add new ones, select your DOCX files again using the file input above.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={processAllFiles}
                  disabled={docxProcessing.isProcessingFiles || selectedFiles.length === 0}
                  className="flex items-center gap-2"
                >
                  {docxProcessing.isProcessingFiles ? (
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

                {docxProcessing.docxTrainingData.length > 0 && (
                  <Button
                    onClick={() => downloadJsonl(docxProcessing.docxTrainingData, 'docx_training_data.jsonl')}
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
          {docxProcessing.docxTrainingData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Training Data</CardTitle>
                <CardDescription>
                  {docxProcessing.docxTrainingData.length} training examples generated from DOCX files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {docxProcessing.docxTrainingData.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Example {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.metadata?.filename}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <Label className="text-blue-600 font-semibold">System Prompt:</Label>
                          <Textarea
                            value={item.messages[0].content}
                            onChange={(e) => {
                              const updatedData = docxProcessing.docxTrainingData.map((dataItem, dataIndex) => {
                                if (dataIndex === index) {
                                  return {
                                    ...dataItem,
                                    messages: dataItem.messages.map((message, messageIndex) => {
                                      if (messageIndex === 0) {
                                        return { ...message, content: e.target.value }
                                      }
                                      return { ...message }
                                    })
                                  }
                                }
                                return { ...dataItem }
                              })
                              dispatch(setDocxTrainingData(updatedData))
                            }}
                            className="bg-white mt-1 min-h-[80px] text-sm"
                            placeholder="System prompt content..."
                          />
                        </div>
                        
                        <div>
                          <Label className="text-green-600 font-semibold">User Input:</Label>
                          <Textarea
                            value={item.messages[1].content}
                            onChange={(e) => {
                              const updatedData = docxProcessing.docxTrainingData.map((dataItem, dataIndex) => {
                                if (dataIndex === index) {
                                  return {
                                    ...dataItem,
                                    messages: dataItem.messages.map((message, messageIndex) => {
                                      if (messageIndex === 1) {
                                        return { ...message, content: e.target.value }
                                      }
                                      return { ...message }
                                    })
                                  }
                                }
                                return { ...dataItem }
                              })
                              dispatch(setDocxTrainingData(updatedData))
                            }}
                            className="bg-white mt-1 min-h-[80px] text-sm"
                            placeholder="User input content..."
                          />
                        </div>
                        
                        <div>
                          <Label className="text-purple-600 font-semibold">Assistant Response:</Label>
                          <Textarea
                            value={item.messages[2].content}
                            onChange={(e) => {
                              const updatedData = docxProcessing.docxTrainingData.map((dataItem, dataIndex) => {
                                if (dataIndex === index) {
                                  return {
                                    ...dataItem,
                                    messages: dataItem.messages.map((message, messageIndex) => {
                                      if (messageIndex === 2) {
                                        return { ...message, content: e.target.value }
                                      }
                                      return { ...message }
                                    })
                                  }
                                }
                                return { ...dataItem }
                              })
                              dispatch(setDocxTrainingData(updatedData))
                            }}
                            className="bg-white mt-1 min-h-[120px] text-sm"
                            placeholder="Assistant response content..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Model Selection and Fine-Tuning */}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select-docx">Select Model for Fine-Tuning</Label>
                    <Select value={fineTuningState.selectedModel} onValueChange={(value) => dispatch(setSelectedModel(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                        {fineTuningState.fineTunedModels.length > 0 && (
                          <>
                            <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                              --- Your Fine-Tuned Models ---
                            </SelectItem>
                            {fineTuningState.fineTunedModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name.split(':').pop()} (based on {model.baseModel})
                              </SelectItem>
                            ))}
                          </>
                        )}
                                              <SelectItem value="ft:gpt-4.1-2025-04-14:pletfree-creations-ltd:initial-model:Blhdq95X">Initial Model (GPT-4.1)</SelectItem>

                      </SelectContent>
                    </Select>
                    {fineTuningState.loadingModels && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading your fine-tuned models...
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={startDocxFineTuning}
                    disabled={fineTuningState.isFineTuningDocx}
                    className="w-full"
                    size="lg"
                  >
                    {fineTuningState.isFineTuningDocx ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting Fine-Tuning...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start Fine-Tuning with {fineTuningState.selectedModel}
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
                  disabled={autoDataset.isGeneratingDataset}
                  className="flex items-center gap-2"
                >
                  {autoDataset.isGeneratingDataset ? (
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

                {autoDataset.autoDataset.length > 0 && (
                  <Button
                    onClick={() => downloadJsonl(autoDataset.autoDataset, 'auto_dataset.jsonl')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download JSONL
                  </Button>
                )}
              </div>

              {/* Dataset Summary */}
              {autoDataset.datasetSummary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{autoDataset.datasetSummary.totalJobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{autoDataset.datasetSummary.filteredJobs}</div>
                    <div className="text-sm text-gray-600">Training Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{autoDataset.datasetSummary.totalSections}</div>
                    <div className="text-sm text-gray-600">Total Sections</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto Dataset Display */}
          {autoDataset.autoDataset.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Auto Dataset</CardTitle>
                <CardDescription>
                  {autoDataset.autoDataset.length} training examples generated from existing jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {autoDataset.autoDataset.map((item, index) => (
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


                {/* Model Selection and Fine-Tuning */}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select-auto">Select Model for Fine-Tuning</Label>
                    <Select value={fineTuningState.selectedModel} onValueChange={(value) => dispatch(setSelectedModel(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                        <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                        {fineTuningState.fineTunedModels.length > 0 && (
                          <>
                            <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                              --- Your Fine-Tuned Models ---
                            </SelectItem>
                            {fineTuningState.fineTunedModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name.split(':').pop()} (based on {model.baseModel})
                              </SelectItem>
                            ))}
                          </>
                        )}
                                              <SelectItem value="ft:gpt-4.1-2025-04-14:pletfree-creations-ltd:initial-model:Blhdq95X">Initial Model (GPT-4.1)</SelectItem>

                      </SelectContent>
                    </Select>
                    {fineTuningState.loadingModels && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading your fine-tuned models...
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={startAutoFineTuning}
                    disabled={fineTuningState.isFineTuningAuto}
                    className="w-full"
                    size="lg"
                  >
                    {fineTuningState.isFineTuningAuto ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting Fine-Tuning...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start Fine-Tuning with {fineTuningState.selectedModel}
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
      {fineTuningState.fineTuningResults && (
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
              {fineTuningState.fineTuningResults.openaiJob?.id && (
                <p className="text-xs text-green-600 mt-2 font-mono">
                  Job ID: {fineTuningState.fineTuningResults.openaiJob.id}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 