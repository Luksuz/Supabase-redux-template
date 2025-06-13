import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
}

const initialState: ScriptsState = {
  currentJob: null,
  jobs: [],
  isLoading: false,
  error: null
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
  loadJob
} = scriptsSlice.actions

export default scriptsSlice.reducer 