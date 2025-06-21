import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  provider: string
  generatedAt: string
  isSelected: boolean
  thumbnailUrl?: string
}

// New interface to match the provided code structure
export interface GeneratedImageSet {
  originalPrompt: string
  imageUrls: string[]
  imageData: string[] // base64 data
  generatedAt: string
  provider: string
}

// Scene extraction interface
export interface ExtractedScene {
  chunkIndex: number
  originalText: string
  imagePrompt: string
  summary: string
  error?: string
}

export interface ImageGenerationRequest {
  id: string
  prompt: string
  provider: string
  numberOfImages: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  progress: number
  generatedImages: GeneratedImage[]
  error?: string
  createdAt: string
}

interface ImageGenerationState {
  // Current generation session
  currentGeneration: ImageGenerationRequest | null
  
  // Generated image sets (matching the provided component structure)
  imageSets: GeneratedImageSet[]
  
  // All generated images from current session
  generatedImages: GeneratedImage[]
  
  // Generation history
  generationHistory: ImageGenerationRequest[]
  
  // UI state
  isGenerating: boolean
  selectedProvider: string
  numberOfImagesPerPrompt: number
  
  // Input fields
  manualPrompt: string
  useScriptPrompts: boolean
  
  // Selection state
  selectedImageIds: string[]
  selectedImages: Array<{ setIndex: number; imageIndex: number; prompt: string }>
  
  // Script sections and custom prompts
  selectedSections: number[]
  customPrompts: string[]
  newCustomPrompt: string
  
  // Image style options
  selectedImageStyle: string
  customStyleInput: string
  imageTonePreference: string
  selectedResolution: string
  
  // Scene extraction state
  extractedScenes: ExtractedScene[]
  isExtractingScenes: boolean
  sceneExtractionError: string | null
  numberOfScenesToExtract: number
  selectedScenes: number[]
  activeImageSource: 'prompts' | 'scenes'
  
  // Thumbnail generation state
  thumbnailPrompt: string
  isGeneratingThumbnail: boolean
  thumbnailUrl: string | null
  thumbnailError: string | null
  thumbnailStyle: string
  customThumbnailStyle: string
  thumbnailTone: string
  
  // Regeneration state
  regenerating: boolean
  regeneratingPrompt: string | null
  regeneratingType: 'single' | 'selected' | 'all' | null
  editingImageIndex: { setIndex: number; imageIndex: number } | null
  editedPrompt: string
  
  // Progress tracking
  currentBatch: number
  totalBatches: number
  currentPromptIndex: number
  totalPrompts: number
  generatingInfo: string | null
  
  // Error handling
  lastError: string | null
  generationError: string | null
}

const initialState: ImageGenerationState = {
  currentGeneration: null,
  imageSets: [],
  generatedImages: [],
  generationHistory: [],
  isGenerating: false,
  selectedProvider: 'minimax',
  numberOfImagesPerPrompt: 1,
  manualPrompt: '',
  useScriptPrompts: true,
  selectedImageIds: [],
  selectedImages: [],
  selectedSections: [],
  customPrompts: [],
  newCustomPrompt: '',
  selectedImageStyle: 'realistic',
  customStyleInput: '',
  imageTonePreference: 'balanced',
  selectedResolution: '1536x1024',
  extractedScenes: [],
  isExtractingScenes: false,
  sceneExtractionError: null,
  numberOfScenesToExtract: 5,
  selectedScenes: [],
  activeImageSource: 'prompts',
  thumbnailPrompt: '',
  isGeneratingThumbnail: false,
  thumbnailUrl: null,
  thumbnailError: null,
  thumbnailStyle: 'realistic',
  customThumbnailStyle: '',
  thumbnailTone: 'balanced',
  regenerating: false,
  regeneratingPrompt: null,
  regeneratingType: null,
  editingImageIndex: null,
  editedPrompt: '',
  currentBatch: 0,
  totalBatches: 0,
  currentPromptIndex: 0,
  totalPrompts: 0,
  generatingInfo: null,
  lastError: null,
  generationError: null
}

