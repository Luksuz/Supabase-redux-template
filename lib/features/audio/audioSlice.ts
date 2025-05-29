import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AudioGeneration {
  id: string
  audioUrl: string | null
  subtitlesUrl: string | null
  duration: number | null
  generatedAt: string
  voice: number
  model: string
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
  selectedVoice: number
  selectedModel: string
  generateSubtitles: boolean
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
  selectedVoice: 3,
  selectedModel: 'caruso',
  generateSubtitles: false
}

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setSelectedVoice: (state, action: PayloadAction<number>) => {
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
    
    startAudioGeneration: (state, action: PayloadAction<{ id: string; voice: number; model: string; generateSubtitles: boolean }>) => {
      const { id, voice, model, generateSubtitles } = action.payload
      state.currentGeneration = {
        id,
        audioUrl: null,
        subtitlesUrl: null,
        duration: null,
        generatedAt: new Date().toISOString(),
        voice,
        model,
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
      state.currentGeneration = null
      state.generationHistory = []
      state.isGeneratingAudio = false
      state.isGeneratingSubtitles = false
      state.audioProgress = {
        total: 0,
        completed: 0,
        phase: 'chunks'
      }
    }
  }
})

export const {
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
  clearAllAudioData
} = audioSlice.actions

export default audioSlice.reducer 