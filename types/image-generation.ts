export interface GenerateImageRequestBody {
  provider: 'openai' | 'minimax'
  prompt: string
  numberOfImages?: number
  outputFormat?: 'url' | 'base64'
  minimaxAspectRatio?: string
  userId?: string
}

export interface GenerateImageResponse {
  imageUrls: string[]
} 