export interface TextToVideoRequest {
  prompt: string
  duration: 5 | 10
  provider: 'replicate' | 'fal'
  model: string
  // FAL AI specific parameters
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  fps?: number
  seed?: number
  guidance_scale?: number
  num_inference_steps?: number
}

export interface ImageToVideoRequest {
  prompt: string
  image?: string // base64 encoded image (for replicate)
  image_url?: string // URL for FAL AI
  duration: 5 | 10
  provider: 'replicate' | 'fal'
  model: string
  // FAL AI specific parameters
  fps?: number
  motion_strength?: number
  seed?: number
}

export interface GeneratedVideo {
  id: string
  type: 'text-to-video' | 'image-to-video'
  prompt: string
  imageInput?: string // base64 for image-to-video (replicate)
  imageUrl?: string // URL for image-to-video (FAL AI)
  duration: 5 | 10
  videoUrl: string
  provider: 'replicate' | 'fal'
  model: string
  generatedAt: string
  status: 'generating' | 'completed' | 'failed'
  error?: string
  requestId?: string // FAL AI request ID
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

export interface ExtractedVideoScene {
  chunkIndex: number
  originalText: string
  videoPrompt: string
  summary: string
  error?: string
}

export interface ScriptSummary {
  storySummary: string
  mainCharacters: string
  setting: string
  tone: string
}

export interface ScriptBasedPromptState {
  scriptInput: string
  numberOfScenesToExtract: number
  isExtractingScenes: boolean
  sceneExtractionError: string | null
  extractedScenes: ExtractedVideoScene[]
  selectedScenes: number[]
  scriptSummary: ScriptSummary | null
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
  selectedProvider: 'replicate' | 'fal'
  selectedModel: string
  defaultDuration: 5 | 10
  batchSize: number
  
  // History
  videoHistory: GeneratedVideo[]
  batches: VideoGenerationBatch[]
  selectedVideosForGenerator: string[] // IDs of videos selected for video generator
  
  // Script-based prompt generation
  scriptBasedPrompts: ScriptBasedPromptState
  
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
    textToVideoModels: {
      'bytedance/seedance-1-lite': {
        name: 'SeeDance-1 Lite',
        description: 'Fast video generation from text',
        maxDuration: 10,
        supportedDurations: [5, 10]
      }
    },
    imageToVideoModels: {
      'bytedance/seedance-1-lite': {
        name: 'SeeDance-1 Lite',
        description: 'Fast video generation from images',
        maxDuration: 10,
        supportedDurations: [5, 10]
      }
    }
  },
  fal: {
    name: 'FAL AI',
    description: 'Advanced AI video generation with multiple models',
    batchSize: 3,
    rateLimitPerMinute: 5,
    textToVideoModels: {
      'luma-dream-machine': {
        name: 'Luma Dream Machine',
        description: 'High-quality text-to-video generation',
        maxDuration: 5,
        supportedDurations: [5],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      },
      'minimax-video-01': {
        name: 'Minimax Video v1',
        description: 'Professional text-to-video model',
        maxDuration: 6,
        supportedDurations: [3, 6],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      },
      'runway-gen3': {
        name: 'Runway Gen-3 Turbo',
        description: 'Fast and creative video generation',
        maxDuration: 10,
        supportedDurations: [5, 10],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      },
      'kling-video': {
        name: 'Kling Video v1',
        description: 'High-quality cinematic video generation',
        maxDuration: 10,
        supportedDurations: [5, 10],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      },
      'haiper-v2': {
        name: 'Haiper Video v2',
        description: 'Realistic text-to-video generation',
        maxDuration: 4,
        supportedDurations: [2, 4],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      }
    },
    imageToVideoModels: {
      'wan-v2.2-5b': {
        name: 'WAN v2.2-5B',
        description: 'Animate images with detailed motion control',
        maxDuration: 5,
        supportedDurations: [5],
        supportedFps: [24, 30]
      },
      'svd-xt': {
        name: 'Stable Video Diffusion XT',
        description: 'Stable and consistent image animation',
        maxDuration: 4,
        supportedDurations: [2, 4],
        supportedFps: [6, 12, 18, 24]
      },
      'svd-1.1': {
        name: 'Stable Video Diffusion 1.1',
        description: 'Latest stable video diffusion model',
        maxDuration: 4,
        supportedDurations: [2, 4],
        supportedFps: [6, 12, 18, 24]
      },
      'haiper': {
        name: 'Haiper Image-to-Video',
        description: 'Animate images with natural motion',
        maxDuration: 4,
        supportedDurations: [2, 4],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      },
      'luma-dream-machine': {
        name: 'Luma Dream Machine I2V',
        description: 'High-quality image animation',
        maxDuration: 5,
        supportedDurations: [5],
        supportedAspectRatios: ['16:9', '9:16', '1:1']
      }
    }
  }
} as const

export type VideoProvider = keyof typeof VIDEO_PROVIDERS
export type ReplicateTextModel = keyof typeof VIDEO_PROVIDERS.replicate.textToVideoModels
export type ReplicateImageModel = keyof typeof VIDEO_PROVIDERS.replicate.imageToVideoModels
export type FalTextModel = keyof typeof VIDEO_PROVIDERS.fal.textToVideoModels
export type FalImageModel = keyof typeof VIDEO_PROVIDERS.fal.imageToVideoModels

export type TextToVideoModel = ReplicateTextModel | FalTextModel
export type ImageToVideoModel = ReplicateImageModel | FalImageModel 