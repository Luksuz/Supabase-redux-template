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
import { Input } from './ui/input'
import {
  setSelectedProvider,
  setMinimaxVoice,
  setMinimaxModel,
  setElevenLabsVoice,
  setElevenLabsModel,
  setElevenLabsLanguage,
  setGenaiProVoice,
  setGenaiProModel,
  setGenaiProLanguage,
  setTextToConvert,
  startGeneration,
  completeGeneration,
  failGeneration,
  clearError,
  clearAudio,
  type AudioProvider
} from '../lib/features/audio/simpleAudioSlice'

// Voice options for MiniMax - Updated with channel voices
const minimaxVoices = [
  // Your channel voices (add your specific voice IDs here)
  { value: 'moss_audio_daa84003-205b-11f0-9892-fe0442d6b67f', label: 'Law Of Insights (Channel Voice)' },
  { value: 'moss_audio_92ac26e3-2059-11f0-8444-ae62a3be7263', label: 'Library of Thoth (Channel Voice)' },
  { value: 'English_radiant_girl', label: 'Radiant Girl (Channel Voice)' },
  { value: 'English_captivating_female1', label: 'Captivating Female (Channel Voice)' },
  { value: 'English_Steady_Female_1', label: 'Steady Women (Channel Voice)' },
  { value: 'English_CaptivatingStoryteller', label: 'Captivating Storyteller (Channel Voice)' },
  { value: 'English_Deep-VoicedGentleman', label: 'Man With Deep Voice (Channel Voice)' },
  { value: 'English_magnetic_voiced_man', label: 'Magnetic-voiced Male (Channel Voice)' },
  { value: 'English_ReservedYoungMan', label: 'Reserved Young Man (Channel Voice)' },
  { value: 'English_expressive_narrator', label: 'Expressive Narrator (Channel Voice)' },
  { value: 'moss_audio_9e4a7a43-7de1-11f0-b5f9-229ade71d471', label: 'Sleepy Spiritualist (Voice)' },
  // Add more of your custom MiniMax voices here
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
  { value: 'speech-2.5-hd-preview', label: 'Speech 2.5 HD Preview (Ultimate Similarity, Ultra-High Quality)' },
  { value: 'speech-2.5-turbo-preview', label: 'Speech 2.5 Turbo Preview (Ultimate Value, 40 Languages)' },
  { value: 'speech-02-hd', label: 'Speech 02 HD (Recommended)' },
  { value: 'speech-02-turbo', label: 'Speech 02 Turbo (Fast)' },
  { value: 'speech-01-hd', label: 'Speech 01 HD' },
  { value: 'speech-01-turbo', label: 'Speech 01 Turbo' }
]

// Default fallback voices for ElevenLabs (used when API is not available)
const fallbackElevenLabsVoices = [
  { value: 'Rachel', label: 'Rachel (Default)' },
  { value: 'Adam', label: 'Adam (Default)' },
  { value: 'Antoni', label: 'Antoni (Default)' },
  { value: 'Arnold', label: 'Arnold (Default)' },
  { value: 'Bella', label: 'Bella (Default)' },
  { value: 'Josh', label: 'Josh (Default)' },
  { value: 'Nicole', label: 'Nicole (Default)' },
  { value: 'Sam', label: 'Sam (Default)' }
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
    case 'genaipro':
      return { maxChars: 10000, batchSize: 1, batchDelay: 0 } // All tasks created simultaneously
    case 'minimax':
      return { maxChars: 2500, batchSize: 5, batchDelay: 60 }
    default:
      return { maxChars: 3000, batchSize: 5, batchDelay: 60 }
  }
}

