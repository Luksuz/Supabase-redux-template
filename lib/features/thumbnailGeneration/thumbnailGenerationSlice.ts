import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedThumbnail {
  id: string
  thumbnailUrl: string
  imageId: string // Leonardo.ai image ID for use as reference
  prompt: string
  title?: string
  referenceImageId?: string // ID of reference image used
  guidanceStrength?: number
  generatedAt: string
}

export interface ThumbnailGenerationState {
  thumbnails: GeneratedThumbnail[]
  isGenerating: boolean
  error: string | null
  generationInfo: string | null
}

const initialState: ThumbnailGenerationState = {
  thumbnails: [],
  isGenerating: false,
  error: null,
  generationInfo: null,
}

export const thumbnailGenerationSlice = createSlice({
  name: 'thumbnailGeneration',
  initialState,
  reducers: {
    startGeneration: (state, action: PayloadAction<{ prompt: string; title?: string; referenceImageId?: string }>) => {
      state.isGenerating = true
      state.error = null
      state.generationInfo = 'Starting thumbnail generation...'
    },
    updateGenerationInfo: (state, action: PayloadAction<string>) => {
      state.generationInfo = action.payload
    },
    completeGeneration: (state, action: PayloadAction<{ thumbnailUrl: string; imageId: string; prompt: string; title?: string; referenceImageId?: string; guidanceStrength?: number }>) => {
      state.isGenerating = false
      state.error = null
      state.generationInfo = null
      
      const newThumbnail: GeneratedThumbnail = {
        id: Date.now().toString(),
        thumbnailUrl: action.payload.thumbnailUrl,
        imageId: action.payload.imageId,
        prompt: action.payload.prompt,
        title: action.payload.title,
        referenceImageId: action.payload.referenceImageId,
        guidanceStrength: action.payload.guidanceStrength,
        generatedAt: new Date().toISOString(),
      }
      
      state.thumbnails.unshift(newThumbnail)
    },
    failGeneration: (state, action: PayloadAction<string>) => {
      state.isGenerating = false
      state.error = action.payload
      state.generationInfo = null
    },
    clearError: (state) => {
      state.error = null
    },
    clearThumbnails: (state) => {
      state.thumbnails = []
    },
    removeThumbnail: (state, action: PayloadAction<string>) => {
      state.thumbnails = state.thumbnails.filter(thumbnail => thumbnail.id !== action.payload)
    },
  },
})

export const {
  startGeneration,
  updateGenerationInfo,
  completeGeneration,
  failGeneration,
  clearError,
  clearThumbnails,
  removeThumbnail,
} = thumbnailGenerationSlice.actions

export default thumbnailGenerationSlice.reducer 