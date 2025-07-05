'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as Dialog from '@radix-ui/react-dialog'
import { 
  Users, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Crown,
  RefreshCw,
  Edit,
  Mic,
  Plus,
  Trash2,
  VideoIcon,
  Download
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  created_at: string
  is_admin: boolean
  last_sign_in_at: string | null
  videos: {
    id: string
    status: 'processing' | 'completed' | 'failed'
    created_at: string
    final_video_url?: string
    thumbnail_url: string
  }[]
  video_count: number
  completed_videos: number
}

interface AIVoice {
  id: number
  created_at: string
  provider: 'murf' | 'elevenlabs' | 'speechify'
  voice_id: string
  name: string
}

export function AdminDashboard() {
  const user = useAppSelector(state => state.user)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  // User management
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [selectedUserVideos, setSelectedUserVideos] = useState<UserProfile | null>(null)
  const [showUserVideosDialog, setShowUserVideosDialog] = useState(false)

  // AI Voices Management
  const [voices, setVoices] = useState<AIVoice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [showVoiceDialog, setShowVoiceDialog] = useState(false)
  const [editingVoice, setEditingVoice] = useState<AIVoice | null>(null)
  const [voiceForm, setVoiceForm] = useState({
    provider: 'murf' as 'murf' | 'elevenlabs' | 'speechify',
    voice_id: '',
    name: ''
  })

  useEffect(() => {
    if (user.isAdmin) {
      fetchUsers()
      fetchVoices()
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

  const deleteUser = async (userId: string, userEmail: string) => {
    const confirmMessage = `Are you sure you want to delete user "${userEmail}"?\n\nThis will permanently delete:\n• The user account\n• All their generated videos\n• All their data\n\nThis action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setDeletingUserId(userId)
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      showMessage(`User "${userEmail}" deleted successfully`, 'success')
      fetchUsers() // Refresh the list
    } catch (error) {
      showMessage('Error deleting user: ' + (error as Error).message, 'error')
    } finally {
      setDeletingUserId(null)
    }
  }

  const openUserVideosDialog = (userProfile: UserProfile) => {
    setSelectedUserVideos(userProfile)
    setShowUserVideosDialog(true)
  }

  // AI Voices Management Functions
  const fetchVoices = async () => {
    setIsLoadingVoices(true)
    try {
      const response = await fetch('/api/admin/ai-voices')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch voices')
      }
      
      const data = await response.json()
      setVoices(data.voices)
    } catch (error) {
      showMessage('Error fetching voices: ' + (error as Error).message, 'error')
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const handleCreateVoice = async () => {
    if (!voiceForm.provider || !voiceForm.voice_id || !voiceForm.name) {
      showMessage('Please fill in all fields', 'error')
      return
    }

    try {
      const response = await fetch('/api/admin/ai-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voiceForm)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create voice')
      }

      showMessage('Voice created successfully!', 'success')
      setShowVoiceDialog(false)
      setVoiceForm({ provider: 'murf', voice_id: '', name: '' })
      fetchVoices()
    } catch (error) {
      showMessage('Error creating voice: ' + (error as Error).message, 'error')
    }
  }

  const handleEditVoice = async () => {
    if (!editingVoice || !voiceForm.provider || !voiceForm.voice_id || !voiceForm.name) {
      showMessage('Please fill in all fields', 'error')
      return
    }

    try {
      const response = await fetch('/api/admin/ai-voices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingVoice.id, ...voiceForm })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update voice')
      }

      showMessage('Voice updated successfully!', 'success')
      setShowVoiceDialog(false)
      setEditingVoice(null)
      setVoiceForm({ provider: 'murf', voice_id: '', name: '' })
      fetchVoices()
    } catch (error) {
      showMessage('Error updating voice: ' + (error as Error).message, 'error')
    }
  }

  const handleDeleteVoice = async (voiceId: number) => {
    if (!confirm('Are you sure you want to delete this voice?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/ai-voices?id=${voiceId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete voice')
      }

      showMessage('Voice deleted successfully!', 'success')
      fetchVoices()
    } catch (error) {
      showMessage('Error deleting voice: ' + (error as Error).message, 'error')
    }
  }

  const openCreateVoiceDialog = () => {
    setEditingVoice(null)
    setVoiceForm({ provider: 'murf', voice_id: '', name: '' })
    setShowVoiceDialog(true)
  }

  const openEditVoiceDialog = (voice: AIVoice) => {
    setEditingVoice(voice)
    setVoiceForm({
      provider: voice.provider,
      voice_id: voice.voice_id,
      name: voice.name
    })
    setShowVoiceDialog(true)
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
            Manage users and AI voices
          </p>
        </div>

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
                      {users.filter(u => !u.is_admin).length} Regular Users
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {users.reduce((sum, u) => sum + u.video_count, 0)} Total Videos
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {users.reduce((sum, u) => sum + u.completed_videos, 0)} Completed
                    </Badge>
                  </div>
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
                            {userProfile.video_count > 0 && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                {userProfile.completed_videos}/{userProfile.video_count} videos
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {userProfile.video_count > 0 && (
                            <Button
                              onClick={() => openUserVideosDialog(userProfile)}
                              size="sm"
                              variant="outline"
                            >
                              <VideoIcon className="h-4 w-4 mr-1" />
                              View Videos ({userProfile.video_count})
                            </Button>
                          )}
                          <Button
                            onClick={() => toggleUserAdminStatus(userProfile.id, userProfile.is_admin)}
                            size="sm"
                            variant={userProfile.is_admin ? "destructive" : "default"}
                            disabled={userProfile.id === user.id} // Prevent self-modification
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            {userProfile.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                          <Button
                            onClick={() => deleteUser(userProfile.id, userProfile.email)}
                            size="sm"
                            variant="destructive"
                            disabled={userProfile.id === user.id || deletingUserId === userProfile.id}
                          >
                            {deletingUserId === userProfile.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <div>Created: {new Date(userProfile.created_at).toLocaleDateString()}</div>
                        {userProfile.last_sign_in_at && (
                          <div>Last sign in: {new Date(userProfile.last_sign_in_at).toLocaleString()}</div>
                        )}
                        {userProfile.video_count > 0 && (
                          <div className="flex items-center gap-4">
                            <span>Videos: {userProfile.completed_videos} completed, {userProfile.video_count - userProfile.completed_videos} pending</span>
                          </div>
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

        {/* AI Voices Management */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              AI Voices Management ({voices.length} total)
              <Button 
                onClick={fetchVoices} 
                size="sm" 
                variant="outline"
                disabled={isLoadingVoices}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingVoices ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Manage AI voices for Murf.ai, ElevenLabs, and Speechify providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingVoices ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Loading voices...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {voices.filter(v => v.provider === 'murf').length} Murf.ai
                    </Badge>
                    <Badge variant="secondary">
                      {voices.filter(v => v.provider === 'elevenlabs').length} ElevenLabs
                    </Badge>
                    <Badge variant="secondary">
                      {voices.filter(v => v.provider === 'speechify').length} Speechify
                    </Badge>
                  </div>
                  <Button onClick={openCreateVoiceDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Voice
                  </Button>
                </div>

                {/* Voices List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {voices.map((voice) => (
                    <div key={voice.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {voice.provider}
                          </Badge>
                          <div>
                            <div className="font-medium">{voice.name}</div>
                            <div className="text-sm text-gray-500">ID: {voice.voice_id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => openEditVoiceDialog(voice)}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteVoice(voice.id)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Added: {new Date(voice.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  
                  {voices.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No voices configured yet.</p>
                      <p className="text-sm">Add voices manually using the form above.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Dialog */}
        <Dialog.Root open={showVoiceDialog} onOpenChange={setShowVoiceDialog}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
              <Dialog.Title className="text-lg font-semibold">
                {editingVoice ? 'Edit Voice' : 'Add New Voice'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {editingVoice ? 'Update the voice information.' : 'Add a new AI voice to the database.'}
              </Dialog.Description>
              
              <div className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select 
                    value={voiceForm.provider} 
                    onValueChange={(value: 'murf' | 'elevenlabs' | 'speechify') => 
                      setVoiceForm(prev => ({ ...prev, provider: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="murf">Murf.ai</SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      <SelectItem value="speechify">Speechify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="voice-id">Voice ID</Label>
                  <Input
                    id="voice-id"
                    value={voiceForm.voice_id}
                    onChange={(e) => setVoiceForm(prev => ({ ...prev, voice_id: e.target.value }))}
                    placeholder="e.g., en-US-ken or 21m00Tcm4TlvDq8ikWAM"
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="voice-name">Display Name</Label>
                  <Input
                    id="voice-name"
                    value={voiceForm.name}
                    onChange={(e) => setVoiceForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Rachel (American, Female)"
                    className="mt-2"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Dialog.Close asChild>
                    <Button variant="outline">Cancel</Button>
                  </Dialog.Close>
                  <Button 
                    onClick={editingVoice ? handleEditVoice : handleCreateVoice}
                    disabled={!voiceForm.provider || !voiceForm.voice_id || !voiceForm.name}
                  >
                    {editingVoice ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
              
              <Dialog.Close asChild>
                <button
                  className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* User Videos Dialog */}
        <Dialog.Root open={showUserVideosDialog} onOpenChange={setShowUserVideosDialog}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-6xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
              <Dialog.Title className="text-lg font-semibold">
                Videos by {selectedUserVideos?.email}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Total: {selectedUserVideos?.video_count} videos ({selectedUserVideos?.completed_videos} completed)
              </Dialog.Description>
              
              <div className="max-h-[70vh] overflow-y-auto">
                {selectedUserVideos?.videos && selectedUserVideos.videos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedUserVideos.videos.map((video) => (
                      <div key={video.id} className="border rounded-lg p-4 space-y-3">
                        {/* Video Thumbnail */}
                        <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                          {video.thumbnail_url ? (
                            <img 
                              src={video.thumbnail_url} 
                              alt="Video thumbnail"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* Video Info */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={
                                video.status === 'completed' ? 'default' : 
                                video.status === 'failed' ? 'destructive' : 
                                'secondary'
                              }
                              className={
                                video.status === 'completed' ? 'bg-green-100 text-green-800' :
                                video.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }
                            >
                              {video.status}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(video.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-600">
                            ID: {video.id}
                          </div>
                          
                          {/* Video Player for completed videos */}
                          {video.status === 'completed' && video.final_video_url && (
                            <video 
                              controls 
                              className="w-full rounded"
                              preload="metadata"
                            >
                              <source src={video.final_video_url} type="video/mp4" />
                              Your browser does not support the video element.
                            </video>
                          )}
                          
                          {/* Download Button for completed videos */}
                          {video.status === 'completed' && video.final_video_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = video.final_video_url!
                                link.download = `video-${video.id}.mp4`
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <VideoIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No videos found for this user.</p>
                  </div>
                )}
              </div>
              
              <Dialog.Close asChild>
                <button
                  className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

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