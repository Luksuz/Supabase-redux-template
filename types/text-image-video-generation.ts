export interface TextToVideoRequest {
  prompt: string
  duration: 5 | 10
  provider: 'replicate'
  model?: string
}

export interface ImageToVideoRequest {
  prompt: string
  image: string // base64 encoded image
  duration: 5 | 10
  provider: 'replicate'
  model?: string
}

export interface GeneratedVideo {
  id: string
  type: 'text-to-video' | 'image-to-video'
  prompt: string
  imageInput?: string // base64 for image-to-video
  duration: 5 | 10
  videoUrl: string
  provider: 'replicate'
  model: string
  generatedAt: string
  status: 'generating' | 'completed' | 'failed'
  error?: string
}

export interface VideoGenerationBatch {
  id: string
  requests: (TextToVideoRequest | ImageToVideoRequest)[]
  videos: GeneratedVideo[]
  totalVideos: number
  completedVideos: number
  failedVideos: number
  status: 'processing' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
}

export interface TextImageVideoState {
  // Current generation
  currentBatch: VideoGenerationBatch | null
  isGenerating: boolean
  error: string | null
  generationInfo: string | null
  
  // Batch processing
  batchProgress: {
    current: number
    total: number
    currentBatch: number
    totalBatches: number
  }
  
  // Settings
  selectedProvider: 'replicate'
  defaultDuration: 5 | 10
  batchSize: number
  
  // History
  videoHistory: GeneratedVideo[]
  batches: VideoGenerationBatch[]
  
  // Rate limiting
  lastRequest: number | null
  remainingRequests: number
}

export interface ReplicateVideoResponse {
  id: string
  urls: {
    get: string
    cancel: string
  }
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[]
  error?: string
  logs?: string
}

// Provider model configurations
export const VIDEO_PROVIDERS = {
  replicate: {
    name: 'Replicate',
    description: 'High-quality text and image to video generation',
    batchSize: 5,
    rateLimitPerMinute: 10,
    models: {
      'bytedance/seedance-1-lite': {
        name: 'SeeDance-1 Lite',
        description: 'Fast video generation from text or images',
        maxDuration: 10,
        supportedDurations: [5, 10]
      }
    }
  }
} as const

export type VideoProvider = keyof typeof VIDEO_PROVIDERS
export type VideoModel = 'bytedance/seedance-1-lite' 