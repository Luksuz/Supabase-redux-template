export type ImageProvider =
  | 'minimax'
  | 'flux-dev'
  | 'recraft-v3'
  | 'stable-diffusion-v35-large'
  | 'stable-diffusion-v35-medium'
  | 'dalle-3'
  | 'gpt-image-1'
  | 'leonardo-phoenix'
  | 'ideogram-v3'
  | 'imagen-4'
  // | 'minimax-image-01';

// Recraft V3 specific types
export type RecraftImageSize = 
  | 'square_hd' 
  | 'square' 
  | 'portrait_4_3' 
  | 'portrait_16_9' 
  | 'landscape_4_3' 
  | 'landscape_16_9'
  | { width: number; height: number }

export type RecraftStyle = 
  | 'any'
  | 'realistic_image'
  | 'digital_illustration'
  | 'vector_illustration'
  | 'realistic_image/b_and_w'
  | 'realistic_image/hard_flash'
  | 'realistic_image/hdr'
  | 'realistic_image/natural_light'
  | 'realistic_image/studio_portrait'
  | 'realistic_image/enterprise'
  | 'realistic_image/motion_blur'
  | 'realistic_image/evening_light'
  | 'realistic_image/faded_nostalgia'
  | 'realistic_image/forest_life'
  | 'realistic_image/mystic_naturalism'
  | 'realistic_image/natural_tones'
  | 'realistic_image/organic_calm'
  | 'realistic_image/real_life_glow'
  | 'realistic_image/retro_realism'
  | 'realistic_image/retro_snapshot'
  | 'realistic_image/urban_drama'
  | 'realistic_image/village_realism'
  | 'realistic_image/warm_folk'
  | 'digital_illustration/pixel_art'
  | 'digital_illustration/hand_drawn'
  | 'digital_illustration/grain'
  | 'digital_illustration/infantile_sketch'
  | 'digital_illustration/2d_art_poster'
  | 'digital_illustration/handmade_3d'
  | 'digital_illustration/hand_drawn_outline'
  | 'digital_illustration/engraving_color'
  | 'digital_illustration/2d_art_poster_2'
  | 'digital_illustration/antiquarian'
  | 'digital_illustration/bold_fantasy'
  | 'digital_illustration/child_book'
  | 'digital_illustration/child_books'
  | 'digital_illustration/cover'
  | 'digital_illustration/crosshatch'
  | 'digital_illustration/digital_engraving'
  | 'digital_illustration/expressionism'
  | 'digital_illustration/freehand_details'
  | 'digital_illustration/grain_20'
  | 'digital_illustration/graphic_intensity'
  | 'digital_illustration/hard_comics'
  | 'digital_illustration/long_shadow'
  | 'digital_illustration/modern_folk'
  | 'digital_illustration/multicolor'
  | 'digital_illustration/neon_calm'
  | 'digital_illustration/noir'
  | 'digital_illustration/nostalgic_pastel'
  | 'digital_illustration/outline_details'
  | 'digital_illustration/pastel_gradient'
  | 'digital_illustration/pastel_sketch'
  | 'digital_illustration/pop_art'
  | 'digital_illustration/pop_renaissance'
  | 'digital_illustration/street_art'
  | 'digital_illustration/tablet_sketch'
  | 'digital_illustration/urban_glow'
  | 'digital_illustration/urban_sketching'
  | 'digital_illustration/vanilla_dreams'
  | 'digital_illustration/young_adult_book'
  | 'digital_illustration/young_adult_book_2'
  | 'vector_illustration/bold_stroke'
  | 'vector_illustration/chemistry'
  | 'vector_illustration/colored_stencil'
  | 'vector_illustration/contour_pop_art'
  | 'vector_illustration/cosmics'
  | 'vector_illustration/cutout'
  | 'vector_illustration/depressive'
  | 'vector_illustration/editorial'
  | 'vector_illustration/emotional_flat'
  | 'vector_illustration/infographical'
  | 'vector_illustration/marker_outline'
  | 'vector_illustration/mosaic'
  | 'vector_illustration/naivector'
  | 'vector_illustration/roundish_flat'
  | 'vector_illustration/segmented_colors'
  | 'vector_illustration/sharp_contrast'
  | 'vector_illustration/thin'
  | 'vector_illustration/vector_photo'
  | 'vector_illustration/vivid_shapes'
  | 'vector_illustration/engraving'
  | 'vector_illustration/line_art'
  | 'vector_illustration/line_circuit'
  | 'vector_illustration/linocut'

// Ideogram V3 specific types
export type IdeogramStyle = 'AUTO' | 'GENERAL' | 'REALISTIC' | 'DESIGN'

