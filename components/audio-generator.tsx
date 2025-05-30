'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSelectedVoice, 
  setSelectedModel, 
  setGenerateSubtitles,
  setAudioProgress,
  startAudioGeneration,
  completeAudioGeneration,
  addSubtitlesToGeneration,
  setAudioGenerationError,
  saveGenerationToHistory,
  setIsGeneratingSubtitles
} from '../lib/features/audio/audioSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Volume2, Download, PlayCircle, PauseCircle, CheckCircle, AlertCircle, Loader2, FileText, Clock, Subtitles } from 'lucide-react'

// WellSaid Labs voice options
const wellSaidVoices = [
  { id: 3, name: "Alana B.", accent: "United States", style: "Narration" },
  { id: 4, name: "Ramona J.", accent: "United States", style: "Narration" },
  { id: 8, name: "Sofia H.", accent: "United States", style: "Narration" },
  { id: 10, name: "Vanessa N.", accent: "United States", style: "Narration" },
  { id: 11, name: "Isabel V.", accent: "United States", style: "Narration" },
  { id: 13, name: "Jeremy G.", accent: "United States", style: "Narration" },
  { id: 14, name: "Nicole L.", accent: "United States", style: "Narration" },
  { id: 15, name: "Paige L.", accent: "United States", style: "Narration" },
  { id: 16, name: "Tobin A.", accent: "United States", style: "Narration" },
  { id: 18, name: "Tristan F.", accent: "United States", style: "Narration" },
]

const wellSaidModels = [
  { id: "caruso", name: "Caruso (Latest)" },
  { id: "legacy", name: "Legacy" }
]

