import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedScript {
  imageId: string
  imageName: string
  script: string
  generated: boolean
}

// Research types (consistent with types/research.ts)
export interface SearchResult {
  title: string
  link: string
  description: string
}

export interface ResearchAnalysis {
  suggestedTitle: string
  theme: string
  targetAudience: string
  emotionalTone: string
  keyInsights: string[]
  additionalInstructions: string
}

export interface ResearchState {
  query: string
  isSearching: boolean
  isAnalyzing: boolean
  searchResults: SearchResult[]
  analysis: ResearchAnalysis | null
  error: string | null
  lastSearchAt: string | null
  lastAnalysisAt: string | null
}

// Script section types (consistent with types/script-section.ts but extended for Redux state)
export interface ScriptSection {
  id: string
  title: string
  writingInstructions: string
  image_generation_prompt: string
  generatedScript: string
  isGenerating: boolean
  wordCount: number
  order: number
}

export interface SectionedWorkflowState {
  // Main parameters
  videoTitle: string
  targetAudience: string
  theme: string
  emotionalTone: string
  additionalInstructions: string
  selectedModel: string
  wordCount: number
  
  // Script sections
  sections: ScriptSection[]
  isGeneratingSections: boolean
  
  // Generated full script (combined from all sections)
  fullScript: string
  
  // Uploaded style analysis
  uploadedStyle: string | null
  uploadedStyleFileName: string | null
  isAnalyzingStyle: boolean
}

interface ScriptsState {
  // Legacy fields (keep for backward compatibility)
  prompt: string
  scripts: GeneratedScript[]
  hasGeneratedScripts: boolean
  lastGeneratedAt: string | null
  
  // New workflow fields
  research: ResearchState
  sectionedWorkflow: SectionedWorkflowState
}

const initialResearchState: ResearchState = {
  query: '',
  isSearching: false,
  isAnalyzing: false,
  searchResults: [],
  analysis: null,
  error: null,
  lastSearchAt: null,
  lastAnalysisAt: null
}

const initialSectionedWorkflowState: SectionedWorkflowState = {
  videoTitle: '',
  targetAudience: '',
  theme: '',
  emotionalTone: '',
  additionalInstructions: '',
  selectedModel: 'claude-3-5-sonnet-20241022',
  sections: [],
  isGeneratingSections: false,
  fullScript: '',
  uploadedStyle: null,
  uploadedStyleFileName: null,
  isAnalyzingStyle: false,
  wordCount: 0
}

const initialState: ScriptsState = {
  prompt: `You are an expert narrator adapting manga panels into immersive audio-style scripts. For the image I'll provide, extract only meaningful dialogue and narration from speech bubbles and narration boxes. 
Extract in the order of right to left, top to bottom.
Then, transform the content into a smooth, natural-sounding narration, as if you're telling a story in real time.
If the panel includes actions or emotions (even without dialogue), briefly describe what's happening in a cinematic or dramatic tone.
Ignore sound effects, background text, and Japanese characters.
Do not include any symbols like quotation marks, asterisks, hyphens, brackets, or markdown.
Respond with only the final narration in plain text, suitable for voiceover — with clear flow and natural pacing. Add subtle emotional cues or tone hints if useful, but keep it brief. Don't over-explain or become robotic. Keep it human and engaging.
Final narration cannot have sound effects, laughs, onomatopoeia, groans, or coughs from text boxes, instead briefly describe what's happening.
Final narration cannot read words that are not in text boxes or read words that are not behind white boxes.
`,
  scripts: [],
  hasGeneratedScripts: false,
  lastGeneratedAt: null,
  research: initialResearchState,
  sectionedWorkflow: initialSectionedWorkflowState
}

