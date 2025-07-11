'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Loader2, Volume2, Download, Play, Pause, RefreshCw, Mic, Music, AlertCircle, CheckCircle, Settings, FileText, Fish, Plus, Edit, Trash2 } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'

export function AudioGeneration() {
  const dispatch = useAppDispatch()
  const { currentJob, audioGeneration } = useAppSelector(state => state.scripts)
  const user = useAppSelector(state => state.user)
  
  // Add ref to store current audio instance
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [customText, setCustomText] = useState('')
  const [customTitle, setCustomTitle] = useState('')
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
  const [selectedProvider, setSelectedProvider] = useState<'elevenlabs' | 'voicemaker' | 'fishaudio'>('elevenlabs')
  const [voicemakerVoices, setVoicemakerVoices] = useState<any[]>([])
  const [loadingVoicemakerVoices, setLoadingVoicemakerVoices] = useState(false)
  const [fishAudioVoices, setFishAudioVoices] = useState<any[]>([])
  const [fishAudioModels, setFishAudioModels] = useState<any[]>([])
  const [loadingFishAudioVoices, setLoadingFishAudioVoices] = useState(false)
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
  
  // New state for auto-concatenation checkbox
  const [autoConcatenateAfterGeneration, setAutoConcatenateAfterGeneration] = useState(false)
  const [joinedScriptText, setJoinedScriptText] = useState('')
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
    provider: 'elevenlabs' as 'elevenlabs' | 'voicemaker' | 'fishaudio'
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
      provider: selectedProvider
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
      modelId: audioGeneration.selectedModel,
      provider: selectedProvider
    }))

    if (result.success) {
      const sizeInKB = Math.round((result.result.audioSize || 0) / 1024)
      showMessage(
        `Custom audio generated successfully! ${result.result.chunksGenerated || 1}/${result.result.totalChunks || 1} chunks, ${sizeInKB}KB`,
        'success'
      )
    } else {
      showMessage(result.error || 'Failed to generate custom audio', 'error')
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

    if (!currentJob || sectionsWithScripts.length === 0) {
      showMessage('No scripts available to generate audio from', 'error')
      return
    }

    // Find sections that have scripts but don't have audio generated yet
    const sectionsNeedingAudio = sectionsWithScripts.filter(section => {
      const audioState = audioGeneration.sectionAudioStates.find(s => s.sectionId === section.id)
      return !audioState?.result?.success && !audioState?.isGenerating
    })

    if (sectionsNeedingAudio.length === 0) {
      showMessage('All sections already have audio generated or are currently generating', 'info')
      return
    }

    // Split sections into batches of 5
    const batchSize = 5
    const batches = []
    for (let i = 0; i < sectionsNeedingAudio.length; i += batchSize) {
      batches.push(sectionsNeedingAudio.slice(i, i + batchSize))
    }

    // Initialize batch processing state
    setBatchProcessing({
      isProcessing: true,
      currentBatch: 0,
      totalBatches: batches.length,
      completedSections: 0,
      totalSections: sectionsNeedingAudio.length
    })

    showMessage(`Starting audio generation for ${sectionsNeedingAudio.length} sections in ${batches.length} batch(es)...`, 'info')

    let totalSuccessCount = 0
    let totalErrorCount = 0

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      setBatchProcessing(prev => ({
        ...prev,
        currentBatch: batchIndex + 1
      }))

      // Process sections in current batch asynchronously
      const batchPromises = batch.map(async (section) => {
      try {
        const scriptText = section.texts[0].generated_script
        const cleanScriptText = stripResearchData(scriptText)
        
          let result
          if (selectedProvider === 'elevenlabs' || selectedProvider === 'fishaudio') {
            result = await dispatch(generateAudioThunk({
          sectionId: section.id,
          text: cleanScriptText,
          voiceId: audioGeneration.selectedVoice,
              modelId: audioGeneration.selectedModel,
              provider: selectedProvider
            }))
          } else if (selectedProvider === 'voicemaker') {
            try {
              await generateVoicemakerAudio(section.id, cleanScriptText)
              result = { success: true }
            } catch (error) {
              result = { success: false, error: error instanceof Error ? error.message : 'VoiceMaker generation failed' }
            }
          } else {
            result = { success: false, error: 'Unknown provider selected' }
          }

          // Update completed sections count
          setBatchProcessing(prev => ({
            ...prev,
            completedSections: prev.completedSections + 1
        }))

        if (result.success) {
          console.log(`✅ Audio generated for section: ${section.title}`)
            return { success: true, section }
        } else {
          console.error(`❌ Failed to generate audio for section: ${section.title}`, result.error)
            return { success: false, section, error: result.error }
        }
      } catch (error) {
        console.error(`❌ Error generating audio for section: ${section.title}`, error)
          setBatchProcessing(prev => ({
            ...prev,
            completedSections: prev.completedSections + 1
          }))
          return { success: false, section, error: error instanceof Error ? error.message : 'Unknown error' }
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
    if (totalSuccessCount === sectionsNeedingAudio.length) {
      showMessage(`🎉 Successfully generated audio for all ${totalSuccessCount} sections!`, 'success')
      
      // Auto-concatenate if checkbox is checked and we have multiple successful generations
      if (autoConcatenateAfterGeneration && totalSuccessCount > 1) {
        showMessage('🔄 Auto-concatenating audio files...', 'info')
        setTimeout(() => {
          combineAllAudio()
        }, 2000)
      }
    } else if (totalSuccessCount > 0 && totalErrorCount > 0) {
      showMessage(`⚠️ Generated audio for ${totalSuccessCount} sections, ${totalErrorCount} failed`, 'info')
      
      // Auto-concatenate if checkbox is checked and we have multiple successful generations
      if (autoConcatenateAfterGeneration && totalSuccessCount > 1) {
        showMessage('🔄 Auto-concatenating successfully generated audio files...', 'info')
        setTimeout(() => {
          combineAllAudio()
        }, 2000)
      }
    } else {
      showMessage(`❌ Failed to generate audio for all ${totalErrorCount} sections`, 'error')
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

  const downloadAudio = (sectionTitle: string, audioUrl: string) => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `${sectionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Combine all project audio files into one
  const combineAllAudio = async () => {
    if (!currentJob) return

    // Get all sections with generated audio, sorted by their order
    const sectionsWithAudio = currentJob.sections
      .filter(section => {
        const audioState = audioGeneration.sectionAudioStates.find(s => s.sectionId === section.id)
        return audioState?.result?.success && audioState.audioUrl
      })
      .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))

    if (sectionsWithAudio.length === 0) {
      showMessage('No audio files available to combine', 'error')
      return
    }

    if (sectionsWithAudio.length === 1) {
      showMessage('Only one audio file available. Use the download button to get it.', 'info')
      return
    }

    setCombineAudioProgress({
      isGenerating: true,
      progress: 0,
      status: 'Preparing audio files for combination...'
    })

    try {
      // Collect all audio URLs in chronological order
      const audioUrls = sectionsWithAudio.map(section => {
        const audioState = audioGeneration.sectionAudioStates.find(s => s.sectionId === section.id)
        return {
          url: audioState!.audioUrl!,
          title: section.title,
          order: section.section_order || 0
        }
      })

      setCombineAudioProgress(prev => ({
        ...prev,
        progress: 25,
        status: 'Sending audio files to combination service...'
      }))

      // Send to audio combination API
      const response = await fetch('/api/elevenlabs/combine-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrls: audioUrls.map(a => a.url),
          projectName: currentJob.name,
          projectId: currentJob.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to combine audio files')
      }

      setCombineAudioProgress(prev => ({
        ...prev,
        progress: 75,
        status: 'Processing and combining audio...'
      }))

      if (data.success) {
        setCombineAudioProgress(prev => ({
          ...prev,
          progress: 100,
          status: 'Audio combination completed!'
        }))

        // Create download link for combined audio
        const combinedAudioUrl = data.audioUrl
        const link = document.createElement('a')
        link.href = combinedAudioUrl
        link.download = `${currentJob.name.replace(/[^a-zA-Z0-9]/g, '_')}_combined_audio.mp3`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        showMessage(`Successfully combined ${sectionsWithAudio.length} audio files! Download started.`, 'success')
      } else {
        throw new Error(data.error || 'Audio combination failed')
      }
    } catch (error) {
      console.error('Error combining audio:', error)
      showMessage(error instanceof Error ? error.message : 'Failed to combine audio files', 'error')
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

  // Generate audio with VoiceMaker
  const generateVoicemakerAudio = async (sectionId: string, scriptText: string) => {
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

    try {
      const response = await fetch('/api/voicemaker/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId,
          text: cleanScriptText,
          voiceId: audioGeneration.selectedVoice,
          engine: 'neural',
          outputFormat: 'mp3',
          sampleRate: '48000'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        showMessage('VoiceMaker audio generated successfully!', 'success')
        // The audio state will be updated through the existing Redux flow
      } else {
        throw new Error(data.error || 'VoiceMaker audio generation failed')
      }
    } catch (error) {
      console.error('Error generating VoiceMaker audio:', error)
      showMessage(error instanceof Error ? error.message : 'Failed to generate VoiceMaker audio', 'error')
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

  // Combine selected audio sessions
  const combineSelectedSessions = async () => {
    if (selectedSessions.length < 2) {
      showMessage('Please select at least 2 audio sessions to combine', 'error')
      return
    }

    setCombineSessionsProgress({
      isGenerating: true,
      progress: 0,
      status: 'Preparing selected sessions for combination...'
    })

    try {
      // Get all audio states (both project sections and custom audio)
      const allAudioStates = [
        ...audioGeneration.sectionAudioStates,
        ...customAudioStates
      ]

      // Get selected sessions' audio URLs
      const selectedAudioData = selectedSessions.map(sessionId => {
        const audioState = allAudioStates.find(state => state.sectionId === sessionId)
        if (!audioState?.result?.success || !audioState.audioUrl) {
          throw new Error(`Audio not found for session: ${sessionId}`)
        }
        
        // Get session title
        let sessionTitle = sessionId
        if (sessionId.startsWith('custom-')) {
          sessionTitle = `Custom Audio ${sessionId.split('-')[1]}`
        } else if (currentJob) {
          const section = currentJob.sections.find(s => s.id === sessionId)
          sessionTitle = section?.title || sessionId
        }

        return {
          url: audioState.audioUrl,
          title: sessionTitle,
          sessionId: sessionId
        }
      })

      setCombineSessionsProgress(prev => ({
        ...prev,
        progress: 25,
        status: 'Sending sessions to combination service...'
      }))

      // Send to audio combination API
      const response = await fetch('/api/elevenlabs/combine-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrls: selectedAudioData.map(data => data.url),
          projectName: `Selected_Sessions_${Date.now()}`,
          projectId: 'session-combination',
          sessionTitles: selectedAudioData.map(data => data.title)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to combine selected sessions')
      }

      setCombineSessionsProgress(prev => ({
        ...prev,
        progress: 75,
        status: 'Processing and combining sessions...'
      }))

      if (data.success) {
        setCombineSessionsProgress(prev => ({
          ...prev,
          progress: 100,
          status: 'Session combination completed!'
        }))

        // Create download link for combined audio
        const combinedAudioUrl = data.audioUrl
        const link = document.createElement('a')
        link.href = combinedAudioUrl
        link.download = `combined_sessions_${Date.now()}.mp3`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        showMessage(`Successfully combined ${selectedSessions.length} audio sessions! Download started.`, 'success')
        
        // Clear selection
        setSelectedSessions([])
      } else {
        throw new Error(data.error || 'Session combination failed')
      }
    } catch (error) {
      console.error('Error combining sessions:', error)
      showMessage(error instanceof Error ? error.message : 'Failed to combine selected sessions', 'error')
    } finally {
      setTimeout(() => {
        setCombineSessionsProgress({
          isGenerating: false,
          progress: 0,
          status: ''
        })
      }, 3000)
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
  const sectionsWithScripts = currentJob?.sections.filter(s => s.texts && s.texts.length > 0) || []
  // Fix duplicate issue: Create a Map to ensure unique audio states by sectionId
  const customAudioStatesMap = new Map()
  audioGeneration.sectionAudioStates
    .filter(s => s.sectionId.startsWith('custom-'))
    .forEach(state => customAudioStatesMap.set(state.sectionId, state))
  const customAudioStates = Array.from(customAudioStatesMap.values())

  // Function to join all script texts into one
  const joinAllScriptTexts = () => {
    if (!currentJob || !sectionsWithScripts.length) return ''
    
    return sectionsWithScripts
      .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
      .map(section => {
        const scriptText = section.texts[0].generated_script
        return stripResearchData(scriptText)
      })
      .join('\n\n')
  }

  // Update joined text when sections change
  useEffect(() => {
    const joinedText = joinAllScriptTexts()
    setJoinedScriptText(joinedText)
  }, [currentJob, sectionsWithScripts])

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
              onValueChange={(value: 'elevenlabs' | 'voicemaker' | 'fishaudio') => {
                setSelectedProvider(value)
                // Clear selected voice when switching providers
                dispatch(setSelectedVoice(''))
                // Load voices for the new provider
                if (value === 'voicemaker' && voicemakerVoices.length === 0) {
                  loadVoicemakerVoices()
                } else if (value === 'fishaudio' && fishAudioVoices.length === 0) {
                  loadFishAudioVoices()
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
                {/* <SelectItem value="voicemaker">
                  <div className="flex items-center gap-2">
                    <Mic className="h-3 w-3" />
                    VoiceMaker.in (Cost Effective)
                  </div>
                </SelectItem> */}
                <SelectItem value="fishaudio">
                  <div className="flex items-center gap-2">
                    <Fish className="h-3 w-3" />
                    Fish Audio (AI Powered)
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
                  disabled={selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : loadingFishAudioVoices)}
              >
                <SelectTrigger>
                    <SelectValue placeholder={
                      selectedProvider === 'elevenlabs' 
                        ? (audioGeneration.loadingVoices ? "Loading ElevenLabs voices..." : "Select an ElevenLabs voice")
                        : selectedProvider === 'voicemaker'
                        ? (loadingVoicemakerVoices ? "Loading VoiceMaker voices..." : "Select a VoiceMaker voice")
                        : (loadingFishAudioVoices ? "Loading Fish Audio voices..." : "Select a Fish Audio voice")
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

          <div className="flex items-center gap-2">
            <Button
              onClick={selectedProvider === 'elevenlabs' ? loadVoices : (selectedProvider === 'voicemaker' ? loadVoicemakerVoices : loadFishAudioVoices)}
              variant="outline"
              size="sm"
              disabled={selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : loadingFishAudioVoices)}
            >
              {(selectedProvider === 'elevenlabs' ? audioGeneration.loadingVoices : (selectedProvider === 'voicemaker' ? loadingVoicemakerVoices : loadingFishAudioVoices)) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh {selectedProvider === 'elevenlabs' ? 'ElevenLabs' : (selectedProvider === 'voicemaker' ? 'VoiceMaker' : 'Fish Audio')} Voices
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
                      onValueChange={(value: 'elevenlabs' | 'voicemaker' | 'fishaudio') => 
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
            onClick={() => {
              if (selectedProvider === 'elevenlabs' || selectedProvider === 'fishaudio') {
                generateCustomAudio()
              } else if (selectedProvider === 'voicemaker') {
                const customSectionId = `custom-${Date.now()}`
                generateVoicemakerAudio(customSectionId, customText)
              }
            }}
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
                Generate Audio with {selectedProvider === 'elevenlabs' ? selectedVoiceName : 
                  selectedProvider === 'voicemaker' ? 
                    (voicemakerVoices.find(v => v.VoiceId === audioGeneration.selectedVoice)?.VoiceWebname || 'Selected Voice') :
                    (fishAudioVoices.find(v => v.id === audioGeneration.selectedVoice)?.name || 'Selected Voice')
                } 
                ({selectedProvider === 'elevenlabs' ? 'ElevenLabs' : selectedProvider === 'voicemaker' ? 'VoiceMaker' : 'Fish Audio'})
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
            {customAudioStates.map((audioState, index) => {
              const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === audioState.sectionId
              const displayTitle = customTitle || `Custom Audio ${audioState.sectionId.split('-')[1]}`

              return (
                <div key={`${audioState.sectionId}-${index}`} className="border rounded-lg p-4">
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
                        Processing with {selectedProvider === 'elevenlabs' ? 'ElevenLabs' : selectedProvider === 'voicemaker' ? 'VoiceMaker' : 'Fish Audio'}... This may take up to 5 minutes.
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

      {/* Session Audio Manager - Show all available audio sessions */}
      {(() => {
        // Get all available audio sessions (both project sections and custom audio)
        const allAudioStates = [
          ...audioGeneration.sectionAudioStates,
          ...customAudioStates
        ]
        const availableSessions = allAudioStates.filter(state => state.result?.success && state.audioUrl)
        
        if (availableSessions.length === 0) return null

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Audio Session Manager
                  </CardTitle>
                  <CardDescription>
                    Select and combine audio sessions from different projects and custom audio
                  </CardDescription>
                </div>
                {selectedSessions.length > 1 && (
                        <Button
                    onClick={combineSelectedSessions}
                    disabled={combineSessionsProgress.isGenerating}
                          variant="default"
                    className="flex items-center gap-2"
                  >
                    {combineSessionsProgress.isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Combining...
                            </>
                          ) : (
                            <>
                        <Music className="h-4 w-4" />
                        Combine Selected ({selectedSessions.length})
                            </>
                          )}
                        </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Selection Controls */}
              <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setSelectedSessions(availableSessions.map(s => s.sectionId))}
                    variant="outline"
                    size="sm"
                  >
                    Select All ({availableSessions.length})
                  </Button>
                  <Button
                    onClick={() => setSelectedSessions([])}
                    variant="outline"
                    size="sm"
                    disabled={selectedSessions.length === 0}
                  >
                    Clear Selection
                  </Button>
                    </div>
                <Badge variant="secondary">
                  {selectedSessions.length} of {availableSessions.length} selected
                    </Badge>
                  </div>
                  
              {/* Combine Progress */}
              {combineSessionsProgress.isGenerating && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{combineSessionsProgress.status}</span>
                    <span className="text-gray-600">{combineSessionsProgress.progress}%</span>
                  </div>
                  <Progress value={combineSessionsProgress.progress} className="w-full" />
                </div>
              )}

              {/* Session List */}
              <div className="space-y-3">
                {availableSessions.map((audioState, index) => {
                  const isSelected = selectedSessions.includes(audioState.sectionId)
                  const isCustom = audioState.sectionId.startsWith('custom-')
                  
                  // Get session title and info
                  let sessionTitle = audioState.sectionId
                  let sessionInfo = ''
                  let sessionType = 'Unknown'
                  
                  if (isCustom) {
                    sessionTitle = `Custom Audio ${audioState.sectionId.split('-')[1]}`
                    sessionType = 'Custom'
                    sessionInfo = 'Custom text-to-speech'
                  } else if (currentJob) {
                    const section = currentJob.sections.find(s => s.id === audioState.sectionId)
                    if (section) {
                      sessionTitle = section.title
                      sessionType = 'Project'
                      sessionInfo = `From project: ${currentJob.name}`
                    }
                  }

            return (
                    <div
                      key={`session-${audioState.sectionId}-${index}`}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSessions(prev => prev.filter(id => id !== audioState.sectionId))
                        } else {
                          setSelectedSessions(prev => [...prev, audioState.sectionId])
                        }
                      }}
                    >
                  <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                    <div>
                            <h4 className="font-medium">{sessionTitle}</h4>
                            <p className="text-sm text-gray-600">{sessionInfo}</p>
                          </div>
                    </div>
                    <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            sessionType === 'Project' ? 'text-blue-600 border-blue-300' : 'text-green-600 border-green-300'
                          }>
                            {sessionType}
                        </Badge>
                          <Badge variant="outline" className="text-gray-600">
                            {Math.round((audioState.result?.audioSize || 0) / 1024)}KB
                        </Badge>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              playPauseAudio(audioState.sectionId, audioState.audioUrl!)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            {audioGeneration.isPlaying && audioGeneration.currentPlayingSection === audioState.sectionId ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                    </div>
                  </div>
                    </div>
                  )
                })}
              </div>

              {/* Instructions */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Music className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">💡 Session Audio Combination</p>
                    <p>
                      Select multiple audio sessions from different projects or custom audio to combine them into one file. 
                      The audio will be joined in the order selected using FFmpeg for high-quality concatenation.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Project Overview - Only show if there's a current job */}
      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle>Project: {currentJob.name}</CardTitle>
            <CardDescription>
              {sectionsWithScripts.length} script sections • ~{joinedScriptText.split(' ').length} words total
            </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
            {/* Joined Script Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complete Script Text
              </label>
              <Textarea
                value={joinedScriptText}
                onChange={(e) => setJoinedScriptText(e.target.value)}
                placeholder="All script sections will be joined here..."
                className="min-h-[200px] font-mono text-sm"
                rows={8}
              />
              <p className="text-xs text-gray-500 mt-1">
                {joinedScriptText.length} characters • Est. ~{Math.ceil(joinedScriptText.split(' ').length / 150)} min duration
              </p>
                    </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="joinChunks"
                  checked={autoConcatenateAfterGeneration}
                  onChange={(e) => setAutoConcatenateAfterGeneration(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="joinChunks" className="text-sm font-medium text-gray-700">
                  Join audio chunks with FFmpeg
                </label>
                  </div>

                    <Button
                onClick={generateAllAudioInBatches}
                disabled={!audioGeneration.selectedVoice || batchProcessing.isProcessing || !joinedScriptText.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {batchProcessing.isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating ({batchProcessing.completedSections}/{batchProcessing.totalSections})
                        </>
                      ) : (
                        <>
                          <Music className="h-4 w-4 mr-2" />
                    Generate All Audio
                        </>
                      )}
                    </Button>
            </div>

            {/* Batch Processing Progress */}
            {batchProcessing.isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Processing Batch {batchProcessing.currentBatch} of {batchProcessing.totalBatches}
                  </span>
                  <span className="text-sm text-blue-700">
                    {batchProcessing.completedSections}/{batchProcessing.totalSections} sections
                  </span>
                </div>
                <Progress 
                  value={(batchProcessing.completedSections / batchProcessing.totalSections) * 100} 
                  className="w-full"
                />
                <p className="text-xs text-blue-600 mt-2">
                  Processing {sectionsWithScripts.length} sections in batches of 5 for optimal performance
                  {autoConcatenateAfterGeneration && " • Will auto-join with FFmpeg after completion"}
                </p>
                    </div>
                  )}

            {/* Combine Audio Progress */}
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
          </CardContent>
        </Card>
      )}

      {/* Audio Results - Only show when joining is disabled or when final audio is ready */}
      {sectionsWithScripts.length > 0 && !autoConcatenateAfterGeneration && (
        <div className="space-y-4">
          {audioGeneration.sectionAudioStates
            .filter(audioState => 
              audioState.result?.success && 
              !audioState.sectionId.startsWith('custom-') &&
              sectionsWithScripts.some(section => section.id === audioState.sectionId)
            )
            .map(audioState => {
              const section = sectionsWithScripts.find(s => s.id === audioState.sectionId)
              const isCurrentlyPlaying = audioGeneration.isPlaying && audioGeneration.currentPlayingSection === audioState.sectionId
              
              if (!section) return null
              
              return (
                <Card key={audioState.sectionId} className="bg-green-50 border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-green-900">{section.title}</h4>
                                                 <p className="text-sm text-green-700">
                           {Math.round((audioState.result?.audioSize || 0) / 1024)}KB • {selectedVoiceName}
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
                        onClick={() => downloadAudio(section.title, audioState.audioUrl!)}
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

      {/* Final Combined Audio - Only show when joining is enabled and audio is ready */}
      {sectionsWithScripts.length > 0 && autoConcatenateAfterGeneration && !batchProcessing.isProcessing && !combineAudioProgress.isGenerating && (
        (() => {
          const sectionsWithAudio = sectionsWithScripts.filter(section => {
            const audioState = audioGeneration.sectionAudioStates.find(s => s.sectionId === section.id)
            return audioState?.result?.success && audioState.audioUrl
          })
          
          return sectionsWithAudio.length > 1 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-green-900">Combined Audio Ready</h4>
                    <p className="text-sm text-green-700">
                      {sectionsWithAudio.length} sections combined • {selectedVoiceName}
                    </p>
                      </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    FFmpeg Combined
                  </Badge>
                    </div>
                
                <Button
                  onClick={combineAllAudio}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Combined Audio ({sectionsWithAudio.length} sections)
                </Button>
                </CardContent>
              </Card>
            )
        })()
      )}
    </div>
  )
} 