// Helper function to poll GenAI Pro tasks (2 at a time with 1-minute delays)
const pollGenaiProTasks = async (taskIds: string[], filename: string): Promise<string[]> => {
  const completedAudioUrls: string[] = new Array(taskIds.length)
  const pendingTasks = new Set(taskIds.map((_, index) => index))
  
  const pollInterval = 60000 // 1 minute between polling rounds
  const batchSize = 2 // Poll 2 tasks at a time
  const maxAttempts = 30 // 30 minutes total (30 * 1min)
  let attempts = 0
  
  console.log(`🔄 Starting to poll ${taskIds.length} GenAI Pro tasks (${batchSize} at a time, every 1 minute)`)
  
  while (pendingTasks.size > 0 && attempts < maxAttempts) {
    attempts++
    
    console.log(`📊 Polling round ${attempts}/${maxAttempts}, ${pendingTasks.size} tasks remaining`)
    
    // Get next batch of tasks to check (up to 3)
    const pendingTasksArray = Array.from(pendingTasks)
    const batchToCheck = pendingTasksArray.slice(0, batchSize)
    
    console.log(`🔍 Checking tasks: ${batchToCheck.map(i => i + 1).join(', ')} of ${taskIds.length}`)
    
    // Check this batch of tasks in parallel
    const checkPromises = batchToCheck.map(async (taskIndex) => {
      const taskId = taskIds[taskIndex]
      
      try {
        const response = await fetch('/api/check-genaipro-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        })
        
        if (!response.ok) {
          throw new Error(`Status check failed for task ${taskIndex + 1}`)
        }
        
        const data = await response.json()
        
        if (data.status === 'completed' && data.audioUrl) {
          completedAudioUrls[taskIndex] = data.audioUrl
          pendingTasks.delete(taskIndex)
          console.log(`✅ GenAI Pro task ${taskIndex + 1}/${taskIds.length} completed`)
          return { taskIndex, status: 'completed' }
        } else if (data.status === 'failed' || data.status === 'error') {
          throw new Error(`GenAI Pro task ${taskIndex + 1} failed: ${data.status}`)
        } else {
          console.log(`⏳ GenAI Pro task ${taskIndex + 1}/${taskIds.length} still ${data.status}`)
          return { taskIndex, status: data.status }
        }
      } catch (error) {
        console.error(`❌ Error checking GenAI Pro task ${taskIndex + 1}:`, error)
        throw error
      }
    })
    
    await Promise.all(checkPromises)
    
    // Wait before next polling round (unless all tasks are complete)
    if (pendingTasks.size > 0 && attempts < maxAttempts) {
      console.log(`⏱️ Waiting 1 minute before next polling round...`)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  if (pendingTasks.size > 0) {
    throw new Error(`GenAI Pro tasks timed out after 30 minutes. ${pendingTasks.size} tasks still pending.`)
  }
  
  console.log(`🎉 All ${taskIds.length} GenAI Pro tasks completed successfully!`)
  return completedAudioUrls.filter(url => url) // Filter out any undefined values
}

export function SimpleAudioGenerator() {
  const dispatch = useAppDispatch()
  const {
    isGenerating,
    generatedAudioUrl,
    generatedFilename,
    error,
    selectedProvider,
    minimaxVoice,
    minimaxModel,
    elevenLabsVoice,
    elevenLabsModel,
    elevenLabsLanguage,
    genaiProVoice,
    genaiProModel,
    genaiProLanguage,
    textToConvert
  } = useAppSelector(state => state.simpleAudio)

  // Get script from Redux state
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [customFilename, setCustomFilename] = useState('')
  const [elevenLabsVoices, setElevenLabsVoices] = useState(fallbackElevenLabsVoices)
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [voicesError, setVoicesError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const splitIntoChunks = (text: string, maxLen: number): string[] => {
    if (!text) return []
    if (text.length <= maxLen) return [text]
    const chunks: string[] = []
    let cursor = 0
    while (cursor < text.length) {
      const end = Math.min(cursor + maxLen, text.length)
      // try to split on sentence boundary or space within window
      const window = text.slice(cursor, end)
      let splitAt = -1
      // prefer sentence end
      const sentenceRegex = /[.?!]\s+/g
      let match
      while ((match = sentenceRegex.exec(window)) !== null) {
        splitAt = match.index + match[0].length
      }
      if (splitAt === -1) {
        const lastSpace = window.lastIndexOf(' ')
        splitAt = lastSpace > 0 ? lastSpace + 1 : window.length
      }
      const part = window.slice(0, splitAt)
      chunks.push(part.trim())
      cursor += splitAt
    }
    return chunks.filter(Boolean)
  }

  // Auto-populate with full script if available (only when text is empty)
  useEffect(() => {
    if (sectionedWorkflow.fullScript && !textToConvert.trim()) {
      dispatch(setTextToConvert(sectionedWorkflow.fullScript))
    }
  }, [sectionedWorkflow.fullScript, dispatch]) // Removed textToConvert from dependencies to prevent interference

  // Auto-populate filename when script title or language changes
  useEffect(() => {
    const languageCode = selectedProvider === 'elevenlabs' ? elevenLabsLanguage 
                        : selectedProvider === 'genaipro' ? genaiProLanguage 
                        : 'en'
    const scriptTitle = sectionedWorkflow.videoTitle
    
    if (scriptTitle || languageCode !== 'en') {
      const cleanTitle = (scriptTitle || 'untitled-script')
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase()
        .substring(0, 50) // Limit length
      
      const suggestedFilename = `${languageCode.toUpperCase()}_${cleanTitle}`
      setCustomFilename(suggestedFilename)
    }
  }, [sectionedWorkflow.videoTitle, elevenLabsLanguage, genaiProLanguage, selectedProvider])

  // Fetch ElevenLabs voices when component mounts or when switching to ElevenLabs/GenAI Pro
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' || selectedProvider === 'genaipro') {
      const fetchVoices = async () => {
        setIsLoadingVoices(true)
        setVoicesError(null)
        
        try {
          console.log('🔄 Fetching ALL ElevenLabs voices from API (this may take a moment)...')
          const response = await fetch('/api/elevenlabs-voices')
          
          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`)
          }
          
          const data = await response.json()
          
          if (data.error) {
            throw new Error(data.error)
          }
          
          if (data.voices && Array.isArray(data.voices)) {
            console.log(`✅ Successfully loaded ${data.voices.length} ElevenLabs voices`)
            console.log(`📊 Total voices loaded: ${data.total_count || 'unknown'}`)
            console.log(`📄 Pages fetched: ${data.pages_fetched || 'unknown'}`)
            setElevenLabsVoices(data.voices)
            setVoicesError(null)
          } else {
            throw new Error('Invalid response format from voices API')
          }
          
        } catch (error) {
          console.error('❌ Error fetching ElevenLabs voices:', error)
          setVoicesError(error instanceof Error ? error.message : 'Failed to load voices')
          
          // Keep fallback voices if API fails
          console.log('🔄 Using fallback voices due to API error')
          setElevenLabsVoices(fallbackElevenLabsVoices)
        } finally {
          setIsLoadingVoices(false)
        }
      }
      
      fetchVoices()
    }
  }, [selectedProvider])

  // Calculate processing estimates
  const getProcessingEstimate = () => {
    if (!textToConvert) return { chunks: 0, batches: 0, estimatedMinutes: 0 }
    
    const limits = getCharacterLimits(selectedProvider)
    const chunks = Math.ceil(textToConvert.length / limits.maxChars)
    
    if (selectedProvider === 'genaipro') {
      // GenAI Pro: task creation is instant, main time is in polling (2 tasks per minute + processing time)
      const pollingRounds = Math.ceil(chunks / 2) // 2 tasks checked per round
      const pollingTime = pollingRounds * 1 // 1 minute per round
      const processingTime = chunks * 3 // Estimate 3 minutes processing per task
      const estimatedMinutes = Math.max(5, pollingTime + processingTime)
      return { chunks, batches: pollingRounds, estimatedMinutes }
    } else {
      // Other providers: use batching logic
      const batches = Math.ceil(chunks / limits.batchSize)
      const estimatedMinutes = Math.max(1, batches * (limits.batchDelay / 60))
      return { chunks, batches, estimatedMinutes }
    }
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
      const limits = getCharacterLimits(selectedProvider)

      // ElevenLabs: single server-handled call
      if (selectedProvider === 'elevenlabs') {
        const requestBody = {
          text: textToConvert,
          provider: 'elevenlabs' as const,
          voice: elevenLabsVoice,
          model: elevenLabsModel,
          language: elevenLabsLanguage,
          scriptTitle: sectionedWorkflow.videoTitle || 'untitled-script',
          customFilename: customFilename.trim() || undefined
        }

        if (processingEstimate.chunks > 1) {
          setProcessingStatus(`Processing ${processingEstimate.chunks} chunks in ${processingEstimate.batches} batches...`)
          setEstimatedTime(processingEstimate.estimatedMinutes)
        } else {
          setProcessingStatus('Generating audio...')
        }

        const response = await fetch('/api/generate-simple-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate audio')
        }
        const data = await response.json()
        setProcessingStatus('')
        dispatch(completeGeneration({ audioUrl: data.audioUrl, filename: data.filename }))
        if (data.chunksGenerated && data.totalChunks) {
          console.log(`✅ Successfully generated ${data.chunksGenerated}/${data.totalChunks} chunks`)
        }
        return
      }

      // GenAI Pro: create tasks and handle frontend polling
      if (selectedProvider === 'genaipro') {
        const requestBody = {
          text: textToConvert,
          provider: 'genaipro' as const,
          voice: genaiProVoice,
          model: genaiProModel,
          language: genaiProLanguage,
          scriptTitle: sectionedWorkflow.videoTitle || 'untitled-script',
          customFilename: customFilename.trim() || undefined
        }

        if (processingEstimate.chunks > 1) {
          setProcessingStatus(`Creating ${processingEstimate.chunks} GenAI Pro tasks simultaneously...`)
          setEstimatedTime(0) // Task creation is now fast, main time is in polling
        } else {
          setProcessingStatus('Creating GenAI Pro task...')
        }

        // Create GenAI Pro tasks
        const response = await fetch('/api/generate-simple-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create GenAI Pro tasks')
        }
        const data = await response.json()
        
        if (!data.taskIds || data.taskIds.length === 0) {
          throw new Error('No task IDs received from GenAI Pro')
        }

        console.log(`✅ Created ${data.taskIds.length} GenAI Pro tasks`)
        setProcessingStatus(`Polling ${data.taskIds.length} GenAI Pro tasks (2 at a time, every 1 minute)...`)

        // Start polling tasks
        const audioUrls = await pollGenaiProTasks(data.taskIds, data.filename)
        
        // Concatenate audio if multiple chunks
        if (audioUrls.length > 1) {
          setProcessingStatus('Concatenating GenAI Pro audio chunks...')
          const concatResponse = await fetch('/api/concatenate-genaipro-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              audioUrls: audioUrls,
              filename: data.filename 
            }),
          })
          
          if (!concatResponse.ok) {
            const errJson = await concatResponse.json().catch(() => ({} as any))
            throw new Error(errJson.error || 'Failed to concatenate GenAI Pro audio')
          }
          
          const concatData = await concatResponse.json()
          setProcessingStatus('')
          dispatch(completeGeneration({ audioUrl: concatData.audioUrl, filename: data.filename }))
        } else {
          setProcessingStatus('')
          dispatch(completeGeneration({ audioUrl: audioUrls[0], filename: data.filename }))
        }
        
        console.log(`✅ GenAI Pro audio generation completed successfully`)
        return
      }

      // MiniMax: frontend-batched flow (5 per batch, 2500 chars, 60s delay)
      const chunks = splitIntoChunks(textToConvert, limits.maxChars)
      const totalChunks = chunks.length
      const totalBatches = Math.ceil(totalChunks / limits.batchSize)
      setProcessingStatus(`Processing ${totalChunks} chunks in ${totalBatches} batches...`)
      setEstimatedTime(Math.max(1, totalBatches * (limits.batchDelay / 60)))

      const batchAudioUrls: string[] = []
      for (let batchStart = 0; batchStart < totalChunks; batchStart += limits.batchSize) {
        const batchEnd = Math.min(batchStart + limits.batchSize, totalChunks)
        const batchIndex = Math.floor(batchStart / limits.batchSize) + 1
        setProcessingStatus(`Generating batch ${batchIndex}/${totalBatches} (chunks ${batchStart + 1}-${batchEnd})...`)

        const batchText = chunks.slice(batchStart, batchEnd).join('\n\n')
        const requestBody = {
          text: batchText,
          provider: 'minimax' as const,
          voice: minimaxVoice,
          model: minimaxModel,
          scriptTitle: sectionedWorkflow.videoTitle || 'untitled-script',
          customFilename: customFilename.trim() || undefined
        }

        const res = await fetch('/api/generate-simple-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any))
          throw new Error(err.error || `Batch ${batchIndex} failed`)
        }
        const data = await res.json()
        if (!data.audioUrl) throw new Error('Batch response missing audioUrl')
        batchAudioUrls.push(data.audioUrl)

        // Wait between batches except after the last
        if (batchEnd < totalChunks) {
          setProcessingStatus(`Waiting ${limits.batchDelay}s before next batch...`)
          await sleep(limits.batchDelay * 1000)
        }
      }

      // Concatenate batch audio
      setProcessingStatus('Concatenating batches...')
      const concatRes = await fetch('/api/concatenate-audio-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioDataUrls: batchAudioUrls }),
      })
      if (!concatRes.ok) {
        const errJson = await concatRes.json().catch(() => ({} as any))
        throw new Error(errJson.error || 'Failed to concatenate batch audio')
      }
      const concatData = await concatRes.json()

      setProcessingStatus('')
      dispatch(completeGeneration({
        audioUrl: concatData.audioUrl,
        filename: (customFilename.trim() ? `${customFilename.trim()}.mp3` : undefined) || `EN_${(sectionedWorkflow.videoTitle || 'untitled-script').replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50)}.mp3`
      }))

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

  const handleDownloadAudio = () => {
    if (generatedAudioUrl && generatedFilename) {
      const link = document.createElement('a')
      link.href = generatedAudioUrl
      link.download = generatedFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getProviderInfo = () => {
    const limits = getCharacterLimits(selectedProvider)
    if (selectedProvider === 'minimax') {
      return { name: 'MiniMax', desc: `Fast, reliable AI audio (${limits.maxChars} chars/chunk, ${limits.batchSize} chunks/batch)` }
    } else if (selectedProvider === 'elevenlabs') {
      return { name: 'ElevenLabs', desc: `High-quality AI voices (${limits.maxChars} chars/chunk, ${limits.batchSize} chunks/batch)` }
    } else {
      return { name: 'GenAI Pro', desc: `Affordable ElevenLabs-powered voices (${limits.maxChars} chars/chunk, 2 polls/minute)` }
    }
  }

  const providerInfo = getProviderInfo()

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Convert text to speech using MiniMax, ElevenLabs, or GenAI Pro AI models with automatic batching and concatenation
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
              {selectedProvider === 'genaipro' ? 'Task Processing Estimate' : 'Batch Processing Estimate'}
            </CardTitle>
            <CardDescription>
              {selectedProvider === 'genaipro' 
                ? 'Tasks created simultaneously, then polled 2 at a time every minute'
                : 'Text will be processed in batches due to length'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{processingEstimate.chunks}</div>
                <div className="text-sm text-blue-700">{selectedProvider === 'genaipro' ? 'Tasks' : 'Chunks'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{processingEstimate.batches}</div>
                <div className="text-sm text-purple-700">{selectedProvider === 'genaipro' ? 'Poll Rounds' : 'Batches'}</div>
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
            Choose between MiniMax for speed, ElevenLabs for quality, or GenAI Pro for affordability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['minimax', 'elevenlabs', 'genaipro'] as AudioProvider[]).map((provider) => (
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
                      ? 'Fast, reliable AI audio (2500 chars/chunk)'
                      : provider === 'elevenlabs'
                      ? 'High-quality AI voices (10000 chars/chunk)'
                      : 'GenAI Pro ElevenLabs - Affordable, rate-limited polling (10000 chars/chunk)'
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
          <CardDescription>
            {providerInfo.desc}
            {(selectedProvider === 'elevenlabs' || selectedProvider === 'genaipro') && (
              <span className="block mt-1 text-xs">
                {isLoadingVoices ? (
                  <span className="text-blue-600">🔄 Loading all voices from ElevenLabs API...</span>
                ) : voicesError ? (
                  <span className="text-red-600">⚠️ Using fallback voices</span>
                ) : (
                  <span className="text-green-600">
                    ✅ All voices loaded from ElevenLabs API{' '}
                    <span className="text-orange-500">(custom voices wont work on genai pro)</span>{' '}
                    <span className="text-blue-500">({elevenLabsVoices.length} available)</span>
                  </span>
                )}
              </span>
            )}
          </CardDescription>
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
          ) : selectedProvider === 'elevenlabs' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="elevenlabs-voice">Voice</Label>
                  {isLoadingVoices && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading all voices...
                    </span>
                  )}
                  {voicesError && (
                    <button
                      onClick={() => {
                        // Trigger re-fetch by calling the useEffect logic
                        setIsLoadingVoices(true)
                        setVoicesError(null)
                        fetch('/api/elevenlabs-voices')
                          .then(res => res.json())
                          .then(data => {
                            if (data.voices) {
                              console.log(`🔄 Retry successful: loaded ${data.voices.length} voices`)
                              setElevenLabsVoices(data.voices)
                              setVoicesError(null)
                            }
                          })
                          .catch((err) => {
                            console.error('🔄 Retry failed:', err)
                            setElevenLabsVoices(fallbackElevenLabsVoices)
                          })
                          .finally(() => setIsLoadingVoices(false))
                      }}
                      className="text-xs text-red-600 hover:text-red-700 underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
                <Select
                  value={elevenLabsVoice}
                  onValueChange={(value) => dispatch(setElevenLabsVoice(value))}
                  disabled={isGenerating || isLoadingVoices}
                >
                  <SelectTrigger id="elevenlabs-voice">
                    <SelectValue placeholder={isLoadingVoices ? "Loading all voices..." : "Select voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsVoices.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voicesError && (
                  <p className="text-xs text-red-600">
                    ⚠️ Using fallback voices. {voicesError}
                  </p>
                )}
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="genaipro-voice">Voice (ElevenLabs)</Label>
                  {isLoadingVoices && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading all voices...
                    </span>
                  )}
                  {voicesError && (
                    <button
                      onClick={() => {
                        // Trigger re-fetch by calling the useEffect logic
                        setIsLoadingVoices(true)
                        setVoicesError(null)
                        fetch('/api/elevenlabs-voices')
                          .then(res => res.json())
                          .then(data => {
                            if (data.voices) {
                              console.log(`🔄 Retry successful: loaded ${data.voices.length} voices`)
                              setElevenLabsVoices(data.voices)
                              setVoicesError(null)
                            }
                          })
                          .catch((err) => {
                            console.error('🔄 Retry failed:', err)
                            setElevenLabsVoices(fallbackElevenLabsVoices)
                          })
                          .finally(() => setIsLoadingVoices(false))
                      }}
                      className="text-xs text-red-600 hover:text-red-700 underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
                <Select
                  value={genaiProVoice}
                  onValueChange={(value) => dispatch(setGenaiProVoice(value))}
                  disabled={isGenerating || isLoadingVoices}
                >
                  <SelectTrigger id="genaipro-voice">
                    <SelectValue placeholder={isLoadingVoices ? "Loading all voices..." : "Select voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsVoices.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voicesError && (
                  <p className="text-xs text-red-600">
                    ⚠️ Using fallback voices. {voicesError}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="genaipro-model">Model</Label>
                <Select
                  value={genaiProModel}
                  onValueChange={(value) => dispatch(setGenaiProModel(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="genaipro-model">
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
                <Label htmlFor="genaipro-language">Language</Label>
                <Select
                  value={genaiProLanguage}
                  onValueChange={(value) => dispatch(setGenaiProLanguage(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="genaipro-language">
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
              <div className="flex gap-2">
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
                {textToConvert.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch(setTextToConvert(''))}
                    disabled={isGenerating}
                    className="text-red-600 hover:text-red-700"
                  >
                    Clear Text
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Filename Input */}
          <div className="space-y-2">
            <Label htmlFor="filename">Audio Filename (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="filename"
                placeholder="e.g., EN_my-awesome-video"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                disabled={isGenerating}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const languageCode = selectedProvider === 'elevenlabs' ? elevenLabsLanguage 
                                      : selectedProvider === 'genaipro' ? genaiProLanguage 
                                      : 'en'
                  const scriptTitle = sectionedWorkflow.videoTitle
                  const cleanTitle = (scriptTitle || 'untitled-script')
                    .replace(/[^a-zA-Z0-9\s-_]/g, '')
                    .replace(/\s+/g, '-')
                    .toLowerCase()
                    .substring(0, 50)
                  const suggestedFilename = `${languageCode.toUpperCase()}_${cleanTitle}`
                  setCustomFilename(suggestedFilename)
                }}
                disabled={isGenerating}
              >
                Auto-fill
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-generate from script title and language. The .mp3 extension will be added automatically.
            </p>
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
              {generatedFilename && (
                <span className="block mt-1 text-sm font-mono text-blue-600">
                  📁 {generatedFilename}
                </span>
              )}
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
                onClick={handleDownloadAudio}
                variant="outline"
                size="lg"
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Volume2 className="h-5 w-5 mr-2" />
                Download Audio
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