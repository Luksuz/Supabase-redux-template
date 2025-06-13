import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Prompt {
  id: string
  title: string
  prompt: string
  created_at: string
  updated_at: string
}

export interface FineTuningText {
  id: string
  input_text: string
  generated_script: string
  text_order: number
  quality_score?: number
  is_validated: boolean
  validation_notes?: string
  character_count: number
  word_count: number
  created_at: string
}

export interface FineTuningSection {
  id: string
  title: string
  writing_instructions: string
  target_audience?: string
  tone?: string
  style_preferences?: string
  section_order: number
  is_completed: boolean
  training_examples_count: number
  texts: FineTuningText[]
  isGeneratingScript?: boolean
  created_at: string
  // Section Rating Fields (matching database schema)
  quality_score?: number
  rating_notes?: string
}

export interface FineTuningJob {
  id: string
  name: string
  description?: string
  theme: string
  model_name: string
  total_sections: number
  completed_sections: number
  total_training_examples: number
  prompt_used?: string
  sections: FineTuningSection[]
  isGeneratingSections: boolean
  sectionsGenerated: boolean
  created_at: string
  updated_at: string
}

interface ScriptsState {
  currentJob: FineTuningJob | null
  jobs: FineTuningJob[]
  isLoading: boolean
  error: string | null
  // Prompt management state
  prompts: Prompt[]
  selectedPromptId: string
  selectedPromptContent: string
  showPromptEditor: boolean
  promptsLoading: boolean
  promptContentLoading: boolean
  mergingData: boolean
}

const initialState: ScriptsState = {
  currentJob: null,
  jobs: [],
  isLoading: false,
  error: null,
  // Prompt management state
  prompts: [],
  selectedPromptId: '',
  selectedPromptContent: '',
  showPromptEditor: false,
  promptsLoading: false,
  promptContentLoading: false,
  mergingData: false
}