export const scriptsSlice = createSlice({
  name: 'scripts',
  initialState,
  reducers: {
    // Legacy reducers (keep for backward compatibility)
    setPrompt: (state, action: PayloadAction<string>) => {
      state.prompt = action.payload
    },
    
    setScripts: (state, action: PayloadAction<GeneratedScript[]>) => {
      state.scripts = action.payload
      state.hasGeneratedScripts = action.payload.length > 0
      state.lastGeneratedAt = new Date().toISOString()
    },
    
    updateScript: (state, action: PayloadAction<{ imageId: string; script: string; generated: boolean }>) => {
      const { imageId, script, generated } = action.payload
      const existingScript = state.scripts.find(s => s.imageId === imageId)
      if (existingScript) {
        existingScript.script = script
        existingScript.generated = generated
        
        // Update hasGeneratedScripts if any script is successfully generated
        if (generated) {
          state.hasGeneratedScripts = true
          state.lastGeneratedAt = new Date().toISOString()
        }
      }
    },
    
    initializeScripts: (state, action: PayloadAction<Array<{ imageId: string; imageName: string }>>) => {
      state.scripts = action.payload.map(img => ({
        imageId: img.imageId,
        imageName: img.imageName,
        script: '',
        generated: false
      }))
      state.hasGeneratedScripts = false
    },
    
    clearScripts: (state) => {
      state.scripts = []
      state.hasGeneratedScripts = false
      state.lastGeneratedAt = null
    },
    
    clearAllScriptData: (state) => {
      state.prompt = ''
      state.scripts = []
      state.hasGeneratedScripts = false
      state.lastGeneratedAt = null
    },

    // Research Assistant reducers
    setResearchQuery: (state, action: PayloadAction<string>) => {
      state.research.query = action.payload
    },

    startResearchSearch: (state) => {
      state.research.isSearching = true
      state.research.error = null
      state.research.lastSearchAt = new Date().toISOString()
    },

    setResearchResults: (state, action: PayloadAction<SearchResult[]>) => {
      state.research.searchResults = action.payload
      state.research.isSearching = false
    },

    startResearchAnalysis: (state) => {
      state.research.isAnalyzing = true
    },

    setResearchAnalysis: (state, action: PayloadAction<ResearchAnalysis>) => {
      state.research.analysis = action.payload
      state.research.isAnalyzing = false
      state.research.lastAnalysisAt = new Date().toISOString()
    },

    setResearchError: (state, action: PayloadAction<string>) => {
      state.research.error = action.payload
      state.research.isSearching = false
      state.research.isAnalyzing = false
    },

    clearResearch: (state) => {
      state.research = initialResearchState
    },

    applyResearchToScript: (state) => {
      if (state.research.analysis) {
        state.sectionedWorkflow.videoTitle = state.research.analysis.suggestedTitle
        state.sectionedWorkflow.targetAudience = state.research.analysis.targetAudience
        state.sectionedWorkflow.theme = state.research.analysis.theme
        state.sectionedWorkflow.emotionalTone = state.research.analysis.emotionalTone
        state.sectionedWorkflow.additionalInstructions = state.research.analysis.additionalInstructions
      }
    },

    // Sectioned Workflow reducers
    setSectionedWorkflowField: (state, action: PayloadAction<{ field: keyof SectionedWorkflowState; value: any }>) => {
      const { field, value } = action.payload
      ;(state.sectionedWorkflow as any)[field] = value
    },

    startGeneratingSections: (state) => {
      state.sectionedWorkflow.isGeneratingSections = true
    },

    setSections: (state, action: PayloadAction<ScriptSection[]>) => {
      state.sectionedWorkflow.sections = action.payload
      state.sectionedWorkflow.isGeneratingSections = false
    },

    updateSection: (state, action: PayloadAction<{ id: string; field: keyof ScriptSection; value: any }>) => {
      const { id, field, value } = action.payload
      const section = state.sectionedWorkflow.sections.find(s => s.id === id)
      if (section) {
        ;(section as any)[field] = value
      }
    },

    startGeneratingDetailedScript: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload
      const section = state.sectionedWorkflow.sections.find(s => s.id === sectionId)
      if (section) {
        section.isGenerating = true
      }
    },

    setDetailedScript: (state, action: PayloadAction<{ sectionId: string; script: string; wordCount: number }>) => {
      const { sectionId, script, wordCount } = action.payload
      const section = state.sectionedWorkflow.sections.find(s => s.id === sectionId)
      if (section) {
        section.generatedScript = script
        section.wordCount = wordCount
        section.isGenerating = false
        
        // Update fullScript with all completed sections
        state.sectionedWorkflow.fullScript = state.sectionedWorkflow.sections
          .filter(s => s.generatedScript.trim())
          .sort((a, b) => a.order - b.order)
          .map(s => s.generatedScript)
          .join('\n\n')
      }
    },

    clearSections: (state) => {
      state.sectionedWorkflow.sections = []
      state.sectionedWorkflow.isGeneratingSections = false
      state.sectionedWorkflow.fullScript = ''
    },

    // Style Upload reducers
    startAnalyzingUploadedStyle: (state) => {
      state.sectionedWorkflow.isAnalyzingStyle = true
    },

    setUploadedStyle: (state, action: PayloadAction<{ style: string; fileName: string }>) => {
      state.sectionedWorkflow.uploadedStyle = action.payload.style
      state.sectionedWorkflow.uploadedStyleFileName = action.payload.fileName
      state.sectionedWorkflow.isAnalyzingStyle = false
    },

    clearUploadedStyle: (state) => {
      state.sectionedWorkflow.uploadedStyle = null
      state.sectionedWorkflow.uploadedStyleFileName = null
      state.sectionedWorkflow.isAnalyzingStyle = false
    },

    // Update fullScript manually or from external source
    setFullScript: (state, action: PayloadAction<string>) => {
      state.sectionedWorkflow.fullScript = action.payload
    }
  }
})

export const { 
  // Legacy actions
  setPrompt,
  setScripts, 
  updateScript,
  initializeScripts,
  clearScripts,
  clearAllScriptData,
  
  // Research actions
  setResearchQuery,
  startResearchSearch,
  setResearchResults,
  startResearchAnalysis,
  setResearchAnalysis,
  setResearchError,
  clearResearch,
  applyResearchToScript,
  
  // Sectioned workflow actions
  setSectionedWorkflowField,
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingDetailedScript,
  setDetailedScript,
  clearSections,
  
  // Style upload actions
  startAnalyzingUploadedStyle,
  setUploadedStyle,
  clearUploadedStyle,
  
  // FullScript actions
  setFullScript
} = scriptsSlice.actions

export default scriptsSlice.reducer 