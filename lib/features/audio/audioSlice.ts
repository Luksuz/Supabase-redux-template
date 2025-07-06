import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { TextChunk } from '../../text-chunking'

export type AudioProvider = 'murf' | 'elevenlabs' | 'speechify' | 'playai' | 'minimax'

export interface MusicTrack {
  id: number;
  title: string;
  thumbnail_url: string;
  waveform_url: string;
  preview_url: string;
  duration: number;
}

export interface UploadedMusicTrack {
  id: string;
  name: string;
  url: string;
  duration?: number;
  uploadedAt: string;
  isSelected: boolean;
}

export interface AudioChunk {
  chunkIndex: number
  text: string
  audioUrl: string | null
  duration: number | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface AudioGeneration {
  id: string
  audioUrl: string | null
  compressedAudioUrl: string | null  // For subtitles generation
  subtitlesUrl: string | null
  duration: number | null
  generatedAt: string
  voice: string // voiceId for both Murf and ElevenLabs
  model: string
  provider: AudioProvider
  generateSubtitles: boolean
  status: 'idle' | 'generating' | 'completed' | 'error'
  error: string | null
  chunks?: AudioChunk[]  // For batch processing
  scriptDurations?: Array<{
    scriptId: string
    imageId: string
    imageName: string
    duration: number
    startTime: number
  }>
}

interface AudioState {
  currentGeneration: AudioGeneration | null
  generationHistory: AudioGeneration[]
  isGeneratingAudio: boolean
  isGeneratingSubtitles: boolean
  audioProgress: {
    total: number
    completed: number
    phase: 'chunks' | 'concatenating' | 'subtitles' | 'completed'
  }
  selectedProvider: AudioProvider
  selectedVoice: string // voiceId for both Murf and ElevenLabs
  selectedModel: string
  generateSubtitles: boolean
  musicSearchQuery: string;
  musicSearchResults: MusicTrack[];
  selectedMusicTrack: MusicTrack | null;
  isSearchingMusic: boolean;
  musicSearchError: string | null;
  uploadedMusicTracks: UploadedMusicTrack[];
}

const initialState: AudioState = {
  currentGeneration: null,
  generationHistory: [],
  isGeneratingAudio: false,
  isGeneratingSubtitles: false,
  audioProgress: {
    total: 0,
    completed: 0,
    phase: 'chunks'
  },
  selectedProvider: 'murf',
  selectedVoice: 'en-US-ken', // Default Murf voice
  selectedModel: 'standard', // Murf doesn't have models in the same way
  generateSubtitles: false,
  musicSearchQuery: '',
  musicSearchResults: [],
  selectedMusicTrack: null,
  isSearchingMusic: false,
  musicSearchError: null,
  uploadedMusicTracks: [],
}

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setSelectedProvider: (state, action: PayloadAction<AudioProvider>) => {
      state.selectedProvider = action.payload
      // Reset voice selection when switching providers
      if (action.payload === 'murf') {
        state.selectedVoice = 'en-US-ken' // Default Murf voice
        state.selectedModel = 'standard'
      } else if (action.payload === 'elevenlabs') {
        state.selectedVoice = '21m00Tcm4TlvDq8ikWAM' // Default ElevenLabs voice (Rachel)
        state.selectedModel = 'eleven_multilingual_v2'
      } else if (action.payload === 'speechify') {
        state.selectedVoice = 'henry' // Default Speechify voice
        state.selectedModel = 'simba-base'
      } else if (action.payload === 'playai') {
        state.selectedVoice = 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json' // Default PlayAI voice ID
        state.selectedModel = 'PlayDialog'
      } else if (action.payload === 'minimax') {
        state.selectedVoice = 'Grinch' // Default Minimax voice
        state.selectedModel = 'speech-02-hd'
      }
    },
    