export const scriptsSlice = createSlice({
  name: 'scripts',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
      state.error = null
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isLoading = false
    },
    
    createNewJob: (state, action: PayloadAction<{ name: string; description?: string; theme: string }>) => {
      const { name, description, theme } = action.payload
      const jobId = Date.now().toString()
      
      const newJob: FineTuningJob = {
        id: jobId,
        name,
        description,
        theme,
        model_name: 'gpt-4o-mini',
        total_sections: 0,
        completed_sections: 0,
        total_training_examples: 0,
        sections: [],
        isGeneratingSections: false,
        sectionsGenerated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      state.currentJob = newJob
      state.jobs.unshift(newJob)
    },
    
    setCurrentJob: (state, action: PayloadAction<FineTuningJob>) => {
      state.currentJob = action.payload
    },
    
    loadJobs: (state, action: PayloadAction<FineTuningJob[]>) => {
      state.jobs = action.payload
    },

    startGeneratingSections: (state) => {
      if (state.currentJob) {
        state.currentJob.isGeneratingSections = true
      }
    },
    
    setSections: (state, action: PayloadAction<FineTuningSection[]>) => {
      if (state.currentJob) {
        state.currentJob.sections = action.payload
        state.currentJob.isGeneratingSections = false
        state.currentJob.sectionsGenerated = true
        state.currentJob.total_sections = action.payload.length
        state.currentJob.updated_at = new Date().toISOString()
      }
    },
    
    updateSection: (state, action: PayloadAction<{ 
      sectionId: string; 
      updates: Partial<Pick<FineTuningSection, 'title' | 'writing_instructions' | 'target_audience' | 'tone' | 'style_preferences'>> 
    }>) => {
      if (state.currentJob) {
        const { sectionId, updates } = action.payload
        const section = state.currentJob.sections.find(s => s.id === sectionId)
      if (section) {
          Object.assign(section, updates)
          state.currentJob.updated_at = new Date().toISOString()
        }
      }
    },
    
    startGeneratingScript: (state, action: PayloadAction<string>) => {
      if (state.currentJob) {
        const section = state.currentJob.sections.find(s => s.id === action.payload)
      if (section) {
          section.isGeneratingScript = true
        }
      }
    },
    
    addGeneratedText: (state, action: PayloadAction<{ 
      sectionId: string; 
      text: Omit<FineTuningText, 'id' | 'created_at'> & { id?: string }
    }>) => {
      if (state.currentJob) {
        const { sectionId, text } = action.payload
        const section = state.currentJob.sections.find(s => s.id === sectionId)
        if (section) {
          const newText: FineTuningText = {
            ...text,
            id: text.id || `${Date.now()}-${Math.random()}`,
            created_at: new Date().toISOString()
          }
          section.texts.push(newText)
          section.isGeneratingScript = false
          section.training_examples_count = section.texts.length
          state.currentJob.total_training_examples = state.currentJob.sections.reduce(
            (total, s) => total + s.texts.length, 0
          )
          state.currentJob.updated_at = new Date().toISOString()
        }
      }
    },
    
    updateTextRating: (state, action: PayloadAction<{ 
      textId: string; 
      quality_score: number; 
      is_validated: boolean;
      validation_notes?: string;
    }>) => {
      if (state.currentJob) {
        const { textId, quality_score, is_validated, validation_notes } = action.payload
        for (const section of state.currentJob.sections) {
          const text = section.texts.find(t => t.id === textId)
          if (text) {
            text.quality_score = quality_score
            text.is_validated = is_validated
            text.validation_notes = validation_notes
            state.currentJob.updated_at = new Date().toISOString()
            break
          }
        }
      }
    },
    
    updateSectionRating: (state, action: PayloadAction<{ 
      sectionId: string; 
      quality_score?: number;
      rating_notes?: string;
    }>) => {
      if (state.currentJob) {
        const { sectionId, ...updates } = action.payload
        const section = state.currentJob.sections.find(s => s.id === sectionId)
        if (section) {
          Object.assign(section, updates)
          state.currentJob.updated_at = new Date().toISOString()
        }
      }
    },
    
    startGeneratingAllScripts: (state) => {
      if (state.currentJob) {
        state.currentJob.sections.forEach(section => {
          section.isGeneratingScript = true
        })
      }
    },
    
    clearCurrentJob: (state) => {
      state.currentJob = null
    },
    
    loadJob: (state, action: PayloadAction<string>) => {
      const job = state.jobs.find(j => j.id === action.payload)
      if (job) {
        state.currentJob = job
      }
    },

    // Prompt management reducers
    setPromptsLoading: (state, action: PayloadAction<boolean>) => {
      state.promptsLoading = action.payload
    },

    setPromptContentLoading: (state, action: PayloadAction<boolean>) => {
      state.promptContentLoading = action.payload
    },

    setPrompts: (state, action: PayloadAction<Prompt[]>) => {
      state.prompts = action.payload
      state.promptsLoading = false
    },

    setSelectedPromptId: (state, action: PayloadAction<string>) => {
      state.selectedPromptId = action.payload
      // Reset content and editor when changing prompts
      if (action.payload === '' || action.payload === 'default') {
        state.selectedPromptContent = ''
        state.showPromptEditor = false
      }
    },

    setSelectedPromptContent: (state, action: PayloadAction<string>) => {
      state.selectedPromptContent = action.payload
    },

    setShowPromptEditor: (state, action: PayloadAction<boolean>) => {
      state.showPromptEditor = action.payload
    },

    updatePromptInList: (state, action: PayloadAction<{ id: string; title: string; prompt: string }>) => {
      const { id, title, prompt } = action.payload
      const existingPrompt = state.prompts.find(p => p.id === id)
      if (existingPrompt) {
        existingPrompt.title = title
        existingPrompt.prompt = prompt
        existingPrompt.updated_at = new Date().toISOString()
      }
    },

    addPromptToList: (state, action: PayloadAction<Prompt>) => {
      state.prompts.unshift(action.payload)
    },

    removePromptFromList: (state, action: PayloadAction<string>) => {
      state.prompts = state.prompts.filter(p => p.id !== action.payload)
      // Reset selection if the deleted prompt was selected
      if (state.selectedPromptId === action.payload) {
        state.selectedPromptId = ''
        state.selectedPromptContent = ''
        state.showPromptEditor = false
      }
    },

    setMergingData: (state, action: PayloadAction<boolean>) => {
      state.mergingData = action.payload
    }
  }
})

