'use client'

import { useState, useEffect, useRef } from 'react'
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
  addUploadedMusicTrack,
  removeUploadedMusicTrack,
  toggleMusicTrackSelection,
  selectAllMusicTracks,
  deselectAllMusicTracks,
  clearAllMusicTracks,
  UploadedMusicTrack,
  startBatchGeneration,
  updateChunkProgress,
  setChunkCompleted,
  setChunkError,
  setJoiningPhase,
  completeJoinedAudio,
} from '../lib/features/audio/audioSlice'
import { MurfVoice } from '../lib/murf-utils'
import { ElevenLabsVoice } from '../lib/elevenlabs-utils'
import { SpeechifyVoice } from '../lib/speechify-utils'
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

interface CustomVoice {
  id: number
  provider: 'murf' | 'elevenlabs' | 'speechify' | 'playai' | 'minimax'
  voice_id: string
  name: string
}

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
    uploadedMusicTracks,
  } = useAppSelector(state => state.audio)
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [editableScript, setEditableScript] = useState("")
  const [murfVoices, setMurfVoices] = useState<MurfVoice[]>([])
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([])
  const [speechifyVoices, setSpeechifyVoices] = useState<SpeechifyVoice[]>([])
  const [playaiVoices, setPlayaiVoices] = useState<any[]>([])
  const [minimaxVoices, setMinimaxVoices] = useState<any[]>([])
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([])
  const [activeAudioPreview, setActiveAudioPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const manualSelectionRef = useRef<boolean>(false);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  // Fetch voices when provider changes
  useEffect(() => {
    async function fetchVoices() {
      // Fetch API voices
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
      } else if (selectedProvider === 'speechify') {
        try {
          const response = await fetch('/api/speechify-voices');
          const data = await response.json();
          
          if (data.success) {
            console.log('Speechify voices response:', data.voices);
            console.log('Valid Speechify voices loaded:', data.voices.length);
            setSpeechifyVoices(data.voices);
          } else {
            console.error('Speechify API error:', data.error);
            if (data.error && data.error.includes('mock data')) {
              showMessage('Speechify API key appears to be invalid. Please check your API key configuration.', 'error');
            } else {
              showMessage('Failed to load Speechify voices: ' + (data.error || 'Unknown error'), 'error');
            }
            setSpeechifyVoices([]);
          }
        } catch (error) {
          console.error('Error fetching Speechify voices:', error);
          showMessage('Error fetching Speechify voices', 'error');
          setSpeechifyVoices([]);
        }
      } else if (selectedProvider === 'fal-playai') {
        try {
          const response = await fetch('/api/playai-voices');
          const data = await response.json();
          
          if (data.success) {
            console.log('Play.ai voices response for FAL:', data.voices);
            console.log('Valid Play.ai voices loaded for FAL:', data.voices.length);
            setPlayaiVoices(data.voices);
          } else {
            console.error('Play.ai API error for FAL:', data.error);
            showMessage('Failed to load Play.ai voices for FAL: ' + (data.error || 'Unknown error'), 'error');
            setPlayaiVoices([]);
          }
        } catch (error) {
          console.error('Error fetching Play.ai voices for FAL:', error);
          showMessage('Error fetching Play.ai voices for FAL', 'error');
          setPlayaiVoices([]);
        }

      } else if (selectedProvider === 'playai') {
        try {
          const response = await fetch('/api/playai-voices');
          const data = await response.json();
          
          if (data.success) {
            console.log('Play.ai voices response:', data.voices);
            console.log('Valid Play.ai voices loaded:', data.voices.length);
            setPlayaiVoices(data.voices);
          } else {
            console.error('Play.ai API error:', data.error);
            showMessage('Failed to load Play.ai voices: ' + (data.error || 'Unknown error'), 'error');
            setPlayaiVoices([]);
          }
        } catch (error) {
          console.error('Error fetching Play.ai voices:', error);
          showMessage('Error fetching Play.ai voices', 'error');
          setPlayaiVoices([]);
        }
      } else if (selectedProvider === 'minimax') {
        try {
          const response = await fetch('/api/minimax-voices');
          const data = await response.json();
          
          if (data.success) {
            console.log('Minimax voices response:', data.voices);
            console.log('Valid Minimax voices loaded:', data.voices.length);
            setMinimaxVoices(data.voices);
          } else {
            console.error('Minimax API error:', data.error);
            showMessage('Failed to load Minimax voices: ' + (data.error || 'Unknown error'), 'error');
            setMinimaxVoices([]);
          }
        } catch (error) {
          console.error('Error fetching Minimax voices:', error);
          showMessage('Error fetching Minimax voices', 'error');
          setMinimaxVoices([]);
        }
      }

      // Fetch custom admin voices for the selected provider
      try {
        console.log('🎤 Fetching custom voices for provider:', selectedProvider)
        const response = await fetch('/api/admin/ai-voices');
        const data = await response.json();
        console.log('Custom voices API response:', data)
        if (data.success) {
          // Map provider names for custom voice filtering
          const providerForCustomVoices = selectedProvider === 'fal-playai' ? 'playai' : 
                                         selectedProvider;
          console.log('Filtering for provider:', providerForCustomVoices)
          const providerCustomVoices = data.voices.filter((voice: CustomVoice) => {
            console.log('Checking voice:', voice, 'against provider:', providerForCustomVoices)
            return voice.provider === providerForCustomVoices
          });
          console.log('Filtered custom voices:', providerCustomVoices)
          setCustomVoices(providerCustomVoices);
        } else {
          console.warn('Custom voices API returned error:', data.error)
        }
      } catch (error) {
        console.warn('Failed to fetch custom voices:', error);
        setCustomVoices([]);
      }
    }
    fetchVoices();
  }, [selectedProvider]);

  // Auto-select first voice when voices are loaded for all providers
  useEffect(() => {
    console.log('🎤 Auto-selection effect triggered:', {
      selectedProvider,
      selectedVoice,
      murfVoicesLength: murfVoices.length,
      elevenlabsVoicesLength: elevenlabsVoices.length,
      speechifyVoicesLength: speechifyVoices.length,
      playaiVoicesLength: playaiVoices.length,
      minimaxVoicesLength: minimaxVoices.length,
      customVoicesLength: customVoices.length
    });
    
    // Function to check if current voice is valid for any voice source
    const isCurrentVoiceValid = () => {
      const currentVoiceInCustomVoices = customVoices.some(voice => voice.voice_id === selectedVoice);
      
      if (selectedProvider === 'murf') {
        const currentVoiceInApiVoices = murfVoices.some(voice => voice.voiceId === selectedVoice);
        return currentVoiceInApiVoices || currentVoiceInCustomVoices;
      } else if (selectedProvider === 'elevenlabs') {
        const currentVoiceInApiVoices = elevenlabsVoices.some(voice => voice.voice_id === selectedVoice);
        return currentVoiceInApiVoices || currentVoiceInCustomVoices;
      } else if (selectedProvider === 'speechify') {
        const currentVoiceInApiVoices = speechifyVoices.some(voice => voice.id === selectedVoice);
        return currentVoiceInApiVoices || currentVoiceInCustomVoices;
      } else if (selectedProvider === 'fal-playai') {
        const currentVoiceInApiVoices = playaiVoices.some(voice => voice.id === selectedVoice);
        return currentVoiceInApiVoices || currentVoiceInCustomVoices;
      } else if (selectedProvider === 'minimax') {
        const currentVoiceInApiVoices = minimaxVoices.some(voice => voice.id === selectedVoice);
        return currentVoiceInApiVoices || currentVoiceInCustomVoices;
      }
      return false;
    };
    
    // Auto-select appropriate default if current voice is not valid
    // But don't override manual selections
    if (!isCurrentVoiceValid() && !manualSelectionRef.current) {
      console.log('🎤 Current voice not valid, selecting default for provider:', selectedProvider);
      
      if (selectedProvider === 'murf' && murfVoices.length > 0) {
        const defaultVoice = murfVoices[0].voiceId;
        console.log('🎤 Auto-selecting first Murf voice:', defaultVoice);
        dispatch(setSelectedVoice(defaultVoice));
      } else if (selectedProvider === 'elevenlabs' && elevenlabsVoices.length > 0) {
        const defaultVoice = elevenlabsVoices[0].voice_id;
        console.log('🎤 Auto-selecting first ElevenLabs voice:', defaultVoice);
        dispatch(setSelectedVoice(defaultVoice));
      } else if (selectedProvider === 'speechify' && speechifyVoices.length > 0) {
        const defaultVoice = speechifyVoices[0].id;
        console.log('🎤 Auto-selecting first Speechify voice:', defaultVoice);
        dispatch(setSelectedVoice(defaultVoice));
      } else if (selectedProvider === 'fal-playai' && playaiVoices.length > 0) {
        const defaultVoice = playaiVoices[0].id;
        console.log('🎤 Auto-selecting first PlayAI voice:', defaultVoice);
        dispatch(setSelectedVoice(defaultVoice));
      } else if (selectedProvider === 'minimax' && minimaxVoices.length > 0) {
        const defaultVoice = minimaxVoices[0].id;
        console.log('🎤 Auto-selecting first Minimax voice:', defaultVoice);
        dispatch(setSelectedVoice(defaultVoice));
      } else {
        // Fallback to provider defaults if no API voices available
        const fallbackDefaults = {
          'murf': 'en-US-ken',
          'elevenlabs': '21m00Tcm4TlvDq8ikWAM',
          'speechify': 'henry',
          'fal-playai': 'Jennifer (English (US)/American)',
          'playai': 'Jennifer (English (US)/American)',
          'minimax': 'female_narrator'
        };
        const fallbackVoice = fallbackDefaults[selectedProvider];
        if (fallbackVoice) {
          console.log('🎤 Using fallback voice for', selectedProvider, ':', fallbackVoice);
          dispatch(setSelectedVoice(fallbackVoice));
        }
      }
    } else if (manualSelectionRef.current) {
      console.log('🎤 Manual selection in progress, skipping auto-selection');
    } else {
      console.log('🎤 Current voice is valid, keeping:', selectedVoice);
    }
  }, [selectedProvider, murfVoices, elevenlabsVoices, speechifyVoices, playaiVoices, minimaxVoices, customVoices, selectedVoice, dispatch]);

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
    for (const file of acceptedFiles) {
    setIsUploading(true);
    setUploadedFileName(file.name);

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
        
        // Add to uploaded tracks
        const newTrack: UploadedMusicTrack = {
          id: `uploaded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: data.publicUrl,
          uploadedAt: new Date().toISOString(),
          isSelected: true, // Auto-select new uploads
        };
        
        dispatch(addUploadedMusicTrack(newTrack));
        showMessage(`Music "${file.name}" uploaded successfully!`, 'success');
    } catch (error: any) {
      showMessage(error.message, 'error');
      }
    }
    setIsUploading(false);
    setUploadedFileName(null);
  };

  // Handle removing a music track
  const handleRemoveMusicTrack = (trackId: string) => {
    dispatch(removeUploadedMusicTrack(trackId));
  };

  // Handle selecting Storyblocks music track
  const handleSelectStoryblocksTrack = (track: MusicTrack) => {
    // Convert to uploaded track format
    const newTrack: UploadedMusicTrack = {
      id: `storyblocks-${track.id}`,
      name: track.title,
      url: track.preview_url,
      duration: track.duration,
      uploadedAt: new Date().toISOString(),
      isSelected: true,
    };
    
    dispatch(addUploadedMusicTrack(newTrack));
    dispatch(setSelectedMusicTrack(null));
    showMessage(`Added "${track.title}" to music tracks!`, 'success');
  };

  // Generate audio with batch processing
  const handleGenerateAudio = async () => {
    if (!editableScript.trim()) {
      showMessage('No script content available for audio generation', 'error')
      return
    }

    // Import chunking utility
    const { chunkTextByWords, estimateChunksDuration } = await import('../lib/text-chunking');
    
    // Use provider-specific chunk sizes for better compatibility
    const chunkSize = selectedProvider === 'speechify' ? 1500 : 2500; // Smaller chunks for Speechify
    
    // Split text into chunks
    const textChunks = chunkTextByWords(editableScript, chunkSize);
    
    if (textChunks.length === 0) {
      showMessage('Failed to create text chunks from script', 'error');
      return;
    }

    console.log(`📝 Split script into ${textChunks.length} chunks for ${selectedProvider} (max ${chunkSize} chars each)`);

    const generationId = `audio_${Date.now()}`
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Start batch generation
    dispatch(startBatchGeneration({
        id: generationId,
        voice: selectedVoice,
        model: selectedModel,
      provider: selectedProvider,
      generateSubtitles: generateSubtitles,
      chunks: textChunks
    }));

    try {
      const apiEndpoint = selectedProvider === 'murf' 
        ? '/api/generate-murf-audio' 
        : selectedProvider === 'elevenlabs' 
          ? '/api/generate-elevenlabs-audio'
          : selectedProvider === 'speechify'
            ? '/api/generate-speechify-audio'
            : selectedProvider === 'fal-playai'
              ? '/api/generate-fal-audio'
              : selectedProvider === 'playai'
                ? '/api/generate-playai-audio'
                : selectedProvider === 'minimax'
                  ? '/api/generate-minimax-audio'
                  : '/api/generate-speechify-audio';
        
      console.log(`🎵 Starting ${selectedProvider} batch audio generation for ${textChunks.length} chunks...`);
      
      // Process chunks in batches (5 concurrent requests)
      const batchSize = 5;
      const completedChunks: Array<{chunkIndex: number, audioUrl: string, duration: number}> = [];
      
      for (let i = 0; i < textChunks.length; i += batchSize) {
        const batch = textChunks.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(textChunks.length / batchSize)} (chunks ${i + 1}-${Math.min(i + batchSize, textChunks.length)})`);
        
        // Process batch concurrently
        const batchPromises = batch.map(async (chunk) => {
          dispatch(updateChunkProgress({ chunkIndex: chunk.chunkIndex, status: 'processing' }));
          
          try {
            // Use correct parameter name based on provider
            const voiceParam = (selectedProvider === 'minimax' || selectedProvider === 'fal-playai') ? 'voice' : 'voiceId';
            const requestBody = {
              text: chunk.text,
              [voiceParam]: selectedVoice,
              model: selectedModel,
              chunkIndex: chunk.chunkIndex,
              sessionId: sessionId,
              generateSubtitles: generateSubtitles
            };
              
      const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
            });

              if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to generate chunk ${chunk.chunkIndex}`);
              }

            const data = await response.json();
            
            dispatch(setChunkCompleted({
              chunkIndex: chunk.chunkIndex,
              audioUrl: data.audioUrl,
              duration: data.duration
            }));

            console.log(`✅ Completed chunk ${chunk.chunkIndex + 1}/${textChunks.length} (${data.duration.toFixed(2)}s)`);
            
            return {
              chunkIndex: chunk.chunkIndex,
              audioUrl: data.audioUrl,
              duration: data.duration
            };
            
          } catch (error: any) {
            console.error(`❌ Error processing chunk ${chunk.chunkIndex}:`, error);
            dispatch(setChunkError({
              chunkIndex: chunk.chunkIndex,
              error: error.message
            }));
            throw error;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        completedChunks.push(...batchResults);
        
        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < textChunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`🔗 All chunks completed. Joining ${completedChunks.length} audio files...`);
      dispatch(setJoiningPhase());

      // Join audio chunks
      const joinResponse = await fetch('/api/join-audio-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkUrls: completedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex),
          sessionId: sessionId,
          userId: 'current_user',
          generateSubtitles: generateSubtitles
        })
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        throw new Error(errorData.error || 'Failed to join audio chunks');
      }

      const joinData = await joinResponse.json();
      
      // Create script durations for video generation (each chunk's timing)
      let currentStartTime = 0;
      const scriptDurations = completedChunks
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((chunk, index) => {
          const scriptDuration = {
            scriptId: `chunk_${chunk.chunkIndex}`,
            imageId: `chunk_${chunk.chunkIndex}`,
            imageName: `Chunk ${chunk.chunkIndex + 1}`,
            duration: chunk.duration,
            startTime: currentStartTime
          };
          currentStartTime += chunk.duration;
          return scriptDuration;
        });

      dispatch(completeJoinedAudio({
        audioUrl: joinData.audioUrl,
        compressedAudioUrl: joinData.compressedAudioUrl,
        duration: joinData.duration,
        scriptDurations: scriptDurations
      }));

      showMessage(`Successfully generated audio using ${selectedProvider} (${textChunks.length} chunks, ${joinData.duration.toFixed(1)}s)!`, 'success');

      // Generate subtitles if requested
      if (generateSubtitles && joinData.compressedAudioUrl) {
        await handleGenerateSubtitles(joinData.compressedAudioUrl);
      } else {
        dispatch(saveGenerationToHistory());
      }

    } catch (error: any) {
      console.error('Batch audio generation error:', error);
      dispatch(setAudioGenerationError(error.message));
      showMessage(`Audio generation failed: ${error.message}`, 'error');
    }
  }

  const handleGenerateSubtitles = async (audioUrl?: string) => {
    const urlToUse = audioUrl || currentGeneration?.compressedAudioUrl || currentGeneration?.audioUrl
    
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
          // Use compressedAudioUrl if available (preferred for subtitles)
          compressedAudioUrl: currentGeneration?.compressedAudioUrl || audioUrl,
          audioUrl: !currentGeneration?.compressedAudioUrl ? urlToUse : undefined,
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
    console.log('🎤 Rendering voice selector for provider:', selectedProvider)
    console.log('🎤 Current selected voice:', selectedVoice)
    console.log('🎤 Available custom voices:', customVoices)
    
    if (selectedProvider === 'murf') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 Voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            // Reset manual selection flag after a short delay
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices */}
            {murfVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  API Voices
                </div>
            {murfVoices.map((voice) => (
              <SelectItem key={voice.voiceId} value={voice.voiceId}>
                {voice.displayName} ({voice.gender}, {voice.accent})
              </SelectItem>
            ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {murfVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      );
    }
    if (selectedProvider === 'elevenlabs') {
      return (
        <Select 
          value={selectedVoice} 
                     onValueChange={(value: string) => {
             console.log('🎤 ElevenLabs voice selection changed to:', value)
             manualSelectionRef.current = true;
             dispatch(setSelectedVoice(value))
             setTimeout(() => {
               manualSelectionRef.current = false;
             }, 100);
           }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices */}
            {elevenlabsVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  API Voices
                </div>
                {elevenlabsVoices.map((voice) => (
                  <SelectItem key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} ({voice.labels?.accent || 'Unknown'}, {voice.category || 'Unknown'})
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {elevenlabsVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      );
    }
    if (selectedProvider === 'speechify') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 Speechify voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices */}
            {speechifyVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  API Voices
                </div>
                {speechifyVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.displayName} ({voice.gender}, {voice.locale})
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {speechifyVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* No voices available message */}
            {speechifyVoices.length === 0 && customVoices.length === 0 && (
              <div className="px-2 py-3 text-xs text-gray-500 text-center">
                No Speechify voices available.
                <br />
                Check API key configuration or add custom voices in Admin.
              </div>
            )}
          </SelectContent>
        </Select>
      );
    }
    
    if (selectedProvider === 'fal-playai') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 PlayAI voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices from Play.ai */}
            {playaiVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Play.ai Voices (via FAL)
                </div>
                {playaiVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} ({voice.gender}, {voice.language})
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {playaiVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Fallback to hardcoded voices if API fails */}
            {playaiVoices.length === 0 && customVoices.length === 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Default Voices (API unavailable)
                </div>
                <SelectItem value="Jennifer (English (US)/American)">Jennifer (English US/American)</SelectItem>
                <SelectItem value="Serena (English (US)/American)">Serena (English US/American)</SelectItem>
                <SelectItem value="David (English (US)/American)">David (English US/American)</SelectItem>
                <SelectItem value="Matthew (English (US)/American)">Matthew (English US/American)</SelectItem>
                <SelectItem value="William (English (US)/American)">William (English US/American)</SelectItem>
                <SelectItem value="Emma (English (US)/American)">Emma (English US/American)</SelectItem>
                <SelectItem value="Olivia (English (US)/American)">Olivia (English US/American)</SelectItem>
                <SelectItem value="Liam (English (US)/American)">Liam (English US/American)</SelectItem>
                <SelectItem value="Noah (English (US)/American)">Noah (English US/American)</SelectItem>
                <SelectItem value="Sophia (English (US)/American)">Sophia (English US/American)</SelectItem>
                <SelectItem value="Isabella (English (US)/American)">Isabella (English US/American)</SelectItem>
                <SelectItem value="James (English (US)/American)">James (English US/American)</SelectItem>
                <SelectItem value="Benjamin (English (US)/American)">Benjamin (English US/American)</SelectItem>
                <SelectItem value="Charlotte (English (US)/American)">Charlotte (English US/American)</SelectItem>
                <SelectItem value="Amelia (English (US)/American)">Amelia (English US/American)</SelectItem>
                <SelectItem value="Alexander (English (US)/American)">Alexander (English US/American)</SelectItem>
                <SelectItem value="Mia (English (US)/American)">Mia (English US/American)</SelectItem>
                <SelectItem value="Ethan (English (US)/American)">Ethan (English US/American)</SelectItem>
                <SelectItem value="Harper (English (US)/American)">Harper (English US/American)</SelectItem>
                <SelectItem value="Lucas (English (US)/American)">Lucas (English US/American)</SelectItem>
                <SelectItem value="Evelyn (English (UK)/British)">Evelyn (English UK/British)</SelectItem>
                <SelectItem value="Oliver (English (UK)/British)">Oliver (English UK/British)</SelectItem>
                <SelectItem value="Chloe (English (UK)/British)">Chloe (English UK/British)</SelectItem>
                <SelectItem value="Henry (English (UK)/British)">Henry (English UK/British)</SelectItem>
                <SelectItem value="Grace (English (UK)/British)">Grace (English UK/British)</SelectItem>
                <SelectItem value="Sebastian (English (UK)/British)">Sebastian (English UK/British)</SelectItem>
                <SelectItem value="Zoe (English (AU)/Australian)">Zoe (English AU/Australian)</SelectItem>
                <SelectItem value="Jack (English (AU)/Australian)">Jack (English AU/Australian)</SelectItem>
                <SelectItem value="Lily (English (AU)/Australian)">Lily (English AU/Australian)</SelectItem>
                <SelectItem value="Ryan (English (AU)/Australian)">Ryan (English AU/Australian)</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      );
    }
    
    if (selectedProvider === 'minimax') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 Minimax Direct voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices from Minimax */}
            {minimaxVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Minimax Voices
                </div>
                {minimaxVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} {voice.description && `(${voice.description})`}
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {minimaxVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Fallback to hardcoded voices if API fails */}
            {minimaxVoices.length === 0 && customVoices.length === 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Default Voices (API unavailable)
                </div>
                <SelectItem value="English_CaptivatingStoryteller">English_CaptivatingStoryteller</SelectItem>
                <SelectItem value="female_narrator">Female Narrator</SelectItem>
                <SelectItem value="child_narrator">Child Narrator</SelectItem>
                <SelectItem value="English_ProfessionalNarrator">English_ProfessionalNarrator</SelectItem>
                <SelectItem value="English_WarmStoryteller">English_WarmStoryteller</SelectItem>
                <SelectItem value="English_EnergeticPresenter">English_EnergeticPresenter</SelectItem>
                <SelectItem value="English_SoothingReader">English_SoothingReader</SelectItem>
                <SelectItem value="English_AuthoritativeVoice">English_AuthoritativeVoice</SelectItem>
                <SelectItem value="English_FriendlyGuide">English_FriendlyGuide</SelectItem>
                <SelectItem value="English_DramaticReader">English_DramaticReader</SelectItem>
                <SelectItem value="English_CalmNarrator">English_CalmNarrator</SelectItem>
                <SelectItem value="English_ConfidentSpeaker">English_ConfidentSpeaker</SelectItem>
                <SelectItem value="English_ExpressiveVoice">English_ExpressiveVoice</SelectItem>
                <SelectItem value="English_ClearAnnouncer">English_ClearAnnouncer</SelectItem>
                <SelectItem value="English_WisdomNarrator">English_WisdomNarrator</SelectItem>
                <SelectItem value="English_CheerfulHost">English_CheerfulHost</SelectItem>
                <SelectItem value="English_SeriousReader">English_SeriousReader</SelectItem>
                <SelectItem value="English_PlayfulVoice">English_PlayfulVoice</SelectItem>
                <SelectItem value="English_PowerfulSpeaker">English_PowerfulSpeaker</SelectItem>
                <SelectItem value="English_GentleReader">English_GentleReader</SelectItem>
                <SelectItem value="English_DynamicPresenter">English_DynamicPresenter</SelectItem>
                <SelectItem value="English_SmoothNarrator">English_SmoothNarrator</SelectItem>
                <SelectItem value="English_VibrantVoice">English_VibrantVoice</SelectItem>
                <SelectItem value="English_ClassicReader">English_ClassicReader</SelectItem>
                <SelectItem value="English_ModernSpeaker">English_ModernSpeaker</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      );
    }
    
    if (selectedProvider === 'playai') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 PlayAI (fallback) voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices */}
            {playaiVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  API Voices
                </div>
                {playaiVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} ({voice.gender}, {voice.language})
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {playaiVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* No voices available message */}
            {playaiVoices.length === 0 && customVoices.length === 0 && (
              <div className="px-2 py-3 text-xs text-gray-500 text-center">
                No Play.ai voices available.
                <br />
                Check API key configuration or add custom voices in Admin.
              </div>
            )}
          </SelectContent>
        </Select>
      );
    }
    
    if (selectedProvider === 'minimax') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => {
            console.log('🎤 Minimax (fallback) voice selection changed to:', value)
            manualSelectionRef.current = true;
            dispatch(setSelectedVoice(value))
            setTimeout(() => {
              manualSelectionRef.current = false;
            }, 100);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* API Voices */}
            {minimaxVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  API Voices
                </div>
                {minimaxVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} {voice.description && `(${voice.description})`}
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Voices */}
            {customVoices.length > 0 && (
              <>
                {minimaxVoices.length > 0 && <div className="border-t my-1" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                  Custom Voices
                </div>
                {customVoices.map((voice) => (
                  <SelectItem key={`custom-${voice.id}`} value={voice.voice_id}>
                    {voice.name} <span className="text-xs text-gray-500">(Custom)</span>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* No voices available message */}
            {minimaxVoices.length === 0 && customVoices.length === 0 && (
              <div className="px-2 py-3 text-xs text-gray-500 text-center">
                No Minimax voices available.
                <br />
                Check API key configuration or add custom voices in Admin.
              </div>
            )}
          </SelectContent>
        </Select>
      );
    }
    
    return null;
  };

  const getVoiceName = (provider: AudioProvider, voiceId: string): string => {
    // Check custom voices first
    const customVoice = customVoices.find(v => v.voice_id === voiceId);
    if (customVoice) {
      return `${customVoice.name} (Custom)`;
    }

    // Then check API voices
    if (provider === 'murf') {
      return murfVoices.find(v => v.voiceId === voiceId)?.displayName || voiceId;
    }
    if (provider === 'elevenlabs') {
      return elevenlabsVoices.find(v => v.voice_id === voiceId)?.name || voiceId;
    }
    if (provider === 'speechify') {
      return speechifyVoices.find(v => v.id === voiceId)?.displayName || voiceId;
    }
    if (provider === 'fal-playai') {
      // First check fetched Play.ai voices
      const playaiVoice = playaiVoices.find(v => v.id === voiceId);
      if (playaiVoice) {
        return playaiVoice.name;
      }
      // Fallback to hardcoded voices if not found
      const playaiVoicesFallback = [
        { value: 'Jennifer (English (US)/American)', label: 'Jennifer (English US/American)' },
        { value: 'Serena (English (US)/American)', label: 'Serena (English US/American)' },
        { value: 'David (English (US)/American)', label: 'David (English US/American)' },
        { value: 'Matthew (English (US)/American)', label: 'Matthew (English US/American)' },
        { value: 'William (English (US)/American)', label: 'William (English US/American)' },
        { value: 'Emma (English (US)/American)', label: 'Emma (English US/American)' },
        { value: 'Olivia (English (US)/American)', label: 'Olivia (English US/American)' },
        { value: 'Liam (English (US)/American)', label: 'Liam (English US/American)' },
        { value: 'Noah (English (US)/American)', label: 'Noah (English US/American)' },
        { value: 'Sophia (English (US)/American)', label: 'Sophia (English US/American)' },
        { value: 'Isabella (English (US)/American)', label: 'Isabella (English US/American)' },
        { value: 'James (English (US)/American)', label: 'James (English US/American)' },
        { value: 'Benjamin (English (US)/American)', label: 'Benjamin (English US/American)' },
        { value: 'Charlotte (English (US)/American)', label: 'Charlotte (English US/American)' },
        { value: 'Amelia (English (US)/American)', label: 'Amelia (English US/American)' },
        { value: 'Alexander (English (US)/American)', label: 'Alexander (English US/American)' },
        { value: 'Mia (English (US)/American)', label: 'Mia (English US/American)' },
        { value: 'Ethan (English (US)/American)', label: 'Ethan (English US/American)' },
        { value: 'Harper (English (US)/American)', label: 'Harper (English US/American)' },
        { value: 'Lucas (English (US)/American)', label: 'Lucas (English US/American)' },
        { value: 'Evelyn (English (UK)/British)', label: 'Evelyn (English UK/British)' },
        { value: 'Oliver (English (UK)/British)', label: 'Oliver (English UK/British)' },
        { value: 'Chloe (English (UK)/British)', label: 'Chloe (English UK/British)' },
        { value: 'Henry (English (UK)/British)', label: 'Henry (English UK/British)' },
        { value: 'Grace (English (UK)/British)', label: 'Grace (English UK/British)' },
        { value: 'Sebastian (English (UK)/British)', label: 'Sebastian (English UK/British)' },
        { value: 'Zoe (English (AU)/Australian)', label: 'Zoe (English AU/Australian)' },
        { value: 'Jack (English (AU)/Australian)', label: 'Jack (English AU/Australian)' },
        { value: 'Lily (English (AU)/Australian)', label: 'Lily (English AU/Australian)' },
        { value: 'Ryan (English (AU)/Australian)', label: 'Ryan (English AU/Australian)' },
      ];
      return playaiVoicesFallback.find(v => v.value === voiceId)?.label || voiceId;
    }
    if (provider === 'minimax') {
      // First check fetched Minimax voices
      const minimaxVoice = minimaxVoices.find(v => v.id === voiceId);
      if (minimaxVoice) {
        return minimaxVoice.name;
      }
      // Fallback to hardcoded voices if not found
      const minimaxVoicesFallback = [
        { value: 'English_CaptivatingStoryteller', label: 'English_CaptivatingStoryteller' },
        { value: 'female_narrator', label: 'Female Narrator' },
        { value: 'child_narrator', label: 'Child Narrator' },
        { value: 'English_ProfessionalNarrator', label: 'English_ProfessionalNarrator' },
        { value: 'English_WarmStoryteller', label: 'English_WarmStoryteller' },
        { value: 'English_EnergeticPresenter', label: 'English_EnergeticPresenter' },
        { value: 'English_SoothingReader', label: 'English_SoothingReader' },
        { value: 'English_AuthoritativeVoice', label: 'English_AuthoritativeVoice' },
        { value: 'English_FriendlyGuide', label: 'English_FriendlyGuide' },
        { value: 'English_DramaticReader', label: 'English_DramaticReader' },
        { value: 'English_CalmNarrator', label: 'English_CalmNarrator' },
        { value: 'English_ConfidentSpeaker', label: 'English_ConfidentSpeaker' },
        { value: 'English_ExpressiveVoice', label: 'English_ExpressiveVoice' },
        { value: 'English_ClearAnnouncer', label: 'English_ClearAnnouncer' },
        { value: 'English_WisdomNarrator', label: 'English_WisdomNarrator' },
        { value: 'English_CheerfulHost', label: 'English_CheerfulHost' },
        { value: 'English_SeriousReader', label: 'English_SeriousReader' },
        { value: 'English_PlayfulVoice', label: 'English_PlayfulVoice' },
        { value: 'English_PowerfulSpeaker', label: 'English_PowerfulSpeaker' },
        { value: 'English_GentleReader', label: 'English_GentleReader' },
        { value: 'English_DynamicPresenter', label: 'English_DynamicPresenter' },
        { value: 'English_SmoothNarrator', label: 'English_SmoothNarrator' },
        { value: 'English_VibrantVoice', label: 'English_VibrantVoice' },
        { value: 'English_ClassicReader', label: 'English_ClassicReader' },
        { value: 'English_ModernSpeaker', label: 'English_ModernSpeaker' },
      ];
      return minimaxVoicesFallback.find(v => v.value === voiceId)?.label || voiceId;
    }
    if (provider === 'playai') {
      return playaiVoices.find(v => v.id === voiceId)?.name || voiceId;
    }
    if (provider === 'minimax') {
      return minimaxVoices.find(v => v.id === voiceId)?.name || voiceId;
    }
    return voiceId;
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Audio Generator</h1>
        <p className="text-gray-600">
          Generate high-quality audio from your scripts using Murf.ai, ElevenLabs, or Speechify
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
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="speechify" id="speechify" />
                  <Label htmlFor="speechify">Speechify</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fal-playai" id="fal-playai" />
                  <Label htmlFor="fal-playai">FAL PlayAI</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minimax" id="minimax" />
                  <Label htmlFor="minimax">Minimax</Label>
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
          <CardDescription>Search for background music from Storyblocks or upload multiple custom tracks. All selected tracks will be looped in videos.</CardDescription>
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
              <p className="font-medium">Found: {selectedMusicTrack.title}</p>
              <div className="flex items-center gap-2">
                <audio src={selectedMusicTrack.preview_url} controls className="w-full h-10 mt-2" />
                <Button variant="ghost" size="sm" onClick={() => dispatch(setSelectedMusicTrack(null))}>Clear</Button>
              </div>
            </div>
          )}
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
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
                  <Button size="sm" onClick={() => handleSelectStoryblocksTrack(track)}>Add Track</Button>
                </div>
              </div>
            ))}
          </div>
           {activeAudioPreview && (
            <audio src={activeAudioPreview} autoPlay onEnded={() => setActiveAudioPreview(null)} className="hidden" />
          )}

          <div className="text-center text-sm text-gray-500 my-2">OR</div>

          {/* Custom File Upload for Multiple Music */}
          <div className="space-y-2">
            <Label>Upload Custom Music (Multiple Files Supported)</Label>
            <input
              type="file"
              accept="audio/mp3,audio/wav,audio/m4a"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleMusicDrop(Array.from(e.target.files));
                }
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <p className="text-xs text-gray-500">
              Supports MP3, WAV, and M4A files up to 50MB each. You can select multiple files at once.
            </p>
          </div>
          {isUploading && <div className="flex items-center justify-center gap-2 text-gray-500 mt-2"><Loader2 className="animate-spin h-4 w-4" /> Uploading...</div>}

          {/* Uploaded Music Tracks Management */}
          {uploadedMusicTracks.length > 0 && (
            <div className="space-y-4 border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Uploaded Music Tracks ({uploadedMusicTracks.length})</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => dispatch(selectAllMusicTracks())}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dispatch(deselectAllMusicTracks())}>
                    Deselect All
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => dispatch(clearAllMusicTracks())}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {uploadedMusicTracks.map((track) => (
                  <div key={track.id} className={`p-3 border rounded-lg ${track.isSelected ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={track.isSelected}
                          onChange={() => dispatch(toggleMusicTrackSelection(track.id))}
                          className="rounded"
                        />
                        <span className="font-medium">{track.name}</span>
                        {track.isSelected && <Badge variant="secondary" className="text-xs">Selected</Badge>}
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleRemoveMusicTrack(track.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <audio src={track.url} controls className="w-full h-8" />
                    <div className="text-xs text-gray-500 mt-1">
                      Added: {new Date(track.uploadedAt).toLocaleString()}
                      {track.duration && ` | Duration: ${track.duration}s`}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{uploadedMusicTracks.filter(t => t.isSelected).length}</strong> track(s) selected for video generation.
                  All selected tracks will be looped to match the video duration.
                </p>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Batch Processing Progress */}
      {isGeneratingAudio && currentGeneration?.chunks && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Batch Audio Generation Progress
            </CardTitle>
            <CardDescription>
              Processing {currentGeneration.chunks.length} text chunks with {selectedProvider}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{audioProgress.completed}/{audioProgress.total} chunks</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${audioProgress.total > 0 ? (audioProgress.completed / audioProgress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-center text-sm text-gray-600 capitalize">
                Phase: {audioProgress.phase === 'chunks' ? 'Processing Chunks' : 
                       audioProgress.phase === 'concatenating' ? 'Joining Audio Files' : 
                       audioProgress.phase === 'subtitles' ? 'Generating Subtitles' : 
                       'Completed'}
              </div>
            </div>

            {/* Individual Chunk Progress */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Individual Chunks</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {currentGeneration.chunks.map((chunk) => (
                  <div 
                    key={chunk.chunkIndex} 
                    className={`p-3 rounded-lg border text-sm ${
                      chunk.status === 'completed' ? 'bg-green-50 border-green-200' :
                      chunk.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                      chunk.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Chunk {chunk.chunkIndex + 1}</span>
                      <div className="flex items-center gap-1">
                        {chunk.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {chunk.status === 'processing' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                        {chunk.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                        {chunk.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                    <div className={`text-xs ${
                      chunk.status === 'completed' ? 'text-green-700' :
                      chunk.status === 'processing' ? 'text-blue-700' :
                      chunk.status === 'error' ? 'text-red-700' :
                      'text-gray-500'
                    }`}>
                      {chunk.status === 'completed' && chunk.duration ? `${chunk.duration.toFixed(1)}s` :
                       chunk.status === 'processing' ? 'Processing...' :
                       chunk.status === 'error' ? chunk.error || 'Error occurred' :
                       'Waiting...'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {chunk.text.substring(0, 50)}{chunk.text.length > 50 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated Time */}
            {audioProgress.phase === 'chunks' && audioProgress.total > 0 && (
              <div className="text-sm text-gray-600 text-center">
                Estimated time remaining: {Math.max(0, Math.ceil((audioProgress.total - audioProgress.completed) * 10 / 5))} seconds
                <br />
                <span className="text-xs">Processing 5 chunks concurrently</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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