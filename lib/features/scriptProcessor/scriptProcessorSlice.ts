import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ScriptChunk {
  id: string
  text: string
  wordCount: number
  chunkIndex: number
}

export interface GeneratedPrompt {
  chunkId: string
  prompt: string
  searchQuery: string
  generated: boolean
}

// Add interface for script summary
export interface ScriptSummary {
  storySummary: string
  mainCharacters: string
  setting: string
  tone: string
}

interface ScriptProcessorState {
  // Script input
  pastedScript: string
  fileName: string
  
  // Script summary
  scriptSummary: ScriptSummary | null
  
  // Image generation parameters
  visualStyle: string
  mood: string
  lighting: string
  customParameters: string
  
  // Chunking
  chunks: ScriptChunk[]
  selectedSceneCount: number
  maxScenes: number
  
  // Generated prompts
  prompts: GeneratedPrompt[]
  hasGeneratedPrompts: boolean
  
  // UI state
  isProcessing: boolean
  processingProgress: number
  lastProcessedAt: string | null
  error: string | null
}

const initialState: ScriptProcessorState = {
  pastedScript: '',
  fileName: '',
  
  scriptSummary: null,
  
  visualStyle: 'photorealistic',
  mood: 'dramatic',
  lighting: 'natural',
  customParameters: '',
  
  chunks: [],
  selectedSceneCount: 50,
  maxScenes: 200,
  
  prompts: [],
  hasGeneratedPrompts: false,
  
  isProcessing: false,
  processingProgress: 0,
  lastProcessedAt: null,
  error: null
}

export const scriptProcessorSlice = createSlice({
  name: 'scriptProcessor',
  initialState,
  reducers: {
    // Script input actions
    setPastedScript: (state, action: PayloadAction<string>) => {
      state.pastedScript = action.payload
      state.fileName = ''
      state.chunks = []
      state.prompts = []
      state.hasGeneratedPrompts = false
      state.scriptSummary = null
      state.error = null
    },
    
    setUploadedFile: (state, action: PayloadAction<string>) => {
      state.fileName = action.payload
      state.chunks = []
      state.prompts = []
      state.hasGeneratedPrompts = false
      state.scriptSummary = null
      state.error = null
    },
    
    // Script summary actions
    setScriptSummary: (state, action: PayloadAction<ScriptSummary>) => {
      state.scriptSummary = action.payload
    },
    
    // Parameter actions
    setVisualStyle: (state, action: PayloadAction<string>) => {
      state.visualStyle = action.payload
    },
    
    setMood: (state, action: PayloadAction<string>) => {
      state.mood = action.payload
    },
    
    setLighting: (state, action: PayloadAction<string>) => {
      state.lighting = action.payload
    },
    
    setCustomParameters: (state, action: PayloadAction<string>) => {
      state.customParameters = action.payload
    },
    
    // Chunking actions
    setChunks: (state, action: PayloadAction<ScriptChunk[]>) => {
      state.chunks = action.payload
      state.prompts = []
      state.hasGeneratedPrompts = false
    },
    
    setSelectedSceneCount: (state, action: PayloadAction<number>) => {
      state.selectedSceneCount = Math.min(action.payload, state.maxScenes)
    },
    
    // Prompt generation actions
    startProcessing: (state) => {
      state.isProcessing = true
      state.processingProgress = 0
      state.error = null
    },
    
    updateProcessingProgress: (state, action: PayloadAction<number>) => {
      state.processingProgress = action.payload
    },
    
    setPrompts: (state, action: PayloadAction<GeneratedPrompt[]>) => {
      state.prompts = action.payload
      state.hasGeneratedPrompts = action.payload.length > 0
      state.isProcessing = false
      state.processingProgress = 100
      state.lastProcessedAt = new Date().toISOString()
    },
    
    updatePrompt: (state, action: PayloadAction<{ chunkId: string; prompt: string; generated: boolean; searchQuery: string }>) => {
      const { chunkId, prompt, generated, searchQuery } = action.payload
      const existingPrompt = state.prompts.find(p => p.chunkId === chunkId)
      if (existingPrompt) {
        existingPrompt.prompt = prompt
        existingPrompt.generated = generated
        existingPrompt.searchQuery = searchQuery
      } else {
        state.prompts.push({ chunkId, prompt, generated, searchQuery })
      }
      
      if (generated) {
        state.hasGeneratedPrompts = true
        state.lastProcessedAt = new Date().toISOString()
      }
    },
    
    completeProcessing: (state) => {
      state.isProcessing = false
      state.processingProgress = 100
      state.lastProcessedAt = new Date().toISOString()
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isProcessing = false
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    clearScript: (state) => {
      state.pastedScript = ''
      state.fileName = ''
      state.chunks = []
      state.prompts = []
      state.hasGeneratedPrompts = false
      state.scriptSummary = null
      state.error = null
    }
  }
})

export const {
  setPastedScript,
  setUploadedFile,
  setScriptSummary,
  setVisualStyle,
  setMood,
  setLighting,
  setCustomParameters,
  setChunks,
  setSelectedSceneCount,
  startProcessing,
  updateProcessingProgress,
  setPrompts,
  updatePrompt,
  completeProcessing,
  setError,
  clearError,
  clearScript
} = scriptProcessorSlice.actions

export default scriptProcessorSlice.reducer 