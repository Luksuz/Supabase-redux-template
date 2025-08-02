import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { 
  TextImageVideoState, 
  VideoGenerationBatch, 
  GeneratedVideo, 
  TextToVideoRequest, 
  ImageToVideoRequest,
  VideoProvider
} from '../../../types/text-image-video-generation'

const initialState: TextImageVideoState = {
  // Current generation
  currentBatch: null,
  isGenerating: false,
  error: null,
  generationInfo: null,
  
  // Batch processing
  batchProgress: {
    current: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0
  },
  
  // Settings
  selectedProvider: 'replicate',
  defaultDuration: 5,
  batchSize: 5,
  
  // History
  videoHistory: [],
  batches: [],
  
  // Rate limiting
  lastRequest: null,
  remainingRequests: 10 // 10 per minute for replicate
}

export const textImageVideoSlice = createSlice({
  name: 'textImageVideo',
  initialState,
  reducers: {
    // Settings
    setProvider: (state, action: PayloadAction<VideoProvider>) => {
      state.selectedProvider = action.payload
      // Reset rate limiting when switching providers
      state.remainingRequests = 10
      state.lastRequest = null
    },

    setDefaultDuration: (state, action: PayloadAction<5 | 10>) => {
      state.defaultDuration = action.payload
    },

    setBatchSize: (state, action: PayloadAction<number>) => {
      state.batchSize = Math.max(1, Math.min(10, action.payload))
    },

    // Rate limiting
    updateRateLimit: (state, action: PayloadAction<{ used: number }>) => {
      const now = Date.now()
      const { used } = action.payload
      
      // Reset rate limit if it's been more than a minute
      if (state.lastRequest && now - state.lastRequest > 60000) {
        state.remainingRequests = 10
      }
      
      state.remainingRequests = Math.max(0, state.remainingRequests - used)
      state.lastRequest = now
    },

    // Batch generation lifecycle
    startBatchGeneration: (state, action: PayloadAction<{
      id: string
      requests: (TextToVideoRequest | ImageToVideoRequest)[]
    }>) => {
      const { id, requests } = action.payload
      
      state.currentBatch = {
        id,
        requests,
        videos: [],
        totalVideos: requests.length,
        completedVideos: 0,
        failedVideos: 0,
        status: 'processing',
        startedAt: new Date().toISOString()
      }
      
      state.isGenerating = true
      state.error = null
      state.generationInfo = `Starting generation of ${requests.length} video${requests.length > 1 ? 's' : ''}...`
    },

    updateBatchProgress: (state, action: PayloadAction<{
      current: number
      total: number
      currentBatch: number
      totalBatches: number
    }>) => {
      state.batchProgress = action.payload
    },

    updateGenerationInfo: (state, action: PayloadAction<string>) => {
      state.generationInfo = action.payload
    },

    addVideoToBatch: (state, action: PayloadAction<GeneratedVideo>) => {
      if (state.currentBatch) {
        state.currentBatch.videos.push(action.payload)
        
        if (action.payload.status === 'completed') {
          state.currentBatch.completedVideos++
        } else if (action.payload.status === 'failed') {
          state.currentBatch.failedVideos++
        }
      }
    },

    updateVideoInBatch: (state, action: PayloadAction<{
      videoId: string
      status: 'generating' | 'completed' | 'failed'
      videoUrl?: string
      error?: string
    }>) => {
      const { videoId, status, videoUrl, error } = action.payload
      
      if (state.currentBatch) {
        const videoIndex = state.currentBatch.videos.findIndex(v => v.id === videoId)
        if (videoIndex !== -1) {
          const video = state.currentBatch.videos[videoIndex]
          const oldStatus = video.status
          
          video.status = status
          if (videoUrl) video.videoUrl = videoUrl
          if (error) video.error = error
          
          // Update counters
          if (oldStatus === 'generating') {
            if (status === 'completed') {
              state.currentBatch.completedVideos++
            } else if (status === 'failed') {
              state.currentBatch.failedVideos++
            }
          }
        }
      }
    },

    completeBatchGeneration: (state) => {
      if (state.currentBatch) {
        state.currentBatch.status = 'completed'
        state.currentBatch.completedAt = new Date().toISOString()
        
        // Add all completed videos to history
        const completedVideos = state.currentBatch.videos.filter(v => v.status === 'completed')
        state.videoHistory.unshift(...completedVideos)
        
        // Keep only last 50 videos in history
        state.videoHistory = state.videoHistory.slice(0, 50)
        
        // Add batch to batches history
        state.batches.unshift({ ...state.currentBatch })
        state.batches = state.batches.slice(0, 20) // Keep last 20 batches
      }
      
      state.isGenerating = false
      state.generationInfo = null
      state.error = null
      state.batchProgress = { current: 0, total: 0, currentBatch: 0, totalBatches: 0 }
    },

    failBatchGeneration: (state, action: PayloadAction<string>) => {
      if (state.currentBatch) {
        state.currentBatch.status = 'failed'
        state.currentBatch.completedAt = new Date().toISOString()
        
        // Still add completed videos to history
        const completedVideos = state.currentBatch.videos.filter(v => v.status === 'completed')
        if (completedVideos.length > 0) {
          state.videoHistory.unshift(...completedVideos)
          state.videoHistory = state.videoHistory.slice(0, 50)
        }
        
        // Add batch to batches history
        state.batches.unshift({ ...state.currentBatch })
        state.batches = state.batches.slice(0, 20)
      }
      
      state.isGenerating = false
      state.error = action.payload
      state.generationInfo = null
      state.batchProgress = { current: 0, total: 0, currentBatch: 0, totalBatches: 0 }
    },

    clearError: (state) => {
      state.error = null
    },

    clearCurrentBatch: (state) => {
      state.currentBatch = null
      state.isGenerating = false
      state.error = null
      state.generationInfo = null
      state.batchProgress = { current: 0, total: 0, currentBatch: 0, totalBatches: 0 }
    },

    // History management
    removeVideoFromHistory: (state, action: PayloadAction<string>) => {
      state.videoHistory = state.videoHistory.filter(video => video.id !== action.payload)
    },

    clearVideoHistory: (state) => {
      state.videoHistory = []
    },

    removeBatch: (state, action: PayloadAction<string>) => {
      state.batches = state.batches.filter(batch => batch.id !== action.payload)
    },

    clearBatchHistory: (state) => {
      state.batches = []
    },

    // Load from storage
    loadVideoHistory: (state, action: PayloadAction<GeneratedVideo[]>) => {
      state.videoHistory = action.payload
    },

    loadBatchHistory: (state, action: PayloadAction<VideoGenerationBatch[]>) => {
      state.batches = action.payload
    }
  }
})

export const {
  setProvider,
  setDefaultDuration,
  setBatchSize,
  updateRateLimit,
  startBatchGeneration,
  updateBatchProgress,
  updateGenerationInfo,
  addVideoToBatch,
  updateVideoInBatch,
  completeBatchGeneration,
  failBatchGeneration,
  clearError,
  clearCurrentBatch,
  removeVideoFromHistory,
  clearVideoHistory,
  removeBatch,
  clearBatchHistory,
  loadVideoHistory,
  loadBatchHistory
} = textImageVideoSlice.actions

export default textImageVideoSlice.reducer 