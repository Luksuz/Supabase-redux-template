import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface StockImage {
  id: string | number
  url: string
  thumbnail: string
  source: 'pexels' | 'pixabay' | 'storyblocks'
  photographer: string
  type: 'image' | 'video'
}

export interface MediaCard {
  promptId: string
  prompt: string
  searchQuery?: string
  sceneNumber: number
  sourceType: 'search' | 'ai' // New field to distinguish source
  // Current selected media
  selectedImageUrl: string | null
  selectedImageType: 'image' | 'video' | null
  selectedSource: 'generated' | 'stock' | null
  isPortrait?: boolean // Track if image has been resized to portrait
  // Selection state
  isSelected: boolean
  selectionOrder: number | null // 1, 2, 3, etc.
  // Stock search results
  stockResults: StockImage[]
  isSearching: boolean
  searchError: string | null
  // Generation state
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string | null
  // Saved state
  isSaved: boolean
  savedUrl: string | null // Supabase public URL after saving
}

interface BatchImageGeneratorState {
  // Configuration
  provider: string
  aspectRatio: string
  searchProvider: 'pexels' | 'pixabay' | 'storyblocks' | 'flickr'
  searchType: 'image' | 'video'
  mode: 'generate' | 'search' | 'extract' // Added extract mode
  extractionType: 'video' | 'image' // For video/image extraction
  
  // Image generation configuration
  imagesToGenerate: number // Number of images to generate each time (1-50)
  
  // Media cards (simplified single source of truth)
  mediaCards: MediaCard[]
  
  // Generation state
  isGenerating: boolean
  progress: number
  currentBatch: number
  totalBatches: number
  timeRemaining: string | null
  
  // Selection state
  selectedCount: number
  nextSelectionOrder: number
  
  // Save state
  isSaving: boolean
  saveProgress: number
  
  // UI state
  error: string | null
}

