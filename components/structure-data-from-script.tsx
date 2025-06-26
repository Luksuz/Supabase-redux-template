'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Loader2, FileText, Upload, Cloud, AlertCircle, CheckCircle, Settings, Zap } from 'lucide-react'

export function StructureDataFromScript() {
  // Script input state
  const [scriptPrompt, setScriptPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini-2024-07-18')
  const [isFineTuning, setIsFineTuning] = useState(false)
  const [fineTuningResult, setFineTuningResult] = useState<any>(null)
  
  // DOCX upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parsedContent, setParsedContent] = useState('')
  const [isGeneratingTrainingData, setIsGeneratingTrainingData] = useState(false)
  const [trainingData, setTrainingData] = useState<{
    systemPrompt: string
    userPrompt: string
    assistantResponse: string
  } | null>(null)
  const [isFineTuningDocx, setIsFineTuningDocx] = useState(false)
  const [docxFineTuningResult, setDocxFineTuningResult] = useState<any>(null)
  
  // Message state
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Handle script fine-tuning
  const handleFineTune = async () => {
    if (!scriptPrompt.trim()) {
      showMessage('Please enter a script or prompt first', 'error')
      return
    }

    setIsFineTuning(true)
    try {
      // Generate training data from script
      const response = await fetch('/api/structure-data-from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scriptPrompt,
          model: selectedModel,
          startFineTuning: true
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFineTuningResult(data)
        showMessage('Fine-tuning job started successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to start fine-tuning', 'error')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning', 'error')
    } finally {
      setIsFineTuning(false)
    }
  }

  // Handle DOCX file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setUploadedFile(file)
      setParsedContent('')
      setTrainingData(null)
      setDocxFineTuningResult(null)
      showMessage(`Selected: ${file.name}`, 'info')
    } else {
      showMessage('Please select a valid DOCX file', 'error')
    }
  }

  // Parse uploaded DOCX file
  const handleParseDocx = async () => {
    if (!uploadedFile) {
      showMessage('Please select a DOCX file first', 'error')
      return
    }

    setIsParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)

      const response = await fetch('/api/parse-docx', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setParsedContent(data.content)
        showMessage('DOCX file parsed successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to parse DOCX file', 'error')
      }
    } catch (error) {
      showMessage('Failed to parse DOCX file', 'error')
    } finally {
      setIsParsing(false)
    }
  }

  // Generate training data from parsed DOCX content
  const handleGenerateTrainingData = async () => {
    if (!parsedContent.trim()) {
      showMessage('Please parse a DOCX file first', 'error')
      return
    }

    setIsGeneratingTrainingData(true)
    try {
      const response = await fetch('/api/structure-data-from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: parsedContent,
          startFineTuning: false // Only generate data, don't start fine-tuning yet
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTrainingData({
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          assistantResponse: data.assistantResponse
        })
        showMessage('Training data generated successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to generate training data', 'error')
      }
    } catch (error) {
      showMessage('Failed to generate training data', 'error')
    } finally {
      setIsGeneratingTrainingData(false)
    }
  }

  // Start fine-tuning with the generated training data
  const handleStartFineTuning = async () => {
    if (!trainingData) {
      showMessage('Please generate training data first', 'error')
      return
    }

    setIsFineTuningDocx(true)
    try {
      const response = await fetch('/api/start-fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: trainingData.systemPrompt,
          userPrompt: trainingData.userPrompt,
          assistantResponse: trainingData.assistantResponse,
          model: selectedModel
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setDocxFineTuningResult(data)
        showMessage('Fine-tuning job started successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to start fine-tuning', 'error')
      }
    } catch (error) {
      showMessage('Failed to start fine-tuning', 'error')
    } finally {
      setIsFineTuningDocx(false)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Structure Data for Fine-Tuning</h1>
        <p className="text-gray-600 mt-1">Create training data from scripts or DOCX documents</p>
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
      <Tabs defaultValue="script" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="script" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Script Input
          </TabsTrigger>
          <TabsTrigger value="docx" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            DOCX Upload
          </TabsTrigger>
        </TabsList>

        {/* Script Input Tab */}
        <TabsContent value="script" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Script Fine-Tuning
              </CardTitle>
              <CardDescription>
                Enter a script or prompt to generate training data and start fine-tuning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="script-input">Script or Prompt</Label>
                <Textarea
                  id="script-input"
                  value={scriptPrompt}
                  onChange={(e) => setScriptPrompt(e.target.value)}
                  placeholder="Enter your script content or prompt here..."
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  {scriptPrompt.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-select">Select Model for Fine-Tuning</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                    <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                    <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (2025-04-14)</SelectItem>
                    <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                    <SelectItem value="ft:gpt-4.1-2025-04-14:pletfree-creations-ltd:initial-model:Blhdq95X">Initial Model (GPT-4.1)</SelectItem>

                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleFineTune}
                disabled={isFineTuning || !scriptPrompt.trim()}
                className="w-full"
              >
                {isFineTuning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting Fine-Tuning...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-2" />
                    Fine-Tune with {selectedModel}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Script Fine-Tuning Results */}
          {fineTuningResult && (
            <Card>
              <CardHeader>
                <CardTitle>Fine-Tuning Started</CardTitle>
                <CardDescription>Training data generated and fine-tuning job initiated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">✓</div>
                    <div className="text-sm text-gray-600">System Prompt</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">✓</div>
                    <div className="text-sm text-gray-600">User Prompt</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">✓</div>
                    <div className="text-sm text-gray-600">Assistant Response</div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Fine-tuning job started successfully!</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    Training data has been generated and processed automatically.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DOCX Upload Tab */}
        <TabsContent value="docx" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                DOCX Document Upload
              </CardTitle>
              <CardDescription>
                Upload and parse DOCX documents to create training data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="docx-upload">Upload DOCX File</Label>
                <Input
                  id="docx-upload"
                  type="file"
                  accept=".docx"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                {uploadedFile && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{uploadedFile.name}</Badge>
                    <Badge variant="secondary">{Math.round(uploadedFile.size / 1024)}KB</Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={handleParseDocx}
                disabled={isParsing || !uploadedFile}
                className="w-full"
                variant="outline"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Parsing DOCX...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Parse DOCX File
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Parsed Content Display */}
          {parsedContent && (
            <Card>
              <CardHeader>
                <CardTitle>Parsed Content</CardTitle>
                <CardDescription>Extracted text from your DOCX document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={parsedContent}
                  onChange={(e) => setParsedContent(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="Parsed content will appear here..."
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {parsedContent.length} characters
                  </p>
                  <Button
                    onClick={handleGenerateTrainingData}
                    disabled={isGeneratingTrainingData || !parsedContent.trim()}
                  >
                    {isGeneratingTrainingData ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Generate Training Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Training Data Display */}
          {trainingData && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Training Data</CardTitle>
                <CardDescription>Review the generated training data before starting fine-tuning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-blue-600">System Prompt</Label>
                    <Textarea
                      value={trainingData.systemPrompt}
                      onChange={(e) => setTrainingData(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                      className="mt-1 bg-blue-50 border-blue-200"
                      rows={4}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-green-600">User Prompt</Label>
                    <Textarea
                      value={trainingData.userPrompt}
                      onChange={(e) => setTrainingData(prev => prev ? { ...prev, userPrompt: e.target.value } : null)}
                      className="mt-1 bg-green-50 border-green-200"
                      rows={5}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-purple-600">Assistant Response</Label>
                    <Textarea
                      value={trainingData.assistantResponse}
                      onChange={(e) => setTrainingData(prev => prev ? { ...prev, assistantResponse: e.target.value } : null)}
                      className="mt-1 bg-purple-50 border-purple-200"
                      rows={8}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
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
                        <SelectItem value="ft:gpt-4.1-2025-04-14:pletfree-creations-ltd:initial-model:Blhdq95X">Initial Model (GPT-4.1)</SelectItem>

                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleStartFineTuning}
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
              </CardContent>
            </Card>
          )}

          {/* DOCX Fine-Tuning Results */}
          {docxFineTuningResult && (
            <Card>
              <CardHeader>
                <CardTitle>Fine-Tuning Started</CardTitle>
                <CardDescription>Training data processed and fine-tuning job initiated</CardDescription>
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
                    Your custom training data has been uploaded and fine-tuning is now in progress.
                  </p>
                  {docxFineTuningResult.jobId && (
                    <p className="text-xs text-green-600 mt-2 font-mono">
                      Job ID: {docxFineTuningResult.jobId}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
