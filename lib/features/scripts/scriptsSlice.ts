import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GeneratedScript {
  imageId: string
  imageName: string
  script: string
  generated: boolean
}

interface ScriptsState {
  prompt: string
  scripts: GeneratedScript[]
  hasGeneratedScripts: boolean
  lastGeneratedAt: string | null
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
  lastGeneratedAt: null
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
    }
  }
})

export const { 
  setPrompt,
  setScripts, 
  updateScript,
  initializeScripts,
  clearScripts,
  clearAllScriptData
} = scriptsSlice.actions

export default scriptsSlice.reducer 