    setSelectedVoice: (state, action: PayloadAction<string>) => {
      state.selectedVoice = action.payload
    },
    
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload
    },
    
    setGenerateSubtitles: (state, action: PayloadAction<boolean>) => {
      state.generateSubtitles = action.payload
    },
    
    setIsGeneratingAudio: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingAudio = action.payload
    },
    
    setIsGeneratingSubtitles: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingSubtitles = action.payload
    },
    
    setAudioProgress: (state, action: PayloadAction<Partial<AudioState['audioProgress']>>) => {
      state.audioProgress = { ...state.audioProgress, ...action.payload }
    },
    
    startAudioGeneration: (state, action: PayloadAction<{ id: string; voice: string; model: string; provider: AudioProvider; generateSubtitles: boolean }>) => {
      const { id, voice, model, provider, generateSubtitles } = action.payload
      state.currentGeneration = {
        id,
        audioUrl: null,
        compressedAudioUrl: null,
        subtitlesUrl: null,
        duration: null,
        generatedAt: new Date().toISOString(),
        voice,
        model,
        provider,
        generateSubtitles,
        status: 'generating',
        error: null
      }
      state.isGeneratingAudio = true
    },
    
    completeAudioGeneration: (state, action: PayloadAction<{ audioUrl: string; duration: number; scriptDurations?: AudioGeneration['scriptDurations'] }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.audioUrl = action.payload.audioUrl
        state.currentGeneration.duration = action.payload.duration
        if (action.payload.scriptDurations) {
          state.currentGeneration.scriptDurations = action.payload.scriptDurations
        }
        state.currentGeneration.status = 'completed'
      }
      state.isGeneratingAudio = false
    },
    
    addSubtitlesToGeneration: (state, action: PayloadAction<{ subtitlesUrl: string }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.subtitlesUrl = action.payload.subtitlesUrl
      }
      state.isGeneratingSubtitles = false
    },
    
    setAudioGenerationError: (state, action: PayloadAction<string>) => {
      if (state.currentGeneration) {
        state.currentGeneration.status = 'error'
        state.currentGeneration.error = action.payload
      }
      state.isGeneratingAudio = false
      state.isGeneratingSubtitles = false
    },
    
    saveGenerationToHistory: (state) => {
      if (state.currentGeneration) {
        state.generationHistory.unshift(state.currentGeneration)
        // Keep only the last 10 generations
        state.generationHistory = state.generationHistory.slice(0, 10)
      }
    },
    
    clearCurrentGeneration: (state) => {
      state.currentGeneration = null
      state.audioProgress = {
        total: 0,
        completed: 0,
        phase: 'chunks'
      }
    },
    
    clearAllAudioData: (state) => {
      return initialState
    },

    setMusicSearchQuery: (state, action: PayloadAction<string>) => {
      state.musicSearchQuery = action.payload;
    },
    startMusicSearch: (state) => {
      state.isSearchingMusic = true;
      state.musicSearchError = null;
      state.musicSearchResults = [];
    },
    setMusicSearchResults: (state, action: PayloadAction<MusicTrack[]>) => {
      state.musicSearchResults = action.payload;
      state.isSearchingMusic = false;
    },
    setMusicSearchError: (state, action: PayloadAction<string>) => {
      state.musicSearchError = action.payload;
      state.isSearchingMusic = false;
    },
    setSelectedMusicTrack: (state, action: PayloadAction<MusicTrack | null>) => {
      state.selectedMusicTrack = action.payload;
    },
    
    addUploadedMusicTrack: (state, action: PayloadAction<UploadedMusicTrack>) => {
      state.uploadedMusicTracks.push(action.payload);
    },
    
    removeUploadedMusicTrack: (state, action: PayloadAction<string>) => {
      state.uploadedMusicTracks = state.uploadedMusicTracks.filter(track => track.id !== action.payload);
    },
    
    toggleMusicTrackSelection: (state, action: PayloadAction<string>) => {
      const track = state.uploadedMusicTracks.find(t => t.id === action.payload);
      if (track) {
        track.isSelected = !track.isSelected;
      }
    },
    
    selectAllMusicTracks: (state) => {
      state.uploadedMusicTracks.forEach(track => {
        track.isSelected = true;
      });
    },
    
    deselectAllMusicTracks: (state) => {
      state.uploadedMusicTracks.forEach(track => {
        track.isSelected = false;
      });
    },
    
    clearAllMusicTracks: (state) => {
      state.uploadedMusicTracks = [];
    },
    
    // Batch processing actions
    startBatchGeneration: (state, action: PayloadAction<{ 
      id: string; 
      voice: string; 
      model: string; 
      provider: AudioProvider; 
      generateSubtitles: boolean;
      chunks: TextChunk[]
    }>) => {
      const { id, voice, model, provider, generateSubtitles, chunks } = action.payload
      const audioChunks: AudioChunk[] = chunks.map(chunk => ({
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        audioUrl: null,
        duration: null,
        status: 'pending'
      }))
      
      state.currentGeneration = {
        id,
        audioUrl: null,
        compressedAudioUrl: null,
        subtitlesUrl: null,
        duration: null,
        generatedAt: new Date().toISOString(),
        voice,
        model,
        provider,
        generateSubtitles,
        status: 'generating',
        error: null,
        chunks: audioChunks
      }
      state.isGeneratingAudio = true
      state.audioProgress = {
        total: chunks.length,
        completed: 0,
        phase: 'chunks'
      }
    },
    
    updateChunkProgress: (state, action: PayloadAction<{ chunkIndex: number; status: 'processing' | 'completed' | 'error' }>) => {
      if (state.currentGeneration?.chunks) {
        const chunk = state.currentGeneration.chunks.find(c => c.chunkIndex === action.payload.chunkIndex)
        if (chunk) {
          chunk.status = action.payload.status
        }
      }
    },
    
    setChunkCompleted: (state, action: PayloadAction<{ chunkIndex: number; audioUrl: string; duration: number }>) => {
      if (state.currentGeneration?.chunks) {
        const chunk = state.currentGeneration.chunks.find(c => c.chunkIndex === action.payload.chunkIndex)
        if (chunk) {
          chunk.status = 'completed'
          chunk.audioUrl = action.payload.audioUrl
          chunk.duration = action.payload.duration
        }
        
        // Update progress
        const completedChunks = state.currentGeneration.chunks.filter(c => c.status === 'completed').length
        state.audioProgress.completed = completedChunks
      }
    },
    
    setChunkError: (state, action: PayloadAction<{ chunkIndex: number; error: string }>) => {
      if (state.currentGeneration?.chunks) {
        const chunk = state.currentGeneration.chunks.find(c => c.chunkIndex === action.payload.chunkIndex)
        if (chunk) {
          chunk.status = 'error'
          chunk.error = action.payload.error
        }
      }
    },
    
    setJoiningPhase: (state) => {
      state.audioProgress.phase = 'concatenating'
    },
    
    completeJoinedAudio: (state, action: PayloadAction<{ audioUrl: string; compressedAudioUrl: string; duration: number; scriptDurations?: AudioGeneration['scriptDurations'] }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.audioUrl = action.payload.audioUrl
        state.currentGeneration.compressedAudioUrl = action.payload.compressedAudioUrl
        state.currentGeneration.duration = action.payload.duration
        if (action.payload.scriptDurations) {
          state.currentGeneration.scriptDurations = action.payload.scriptDurations
        }
        state.currentGeneration.status = 'completed'
      }
      state.isGeneratingAudio = false
      state.audioProgress.phase = 'completed'
    },
  }
})

export const {
  setSelectedProvider,
  setSelectedVoice,
  setSelectedModel,
  setGenerateSubtitles,
  setIsGeneratingAudio,
  setIsGeneratingSubtitles,
  setAudioProgress,
  startAudioGeneration,
  completeAudioGeneration,
  addSubtitlesToGeneration,
  setAudioGenerationError,
  saveGenerationToHistory,
  clearCurrentGeneration,
  clearAllAudioData,
  setMusicSearchQuery,
  startMusicSearch,
  setMusicSearchResults,
  setMusicSearchError,
  setSelectedMusicTrack,
  addUploadedMusicTrack,
  removeUploadedMusicTrack,
  toggleMusicTrackSelection,
  selectAllMusicTracks,
  deselectAllMusicTracks,
  clearAllMusicTracks,
  startBatchGeneration,
  updateChunkProgress,
  setChunkCompleted,
  setChunkError,
  setJoiningPhase,
  completeJoinedAudio,
} = audioSlice.actions

export default audioSlice.reducer 