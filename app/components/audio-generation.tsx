'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../../lib/hooks'
import { 
  loadVoicesThunk, 
  generateAudioThunk, 
  setSelectedVoice, 
  setSelectedAudioModel,
  setAudioPlaying,
  clearAllAudioStates
} from '../../lib/features/scripts/scriptsSlice'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Loader2, Volume2, Download, Play, Pause, RefreshCw, Mic, Music, AlertCircle, CheckCircle, Settings, FileText, Fish, Plus, Edit, Trash2 } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'

export function AudioGeneration() {
  const dispatch = useAppDispatch()
  const { currentJob, audioGeneration } = useAppSelector(state => state.scripts)
  const user = useAppSelector(state => state.user)
  
  // Add ref to store current audio instance
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [bulkGenerationProgress, setBulkGenerationProgress] = useState<{
    isGenerating: boolean
    current: number
    total: number
    currentSection: string
  }>({
    isGenerating: false,
    current: 0,
    total: 0,
    currentSection: ''
  })
  const [combineAudioProgress, setCombineAudioProgress] = useState<{
    isGenerating: boolean
    progress: number
    status: string
  }>({
    isGenerating: false,
    progress: 0,
    status: ''
  })

  const [joinedAudioUrl, setJoinedAudioUrl] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<'elevenlabs' | 'voicemaker' | 'fishaudio' | 'minimax'>('elevenlabs')
  const [voicemakerVoices, setVoicemakerVoices] = useState<any[]>([])
  const [loadingVoicemakerVoices, setLoadingVoicemakerVoices] = useState(false)
  const [fishAudioVoices, setFishAudioVoices] = useState<any[]>([])
  const [fishAudioModels, setFishAudioModels] = useState<any[]>([])
  const [loadingFishAudioVoices, setLoadingFishAudioVoices] = useState(false)
  const [minimaxVoices, setMinimaxVoices] = useState<any[]>([])
  const [minimaxModels, setMinimaxModels] = useState<any[]>([])
  const [loadingMinimaxVoices, setLoadingMinimaxVoices] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [combineSessionsProgress, setCombineSessionsProgress] = useState<{
    isGenerating: boolean
    progress: number
    status: string
  }>({
    isGenerating: false,
    progress: 0,
    status: ''
  })
  

  
  // Editable script state
  const [editedScript, setEditedScript] = useState('')
  const [isScriptEdited, setIsScriptEdited] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState({
    isProcessing: false,
    currentBatch: 0,
    totalBatches: 0,
    completedSections: 0,
    totalSections: 0
  })

  // Voice Manager State
  const [customVoices, setCustomVoices] = useState<any[]>([])
  const [loadingCustomVoices, setLoadingCustomVoices] = useState(false)
  const [showAddVoiceDialog, setShowAddVoiceDialog] = useState(false)
  const [editingVoice, setEditingVoice] = useState<any>(null)
  const [voiceForm, setVoiceForm] = useState({
    name: '',
    voice_id: '',
    provider: 'elevenlabs' as 'elevenlabs' | 'voicemaker' | 'fishaudio' | 'minimax'
  })

  // ElevenLabs Voice Settings
  const [elevenLabsSettings, setElevenLabsSettings] = useState({
    stability: 0.5,
    use_speaker_boost: true,
    similarity_boost: 0.8,
    style: 0.0,
    speed: 1.0
  })



  // Helper function to strip research data brackets from script text
  const stripResearchData = (text: string): string => {
    // Remove content within double brackets [[...]]
    return text.replace(/\[\[.*?\]\]/g, '').trim()
  }



  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Load voices on component mount
  useEffect(() => {
    if (selectedProvider === 'elevenlabs' && audioGeneration.voices.length === 0 && !audioGeneration.loadingVoices) {
      loadVoices()
    } else if (selectedProvider === 'voicemaker' && voicemakerVoices.length === 0 && !loadingVoicemakerVoices) {
      loadVoicemakerVoices()
    } else if (selectedProvider === 'fishaudio' && fishAudioVoices.length === 0 && !loadingFishAudioVoices) {
      loadFishAudioVoices()
    } else if (selectedProvider === 'minimax' && minimaxVoices.length === 0 && !loadingMinimaxVoices) {
      loadMinimaxVoices()
    }
  }, [selectedProvider])

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

    // Strip research data brackets before sending to audio generation
    const cleanScriptText = stripResearchData(scriptText)

    const result = await dispatch(generateAudioThunk({
      sectionId,
      text: cleanScriptText,
      voiceId: audioGeneration.selectedVoice,
      modelId: audioGeneration.selectedModel,
      provider: selectedProvider,
      voiceSettings: selectedProvider === 'elevenlabs' ? elevenLabsSettings : undefined
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Audio generated successfully! ${result.result.chunksGenerated || 1}/${result.result.totalChunks || 1} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate audio', 'error')
    }
  }



  // Generate audio for all sections in batches of 5
  const generateAllAudioInBatches = async () => {
    if (!audioGeneration.selectedVoice) {
      showMessage('Please select a voice first', 'error')
      return
    }

    if (!user.isLoggedIn) {
      showMessage('Please log in to generate audio', 'error')
      return
    }

    const scriptToProcess = editedScript.trim()
    if (!scriptToProcess) {
      showMessage('No script content available for audio generation', 'error')
      return
    }

    // Clear all existing audio states before starting fresh generation
    dispatch(clearAllAudioStates())
    setJoinedAudioUrl(null) // Clear any previously joined audio
    showMessage('Clearing previous audio and starting fresh generation...', 'info')

    // Generate audio from the full combined script, chunked by provider limits

    // Determine chunk size based on provider
    const getChunkSize = (provider: string) => {
      switch (provider) {
        case 'minimax': return 3000
        case 'elevenlabs': return 5000
        case 'fishaudio': return 4000
        case 'voicemaker': return 4000
        default: return 4000
      }
    }

    // Split script into chunks
    const chunkSize = getChunkSize(selectedProvider)
    const textChunks = []
    for (let i = 0; i < scriptToProcess.length; i += chunkSize) {
      textChunks.push({
        id: `chunk-${i / chunkSize + 1}`,
        text: scriptToProcess.slice(i, i + chunkSize),
        chunkNumber: Math.floor(i / chunkSize) + 1
      })
    }

    console.log(`📝 Split script into ${textChunks.length} chunks for ${selectedProvider} (${chunkSize} char limit)`)

    // Split chunks into batches of 5 for processing
    const batchSize = 5
    const batches = []
    for (let i = 0; i < textChunks.length; i += batchSize) {
      batches.push(textChunks.slice(i, i + batchSize))
    }

    // Initialize batch processing state
    setBatchProcessing({
      isProcessing: true,
      currentBatch: 0,
      totalBatches: batches.length,
      completedSections: 0,
      totalSections: textChunks.length
    })

    showMessage(`Generating audio for ${textChunks.length} text chunks in ${batches.length} batch(es)...`, 'info')

    let totalSuccessCount = 0
    let totalErrorCount = 0

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      setBatchProcessing(prev => ({
        ...prev,
        currentBatch: batchIndex + 1
      }))

      // Process chunks in current batch asynchronously
      // Audio is generated from chunked script content
      const batchPromises = batch.map(async (chunk) => {
      try {
        const cleanScriptText = chunk.text.trim()
        
          let result
          if (selectedProvider === 'elevenlabs' || selectedProvider === 'fishaudio' || selectedProvider === 'minimax' || selectedProvider === 'voicemaker') {
            result = await dispatch(generateAudioThunk({
          sectionId: chunk.id,
          text: cleanScriptText,
          voiceId: audioGeneration.selectedVoice,
              modelId: audioGeneration.selectedModel,
              provider: selectedProvider,
              voiceSettings: selectedProvider === 'elevenlabs' ? elevenLabsSettings : undefined
            }))
          } else {
            result = { success: false, error: 'Unknown provider selected' }
          }

          // Update completed sections count
          setBatchProcessing(prev => ({
            ...prev,
            completedSections: prev.completedSections + 1
        }))

        if (result.success) {
          console.log(`✅ Audio generated and uploaded for chunk ${chunk.chunkNumber}`)
            return { success: true, chunk }
        } else {
          console.error(`❌ Failed to generate audio for chunk ${chunk.chunkNumber}:`, result.error)
            return { success: false, chunk, error: result.error }
        }
      } catch (error) {
        console.error(`❌ Error generating audio for chunk ${chunk.chunkNumber}:`, error)
          setBatchProcessing(prev => ({
            ...prev,
            completedSections: prev.completedSections + 1
          }))
          return { success: false, chunk, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Count successes and errors for this batch
      const batchSuccessCount = batchResults.filter(r => r.success).length
      const batchErrorCount = batchResults.filter(r => !r.success).length
      
      totalSuccessCount += batchSuccessCount
      totalErrorCount += batchErrorCount

      showMessage(`Batch ${batchIndex + 1}/${batches.length} completed: ${batchSuccessCount} success, ${batchErrorCount} failed`, 'info')

      // Small delay between batches to avoid overwhelming the API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Reset batch processing state
    setBatchProcessing({
      isProcessing: false,
      currentBatch: 0,
      totalBatches: 0,
      completedSections: 0,
      totalSections: 0
    })

    // Show final result
    if (totalSuccessCount === textChunks.length) {
      showMessage(`🎉 Successfully generated audio for all ${totalSuccessCount} chunks!`, 'success')
    } else if (totalSuccessCount > 0 && totalErrorCount > 0) {
      showMessage(`⚠️ Generated audio for ${totalSuccessCount} chunks, ${totalErrorCount} failed`, 'info')
    } else {
      showMessage(`❌ Failed to generate audio for all ${totalErrorCount} chunks`, 'error')
    }
  }



  const playPauseAudio = (sectionId: string, audioUrl: string) => {
    const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === sectionId
    
    if (isCurrentlyPlaying) {
      // Pause current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
    } else {
      // Stop any currently playing audio first
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      
      // Create and play new audio
      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
        currentAudioRef.current = null
      })
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e)
        dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
        currentAudioRef.current = null
        showMessage('Audio playback failed', 'error')
      })
      
      // Update state first, then play
      dispatch(setAudioPlaying({ sectionId, isPlaying: true }))
      
      audio.play().catch(error => {
        console.error('Audio play failed:', error)
        dispatch(setAudioPlaying({ sectionId: null, isPlaying: false }))
        currentAudioRef.current = null
        showMessage('Failed to play audio', 'error')
      })
    }
  }

  const downloadAudio = async (sectionTitle: string, audioUrl: string) => {
    try {
      console.log(`🔽 Attempting to download audio: ${audioUrl}`)
      
      // Clean filename
      const filename = `${sectionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`
      
      // Try direct download first (works for same-origin URLs)
      try {
    const link = document.createElement('a')
    link.href = audioUrl
        link.download = filename
        link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
        
        // Check if download actually started (basic check)
        showMessage(`Download started: ${filename}`, 'success')
        return
      } catch (directError) {
        console.warn('Direct download failed, trying fetch method:', directError)
      }
      
      // Fallback: Fetch the audio and create blob URL
      showMessage('Starting download...', 'info')
      
      const response = await fetch(audioUrl, {
        method: 'GET',
        headers: {
          'Accept': 'audio/mpeg,audio/*,*/*'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      // Create download link with blob URL
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 1000)
      
      showMessage(`Audio downloaded: ${filename}`, 'success')
      
    } catch (error) {
      console.error('Audio download failed:', error)
      
      // Show specific error message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showMessage('Download failed: Network error or CORS restriction', 'error')
      } else if (error instanceof Error) {
        showMessage(`Download failed: ${error.message}`, 'error')
      } else {
        showMessage('Download failed: Unknown error', 'error')
      }
      
      // Fallback: Try opening in new tab
      try {
        window.open(audioUrl, '_blank')
        showMessage('Opened audio in new tab - you can save it manually', 'info')
      } catch (fallbackError) {
        console.error('Fallback open failed:', fallbackError)
        showMessage('Could not download or open audio file', 'error')
      }
    }
  }

  // Join all project audio files into one
  const joinAllAudio = async () => {
    if (!currentJob) return

    // Get all chunks with generated audio, sorted by chunk number
    const chunksWithAudio = audioGeneration.sectionAudioStates
      .filter(audioState => 
        audioState.result?.success && 
        audioState.audioUrl &&
        audioState.sectionId.startsWith('chunk-')
      )
      .sort((a, b) => {
        // Sort chunks by number (chunk-1, chunk-2, etc.)
        const aNum = parseInt(a.sectionId.split('-')[1]) || 0
        const bNum = parseInt(b.sectionId.split('-')[1]) || 0
        return aNum - bNum
      })

    console.log('🔗 Starting joinAllAudio process...')
    console.log('📊 Chunks with audio:', chunksWithAudio.length)
    console.log('🎯 Current environment:', window.location.origin)
    console.log('📋 Audio chunks:', chunksWithAudio.map(c => ({ id: c.sectionId, url: c.audioUrl?.substring(0, 50) + '...' })))

    if (chunksWithAudio.length === 0) {
      showMessage('No audio chunks available to join', 'error')
      return
    }

    if (chunksWithAudio.length === 1) {
      showMessage('Only one audio chunk available. Use the download button to get it.', 'info')
      return
    }

    setCombineAudioProgress({
      isGenerating: true,
      progress: 0,
      status: 'Preparing audio files for joining...'
    })

    try {
      console.log('🔄 Converting audio URLs...')
      
      // Collect and convert audio URLs to data URLs if they are blob URLs
      const audioUrlPromises = chunksWithAudio.map(async (audioState, index) => {
        const audioUrl = audioState.audioUrl!
        console.log(`📥 Processing chunk ${index + 1}: ${audioUrl.substring(0, 100)}...`)
        
        // If it's a blob URL, convert it to a data URL
        if (audioUrl.startsWith('blob:')) {
          try {
            console.log(`🔄 Converting blob URL for chunk ${index + 1}`)
            const response = await fetch(audioUrl)
            const blob = await response.blob()
            console.log(`✅ Blob fetch successful for chunk ${index + 1}, size: ${blob.size} bytes`)
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                console.log(`✅ Data URL conversion complete for chunk ${index + 1}`)
                resolve(reader.result as string)
              }
              reader.onerror = (error) => {
                console.error(`❌ Data URL conversion failed for chunk ${index + 1}:`, error)
                reject(error)
              }
              reader.readAsDataURL(blob)
            })
          } catch (error) {
            console.error(`❌ Error converting blob URL for chunk ${index + 1}:`, error)
            const chunkNumber = audioState.sectionId.split('-')[1] || '?'
            throw new Error(`Failed to convert audio file for chunk: ${chunkNumber}`)
          }
        }
        
        // If it's already a data URL or regular URL, return as-is
        console.log(`✅ Using existing URL for chunk ${index + 1}`)
        return audioUrl
      })

      setCombineAudioProgress(prev => ({
        ...prev,
        progress: 15,
        status: 'Converting audio files...'
      }))

      // Wait for all audio URLs to be converted
      const audioUrls = await Promise.all(audioUrlPromises)
      console.log('✅ All audio URLs converted, sending to API...')
      console.log('📊 Final audio URLs:', audioUrls.map((url, i) => `${i + 1}: ${url.substring(0, 50)}...`))

      setCombineAudioProgress(prev => ({
        ...prev,
        progress: 25,
        status: 'Sending audio files to join service...'
      }))

      // Send to audio joining API
      console.log('🚀 Sending POST request to /api/join-audio...')
      console.log('📦 Request payload:', {
        audioUrlsCount: audioUrls.length,
        projectName: currentJob.name,
        audioUrlTypes: audioUrls.map(url => url.startsWith('data:') ? 'data' : url.startsWith('blob:') ? 'blob' : 'url')
      })

      const response = await fetch('/api/join-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrls: audioUrls,
          projectName: currentJob.name
        })
      })

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })

      let data
      try {
        data = await response.json()
        console.log('📊 Response data:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError)
        const responseText = await response.text()
        console.error('📄 Raw response text:', responseText)
        throw new Error(`Failed to parse server response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
      }

      if (!response.ok) {
        console.error('❌ Server returned error:', data)
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`)
      }

      setCombineAudioProgress(prev => ({
        ...prev,
        progress: 75,
        status: 'Processing and joining audio...'
      }))

      if (data.success) {
        setCombineAudioProgress(prev => ({
          ...prev,
          progress: 100,
          status: 'Audio joining completed!'
        }))

                // Store joined audio URL for download
        const audioUrl = data.audioUrl
        const filename = data.filename || `${currentJob.name.replace(/[^a-zA-Z0-9]/g, '_')}_joined_audio.mp3`
        
        // Store the joined audio URL in state
        setJoinedAudioUrl(audioUrl)
        showMessage(`Successfully joined ${chunksWithAudio.length} audio chunks! Ready for download: ${filename}`, 'success')
      } else {
        throw new Error(data.error || 'Audio joining failed')
      }
    } catch (error) {
      console.error('❌ [JOIN-AUDIO] Error during join process:', error)
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to join audio files'
      
      if (error instanceof Error) {
        console.error('❌ [JOIN-AUDIO] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
        
        if (error.message.includes('FFmpeg')) {
          errorMessage = 'Server does not have FFmpeg installed. Please contact administrator.'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error: Cannot connect to join-audio service. Check your internet connection.'
        } else if (error.message.includes('Unauthorized')) {
          errorMessage = 'Authentication error: Please log in again.'
        } else if (error.message.includes('Failed to parse')) {
          errorMessage = 'Server response error: Invalid response format.'
        } else {
          errorMessage = error.message
        }
      }
      
      showMessage(errorMessage, 'error')
    } finally {
      setTimeout(() => {
        setCombineAudioProgress({
          isGenerating: false,
          progress: 0,
          status: ''
        })
      }, 3000)
    }
  }

  // Load VoiceMaker voices
  const loadVoicemakerVoices = async () => {
    setLoadingVoicemakerVoices(true)
    try {
      const response = await fetch('/api/voicemaker/voices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'en-US'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setVoicemakerVoices(data.voices || [])
        showMessage(`Loaded ${data.voices?.length || 0} VoiceMaker voices`, 'success')
      } else {
        throw new Error(data.error || 'Failed to load VoiceMaker voices')
      }
    } catch (error) {
      console.error('Error loading VoiceMaker voices:', error)
      showMessage('Failed to load VoiceMaker voices', 'error')
    } finally {
      setLoadingVoicemakerVoices(false)
    }
  }

  // Load Fish Audio voices
  const loadFishAudioVoices = async () => {
    setLoadingFishAudioVoices(true)
    try {
      const response = await fetch('/api/fishaudio/voices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFishAudioVoices(data.voices || [])
        setFishAudioModels(data.models || [])
        showMessage(`Loaded ${data.voices?.length || 0} Fish Audio voices`, 'success')
      } else {
        throw new Error(data.error || 'Failed to load Fish Audio voices')
      }
    } catch (error) {
      console.error('Error loading Fish Audio voices:', error)
      showMessage('Failed to load Fish Audio voices', 'error')
    } finally {
      setLoadingFishAudioVoices(false)
    }
  }

  // Load Minimax voices
  const loadMinimaxVoices = async () => {
    setLoadingMinimaxVoices(true)
    try {
      const response = await fetch('/api/minimax/voices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMinimaxVoices(data.voices || [])
        setMinimaxModels(data.models || [])
        showMessage(`Loaded ${data.voices?.length || 0} Minimax voices`, 'success')
      } else {
        throw new Error(data.error || 'Failed to load Minimax voices')
      }
    } catch (error) {
      console.error('Error loading Minimax voices:', error)
      showMessage('Failed to load Minimax voices', 'error')
    } finally {
      setLoadingMinimaxVoices(false)
    }
  }

  // Generate audio with Fish Audio
  const generateFishAudio = async (sectionId: string, scriptText: string) => {
    if (!audioGeneration.selectedVoice) {
      showMessage('Please select a voice first', 'error')
      return
    }

    if (!user.isLoggedIn) {
      showMessage('Please log in to generate audio', 'error')
      return
    }

    // Strip research data brackets before sending to audio generation
    const cleanScriptText = stripResearchData(scriptText)

    const result = await dispatch(generateAudioThunk({
      sectionId,
      text: cleanScriptText,
      voiceId: audioGeneration.selectedVoice,
      modelId: audioGeneration.selectedModel || 'speech-1',
      provider: 'fishaudio'
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Fish Audio generated successfully! ${result.result.chunksGenerated || 1}/${result.result.totalChunks || 1} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate Fish Audio', 'error')
    }
  }

  // Generate audio with Minimax
  const generateMinimaxAudio = async (sectionId: string, scriptText: string) => {
    if (!audioGeneration.selectedVoice) {
      showMessage('Please select a voice first', 'error')
      return
    }

    if (!user.isLoggedIn) {
      showMessage('Please log in to generate audio', 'error')
      return
    }

    // Strip research data brackets before sending to audio generation
    const cleanScriptText = stripResearchData(scriptText)

    const result = await dispatch(generateAudioThunk({
      sectionId,
      text: cleanScriptText,
      voiceId: audioGeneration.selectedVoice,
      modelId: audioGeneration.selectedModel || 'speech-02-hd',
      provider: 'minimax'
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Minimax audio generated successfully! ${result.result.chunksGenerated || 1}/${result.result.totalChunks || 1} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate Minimax audio', 'error')
    }
  }



  const selectedVoiceName = (() => {
    // Check API voices first
    const apiVoice = selectedProvider === 'elevenlabs' 
      ? audioGeneration.voices.find(v => v.id === audioGeneration.selectedVoice)
      : selectedProvider === 'voicemaker'
      ? voicemakerVoices.find(v => v.VoiceId === audioGeneration.selectedVoice)
      : fishAudioVoices.find(v => v.id === audioGeneration.selectedVoice)
    
    if (apiVoice) {
      return selectedProvider === 'elevenlabs' 
        ? apiVoice.name
        : selectedProvider === 'voicemaker'
        ? apiVoice.VoiceWebname
        : apiVoice.name
    }
    
    // Check custom voices
    const customVoice = customVoices.find(v => v.voice_id === audioGeneration.selectedVoice && v.provider === selectedProvider)
    if (customVoice) {
      return customVoice.name
    }
    
    return 'Unknown Voice'
  })()

  // Function to get voice name from stored voiceId (for generated audio chunks)
  const getVoiceNameFromId = (voiceId: string, provider?: string) => {
    if (!voiceId) return 'Unknown Voice'

    // Determine provider from context if not provided
    const detectedProvider = provider || selectedProvider

    // Check API voices based on provider
    if (detectedProvider === 'elevenlabs') {
      const voice = audioGeneration.voices.find(v => v.id === voiceId)
      if (voice) return voice.name
    } else if (detectedProvider === 'voicemaker') {
      const voice = voicemakerVoices.find(v => v.VoiceId === voiceId)
      if (voice) return voice.VoiceWebname
    } else if (detectedProvider === 'fishaudio') {
      const voice = fishAudioVoices.find(v => v.id === voiceId)
      if (voice) return voice.name
    } else if (detectedProvider === 'minimax') {
      const voice = minimaxVoices.find(v => v.voice_id === voiceId)
      if (voice) return voice.name
    }
    
    // Check custom voices across all providers
    const customVoice = customVoices.find(v => v.voice_id === voiceId)
    if (customVoice) return customVoice.name
    
    return `Voice ${voiceId}`
  }
  const sectionsWithScripts = currentJob?.sections.filter(s => s.texts && s.texts.length > 0) || []



  // Voice Manager Functions
  const loadCustomVoices = async () => {
    setLoadingCustomVoices(true)
    try {
      const response = await fetch('/api/voices')
      const data = await response.json()
      
      if (response.ok) {
        setCustomVoices(data.voices || [])
      } else {
        showMessage(data.error || 'Failed to load custom voices', 'error')
      }
    } catch (error) {
      showMessage('Failed to load custom voices', 'error')
    } finally {
      setLoadingCustomVoices(false)
    }
  }

  const saveCustomVoice = async () => {
    if (!voiceForm.name.trim() || !voiceForm.voice_id.trim()) {
      showMessage('Please fill in all fields', 'error')
      return
    }

    try {
      const url = '/api/voices'
      const method = editingVoice ? 'PUT' : 'POST'
      const body = editingVoice 
        ? { id: editingVoice.id, ...voiceForm }
        : voiceForm

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        showMessage(
          editingVoice ? 'Voice updated successfully' : 'Voice added successfully',
          'success'
        )
        loadCustomVoices()
        setShowAddVoiceDialog(false)
        setEditingVoice(null)
        setVoiceForm({
          name: '',
          voice_id: '',
          provider: 'elevenlabs'
        })
      } else {
        showMessage(data.error || 'Failed to save voice', 'error')
      }
    } catch (error) {
      showMessage('Failed to save voice', 'error')
    }
  }

  const deleteCustomVoice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this voice?')) return

    try {
      const response = await fetch(`/api/voices?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        showMessage('Voice deleted successfully', 'success')
        loadCustomVoices()
      } else {
        showMessage(data.error || 'Failed to delete voice', 'error')
      }
    } catch (error) {
      showMessage('Failed to delete voice', 'error')
    }
  }

  const startEditVoice = (voice: any) => {
    setEditingVoice(voice)
    setVoiceForm({
      name: voice.name,
      voice_id: voice.voice_id,
      provider: voice.provider
    })
    setShowAddVoiceDialog(true)
  }

  // Load custom voices on component mount
  useEffect(() => {
    loadCustomVoices()
  }, [])

  // Initialize edited script when sections change (only if not already edited)
  useEffect(() => {
    if (sectionsWithScripts.length > 0 && !isScriptEdited) {
      const currentScript = sectionsWithScripts
        .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
        .map(section => stripResearchData(section.texts[0].generated_script))
        .join('\n\n')
      setEditedScript(currentScript)
    }
  }, [sectionsWithScripts, isScriptEdited])



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

      {/* Script Text */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Script Text {isScriptEdited && <span className="text-orange-600">(Edited)</span>}
              </CardTitle>
              <CardDescription>
                {currentJob && sectionsWithScripts.length > 0 
                  ? (isScriptEdited ? 'Edited script text for reference' : `Complete script text from your project: ${currentJob.name} - for reference only`)
                  : 'Enter or paste your script text for audio generation'
                }
              </CardDescription>
            </div>
            {isScriptEdited && currentJob && sectionsWithScripts.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // Reset to original script
                    const originalScript = sectionsWithScripts
                      .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
                      .map(section => stripResearchData(section.texts[0].generated_script))
                      .join('\n\n')
                    setEditedScript(originalScript)
                    setIsScriptEdited(false)
                    showMessage('Script reset to original', 'info')
                  }}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset to Original
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={editedScript}
            onChange={(e) => {
              setEditedScript(e.target.value)
              setIsScriptEdited(true)
            }}
            className="min-h-[200px] font-mono text-sm"
            placeholder={currentJob && sectionsWithScripts.length > 0 
              ? "Generated script will appear here for editing..." 
              : "Enter your script text here for audio generation..."
            }
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{editedScript.length} characters • ~{editedScript.trim().split(/\s+/).length} words</span>
            <span>Est. ~{Math.ceil(editedScript.trim().split(/\s+/).length / 150)} min duration</span>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Audio Generation Info</p>
                <p className="mt-1">
                  Audio is generated from this combined script, chunked by provider limits (e.g. Minimax: 3k chars). 
                  Each chunk is automatically uploaded to Supabase storage for permanent access.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Voice Configuration
          </CardTitle>
          <CardDescription>
            Choose your provider, voice and model settings for audio generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Provider
            </label>
            <Select 
              value={selectedProvider} 
              onValueChange={(value: 'elevenlabs' | 'voicemaker' | 'fishaudio' | 'minimax') => {
                setSelectedProvider(value)
                // Clear selected voice when switching providers
                dispatch(setSelectedVoice(''))
                // Load voices for the new provider
                if (value === 'voicemaker' && voicemakerVoices.length === 0) {
                  loadVoicemakerVoices()
                } else if (value === 'fishaudio' && fishAudioVoices.length === 0) {
                  loadFishAudioVoices()
                } else if (value === 'minimax' && minimaxVoices.length === 0) {
                  loadMinimaxVoices()
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elevenlabs">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3 w-3" />
                    ElevenLabs (Premium Quality)
                  </div>
                </SelectItem>
                <SelectItem value="voicemaker">
                  <div className="flex items-center gap-2">
                    <Mic className="h-3 w-3" />
                    VoiceMaker.in (Cost Effective)
                  </div>
                </SelectItem>
                <SelectItem value="fishaudio">
                  <div className="flex items-center gap-2">
                    <Fish className="h-3 w-3" />
                    Fish Audio (AI Powered)
                  </div>
                </SelectItem>
                <SelectItem value="minimax">
                  <div className="flex items-center gap-2">
                    <Music className="h-3 w-3" />
                    Minimax (Text-to-Audio)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice
              </label>
              <Select 
                value={audioGeneration.selectedVoice} 
                onValueChange={(value) => dispatch(setSelectedVoice(value))}
                  disabled={selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : (selectedProvider === 'fishaudio' ? loadingFishAudioVoices : loadingMinimaxVoices))}
              >
                <SelectTrigger>
                    <SelectValue placeholder={
                      selectedProvider === 'elevenlabs' 
                        ? (audioGeneration.loadingVoices ? "Loading ElevenLabs voices..." : "Select an ElevenLabs voice")
                        : selectedProvider === 'voicemaker'
                        ? (loadingVoicemakerVoices ? "Loading VoiceMaker voices..." : "Select a VoiceMaker voice")
                        : selectedProvider === 'fishaudio'
                        ? (loadingFishAudioVoices ? "Loading Fish Audio voices..." : "Select a Fish Audio voice")
                        : (loadingMinimaxVoices ? "Loading Minimax voices..." : "Select a Minimax voice")
                    } />
                </SelectTrigger>
                <SelectContent>
                    {selectedProvider === 'elevenlabs' 
                      ? [
                          // API voices
                          ...audioGeneration.voices.map((voice) => (
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
                          )),
                          // Custom voices for this provider
                          ...customVoices.filter(v => v.provider === 'elevenlabs').map((voice) => (
                            <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                              <div className="flex items-center gap-2">
                                <Mic className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                                  Custom
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ]
                      : selectedProvider === 'voicemaker'
                      ? [
                          // API voices
                          ...voicemakerVoices.map((voice) => (
                            <SelectItem key={voice.VoiceId} value={voice.VoiceId}>
                              <div className="flex items-center gap-2">
                                <Mic className="h-3 w-3" />
                                {voice.VoiceWebname}
                                <Badge variant="outline" className="text-xs">
                                  {voice.VoiceGender}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {voice.Country}
                                </Badge>
                              </div>
                            </SelectItem>
                          )),
                          // Custom voices for this provider
                          ...customVoices.filter(v => v.provider === 'voicemaker').map((voice) => (
                            <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                              <div className="flex items-center gap-2">
                                <Mic className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-600">
                                  Custom
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ]
                      : selectedProvider === 'minimax'
                      ? [
                          // API voices
                          ...minimaxVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex items-center gap-2">
                                <Music className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs">
                                  {voice.category}
                                </Badge>
                              </div>
                            </SelectItem>
                          )),
                          // Custom voices for this provider
                          ...customVoices.filter(v => v.provider === 'minimax').map((voice) => (
                            <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                              <div className="flex items-center gap-2">
                                <Music className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600">
                                  Custom
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ]
                      : [
                          // API voices
                          ...fishAudioVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex items-center gap-2">
                                <Fish className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs">
                                  AI Voice
                                </Badge>
                              </div>
                            </SelectItem>
                          )),
                          // Custom voices for this provider
                          ...customVoices.filter(v => v.provider === 'fishaudio').map((voice) => (
                            <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                              <div className="flex items-center gap-2">
                                <Fish className="h-3 w-3" />
                                {voice.name}
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600">
                                  Custom
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ]
                    }
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model/Engine
              </label>
              {selectedProvider === 'elevenlabs' ? (
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
              ) : selectedProvider === 'voicemaker' ? (
                <Select 
                  value="neural" 
                  onValueChange={() => {}} // VoiceMaker only has neural engine
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neural">Neural Engine (High Quality)</SelectItem>
                  </SelectContent>
                </Select>
              ) : selectedProvider === 'minimax' ? (
                <Select 
                  value={audioGeneration.selectedModel || 'speech-02-hd'} 
                  onValueChange={(value) => dispatch(setSelectedAudioModel(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="speech-02-hd">Speech 02 HD (Best Quality & Stability)</SelectItem>
                    <SelectItem value="speech-02-turbo">Speech 02 Turbo (Enhanced Multilingual)</SelectItem>
                    <SelectItem value="speech-01-hd">Speech 01 HD (Rich Voices & Emotions)</SelectItem>
                    <SelectItem value="speech-01-turbo">Speech 01 Turbo (Low Latency)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select 
                  value={audioGeneration.selectedModel || 'speech-1'} 
                  onValueChange={(value) => dispatch(setSelectedAudioModel(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fishAudioModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* ElevenLabs Voice Settings */}
          {selectedProvider === 'elevenlabs' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                ElevenLabs Voice Settings
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Stability ({elevenLabsSettings.stability})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={elevenLabsSettings.stability}
                    onChange={(e) => setElevenLabsSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-blue-600 mt-1">Lower values = more emotional range, Higher values = more stable</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Similarity Boost ({elevenLabsSettings.similarity_boost})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={elevenLabsSettings.similarity_boost}
                    onChange={(e) => setElevenLabsSettings(prev => ({ ...prev, similarity_boost: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-blue-600 mt-1">How closely AI should adhere to the original voice</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Style ({elevenLabsSettings.style})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={elevenLabsSettings.style}
                    onChange={(e) => setElevenLabsSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-blue-600 mt-1">Style exaggeration of the voice (0 = default)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Speed ({elevenLabsSettings.speed})
                  </label>
                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.25"
                    value={elevenLabsSettings.speed}
                    onChange={(e) => setElevenLabsSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-blue-600 mt-1">Speech speed (1.0 = normal speed)</p>
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-blue-800">
                    <input
                      type="checkbox"
                      checked={elevenLabsSettings.use_speaker_boost}
                      onChange={(e) => setElevenLabsSettings(prev => ({ ...prev, use_speaker_boost: e.target.checked }))}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    Speaker Boost
                  </label>
                  <p className="text-xs text-blue-600 mt-1 ml-6">Boosts similarity to original speaker (increases latency)</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={selectedProvider === 'elevenlabs' ? loadVoices : (selectedProvider === 'voicemaker' ? loadVoicemakerVoices : (selectedProvider === 'fishaudio' ? loadFishAudioVoices : loadMinimaxVoices))}
              variant="outline"
              size="sm"
              disabled={selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : (selectedProvider === 'fishaudio' ? loadingFishAudioVoices : loadingMinimaxVoices))}
            >
              {(selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : (selectedProvider === 'fishaudio' ? loadingFishAudioVoices : loadingMinimaxVoices))) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh {selectedProvider === 'elevenlabs' ? 'ElevenLabs' : (selectedProvider === 'voicemaker' ? 'VoiceMaker' : (selectedProvider === 'minimax' ? 'Minimax' : 'Fish Audio'))} Voices
            </Button>
            {((selectedProvider === 'elevenlabs' && audioGeneration.voices.length > 0) || 
              (selectedProvider === 'voicemaker' && voicemakerVoices.length > 0) ||
              (selectedProvider === 'fishaudio' && fishAudioVoices.length > 0) ||
              customVoices.filter(v => v.provider === selectedProvider).length > 0) && (
              <Badge variant="secondary">
                {(() => {
                  const apiVoices = selectedProvider === 'elevenlabs' ? audioGeneration.voices.length : 
                    (selectedProvider === 'voicemaker' ? voicemakerVoices.length : fishAudioVoices.length)
                  const customVoicesCount = customVoices.filter(v => v.provider === selectedProvider).length
                  const total = apiVoices + customVoicesCount
                  return `${total} voices available${customVoicesCount > 0 ? ` (${customVoicesCount} custom)` : ''}`
                })()}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Manager
          </CardTitle>
          <CardDescription>
            Manage your custom voices for all providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={loadCustomVoices}
                variant="outline"
                size="sm"
                disabled={loadingCustomVoices}
              >
                {loadingCustomVoices ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
              {customVoices.length > 0 && (
                <Badge variant="secondary">
                  {customVoices.length} custom voices
                </Badge>
              )}
            </div>
            
            <Dialog open={showAddVoiceDialog} onOpenChange={setShowAddVoiceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => {
                  setEditingVoice(null)
                  setVoiceForm({
                    name: '',
                    voice_id: '',
                    provider: 'elevenlabs'
                  })
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Voice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingVoice ? 'Edit Voice' : 'Add Custom Voice'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Name
                    </label>
                    <Input
                      value={voiceForm.name}
                      onChange={(e) => setVoiceForm({ ...voiceForm, name: e.target.value })}
                      placeholder="e.g., My Custom Voice"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice ID
                    </label>
                    <Input
                      value={voiceForm.voice_id}
                      onChange={(e) => setVoiceForm({ ...voiceForm, voice_id: e.target.value })}
                      placeholder="e.g., voice_id_from_provider"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <Select 
                      value={voiceForm.provider} 
                      onValueChange={(value: 'elevenlabs' | 'voicemaker' | 'fishaudio' | 'minimax') => 
                        setVoiceForm({ ...voiceForm, provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        <SelectItem value="voicemaker">VoiceMaker</SelectItem>
                        <SelectItem value="fishaudio">Fish Audio</SelectItem>
                        <SelectItem value="minimax">Minimax</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={saveCustomVoice}
                      className="flex-1"
                    >
                      {editingVoice ? 'Update Voice' : 'Add Voice'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddVoiceDialog(false)
                        setEditingVoice(null)
                        setVoiceForm({
                          name: '',
                          voice_id: '',
                          provider: 'elevenlabs'
                        })
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Voice List */}
          {customVoices.length > 0 ? (
            <div className="space-y-2">
              {customVoices.map((voice) => (
                <div key={voice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {voice.provider === 'elevenlabs' && <Volume2 className="h-4 w-4 text-blue-600" />}
                      {voice.provider === 'voicemaker' && <Mic className="h-4 w-4 text-green-600" />}
                      {voice.provider === 'fishaudio' && <Fish className="h-4 w-4 text-purple-600" />}
                    </div>
                    <div>
                      <h4 className="font-medium">{voice.name}</h4>
                      <p className="text-sm text-gray-600">
                        {voice.voice_id} • {voice.provider}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      voice.provider === 'elevenlabs' ? 'text-blue-600 border-blue-300' :
                      voice.provider === 'voicemaker' ? 'text-green-600 border-green-300' :
                      'text-purple-600 border-purple-300'
                    }>
                      {voice.provider}
                    </Badge>
                    <Button
                      onClick={() => startEditVoice(voice)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => deleteCustomVoice(voice.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mic className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No custom voices yet</p>
              <p className="text-sm">Add your first custom voice to get started</p>
            </div>
          )}
        </CardContent>
      </Card>







      {/* Generate Audio Button */}
      {editedScript.trim().length > 0 && (
        <div className="flex flex-col gap-4">

          <Button
            onClick={generateAllAudioInBatches}
            disabled={!audioGeneration.selectedVoice || batchProcessing.isProcessing}
            className="bg-blue-600 hover:bg-blue-700 w-full"
            size="lg"
          >
            {batchProcessing.isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating ({batchProcessing.completedSections}/{batchProcessing.totalSections})
              </>
            ) : (
              <>
                <Music className="h-4 w-4 mr-2" />
                {(() => {
                  const hasExistingAudio = audioGeneration.sectionAudioStates.some(state => 
                    state.result?.success
                  )
                  const estimatedChunks = Math.ceil(editedScript.length / 3000) // rough estimate
                  return hasExistingAudio 
                    ? `Regenerate Audio (${estimatedChunks} chunks)`
                    : `Generate Audio (${estimatedChunks} chunks)`
                })()}
              </>
            )}
          </Button>

          {/* Batch Processing Progress */}
          {batchProcessing.isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Processing Batch {batchProcessing.currentBatch} of {batchProcessing.totalBatches}
                </span>
                <span className="text-sm text-blue-700">
                  {batchProcessing.completedSections}/{batchProcessing.totalSections} chunks
                </span>
              </div>
              <Progress 
                value={(batchProcessing.completedSections / batchProcessing.totalSections) * 100} 
                className="w-full"
              />
              <p className="text-xs text-blue-600 mt-2">
                Processing and uploading text chunks in batches of 5 for optimal performance
              </p>
            </div>
          )}

          {/* Join Audio Progress */}
          {combineAudioProgress.isGenerating && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-900">
                  {combineAudioProgress.status}
                </span>
                <span className="text-sm text-green-700">{combineAudioProgress.progress}%</span>
              </div>
              <Progress value={combineAudioProgress.progress} className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* Individual Audio Results */}
      {!combineAudioProgress.isGenerating && (
        <div className="space-y-4">
          {audioGeneration.sectionAudioStates
            .filter(audioState => 
              audioState.result?.success && 
              audioState.sectionId.startsWith('chunk-')
            )
            .sort((a, b) => {
              // Sort chunks by number (chunk-1, chunk-2, etc.)
              const aNum = parseInt(a.sectionId.split('-')[1]) || 0
              const bNum = parseInt(b.sectionId.split('-')[1]) || 0
              return aNum - bNum
            })
            .map(audioState => {
              const chunkNumber = audioState.sectionId.split('-')[1] || '?'
              const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === audioState.sectionId
                
              return (
                <Card key={audioState.sectionId} className="bg-green-50 border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-green-900">Chunk {chunkNumber}</h4>
                        <p className="text-sm text-green-700">
                           {Math.round((audioState.result?.audioSize || 0) / 1024)}KB • {getVoiceNameFromId(audioState.result?.voiceId || '', audioState.result?.provider)} • Stored in Supabase
                         </p>
                          </div>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                        Ready
                        </Badge>
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
                        onClick={() => {
                          window.open(audioState.audioUrl!, '_blank')
                          showMessage(`Download page opened: Chunk ${chunkNumber}`, 'success')
                        }}
                          variant="outline"
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                  </CardContent>
                </Card>
              )
            })}
                    </div>
                  )}

      {/* Join Audio Button - Show when multiple chunks are available */}
      {(() => {
        const chunksWithAudio = audioGeneration.sectionAudioStates.filter(audioState => 
          audioState.result?.success && 
          audioState.audioUrl &&
          audioState.sectionId.startsWith('chunk-')
        )
        
        if (chunksWithAudio.length <= 1) return null
        
        return (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-blue-900">Join Audio Chunks</h4>
                  <p className="text-sm text-blue-700">
                    {chunksWithAudio.length} chunks ready to be joined into one audio file
                  </p>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  {chunksWithAudio.length} chunks
                </Badge>
              </div>
              
              <Button
                onClick={joinAllAudio}
                disabled={combineAudioProgress.isGenerating}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {combineAudioProgress.isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Music className="h-4 w-4 mr-2" />
                    Join Audio Chunks
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )
      })()}

      {/* Download Joined Audio - Show when joined audio is available */}
      {joinedAudioUrl && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-green-900">Joined Audio Ready</h4>
                <p className="text-sm text-green-700">
                  Audio chunks have been joined successfully • Stored in Supabase
                </p>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-300">
                Ready
              </Badge>
            </div>
            
            <Button
              onClick={() => {
                window.open(joinedAudioUrl, '_blank')
                showMessage(`Download page opened: Joined Audio`, 'success')
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Joined Audio
            </Button>
          </CardContent>
        </Card>
      )}

      

    </div>
  )
} 