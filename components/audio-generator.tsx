'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSelectedProvider,
  setSelectedVoice, 
  setSelectedModel,
  setGenerateSubtitles,
  setAudioProgress,
  startAudioGeneration,
  completeAudioGeneration,
  addSubtitlesToGeneration,
  setAudioGenerationError,
  saveGenerationToHistory,
  setIsGeneratingSubtitles,
  AudioProvider,
  setMusicSearchQuery,
  startMusicSearch,
  setMusicSearchResults,
  setMusicSearchError,
  setSelectedMusicTrack,
  MusicTrack,
  setUploadedMusicUrl,
} from '../lib/features/audio/audioSlice'
import { MurfVoice } from '../lib/murf-utils'
import { ElevenLabsVoice } from '../lib/elevenlabs-utils'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Volume2, Download, PlayCircle, CheckCircle, AlertCircle, Loader2, FileText, Clock, Subtitles, Music, Search } from 'lucide-react'
import React from 'react'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileDropzone } from './ui/file-dropzone'

export function AudioGenerator() {
  const dispatch = useAppDispatch()
  const { pastedScript, fileName } = useAppSelector(state => state.scriptProcessor)
  const { 
    currentGeneration, 
    generationHistory,
    isGeneratingAudio,
    isGeneratingSubtitles,
    audioProgress,
    selectedProvider,
    selectedVoice,
    selectedModel,
    generateSubtitles,
    musicSearchQuery,
    musicSearchResults,
    selectedMusicTrack,
    isSearchingMusic,
    musicSearchError,
    uploadedMusicUrl,
  } = useAppSelector(state => state.audio)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [editableScript, setEditableScript] = useState("")
  const [murfVoices, setMurfVoices] = useState<MurfVoice[]>([])
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([])
  const [activeAudioPreview, setActiveAudioPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  // Fetch voices when provider changes
  useEffect(() => {
    async function fetchVoices() {
      if (selectedProvider === 'murf') {
        try {
          const response = await fetch('/api/murf-voices');
          const data = await response.json();
          if (data.success) {
            setMurfVoices(data.voices);
          } else {
            showMessage('Failed to load Murf.ai voices', 'error');
          }
        } catch (error) {
          showMessage('Error fetching Murf.ai voices', 'error');
        }
      } else if (selectedProvider === 'elevenlabs') {
        try {
          const response = await fetch('/api/elevenlabs-voices');
          const data = await response.json();
          if (data.success) {
            setElevenlabsVoices(data.voices);
      } else {
            showMessage('Failed to load ElevenLabs voices', 'error');
          }
        } catch (error) {
          showMessage('Error fetching ElevenLabs voices', 'error');
        }
      }
    }
    fetchVoices();
  }, [selectedProvider]);

  // Initialize editable script
  useEffect(() => {
    if (pastedScript.trim()) {
      setEditableScript(pastedScript.trim())
    } else if (fileName) {
      // In a real app, you might fetch the content of the uploaded file here
      setEditableScript(`Script from ${fileName} would be here.`);
    } else {
      setEditableScript('')
    }
  }, [pastedScript, fileName])

  // Handle music search
  const handleMusicSearch = async () => {
    if (!musicSearchQuery.trim()) {
      showMessage('Please enter a search query for music.', 'error');
      return;
    }
    dispatch(startMusicSearch());
    try {
      const response = await fetch('/api/search-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: musicSearchQuery }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to search for music.');
      }
      const data = await response.json();
      dispatch(setMusicSearchResults(data.results));
    } catch (error: any) {
      dispatch(setMusicSearchError(error.message));
      showMessage(error.message, 'error');
    }
  };

  // Handle music file upload
  const handleMusicDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);
    dispatch(setUploadedMusicUrl(null)); // Clear previous url

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-music', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload music.');
      }

      const data = await response.json();
      dispatch(setUploadedMusicUrl(data.publicUrl));
      showMessage('Music uploaded successfully!', 'success');
    } catch (error: any) {
      showMessage(error.message, 'error');
      setUploadedFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Generate audio
  const handleGenerateAudio = async () => {
    if (!editableScript.trim()) {
      showMessage('No script content available for audio generation', 'error')
      return
    }

    const generationId = `audio_${Date.now()}`
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
      dispatch(startAudioGeneration({
        id: generationId,
        voice: selectedVoice,
        model: selectedModel,
      provider: selectedProvider,
        generateSubtitles: generateSubtitles
      }))

    try {
      const apiEndpoint = selectedProvider === 'murf' 
        ? '/api/generate-murf-audio' 
        : '/api/generate-elevenlabs-audio';
        
      const payload = {
        text: editableScript,
        voiceId: selectedVoice,
        chunkIndex: 0, // Simplified for single chunk
        sessionId: sessionId,
        generateSubtitles: generateSubtitles,
      };

      console.log(`🎵 Starting ${selectedProvider} audio generation...`)
      dispatch(setAudioProgress({ total: 1, completed: 0, phase: 'chunks' }))
              
      const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
              })

              if (!response.ok) {
                const errorData = await response.json()
        throw new Error(errorData.error || `Failed to generate audio with ${selectedProvider}`)
              }

              const data = await response.json()
              
      const scriptDuration = {
        scriptId: 'initial_script',
        imageId: 'initial_script',
        imageName: 'Initial Script',
        duration: data.duration, // We still need the duration from the initial generation
        startTime: 0,
      };
      
      dispatch(completeAudioGeneration({
        audioUrl: data.audioUrl,
        duration: data.duration,
        scriptDurations: [scriptDuration]
      }));

      showMessage(`Successfully generated audio using ${selectedProvider}!`, 'success')

      if (generateSubtitles) {
        const subtitleUrl = data.compressedAudioUrl || data.audioUrl;
        await handleGenerateSubtitles(subtitleUrl)
      } else {
        dispatch(saveGenerationToHistory())
      }

    } catch (error: any) {
      console.error('Audio generation error:', error)
      dispatch(setAudioGenerationError(error.message))
      showMessage(`Audio generation failed: ${error.message}`, 'error')
    }
  }

  const handleGenerateSubtitles = async (audioUrl?: string) => {
    const urlToUse = audioUrl || currentGeneration?.audioUrl
    
    if (!urlToUse) {
      showMessage('No audio available for subtitle generation', 'error')
      return
    }

    dispatch(setIsGeneratingSubtitles(true))
    dispatch(setAudioProgress({ phase: 'subtitles' }))

    try {
      console.log(`🔤 Starting subtitle generation for audio: ${urlToUse}`)
      
      const response = await fetch('/api/generate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: urlToUse,
          userId: 'current_user'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate subtitles')
      }

      const data = await response.json()
      
      dispatch(addSubtitlesToGeneration({
        subtitlesUrl: data.subtitlesUrl
      }))

      dispatch(saveGenerationToHistory())
      
      showMessage('Subtitles generated successfully!', 'success')

    } catch (error: any) {
      console.error('Subtitle generation error:', error)
      showMessage(`Subtitle generation failed: ${error.message}`, 'error')
      dispatch(setIsGeneratingSubtitles(false))
    }
  }

  const handleDownloadAudio = (audioUrl: string, filename: string = 'script-audio.mp3') => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadSubtitles = (subtitlesUrl: string, filename: string = 'subtitles.srt') => {
    const link = document.createElement('a')
    link.href = subtitlesUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const audioProgressPercentage = audioProgress.total > 0 ? Math.round((audioProgress.completed / audioProgress.total) * 100) : 0

  const renderVoiceSelector = () => {
    if (selectedProvider === 'murf') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {murfVoices.map((voice) => (
              <SelectItem key={voice.voiceId} value={voice.voiceId}>
                {voice.displayName} ({voice.gender}, {voice.accent})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (selectedProvider === 'elevenlabs') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {elevenlabsVoices.map((voice) => (
              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                {voice.name} ({voice.labels.accent}, {voice.category})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  const getVoiceName = (provider: AudioProvider, voiceId: string): string => {
    if (provider === 'murf') {
      return murfVoices.find(v => v.voiceId === voiceId)?.displayName || voiceId;
    }
    if (provider === 'elevenlabs') {
      return elevenlabsVoices.find(v => v.voice_id === voiceId)?.name || voiceId;
    }
    return voiceId;
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Generate high-quality audio from your scripts using Murf.ai or ElevenLabs
        </p>
      </div>

      {/* Script Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Script Editor</CardTitle>
          <CardDescription>Edit your script before generating audio.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Paste your script here..."
            value={editableScript}
            onChange={(e) => setEditableScript(e.target.value)}
            className="min-h-[200px]"
            disabled={isGeneratingAudio}
          />
        </CardContent>
      </Card>

      {/* Audio Generation Settings */}
      {editableScript.trim() && (
        <Card>
          <CardHeader>
            <CardTitle>Audio Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-2">
              <Label>Audio Provider</Label>
              <RadioGroup
                value={selectedProvider}
                onValueChange={(value: any) => dispatch(setSelectedProvider(value as AudioProvider))}
                className="flex gap-4"
                >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="murf" id="murf" />
                  <Label htmlFor="murf">Murf.ai</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="elevenlabs" id="elevenlabs" />
                  <Label htmlFor="elevenlabs">ElevenLabs</Label>
                </div>
              </RadioGroup>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voice</Label>
                {renderVoiceSelector()}
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subtitles"
                    checked={generateSubtitles}
                    onCheckedChange={(checked) => dispatch(setGenerateSubtitles(checked as boolean))}
                  />
                    <Label htmlFor="subtitles">Generate subtitles</Label>
                </div>
              </div>
            </div>

            {isGeneratingAudio && (
              <div className="space-y-2">
                <Progress value={audioProgressPercentage} />
                <p className="text-sm text-center">Generating audio... {audioProgressPercentage}%</p>
              </div>
            )}

            <Button
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio || !editableScript.trim()}
              className="w-full"
            >
              {isGeneratingAudio ? <Loader2 className="animate-spin" /> : <Volume2 />}
              Generate Audio
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Music Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Music /> Background Music</CardTitle>
          <CardDescription>Search for background music from Storyblocks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="e.g., 'uplifting corporate'"
              value={musicSearchQuery}
              onChange={(e) => dispatch(setMusicSearchQuery(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleMusicSearch()}
            />
            <Button onClick={handleMusicSearch} disabled={isSearchingMusic}>
              {isSearchingMusic ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>

          {musicSearchError && <Alert variant="destructive"><AlertDescription>{musicSearchError}</AlertDescription></Alert>}

          {selectedMusicTrack && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium">Selected: {selectedMusicTrack.title}</p>
              <div className="flex items-center gap-2">
                <audio src={selectedMusicTrack.preview_url} controls className="w-full h-10 mt-2" />
                <Button variant="ghost" size="sm" onClick={() => dispatch(setSelectedMusicTrack(null))}>Clear</Button>
              </div>
            </div>
          )}
          
          <div className="text-center text-sm text-gray-500 my-2">OR</div>

          <FileDropzone
            label="Upload Custom Music"
            onDrop={handleMusicDrop}
            acceptedFileTypes={{ 'audio/mpeg': ['.mp3'] }}
            maxFileSize={10 * 1024 * 1024} // 10MB
            uploadedFile={uploadedMusicUrl ? { name: uploadedFileName || 'Uploaded Music', url: uploadedMusicUrl } : null}
            onClear={() => {
              dispatch(setUploadedMusicUrl(null));
              setUploadedFileName(null);
            }}
          />
          {isUploading && <div className="flex items-center justify-center gap-2 text-gray-500 mt-2"><Loader2 className="animate-spin h-4 w-4" /> Uploading...</div>}

          {uploadedMusicUrl && !isUploading && (
             <div className="mt-2">
                <audio src={uploadedMusicUrl} controls className="w-full h-10" />
             </div>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto mt-4">
            {musicSearchResults.map((track: any) => (
              <div key={track.id} className="p-2 border rounded-md flex items-center justify-between">
                <div>
                  <p className="font-medium">{track.title}</p>
                  <p className="text-sm text-gray-500">Duration: {track.duration}s</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setActiveAudioPreview(track.preview_url === activeAudioPreview ? null : track.preview_url)}>
                    {activeAudioPreview === track.preview_url ? 'Stop' : 'Preview'}
                  </Button>
                  <Button size="sm" onClick={() => dispatch(setSelectedMusicTrack(track))}>Select</Button>
                </div>
              </div>
            ))}
          </div>
           {activeAudioPreview && (
            <audio src={activeAudioPreview} autoPlay onEnded={() => setActiveAudioPreview(null)} className="hidden" />
          )}

        </CardContent>
      </Card>

      {/* Current Generation */}
      {currentGeneration && (
        <Card>
          <CardHeader>
            <CardTitle>Current Generation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentGeneration.audioUrl && (
              <div>
                <div className="flex items-center gap-2">Provider: <Badge>{currentGeneration.provider}</Badge></div>
                <div className="flex items-center gap-2">Voice: <Badge>{getVoiceName(currentGeneration.provider, currentGeneration.voice)}</Badge></div>
                <audio controls src={currentGeneration.audioUrl} className="w-full mt-2" />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => handleDownloadAudio(currentGeneration!.audioUrl!)}>Download Audio</Button>
                  {currentGeneration.subtitlesUrl && <Button size="sm" onClick={() => handleDownloadSubtitles(currentGeneration!.subtitlesUrl!)}>Download Subtitles</Button>}
                </div>
              </div>
            )}
            {currentGeneration.status === 'error' && <p className="text-red-500">{currentGeneration.error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Generation History */}
      {generationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {generationHistory.map((gen: any) => (
              <div key={gen.id} className="p-2 border rounded flex justify-between items-center">
                <div>
                  <div className="text-sm">{new Date(gen.generatedAt).toLocaleString()}</div>
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <Badge variant="outline">{gen.provider}</Badge> 
                    <Badge variant="outline">{getVoiceName(gen.provider, gen.voice)}</Badge>
                  </div>
                  </div>
                {gen.audioUrl && <Button size="sm" onClick={() => handleDownloadAudio(gen.audioUrl!)}>Download</Button>}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 