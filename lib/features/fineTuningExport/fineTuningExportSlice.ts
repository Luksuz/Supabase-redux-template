import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ProcessedFile {
  filename: string
  status: 'pending' | 'parsing' | 'processing' | 'completed' | 'error'
  content?: string
  trainingData?: {
    systemPrompt: string
    userPrompt: string
    assistantResponse: string
  }
  error?: string
}

export interface FileMetadata {
  name: string
  size: number
  type: string
  lastModified: number
}

export interface TrainingDataItem {
  messages: Array<{
    role: string
    content: string
  }>
  metadata?: {
    filename?: string
    source?: string
  }
}

export interface DatasetSummary {
  totalJobs: number
  filteredJobs: number
  totalSections: number
}

export interface FineTuningResults {
  openaiJob?: {
    id: string
    status: string
  }
  file?: {
    id: string
    filename: string
  }
  upload?: {
    id: string
  }
}

interface FineTuningExportState {
  // DOCX processing state (File objects are handled locally, not in Redux)
  selectedFilesMetadata: FileMetadata[]
  processedFiles: ProcessedFile[]
  isProcessingFiles: boolean
  docxTrainingData: TrainingDataItem[]
  
  // Auto dataset state
  isGeneratingDataset: boolean
  autoDataset: TrainingDataItem[]
  datasetSummary: DatasetSummary | null
  
  // Fine-tuning state
  selectedModel: string
  isFineTuningDocx: boolean
  isFineTuningAuto: boolean
  fineTuningResults: FineTuningResults | null
  
  // Fine-tuned models state
  fineTunedModels: any[]
  loadingModels: boolean
  
  // Message state
  message: string
  messageType: 'success' | 'error' | 'info'
}

const initialState: FineTuningExportState = {
  selectedFilesMetadata: [],
  processedFiles: [],
  isProcessingFiles: false,
  docxTrainingData: [],
  
  isGeneratingDataset: false,
  autoDataset: [],
  datasetSummary: null,
  
  selectedModel: 'gpt-4o-mini-2024-07-18',
  isFineTuningDocx: false,
  isFineTuningAuto: false,
  fineTuningResults: null,
  
  fineTunedModels: [],
  loadingModels: false,
  
  message: '',
  messageType: 'info'
}

