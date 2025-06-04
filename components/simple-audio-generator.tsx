'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Volume2, Play, Pause, Loader2, AlertCircle, CheckCircle, FileText, Clock } from 'lucide-react'
import { Progress } from './ui/progress'
import {
  setSelectedProvider,
  setMinimaxVoice,
  setMinimaxModel,
  setElevenLabsVoice,
  setElevenLabsModel,
  setElevenLabsLanguage,
  setTextToConvert,
  startGeneration,
  completeGeneration,
  failGeneration,
  clearError,
  clearAudio,
  type AudioProvider
} from '../lib/features/audio/simpleAudioSlice'

// Voice options for MiniMax
const minimaxVoices = [
  { value: 'English_radiant_girl', label: 'Radiant Girl' },
  { value: 'English_captivating_female1', label: 'Captivating Female' },
  { value: 'English_Steady_Female_1', label: 'Steady Women' },
  { value: 'English_CaptivatingStoryteller', label: 'Captivating Storyteller' },
  { value: 'English_Deep-VoicedGentleman', label: 'Man With Deep Voice' },
  { value: 'English_magnetic_voiced_man', label: 'Magnetic-voiced Male' },
  { value: 'English_ReservedYoungMan', label: 'Reserved Young Man' },
  { value: 'English_expressive_narrator', label: 'Expressive Narrator' },
  { value: 'English_compelling_lady1', label: 'Compelling Lady' },
  { value: 'English_CalmWoman', label: 'Calm Woman' },
  { value: 'English_Graceful_Lady', label: 'Graceful Lady' },
  { value: 'English_MaturePartner', label: 'Mature Partner' },
  { value: 'English_MatureBoss', label: 'Bossy Lady' },
  { value: 'English_Wiselady', label: 'Wise Lady' },
  { value: 'English_patient_man_v1', label: 'Patient Man' },
  { value: 'English_Female_Narrator', label: 'Female Narrator' },
  { value: 'English_Trustworth_Man', label: 'Trustworthy Man' },
  { value: 'English_Gentle-voiced_man', label: 'Gentle-voiced Man' },
  { value: 'English_Upbeat_Woman', label: 'Upbeat Woman' },
  { value: 'English_Friendly_Female_3', label: 'Friendly Women' }
]

// Model options for MiniMax
const minimaxModels = [
  { value: 'speech-02-hd', label: 'Speech 02 HD' },
  { value: 'speech-02-turbo', label: 'Speech 02 Turbo' },
  { value: 'speech-01-hd', label: 'Speech 01 HD' },
  { value: 'speech-01-turbo', label: 'Speech 01 Turbo' }
]

// Voice options for ElevenLabs (common ones)
const elevenLabsVoices = [
  { value: 'Rachel', label: 'Rachel' },
  { value: 'Adam', label: 'Adam' },
  { value: 'Antoni', label: 'Antoni' },
  { value: 'Arnold', label: 'Arnold' },
  { value: 'Bella', label: 'Bella' },
  { value: 'Domi', label: 'Domi' },
  { value: 'Elli', label: 'Elli' },
  { value: 'Josh', label: 'Josh' },
  { value: 'Nicole', label: 'Nicole' },
  { value: 'Sam', label: 'Sam' }
]

// Model options for ElevenLabs
const elevenLabsModels = [
  { value: 'eleven_multilingual_v2', label: 'Multilingual V2 (29 languages)' },
  { value: 'eleven_flash_v2_5', label: 'Flash V2.5 (32 languages, low latency)' }
]

// Language options for ElevenLabs
const elevenLabsLanguages = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'de', label: 'German' },
  { value: 'hi', label: 'Hindi' },
  { value: 'fr', label: 'French' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'es', label: 'Spanish' },
  { value: 'id', label: 'Indonesian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' }
]

// Character limits based on provider
const getCharacterLimits = (provider: AudioProvider) => {
  switch (provider) {
    case 'elevenlabs':
      return { maxChars: 10000, batchSize: 5, batchDelay: 60 }
    case 'minimax':
      return { maxChars: 3000, batchSize: 5, batchDelay: 60 }
    default:
      return { maxChars: 3000, batchSize: 5, batchDelay: 60 }
  }
}