export const imageGenerationSlice = createSlice({
  name: 'imageGeneration',
  initialState,
  reducers: {
    // Input field actions
    setManualPrompt: (state, action: PayloadAction<string>) => {
      state.manualPrompt = action.payload
    },
    
    setSelectedProvider: (state, action: PayloadAction<string>) => {
      state.selectedProvider = action.payload
    },
    
    setNumberOfImagesPerPrompt: (state, action: PayloadAction<number>) => {
      state.numberOfImagesPerPrompt = action.payload
    },
    
    setUseScriptPrompts: (state, action: PayloadAction<boolean>) => {
      state.useScriptPrompts = action.payload
    },
    
    // New actions for custom prompts
    setNewCustomPrompt: (state, action: PayloadAction<string>) => {
      state.newCustomPrompt = action.payload
    },
    
    addCustomPrompt: (state) => {
      if (state.newCustomPrompt.trim()) {
        state.customPrompts.push(state.newCustomPrompt.trim())
        state.newCustomPrompt = ''
      }
    },
    
    removeCustomPrompt: (state, action: PayloadAction<number>) => {
      state.customPrompts.splice(action.payload, 1)
    },
    
    // Section selection actions
    toggleSectionSelection: (state, action: PayloadAction<number>) => {
      const index = action.payload
      const currentIndex = state.selectedSections.indexOf(index)
      if (currentIndex > -1) {
        state.selectedSections.splice(currentIndex, 1)
      } else {
        state.selectedSections.push(index)
      }
    },
    
    clearSelectedSections: (state) => {
      state.selectedSections = []
    },
    
    selectAllSections: (state, action: PayloadAction<number>) => {
      const totalSections = action.payload
      state.selectedSections = Array.from({length: totalSections}, (_, i) => i)
    },
    
    // Style options actions
    setSelectedImageStyle: (state, action: PayloadAction<string>) => {
      state.selectedImageStyle = action.payload
    },
    
    setCustomStyleInput: (state, action: PayloadAction<string>) => {
      state.customStyleInput = action.payload
    },
    
    setImageTonePreference: (state, action: PayloadAction<string>) => {
      state.imageTonePreference = action.payload
    },
    
    setSelectedResolution: (state, action: PayloadAction<string>) => {
      state.selectedResolution = action.payload
    },
    
    // Scene extraction actions
    startSceneExtraction: (state, action: PayloadAction<number>) => {
      state.isExtractingScenes = true
      state.numberOfScenesToExtract = action.payload
      state.sceneExtractionError = null
    },
    
    setExtractedScenes: (state, action: PayloadAction<ExtractedScene[]>) => {
      state.extractedScenes = action.payload
      state.isExtractingScenes = false
      if (action.payload.length > 0) {
        state.activeImageSource = 'scenes'
      }
    },
    
    setSceneExtractionError: (state, action: PayloadAction<string>) => {
      state.sceneExtractionError = action.payload
      state.isExtractingScenes = false
    },
    
    setNumberOfScenesToExtract: (state, action: PayloadAction<number>) => {
      state.numberOfScenesToExtract = action.payload
    },
    
    toggleSceneSelection: (state, action: PayloadAction<number>) => {
      const index = action.payload
      const currentIndex = state.selectedScenes.indexOf(index)
      if (currentIndex > -1) {
        state.selectedScenes.splice(currentIndex, 1)
      } else {
        state.selectedScenes.push(index)
      }
    },
    
    clearSelectedScenes: (state) => {
      state.selectedScenes = []
    },
    
    selectAllScenes: (state) => {
      state.selectedScenes = Array.from({length: state.extractedScenes.length}, (_, i) => i)
    },
    
    setActiveImageSource: (state, action: PayloadAction<'prompts' | 'scenes'>) => {
      state.activeImageSource = action.payload
    },
    
    // Thumbnail generation actions
    setThumbnailPrompt: (state, action: PayloadAction<string>) => {
      state.thumbnailPrompt = action.payload
    },
    
    startThumbnailGeneration: (state) => {
      state.isGeneratingThumbnail = true
      state.thumbnailError = null
    },
    
    setThumbnailUrl: (state, action: PayloadAction<string>) => {
      state.thumbnailUrl = action.payload
      state.isGeneratingThumbnail = false
    },
    
    setThumbnailError: (state, action: PayloadAction<string>) => {
      state.thumbnailError = action.payload
      state.isGeneratingThumbnail = false
    },
    
    setThumbnailStyle: (state, action: PayloadAction<string>) => {
      state.thumbnailStyle = action.payload
    },
    
    setCustomThumbnailStyle: (state, action: PayloadAction<string>) => {
      state.customThumbnailStyle = action.payload
    },
    
    setThumbnailTone: (state, action: PayloadAction<string>) => {
      state.thumbnailTone = action.payload
    },
    
    // Generation actions
    startImageGeneration: (state, action: PayloadAction<{
      id: string
      prompts: string[]
      provider: string
      numberOfImages: number
    }>) => {
      const { id, prompts, provider, numberOfImages } = action.payload
      
      state.currentGeneration = {
        id,
        prompt: prompts.join(' | '),
        provider,
        numberOfImages,
        status: 'generating',
        progress: 0,
        generatedImages: [],
        createdAt: new Date().toISOString()
      }
      
      state.isGenerating = true
      state.totalPrompts = prompts.length
      state.currentPromptIndex = 0
      state.totalBatches = Math.ceil(prompts.length / 5) // Assuming batch size of 5
      state.currentBatch = 0
      state.lastError = null
      state.generationError = null
      state.generatingInfo = null
    },
    
    updateGenerationProgress: (state, action: PayloadAction<{
      currentBatch?: number
      currentPromptIndex?: number
      progress?: number
      generatingInfo?: string
    }>) => {
      const { currentBatch, currentPromptIndex, progress, generatingInfo } = action.payload
      
      if (currentBatch !== undefined) state.currentBatch = currentBatch
      if (currentPromptIndex !== undefined) state.currentPromptIndex = currentPromptIndex
      if (generatingInfo !== undefined) state.generatingInfo = generatingInfo
      if (progress !== undefined && state.currentGeneration) {
        state.currentGeneration.progress = progress
      }
    },
    
    addGeneratedImageSet: (state, action: PayloadAction<GeneratedImageSet>) => {
      state.imageSets.push(action.payload)
    },
    
    addGeneratedImages: (state, action: PayloadAction<GeneratedImage[]>) => {
      const newImages = action.payload
      
      // Add to current generation
      if (state.currentGeneration) {
        state.currentGeneration.generatedImages.push(...newImages)
      }
      
      // Add to main generated images list
      state.generatedImages.push(...newImages)
    },
    
    completeImageGeneration: (state) => {
      if (state.currentGeneration) {
        state.currentGeneration.status = 'completed'
        state.currentGeneration.progress = 100
        
        // Add to history
        state.generationHistory.unshift(state.currentGeneration)
        
        // Keep only last 10 generations in history
        state.generationHistory = state.generationHistory.slice(0, 10)
      }
      
      state.isGenerating = false
      state.currentBatch = 0
      state.totalBatches = 0
      state.currentPromptIndex = 0
      state.totalPrompts = 0
      state.generatingInfo = null
    },
    
    setImageGenerationError: (state, action: PayloadAction<string>) => {
      if (state.currentGeneration) {
        state.currentGeneration.status = 'failed'
        state.currentGeneration.error = action.payload
      }
      
      state.lastError = action.payload
      state.generationError = action.payload
      state.isGenerating = false
      state.generatingInfo = null
    },
    
    // Image selection actions for regeneration
    toggleImageSelectionForRegeneration: (state, action: PayloadAction<{
      setIndex: number
      imageIndex: number
      prompt: string
    }>) => {
      const { setIndex, imageIndex, prompt } = action.payload
      const existingIndex = state.selectedImages.findIndex(
        item => item.setIndex === setIndex && item.imageIndex === imageIndex
      )
      
      if (existingIndex >= 0) {
        state.selectedImages.splice(existingIndex, 1)
      } else {
        state.selectedImages.push({ setIndex, imageIndex, prompt })
      }
    },
    
    clearSelectedImagesForRegeneration: (state) => {
      state.selectedImages = []
    },
    
    // Regeneration actions
    startRegeneration: (state, action: PayloadAction<{
      type: 'single' | 'selected' | 'all'
      prompt?: string
    }>) => {
      state.regenerating = true
      state.regeneratingType = action.payload.type
      state.regeneratingPrompt = action.payload.prompt || null
    },
    
    completeRegeneration: (state) => {
      state.regenerating = false
      state.regeneratingType = null
      state.regeneratingPrompt = null
      state.selectedImages = []
    },
    
    // Edit image actions
    startEditingImage: (state, action: PayloadAction<{
      setIndex: number
      imageIndex: number
      prompt: string
    }>) => {
      const { setIndex, imageIndex, prompt } = action.payload
      state.editingImageIndex = { setIndex, imageIndex }
      state.editedPrompt = prompt
    },
    
    setEditedPrompt: (state, action: PayloadAction<string>) => {
      state.editedPrompt = action.payload
    },
    
    cancelEditing: (state) => {
      state.editingImageIndex = null
      state.editedPrompt = ''
    },
    
    // Legacy image selection actions
    toggleImageSelection: (state, action: PayloadAction<string>) => {
      const imageId = action.payload
      const index = state.selectedImageIds.indexOf(imageId)
      
      if (index > -1) {
        state.selectedImageIds.splice(index, 1)
      } else {
        state.selectedImageIds.push(imageId)
      }
      
      // Update isSelected in generated images
      const image = state.generatedImages.find(img => img.id === imageId)
      if (image) {
        image.isSelected = !image.isSelected
      }
    },
    
    selectAllImages: (state) => {
      state.selectedImageIds = state.generatedImages.map(img => img.id)
      state.generatedImages.forEach(img => {
        img.isSelected = true
      })
    },
    
    deselectAllImages: (state) => {
      state.selectedImageIds = []
      state.generatedImages.forEach(img => {
        img.isSelected = false
      })
    },
    
    // Clear actions
    clearGeneratedImages: (state) => {
      state.generatedImages = []
      state.imageSets = []
      state.selectedImageIds = []
      state.selectedImages = []
      state.currentGeneration = null
    },
    
    clearImageGenerationHistory: (state) => {
      state.generationHistory = []
    },
    
    // Remove specific image
    removeGeneratedImage: (state, action: PayloadAction<string>) => {
      const imageId = action.payload
      
      // Remove from generated images
      state.generatedImages = state.generatedImages.filter(img => img.id !== imageId)
      
      // Remove from selection
      state.selectedImageIds = state.selectedImageIds.filter(id => id !== imageId)
      
      // Remove from current generation if exists
      if (state.currentGeneration) {
        state.currentGeneration.generatedImages = state.currentGeneration.generatedImages.filter(img => img.id !== imageId)
      }
    }
  }
})