export const fineTuningExportSlice = createSlice({
  name: 'fineTuningExport',
  initialState,
  reducers: {
    // File handling actions
    setSelectedFilesMetadata: (state, action: PayloadAction<FileMetadata[]>) => {
      state.selectedFilesMetadata = action.payload
    },
    
    addSelectedFilesMetadata: (state, action: PayloadAction<FileMetadata[]>) => {
      state.selectedFilesMetadata = [...state.selectedFilesMetadata, ...action.payload]
      
      // Add corresponding processed files
      const newProcessedFiles = action.payload.map(file => ({
        filename: file.name,
        status: 'pending' as const
      }))
      state.processedFiles = [...state.processedFiles, ...newProcessedFiles]
    },
    
    removeFile: (state, action: PayloadAction<number>) => {
      const index = action.payload
      state.selectedFilesMetadata.splice(index, 1)
      state.processedFiles.splice(index, 1)
    },
    
    updateProcessedFileStatus: (state, action: PayloadAction<{
      index: number
      status: ProcessedFile['status']
      content?: string
      trainingData?: ProcessedFile['trainingData']
      error?: string
    }>) => {
      const { index, status, content, trainingData, error } = action.payload
      const file = state.processedFiles[index]
      if (file) {
        file.status = status
        if (content !== undefined) file.content = content
        if (trainingData !== undefined) file.trainingData = trainingData
        if (error !== undefined) file.error = error
      }
    },
    
    setIsProcessingFiles: (state, action: PayloadAction<boolean>) => {
      state.isProcessingFiles = action.payload
    },
    
    setDocxTrainingData: (state, action: PayloadAction<TrainingDataItem[]>) => {
      state.docxTrainingData = action.payload
    },
    
    addDocxTrainingDataItem: (state, action: PayloadAction<TrainingDataItem>) => {
      state.docxTrainingData.push(action.payload)
    },
    
    clearDocxData: (state) => {
      state.selectedFilesMetadata = []
      state.processedFiles = []
      state.docxTrainingData = []
      state.isProcessingFiles = false
    },
    
    // Auto dataset actions
    setIsGeneratingDataset: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingDataset = action.payload
    },
    
    setAutoDataset: (state, action: PayloadAction<TrainingDataItem[]>) => {
      state.autoDataset = action.payload
    },
    
    setDatasetSummary: (state, action: PayloadAction<DatasetSummary | null>) => {
      state.datasetSummary = action.payload
    },
    
    clearAutoDataset: (state) => {
      state.autoDataset = []
      state.datasetSummary = null
      state.isGeneratingDataset = false
    },
    
    // Model and fine-tuning actions
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload
    },
    
    setIsFineTuningDocx: (state, action: PayloadAction<boolean>) => {
      state.isFineTuningDocx = action.payload
    },
    
    setIsFineTuningAuto: (state, action: PayloadAction<boolean>) => {
      state.isFineTuningAuto = action.payload
    },
    
    setFineTuningResults: (state, action: PayloadAction<FineTuningResults | null>) => {
      state.fineTuningResults = action.payload
    },
    
    setFineTunedModels: (state, action: PayloadAction<any[]>) => {
      state.fineTunedModels = action.payload
    },
    
    setLoadingModels: (state, action: PayloadAction<boolean>) => {
      state.loadingModels = action.payload
    },
    
    // Message actions
    setMessage: (state, action: PayloadAction<{
      message: string
      type: 'success' | 'error' | 'info'
    }>) => {
      state.message = action.payload.message
      state.messageType = action.payload.type
    },
    
    clearMessage: (state) => {
      state.message = ''
      state.messageType = 'info'
    },
    
    // Reset actions
    resetDocxTab: (state) => {
      state.selectedFilesMetadata = []
      state.processedFiles = []
      state.docxTrainingData = []
      state.isProcessingFiles = false
      state.isFineTuningDocx = false
    },
    
    resetAutoTab: (state) => {
      state.autoDataset = []
      state.datasetSummary = null
      state.isGeneratingDataset = false
      state.isFineTuningAuto = false
    },
    
    resetAll: (state) => {
      return { ...initialState }
    }
  }
})

// Export actions
export const {
  setSelectedFilesMetadata,
  addSelectedFilesMetadata,
  removeFile,
  updateProcessedFileStatus,
  setIsProcessingFiles,
  setDocxTrainingData,
  addDocxTrainingDataItem,
  clearDocxData,
  setIsGeneratingDataset,
  setAutoDataset,
  setDatasetSummary,
  clearAutoDataset,
  setSelectedModel,
  setIsFineTuningDocx,
  setIsFineTuningAuto,
  setFineTuningResults,
  setFineTunedModels,
  setLoadingModels,
  setMessage,
  clearMessage,
  resetDocxTab,
  resetAutoTab,
  resetAll
} = fineTuningExportSlice.actions

// Export reducer
export default fineTuningExportSlice.reducer

// Selectors
export const selectFineTuningExport = (state: { fineTuningExport: FineTuningExportState }) => state.fineTuningExport
export const selectDocxProcessing = (state: { fineTuningExport: FineTuningExportState }) => ({
  selectedFilesMetadata: state.fineTuningExport.selectedFilesMetadata,
  processedFiles: state.fineTuningExport.processedFiles,
  isProcessingFiles: state.fineTuningExport.isProcessingFiles,
  docxTrainingData: state.fineTuningExport.docxTrainingData
})
export const selectAutoDataset = (state: { fineTuningExport: FineTuningExportState }) => ({
  autoDataset: state.fineTuningExport.autoDataset,
  datasetSummary: state.fineTuningExport.datasetSummary,
  isGeneratingDataset: state.fineTuningExport.isGeneratingDataset
})
export const selectFineTuningState = (state: { fineTuningExport: FineTuningExportState }) => ({
  selectedModel: state.fineTuningExport.selectedModel,
  isFineTuningDocx: state.fineTuningExport.isFineTuningDocx,
  isFineTuningAuto: state.fineTuningExport.isFineTuningAuto,
  fineTuningResults: state.fineTuningExport.fineTuningResults,
  fineTunedModels: state.fineTuningExport.fineTunedModels,
  loadingModels: state.fineTuningExport.loadingModels
}) 