export function SimpleAudioGenerator() {
  const dispatch = useAppDispatch()
  const {
    isGenerating,
    generatedAudioUrl,
    error,
    selectedProvider,
    minimaxVoice,
    minimaxModel,
    elevenLabsVoice,
    elevenLabsModel,
    elevenLabsLanguage,
    textToConvert
  } = useAppSelector(state => state.simpleAudio)

  // Get script from Redux state
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Auto-populate with full script if available
  useEffect(() => {
    if (sectionedWorkflow.fullScript && !textToConvert) {
      dispatch(setTextToConvert(sectionedWorkflow.fullScript))
    }
  }, [sectionedWorkflow.fullScript, textToConvert, dispatch])

  // Calculate processing estimates
  const getProcessingEstimate = () => {
    if (!textToConvert) return { chunks: 0, batches: 0, estimatedMinutes: 0 }
    
    const limits = getCharacterLimits(selectedProvider)
    const chunks = Math.ceil(textToConvert.length / limits.maxChars)
    const batches = Math.ceil(chunks / limits.batchSize)
    const estimatedMinutes = Math.max(1, batches * (limits.batchDelay / 60))
    
    return { chunks, batches, estimatedMinutes }
  }

  const processingEstimate = getProcessingEstimate()

  // Get script info for display
  const getScriptInfo = () => {
    if (sectionedWorkflow.fullScript) {
      const wordCount = sectionedWorkflow.fullScript.split(/\s+/).length
      const estimatedMinutes = Math.ceil(wordCount / 150)
      return {
        hasScript: true,
        source: 'Generated Script',
        wordCount,
        estimatedMinutes,
        characters: sectionedWorkflow.fullScript.length
      }
    }
    return {
      hasScript: false,
      source: 'No script available',
      wordCount: 0,
      estimatedMinutes: 0,
      characters: 0
    }
  }

  const scriptInfo = getScriptInfo()

  // Audio event handlers
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current
      
      const handleEnded = () => setIsPlaying(false)
      const handleError = () => {
        setIsPlaying(false)
        console.error('Audio playback error')
      }
      
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('error', handleError)
      
      return () => {
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('error', handleError)
      }
    }
  }, [generatedAudioUrl])

  const handleGenerateAudio = async () => {
    if (!textToConvert.trim()) {
      dispatch(failGeneration('Please enter some text to convert to audio'))
      return
    }

    dispatch(startGeneration())
    setProcessingStatus('Initializing batch processing...')

    try {
      const requestBody = {
        text: textToConvert,
        provider: selectedProvider,
        voice: selectedProvider === 'minimax' ? minimaxVoice : elevenLabsVoice,
        model: selectedProvider === 'minimax' ? minimaxModel : elevenLabsModel,
        language: selectedProvider === 'elevenlabs' ? elevenLabsLanguage : undefined
      }

      // Update status for batch processing
      if (processingEstimate.chunks > 1) {
        setProcessingStatus(`Processing ${processingEstimate.chunks} chunks in ${processingEstimate.batches} batches...`)
        setEstimatedTime(processingEstimate.estimatedMinutes)
      } else {
        setProcessingStatus('Generating audio...')
      }

      const response = await fetch('/api/generate-simple-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate audio')
      }

      const data = await response.json()
      
      setProcessingStatus('')
      dispatch(completeGeneration(data.audioUrl))
      
      // Show success message with processing info
      if (data.chunksGenerated && data.totalChunks) {
        console.log(`✅ Successfully generated ${data.chunksGenerated}/${data.totalChunks} chunks`)
      }
      
    } catch (error) {
      console.error('Error generating audio:', error)
      setProcessingStatus('')
      dispatch(failGeneration(
        error instanceof Error ? error.message : 'Failed to generate audio'
      ))
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current && generatedAudioUrl) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(e => console.error('Error playing audio:', e))
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleClearError = () => {
    dispatch(clearError())
  }

  const handleClearAudio = () => {
    dispatch(clearAudio())
    setIsPlaying(false)
    setProcessingStatus('')
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const getProviderInfo = () => {
    const limits = getCharacterLimits(selectedProvider)
    return selectedProvider === 'minimax' 
      ? { name: 'MiniMax', desc: `Fast, reliable AI audio (${limits.maxChars} chars/chunk, ${limits.batchSize} chunks/batch)` }
      : { name: 'ElevenLabs', desc: `High-quality AI voices (${limits.maxChars} chars/chunk, ${limits.batchSize} chunks/batch)` }
  }

  const providerInfo = getProviderInfo()

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Convert text to speech using MiniMax or ElevenLabs AI models with automatic batching and concatenation
        </p>
      </div>

      {/* Script Info */}
      {scriptInfo.hasScript && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Script Available
            </CardTitle>
            <CardDescription>
              Ready to convert your generated script to audio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{scriptInfo.wordCount.toLocaleString()}</div>
                <div className="text-sm text-green-700">Words</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{scriptInfo.characters.toLocaleString()}</div>
                <div className="text-sm text-blue-700">Characters</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">~{scriptInfo.estimatedMinutes}</div>
                <div className="text-sm text-purple-700">Est. Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{scriptInfo.source}</div>
                <div className="text-sm text-orange-700">Source</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Estimate */}
      {textToConvert && processingEstimate.chunks > 1 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Batch Processing Estimate
            </CardTitle>
            <CardDescription>
              Text will be processed in batches due to length
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{processingEstimate.chunks}</div>
                <div className="text-sm text-blue-700">Chunks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{processingEstimate.batches}</div>
                <div className="text-sm text-purple-700">Batches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">~{processingEstimate.estimatedMinutes}</div>
                <div className="text-sm text-orange-700">Est. Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{providerInfo.name}</div>
                <div className="text-sm text-green-700">Provider</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Script Available Info */}
      {!scriptInfo.hasScript && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              No Script Available
            </CardTitle>
            <CardDescription>
              Generate a script first for automatic integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-yellow-800">
                  Visit the <strong>Script Generator</strong> to create a script, then return here to convert it to audio.
                </p>
                <p className="text-xs text-yellow-700">
                  Or manually enter text below to generate audio directly.
                </p>
              </div>
              <FileText className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider Selection */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-purple-600" />
            Audio Provider
          </CardTitle>
          <CardDescription>
            Choose between MiniMax for speed or ElevenLabs for quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['minimax', 'elevenlabs'] as AudioProvider[]).map((provider) => (
              <div
                key={provider}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedProvider === provider
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => dispatch(setSelectedProvider(provider))}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 capitalize">{provider}</h3>
                    {selectedProvider === provider && (
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {provider === 'minimax' 
                      ? 'Fast, reliable AI audio (3000 chars/chunk)'
                      : 'High-quality AI voices (10000 chars/chunk)'
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{providerInfo.name} Settings</CardTitle>
          <CardDescription>{providerInfo.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedProvider === 'minimax' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimax-voice">Voice</Label>
                <Select
                  value={minimaxVoice}
                  onValueChange={(value) => dispatch(setMinimaxVoice(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="minimax-voice">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {minimaxVoices.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="minimax-model">Model</Label>
                <Select
                  value={minimaxModel}
                  onValueChange={(value) => dispatch(setMinimaxModel(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="minimax-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {minimaxModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="elevenlabs-voice">Voice</Label>
                <Select
                  value={elevenLabsVoice}
                  onValueChange={(value) => dispatch(setElevenLabsVoice(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="elevenlabs-voice">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsVoices.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="elevenlabs-model">Model</Label>
                <Select
                  value={elevenLabsModel}
                  onValueChange={(value) => dispatch(setElevenLabsModel(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="elevenlabs-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="elevenlabs-language">Language</Label>
                <Select
                  value={elevenLabsLanguage}
                  onValueChange={(value) => dispatch(setElevenLabsLanguage(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="elevenlabs-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsLanguages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Text Input */}
      <Card>
        <CardHeader>
          <CardTitle>Text to Convert</CardTitle>
          <CardDescription>
            Enter the text you want to convert to speech
            {scriptInfo.hasScript && (
              <span className="text-blue-600"> (Auto-populated from generated script)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Enter your text here..."
              value={textToConvert}
              onChange={(e) => dispatch(setTextToConvert(e.target.value))}
              disabled={isGenerating}
              className="min-h-[120px]"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{textToConvert.length} characters</span>
              {scriptInfo.hasScript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch(setTextToConvert(sectionedWorkflow.fullScript || ''))}
                  disabled={isGenerating}
                >
                  Use Full Script
                </Button>
              )}
            </div>
          </div>

          {/* Processing Status */}
          {isGenerating && processingStatus && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {processingStatus}
                </span>
                {estimatedTime > 0 && (
                  <span className="text-muted-foreground">
                    ~{estimatedTime} min
                  </span>
                )}
              </div>
              <Progress value={100} className="w-full animate-pulse" />
            </div>
          )}

          <Button 
            onClick={handleGenerateAudio}
            disabled={isGenerating || !textToConvert.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {processingStatus || 'Generating Audio...'}
              </>
            ) : (
              <>
                <Volume2 className="h-5 w-5 mr-2" />
                Generate Audio with {providerInfo.name}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearError}>
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audio Player */}
      {generatedAudioUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Audio Generated Successfully
            </CardTitle>
            <CardDescription>
              Generated with {providerInfo.name} using batch processing and automatic concatenation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hidden audio element */}
            <audio 
              ref={audioRef} 
              src={generatedAudioUrl}
              onEnded={() => setIsPlaying(false)}
            />
            
            {/* Custom controls */}
            <div className="flex items-center gap-4">
              <Button
                onClick={handlePlayPause}
                variant="outline"
                size="lg"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Play
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleClearAudio}
                variant="outline"
                size="lg"
              >
                Clear Audio
              </Button>
            </div>

            {/* Built-in browser audio controls for full functionality */}
            <audio 
              controls 
              src={generatedAudioUrl}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generatedAudioUrl && !isGenerating && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Volume2 className="h-12 w-12 mx-auto text-gray-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">Ready to Generate Audio</h3>
                <p className="text-gray-500">
                  Choose your provider, configure settings, and enter text to generate speech with automatic batch processing and concatenation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 