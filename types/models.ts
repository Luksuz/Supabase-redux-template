export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic'
  description: string
  maxTokens: number
  costTier: 'low' | 'medium' | 'high'
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fastest and most cost-effective GPT-4 model',
    maxTokens: 128000,
    costTier: 'low'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'High-intelligence flagship model for complex tasks',
    maxTokens: 128000,
    costTier: 'medium'
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'newest GPT-4 model - very fast and cheap',
    maxTokens: 128000,
    costTier: 'low'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'newest GPT-4 model - fast and cheap',
    maxTokens: 8192,
    costTier: 'low'
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'newest GPT-4 model - highest performance',
    maxTokens: 8192,
    costTier: 'high'
  },
  
  // Anthropic Models - Claude 3.5 Series
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Latest)',
    provider: 'anthropic',
    description: 'Most intelligent Claude model with excellent reasoning',
    maxTokens: 200000,
    costTier: 'medium'
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude model optimized for speed',
    maxTokens: 200000,
    costTier: 'low'
  },
  
  // Anthropic Models - Claude 3 Series
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: 'Balanced Claude model for most tasks',
    maxTokens: 200000,
    costTier: 'medium'
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and cost-effective Claude model',
    maxTokens: 200000,
    costTier: 'low'
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Balanced Claude model for most tasks',
    maxTokens: 200000,
    costTier: 'medium'
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'Balanced Claude model for most tasks',
    maxTokens: 200000,
    costTier: 'high'
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Balanced Claude model for most tasks',
    maxTokens: 200000,
    costTier: 'high'
  },
]

export const DEFAULT_MODEL_ID = 'gpt-4o-mini'

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === modelId)
}

export function getModelsByProvider(provider: 'openai' | 'anthropic'): ModelConfig[] {
  return AVAILABLE_MODELS.filter(model => model.provider === provider)
} 