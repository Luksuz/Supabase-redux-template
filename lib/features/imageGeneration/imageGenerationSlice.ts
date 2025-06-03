import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ImageGenerationState, GeneratedImageSet, ExtractedScene } from '../../../types/image-generation'

const initialState: ImageGenerationState = {
  currentGeneration: null,
  imageSets: [],
  isGenerating: false,
  error: null,
  generationInfo: null,
  // Settings (only MiniMax, so simplified)
  aspectRatio: '16:9',
  numberOfImages: 1,
  // Scene extraction
  extractedScenes: [],
  isExtractingScenes: false,
  sceneExtractionError: null,
  numberOfScenesToExtract: 5
}

export const imageGenerationSlice = createSlice({
  name: 'imageGeneration',
  initialState,
  reducers: {
    // Settings
    setAspectRatio: (state, action: PayloadAction<'16:9' | '1:1' | '9:16'>) => {
      state.aspectRatio = action.payload
    },
    
    setNumberOfImages: (state, action: PayloadAction<number>) => {
      state.numberOfImages = Math.max(1, Math.min(10, action.payload)) // Limit 1-10
    },

    setNumberOfScenesToExtract: (state, action: PayloadAction<number>) => {
      state.numberOfScenesToExtract = Math.max(1, Math.min(100, action.payload)) // Limit 1-100
    },

    // Scene extraction lifecycle
    startSceneExtraction: (state, action: PayloadAction<{ numberOfScenes: number }>) => {
      state.isExtractingScenes = true
      state.sceneExtractionError = null
      state.extractedScenes = []
    },

    completeSceneExtraction: (state, action: PayloadAction<{ scenes: ExtractedScene[] }>) => {
      state.isExtractingScenes = false
      state.extractedScenes = action.payload.scenes
      state.sceneExtractionError = null
    },

    failSceneExtraction: (state, action: PayloadAction<string>) => {
      state.isExtractingScenes = false
      state.sceneExtractionError = action.payload
    },

    clearExtractedScenes: (state) => {
      state.extractedScenes = []
      state.sceneExtractionError = null
    },

    // Generation lifecycle
    startGeneration: (state, action: PayloadAction<{ 
      id: string
      prompt: string
      numberOfImages: number
    }>) => {
      const { id, prompt, numberOfImages } = action.payload
      
      state.currentGeneration = {
        id,
        originalPrompt: prompt,
        imageUrls: [],
        imageData: [],
        provider: 'minimax', // Only MiniMax
        generatedAt: new Date().toISOString(),
        aspectRatio: state.aspectRatio
      }
      state.isGenerating = true
      state.error = null
      state.generationInfo = `Generating ${numberOfImages} image${numberOfImages > 1 ? 's' : ''}...`
    },

    updateGenerationInfo: (state, action: PayloadAction<string>) => {
      state.generationInfo = action.payload
    },

    completeGeneration: (state, action: PayloadAction<{ 
      imageUrls: string[]
    }>) => {
      if (state.currentGeneration) {
        state.currentGeneration.imageUrls = action.payload.imageUrls
        
        // Add to history
        state.imageSets.push({ ...state.currentGeneration })
      }
      
      state.isGenerating = false
      state.generationInfo = null
      state.error = null
    },

    failGeneration: (state, action: PayloadAction<string>) => {
      state.isGenerating = false
      state.error = action.payload
      state.generationInfo = null
    },

    clearError: (state) => {
      state.error = null
      state.sceneExtractionError = null
    },

    clearImageSets: (state) => {
      state.imageSets = []
      state.currentGeneration = null
    },

    removeImageSet: (state, action: PayloadAction<string>) => {
      state.imageSets = state.imageSets.filter(set => set.id !== action.payload)
    }
  }
})

export const { 
  setAspectRatio,
  setNumberOfImages,
  setNumberOfScenesToExtract,
  startSceneExtraction,
  completeSceneExtraction,
  failSceneExtraction,
  clearExtractedScenes,
  startGeneration,
  updateGenerationInfo,
  completeGeneration,
  failGeneration,
  clearError,
  clearImageSets,
  removeImageSet
} = imageGenerationSlice.actions

export default imageGenerationSlice.reducer 