export const { 
  setLoading,
  setError,
  createNewJob,
  setCurrentJob,
  loadJobs,
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingScript,
  addGeneratedText,
  updateTextRating,
  updateSectionRating,
  startGeneratingAllScripts,
  clearCurrentJob,
  loadJob,
  setPromptsLoading,
  setPromptContentLoading,
  setPrompts,
  setSelectedPromptId,
  setSelectedPromptContent,
  setShowPromptEditor,
  updatePromptInList,
  addPromptToList,
  removePromptFromList,
  setMergingData
} = scriptsSlice.actions

export default scriptsSlice.reducer

// Async thunks for prompt operations
export const fetchPromptsThunk = () => async (dispatch: any) => {
  dispatch(setPromptsLoading(true))
  try {
    const response = await fetch('/api/prompts')
    const data = await response.json()
    
    if (data.success) {
      dispatch(setPrompts(data.prompts))
    } else {
      console.error('Failed to fetch prompts:', data.error)
    }
  } catch (error) {
    console.error('Error fetching prompts:', error)
  } finally {
    dispatch(setPromptsLoading(false))
  }
}

export const fetchPromptContentThunk = (promptId: string) => async (dispatch: any) => {
  if (!promptId || promptId === 'default') {
    dispatch(setSelectedPromptContent(''))
    dispatch(setShowPromptEditor(false))
    return
  }

  dispatch(setPromptContentLoading(true))
  try {
    const response = await fetch(`/api/prompts/${promptId}`)
    const data = await response.json()
    
    if (data.success) {
      dispatch(setSelectedPromptContent(data.prompt.prompt))
      dispatch(setShowPromptEditor(true))
    } else {
      console.error('Failed to fetch prompt content:', data.error)
    }
  } catch (error) {
    console.error('Error fetching prompt content:', error)
  } finally {
    dispatch(setPromptContentLoading(false))
  }
}

export const savePromptChangesThunk = () => async (dispatch: any, getState: any) => {
  const state = getState().scripts
  const { selectedPromptId, selectedPromptContent, prompts } = state
  
  if (!selectedPromptId || selectedPromptId === 'default') return

  try {
    const selectedPrompt = prompts.find((p: Prompt) => p.id === selectedPromptId)
    if (!selectedPrompt) return

    const response = await fetch(`/api/prompts/${selectedPromptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: selectedPrompt.title,
        prompt: selectedPromptContent
      })
    })

    const data = await response.json()

    if (data.success) {
      dispatch(updatePromptInList({
        id: selectedPromptId,
        title: selectedPrompt.title,
        prompt: selectedPromptContent
      }))
      return { success: true }
    } else {
      return { success: false, error: data.error || 'Failed to save prompt' }
    }
  } catch (error) {
    console.error('Error saving prompt:', error)
    return { success: false, error: 'Failed to save prompt' }
  }
}

export const handlePromptSelectionThunk = (promptId: string) => async (dispatch: any) => {
  dispatch(setSelectedPromptId(promptId))
  if (promptId && promptId !== 'default') {
    dispatch(fetchPromptContentThunk(promptId))
  }
}

export const mergeYouTubeDataWithPromptThunk = (youtubeData: any[], theme?: string) => async (dispatch: any, getState: any) => {
  const state = getState().scripts
  const { selectedPromptContent } = state
  
  if (!selectedPromptContent || !youtubeData || youtubeData.length === 0) {
    return { success: false, error: 'No prompt content or YouTube data available' }
  }

  dispatch(setMergingData(true))
  try {
    const response = await fetch('/api/prompts/merge-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPrompt: selectedPromptContent,
        youtubeData: youtubeData,
        theme: theme
      })
    })

    const data = await response.json()

    if (data.success) {
      dispatch(setSelectedPromptContent(data.mergedPrompt))
      return { success: true, usingMock: data.usingMock }
    } else {
      return { success: false, error: data.error || 'Failed to merge data with prompt' }
    }
  } catch (error) {
    console.error('Error merging YouTube data with prompt:', error)
    return { success: false, error: 'Failed to merge data with prompt' }
  } finally {
    dispatch(setMergingData(false))
  }
} 