export const {
  setManualPrompt,
  setSelectedProvider,
  setNumberOfImagesPerPrompt,
  setUseScriptPrompts,
  setNewCustomPrompt,
  addCustomPrompt,
  removeCustomPrompt,
  toggleSectionSelection,
  clearSelectedSections,
  selectAllSections,
  setSelectedImageStyle,
  setCustomStyleInput,
  setImageTonePreference,
  setSelectedResolution,
  startSceneExtraction,
  setExtractedScenes,
  setSceneExtractionError,
  setNumberOfScenesToExtract,
  toggleSceneSelection,
  clearSelectedScenes,
  selectAllScenes,
  setActiveImageSource,
  setThumbnailPrompt,
  startThumbnailGeneration,
  setThumbnailUrl,
  setThumbnailError,
  setThumbnailStyle,
  setCustomThumbnailStyle,
  setThumbnailTone,
  startImageGeneration,
  updateGenerationProgress,
  addGeneratedImageSet,
  addGeneratedImages,
  completeImageGeneration,
  setImageGenerationError,
  toggleImageSelectionForRegeneration,
  clearSelectedImagesForRegeneration,
  startRegeneration,
  completeRegeneration,
  startEditingImage,
  setEditedPrompt,
  cancelEditing,
  toggleImageSelection,
  selectAllImages,
  deselectAllImages,
  clearGeneratedImages,
  clearImageGenerationHistory,
  removeGeneratedImage
} = imageGenerationSlice.actions

export default imageGenerationSlice.reducer 