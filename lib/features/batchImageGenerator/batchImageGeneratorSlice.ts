import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedImage {
  promptId: string
  prompt: string
  imageUrl: string | null
  mediaType?: 'image' | 'video'
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string | null
  generatedAt?: string
}

export interface StockImage {
  id: string | number
  url: string
  thumbnail: string
  source: 'pexels' | 'pixabay'
  photographer: string
  type: 'image' | 'video'
}

export interface StockSearchResults {
  pexels: StockImage[]
  pixabay: StockImage[]
  storyblocks: StockImage[]
  isSearching: boolean
  error?: string | null
}

interface BatchImageGeneratorState {
  // Configuration
  provider: string
  aspectRatio: string
  
  // Generation state
  generatedImages: GeneratedImage[]
  isGenerating: boolean
  progress: number
  currentBatch: number
  totalBatches: number
  timeRemaining: string | null
  
  // Statistics
  totalGenerated: number
  totalErrors: number
  lastGeneratedAt: string | null
  
  // UI state
  error: string | null
  stockSearchResults: Record<string, StockSearchResults>
}

const initialState: BatchImageGeneratorState = {
  provider: 'dalle-3',
  aspectRatio: '16:9',
  
  generatedImages: [],
  isGenerating: false,
  progress: 0,
  currentBatch: 0,
  totalBatches: 0,
  timeRemaining: null,
  
  totalGenerated: 0,
  totalErrors: 0,
  lastGeneratedAt: null,
  
  error: null,
  stockSearchResults: {}
}

export const batchImageGeneratorSlice = createSlice({
  name: 'batchImageGenerator',
  initialState,
  reducers: {
    // Configuration actions
    setProvider: (state, action: PayloadAction<string>) => {
      state.provider = action.payload
    },
    
    setAspectRatio: (state, action: PayloadAction<string>) => {
      state.aspectRatio = action.payload
    },
    
    // Generation state actions
    startGeneration: (state, action: PayloadAction<{ totalBatches: number; initialImages: GeneratedImage[] }>) => {
      state.isGenerating = true
      state.progress = 0
      state.currentBatch = 0
      state.totalBatches = action.payload.totalBatches
      state.generatedImages = action.payload.initialImages
      state.timeRemaining = null
      state.error = null
    },
    
    updateBatch: (state, action: PayloadAction<{ batchNumber: number; timeRemaining: string | null }>) => {
      state.currentBatch = action.payload.batchNumber
      state.timeRemaining = action.payload.timeRemaining
    },
    
    updateProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload
    },
    
    updateImageStatus: (state, action: PayloadAction<{ promptId: string; status: GeneratedImage['status'] }>) => {
      const image = state.generatedImages.find(img => img.promptId === action.payload.promptId)
      if (image) {
        image.status = action.payload.status
      }
    },
    
    updateImageResult: (state, action: PayloadAction<{ promptId: string; imageUrl: string | null; status: GeneratedImage['status']; error?: string; mediaType?: 'image' | 'video' }>) => {
      let image = state.generatedImages.find(img => img.promptId === action.payload.promptId)
      if (!image) {
        // Insert new entry if it doesn't exist
        image = {
          promptId: action.payload.promptId,
          prompt: '',
          imageUrl: action.payload.imageUrl,
          mediaType: action.payload.mediaType || 'image',
          status: action.payload.status,
          error: action.payload.error,
          generatedAt: action.payload.status === 'completed' ? new Date().toISOString() : undefined
        }
        state.generatedImages.push(image)
      } else {
        image.imageUrl = action.payload.imageUrl
        image.status = action.payload.status
        image.error = action.payload.error
        image.mediaType = action.payload.mediaType || 'image'
        if (action.payload.status === 'completed') {
          image.generatedAt = new Date().toISOString()
        }
      }
    },
    
    completeGeneration: (state) => {
      state.isGenerating = false
      state.progress = 100
      state.timeRemaining = null
      state.lastGeneratedAt = new Date().toISOString()
      
      // Update statistics
      state.totalGenerated = state.generatedImages.filter(img => img.status === 'completed').length
      state.totalErrors = state.generatedImages.filter(img => img.status === 'error').length
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isGenerating = false
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    // Reset actions
    clearImages: (state) => {
      state.generatedImages = []
      state.totalGenerated = 0
      state.totalErrors = 0
      state.progress = 0
      state.currentBatch = 0
      state.totalBatches = 0
      state.timeRemaining = null
      state.error = null
      state.stockSearchResults = {}
    },
    
    startStockSearch: (state, action: PayloadAction<{ promptId: string }>) => {
      const { promptId } = action.payload
      if (!state.stockSearchResults[promptId]) {
        state.stockSearchResults[promptId] = { pexels: [], pixabay: [], storyblocks: [], isSearching: false }
      }
      state.stockSearchResults[promptId].isSearching = true
      state.stockSearchResults[promptId].error = null
    },
    
    setStockSearchResult: (state, action: PayloadAction<{ promptId: string; provider: 'pexels' | 'pixabay' | 'storyblocks'; results: StockImage[] }>) => {
      const { promptId, provider, results } = action.payload
      if (state.stockSearchResults[promptId]) {
        state.stockSearchResults[promptId][provider] = results
        state.stockSearchResults[promptId].isSearching = false
      }
    },
    
    setStockSearchError: (state, action: PayloadAction<{ promptId: string; error: string }>) => {
      const { promptId, error } = action.payload
      if (state.stockSearchResults[promptId]) {
        state.stockSearchResults[promptId].error = error
        state.stockSearchResults[promptId].isSearching = false
      }
    },

    prepareForNewSearch: (state, action: PayloadAction<{ promptIds: string[] }>) => {
      action.payload.promptIds.forEach(promptId => {
        const image = state.generatedImages.find(img => img.promptId === promptId)
        if (image) {
          image.imageUrl = null
          image.status = 'pending'
        }
      })
      state.stockSearchResults = {}
    },
    
    clearAllImageData: (state) => {
      return initialState
    }
  }
})

export const {
  setProvider,
  setAspectRatio,
  startGeneration,
  updateBatch,
  updateProgress,
  updateImageStatus,
  updateImageResult,
  completeGeneration,
  setError,
  clearError,
  clearImages,
  startStockSearch,
  setStockSearchResult,
  setStockSearchError,
  prepareForNewSearch,
  clearAllImageData
} = batchImageGeneratorSlice.actions

export default batchImageGeneratorSlice.reducer 