export type ImageProvider = 'minimax' | 'flux-dev' | 'recraft-v3' | 'stable-diffusion-v35-large' | 'dalle-3'

export interface GenerateImageRequestBody {
  provider: ImageProvider
  prompt: string
  numberOfImages?: number
  outputFormat?: 'url' | 'base64'
  minimaxAspectRatio?: '16:9' | '1:1' | '9:16'
  fluxImageSize?: { width: number; height: number }
  userId?: string
}

export interface GenerateImageResponse {
  imageUrls: string[]
}

export interface GeneratedImageSet {
  id: string
  originalPrompt: string
  imageUrls: string[]
  imageData: string[] // base64 data
  provider: ImageProvider
  generatedAt: string
  aspectRatio?: string
}

export interface ExtractedScene {
  chunkIndex: number
  originalText: string
  imagePrompt: string
  summary: string
  error?: string
}

export interface ImageGenerationState {
  currentGeneration: GeneratedImageSet | null
  imageSets: GeneratedImageSet[]
  isGenerating: boolean
  error: string | null
  generationInfo: string | null
  // Settings
  selectedModel: ImageProvider
  aspectRatio: '16:9' | '1:1' | '9:16'
  numberOfImages: number
  // Scene extraction
  extractedScenes: ExtractedScene[]
  isExtractingScenes: boolean
  sceneExtractionError: string | null
  numberOfScenesToExtract: number
  // Rate limiting for flux models
  lastFluxRequest: number | null
  remainingFluxRequests: number
} 