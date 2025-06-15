'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../lib/hooks'
import { 
  loadVoicesThunk, 
  generateAudioThunk, 
  setSelectedVoice, 
  setSelectedAudioModel,
  setAudioPlaying 
} from '../../lib/features/scripts/scriptsSlice'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Loader2, Volume2, Download, Play, Pause, RefreshCw, Mic, Music, AlertCircle, CheckCircle, Settings, FileText } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'

export function AudioGeneration() {
  const dispatch = useAppDispatch()
  const { currentJob, audioGeneration } = useAppSelector(state => state.scripts)
  const user = useAppSelector(state => state.user)
  
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [customText, setCustomText] = useState('')
  const [customTitle, setCustomTitle] = useState('')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Load voices on component mount
  useEffect(() => {
    if (audioGeneration.voices.length === 0 && !audioGeneration.loadingVoices) {
      loadVoices()
    }
  }, [])

  const loadVoices = async () => {
    const result = await dispatch(loadVoicesThunk())
    if (result.success) {
      showMessage(`Loaded ${result.voices.length} voices from ElevenLabs`, 'success')
    } else {
      showMessage(result.error || 'Failed to load voices', 'error')
    }
  }

  const generateAudio = async (sectionId: string, scriptText: string) => {
    if (!audioGeneration.selectedVoice) {
      showMessage('Please select a voice first', 'error')
      return
    }

    if (!user.isLoggedIn) {
      showMessage('Please log in to generate audio', 'error')
      return
    }

    const result = await dispatch(generateAudioThunk({
      sectionId,
      text: scriptText,
      voiceId: audioGeneration.selectedVoice,
      modelId: audioGeneration.selectedModel
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Audio generated successfully! ${result.result.chunksGenerated}/${result.result.totalChunks} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate audio', 'error')
    }
  }

  const generateCustomAudio = async () => {
    if (!customText.trim()) {
      showMessage('Please enter some text to convert to audio', 'error')
      return
    }

    if (!audioGeneration.selectedVoice) {
      showMessage('Please select a voice first', 'error')
      return
    }

    if (!user.isLoggedIn) {
      showMessage('Please log in to generate audio', 'error')
      return
    }

    // Create a unique ID for custom text audio
    const customSectionId = `custom-${Date.now()}`
    
    const result = await dispatch(generateAudioThunk({
      sectionId: customSectionId,
      text: customText,
      voiceId: audioGeneration.selectedVoice,
      modelId: audioGeneration.selectedModel
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Custom audio generated successfully! ${result.result.chunksGenerated}/${result.result.totalChunks} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate custom audio', 'error')
    }
  }

  const playPauseAudio = (sectionId: string, audioUrl: string) => {
    const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === sectionId
    
    if (isCurrentlyPlaying) {
      // Pause current audio
      dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
    } else {
      // Play this audio
      dispatch(setAudioPlaying({ sectionId, isPlaying: true }))
      
      const audio = new Audio(audioUrl)
      audio.addEventListener('ended', () => {
        dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
      })
      audio.play()
    }
  }

  const downloadAudio = (sectionTitle: string, audioUrl: string) => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `${sectionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const selectedVoiceName = audioGeneration.voices.find(v => v.id === audioGeneration.selectedVoice)?.name || 'Unknown Voice'
  const sectionsWithScripts = currentJob?.sections.filter(s => s.texts && s.texts.length > 0) || []
  const customAudioStates = audioGeneration.sectionAudioStates.filter(s => s.sectionId.startsWith('custom-'))

  if (!user.isLoggedIn) {
    return (
      <div className="flex-1 p-6">
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Volume2 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-500 mb-4">
              Please log in to access audio generation features.
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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Volume2 className="h-6 w-6" />
          Audio Generation
        </h1>
        <p className="text-gray-600 mt-1">Convert your scripts to high-quality audio using ElevenLabs TTS</p>
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
            {messageType === 'info' && <Volume2 className="h-4 w-4" />}
            {message}
          </div>
        </div>
      )}

      {/* Voice Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Voice Configuration
          </CardTitle>
          <CardDescription>
            Choose your voice and model settings for audio generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice
              </label>
              <Select 
                value={audioGeneration.selectedVoice} 
                onValueChange={(value) => dispatch(setSelectedVoice(value))}
                disabled={audioGeneration.loadingVoices}
              >
                <SelectTrigger>
                  <SelectValue placeholder={audioGeneration.loadingVoices ? "Loading voices..." : "Select a voice"} />
                </SelectTrigger>
                <SelectContent>
                  {audioGeneration.voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex items-center gap-2">
                        <Mic className="h-3 w-3" />
                        {voice.name}
                        {voice.category && (
                          <Badge variant="outline" className="text-xs">
                            {voice.category}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <Select 
                value={audioGeneration.selectedModel} 
                onValueChange={(value) => dispatch(setSelectedAudioModel(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eleven_multilingual_v2">Multilingual V2 (High Quality)</SelectItem>
                  <SelectItem value="eleven_flash_v2_5">Flash V2.5 (Fast)</SelectItem>
                  <SelectItem value="eleven_turbo_v2_5">Turbo V2.5 (Fastest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={loadVoices}
              variant="outline"
              size="sm"
              disabled={audioGeneration.loadingVoices}
            >
              {audioGeneration.loadingVoices ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Voices
            </Button>
            {audioGeneration.voices.length > 0 && (
              <Badge variant="secondary">
                {audioGeneration.voices.length} voices available
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Text Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Text to Audio
          </CardTitle>
          <CardDescription>
            Enter any text to convert to audio, no script generation required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Title (Optional)
            </label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., My Custom Audio"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Text to Convert *
            </label>
            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Enter the text you want to convert to audio..."
              className="min-h-[120px] w-full"
              maxLength={100000}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{customText.length} characters • ~{customText.split(' ').length} words</span>
              <span>Est. ~{Math.ceil(customText.split(' ').length / 150)} min duration</span>
            </div>
          </div>

          <Button
            onClick={generateCustomAudio}
            disabled={!customText.trim() || !audioGeneration.selectedVoice || customAudioStates.some(s => s.isGenerating)}
            className="w-full"
          >
            {customAudioStates.some(s => s.isGenerating) ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Custom Audio...
              </>
            ) : (
              <>
                <Music className="h-4 w-4 mr-2" />
                Generate Audio with {selectedVoiceName}
              </>
            )}
          </Button>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Generation Time Notice</p>
                <p className="mt-1">
                  Audio generation may take up to 5 minutes depending on text length and ElevenLabs server load. 
                  Longer texts are processed in parallel chunks for faster generation.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Audio Results */}
      {customAudioStates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Audio Results</CardTitle>
            <CardDescription>Your generated custom audio files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customAudioStates.map((audioState) => {
              const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === audioState.sectionId
              const displayTitle = customTitle || `Custom Audio ${audioState.sectionId.split('-')[1]}`

              return (
                <div key={audioState.sectionId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{displayTitle}</h4>
                    <div className="flex items-center gap-2">
                      {audioState.result?.success && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          Audio Ready
                        </Badge>
                      )}
                      {audioState.isGenerating && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Generating
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Generation Progress */}
                  {audioState.isGenerating && (
                    <div className="space-y-2 mb-4">
                      <Progress value={50} className="w-full" />
                      <p className="text-sm text-gray-600 text-center">
                        Processing with ElevenLabs... This may take up to 5 minutes.
                      </p>
                    </div>
                  )}

                  {/* Audio Controls */}
                  {audioState.result?.success && audioState.audioUrl && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h5 className="font-medium text-green-900 mb-3">Audio Generated Successfully!</h5>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {audioState.result.chunksGenerated}/{audioState.result.totalChunks}
                          </div>
                          <div className="text-xs text-gray-600">Chunks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {Math.round((audioState.result.audioSize || 0) / 1024)}KB
                          </div>
                          <div className="text-xs text-gray-600">Size</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">{selectedVoiceName}</div>
                          <div className="text-xs text-gray-600">Voice</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{audioState.result.modelId}</div>
                          <div className="text-xs text-gray-600">Model</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => playPauseAudio(audioState.sectionId, audioState.audioUrl!)}
                          variant="outline"
                          className="flex-1"
                        >
                          {isCurrentlyPlaying ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Play
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => downloadAudio(displayTitle, audioState.audioUrl!)}
                          variant="outline"
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {audioState.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Error generating audio</span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">{audioState.error}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Project Overview - Only show if there's a current job */}
      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle>Project: {currentJob.name}</CardTitle>
            <CardDescription>{currentJob.theme}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{sectionsWithScripts.length}</div>
                <div className="text-sm text-gray-600">Scripts Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {audioGeneration.sectionAudioStates.filter(s => s.result?.success && !s.sectionId.startsWith('custom-')).length}
                </div>
                <div className="text-sm text-gray-600">Project Audio Generated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {audioGeneration.sectionAudioStates.filter(s => s.isGenerating && !s.sectionId.startsWith('custom-')).length}
                </div>
                <div className="text-sm text-gray-600">Currently Generating</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Sections - Only show if there are scripts */}
      {sectionsWithScripts.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Scripts</CardTitle>
              <CardDescription>Generate audio from your project scripts</CardDescription>
            </CardHeader>
          </Card>

          {sectionsWithScripts.map((section) => {
            const sectionAudioState = audioGeneration.sectionAudioStates.find(s => s.sectionId === section.id)
            const scriptText = section.texts[0].generated_script
            const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === section.id

            return (
              <Card key={section.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>
                        {scriptText.length} characters • ~{scriptText.split(' ').length} words • 
                        Est. ~{Math.ceil(scriptText.split(' ').length / 150)} min duration
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {sectionAudioState?.result?.success && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          Audio Ready
                        </Badge>
                      )}
                      {sectionAudioState?.isGenerating && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Generating
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Script Preview */}
                  <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                    <div className="text-sm text-gray-700">
                      {scriptText.substring(0, 300)}...
                    </div>
                  </div>

                  {/* Generate Button */}
                  {!sectionAudioState?.result?.success && (
                    <Button
                      onClick={() => generateAudio(section.id, scriptText)}
                      disabled={sectionAudioState?.isGenerating || !audioGeneration.selectedVoice}
                      className="w-full"
                    >
                      {sectionAudioState?.isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating Audio...
                        </>
                      ) : (
                        <>
                          <Music className="h-4 w-4 mr-2" />
                          Generate Audio with {selectedVoiceName}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Generation Time Warning */}
                  {!sectionAudioState?.result?.success && !sectionAudioState?.isGenerating && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                          <p className="font-medium">⏱️ Expected Generation Time</p>
                          <p className="mt-1">
                            Audio generation may take up to 5 minutes. Please be patient while we process your text with ElevenLabs.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generation Progress */}
                  {sectionAudioState?.isGenerating && (
                    <div className="space-y-2">
                      <Progress value={50} className="w-full" />
                      <p className="text-sm text-gray-600 text-center">
                        Processing with ElevenLabs... This may take up to 5 minutes.
                      </p>
                    </div>
                  )}

                  {/* Audio Controls */}
                  {sectionAudioState?.result?.success && sectionAudioState.audioUrl && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Audio Generated Successfully!</h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {sectionAudioState.result.chunksGenerated}/{sectionAudioState.result.totalChunks}
                          </div>
                          <div className="text-xs text-gray-600">Chunks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {Math.round((sectionAudioState.result.audioSize || 0) / 1024)}KB
                          </div>
                          <div className="text-xs text-gray-600">Size</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">{selectedVoiceName}</div>
                          <div className="text-xs text-gray-600">Voice</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{sectionAudioState.result.modelId}</div>
                          <div className="text-xs text-gray-600">Model</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => playPauseAudio(section.id, sectionAudioState.audioUrl!)}
                          variant="outline"
                          className="flex-1"
                        >
                          {isCurrentlyPlaying ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Play
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => downloadAudio(section.title, sectionAudioState.audioUrl!)}
                          variant="outline"
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {sectionAudioState?.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Error generating audio</span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">{sectionAudioState.error}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
} 