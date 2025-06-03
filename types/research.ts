import { z } from 'zod'

// Google search result type
export interface SearchResult {
  title: string
  link: string
  description: string
}

// Research analysis result schema for structured LLM output
export const researchAnalysisSchema = z.object({
  suggestedTitle: z.string().describe('A compelling, clickbait-style title for the video based on the research'),
  theme: z.string().describe('The main theme or topic category (e.g., conspiracy theory, self-improvement, exposé)'),
  additionalInstructions: z.string().describe('Specific instructions for the script writer based on the research findings, including key points to cover, emotional tone, and narrative structure'),
  keyInsights: z.array(z.string()).describe('Top 3-5 key insights or talking points extracted from the research'),
  targetAudience: z.string().describe('Primary target audience for this content'),
  emotionalTone: z.string().describe('Recommended emotional tone (e.g., urgent, controversial, inspirational)')
})

export type ResearchAnalysis = z.infer<typeof researchAnalysisSchema>

// Research state interface
export interface ResearchState {
  query: string
  isSearching: boolean
  isAnalyzing: boolean
  searchResults: SearchResult[]
  analysis: ResearchAnalysis | null
  lastSearchAt: string | null
  lastAnalysisAt: string | null
  error: string | null
} 