import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type AudioProvider = 'minimax' | 'elevenlabs'

export interface SimpleAudioState {
  // Audio generation state
  isGenerating: boolean
  generatedAudioUrl: string | null
  generatedFilename: string | null
  error: string | null
  
  // Provider settings
  selectedProvider: AudioProvider
  
  // Minimax settings
  minimaxVoice: string
  minimaxModel: string
  
  // ElevenLabs settings
  elevenLabsVoice: string
  elevenLabsModel: string
  elevenLabsLanguage: string
  
  // Input text
  textToConvert: string
}

const initialState: SimpleAudioState = {
  isGenerating: false,
  generatedAudioUrl: null,
  generatedFilename: null,
  error: null,
  
  selectedProvider: 'minimax',
  
  // Default MiniMax settings
  minimaxVoice: 'English_radiant_girl',
  minimaxModel: 'speech-02-hd',
  
  // Default ElevenLabs settings
  elevenLabsVoice: 'Rachel',
  elevenLabsModel: 'eleven_multilingual_v2',
  elevenLabsLanguage: 'en',
  
  textToConvert: ''
}

export const simpleAudioSlice = createSlice({
  name: 'simpleAudio',
  initialState,
  reducers: {
    setSelectedProvider: (state, action: PayloadAction<AudioProvider>) => {
      state.selectedProvider = action.payload
    },
    
    setMinimaxVoice: (state, action: PayloadAction<string>) => {
      state.minimaxVoice = action.payload
    },
    
    setMinimaxModel: (state, action: PayloadAction<string>) => {
      state.minimaxModel = action.payload
    },
    
    setElevenLabsVoice: (state, action: PayloadAction<string>) => {
      state.elevenLabsVoice = action.payload
    },
    
    setElevenLabsModel: (state, action: PayloadAction<string>) => {
      state.elevenLabsModel = action.payload
    },
    
    setElevenLabsLanguage: (state, action: PayloadAction<string>) => {
      state.elevenLabsLanguage = action.payload
    },
    
    setTextToConvert: (state, action: PayloadAction<string>) => {
      state.textToConvert = action.payload
    },
    
    startGeneration: (state) => {
      state.isGenerating = true
      state.error = null
      state.generatedAudioUrl = null
    },
    
    completeGeneration: (state, action: PayloadAction<{ audioUrl: string; filename: string }>) => {
      state.isGenerating = false
      state.generatedAudioUrl = action.payload.audioUrl
      state.generatedFilename = action.payload.filename
      state.error = null
    },
    
    failGeneration: (state, action: PayloadAction<string>) => {
      state.isGenerating = false
      state.error = action.payload
      state.generatedAudioUrl = null
      state.generatedFilename = null
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    clearAudio: (state) => {
      state.generatedAudioUrl = null
      state.generatedFilename = null
      state.error = null
    },
    
    reset: (state) => {
      return initialState
    }
  }
})

export const {
  setSelectedProvider,
  setMinimaxVoice,
  setMinimaxModel,
  setElevenLabsVoice,
  setElevenLabsModel,
  setElevenLabsLanguage,
  setTextToConvert,
  startGeneration,
  completeGeneration,
  failGeneration,
  clearError,
  clearAudio,
  reset
} = simpleAudioSlice.actions

export default simpleAudioSlice.reducer 