const initialState: BatchImageGeneratorState = {
  provider: 'dalle-3',
  aspectRatio: '16:9',
  searchProvider: 'pexels',
  searchType: 'image',
  mode: 'generate',
  extractionType: 'image',
  
  imagesToGenerate: 10, // Default to 10 images
  
  mediaCards: [],
  
  isGenerating: false,
  progress: 0,
  currentBatch: 0,
  totalBatches: 0,
  timeRemaining: null,
  
  selectedCount: 0,
  nextSelectionOrder: 1,
  
  isSaving: false,
  saveProgress: 0,
  
  error: null,
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
    
    setSearchProvider: (state, action: PayloadAction<'pexels' | 'pixabay' | 'storyblocks' | 'flickr'>) => {
      state.searchProvider = action.payload
    },
    
    setSearchType: (state, action: PayloadAction<'image' | 'video'>) => {
      state.searchType = action.payload
    },
    
    setMode: (state, action: PayloadAction<'generate' | 'search' | 'extract'>) => {
      state.mode = action.payload
    },
    
    setExtractionType: (state, action: PayloadAction<'video' | 'image'>) => {
      state.extractionType = action.payload
    },
    
    setImagesToGenerate: (state, action: PayloadAction<number>) => {
      state.imagesToGenerate = Math.min(Math.max(action.payload, 1), 50) // Clamp between 1 and 50
    },
    
    // Initialize media cards from prompts
    initializeMediaCards: (state, action: PayloadAction<Array<{ promptId: string; prompt: string; searchQuery?: string; sceneNumber: number; sourceType: 'search' | 'ai' }>>) => {
      const newCards = action.payload.map(item => ({
        promptId: item.promptId,
        prompt: item.prompt,
        searchQuery: item.searchQuery,
        sceneNumber: item.sceneNumber,
        sourceType: item.sourceType,
        selectedImageUrl: null,
        selectedImageType: null,
        selectedSource: null,
        isSelected: false,
        selectionOrder: null,
        stockResults: [],
        isSearching: false,
        searchError: null,
        status: 'pending' as const,
        isSaved: false,
        savedUrl: null
      }))
      
      // Only add cards that don't already exist (same promptId)
      const existingPromptIds = new Set(state.mediaCards.map(card => card.promptId))
      const uniqueNewCards = newCards.filter(card => !existingPromptIds.has(card.promptId))
      
      state.mediaCards = [...state.mediaCards, ...uniqueNewCards]
    },
    
    // Stock search actions
    startStockSearch: (state, action: PayloadAction<{ promptId: string }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.isSearching = true
        card.searchError = null
      }
    },
    
    setStockSearchResults: (state, action: PayloadAction<{ promptId: string; results: StockImage[]; replaceSelected?: boolean }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.stockResults = action.payload.results
        card.isSearching = false
        // Auto-select first result if none selected OR if explicitly replacing
        if ((!card.selectedImageUrl || action.payload.replaceSelected) && action.payload.results.length > 0) {
          const firstResult = action.payload.results[0]
          card.selectedImageUrl = firstResult.url
          card.selectedImageType = firstResult.type
          card.selectedSource = 'stock'
          card.status = 'completed'
        }
      }
    },
    
    setStockSearchError: (state, action: PayloadAction<{ promptId: string; error: string }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.searchError = action.payload.error
        card.isSearching = false
      }
    },
    
    // Stop searching for a specific card
    stopStockSearch: (state, action: PayloadAction<{ promptId: string }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.isSearching = false
      }
    },
    
    // Search all cards
    searchAllCards: (state) => {
      state.mediaCards.forEach(card => {
        if (card.searchQuery) {
          card.isSearching = true
          card.searchError = null
        }
      })
    },
    
    // Image generation actions
    startGeneration: (state, action: PayloadAction<{ totalBatches: number }>) => {
      state.isGenerating = true
      state.progress = 0
      state.currentBatch = 0
      state.totalBatches = action.payload.totalBatches
      state.timeRemaining = null
      state.error = null
      
      // Reset generation status
      state.mediaCards.forEach(card => {
        card.status = 'pending'
        card.error = null
      })
    },
    
    updateBatch: (state, action: PayloadAction<{ batchNumber: number; timeRemaining: string | null }>) => {
      state.currentBatch = action.payload.batchNumber
      state.timeRemaining = action.payload.timeRemaining
    },
    
    updateProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload
    },
    
    updateCardStatus: (state, action: PayloadAction<{ promptId: string; status: MediaCard['status'] }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.status = action.payload.status
      }
    },
    
    updateCardResult: (state, action: PayloadAction<{ 
      promptId: string; 
      imageUrl: string | null; 
      status: MediaCard['status']; 
      error?: string; 
      mediaType?: 'image' | 'video';
      isPortrait?: boolean;
    }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.selectedImageUrl = action.payload.imageUrl
        card.selectedImageType = action.payload.mediaType || 'image'
        card.selectedSource = 'generated'
        card.status = action.payload.status
        card.error = action.payload.error
        if (action.payload.isPortrait !== undefined) {
          card.isPortrait = action.payload.isPortrait
        }
      }
    },
    
    completeGeneration: (state) => {
      state.isGenerating = false
      state.progress = 100
      state.timeRemaining = null
    },
    
    // Selection actions
    toggleCardSelection: (state, action: PayloadAction<{ promptId: string }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card && card.selectedImageUrl) {
        if (card.isSelected) {
          // Deselect
          card.isSelected = false
          const oldOrder = card.selectionOrder!
          card.selectionOrder = null
          state.selectedCount--
          
          // Adjust order numbers for remaining selections
          state.mediaCards.forEach(c => {
            if (c.selectionOrder && c.selectionOrder > oldOrder) {
              c.selectionOrder--
            }
          })
          state.nextSelectionOrder--
        } else {
          // Select
          card.isSelected = true
          card.selectionOrder = state.nextSelectionOrder
          state.selectedCount++
          state.nextSelectionOrder++
        }
      }
    },
    
    selectAllCards: (state) => {
      state.mediaCards.forEach(card => {
        if (card.selectedImageUrl && !card.isSelected) {
          card.isSelected = true
          card.selectionOrder = state.nextSelectionOrder
          state.selectedCount++
          state.nextSelectionOrder++
        }
      })
    },
    
    deselectAllCards: (state) => {
      state.mediaCards.forEach(card => {
        card.isSelected = false
        card.selectionOrder = null
      })
      state.selectedCount = 0
      state.nextSelectionOrder = 1
    },
    
    // Replace selected image with stock option
    selectStockImage: (state, action: PayloadAction<{ promptId: string; stockImage: StockImage }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card) {
        card.selectedImageUrl = action.payload.stockImage.url
        card.selectedImageType = action.payload.stockImage.type
        card.selectedSource = 'stock'
        card.status = 'completed'
        card.isSaved = false // Reset saved state when changing selection
        card.savedUrl = null
      }
    },
    
    // Save actions
    startSaving: (state) => {
      state.isSaving = true
      state.saveProgress = 0
    },
    
    updateSaveProgress: (state, action: PayloadAction<{ progress: number; savedUrl?: string; promptId?: string }>) => {
      state.saveProgress = action.payload.progress
      if (action.payload.savedUrl && action.payload.promptId) {
        const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
        if (card) {
          card.isSaved = true
          card.savedUrl = action.payload.savedUrl
        }
      }
    },
    
    completeSaving: (state) => {
      state.isSaving = false
      state.saveProgress = 100
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isGenerating = false
      state.isSaving = false
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    // Reset actions
    clearAllCards: (state) => {
      state.mediaCards = []
      state.selectedCount = 0
      state.nextSelectionOrder = 1
    },
    
    clearAllData: (state) => {
      return initialState
    },
    
    // Regenerate AI image with new prompt
    regenerateImage: (state, action: PayloadAction<{ promptId: string; newPrompt: string }>) => {
      const card = state.mediaCards.find(c => c.promptId === action.payload.promptId)
      if (card && card.sourceType === 'ai') {
        const wasSelected = card.isSelected
        const oldOrder = card.selectionOrder
        
        card.prompt = action.payload.newPrompt
        card.status = 'generating'
        card.error = null
        card.selectedImageUrl = null
        card.isSelected = false
        card.selectionOrder = null
        
        // Adjust selection order for other cards if this was selected
        if (wasSelected && oldOrder !== null) {
          state.mediaCards.forEach(c => {
            if (c.selectionOrder && c.selectionOrder > oldOrder) {
              c.selectionOrder--
            }
          })
          state.selectedCount--
          state.nextSelectionOrder--
        }
      }
    },
    
    // Add custom image card
    addCustomImageCard: (state, action: PayloadAction<{ 
      prompt?: string; 
      searchQuery?: string; 
      sourceType: 'search' | 'ai'; 
      customProvider?: string;
      customSearchProvider?: 'pexels' | 'pixabay' | 'storyblocks' | 'flickr';
      customId?: string; // Add optional customId
    }>) => {
      const customId = action.payload.customId || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const sceneNumber = Math.max(...state.mediaCards.map(c => c.sceneNumber), 0) + 1
      
      const newCard: MediaCard = {
        promptId: customId,
        prompt: action.payload.prompt || '',
        searchQuery: action.payload.searchQuery,
        sceneNumber: sceneNumber,
        sourceType: action.payload.sourceType,
        selectedImageUrl: null,
        selectedImageType: null,
        selectedSource: null,
        isSelected: false,
        selectionOrder: null,
        stockResults: [],
        isSearching: false,
        searchError: null,
        status: 'pending',
        isSaved: false,
        savedUrl: null
      }
      
      state.mediaCards.push(newCard)
    },
  }
})

export const {
  setProvider,
  setAspectRatio,
  setSearchProvider,
  setSearchType,
  setMode,
  setExtractionType,
  setImagesToGenerate,
  initializeMediaCards,
  startStockSearch,
  setStockSearchResults,
  setStockSearchError,
  stopStockSearch,
  searchAllCards,
  startGeneration,
  updateBatch,
  updateProgress,
  updateCardStatus,
  updateCardResult,
  completeGeneration,
  toggleCardSelection,
  selectAllCards,
  deselectAllCards,
  selectStockImage,
  startSaving,
  updateSaveProgress,
  completeSaving,
  setError,
  clearError,
  clearAllCards,
  clearAllData,
  regenerateImage,
  addCustomImageCard
} = batchImageGeneratorSlice.actions

export default batchImageGeneratorSlice.reducer 