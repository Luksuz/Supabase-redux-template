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

// New interface for pending sections waiting for approval
export interface PendingSection {
  id: string
  title: string
  writingInstructions: string
  tempId: string // Temporary ID for UI tracking
}

// New interface for pending scripts waiting for approval
export interface PendingScript {
  sectionId: string
  title: string
  writingInstructions: string
  generatedScript: string
  tempId: string // Temporary ID for UI tracking
  characterCount: number
  wordCount: number
}

export interface Voice {
  id: string
  name: string
  category?: string
  preview_url?: string
}

export interface AudioGenerationResult {
  success: boolean
  audioData?: string
  audioSize?: number
  chunksGenerated?: number
  totalChunks?: number
  errors?: string[]
  voiceId?: string
  modelId?: string
  mock?: boolean
  message?: string
}

export interface SectionAudioState {
  sectionId: string
  isGenerating: boolean
  result: AudioGenerationResult | null
  audioUrl: string | null
  error: string | null
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
  // Pending approval states
  pendingSections: PendingSection[]
  pendingScripts: PendingScript[]
  approvingSections: boolean
  approvingScript: string | null // ID of script being approved
  // Prompt management state
  prompts: Prompt[]
  selectedPromptId: string
  selectedPromptContent: string
  showPromptEditor: boolean
  promptsLoading: boolean
  promptContentLoading: boolean
  mergingData: boolean
  // Audio generation state
  audioGeneration: {
    voices: Voice[]
    selectedVoice: string
    selectedModel: string
    loadingVoices: boolean
    sectionAudioStates: SectionAudioState[]
    isPlaying: boolean
    currentPlayingSection: string | null
  }
}

const initialState: ScriptsState = {
  currentJob: null,
  jobs: [],
  isLoading: false,
  error: null,
  // Pending approval states
  pendingSections: [],
  pendingScripts: [],
  approvingSections: false,
  approvingScript: null,
  // Prompt management state
  prompts: [],
  selectedPromptId: '',
  selectedPromptContent: '',
  showPromptEditor: false,
  promptsLoading: false,
  promptContentLoading: false,
  mergingData: false,
  // Audio generation state
  audioGeneration: {
    voices: [],
    selectedVoice: '',
    selectedModel: 'eleven_multilingual_v2',
    loadingVoices: false,
    sectionAudioStates: [],
    isPlaying: false,
    currentPlayingSection: null
  }
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

    // New reducer for setting pending sections that need approval
    setPendingSections: (state, action: PayloadAction<PendingSection[]>) => {
      state.pendingSections = action.payload
      if (state.currentJob) {
        state.currentJob.isGeneratingSections = false
      }
    },

    // New reducer for approving sections
    startApprovingSections: (state) => {
      state.approvingSections = true
    },

    finishApprovingSections: (state) => {
      state.approvingSections = false
      state.pendingSections = []
    },

    // New reducer for rejecting sections
    rejectPendingSections: (state) => {
      state.pendingSections = []
      if (state.currentJob) {
        state.currentJob.isGeneratingSections = false
      }
    },

    // New reducer for setting pending script that needs approval
    setPendingScript: (state, action: PayloadAction<PendingScript>) => {
      const pendingScript = action.payload
      // Remove any existing pending script for this section
      state.pendingScripts = state.pendingScripts.filter(ps => ps.sectionId !== pendingScript.sectionId)
      // Add the new pending script
      state.pendingScripts.push(pendingScript)
      
      // Stop the generating state for the section
      if (state.currentJob) {
        const section = state.currentJob.sections.find(s => s.id === pendingScript.sectionId)
        if (section) {
          section.isGeneratingScript = false
        }
      }
    },

    // New reducer for approving a script
    startApprovingScript: (state, action: PayloadAction<string>) => {
      state.approvingScript = action.payload
    },

    finishApprovingScript: (state, action: PayloadAction<string>) => {
      state.approvingScript = null
      // Remove the pending script
      state.pendingScripts = state.pendingScripts.filter(ps => ps.tempId !== action.payload)
    },

    // New reducer for rejecting a script
    rejectPendingScript: (state, action: PayloadAction<string>) => {
      state.pendingScripts = state.pendingScripts.filter(ps => ps.tempId !== action.payload)
    },

    // New reducer for updating the entire pending scripts array
    updatePendingScripts: (state, action: PayloadAction<PendingScript[]>) => {
      state.pendingScripts = action.payload
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
    },

    // Audio generation reducers
    setVoices: (state, action: PayloadAction<Voice[]>) => {
      state.audioGeneration.voices = action.payload
      if (action.payload.length > 0 && !state.audioGeneration.selectedVoice) {
        state.audioGeneration.selectedVoice = action.payload[0].id
      }
    },

    setLoadingVoices: (state, action: PayloadAction<boolean>) => {
      state.audioGeneration.loadingVoices = action.payload
    },

    setSelectedVoice: (state, action: PayloadAction<string>) => {
      state.audioGeneration.selectedVoice = action.payload
    },

    setSelectedAudioModel: (state, action: PayloadAction<string>) => {
      state.audioGeneration.selectedModel = action.payload
    },

    startAudioGeneration: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload
      const existingState = state.audioGeneration.sectionAudioStates.find(s => s.sectionId === sectionId)
      
      if (existingState) {
        existingState.isGenerating = true
        existingState.error = null
        existingState.result = null
        existingState.audioUrl = null
      } else {
        state.audioGeneration.sectionAudioStates.push({
          sectionId,
          isGenerating: true,
          result: null,
          audioUrl: null,
          error: null
        })
      }
    },

    setAudioGenerationResult: (state, action: PayloadAction<{ sectionId: string; result: AudioGenerationResult }>) => {
      const { sectionId, result } = action.payload
      const sectionState = state.audioGeneration.sectionAudioStates.find(s => s.sectionId === sectionId)
      
      if (sectionState) {
        sectionState.isGenerating = false
        sectionState.result = result
        sectionState.error = null
      }
    },

    setAudioGenerationError: (state, action: PayloadAction<{ sectionId: string; error: string }>) => {
      const { sectionId, error } = action.payload
      const sectionState = state.audioGeneration.sectionAudioStates.find(s => s.sectionId === sectionId)
      
      if (sectionState) {
        sectionState.isGenerating = false
        sectionState.error = error
        sectionState.result = null
      }
    },

    setAudioUrl: (state, action: PayloadAction<{ sectionId: string; audioUrl: string | null }>) => {
      const { sectionId, audioUrl } = action.payload
      const sectionState = state.audioGeneration.sectionAudioStates.find(s => s.sectionId === sectionId)
      
      if (sectionState) {
        sectionState.audioUrl = audioUrl
      }
    },

    setAudioPlaying: (state, action: PayloadAction<{ sectionId: string | null; isPlaying: boolean }>) => {
      state.audioGeneration.isPlaying = action.payload.isPlaying
      state.audioGeneration.currentPlayingSection = action.payload.sectionId
    },
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
  startGeneratingAllScripts,
  clearCurrentJob,
  loadJob,
  updateTextRating,
  updateSectionRating,
  // Prompt management actions
  setPromptsLoading,
  setPromptContentLoading,
  setPrompts,
  setSelectedPromptId,
  setSelectedPromptContent,
  setShowPromptEditor,
  updatePromptInList,
  addPromptToList,
  removePromptFromList,
  setMergingData,
  // Audio generation actions
  setVoices,
  setSelectedVoice,
  setSelectedAudioModel,
  setLoadingVoices,
  startAudioGeneration,
  setAudioGenerationResult,
  setAudioGenerationError,
  setAudioUrl,
  setAudioPlaying,
  // New approval actions
  setPendingSections,
  startApprovingSections,
  finishApprovingSections,
  rejectPendingSections,
  setPendingScript,
  startApprovingScript,
  finishApprovingScript,
  rejectPendingScript,
  updatePendingScripts
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

