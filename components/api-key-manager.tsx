'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Key, Upload, CheckCircle, AlertCircle, BarChart3, RefreshCw, FileText, Edit } from 'lucide-react'

interface ApiKeyStats {
  validCount: number
  invalidCount: number
  totalCount: number
  usageLimitReached: number
  averageUsage: number
}

export function ApiKeyManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [apiKeysText, setApiKeysText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingText, setIsUploadingText] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [stats, setStats] = useState<ApiKeyStats | null>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Load API key statistics on component mount
  useEffect(() => {
    fetchApiKeyStats()
  }, [])

  // Fetch API key statistics
  const fetchApiKeyStats = async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch('/api/api-keys-status')
      
      if (response.ok) {
        const data = await response.json()
        setStats({
          validCount: data.validCount,
          invalidCount: data.invalidCount,
          totalCount: data.totalCount,
          usageLimitReached: data.usageLimitReached,
          averageUsage: data.averageUsage
        })
      } else {
        console.warn('Failed to fetch API key statistics')
      }
    } catch (error) {
      console.error('Error fetching API key statistics:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/plain') {
      setSelectedFile(file)
      setMessage('')
    } else {
      showMessage('Please select a valid text (.txt) file', 'error')
    }
  }

  // Upload API keys from file
  const handleUploadApiKeys = async () => {
    if (!selectedFile) {
      showMessage('Please select a file first', 'error')
      return
    }

    setIsUploading(true)
    showMessage('Uploading API keys from file...', 'info')

    try {
      // Read file content
      const fileContent = await selectedFile.text()
      
      const response = await fetch('/api/upload-api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKeysText: fileContent,
          userId: 'current_user'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload API keys')
      }

      const data = await response.json()
      showMessage(`Successfully uploaded ${data.count} API keys from file!`, 'success')
      
      // Refresh stats after upload
      await fetchApiKeyStats()
      
      // Clear file selection
      setSelectedFile(null)
      const fileInput = document.getElementById('api-keys-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
    } catch (error) {
      showMessage('Error uploading API keys from file: ' + (error as Error).message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // Upload API keys from text box
  const handleUploadApiKeysFromText = async () => {
    if (!apiKeysText.trim()) {
      showMessage('Please enter API keys in the text box', 'error')
      return
    }

    setIsUploadingText(true)
    showMessage('Uploading API keys from text box...', 'info')

    try {
      const response = await fetch('/api/upload-api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKeysText: apiKeysText,
          userId: 'current_user'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload API keys')
      }

      const data = await response.json()
      showMessage(`Successfully uploaded ${data.count} API keys from text box!`, 'success')
      
      // Refresh stats after upload
      await fetchApiKeyStats()
      
      // Clear text box
      setApiKeysText('')
      
    } catch (error) {
      showMessage('Error uploading API keys from text: ' + (error as Error).message, 'error')
    } finally {
      setIsUploadingText(false)
    }
  }

  // Count API keys in text box
  const countApiKeysInText = () => {
    if (!apiKeysText.trim()) return 0
    return apiKeysText
      .split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0)
      .length
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">API Key Manager</h1>
        <p className="text-gray-600">
          Manage WellSaid Labs API keys for audio generation
        </p>
      </div>

      {/* API Key Statistics Card */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            WellSaid Labs API Key Status
            <Button
              onClick={fetchApiKeyStats}
              size="sm"
              variant="outline"
              disabled={isLoadingStats}
              className="ml-auto"
            >
              {isLoadingStats ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Monitor the status and usage of your WellSaid Labs API keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{stats.validCount}</div>
                <div className="text-sm text-green-600">Valid Keys</div>
                <div className="text-xs text-gray-500 mt-1">Available for use</div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-700">{stats.invalidCount}</div>
                <div className="text-sm text-red-600">Invalid Keys</div>
                <div className="text-xs text-gray-500 mt-1">Expired or error</div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">{stats.usageLimitReached}</div>
                <div className="text-sm text-orange-600">At Limit</div>
                <div className="text-xs text-gray-500 mt-1">50+ uses reached</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{stats.averageUsage}</div>
                <div className="text-sm text-blue-600">Avg Usage</div>
                <div className="text-xs text-gray-500 mt-1">Uses per key</div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              {isLoadingStats ? 'Loading statistics...' : 'No statistics available'}
            </div>
          )}
          
          {stats && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-700">
                <strong>Total Keys:</strong> {stats.totalCount} | 
                <strong className="ml-2 text-green-600">Usable:</strong> {stats.validCount} | 
                <strong className="ml-2 text-red-600">Unusable:</strong> {stats.invalidCount + stats.usageLimitReached}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Keys become invalid after 50 uses or API errors. Upload new keys when running low.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add API Keys Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Method 1: Paste API Keys */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Paste API Keys
            </CardTitle>
            <CardDescription>
              Paste your WellSaid Labs API keys directly (one per line)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-keys-text">API Keys</Label>
              <Textarea
                id="api-keys-text"
                value={apiKeysText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setApiKeysText(e.target.value)}
                placeholder="wsl_abcd1234efgh5678ijkl9012mnop3456
wsl_qrst7890uvwx1234yzab5678cdef9012
wsl_ghij3456klmn7890pqrs1234tuvw5678"
                disabled={isUploadingText}
                className="min-h-[120px] font-mono text-sm"
              />
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>One API key per line</span>
                {apiKeysText.trim() && (
                  <span className="font-medium">
                    {countApiKeysInText()} key{countApiKeysInText() !== 1 ? 's' : ''} detected
                  </span>
                )}
              </div>
            </div>

            <Button 
              onClick={handleUploadApiKeysFromText}
              disabled={isUploadingText || !apiKeysText.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isUploadingText ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {countApiKeysInText()} Key{countApiKeysInText() !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Method 2: Upload File */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload File
            </CardTitle>
            <CardDescription>
              Upload a text file containing WellSaid Labs API keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-keys-file">API Keys File (.txt)</Label>
              <input
                id="api-keys-file"
                type="file"
                accept=".txt"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="text-xs text-gray-500">
                Each line should contain one WellSaid Labs API key. Empty lines will be ignored.
              </p>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedFile.name}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={handleUploadApiKeys}
              disabled={isUploading || !selectedFile}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Format Instructions */}
      <Card className="bg-blue-50 border border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">API Key Format Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border font-mono text-sm text-gray-700">
              wsl_abcd1234efgh5678ijkl9012mnop3456<br/>
              wsl_qrst7890uvwx1234yzab5678cdef9012<br/>
              wsl_ghij3456klmn7890pqrs1234tuvw5678
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <div>• One API key per line</div>
              <div>• WellSaid Labs API keys start with "wsl_"</div>
              <div>• Keys will be validated during audio generation</div>
              <div>• Invalid keys are automatically marked and skipped</div>
              <div>• Each key can be used up to 50 times before being marked invalid</div>
            </div>
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
              {messageType === 'info' && <Upload className="h-4 w-4 text-blue-600" />}
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
    </div>
  )
}