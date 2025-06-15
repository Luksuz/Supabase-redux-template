'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../../lib/hooks'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { 
  Loader2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Database, 
  RefreshCw, 
  Copy,
  Play,
  Settings,
  Upload,
  FileText,
  Plus
} from 'lucide-react'

interface FineTuningSession {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  job_id?: string
  upload_id?: string
  openai_job_id: string
  openai_file_id: string
  model: string
  status: string
  openai_created_at?: string
  openai_finished_at?: string
  fine_tuned_model?: string
  trained_tokens?: number
  hyperparameters?: any
  error_details?: any
  result_files?: string[]
  openai_response?: any
  last_polled_at: string
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'succeeded':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'running':
    case 'validating':
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
    case 'queued':
      return <Clock className="h-4 w-4 text-yellow-600" />
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-gray-600" />
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'succeeded':
      return 'bg-green-50 text-green-800 border-green-200'
    case 'failed':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'running':
    case 'validating':
      return 'bg-blue-50 text-blue-800 border-blue-200'
    case 'queued':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200'
    case 'cancelled':
      return 'bg-gray-50 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-50 text-gray-800 border-gray-200'
  }
}

export function FineTuningSessions() {
  const user = useAppSelector(state => state.user)
  const [sessions, setSessions] = useState<FineTuningSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [pollingSessionId, setPollingSessionId] = useState<string | null>(null)
  
  // Upload states
  const [uploadData, setUploadData] = useState('')
  const [uploadJobName, setUploadJobName] = useState('')
  const [uploadJobDescription, setUploadJobDescription] = useState('')
  const [uploadTheme, setUploadTheme] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const fetchSessions = async () => {
    if (!user.isLoggedIn) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/sessions')
      const data = await response.json()

      if (response.ok && data.success) {
        setSessions(data.sessions)
      } else {
        showMessage(data.error || 'Failed to fetch sessions', 'error')
      }
    } catch (error) {
      showMessage('Failed to fetch sessions', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const pollSessionStatus = async (sessionId: string) => {
    setPollingSessionId(sessionId)
    try {
      const response = await fetch('/api/fine-tuning/poll-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update the session in our list
        setSessions(prev => prev.map(session => 
          session.id === sessionId ? data.session : session
        ))
        
        if (data.statusChanged) {
          showMessage(`Session status updated to: ${data.session.status}`, 'success')
        } else {
          showMessage(`Session status: ${data.session.status}`, 'info')
        }
      } else {
        showMessage(data.error || 'Failed to poll session status', 'error')
      }
    } catch (error) {
      showMessage('Failed to poll session status', 'error')
    } finally {
      setPollingSessionId(null)
    }
  }

  const copyModelId = async (modelId: string) => {
    try {
      await navigator.clipboard.writeText(modelId)
      showMessage('Model ID copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy model ID', 'error')
    }
  }

  const parseUploadData = () => {
    console.log('parseUploadData called')
    console.log('uploadData:', uploadData)
    
    if (!uploadData.trim()) {
      showMessage('Please enter some data to parse', 'error')
      return
    }

    try {
      console.log('Attempting to parse JSON...')
      
      // First check if it's valid JSON
      let parsed
      try {
        parsed = JSON.parse(uploadData.trim())
      } catch (jsonError: any) {
        throw new Error(`Invalid JSON format: ${jsonError.message}. Please check your brackets, quotes, and commas.`)
      }
      
      console.log('Parsed data:', parsed)
      
      // Check if it's an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Data must be a JSON object (wrapped in curly braces { }), not an array or primitive value.')
      }
      
      // Validate the structure
      if (!parsed.prompt) {
        throw new Error('Missing required field: "prompt". Your JSON must include a "prompt" field with your main instructions.')
      }
      
      if (typeof parsed.prompt !== 'string' || !parsed.prompt.trim()) {
        throw new Error('Field "prompt" must be a non-empty string.')
      }
      
      if (!parsed.sections) {
        throw new Error('Missing required field: "sections". Your JSON must include a "sections" array.')
      }
      
      if (!Array.isArray(parsed.sections)) {
        throw new Error('Field "sections" must be an array (wrapped in square brackets [ ]).')
      }
      
      if (parsed.sections.length === 0) {
        throw new Error('The "sections" array cannot be empty. Please include at least one section.')
      }

      // Validate sections with detailed error messages
      for (let i = 0; i < parsed.sections.length; i++) {
        const section = parsed.sections[i]
        console.log(`Validating section ${i + 1}:`, section)
        
        if (typeof section !== 'object' || section === null || Array.isArray(section)) {
          throw new Error(`Section ${i + 1} must be an object (wrapped in curly braces { }).`)
        }
        
        if (!section.title) {
          throw new Error(`Section ${i + 1} is missing the required "title" field.`)
        }
        
        if (typeof section.title !== 'string' || !section.title.trim()) {
          throw new Error(`Section ${i + 1}: "title" must be a non-empty string.`)
        }
        
        if (!section.writing_instructions) {
          throw new Error(`Section ${i + 1} is missing the required "writing_instructions" field.`)
        }
        
        if (typeof section.writing_instructions !== 'string' || !section.writing_instructions.trim()) {
          throw new Error(`Section ${i + 1}: "writing_instructions" must be a non-empty string.`)
        }
        
        // Validate optional fields if they exist
        if (section.target_audience && typeof section.target_audience !== 'string') {
          throw new Error(`Section ${i + 1}: "target_audience" must be a string if provided.`)
        }
        
        if (section.tone && typeof section.tone !== 'string') {
          throw new Error(`Section ${i + 1}: "tone" must be a string if provided.`)
        }
        
        if (section.style_preferences && typeof section.style_preferences !== 'string') {
          throw new Error(`Section ${i + 1}: "style_preferences" must be a string if provided.`)
        }
      }

      console.log('Validation successful, setting parsed data')
      setParsedData(parsed)
      showMessage(`✅ Successfully parsed and validated ${parsed.sections.length} sections!`, 'success')
    } catch (error: any) {
      console.error('Parse error:', error)
      showMessage(`❌ Validation failed: ${error.message}`, 'error')
      setParsedData(null)
    }
  }

  const uploadTrainingData = async () => {
    if (!parsedData) {
      showMessage('Please parse your data first', 'error')
      return
    }

    if (!uploadJobName.trim() || !uploadTheme.trim()) {
      showMessage('Please enter job name and theme', 'error')
      return
    }

    setIsUploading(true)
    try {
      // Create the job first
      const jobResponse = await fetch('/api/fine-tuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadJobName.trim(),
          description: uploadJobDescription.trim(),
          theme: uploadTheme.trim()
        })
      })

      const jobData = await jobResponse.json()
      if (!jobResponse.ok) {
        throw new Error(jobData.error || 'Failed to create job')
      }

      // Create sections with the parsed data
      const sectionsResponse = await fetch('/api/fine-tuning/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobData.job.id,
          sections: parsedData.sections.map((section: any, index: number) => ({
            title: section.title,
            writing_instructions: section.writing_instructions,
            section_order: index + 1,
            target_audience: section.target_audience || '',
            tone: section.tone || '',
            style_preferences: section.style_preferences || ''
          })),
          promptUsed: parsedData.prompt
        })
      })

      const sectionsData = await sectionsResponse.json()
      if (!sectionsResponse.ok) {
        throw new Error(sectionsData.error || 'Failed to create sections')
      }

      showMessage(`Successfully created job "${uploadJobName}" with ${parsedData.sections.length} sections!`, 'success')
      
      // Reset form
      setUploadData('')
      setUploadJobName('')
      setUploadJobDescription('')
      setUploadTheme('')
      setParsedData(null)
      
    } catch (error: any) {
      showMessage(`Upload failed: ${error.message}`, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [user.isLoggedIn])

  if (!user.isLoggedIn) {
    return (
      <div className="flex-1 p-6">
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-500 mb-4">
              Please log in to view fine-tuning sessions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedSessions = sessions.filter(s => s.status === 'succeeded' && s.fine_tuned_model)
  const activeSessions = sessions.filter(s => ['queued', 'running', 'validating'].includes(s.status))
  const failedSessions = sessions.filter(s => s.status === 'failed')

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fine-Tuning Sessions</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your OpenAI fine-tuning jobs</p>
        </div>
        <Button
          onClick={fetchSessions}
          disabled={isLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
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
            {messageType === 'error' && <XCircle className="h-4 w-4" />}
            {messageType === 'info' && <AlertCircle className="h-4 w-4" />}
            {message}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{completedSessions.length}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{activeSessions.length}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{failedSessions.length}</p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold text-gray-600">{sessions.length}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Sessions</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="upload">Upload Data</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <SessionsList 
            sessions={sessions} 
            onPollStatus={pollSessionStatus}
            onCopyModel={copyModelId}
            pollingSessionId={pollingSessionId}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <SessionsList 
            sessions={completedSessions} 
            onPollStatus={pollSessionStatus}
            onCopyModel={copyModelId}
            pollingSessionId={pollingSessionId}
          />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <SessionsList 
            sessions={activeSessions} 
            onPollStatus={pollSessionStatus}
            onCopyModel={copyModelId}
            pollingSessionId={pollingSessionId}
          />
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          <SessionsList 
            sessions={failedSessions} 
            onPollStatus={pollSessionStatus}
            onCopyModel={copyModelId}
            pollingSessionId={pollingSessionId}
          />
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Training Data
              </CardTitle>
              <CardDescription>
                Upload your own prompts and sections for fine-tuning. No technical formatting required!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">📋 Data Format</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Paste your data in this JSON format:
                </p>
                <pre className="bg-blue-100 p-3 rounded text-xs text-blue-900 overflow-x-auto">
{`{
  "prompt": "Your main prompt/instructions here",
  "sections": [
    {
      "title": "Section 1 Title",
      "writing_instructions": "Detailed instructions for this section",
      "target_audience": "Optional: target audience",
      "tone": "Optional: tone preference",
      "style_preferences": "Optional: style preferences"
    },
    {
      "title": "Section 2 Title", 
      "writing_instructions": "Instructions for section 2"
    }
  ]
}`}
                </pre>
                <p className="text-xs text-blue-700 mt-2">
                  Only "title" and "writing_instructions" are required for each section.
                </p>
              </div>

              {/* Common Mistakes Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 mb-2">⚠️ Common JSON Mistakes</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Missing quotes around field names: use <code className="bg-amber-100 px-1 rounded">"title"</code> not <code className="bg-amber-100 px-1 rounded">title</code></li>
                  <li>• Missing commas between fields and array items</li>
                  <li>• Extra comma after the last item in arrays or objects</li>
                  <li>• Using single quotes instead of double quotes</li>
                  <li>• Unescaped quotes inside strings (use <code className="bg-amber-100 px-1 rounded">\"</code> for quotes in text)</li>
                  <li>• Missing opening or closing brackets <code className="bg-amber-100 px-1 rounded">{ }</code> or <code className="bg-amber-100 px-1 rounded">[ ]</code></li>
                </ul>
              </div>

              {/* Job Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobName">Job Name *</Label>
                  <Input
                    id="jobName"
                    value={uploadJobName}
                    onChange={(e) => setUploadJobName(e.target.value)}
                    placeholder="e.g., Marketing Copy Training"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme *</Label>
                  <Input
                    id="theme"
                    value={uploadTheme}
                    onChange={(e) => setUploadTheme(e.target.value)}
                    placeholder="e.g., Product descriptions"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={uploadJobDescription}
                    onChange={(e) => setUploadJobDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              {/* Data Input */}
              <div className="space-y-2">
                <Label htmlFor="uploadData">Training Data *</Label>
                <textarea
                  id="uploadData"
                  value={uploadData}
                  onChange={(e) => setUploadData(e.target.value)}
                  placeholder="Paste your JSON data here..."
                  className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{uploadData.length} characters</span>
                  <span>Paste your JSON data above</span>
                </div>
              </div>

              {/* Parse Button */}
              <div className="flex gap-3">
                <Button
                  onClick={parseUploadData}
                  disabled={!uploadData.trim()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Parse & Validate Data
                </Button>
                
                <Button
                  onClick={() => {
                    const exampleData = {
                      "prompt": "Write engaging content for our marketing campaigns",
                      "sections": [
                        {
                          "title": "Product Description",
                          "writing_instructions": "Write a compelling product description that highlights key features and benefits",
                          "target_audience": "Tech-savvy consumers",
                          "tone": "Professional yet approachable"
                        },
                        {
                          "title": "Email Subject Line",
                          "writing_instructions": "Create catchy email subject lines that increase open rates"
                        }
                      ]
                    }
                    setUploadData(JSON.stringify(exampleData, null, 2))
                    showMessage('Example data loaded! Click "Parse & Validate Data" to test.', 'info')
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Load Example
                </Button>
                
                <Button
                  onClick={() => {
                    setUploadData('')
                    setParsedData(null)
                    showMessage('Form cleared', 'info')
                  }}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Clear
                </Button>
                
                {parsedData && (
                  <Button
                    onClick={uploadTrainingData}
                    disabled={isUploading || !uploadJobName.trim() || !uploadTheme.trim()}
                    className="flex items-center gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isUploading ? 'Creating Job...' : 'Create Fine-Tuning Job'}
                  </Button>
                )}
              </div>

              {/* Parsed Data Preview */}
              {parsedData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3">✅ Data Successfully Parsed</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-green-700">Prompt</Label>
                      <div className="bg-green-100 p-2 rounded text-sm text-green-800 max-h-20 overflow-y-auto">
                        {parsedData.prompt}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium text-green-700">
                        Sections ({parsedData.sections.length})
                      </Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {parsedData.sections.map((section: any, index: number) => (
                          <div key={index} className="bg-green-100 p-2 rounded text-sm">
                            <div className="font-medium text-green-900">{section.title}</div>
                            <div className="text-green-700 text-xs mt-1 truncate">
                              {section.writing_instructions}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface SessionsListProps {
  sessions: FineTuningSession[]
  onPollStatus: (sessionId: string) => void
  onCopyModel: (modelId: string) => void
  pollingSessionId: string | null
}

function SessionsList({ sessions, onPollStatus, onCopyModel, pollingSessionId }: SessionsListProps) {
  if (sessions.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Database className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h3>
          <p className="text-gray-500">
            No fine-tuning sessions in this category yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(session.status)}
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {session.openai_job_id}
                    </span>
                    <Badge className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Base Model: {session.model} • Created: {new Date(session.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onPollStatus(session.id)}
                  disabled={pollingSessionId === session.id}
                  variant="outline"
                  size="sm"
                >
                  {pollingSessionId === session.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">Training File</Label>
                <p className="font-mono text-sm bg-gray-50 p-2 rounded">
                  {session.openai_file_id}
                </p>
              </div>
              
              {session.fine_tuned_model && (
                <div>
                  <Label className="text-xs font-medium text-gray-500">Fine-Tuned Model</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm bg-green-50 p-2 rounded flex-1 truncate">
                      {session.fine_tuned_model}
                    </p>
                    <Button
                      onClick={() => onCopyModel(session.fine_tuned_model!)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {session.trained_tokens && (
                <div>
                  <Label className="text-xs font-medium text-gray-500">Trained Tokens</Label>
                  <p className="text-sm p-2">
                    {session.trained_tokens.toLocaleString()}
                  </p>
                </div>
              )}
              
              {session.openai_finished_at && (
                <div>
                  <Label className="text-xs font-medium text-gray-500">Completed</Label>
                  <p className="text-sm p-2">
                    {new Date(session.openai_finished_at).toLocaleString()}
                  </p>
                </div>
              )}
              
              {session.error_details && (
                <div className="md:col-span-2 lg:col-span-3">
                  <Label className="text-xs font-medium text-red-600">Error Details</Label>
                  <div className="bg-red-50 border border-red-200 rounded p-3 mt-1">
                    <pre className="text-xs text-red-800 whitespace-pre-wrap">
                      {JSON.stringify(session.error_details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 