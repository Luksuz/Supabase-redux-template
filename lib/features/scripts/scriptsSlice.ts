import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedScript {
  imageId: string
  imageName: string
  script: string
  generated: boolean
}

export interface ScriptSection {
  title: string
  writingInstructions: string
  image_generation_prompt: string
}

export interface FullScriptData {
  scriptWithMarkdown: string
  scriptCleaned: string
  title: string
  theme: string
  wordCount: number
  generatedAt: string
}

interface ScriptsState {
  prompt: string
  scripts: GeneratedScript[]
  hasGeneratedScripts: boolean
  lastGeneratedAt: string | null
  
  // New script generation format
  scriptSections: ScriptSection[]
  fullScript: FullScriptData | null
  hasScriptSections: boolean
  hasFullScript: boolean
  isGeneratingScript: boolean
  scriptGenerationError: string | null
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
  
  // New script generation format
  scriptSections: [],
  fullScript: null,
  hasScriptSections: false,
  hasFullScript: false,
  isGeneratingScript: false,
  scriptGenerationError: null
}

export const scriptsSlice = createSlice({
  name: 'scripts',
  initialState,
  reducers: {
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
    
    // New script generation actions
    setScriptSections: (state, action: PayloadAction<ScriptSection[]>) => {
      state.scriptSections = action.payload
      state.hasScriptSections = action.payload.length > 0
    },
    
    updateScriptSection: (state, action: PayloadAction<{ index: number; section: ScriptSection }>) => {
      const { index, section } = action.payload
      if (state.scriptSections[index]) {
        state.scriptSections[index] = section
      }
    },
    
    setFullScript: (state, action: PayloadAction<{ scriptWithMarkdown: string; scriptCleaned: string; title: string; theme?: string; wordCount?: number }>) => {
      const { scriptWithMarkdown, scriptCleaned, title, theme, wordCount } = action.payload
      state.fullScript = {
        scriptWithMarkdown,
        scriptCleaned,
        title,
        theme: theme || '',
        wordCount: wordCount || 0,
        generatedAt: new Date().toISOString()
      }
      state.hasFullScript = true
      state.lastGeneratedAt = new Date().toISOString()
    },
    
    clearFullScript: (state) => {
      state.fullScript = null
      state.hasFullScript = false
    },
    
    setIsGeneratingScript: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingScript = action.payload
      if (action.payload) {
        state.scriptGenerationError = null
      }
    },
    
    setScriptGenerationError: (state, action: PayloadAction<string>) => {
      state.scriptGenerationError = action.payload
      state.isGeneratingScript = false
    },
    
    clearAllNewScriptData: (state) => {
      state.scriptSections = []
      state.fullScript = null
      state.hasScriptSections = false
      state.hasFullScript = false
      state.isGeneratingScript = false
      state.scriptGenerationError = null
    }
  }
})

export const { 
  setPrompt,
  setScripts, 
  updateScript,
  initializeScripts,
  clearScripts,
  clearAllScriptData,
  setScriptSections,
  updateScriptSection,
  setFullScript,
  clearFullScript,
  setIsGeneratingScript,
  setScriptGenerationError,
  clearAllNewScriptData
} = scriptsSlice.actions

export default scriptsSlice.reducer 