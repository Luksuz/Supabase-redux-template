'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSelectedVoice, 
  setSelectedModel, 
  setGenerateSubtitles,
  setAudioProgress,
  startAudioGeneration,
  completeAudioGeneration,
  addSubtitlesToGeneration,
  updateSubtitleContent,
  setAudioGenerationError,
  saveGenerationToHistory,
  setIsGeneratingSubtitles
} from '../lib/features/audio/audioSlice'
import { VoiceManager } from './voice-manager'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Volume2, Download, PlayCircle, CheckCircle, AlertCircle, Loader2, FileText, Subtitles, ChevronDown, ChevronUp } from 'lucide-react'

// TTS Provider configurations with proper typing
interface TTSProvider {
  name: string
  voices: { id: string; name: string }[]
  models?: { id: string; name: string }[]
  languages?: { code: string; name: string }[]
}

const TTS_PROVIDERS: Record<string, TTSProvider> = {
  openai: {
    name: "OpenAI TTS",
    voices: [
      { id: "alloy", name: "Alloy" },
      { id: "echo", name: "Echo" },
      { id: "fable", name: "Fable" },
      { id: "onyx", name: "Onyx" },
      { id: "nova", name: "Nova" },
      { id: "shimmer", name: "Shimmer" },
      { id: "ash", name: "Ash" },
      { id: "ballad", name: "Ballad" },
      { id: "coral", name: "Coral" },
      { id: "sage", name: "Sage" }
    ],
    models: [
      { id: "tts-1", name: "TTS-1 (Standard)" },
      { id: "tts-1-hd", name: "TTS-1 HD (High Quality)" }
    ]
  },
  minimax: {
    name: "MiniMax",
    voices: [
      // Prioritized Female
      { id: "English_radiant_girl", name: "Radiant Girl" },
      { id: "English_captivating_female1", name: "Captivating Female" },
      { id: "English_Steady_Female_1", name: "Steady Women" },
      // Prioritized Male
      { id: "English_CaptivatingStoryteller", name: "Captivating Storyteller" },
      { id: "English_Deep-VoicedGentleman", name: "Man With Deep Voice" },
      { id: "English_magnetic_voiced_man", name: "Magnetic-voiced Male" },
      { id: "English_ReservedYoungMan", name: "Reserved Young Man" },
      // Remaining voices
      { id: "English_expressive_narrator", name: "Expressive Narrator" },
      { id: "English_compelling_lady1", name: "Compelling Lady" },
      { id: "English_CalmWoman", name: "Calm Woman" },
      { id: "English_Graceful_Lady", name: "Graceful Lady" },
      { id: "English_MaturePartner", name: "Mature Partner" },
      { id: "English_MatureBoss", name: "Bossy Lady" },
      { id: "English_Wiselady", name: "Wise Lady" },
      { id: "English_patient_man_v1", name: "Patient Man" },
      { id: "English_Female_Narrator", name: "Female Narrator" },
      { id: "English_Trustworth_Man", name: "Trustworthy Man" },
      { id: "English_Gentle-voiced_man", name: "Gentle-voiced Man" },
      { id: "English_Upbeat_Woman", name: "Upbeat Woman" },
      { id: "English_Friendly_Female_3", name: "Friendly Women" }
    ],
    models: [
      { id: "speech-02-hd", name: "Speech 02 HD" },
      { id: "speech-02-turbo", name: "Speech 02 Turbo" },
      { id: "speech-01-hd", name: "Speech 01 HD" },
      { id: "speech-01-turbo", name: "Speech 01 Turbo" }
    ]
  },
  "fish-audio": {
    name: "Fish Audio",
    voices: [
      { id: "058e3e7df4c94303a7ce22576fc81ec8", name: "Lisa: English Woman (US) - Advertisement" },
      { id: "ecc977e5dca94390926fab1e0c2ba292", name: "Katie: English Woman (US) - Training" },
      { id: "125d6460953a443d8c65909adf87ca3f", name: "Neil: English Man (US) - Audiobook" }
    ],
    models: [
      { id: "speech-1.6", name: "Speech 1.6" },
      { id: "speech-1.5", name: "Speech 1.5" }
    ]
  },
  elevenlabs: {
    name: "ElevenLabs",
    voices: [
      // Voices will be loaded from API
    ],
    models: [
      { id: "eleven_multilingual_v2", name: "Multilingual V2" },
      { id: "eleven_flash_v2_5", name: "Flash V2.5 (Fastest)" },
      { id: "eleven_turbo_v2_5", name: "Turbo V2.5" }
    ],
    languages: [
      { code: "en", name: "English" },
      { code: "es", name: "Spanish" },
      { code: "fr", name: "French" },
      { code: "de", name: "German" },
      { code: "it", name: "Italian" },
      { code: "pt", name: "Portuguese" },
      { code: "pl", name: "Polish" },
      { code: "tr", name: "Turkish" },
      { code: "ru", name: "Russian" },
      { code: "nl", name: "Dutch" },
      { code: "cs", name: "Czech" },
      { code: "ar", name: "Arabic" },
      { code: "zh", name: "Chinese" },
      { code: "ja", name: "Japanese" },
      { code: "hu", name: "Hungarian" },
      { code: "ko", name: "Korean" }
    ]
  },
  "google-tts": {
    name: "Google Cloud TTS",
    voices: [
      // Voices will be loaded from API
    ],
    languages: [
      { code: "en-US", name: "English (US)" },
      { code: "en-GB", name: "English (UK)" },
      { code: "es-ES", name: "Spanish (Spain)" },
      { code: "es-US", name: "Spanish (US)" },
      { code: "fr-FR", name: "French (France)" },
      { code: "de-DE", name: "German (Germany)" },
      { code: "it-IT", name: "Italian (Italy)" },
      { code: "pt-BR", name: "Portuguese (Brazil)" },
      { code: "ru-RU", name: "Russian (Russia)" },
      { code: "ja-JP", name: "Japanese (Japan)" },
      { code: "ko-KR", name: "Korean (Korea)" },
      { code: "zh-CN", name: "Chinese (Mandarin)" }
    ]
  }
}

