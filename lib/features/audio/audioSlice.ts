import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type AudioProvider = 'murf' | 'elevenlabs'

export interface MusicTrack {
  id: number;
  title: string;
  thumbnail_url: string;
  waveform_url: string;
  preview_url: string;
  duration: number;
}

export interface AudioGeneration {
  id: string
  audioUrl: string | null
  subtitlesUrl: string | null
  duration: number | null
  generatedAt: string
  voice: string // voiceId for both Murf and ElevenLabs
  model: string
  provider: AudioProvider
  generateSubtitles: boolean
  status: 'idle' | 'generating' | 'completed' | 'error'
  error: string | null
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
  uploadedMusicUrl: string | null;
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
  uploadedMusicUrl: null,
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
      state.uploadedMusicUrl = null; // Clear uploaded music when a track is selected from search
    },
    setUploadedMusicUrl: (state, action: PayloadAction<string | null>) => {
      state.uploadedMusicUrl = action.payload;
      state.selectedMusicTrack = null; // Clear selected music when a track is uploaded
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
  setUploadedMusicUrl,
} = audioSlice.actions

export default audioSlice.reducer 