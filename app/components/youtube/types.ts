// Research interfaces
export interface WebSearchResult {
  title: string
  link: string
  description: string
  source?: string
}

export interface ResearchSummary {
  query: string
  webResults: WebSearchResult[]
  youtubeResults: any[]
  combinedInsights: string
  keyFindings: string[]
  recommendations: string[]
  timestamp: string
}

// Gemini Analysis interface
export interface GeminiAnalysis {
  videoId: string
  title: string
  summary: string
  keyPoints: string[]
  timestamps: {
    time: string
    description: string
    significance: string
  }[]
  topics: string[]
  emotionalTone: string
  keyQuotes: string[]
  actionableInsights: string[]
  characterInsights: string[]
  conflictElements: string[]
  storyIdeas: string[]
  creativePrompt: string
  parsedWithGPT: boolean
  originalGeminiResponse: string
}

// Analysis type for dropdown selection
export type AnalysisType = 'standard' | 'full'

// Enhanced transcript analysis interface
export interface EnhancedTranscriptAnalysis {
  analysisResults: any[]
  analyzingTranscripts: Record<string, boolean>
  analysisQueries: Record<string, string>
  analyzingGemini?: Record<string, boolean>
} 