export function AudioGenerator() {
  const dispatch = useAppDispatch()
  const { scripts, hasGeneratedScripts, fullScript, hasFullScript } = useAppSelector(state => state.scripts)
  const { 
    currentGeneration, 
    generationHistory,
    isGeneratingAudio,
    isGeneratingSubtitles,
    audioProgress,
    selectedVoice,
    selectedModel,
    generateSubtitles,
    customVoices
  } = useAppSelector(state => state.audio)
  
  // Provider-specific state
  const [selectedProvider, setSelectedProvider] = useState<string>("openai")
  const [providerVoice, setProviderVoice] = useState<string>("")
  const [providerModel, setProviderModel] = useState<string>("")
  const [languageCode, setLanguageCode] = useState<string>("en")
  const [customText, setCustomText] = useState<string>("")
  const [useCustomText, setUseCustomText] = useState<boolean>(false)
  const [apiVoices, setApiVoices] = useState<any[]>([])
  const [isLoadingApiVoices, setIsLoadingApiVoices] = useState<boolean>(false)
  
  // Voice Manager state
  const [showVoiceManager, setShowVoiceManager] = useState<boolean>(false)
  
  // Message state for user feedback
  const [message, setMessage] = useState<string>("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    // Auto-clear success and info messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => setMessage(""), 5000)
    }
  }

  // Clear error messages when user interacts with voice management
  useEffect(() => {
    if (message && messageType === 'error') {
      const timer = setTimeout(() => setMessage(""), 10000) // Clear errors after 10 seconds
      return () => clearTimeout(timer)
    }
  }, [message, messageType])

  // Load API voices on component mount if using ElevenLabs or Google TTS
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'google-tts') {
      fetchApiVoices(selectedProvider)
    }
  }, []) // Only run on mount

  // Initialize language code properly for each provider
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' && languageCode !== 'en') {
      setLanguageCode('en')
    } else if (selectedProvider === 'google-tts' && languageCode !== 'en-US') {
      setLanguageCode('en-US')
    }
  }, [selectedProvider])

  // Handle custom voice selection from voice manager
  const handleCustomVoiceSelect = (voiceId: string, voiceName: string) => {
    setProviderVoice(voiceId)
    showMessage(`Selected custom voice: ${voiceName}`, 'success')
  }

  // Get voice options based on provider
  const getVoiceOptions = () => {
    // For ElevenLabs and Google TTS, use API-fetched voices
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'google-tts') {
      const customVoicesForProvider = customVoices.filter(v => v.provider === selectedProvider)
      
      // Map API voices to consistent format
      const mappedApiVoices = apiVoices.map((v, index) => {
        if (selectedProvider === 'google-tts') {
          // Google TTS voices have 'name' property, map it to 'id'
          return {
            id: v.name,
            name: `${v.name} (${v.ssmlGender})`,
            key: `api-${v.name || `unknown-${index}`}`,
            isCustom: false
          }
        } else {
          // ElevenLabs voices (already have proper structure)
          return {
            ...v,
            key: `api-${v.id || `unknown-${index}`}`,
            isCustom: false
          }
        }
      })
      
      return [
        ...mappedApiVoices,
        ...customVoicesForProvider.map((v, index) => ({
          id: v.voice_id,
          name: `${v.name} (Custom)`,
          key: `custom-${v.id}-${index}`,
          isCustom: true
        }))
      ]
    }
    
    // For other providers, use built-in + custom voices
    const builtInVoices = TTS_PROVIDERS[selectedProvider]?.voices || []
    const customVoicesForProvider = customVoices.filter(v => v.provider === selectedProvider)
    
    return [
      ...builtInVoices.map((v, index) => ({
        ...v,
        key: `builtin-${v.id || `unknown-${index}`}`,
        isCustom: false
      })),
      ...customVoicesForProvider.map((v, index) => ({
        id: v.voice_id,
        name: `${v.name} (Custom)`,
        key: `custom-${v.id}-${index}`,
        isCustom: true
      }))
    ]
  }

  // Fetch voices from API for ElevenLabs and Google TTS
  const fetchApiVoices = async (provider: string) => {
    if (provider !== 'elevenlabs' && provider !== 'google-tts') {
      setApiVoices([])
      return
    }

    try {
      setIsLoadingApiVoices(true)
      
      const endpoint = provider === 'elevenlabs' 
        ? '/api/list-elevenlabs-voices'
        : '/api/list-google-voices'

      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to load ${provider} voices`)
      }

      const voices = data.voices || []
      setApiVoices(voices)
      
      // Set first voice as default if no voice is selected
      if (voices.length > 0 && !providerVoice) {
        if (provider === 'google-tts') {
          // For Google TTS, use the 'name' property
          setProviderVoice(voices[0].name)
                } else {
          // For ElevenLabs, use the 'id' property
          setProviderVoice(voices[0].id)
        }
      }

      // Ensure language code is set for the provider
      if (provider === 'elevenlabs' && !languageCode) {
        setLanguageCode('en')
      } else if (provider === 'google-tts' && !languageCode) {
        setLanguageCode('en-US')
      }
      
    } catch (error: any) {
      console.error(`Error loading ${provider} voices:`, error)
      showMessage(`Failed to load ${provider} voices: ${error.message}`, 'error')
      setApiVoices([])
    } finally {
      setIsLoadingApiVoices(false)
    }
  }

  // Determine what content we're working with
  const availableContent = hasFullScript ? 'new-script' : (hasGeneratedScripts ? 'image-scripts' : 'sample')
  
  // Get content for display and processing
  const getContentSummary = () => {
    if (hasFullScript && fullScript) {
      const wordCount = fullScript.scriptCleaned.split(/\s+/).filter(word => word.length > 0).length
      return {
        type: 'Full Script',
        count: 1,
        length: fullScript.scriptCleaned.length,
        wordCount: wordCount,
        content: fullScript.title,
        textToProcess: fullScript.scriptCleaned
      }
    } else if (hasGeneratedScripts && scripts.length > 0) {
      const combinedText = scripts.map(s => s.script.replace(/<[^>]*>/g, '')).join(' ')
      const wordCount = combinedText.split(/\s+/).filter(word => word.length > 0).length
      return {
        type: 'Image Scripts',
        count: scripts.filter(s => s.generated).length,
        length: combinedText.length,
        wordCount: wordCount,
        content: `${scripts.filter(s => s.generated).length} generated scripts`,
        textToProcess: combinedText
      }
    } else {
      // Sample content for demonstration
      const sampleText = "Welcome to our content generation platform. This is a sample script to demonstrate the audio generation capabilities."
      return {
        type: 'Sample Content',
        count: 1,
        length: sampleText.length,
        wordCount: sampleText.split(/\s+/).length,
        content: 'Sample demonstration script',
        textToProcess: sampleText
      }
    }
  }
  
  const contentSummary = getContentSummary()

  // Initialize provider-specific defaults
  useState(() => {
    if (selectedProvider && TTS_PROVIDERS[selectedProvider]) {
      const provider = TTS_PROVIDERS[selectedProvider]
      if (!providerVoice && provider.voices?.length > 0) {
        setProviderVoice(provider.voices[0].id)
      }
      if (!providerModel && provider.models && provider.models.length > 0) {
        setProviderModel(provider.models[0].id)
      }
    }
  })

  // Update defaults when provider changes
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider)
    setProviderVoice("") // Reset voice selection
    
    const provider = TTS_PROVIDERS[newProvider]
    
    // For ElevenLabs and Google TTS, fetch voices from API
    if (newProvider === 'elevenlabs' || newProvider === 'google-tts') {
      fetchApiVoices(newProvider)
      } else {
      // For other providers, set default voice from built-in list
      if (provider.voices?.length > 0) {
        setProviderVoice(provider.voices[0].id)
      }
      setApiVoices([]) // Clear API voices
    }
    
    // Set default model
    if (provider.models && provider.models.length > 0) {
      setProviderModel(provider.models[0].id)
    }
    
    // Set appropriate language code for providers that support it
    if (newProvider === 'elevenlabs') {
      setLanguageCode('en') // ElevenLabs uses simple codes
    } else if (newProvider === 'google-tts') {
      setLanguageCode('en-US') // Google TTS uses locale codes
    }
  }

  // Generate audio using the comprehensive backend API
  const handleGenerateAudio = async () => {
    if (availableContent === 'sample' && !contentSummary) {
      showMessage('No scripts available for audio generation', 'error')
      return
    }

    if (!providerVoice) {
      showMessage('Please select a voice', 'error')
      return
    }

    const generationId = `audio_${Date.now()}`
    
    try {
      // Start audio generation
      dispatch(startAudioGeneration({
        id: generationId,
        voice: selectedVoice, // Keep for Redux compatibility
        model: selectedModel, // Keep for Redux compatibility  
        generateSubtitles: false // Subtitles are generated automatically by the backend
      }))

      console.log(`🎵 Starting audio generation with ${selectedProvider}`)
      console.log(`📝 Text length: ${contentSummary.textToProcess.length} characters`)

      // Prepare provider-specific parameters
      const requestBody: any = {
        text: contentSummary.textToProcess,
        provider: selectedProvider,
        userId: 'current_user'
              }
              
      // Add provider-specific parameters
      switch (selectedProvider) {
        case 'openai':
          requestBody.voice = providerVoice
          requestBody.model = providerModel
          break
        case 'minimax':
          requestBody.voice = providerVoice
          requestBody.model = providerModel
          break
        case 'fish-audio':
          requestBody.fishAudioVoiceId = providerVoice === 'custom' ? customText : providerVoice
          requestBody.fishAudioModel = providerModel
          break
        case 'elevenlabs':
          requestBody.elevenLabsVoiceId = providerVoice
          requestBody.elevenLabsModelId = providerModel
          if (languageCode && providerModel === 'eleven_flash_v2_5') {
            requestBody.languageCode = languageCode
          }
          break
        case 'google-tts':
          requestBody.googleTtsVoiceName = providerVoice
          requestBody.googleTtsLanguageCode = languageCode
          requestBody.languageCode = languageCode
          break
      }

      console.log(`🔧 Request parameters:`, { ...requestBody, text: `${requestBody.text.substring(0, 100)}...` })

      // Make API call to comprehensive audio generation endpoint
      const response = await fetch('/api/generate-audio-comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Audio generation failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success || !data.audioUrl) {
        throw new Error(data.error || 'Audio generation failed')
      }

      // Complete audio generation
      dispatch(completeAudioGeneration({
        audioUrl: data.audioUrl,
        compressedAudioUrl: data.compressedAudioUrl,
        duration: data.duration || 0
      }))

      // Handle subtitles if they were generated
      if (data.subtitlesUrl) {
      dispatch(addSubtitlesToGeneration({
        subtitlesUrl: data.subtitlesUrl
      }))
      }

      // Save to history
      dispatch(saveGenerationToHistory())
      
      const subtitleMessage = data.subtitlesGenerated ? ' (with subtitles)' : ''
      showMessage(`Successfully generated audio using ${TTS_PROVIDERS[selectedProvider as keyof typeof TTS_PROVIDERS].name}${subtitleMessage}!`, 'success')

    } catch (error: any) {
      console.error('Audio generation error:', error)
      dispatch(setAudioGenerationError(error.message))
      showMessage(`Audio generation failed: ${error.message}`, 'error')
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

  // Fetch subtitle content for display
  const fetchSubtitleContent = async (subtitlesUrl: string) => {
    try {
      const response = await fetch(subtitlesUrl)
      if (response.ok) {
        const content = await response.text()
        dispatch(updateSubtitleContent({ subtitlesContent: content }))
        return content
      }
    } catch (error) {
      console.error('Error fetching subtitle content:', error)
    }
    return null
  }

  const currentProvider = TTS_PROVIDERS[selectedProvider]

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Generate high-quality audio from your scripts using multiple AI TTS providers
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
            {contentSummary ? 
              `${contentSummary.type} available • ${contentSummary.wordCount} words • ${contentSummary.length} characters` :
              'No content available'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contentSummary ? (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-700">
                    {contentSummary.type}
                    </span>
                    <Badge variant="outline">
                    {contentSummary.wordCount} words
                    </Badge>
                  </div>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {contentSummary.content.substring(0, 200)}...
                  </p>
                </div>
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
      {contentSummary && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Audio Generation Settings
            </CardTitle>
            <CardDescription>
              Configure TTS provider, voice, and model options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
              <div className="space-y-2">
              <Label>TTS Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                  {Object.entries(TTS_PROVIDERS).map(([key, provider]) => (
                    <SelectItem key={key} value={key}>
                      {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* Provider-specific settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Voice Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Voice</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVoiceManager(!showVoiceManager)}
                    className="text-xs h-6 px-2"
                  >
                    {showVoiceManager ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide Custom
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Manage Custom
                      </>
                    )}
                  </Button>
                </div>
                <Select value={providerVoice} onValueChange={setProviderVoice}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoadingApiVoices ? "Loading voices..." : "Select voice"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingApiVoices ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading voices...
                      </div>
                    ) : getVoiceOptions().length > 0 ? (
                      getVoiceOptions().map((voice) => (
                        <SelectItem key={voice.key} value={voice.id}>
                          {voice.name}
                      </SelectItem>
                      ))
                    ) : (
                      <div className="flex items-center justify-center py-2 text-sm text-gray-500">
                        No voices available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {(selectedProvider === 'elevenlabs' || selectedProvider === 'google-tts') && (
                  <p className="text-xs text-gray-500">
                    Voices loaded from {selectedProvider === 'elevenlabs' ? 'ElevenLabs' : 'Google Cloud TTS'} API
                  </p>
                )}
              </div>

              {/* Model Selection */}
              {currentProvider?.models && currentProvider.models.length > 0 && (
              <div className="space-y-2">
                <Label>Model</Label>
                  <Select value={providerModel} onValueChange={setProviderModel}>
                  <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                      {currentProvider.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* Language Selection for ElevenLabs and Google TTS */}
              {(selectedProvider === 'elevenlabs' || selectedProvider === 'google-tts') && currentProvider.languages && (
              <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={languageCode} onValueChange={setLanguageCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProvider.languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              </div>

            {/* Voice Manager */}
            {showVoiceManager && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <VoiceManager
                  selectedProvider={selectedProvider}
                  onVoiceSelect={handleCustomVoiceSelect}
                />
            </div>
            )}

            {/* Custom Fish Audio Voice ID */}
            {selectedProvider === 'fish-audio' && providerVoice === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Fish Audio Voice ID</Label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Enter Fish Audio voice ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            )}

            {/* Audio Progress */}
            {isGeneratingAudio && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Generating Audio with {currentProvider?.name}</span>
                  <span>Processing...</span>
                </div>
                <Progress value={100} className="h-2" />
                <div className="text-xs text-gray-500">
                  Using chunking and retry mechanism for optimal quality
                </div>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div className={`p-3 rounded-lg border ${
                messageType === 'success' ? 'border-green-200 bg-green-50' :
                messageType === 'error' ? 'border-red-200 bg-red-50' :
                'border-blue-200 bg-blue-50'
              }`}>
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
              </div>
            )}

            {/* Debug Information for Google TTS */}
            {selectedProvider === 'google-tts' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                <div className="font-medium text-yellow-800 mb-2">Debug Info (Google TTS):</div>
                <div className="space-y-1 text-yellow-700">
                  <div>Provider Voice: {providerVoice || 'Not selected'}</div>
                  <div>Language Code: {languageCode || 'Not set'}</div>
                  <div>Is Loading Voices: {isLoadingApiVoices ? 'Yes' : 'No'}</div>
                  <div>API Voices Count: {apiVoices.length}</div>
                  <div>Voice Options Count: {getVoiceOptions().length}</div>
                  {apiVoices.length > 0 && (
                    <div>
                      <div>First API Voice Structure:</div>
                      <pre className="ml-2 text-xs bg-white p-1 rounded border max-h-20 overflow-y-auto">
                        {JSON.stringify(apiVoices[0], null, 2)}
                      </pre>
                    </div>
                  )}
                  {getVoiceOptions().length > 0 && (
                    <div>
                      <div>First Voice Option:</div>
                      <pre className="ml-2 text-xs bg-white p-1 rounded border max-h-20 overflow-y-auto">
                        {JSON.stringify(getVoiceOptions()[0], null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>Button Disabled Reasons:</div>
                  <ul className="ml-4 space-y-1">
                    <li>• Is Generating: {isGeneratingAudio ? 'Yes' : 'No'}</li>
                    <li>• No Voice Selected: {!providerVoice ? 'Yes' : 'No'}</li>
                    <li>• No Language Code: {!languageCode ? 'Yes' : 'No'}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerateAudio}
              disabled={
                isGeneratingAudio || 
                !providerVoice || 
                (selectedProvider === 'fish-audio' && providerVoice === 'custom' && !customText) ||
                (selectedProvider === 'google-tts' && !languageCode) ||
                (selectedProvider === 'elevenlabs' && !languageCode)
              }
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
                  Generate Audio with {currentProvider?.name}
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
                <span className="text-gray-500">Provider:</span>
                <p className="font-medium">{currentProvider?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Voice:</span>
                <p className="font-medium">{providerVoice}</p>
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
                <div className="flex gap-2 mb-3">
                <Button
                  onClick={() => handleDownloadSubtitles(currentGeneration.subtitlesUrl!, `subtitles-${currentGeneration.id}.srt`)}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Subtitles
                </Button>
                  {!currentGeneration.subtitlesContent && (
                    <Button
                      onClick={() => fetchSubtitleContent(currentGeneration.subtitlesUrl!)}
                      size="sm"
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  )}
                </div>
                {currentGeneration.subtitlesContent && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <h4 className="text-sm font-medium mb-2">Subtitle Preview:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {currentGeneration.subtitlesContent.substring(0, 500)}
                      {currentGeneration.subtitlesContent.length > 500 && '...'}
                    </pre>
                  </div>
                )}
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
              <Volume2 className="h-5 w-5" />
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
    </div>
  )
} 