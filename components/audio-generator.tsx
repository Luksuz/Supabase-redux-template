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
  provider: 'murf' | 'elevenlabs' | 'speechify'
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
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([])
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
      }

      // Fetch custom admin voices for the selected provider
      try {
        const response = await fetch('/api/admin/ai-voices');
        const data = await response.json();
        if (data.success) {
          const providerCustomVoices = data.voices.filter((voice: CustomVoice) => voice.provider === selectedProvider);
          setCustomVoices(providerCustomVoices);
        }
      } catch (error) {
        console.warn('Failed to fetch custom voices:', error);
        setCustomVoices([]);
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
            : selectedProvider === 'fal-playai' || selectedProvider === 'fal-minimax'
              ? '/api/generate-fal-audio'
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
            const requestBody = {
              text: chunk.text,
              voice: selectedVoice,
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
    if (selectedProvider === 'murf') {
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
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
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
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
                {voice.name} ({voice.labels.accent}, {voice.category})
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
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
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
      const playaiVoices = [
        { value: 'Jennifer (English (US)/American)', label: 'Jennifer (English US/American)' },
        { value: 'Serena (English (US)/American)', label: 'Serena (English US/American)' },
        { value: 'David (English (US)/American)', label: 'David (English US/American)' },
        { value: 'Matthew (English (US)/American)', label: 'Matthew (English US/American)' },
        { value: 'William (English (US)/American)', label: 'William (English US/American)' },
      ];
      
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {playaiVoices.map((voice) => (
              <SelectItem key={voice.value} value={voice.value}>
                {voice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    if (selectedProvider === 'fal-minimax') {
      const minimaxVoices = [
        { value: 'male_narrator', label: 'Male Narrator' },
        { value: 'female_narrator', label: 'Female Narrator' },
        { value: 'child_narrator', label: 'Child Narrator' },
      ];
      
      return (
        <Select 
          value={selectedVoice} 
          onValueChange={(value: string) => dispatch(setSelectedVoice(value))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {minimaxVoices.map((voice) => (
              <SelectItem key={voice.value} value={voice.value}>
                {voice.label}
              </SelectItem>
            ))}
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
      const playaiVoices = [
        { value: 'Jennifer (English (US)/American)', label: 'Jennifer (English US/American)' },
        { value: 'Serena (English (US)/American)', label: 'Serena (English US/American)' },
        { value: 'David (English (US)/American)', label: 'David (English US/American)' },
        { value: 'Matthew (English (US)/American)', label: 'Matthew (English US/American)' },
        { value: 'William (English (US)/American)', label: 'William (English US/American)' },
      ];
      return playaiVoices.find(v => v.value === voiceId)?.label || voiceId;
    }
    if (provider === 'fal-minimax') {
      const minimaxVoices = [
        { value: 'English_CaptivatingStoryteller', label: 'English_CaptivatingStoryteller' },
        { value: 'female_narrator', label: 'Female Narrator' },
        { value: 'child_narrator', label: 'Child Narrator' },
      ];
      return minimaxVoices.find(v => v.value === voiceId)?.label || voiceId;
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
                  <RadioGroupItem value="fal-minimax" id="fal-minimax" />
                  <Label htmlFor="fal-minimax">FAL Minimax</Label>
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