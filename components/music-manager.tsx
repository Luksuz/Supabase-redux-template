'use client'

import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { StaggerContainer, StaggerItem, ScaleOnHover } from './animated-page'
import { motion } from 'framer-motion'
import { setVideoSettings } from '@/lib/features/video/videoSlice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Loader2, Music, Pause, Play, Trash2 } from 'lucide-react'

export function MusicManager() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector(state => state.video.settings)
  const [uploadingMusic, setUploadingMusic] = useState(false)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)

  const customMusicFiles: Array<{ id: string; name: string; url: string; duration?: number }> = settings.customMusicFiles || []

  const updateSettings = (partial: any) => dispatch(setVideoSettings(partial))

  const handleMusicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploadingMusic(true)
    const uploadedFiles: Array<{ id: string; name: string; url: string; duration?: number }> = []

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('audio/')) {
          alert(`${file.name} is not a valid audio file`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'audio')
        formData.append('path', `custom-music/${Date.now()}-${file.name}`)

        const response = await fetch('/api/upload-file', { method: 'POST', body: formData })
        if (!response.ok) throw new Error(`Failed to upload ${file.name}`)
        const { publicUrl } = await response.json()

        // Get duration
        const audio = new Audio()
        const duration = await new Promise<number>((resolve) => {
          audio.addEventListener('loadedmetadata', () => resolve(audio.duration))
          audio.src = URL.createObjectURL(file)
        })

        uploadedFiles.push({
          id: `music-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          name: file.name,
          url: publicUrl,
          duration: Math.round(duration)
        })
      }

      const updated = [...customMusicFiles, ...uploadedFiles]
      updateSettings({ customMusicFiles: updated, useCustomMusic: updated.length > 0 })
      alert(`Successfully uploaded ${uploadedFiles.length} music file(s)`) 
    } catch (error) {
      console.error('Music upload error:', error)
      alert(`Failed to upload music: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingMusic(false)
      event.target.value = ''
    }
  }

  const handleRemoveMusic = (musicId: string) => {
    const updated = customMusicFiles.filter(f => f.id !== musicId)
    updateSettings({ customMusicFiles: updated, useCustomMusic: updated.length > 0 })
  }

  const handlePlayPause = (musicId: string) => {
    if (playingAudio === musicId) {
      const audio = document.getElementById(`audio-${musicId}`) as HTMLAudioElement
      audio?.pause()
      setPlayingAudio(null)
      return
    }
    if (playingAudio) {
      const current = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement
      if (current) {
        current.pause()
        current.currentTime = 0
      }
    }
    const audio = document.getElementById(`audio-${musicId}`) as HTMLAudioElement
    if (audio) {
      audio.play()
      setPlayingAudio(musicId)
      audio.onended = () => setPlayingAudio(null)
    }
  }

  return (
    <StaggerContainer className="flex-1 p-6 space-y-6">
      <StaggerItem>
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-3xl font-bold text-gray-900">Music Library</h1>
          <p className="text-gray-600">Upload and manage background music for your videos. When enabled, links will be included in the video generation payload.</p>
        </motion.div>
      </StaggerItem>

      <StaggerItem>
        <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-purple-600" />
            Background Music
          </CardTitle>
          <CardDescription>
            Single file loops continuously. Multiple files play in sequence and loop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="music-upload" className="text-sm font-medium">Upload Audio Files (MP3, WAV, M4A)</Label>
                <Input id="music-upload" type="file" accept="audio/*" multiple onChange={handleMusicUpload} disabled={uploadingMusic} className="mt-2" />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-music"
                  checked={!!settings.useCustomMusic && customMusicFiles.length > 0}
                  onCheckedChange={(checked) => updateSettings({ useCustomMusic: !!checked && customMusicFiles.length > 0 })}
                  disabled={customMusicFiles.length === 0}
                />
                <Label htmlFor="use-custom-music" className="text-sm">Use background music</Label>
              </div>
            </div>
            {uploadingMusic && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading music files...</span>
              </div>
            )}
          </div>

          {customMusicFiles.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Uploaded Music Files ({customMusicFiles.length})</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customMusicFiles.map((file, index) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">#{index + 1}</Badge>
                        <Music className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                        {file.duration && (
                          <div className="text-xs text-gray-500">Duration: {Math.floor(file.duration / 60)}:{(file.duration % 60).toString().padStart(2, '0')}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <audio id={`audio-${file.id}`} src={file.url} preload="none" />
                      <Button variant="ghost" size="sm" onClick={() => handlePlayPause(file.id)} className="h-8 w-8 p-0">
                        {playingAudio === file.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMusic(file.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {customMusicFiles.length > 1 && (
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  Files will play in the order shown above, looping the entire sequence.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </StaggerItem>
    </StaggerContainer>
  )
}


