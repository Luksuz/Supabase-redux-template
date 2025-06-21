import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AIVoice {
  id: number
  created_at: string
  name: string
  provider: string
  voice_id: string
}

export interface AudioGeneration {
  id: string
  audioUrl: string | null
  compressedAudioUrl: string | null
  subtitlesUrl: string | null
  subtitlesContent: string | null
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
  // Voice management
  customVoices: AIVoice[]
  isLoadingVoices: boolean
  isManagingVoice: boolean
  voiceManagementError: string | null
  voiceFormData: {
    id?: number
    name: string
    provider: string
    voice_id: string
  }
  showVoiceForm: boolean
  editingVoiceId: number | null
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
  generateSubtitles: false,
  // Voice management
  customVoices: [],
  isLoadingVoices: false,
  isManagingVoice: false,
  voiceManagementError: null,
  voiceFormData: {
    name: '',
    provider: '',
    voice_id: ''
  },
  showVoiceForm: false,
  editingVoiceId: null
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
        compressedAudioUrl: null,
        subtitlesUrl: null,
        subtitlesContent: null,
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
    
    completeAudioGeneration: (state, action: PayloadAction<{ audioUrl: string; compressedAudioUrl?: string; duration: number; scriptDurations?: AudioGeneration['scriptDurations'] }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.audioUrl = action.payload.audioUrl
        if (action.payload.compressedAudioUrl) {
          state.currentGeneration.compressedAudioUrl = action.payload.compressedAudioUrl
        }
        state.currentGeneration.duration = action.payload.duration
        if (action.payload.scriptDurations) {
          state.currentGeneration.scriptDurations = action.payload.scriptDurations
        }
        state.currentGeneration.status = 'completed'
      }
      state.isGeneratingAudio = false
    },
    
    addSubtitlesToGeneration: (state, action: PayloadAction<{ subtitlesUrl: string; subtitlesContent?: string }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.subtitlesUrl = action.payload.subtitlesUrl
        if (action.payload.subtitlesContent) {
          state.currentGeneration.subtitlesContent = action.payload.subtitlesContent
        }
      }
      state.isGeneratingSubtitles = false
    },
    
    updateSubtitleContent: (state, action: PayloadAction<{ subtitlesContent: string }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.subtitlesContent = action.payload.subtitlesContent
      }
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
    },

    // Voice management actions
    setIsLoadingVoices: (state, action: PayloadAction<boolean>) => {
      state.isLoadingVoices = action.payload
    },

    setCustomVoices: (state, action: PayloadAction<AIVoice[]>) => {
      state.customVoices = action.payload
    },

    setIsManagingVoice: (state, action: PayloadAction<boolean>) => {
      state.isManagingVoice = action.payload
    },

    setVoiceManagementError: (state, action: PayloadAction<string | null>) => {
      state.voiceManagementError = action.payload
    },

    setVoiceFormData: (state, action: PayloadAction<Partial<AudioState['voiceFormData']>>) => {
      state.voiceFormData = { ...state.voiceFormData, ...action.payload }
    },

    setShowVoiceForm: (state, action: PayloadAction<boolean>) => {
      state.showVoiceForm = action.payload
      if (!action.payload) {
        // Reset form when hiding
        state.voiceFormData = {
          name: '',
          provider: '',
          voice_id: ''
        }
        state.editingVoiceId = null
        state.voiceManagementError = null
      }
    },

    setEditingVoiceId: (state, action: PayloadAction<number | null>) => {
      state.editingVoiceId = action.payload
      if (action.payload) {
        // Populate form with existing voice data
        const voice = state.customVoices.find(v => v.id === action.payload)
        if (voice) {
          state.voiceFormData = {
            id: voice.id,
            name: voice.name,
            provider: voice.provider,
            voice_id: voice.voice_id
          }
        }
      }
    },

    addCustomVoice: (state, action: PayloadAction<AIVoice>) => {
      state.customVoices.unshift(action.payload)
    },

    updateCustomVoice: (state, action: PayloadAction<AIVoice>) => {
      const index = state.customVoices.findIndex(v => v.id === action.payload.id)
      if (index !== -1) {
        state.customVoices[index] = action.payload
      }
    },

    removeCustomVoice: (state, action: PayloadAction<number>) => {
      state.customVoices = state.customVoices.filter(v => v.id !== action.payload)
    },

    clearVoiceManagementError: (state) => {
      state.voiceManagementError = null
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
  updateSubtitleContent,
  setAudioGenerationError,
  saveGenerationToHistory,
  clearCurrentGeneration,
  clearAllAudioData,
  // Voice management actions
  setIsLoadingVoices,
  setCustomVoices,
  setIsManagingVoice,
  setVoiceManagementError,
  setVoiceFormData,
  setShowVoiceForm,
  setEditingVoiceId,
  addCustomVoice,
  updateCustomVoice,
  removeCustomVoice,
  clearVoiceManagementError
} = audioSlice.actions

export default audioSlice.reducer 