// Leonardo Phoenix specific types
export type LeonardoStyleUUID = 
  | 'debdf72a-91a4-467b-bf61-cc02bdeb69c6' // 3D Render
  | '9fdc5e8c-4d13-49b4-9ce6-5a74cbb19177' // Bokeh
  | 'a5632c7c-ddbb-4e2f-ba34-8456ab3ac436' // Cinematic
  | '33abbb99-03b9-4dd7-9761-ee98650b2c88' // Cinematic Concept
  | '6fedbf1f-4a17-45ec-84fb-92fe524a29ef' // Creative
  | '111dc692-d470-4eec-b791-3475abac4c46' // Dynamic
  | '594c4a08-a522-4e0e-b7ff-e4dac4b6b622' // Fashion
  | '2e74ec31-f3a4-4825-b08b-2894f6d13941' // Graphic Design Pop Art
  | '1fbb6a68-9319-44d2-8d56-2957ca0ece6a' // Graphic Design Vector
  | '97c20e5c-1af6-4d42-b227-54d03d8f0727' // HDR
  | '645e4195-f63d-4715-a3f2-3fb1e6eb8c70' // Illustration
  | '30c1d34f-e3a9-479a-b56f-c018bbc9c02a' // Macro
  | 'cadc8cd6-7838-4c99-b645-df76be8ba8d8' // Minimalist
  | '621e1c9a-6319-4bee-a12d-ae40659162fa' // Moody
  | '556c1ee5-ec38-42e8-955a-1e82dad0ffa1' // None
  | '8e2bc543-6ee2-45f9-bcd9-594b6ce84dcd' // Portrait
  | '22a9a7d2-2166-4d86-80ff-22e2643adbcf' // Pro B&W photography
  | '7c3f932b-a572-47cb-9b9b-f20211e63b5b' // Pro color photography
  | '581ba6d6-5aac-4492-bebe-54c424a0d46e' // Pro film photography
  | '0d34f8e1-46d4-428f-8ddd-4b11811fa7c9' // Portrait Fashion
  | 'b504f83c-3326-4947-82e1-7fe9e839ec0f' // Ray Traced
  | 'be8c6b58-739c-4d44-b9c1-b032ed308b61' // Sketch (B&W)
  | '093accc3-7633-4ffd-82da-d34000dfc0d6' // Sketch (Color)
  | '5bdc3f2a-1be6-4d1c-8e77-992a30824a2c' // Stock Photo
  | 'dee282d3-891f-4f73-ba02-7f8131e5541b' // Vibrant

export interface GenerateImageRequestBody {
  provider: ImageProvider
  prompt: string
  numberOfImages?: number
  outputFormat?: 'url' | 'base64'
  minimaxAspectRatio?: '16:9' | '1:1' | '9:16'
  fluxImageSize?: { width: number; height: number }
  userId?: string
  stylePrefix?: 'esoteric-medieval' | 'dark-demonic' | 'renaissance' | 'gothic' | 'mystical' | 'ancient' | 'occult' | 'none' | ''
  customStylePrefix?: string
  aspectRatio?: '16:9' | '1:1' | '9:16'
  // Recraft V3 specific parameters
  recraftImageSize?: RecraftImageSize
  recraftStyle?: RecraftStyle
  // Ideogram V3 specific parameters
  ideogramStyle?: IdeogramStyle
  // Stable Diffusion specific parameters
  negativePrompt?: string
  // Leonardo Phoenix specific parameters
  leonardoStyleUUID?: LeonardoStyleUUID
}

export interface GenerateImageResponse {
  imageUrls: string[]
}

export interface GeneratedImageSet {
  id: string
  originalPrompt: string
  finalPrompts: string[]
  imageUrls: string[]
  imageData: string[] // base64 data
  provider: ImageProvider
  generatedAt: string
  aspectRatio?: string
  imageStyle?: string
}

export interface ExtractedScene {
  chunkIndex: number
  originalText: string
  imagePrompt: string
  summary: string
  error?: string
}

export interface BatchProgress {
  current: number
  total: number
  isProcessing: boolean
  currentBatch: number
  totalBatches: number
  phase: 'idle' | 'summary' | 'splitting' | 'processing'
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
  // Model-specific settings
  recraftStyle: string
  ideogramStyle: string
  negativePrompt: string
  leonardoStyleUUID: string
  // Scene extraction
  extractedScenes: ExtractedScene[]
  isExtractingScenes: boolean
  sceneExtractionError: string | null
  numberOfScenesToExtract: number
  // Batch processing progress
  batchProgress: BatchProgress
  // Rate limiting for flux models
  lastFluxRequest: number | null
  remainingFluxRequests: number
  // Image selection for video generation
  confirmedImageSelection: string[]
  selectedImagesOrder: string[]
} 