import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { VideoRecord, VideoGenerationSettings, VideoUpload } from '@/types/video-generation'

// Updated interface for video processing metadata
interface VideoProcessingMetadata {
  videoUrl: string
  audioUrl: string
  subtitlesUrl?: string
  originalVideoDuration: number
  targetDuration: number
  loopCount: number
  quality: 'hd' | 'sd'
  fontFamily: string
  fontColor: string
  fontSize: number
  strokeWidth: number
}

interface VideoState {
  uploadedVideo: VideoUpload | null
  currentGeneration: VideoRecord | null
  generationHistory: VideoRecord[]
  isUploadingVideo: boolean
  isProcessingVideo: boolean
  isCreatingVideo: boolean
  processingMetadata: VideoProcessingMetadata | null
  settings: VideoGenerationSettings
  statusRefreshInterval: number | null
}

const initialState: VideoState = {
  uploadedVideo: null,
  currentGeneration: null,
  generationHistory: [],
  isUploadingVideo: false,
  isProcessingVideo: false,
  isCreatingVideo: false,
  processingMetadata: null,
  settings: {
    videoQuality: 'hd',
    includeSubtitles: true,
    fontFamily: 'Arial',
    fontColor: '#ffffff',
    fontSize: 24,
    strokeWidth: 2
  },
  statusRefreshInterval: null
}

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideoSettings: (state, action: PayloadAction<Partial<VideoGenerationSettings>>) => {
      state.settings = { ...state.settings, ...action.payload }
    },
    
    setIsUploadingVideo: (state, action: PayloadAction<boolean>) => {
      state.isUploadingVideo = action.payload
    },
    
    setUploadedVideo: (state, action: PayloadAction<VideoUpload>) => {
      state.uploadedVideo = action.payload
    },
    
    clearUploadedVideo: (state) => {
      state.uploadedVideo = null
    },
    
    setIsProcessingVideo: (state, action: PayloadAction<boolean>) => {
      state.isProcessingVideo = action.payload
    },
    
    setIsCreatingVideo: (state, action: PayloadAction<boolean>) => {
      state.isCreatingVideo = action.payload
    },
    
    setProcessingMetadata: (state, action: PayloadAction<VideoProcessingMetadata>) => {
      state.processingMetadata = action.payload
    },
    
    clearProcessingMetadata: (state) => {
      state.processingMetadata = null
    },
    
    startVideoGeneration: (state, action: PayloadAction<VideoRecord>) => {
      state.currentGeneration = action.payload
    },
    
    updateVideoStatus: (state, action: PayloadAction<{ videoId: string; status: VideoRecord['status']; videoUrl?: string; errorMessage?: string }>) => {
      const { videoId, status, videoUrl, errorMessage } = action.payload
      
      // Update current generation if it matches
      if (state.currentGeneration?.id === videoId) {
        state.currentGeneration.status = status
        state.currentGeneration.updated_at = new Date().toISOString()
        
        if (videoUrl) {
          state.currentGeneration.final_video_url = videoUrl
        }
        
        if (errorMessage) {
          state.currentGeneration.error_message = errorMessage
        }
      }
      
      // Update in history if exists
      const historyIndex = state.generationHistory.findIndex(video => video.id === videoId)
      if (historyIndex !== -1) {
        state.generationHistory[historyIndex].status = status
        state.generationHistory[historyIndex].updated_at = new Date().toISOString()
        
        if (videoUrl) {
          state.generationHistory[historyIndex].final_video_url = videoUrl
        }
        
        if (errorMessage) {
          state.generationHistory[historyIndex].error_message = errorMessage
        }
      }
    },
    
    completeVideoGeneration: (state, action: PayloadAction<{ videoUrl: string; videoId: string }>) => {
      const { videoUrl, videoId } = action.payload
      
      if (state.currentGeneration?.id === videoId) {
        state.currentGeneration.status = 'completed'
        state.currentGeneration.final_video_url = videoUrl
        state.currentGeneration.updated_at = new Date().toISOString()
      }
    },
    
    setVideoGenerationError: (state, action: PayloadAction<{ videoId: string; error: string }>) => {
      const { videoId, error } = action.payload
      
      if (state.currentGeneration?.id === videoId) {
        state.currentGeneration.status = 'failed'
        state.currentGeneration.error_message = error
        state.currentGeneration.updated_at = new Date().toISOString()
      }
    },
    
    saveVideoToHistory: (state, action: PayloadAction<VideoRecord>) => {
      const video = action.payload
      
      // Check if already in history
      const existingIndex = state.generationHistory.findIndex(v => v.id === video.id)
      
      if (existingIndex !== -1) {
        // Update existing
        state.generationHistory[existingIndex] = video
      } else {
        // Add new to beginning
        state.generationHistory.unshift(video)
        // Keep only last 20 videos
        state.generationHistory = state.generationHistory.slice(0, 20)
      }
    },
    
    loadVideoHistory: (state, action: PayloadAction<VideoRecord[]>) => {
      state.generationHistory = action.payload
    },
    
    clearCurrentGeneration: (state) => {
      state.currentGeneration = null
    },
    
    setStatusRefreshInterval: (state, action: PayloadAction<number | null>) => {
      state.statusRefreshInterval = action.payload
    },
    
    clearAllVideoData: (state) => {
      state.uploadedVideo = null
      state.currentGeneration = null
      state.generationHistory = []
      state.isUploadingVideo = false
      state.isProcessingVideo = false
      state.isCreatingVideo = false
      state.processingMetadata = null
      if (state.statusRefreshInterval) {
        clearInterval(state.statusRefreshInterval)
        state.statusRefreshInterval = null
      }
    }
  }
})

export const {
  setVideoSettings,
  setIsUploadingVideo,
  setUploadedVideo,
  clearUploadedVideo,
  setIsProcessingVideo,
  setIsCreatingVideo,
  setProcessingMetadata,
  clearProcessingMetadata,
  startVideoGeneration,
  updateVideoStatus,
  completeVideoGeneration,
  setVideoGenerationError,
  saveVideoToHistory,
  loadVideoHistory,
  clearCurrentGeneration,
  setStatusRefreshInterval,
  clearAllVideoData
} = videoSlice.actions

export default videoSlice.reducer 