// Audio generation thunks
export const loadVoicesThunk = () => async (dispatch: any) => {
  dispatch(setLoadingVoices(true))
  
  try {
    const response = await fetch('/api/elevenlabs/voices')
    const data = await response.json()

    if (response.ok && data.voices) {
      dispatch(setVoices(data.voices))
      return { success: true, voices: data.voices }
    } else {
      throw new Error(data.error || 'Failed to load voices')
    }
  } catch (error: any) {
    console.error('Error loading voices:', error)
    return { success: false, error: error.message }
  } finally {
    dispatch(setLoadingVoices(false))
  }
}

export const generateAudioThunk = (params: {
  sectionId: string
  text: string
  voiceId: string
  modelId: string
}) => async (dispatch: any) => {
  const { sectionId, text, voiceId, modelId } = params
  
  dispatch(startAudioGeneration(sectionId))
  
  try {
    const response = await fetch('/api/elevenlabs/generate-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId,
        modelId,
        sectionId
      })
    })

    const result = await response.json()

    if (response.ok && result.success) {
      dispatch(setAudioGenerationResult({ sectionId, result }))
      
      // Create audio URL if we have audio data
      if (result.audioData) {
        try {
          const binaryString = atob(result.audioData)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const blob = new Blob([bytes], { type: 'audio/mpeg' })
          const url = URL.createObjectURL(blob)
          dispatch(setAudioUrl({ sectionId, audioUrl: url }))
        } catch (error) {
          console.error('Error creating audio URL:', error)
          dispatch(setAudioGenerationError({ sectionId, error: 'Error processing audio data' }))
        }
      }
      
      return { success: true, result }
    } else {
      const errorMessage = result.error || 'Failed to generate audio'
      dispatch(setAudioGenerationError({ sectionId, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to generate audio'
    dispatch(setAudioGenerationError({ sectionId, error: errorMessage }))
    return { success: false, error: errorMessage }
  }
} 