export function AudioGenerator() {
  const dispatch = useAppDispatch()
  const { scripts, hasGeneratedScripts } = useAppSelector(state => state.scripts)
  const { 
    currentGeneration, 
    generationHistory,
    isGeneratingAudio,
    isGeneratingSubtitles,
    audioProgress,
    selectedVoice,
    selectedModel,
    generateSubtitles
  } = useAppSelector(state => state.audio)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Get generated scripts
  const generatedScripts = scripts.filter(s => s.generated && s.script)

  // Split text into chunks for audio generation
  const splitTextIntoChunks = (text: string, maxChunkSize: number = 500): string[] => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.')
        }
        currentChunk = trimmedSentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.')
    }

    return chunks.length > 0 ? chunks : [text]
  }

  // Generate audio using WellSaid Labs
  const handleGenerateAudio = async () => {
    if (generatedScripts.length === 0) {
      showMessage('No generated scripts available for audio generation', 'error')
      return
    }

    const generationId = `audio_${Date.now()}`
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Start audio generation
      dispatch(startAudioGeneration({
        id: generationId,
        voice: selectedVoice,
        model: selectedModel,
        generateSubtitles: generateSubtitles
      }))

      console.log(`🎵 Starting WellSaid Labs audio generation for ${generatedScripts.length} scripts (with retry mechanism)`)

      // Initialize progress
      dispatch(setAudioProgress({ total: generatedScripts.length, completed: 0, phase: 'chunks' }))

      // Track individual script durations
      const scriptDurations: Array<{
        scriptId: string
        imageId: string
        imageName: string
        duration: number
        startTime: number
        text: string
      }> = []

      // Generate audio for each script individually with staggered sends and retry handling
      const scriptPromises = generatedScripts.map((script, index) => {
        return new Promise((resolve, reject) => {
          // Delay each request by index * 1000ms (1 second intervals)
          setTimeout(async () => {
            try {
              const cleanedScript = script.script.replace(/\[Generated using mock data[^\]]*\]/g, '').trim()
              console.log(`🎵 Sending request for script ${index + 1}/${generatedScripts.length}: ${script.imageName}`)
              
              const response = await fetch('/api/generate-audio-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: cleanedScript,
                  speaker_id: selectedVoice,
                  model: selectedModel,
                  chunkIndex: index,
                  userId: 'current_user',
                  sessionId: sessionId
                })
              })

              if (!response.ok) {
                const errorData = await response.json()
                
                // Check if this is a retryable error
                if (errorData.retryable) {
                  console.warn(`⚠️ Script ${index + 1} encountered retryable error: ${errorData.error}`)
                  // Don't show error to user immediately if it's retryable - let backend handle retries
                  
                  // Check if we should attempt one more time at frontend level for specific cases
                  if (errorData.error.includes('No valid WellSaid Labs API keys available')) {
                    // This is a critical error that retries won't fix
                    throw new Error(`Script ${index + 1}: ${errorData.error}`)
                  }
                  
                  // For other retryable errors, the backend has already tried multiple times
                  throw new Error(`Script ${index + 1}: ${errorData.error}`)
                } else {
                  // Non-retryable error
                  throw new Error(`Script ${index + 1}: ${errorData.error || 'Unknown error'}`)
                }
              }

              const data = await response.json()
              
              const result = {
                chunkIndex: index,
                localFilePath: data.localFilePath,
                text: cleanedScript,
                duration: data.duration,
                scriptId: script.imageId, // Use imageId as scriptId for mapping
                imageId: script.imageId,
                imageName: script.imageName,
                retriesUsed: data.retriesUsed || false
              }
              
              // Store script duration info
              scriptDurations[index] = {
                scriptId: script.imageId,
                imageId: script.imageId,
                imageName: script.imageName,
                duration: data.duration,
                startTime: 0, // Will be calculated after sorting
                text: cleanedScript
              }
              
              // Update progress
              dispatch(setAudioProgress({ 
                completed: index + 1 
              }))

              const retryIndicator = data.retriesUsed ? ' (with retries)' : ''
              console.log(`✅ Completed script ${index + 1}/${generatedScripts.length} (${data.duration.toFixed(2)}s)${retryIndicator}: ${script.imageName}`)
              resolve(result)
              
            } catch (error: any) {
              console.error(`❌ Failed to generate script ${index + 1} after all attempts:`, error)
              reject(error)
            }
          }, index * 1000) // Stagger requests by 1 second each
        })
      })

      const completedChunks = await Promise.all(scriptPromises)
      console.log(`✅ All ${completedChunks.length} script audio chunks generated (with retry protection)`)

      // Calculate start times for each script (cumulative durations)
      let currentStartTime = 0
      scriptDurations.forEach((scriptDuration, index) => {
        scriptDuration.startTime = currentStartTime
        currentStartTime += scriptDuration.duration
      })

      console.log('📊 Script duration breakdown:')
      scriptDurations.forEach((sd, i) => {
        console.log(`  Script ${i + 1} (${sd.imageName}): ${sd.duration.toFixed(2)}s (starts at ${sd.startTime.toFixed(2)}s)`)
      })

      // Concatenate chunks
      dispatch(setAudioProgress({ total: 1, completed: 0, phase: 'concatenating' }))
      
      const concatenationResponse = await fetch('/api/concatenate-audio-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioChunks: completedChunks,
          userId: 'current_user',
          generateSubtitles: false, // We'll handle subtitles separately
          sessionId: sessionId // Pass session ID for cleanup
        })
      })

      if (!concatenationResponse.ok) {
        throw new Error('Failed to concatenate audio chunks')
      }

      const concatenationData = await concatenationResponse.json()
      
      // Complete audio generation with script durations
      dispatch(completeAudioGeneration({
        audioUrl: concatenationData.finalAudioUrl,
        duration: concatenationData.finalDuration,
        scriptDurations: scriptDurations.map(sd => ({
          scriptId: sd.scriptId,
          imageId: sd.imageId,
          imageName: sd.imageName,
          duration: sd.duration,
          startTime: sd.startTime
        }))
      }))

      showMessage(`Successfully generated audio from ${generatedScripts.length} scripts with automatic retry protection!`, 'success')

      // Generate subtitles if requested
      if (generateSubtitles) {
        await handleGenerateSubtitles(concatenationData.finalAudioUrl)
      } else {
        // Save to history if no subtitles needed
        dispatch(saveGenerationToHistory())
      }

    } catch (error: any) {
      console.error('Audio generation error:', error)
      dispatch(setAudioGenerationError(error.message))
      
      // Provide more helpful error messages
      let errorMessage = error.message
      if (errorMessage.includes('No valid WellSaid Labs API keys available')) {
        errorMessage = 'No valid API keys available. Please ask an admin to upload new WellSaid Labs API keys.'
      } else if (errorMessage.includes('Failed to generate audio for script')) {
        errorMessage = `Audio generation failed: ${errorMessage}. The system attempted automatic retries but was unable to recover.`
      }
      
      showMessage(`Audio generation failed: ${errorMessage}`, 'error')
    }
  }

  // Generate subtitles for the current audio
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
      
      // Add subtitles to current generation
      dispatch(addSubtitlesToGeneration({
        subtitlesUrl: data.subtitlesUrl
      }))

      // Save to history now that everything is complete
      dispatch(saveGenerationToHistory())
      
      showMessage('Subtitles generated successfully!', 'success')

    } catch (error: any) {
      console.error('Subtitle generation error:', error)
      showMessage(`Subtitle generation failed: ${error.message}`, 'error')
      dispatch(setIsGeneratingSubtitles(false))
    }
  }

  // Download generated audio
  const handleDownloadAudio = (audioUrl: string, filename: string = 'script-audio.mp3') => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download subtitles
  const handleDownloadSubtitles = (subtitlesUrl: string, filename: string = 'subtitles.srt') => {
    const link = document.createElement('a')
    link.href = subtitlesUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const audioProgressPercentage = audioProgress.total > 0 ? Math.round((audioProgress.completed / audioProgress.total) * 100) : 0

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Generate high-quality audio from your scripts using WellSaid Labs AI voices
        </p>
      </div>

      {/* Scripts Summary */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Scripts Ready for Audio Generation
          </CardTitle>
          <CardDescription>
            {generatedScripts.length} scripts available • Combined length: {generatedScripts.reduce((total, script) => total + script.script.length, 0)} characters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedScripts.length > 0 ? (
            <div className="space-y-3">
              {generatedScripts.map((script, index) => (
                <div key={script.imageId} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-700">
                      {index + 1}. {script.imageName}
                    </span>
                    <Badge variant="outline">
                      {script.script.length} chars
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {script.script.replace(/\[Generated using mock data[^\]]*\]/g, '').trim()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No scripts available for audio generation</p>
              <p className="text-sm">Go to Script Generator to create scripts first</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audio Generation Settings */}
      {generatedScripts.length > 0 && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Audio Generation Settings
            </CardTitle>
            <CardDescription>
              Configure voice, model, and subtitle options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice and Model Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Voice Speaker</Label>
                <Select 
                  value={selectedVoice.toString()} 
                  onValueChange={(value: string) => dispatch(setSelectedVoice(Number(value)))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wellSaidVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id.toString()}>
                        {voice.name} ({voice.accent})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select 
                  value={selectedModel} 
                  onValueChange={(value: string) => dispatch(setSelectedModel(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wellSaidModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Options</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subtitles"
                    checked={generateSubtitles}
                    onCheckedChange={(checked) => dispatch(setGenerateSubtitles(checked as boolean))}
                  />
                  <Label htmlFor="subtitles" className="text-sm">Generate subtitles</Label>
                </div>
              </div>
            </div>

            {/* Audio Progress */}
            {(isGeneratingAudio || isGeneratingSubtitles) && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>
                    {audioProgress.phase === 'chunks' && 'Generating Audio Chunks'}
                    {audioProgress.phase === 'concatenating' && 'Concatenating Audio'}
                    {audioProgress.phase === 'subtitles' && 'Generating Subtitles'}
                    {audioProgress.phase === 'completed' && 'Completed'}
                  </span>
                  <span>{audioProgress.phase === 'subtitles' ? 'Processing...' : `${audioProgressPercentage}%`}</span>
                </div>
                <Progress value={audioProgress.phase === 'subtitles' ? 100 : audioProgressPercentage} className="h-2" />
                <div className="text-xs text-gray-500">
                  {audioProgress.phase === 'chunks' && `${audioProgress.completed}/${audioProgress.total} chunks processed`}
                  {audioProgress.phase === 'concatenating' && 'Combining audio files...'}
                  {audioProgress.phase === 'subtitles' && 'Generating subtitles with OpenAI Whisper...'}
                  {audioProgress.phase === 'completed' && 'Audio generation complete!'}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio || isGeneratingSubtitles || generatedScripts.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isGeneratingAudio ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Audio...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Generate Audio from {generatedScripts.length} Scripts
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Generation */}
      {currentGeneration && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Current Generation
            </CardTitle>
            <CardDescription>
              Generated on {new Date(currentGeneration.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generation Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Voice:</span>
                <p className="font-medium">
                  {wellSaidVoices.find(v => v.id === currentGeneration.voice)?.name || 'Unknown'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Model:</span>
                <p className="font-medium">{currentGeneration.model}</p>
              </div>
              <div>
                <span className="text-gray-500">Duration:</span>
                <p className="font-medium">
                  {currentGeneration.duration ? `${currentGeneration.duration.toFixed(1)}s` : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <Badge 
                  variant={currentGeneration.status === 'completed' ? 'default' : 'secondary'}
                  className={currentGeneration.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                >
                  {currentGeneration.status}
                </Badge>
              </div>
            </div>

            {/* Audio Player */}
            {currentGeneration.audioUrl && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Audio Generated Successfully!</span>
                </div>
                <audio controls className="w-full mb-3">
                  <source src={currentGeneration.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownloadAudio(currentGeneration.audioUrl!, `audio-${currentGeneration.id}.mp3`)}
                    size="sm"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Audio
                  </Button>
                  
                  {/* Generate Subtitles Button */}
                  {!currentGeneration.subtitlesUrl && currentGeneration.status === 'completed' && (
                    <Button
                      onClick={() => handleGenerateSubtitles()}
                      disabled={isGeneratingSubtitles}
                      size="sm"
                      variant="outline"
                    >
                      {isGeneratingSubtitles ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Subtitles className="h-4 w-4 mr-2" />
                          Generate Subtitles
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Subtitles */}
            {currentGeneration.subtitlesUrl && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Subtitles className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Subtitles Generated!</span>
                </div>
                <Button
                  onClick={() => handleDownloadSubtitles(currentGeneration.subtitlesUrl!, `subtitles-${currentGeneration.id}.srt`)}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Subtitles
                </Button>
              </div>
            )}

            {/* Error */}
            {currentGeneration.status === 'error' && currentGeneration.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Generation Error:</span>
                </div>
                <p className="text-red-700 mt-1">{currentGeneration.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generation History */}
      {generationHistory.length > 0 && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Generation History
            </CardTitle>
            <CardDescription>
              Previous audio generations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generationHistory.map((generation) => (
                <div key={generation.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {new Date(generation.generatedAt).toLocaleString()}
                    </span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {wellSaidVoices.find(v => v.id === generation.voice)?.name}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {generation.duration ? `${generation.duration.toFixed(1)}s` : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {generation.audioUrl && (
                      <Button
                        onClick={() => handleDownloadAudio(generation.audioUrl!, `audio-${generation.id}.mp3`)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Audio
                      </Button>
                    )}
                    {generation.subtitlesUrl && (
                      <Button
                        onClick={() => handleDownloadSubtitles(generation.subtitlesUrl!, `subtitles-${generation.id}.srt`)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Subtitles
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {messageType === 'info' && <Volume2 className="h-4 w-4 text-blue-600" />}
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