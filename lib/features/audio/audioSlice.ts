import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AudioUpload, SubtitlesGeneration } from '@/types/video-generation'

interface AudioState {
  uploadedAudio: AudioUpload | null
  subtitles: SubtitlesGeneration | null
  isUploading: boolean
  isGeneratingSubtitles: boolean
}

const initialState: AudioState = {
  uploadedAudio: null,
  subtitles: null,
  isUploading: false,
  isGeneratingSubtitles: false
}

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setIsUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload
    },
    
    setUploadedAudio: (state, action: PayloadAction<AudioUpload>) => {
      state.uploadedAudio = action.payload
    },
    
    clearUploadedAudio: (state) => {
      state.uploadedAudio = null
      state.subtitles = null
    },
    
    setIsGeneratingSubtitles: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingSubtitles = action.payload
    },
    
    setSubtitles: (state, action: PayloadAction<SubtitlesGeneration>) => {
      state.subtitles = action.payload
    },
    
    clearSubtitles: (state) => {
      state.subtitles = null
    },
    
    clearAllAudioData: (state) => {
      state.uploadedAudio = null
      state.subtitles = null
      state.isUploading = false
      state.isGeneratingSubtitles = false
    }
  }
})

export const {
  setIsUploading,
  setUploadedAudio,
  clearUploadedAudio,
  setIsGeneratingSubtitles,
  setSubtitles,
  clearSubtitles,
  clearAllAudioData
} = audioSlice.actions

export default audioSlice.reducer 