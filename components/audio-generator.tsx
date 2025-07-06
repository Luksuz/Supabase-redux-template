'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSelectedVoice, 
  setSelectedModel,
  setGenerateSubtitles,
  startAudioGeneration,
  startBatch,
  completeBatch,
  checkWaitStatus,
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
import { Volume2, Download, PlayCircle, CheckCircle, AlertCircle, Loader2, FileText, Subtitles, ChevronDown, ChevronUp, Edit3, Copy } from 'lucide-react'
import { AIVoice } from '@/app/api/ai-voices/route'

// TTS Provider configurations with proper typing
interface TTSProvider {
  name: string
  voices: { id: string; name: string }[]
  models?: { id: string; name: string }[]
  languages?: { code: string; name: string }[]
}

const TTS_PROVIDERS: Record<string, TTSProvider> = {
  minimax: {
    name: "MiniMax",
    voices: [
      // Voices will be loaded from API
    ],
    models: [
      { id: "speech-02-hd", name: "HD Model - Superior rhythm & stability" },
      { id: "speech-02-turbo", name: "Turbo Model - Enhanced multilingual" },
      { id: "speech-01-hd", name: "HD V1 - Rich voices & expressive emotions" },
      { id: "speech-01-turbo", name: "Turbo V1 - Excellent performance & low latency" }
    ]
  },
  elevenlabs: {
    name: "ElevenLabs",
    voices: [
      { id: "2qfp6zPuviqeCOZIE9RZ", name: "Christina - Calming Yoga Instructor" },
      { id: "wgHvco1wiREKN0BdyVx5", name: "Drew - Deep, Soothing, Guided Meditation" }
      // Additional voices will be loaded from API
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
  }
}

const ELEVENLABS_AUDIO_CHUNK_MAX_LENGTH = 5000;
const MINIMAX_AUDIO_CHUNK_MAX_LENGTH = 2500;

export function AudioGenerator() {
  const dispatch = useAppDispatch()
  const { scripts, hasGeneratedScripts, fullScript, hasFullScript } = useAppSelector(state => state.scripts)
  const { 
    currentGeneration, 
    generationHistory,
    isGeneratingAudio,
    isGeneratingSubtitles,
    audioProgress,
    batchState,
    textToProcess,
    textChunks,
    successfulChunkUrls,
    selectedVoice,
    selectedModel,
    generateSubtitles,
    customVoices
  } = useAppSelector(state => state.audio)
  
  // Provider-specific state
  const [selectedProvider, setSelectedProvider] = useState<string>("minimax")
  const [providerVoice, setProviderVoice] = useState<string>("")
  const [providerModel, setProviderModel] = useState<string>("")
  const [languageCode, setLanguageCode] = useState<string>("en")
  const [customText, setCustomText] = useState<string>("")
  const [useCustomText, setUseCustomText] = useState<boolean>(false)
  const [apiVoices, setApiVoices] = useState<any[]>([])
  const [isLoadingApiVoices, setIsLoadingApiVoices] = useState<boolean>(false)
  
  // Custom voices from database
  const [dbVoices, setDbVoices] = useState<AIVoice[]>([])
  const [isLoadingDbVoices, setIsLoadingDbVoices] = useState<boolean>(false)
  
  // Voice Manager state
  const [showVoiceManager, setShowVoiceManager] = useState<boolean>(false)
  
  // Message state for user feedback
  const [message, setMessage] = useState<string>("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [generationStatusMessage, setGenerationStatusMessage] = useState<string>("")

  // Simple text input state
  const [inputText, setInputText] = useState<string>("")

  // Audio type selection state
  const [selectedAudioType, setSelectedAudioType] = useState<'original' | 'compressed'>('original')
  
  // Audio type selection for history items
  const [historyAudioTypes, setHistoryAudioTypes] = useState<Record<string, 'original' | 'compressed'>>({})

  // Subtitles generation option
  const [generateSubtitlesOption, setGenerateSubtitlesOption] = useState<boolean>(false)

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

  // Fetch custom voices from database
  const fetchDbVoices = async () => {
    console.log('🔍 Fetching custom voices from database...')
    setIsLoadingDbVoices(true)
    try {
      const response = await fetch('/api/ai-voices')
      if (!response.ok) {
        throw new Error('Failed to fetch custom voices')
      }
      const data = await response.json()
      console.log(`✅ Loaded ${data.voices?.length || 0} custom voices from database`, data.voices)
      setDbVoices(data.voices || [])
    } catch (error: any) {
      console.error('❌ Error fetching custom voices:', error)
      // Don't show error message for this, just log it
    } finally {
      setIsLoadingDbVoices(false)
    }
  }

  // Load API voices on component mount if using ElevenLabs or MiniMax
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'minimax') {
      fetchApiVoices(selectedProvider)
    }
  }, []) // Only run on mount

  // Load custom voices on component mount
  useEffect(() => {
    fetchDbVoices()
  }, [])

  // Auto-populate input text when full script is generated
  useEffect(() => {
    if (hasFullScript && fullScript && fullScript.scriptCleaned && !inputText.trim()) {
      setInputText(fullScript.scriptCleaned)
      showMessage('Full script automatically loaded into text input!', 'success')
    }
  }, [hasFullScript, fullScript, inputText])

  // Fetch voices when provider changes to ElevenLabs or MiniMax
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'minimax') {
      console.log(`🔄 Provider changed to ${selectedProvider}, fetching voices...`)
      fetchApiVoices(selectedProvider)
    } else {
      // Clear API voices for other providers
      setApiVoices([])
    }
    
    // Reset voice selection when provider changes
    setProviderVoice("")
  }, [selectedProvider])

  // Initialize language code properly for each provider
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' && languageCode !== 'en') {
      setLanguageCode('en')
    }
  }, [selectedProvider])

  // Handle custom voice selection from voice manager
  const handleCustomVoiceSelect = (voiceId: string, voiceName: string) => {
    setProviderVoice(voiceId)
    showMessage(`Selected custom voice: ${voiceName}`, 'success')
  }

  // Fetch API voices for providers that support it
  const fetchApiVoices = async (provider: string) => {
    console.log(`🔍 Fetching API voices for provider: ${provider}`)
    setIsLoadingApiVoices(true)
    try {
      let apiUrl = '';
      
      if (provider === 'elevenlabs') {
        apiUrl = '/api/list-elevenlabs-voices';
      } else if (provider === 'minimax') {
        apiUrl = '/api/list-minimax-voices';
      } else {
        console.warn(`No API voice fetching available for provider: ${provider}`);
        setIsLoadingApiVoices(false);
        return;
      }
      
      console.log(`📡 Making API call to: ${apiUrl}`)
      const response = await fetch(apiUrl)
      console.log(`📥 API response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`📊 API response data:`, data)
        setApiVoices(data.voices || [])
        console.log(`✅ Loaded ${data.voices?.length || 0} voices for ${provider}`, data.voices)
      } else {
        const errorText = await response.text()
        console.error(`❌ Failed to fetch ${provider} voices: ${response.status} - ${errorText}`)
        setApiVoices([])
      }
    } catch (error) {
      console.error(`❌ Error fetching ${provider} voices:`, error)
      setApiVoices([])
    } finally {
      setIsLoadingApiVoices(false)
    }
  }
  
  // Get current provider config
  const currentProvider = TTS_PROVIDERS[selectedProvider]

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    const provider = TTS_PROVIDERS[newProvider];
    
    // Reset voice and model
    setProviderVoice(provider.voices?.[0]?.id || "");
    setProviderModel(provider.models?.[0]?.id || "");
    
    // Fetch API voices if needed
    if (newProvider === 'elevenlabs' || newProvider === 'minimax') {
      fetchApiVoices(newProvider);
    }
  };

  // Text chunking functions
  const chunkText = (text: string, provider: string): string[] => {
    const maxChunkLength = provider === 'elevenlabs' ? ELEVENLABS_AUDIO_CHUNK_MAX_LENGTH : MINIMAX_AUDIO_CHUNK_MAX_LENGTH;
    const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          // Handle very long sentences by splitting on words
          const words = sentence.split(' ');
          let wordChunk = '';
          for (const word of words) {
            if ((wordChunk + ' ' + word).length <= maxChunkLength) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                chunks.push(word); // Single very long word
              }
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  };

  // Get content for display and processing
  const getContentSummary = () => {
    // Check if we have input text
    if (inputText.trim()) {
      const wordCount = inputText.trim().split(/\s+/).length
      return {
        type: 'Custom Text Input',
        content: inputText.substring(0, 100) + (inputText.length > 100 ? '...' : ''),
        wordCount: wordCount,
        length: inputText.length,
        textToProcess: inputText.trim()
      }
    }
    
    // Original logic for generated scripts
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
    }
    
    return null
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

  // Handle generation start
  const handleGenerateAudio = async () => {
    const contentSummary = getContentSummary();
    if (!contentSummary || !contentSummary.textToProcess.trim()) {
      showMessage("No content available for audio generation", 'error');
      return;
    }

    if (!providerVoice) {
      showMessage('Please select a voice', 'error');
      return;
    }

    const textToGenerate = contentSummary.textToProcess;
    const chunks = chunkText(textToGenerate, selectedProvider);
    
    dispatch(startAudioGeneration({
      id: `audio_${Date.now()}`,
        voice: selectedVoice,
        model: selectedModel,
      generateSubtitles: generateSubtitlesOption,
      textToProcess: textToGenerate,
      textChunks: chunks,
      batchSize: 5
    }));
  };

  // Simplified batching logic using polling
  useEffect(() => {
    if (!isGeneratingAudio) return;

    const processBatch = async () => {
      try {
        dispatch(startBatch());
        
        const startIndex = batchState.currentBatchIndex * batchState.batchSize;
        const endIndex = Math.min(startIndex + batchState.batchSize, textChunks.length);
        const currentBatch = textChunks.slice(startIndex, endIndex);
        
        setGenerationStatusMessage(`Processing batch ${batchState.currentBatchIndex + 1}/${batchState.totalBatches} (chunks ${startIndex + 1}-${endIndex})...`);

        const batchPromises = currentBatch.map(async (chunk, indexInBatch) => {
          const chunkIndex = startIndex + indexInBatch;
          
          const requestBody: any = {
            text: chunk, 
            provider: selectedProvider, 
            userId: 'current_user', 
            chunkIndex,
            voice: providerVoice, 
            model: providerModel, 
            elevenLabsVoiceId: providerVoice, 
            elevenLabsModelId: providerModel, 
            languageCode: languageCode
          };

          const response = await fetch('/api/generate-audio-comprehensive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            });

              if (!response.ok) {
              const errorData = await response.json();
            throw new Error(`Chunk ${chunkIndex + 1} failed: ${errorData.error}`);
          }
          
          const result = await response.json();
          if (!result.success) {
            throw new Error(`Chunk ${chunkIndex + 1} failed: ${result.error}`);
          }
          
          return result.audioUrl;
        });

        const results = await Promise.allSettled(batchPromises);
        const successfulUrls = results
          .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
          .map(result => result.value);
        
        const failedCount = results.length - successfulUrls.length;
        if (failedCount > 0) {
          console.warn(`${failedCount} chunks failed in this batch`);
        }

        dispatch(completeBatch({ chunkUrls: successfulUrls }));

      } catch (error: any) {
        console.error('Batch processing error:', error);
        dispatch(setAudioGenerationError(error.message));
        showMessage(`Batch processing failed: ${error.message}`, 'error');
      }
    };

    const finalizeAudio = async () => {
      try {
        setGenerationStatusMessage("Finalizing audio...");
        
        const finalizeBody: any = {
          chunkUrls: successfulChunkUrls,
          userId: 'current_user',
          provider: selectedProvider,
          voice: providerVoice,
          elevenLabsVoiceId: providerVoice,
          generateSubtitles: generateSubtitlesOption
        };

        const finalizeResponse = await fetch('/api/finalize-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalizeBody)
        });
        
        if (!finalizeResponse.ok) {
          const errorData = await finalizeResponse.json();
          throw new Error(`Failed to finalize audio: ${errorData.error}`);
        }

        const finalData = await finalizeResponse.json();
        if (!finalData.success) throw new Error(finalData.error || 'Audio finalization failed');

        console.log('🎵 Audio finalization complete:', {
          audioUrl: finalData.audioUrl,
          compressedAudioUrl: finalData.compressedAudioUrl,
          duration: finalData.duration,
          subtitlesUrl: finalData.subtitlesUrl
        });

        dispatch(completeAudioGeneration({
          audioUrl: finalData.audioUrl,
          compressedAudioUrl: finalData.compressedAudioUrl,
          duration: finalData.duration || 0
        }));

        if (finalData.subtitlesUrl) {
          dispatch(addSubtitlesToGeneration({ subtitlesUrl: finalData.subtitlesUrl }));
        }

        dispatch(saveGenerationToHistory());
        const subtitlesMessage = finalData.subtitlesUrl ? ' Subtitles were also generated and are available for download!' : '';
        showMessage(`Successfully generated audio using ${currentProvider?.name}! Both original and compressed versions are available - switch between them in the player above.${subtitlesMessage}`, 'success');
        setGenerationStatusMessage("");

    } catch (error: any) {
        console.error('Finalization error:', error);
      dispatch(setAudioGenerationError(error.message));
        showMessage(`Audio finalization failed: ${error.message}`, 'error');
      }
    };

    // Track if we've already started processing the current batch
    let isProcessingBatch = false;

    // Polling mechanism that properly respects wait times
    const interval = setInterval(() => {
      dispatch(checkWaitStatus());
      
      if (audioProgress.phase === 'batching' && !isProcessingBatch) {
        // Only start processing if we're not already processing a batch
        isProcessingBatch = true;
        processBatch().finally(() => {
          isProcessingBatch = false;
        });
      } else if (audioProgress.phase === 'finalizing') {
        finalizeAudio();
        clearInterval(interval);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [isGeneratingAudio, audioProgress.phase, batchState.currentBatchIndex]);

  // Status message updates
  useEffect(() => {
    if (audioProgress.phase === 'waiting' && batchState.waitUntil) {
      const updateWaitMessage = () => {
        const remainingTime = Math.max(0, batchState.waitUntil! - Date.now());
        const seconds = Math.ceil(remainingTime / 1000);
        if (seconds > 0) {
          setGenerationStatusMessage(`Waiting ${seconds}s before next batch...`);
        }
      };
      
      updateWaitMessage();
      const interval = setInterval(updateWaitMessage, 1000);
      return () => clearInterval(interval);
    }
  }, [audioProgress.phase, batchState.waitUntil]);

  // Download generated audio
  const handleDownloadAudio = (audioUrl: string, filename: string = 'script-audio.mp3') => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download subtitles
  const handleDownloadSubtitles = (subtitlesUrl: string, filename: string = 'subtitles.srt') => {
    const link = document.createElement('a')
    link.href = subtitlesUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Voice display functions - modified to separate custom and standard voices
  const getVoicesWithSeparator = () => {
    console.log(`🎤 Getting display voices for provider: ${selectedProvider}`)
    console.log(`📦 Static voices:`, currentProvider?.voices || [])
    console.log(`📡 API voices:`, apiVoices)
    console.log(`🗃️ Database voices:`, dbVoices.filter(v => v.provider === selectedProvider))
    console.log(`⏳ Loading API voices:`, isLoadingApiVoices)
    
    // Get static voices from provider config
    const staticVoices = currentProvider?.voices || []
    
    // Get custom voices from database for this provider
    const customVoicesForProvider = dbVoices.filter(voice => voice.provider === selectedProvider)
      .map(voice => ({
        id: voice.voice_id,
        name: `${voice.name} (Custom)`,
        isCustom: true
      }))
    
    let standardVoices: any[] = []
    
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'minimax') {
      // For API-based providers, combine static and API voices as standard
      const dynamicVoices = apiVoices || []
      
      console.log(`🔗 Combining ${staticVoices.length} static + ${dynamicVoices.length} dynamic voices as standard`)
      
      // Create a Map to handle duplicates, with API voices taking priority over static
      const voiceMap = new Map()
      
      // Add static voices first
      staticVoices.forEach(voice => {
        if (voice.id) {
          voiceMap.set(voice.id, { ...voice, isCustom: false })
        }
      })
      
      // Add API voices (these will override static ones with same ID)
      dynamicVoices.forEach(voice => {
        if (voice.id) {
          voiceMap.set(voice.id, { ...voice, isCustom: false })
        }
      })
      
      standardVoices = Array.from(voiceMap.values())
    } else {
      // For non-API providers, use static voices as standard
      standardVoices = staticVoices.map(voice => ({ ...voice, isCustom: false }))
    }
    
    console.log(`📋 Returning separated voices:`, {
      standard: standardVoices.length,
      custom: customVoicesForProvider.length
    })
    
    return {
      standardVoices,
      customVoices: customVoicesForProvider
    }
  }

  // Legacy function for compatibility - combines all voices
  const getDisplayVoices = () => {
    const { standardVoices, customVoices } = getVoicesWithSeparator()
    return [...standardVoices, ...customVoices]
  }

  const getVoiceDisplayName = (voiceId: string) => {
    const allVoices = getDisplayVoices()
    const voice = allVoices.find(v => v.id === voiceId)
    
    return voice?.name || voiceId
  }

  // Reset audio type selection when new generation completes
  useEffect(() => {
    if (currentGeneration && currentGeneration.status === 'completed' && currentGeneration.audioUrl) {
      setSelectedAudioType('original');
    }
  }, [currentGeneration?.id, currentGeneration?.status]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">Generate high-quality audio from your content using various TTS providers</p>
      </div>

      {/* Simple Text Input */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Text Input
          </CardTitle>
          <CardDescription>
            Enter custom text or use generated scripts below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Custom Text</Label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter your text here to generate audio..."
                className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {inputText.trim() && (
                <p className="text-sm text-gray-500 mt-1">
                  {inputText.trim().split(/\s+/).length} words, {inputText.length} characters
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Summary */}
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
            {currentProvider && (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {/* Voice Selection */}
              <div className="space-y-2">
                <Label>Voice</Label>
                  {isLoadingApiVoices ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading voices...
                </div>
                  ) : (
                    <Select value={providerVoice} onValueChange={setProviderVoice}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const { standardVoices, customVoices } = getVoicesWithSeparator()
                          const elements = []
                          
                          // Add standard voices
                          standardVoices.forEach((voice, index) => {
                            elements.push(
                              <SelectItem key={voice.id || `voice-${index}`} value={voice.id || `voice-${index}`}>
                                {voice.name}
                              </SelectItem>
                            )
                          })
                          
                          // Add separator if we have both standard and custom voices
                          if (standardVoices.length > 0 && customVoices.length > 0) {
                            elements.push(
                              <div key="separator" className="relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-gray-300" />
              </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                  <span className="bg-white px-2 text-gray-500">Custom Voices</span>
            </div>
                              </div>
                            )
                          }
                          
                          // Add custom voices
                          customVoices.forEach((voice, index) => {
                            elements.push(
                              <SelectItem key={voice.id || `custom-voice-${index}`} value={voice.id || `custom-voice-${index}`}>
                                {voice.name}
                              </SelectItem>
                            )
                          })
                          
                          return elements
                        })()}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Model Selection */}
                {currentProvider.models && (
              <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={providerModel} onValueChange={setProviderModel}>
                      <SelectTrigger>
                        <SelectValue />
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

                {/* Language Selection for ElevenLabs only */}
                {selectedProvider === 'elevenlabs' && currentProvider.languages && (
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={languageCode} onValueChange={setLanguageCode}>
                      <SelectTrigger>
                        <SelectValue />
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
            )}

            {/* Subtitles Generation Option */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Subtitles className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label htmlFor="generateSubtitles" className="text-sm font-medium text-gray-900">
                      Generate Subtitles
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Automatically create SRT subtitles using OpenAI Whisper
                    </p>
                  </div>
                </div>
                <Checkbox
                  id="generateSubtitles"
                  checked={generateSubtitlesOption}
                  onCheckedChange={(checked) => setGenerateSubtitlesOption(checked as boolean)}
                />
              </div>
              {generateSubtitlesOption && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="font-medium">Subtitles will be generated automatically:</p>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-blue-700">
                        <li>Uses OpenAI Whisper for accurate transcription</li>
                        <li>Formatted as 4-word segments for better readability</li>
                        <li>Available for download as SRT file</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Progress */}
            {isGeneratingAudio && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Generating Audio with {currentProvider?.name}</span>
                  <span>
                    {Math.round((audioProgress.completed / audioProgress.total) * 100)}%
                  </span>
                </div>
                <Progress value={audioProgress.total > 0 ? (audioProgress.completed / audioProgress.total) * 100 : 0} className="h-2" />
                <div className="text-xs text-gray-500 text-center">
                  {generationStatusMessage || 'Please wait...'}
                </div>
                <div className="text-xs text-gray-400 text-center">
                  Batch {batchState.currentBatchIndex + 1} of {batchState.totalBatches} • 
                  {audioProgress.completed}/{audioProgress.total} chunks completed
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

          
            {/* Generate Button */}
            <Button
              onClick={handleGenerateAudio}
              disabled={
                isGeneratingAudio || 
                !providerVoice || 
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
                <p className="font-medium">{getVoiceDisplayName(providerVoice)}</p>
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
                
                {/* Audio Type Toggle */}
                <div className="mb-4 p-3 bg-white border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Audio Quality Selection</h4>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioType"
                          value="original"
                          checked={selectedAudioType === 'original'}
                          onChange={(e) => setSelectedAudioType(e.target.value as 'original')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Original Quality
                          <span className="text-xs text-green-600 ml-1 font-medium">(Best for Video)</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioType"
                          value="compressed"
                          checked={selectedAudioType === 'compressed'}
                          onChange={(e) => setSelectedAudioType(e.target.value as 'compressed')}
                          className="text-blue-600 focus:ring-blue-500"
                          disabled={!currentGeneration.compressedAudioUrl}
                        />
                        <span className="text-sm text-gray-700">
                          Compressed
                          <span className="text-xs text-blue-600 ml-1 font-medium">(60-80% smaller)</span>
                        </span>
                      </label>
              </div>
            </div>
                  
                  {/* Quality Indicators */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className={`p-2 rounded border ${selectedAudioType === 'original' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="font-medium text-gray-700">Original Quality</div>
                      <div className="text-gray-500 mt-1">
                        • Full quality audio<br/>
                        • Perfect for video generation<br/>
                        • Larger file size
                </div>
                </div>
                    <div className={`p-2 rounded border ${selectedAudioType === 'compressed' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="font-medium text-gray-700">Compressed</div>
                      <div className="text-gray-500 mt-1">
                        • 16kHz, 32kbps mono<br/>
                        • Great for subtitles/transcription<br/>
                        • 60-80% smaller file size
              </div>
          </div>
                  </div>
                </div>

                {/* Audio Player */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Now Playing: {selectedAudioType === 'original' ? 'Original Quality' : 'Compressed'} Audio
                    </span>
                  </div>
                  
                  <audio controls className="w-full">
                    <source 
                      src={selectedAudioType === 'original' ? currentGeneration.audioUrl! : currentGeneration.compressedAudioUrl!} 
                      type="audio/mpeg" 
                    />
                    Your browser does not support the audio element.
                  </audio>
                  
                  {!currentGeneration.compressedAudioUrl && selectedAudioType === 'compressed' && (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ Compressed audio not available for this generation
          </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleDownloadAudio(
                      selectedAudioType === 'original' ? currentGeneration.audioUrl! : currentGeneration.compressedAudioUrl!,
                      `${selectedAudioType}-audio-${currentGeneration.id}.mp3`
                    )}
                    size="sm"
                    variant="outline"
                    disabled={selectedAudioType === 'compressed' && !currentGeneration.compressedAudioUrl}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download {selectedAudioType === 'original' ? 'Original' : 'Compressed'} Audio
                  </Button>
                  
                  {/* Quick download buttons for both types */}
                  {currentGeneration.compressedAudioUrl && (
                    <div className="flex gap-1">
                      {selectedAudioType !== 'original' && (
                        <Button
                          onClick={() => handleDownloadAudio(currentGeneration.audioUrl!, `original-audio-${currentGeneration.id}.mp3`)}
                          size="sm"
                          variant="ghost"
                          className="text-xs px-2"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Original
                  </Button>
                      )}
                      {selectedAudioType !== 'compressed' && (
                        <Button
                          onClick={() => handleDownloadAudio(currentGeneration.compressedAudioUrl!, `compressed-audio-${currentGeneration.id}.mp3`)}
                          size="sm"
                          variant="ghost"
                          className="text-xs px-2"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Compressed
                  </Button>
                      )}
                </div>
                  )}
              </div>
              </div>
            )}

            {/* Subtitles */}
            {currentGeneration.subtitlesUrl && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Subtitles className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Subtitles Generated</span>
                      </div>
                <div className="flex gap-2">
                      <Button 
                    onClick={() => handleDownloadSubtitles(currentGeneration.subtitlesUrl!, `subtitles-${currentGeneration.id}.srt`)}
                        size="sm" 
                    variant="outline"
                      >
                    <Download className="h-4 w-4 mr-2" />
                    Download Subtitles
                      </Button>
                    </div>
                {currentGeneration.subtitlesContent && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-800">
                      View Subtitles Content
                    </summary>
                    <pre className="mt-2 p-2 bg-white border rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {currentGeneration.subtitlesContent}
                    </pre>
                  </details>
                )}
                    </div>
            )}

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
            <div className="space-y-4">
              {generationHistory.map((generation) => {
                const historyAudioType = historyAudioTypes[generation.id] || 'original';
                const setHistoryAudioType = (type: 'original' | 'compressed') => {
                  setHistoryAudioTypes(prev => ({ ...prev, [generation.id]: type }));
                };
                
                return (
                  <div key={generation.id} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">
                        {new Date(generation.generatedAt).toLocaleString()}
                      </span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {generation.duration ? `${generation.duration.toFixed(1)}s` : 'N/A'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {generation.status}
                        </Badge>
              </div>
                    </div>

                    {/* Audio Type Toggle for History */}
                    {generation.audioUrl && (
                      <div className="mb-3 p-2 bg-white border rounded">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-600">Audio Quality:</span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`audioType-${generation.id}`}
                                value="original"
                                checked={historyAudioType === 'original'}
                                onChange={(e) => setHistoryAudioType(e.target.value as 'original')}
                                className="text-blue-600 focus:ring-blue-500 w-3 h-3"
                              />
                              <span className="text-xs text-gray-700">Original</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`audioType-${generation.id}`}
                                value="compressed"
                                checked={historyAudioType === 'compressed'}
                                onChange={(e) => setHistoryAudioType(e.target.value as 'compressed')}
                                className="text-blue-600 focus:ring-blue-500 w-3 h-3"
                                disabled={!generation.compressedAudioUrl}
                              />
                              <span className="text-xs text-gray-700">Compressed</span>
                            </label>
              </div>
            </div>

                        {/* Mini Audio Player */}
                        <div className="mt-2">
                          <audio controls className="w-full h-8" style={{ height: '32px' }}>
                            <source 
                              src={historyAudioType === 'original' ? generation.audioUrl! : generation.compressedAudioUrl!} 
                              type="audio/mpeg" 
                            />
                            Your browser does not support the audio element.
                          </audio>
            </div>

                        {!generation.compressedAudioUrl && historyAudioType === 'compressed' && (
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ Compressed audio not available
              </div>
            )}
                      </div>
                    )}

                    {/* Download Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {generation.audioUrl && (
                        <>
                          <Button
                            onClick={() => handleDownloadAudio(
                              historyAudioType === 'original' ? generation.audioUrl! : generation.compressedAudioUrl!,
                              `${historyAudioType}-audio-${generation.id}.mp3`
                            )}
                            size="sm"
                            variant="outline"
                            disabled={historyAudioType === 'compressed' && !generation.compressedAudioUrl}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {historyAudioType === 'original' ? 'Original' : 'Compressed'}
                          </Button>
                          
                          {/* Quick access to both types */}
                          {generation.compressedAudioUrl && historyAudioType === 'original' && (
                            <Button
                              onClick={() => handleDownloadAudio(generation.compressedAudioUrl!, `compressed-audio-${generation.id}.mp3`)}
                              size="sm"
                              variant="ghost"
                              className="text-xs px-2"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Compressed
                            </Button>
                          )}
                          {generation.compressedAudioUrl && historyAudioType === 'compressed' && (
                            <Button
                              onClick={() => handleDownloadAudio(generation.audioUrl!, `original-audio-${generation.id}.mp3`)}
                              size="sm"
                              variant="ghost"
                              className="text-xs px-2"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Original
                            </Button>
                          )}
                        </>
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
                );
              })}
                </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 