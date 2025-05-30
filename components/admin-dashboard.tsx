'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { 
  Users, 
  Key, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Crown,
  RefreshCw,
  BarChart3,
  Upload,
  FileText,
  Edit
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  created_at: string
  is_admin: boolean
  last_sign_in_at: string | null
  has_api_key: boolean
}

interface ApiKeyStats {
  validCount: number
  invalidCount: number
  totalCount: number
  usageLimitReached: number
  averageUsage: number
}

export function AdminDashboard() {
  const user = useAppSelector(state => state.user)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [showApiKeys, setShowApiKeys] = useState(false)
  
  // API Key Statistics
  const [stats, setStats] = useState<ApiKeyStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // API Key Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [apiKeysText, setApiKeysText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingText, setIsUploadingText] = useState(false)

  useEffect(() => {
    if (user.isAdmin) {
      fetchUsers()
      fetchApiKeyStats()
    }
  }, [user.isAdmin])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      showMessage('Error fetching users: ' + (error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

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

  const toggleUserAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isAdmin: !currentStatus
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update admin status')
      }

      showMessage(`User admin status updated successfully`, 'success')
      fetchUsers() // Refresh the list
    } catch (error) {
      showMessage('Error updating admin status: ' + (error as Error).message, 'error')
    }
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don't have admin privileges to access this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-yellow-600" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">
            Manage users, monitor API keys, and system overview
          </p>
        </div>

        {/* API Key Statistics */}
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
              Monitor the status and usage of system API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-4">
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
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-700">
                    <strong>Total Keys:</strong> {stats.totalCount} | 
                    <strong className="ml-2 text-green-600">Usable:</strong> {stats.validCount} | 
                    <strong className="ml-2 text-red-600">Unusable:</strong> {stats.invalidCount + stats.usageLimitReached}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Keys become invalid after 50 uses or API errors. Upload new keys when running low.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                {isLoadingStats ? 'Loading statistics...' : 'No statistics available'}
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

        {/* Users Overview */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users Overview ({users.length} total)
              <Button 
                onClick={fetchUsers} 
                size="sm" 
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Manage users and their admin privileges
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Loading users...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {users.filter(u => u.is_admin).length} Admins
                    </Badge>
                    <Badge variant="outline">
                      {users.filter(u => u.has_api_key).length} with API keys
                    </Badge>
                  </div>
                  <Button
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    variant="outline"
                    size="sm"
                  >
                    {showApiKeys ? 'Hide' : 'Show'} API Key Status
                  </Button>
                </div>

                <div className="grid gap-4">
                  {users.map((userProfile) => (
                    <div 
                      key={userProfile.id} 
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {userProfile.is_admin && (
                              <Crown className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="font-medium">{userProfile.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {userProfile.is_admin && (
                              <Badge variant="secondary" className="text-xs">
                                Admin
                              </Badge>
                            )}
                            {showApiKeys && userProfile.has_api_key && (
                              <Badge variant="outline" className="text-xs">
                                <Key className="h-3 w-3 mr-1" />
                                API Key
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => toggleUserAdminStatus(userProfile.id, userProfile.is_admin)}
                            size="sm"
                            variant={userProfile.is_admin ? "destructive" : "default"}
                            disabled={userProfile.id === user.id} // Prevent self-modification
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            {userProfile.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <div>Created: {new Date(userProfile.created_at).toLocaleDateString()}</div>
                        {userProfile.last_sign_in_at && (
                          <div>Last sign in: {new Date(userProfile.last_sign_in_at).toLocaleString()}</div>
                        )}
                        {userProfile.id === user.id && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                {messageType === 'info' && <Shield className="h-4 w-4 text-blue-600" />}
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
    </div>
  )
} 