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

// Theme options with detailed instructions
export interface ThemeOption {
  id: string
  name: string
  description: string
  instructions: {
    hook: string
    tone: string
    clarity: string
    narrativeFlow: string
    balance: string
    engagement: string
    format: string
    overall: string
  }
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'life-death-afterlife',
    name: 'Life, Death & The Afterlife',
    description: 'Explore death as transition, spiritual preparation, and consciousness beyond physical existence',
    instructions: {
      hook: 'Introduce death not as an ending, but as a transition — a process we have all quietly feared, yet deeply sensed holds more meaning than we\'ve been told.',
      tone: 'Mysterious, encouraging, empowering and uplifting. Warm, friendly, guiding them without being patronizing. Undercurrent of optimism. Balances spiritual authority with accessibility, inviting introspection without pressure. Language uses practicality with mysticism, avoiding academic phrasing.',
      clarity: 'Complex spiritual and esoteric death/afterlife concepts are simplified and explained in down-to-earth language. Metaphors (like rivers, threads, and cocoons) clarify intangible ideas. Focuses on emotional and intuitive resonance.',
      narrativeFlow: 'The style follows a smooth progression: Begins with a relatable curiosity or fear of death, unfolds into hidden teachings and building toward understanding, then expands to the viewer\'s own life and choices and possibly practical techniques. Builds tension and awe while guiding gently.',
      balance: 'The style often references ancient wisdom for example from the Tibetan Book of the Dead alongside modern insights like near-death experiences & stories, real consciousness studies, and quantum theory. This bridges credibility gaps and appeals to readers who value rational explanation as well as spiritual insight, but without over-explaining.',
      engagement: 'Rhetorical questions, vivid imagery, and inclusive pronouns ("we," "you") keep the reader involved. These stylistic choices foster a sense of partnership and community in the learning journey.',
      format: 'Hook: Universal experience of wondering what happens after death. Re-Hook: (What if…?, Have you ever considered..? etc). Introduction: Present death as the beginning of a test. Set stakes by explaining that unprepared souls repeat the cycle unconsciously. Contents: Educational segments walking through the stages of the Bardo: the clear light, illusions, karmic forces, life review, final decision. Problem identification: Most people fail these stages due to fear, attachment, and unconsciousness. Practical tools & techniques: Awareness training, detachment, meditation, Consciousness transference (phowa), Framing life\'s transitions as mini-deaths (bardos) to rehearse awakening, death contemplation practices explained clearly step-by-step.',
      overall: 'Conscious dying, to broader concepts like soul liberation, the continuity of consciousness, and using awareness beyond death to transcend illusion and reshape existence.'
    }
  },
  {
    id: 'forbidden-knowledge',
    name: 'Forbidden Knowledge / Hidden Truths & Conspiracy',
    description: 'Uncover hidden truths, expose deception, and awaken to suppressed knowledge',
    instructions: {
      hook: 'Introduce the idea that reality has been engineered to keep us asleep. Tap into the viewer\'s intuitive suspicion that something about our world feels off—as if key truths have been hidden in plain sight.',
      tone: 'Mysterious, provocative, and awakening. The voice is firm but not preachy, calling the viewer to awareness. It feels rebellious, but grounded. Language mixes ancient and modern references, conspiratorial insights with spiritual undertones. Maintain authenticity and avoid dramatic clichés.',
      clarity: 'Complex or controversial ideas are broken down into relatable, easily digestible insights. Uses metaphors (like veils, mirrors, or puppet strings) to communicate psychological and systemic influence without sensationalism.',
      narrativeFlow: 'Begins with subtle, familiar discomforts (something isn\'t right), reveals hidden patterns and influences, then empowers the viewer with understanding and practical awareness. Each section lifts the veil further—building from observable phenomena to deeper revelations through evidence and logic.',
      balance: 'References both spiritual traditions and documented examples of institutional influence (historical cases, psychological research, media analysis). Frames ancient wisdom as suppressed perspectives that complement modern understanding, supported by verifiable information.',
      engagement: 'Strategic rhetorical questions that prompt genuine reflection, symbolic imagery that resonates with personal experience, and inclusive language that builds community around shared discovery. Focus on empowering awareness rather than creating fear or dependency.',
      format: 'Hook: A relatable observation about societal patterns that hints at deeper design. Re-Hook: Thought-provoking questions that challenge assumptions. Introduction: Establish the premise that information has been selectively presented or suppressed throughout history. Contents: Educational exploration of documented cases of influence, historical patterns, psychological mechanisms, and alternative perspectives backed by research. Problem identification: Recognition of information asymmetries and their effects on perception. Practical tools: Critical thinking frameworks, pattern recognition skills, media literacy, and methods for independent research and verification.',
      overall: 'Developing discernment and independent thinking. From recognizing influence patterns to cultivating authentic awareness. Empowering viewers to think critically, research independently, and form their own informed conclusions—ultimately leading to intellectual sovereignty and conscious choice-making.'
    }
  },
  {
    id: 'energy-control',
    name: 'Energy Control & Reality Influence',
    description: 'Master personal energy fields, chakras, and vibrational influence on reality',
    instructions: {
      hook: 'Introduce the concept of an "energy field" as something we have all experienced intuitively but may not fully comprehend.',
      tone: 'Encouraging, empowering, uplifting. Warm, friendly, guiding them without being patronizing. Undercurrent of optimism. Suggests everyone has potential that can be unlocked. Language uses practicality with mysticism, avoiding academic phrasing.',
      clarity: 'Complex spiritual and energetic concepts are simplified and explained in down-to-earth language. Metaphors (like rivers, threads, and cocoons) clarify intangible ideas.',
      narrativeFlow: 'The style follows a smooth progression: starting from a relatable experience, building toward understanding, providing practical techniques, then broadening to larger implications and applications.',
      balance: 'The style often references scientific studies or electromagnetic fields alongside ancient wisdom like chakras and pranayama. This bridges credibility gaps and appeals to readers who value rational explanation as well as spiritual insight.',
      engagement: 'Rhetorical questions, vivid imagery, and inclusive pronouns ("we," "you") keep the reader involved. These stylistic choices foster a sense of partnership and community in the learning journey.',
      format: 'Hook: Universal human experience that appeals to the viewer\'s intuitive experience. Re-Hook: (What if…?, Have you ever considered..?). Introduction: Establish the importance of understanding one\'s energy field. Contents: Educational segments with detailed explanation of the aura layers, chakras, how energy imbalances manifest in daily life. Problem identification: concept of energy blockages is introduced. Practical tools & techniques: pranayama, meditation, mindfulness, explained step-by-step.',
      overall: 'Self-healing, to broader concepts like manifestation, the interconnectedness of all beings and using higher vibrational thinking to shape reality.'
    }
  },
  {
    id: 'ancient-esoteric',
    name: 'Ancient Esoteric Teachings & Spiritual History',
    description: 'Rediscover hidden wisdom from mystery schools, sacred traditions, and forgotten knowledge',
    instructions: {
      hook: 'Introduce the idea that ancient spiritual knowledge wasn\'t lost — it was hidden. Passed down through temples, symbols, and oral traditions, waiting for the right moment—and the right minds—to remember.',
      tone: 'Mystical, reverent, awakening & encouraging. Speaks to the viewer\'s inner knowing. Calming yet powerful — like being initiated into something they were always meant to find. Language is poetic, symbolic, direct and uses practicality, avoiding academic phrasing.',
      clarity: 'Complex ancient teachings are simplified and explained in down-to-earth language storytelling. Modern metaphors (like "hidden blueprints," "echoes in stone," or "coded memory") clarify intangible ideas.',
      narrativeFlow: 'The style follows a smooth progression: Begins by challenging mainstream history, moves towards the unveiling of hidden wisdom across timelines, and ends with the viewer realizing they are part of this lineage — a living continuation of ancient spiritual evolution.',
      balance: 'Blends mystical narratives with historical context. Doesn\'t over-fixate on facts or dates — instead, treats stories, myths, and symbols as sacred technologies. Suggests ancient knowledge wasn\'t lost but hidden, encoded, and preserved in plain sight.',
      engagement: 'Rhetorical questions, vivid imagery, and inclusive pronouns ("we," "you") keep the reader involved. Invites the viewer to identify as a seeker or awakened soul. These stylistic choices foster a sense of partnership and community in the journey they all experience.',
      format: 'Hook: Shared feeling of missing knowledge — a quiet sense that what we were taught about human history isn\'t the full story. Re-Hook: (What if…?, Have you ever considered..?). Introduction: Establish the importance of reclaiming forgotten wisdom. Frames ancient spiritual knowledge not as irrelevant history — but as the missing key to understanding ourselves and the world today. Contents: Educational segments focusing on timelines of spiritual wisdom — mystery schools, hidden traditions, esoteric laws, sacred symbolism etc. Problem identification: Collective spiritual amnesia — sacred knowledge was suppressed, distorted, or forgotten. Practical tools & techniques: Guided remembering through sacred symbols, intuitive meditation, inner energy activation, and decoding metaphysical teachings.',
      overall: 'Rediscovery of ancient spiritual systems, to deeper understanding of humanity\'s forgotten origins, sacred knowledge, and how esoteric teachings can be applied to modern life for inner transformation and expanded consciousness.'
    }
  },
  {
    id: 'synchronicities-manifestation',
    name: 'Synchronicities, Reality & Manifestation',
    description: 'Understand universal signs, synchronicities, and how consciousness shapes reality',
    instructions: {
      hook: 'Introduce the idea that the universe is always responding—through signs, patterns, and the reflections of our inner world.',
      tone: 'Encouraging, empowering, uplifting. Warm, friendly, guiding them without being patronizing. Undercurrent of optimism. Suggests everyone has the potential to bend reality. Language uses practicality with mysticism, avoiding academic phrasing.',
      clarity: 'Complex ideas like frequency, manifestation, and non-linear time are simplified and explained through practical analogies (e.g. mirrors, magnets, algorithms). Makes abstract spiritual laws feel real, applicable, and intuitive.',
      narrativeFlow: 'The style follows a smooth progression: starting from a relatable experience, building toward understanding, providing practical techniques, then broadening to larger implications and applications.',
      balance: 'Touches on themes such as the quantum observer effect, neural patterning, and vibrational resonance—but avoids heavy jargon. Frames universal laws and manifestation principles as both ancient wisdom and modern insight. Bridges spiritual experience with mental reprogramming and energetic self-awareness.',
      engagement: 'Rhetorical questions, vivid imagery, and inclusive pronouns ("we," "you") keep the reader involved. These stylistic choices foster a sense of partnership and community in the learning journey. Questions like "Have you ever felt like the universe was trying to tell you something?", second-person narration, direct invitations to reflect, and relatable examples (e.g. thinking of someone before they call, repeating numbers, \'random\' opportunities).',
      format: 'Hook: Starts with moments people can instantly recognize—synchronicities, déjà vu, "weird timing," or feeling guided. Re-Hook: (What if…?, Have you ever considered..?). Introduction: Establish the importance of recognizing universal signs and understanding how thoughts, emotions, and patterns shape reality. Contents: Educational segments breaking down key principles such as synchronicities, vibrational alignment, and how beliefs influence perception and reality. Problem identification: unconscious patterns and disconnection from intuitive signs are introduced. Practical tools & techniques: reality-check journaling, symbolic interpretation, intention-setting rituals, explained step-by-step.',
      overall: 'Self-healing, to broader concepts like manifestation, the interconnectedness of all beings and using higher vibrational thinking to shape reality.'
    }
  }
]

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
  isRegenerating: boolean
  wordCount: number
  order: number
}

// CTA (Call To Action) interface
export interface CTA {
  id: string
  type: 'newsletter' | 'engagement' | 'custom'
  content?: string // For custom CTAs
  placement: 'beginning' | 'middle' | 'end' | 'custom'
  customPosition?: number // For custom placement (section index)
  enabled: boolean
}

export interface SectionedWorkflowState {
  // Main parameters
  videoTitle: string
  targetAudience: string
  themeId: string
  emotionalTone: string
  additionalInstructions: string
  selectedModel: string
  wordCount: number
  forbiddenWords: string
  
  // Style selection
  selectedStyle: string | null
  
  // Quote functionality
  quote: {
    text: string
    author: string
    enabled: boolean
  }
  
  // Workflow navigation state
  currentStep: number
  completedSteps: number[]
  
  // Outline generation state
  outlineMethod: 'standard' | 'title-only' | 'script-extractor' | 'custom-info'
  scriptContent: string // For script extractor method
  customInformation: string // For custom info method
  
  // Script sections
  sections: ScriptSection[]
  isGeneratingSections: boolean
  sectionsProgress: {
    isActive: boolean
    current: number
    total: number
    message: string
  }
  
  // Generated full script (combined from all sections)
  fullScript: string
  
  // Detailed script generation progress
  detailedScriptProgress: {
    isActive: boolean
    currentBatch: number
    totalBatches: number
    currentSection: number
    totalSections: number
    message: string
  }
  
  // Uploaded style analysis
  uploadedStyle: string | null
  uploadedStyleFileName: string | null
  isAnalyzingStyle: boolean
  
  // Multiple CTAs configuration
  ctas: CTA[]
  
  // Translation state
  translation: {
    originalScript: string
    translatedScript: string
    sourceLanguage: string
    targetLanguage: string
    isTranslating: boolean
    translatedAt: string | null
  }
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
  themeId: '',
  emotionalTone: '',
  additionalInstructions: '',
  selectedModel: 'claude-3-5-sonnet-20241022',
  selectedStyle: null,
  quote: {
    text: '',
    author: '',
    enabled: false
  },
  
  // Workflow navigation state
  currentStep: 0,
  completedSteps: [],
  
  // Outline generation state
  outlineMethod: 'standard',
  scriptContent: '',
  customInformation: '',
  
  sections: [],
  isGeneratingSections: false,
  sectionsProgress: {
    isActive: false,
    current: 0,
    total: 0,
    message: ''
  },
  fullScript: '',
  detailedScriptProgress: {
    isActive: false,
    currentBatch: 0,
    totalBatches: 0,
    currentSection: 0,
    totalSections: 0,
    message: ''
  },
  uploadedStyle: null,
  uploadedStyleFileName: null,
  isAnalyzingStyle: false,
  wordCount: 0,
  forbiddenWords: '',
  ctas: [],
  translation: {
    originalScript: '',
    translatedScript: '',
    sourceLanguage: '',
    targetLanguage: '',
    isTranslating: false,
    translatedAt: null
  }
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
        state.sectionedWorkflow.themeId = state.research.analysis.theme
        state.sectionedWorkflow.emotionalTone = state.research.analysis.emotionalTone
        state.sectionedWorkflow.additionalInstructions = state.research.analysis.additionalInstructions
      }
    },

    // Sectioned Workflow reducers
    setSectionedWorkflowField: (state, action: PayloadAction<{ field: keyof SectionedWorkflowState; value: any }>) => {
      const { field, value } = action.payload
      ;(state.sectionedWorkflow as any)[field] = value
    },

    // Workflow navigation actions
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.sectionedWorkflow.currentStep = action.payload
    },

    markStepCompleted: (state, action: PayloadAction<number>) => {
      const step = action.payload
      if (!state.sectionedWorkflow.completedSteps.includes(step)) {
        state.sectionedWorkflow.completedSteps.push(step)
      }
    },

    resetWorkflowProgress: (state) => {
      state.sectionedWorkflow.currentStep = 0
      state.sectionedWorkflow.completedSteps = []
    },

    // Outline generation actions
    setOutlineMethod: (state, action: PayloadAction<'standard' | 'title-only' | 'script-extractor' | 'custom-info'>) => {
      state.sectionedWorkflow.outlineMethod = action.payload
    },

    setScriptContent: (state, action: PayloadAction<string>) => {
      state.sectionedWorkflow.scriptContent = action.payload
    },

    setCustomInformation: (state, action: PayloadAction<string>) => {
      state.sectionedWorkflow.customInformation = action.payload
    },

    startGeneratingSections: (state) => {
      state.sectionedWorkflow.isGeneratingSections = true
      state.sectionedWorkflow.sectionsProgress = {
        isActive: true,
        current: 0,
        total: 100,
        message: 'Initializing sections generation...'
      }
    },

    updateSectionsProgress: (state, action: PayloadAction<{ current: number; total: number; message: string }>) => {
      const { current, total, message } = action.payload
      state.sectionedWorkflow.sectionsProgress = {
        isActive: true,
        current,
        total,
        message
      }
    },

    setSections: (state, action: PayloadAction<ScriptSection[]>) => {
      state.sectionedWorkflow.sections = action.payload.map(section => ({
        ...section,
        isRegenerating: false // Initialize regeneration state
      }))
      state.sectionedWorkflow.isGeneratingSections = false
      state.sectionedWorkflow.sectionsProgress = {
        isActive: false,
        current: 0,
        total: 0,
        message: ''
      }
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

    // Add regeneration actions
    startRegeneratingSection: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload
      const section = state.sectionedWorkflow.sections.find(s => s.id === sectionId)
      if (section) {
        section.isRegenerating = true
      }
    },

    stopRegeneratingSection: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload
      const section = state.sectionedWorkflow.sections.find(s => s.id === sectionId)
      if (section) {
        section.isRegenerating = false
      }
    },

    // New action to start generating all sections at once
    startGeneratingAllDetailedScripts: (state) => {
      state.sectionedWorkflow.sections.forEach(section => {
        section.isGenerating = true
      })
    },

    // New action to set all detailed scripts at once
    setAllDetailedScripts: (state, action: PayloadAction<Array<{ id: string; script: string; wordCount: number; error?: boolean }>>) => {
      const scriptsData = action.payload
      
      scriptsData.forEach(({ id, script, wordCount, error }) => {
        const section = state.sectionedWorkflow.sections.find(s => s.id === id)
        if (section) {
          section.generatedScript = script
          section.wordCount = wordCount
          section.isGenerating = false
          // Mark section with error state if needed
          if (error) {
            section.generatedScript = script // Keep the error message
          }
        }
      })
      
      // Update fullScript with all completed sections
      state.sectionedWorkflow.fullScript = state.sectionedWorkflow.sections
        .filter(s => s.generatedScript.trim() && !s.generatedScript.includes('[Error generating content'))
        .sort((a, b) => a.order - b.order)
        .map(s => s.generatedScript)
        .join('\n\n')
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
    },

    // Translation reducers
    startTranslation: (state, action: PayloadAction<{ text: string; targetLanguage: string; sourceLanguage?: string }>) => {
      const { text, targetLanguage, sourceLanguage } = action.payload
      state.sectionedWorkflow.translation.originalScript = text
      state.sectionedWorkflow.translation.targetLanguage = targetLanguage
      state.sectionedWorkflow.translation.sourceLanguage = sourceLanguage || ''
      state.sectionedWorkflow.translation.isTranslating = true
      state.sectionedWorkflow.translation.translatedScript = ''
      state.sectionedWorkflow.translation.translatedAt = null
    },

    setTranslationResult: (state, action: PayloadAction<{ 
      translatedText: string
      sourceLanguage: string
      targetLanguage: string
    }>) => {
      const { translatedText, sourceLanguage, targetLanguage } = action.payload
      state.sectionedWorkflow.translation.translatedScript = translatedText
      state.sectionedWorkflow.translation.sourceLanguage = sourceLanguage
      state.sectionedWorkflow.translation.targetLanguage = targetLanguage
      state.sectionedWorkflow.translation.isTranslating = false
      state.sectionedWorkflow.translation.translatedAt = new Date().toISOString()
    },

    clearTranslation: (state) => {
      state.sectionedWorkflow.translation = {
        originalScript: '',
        translatedScript: '',
        sourceLanguage: '',
        targetLanguage: '',
        isTranslating: false,
        translatedAt: null
      }
    },

    setTranslationError: (state) => {
      state.sectionedWorkflow.translation.isTranslating = false
    },

    // CTA configuration reducers
    addCTA: (state, action: PayloadAction<CTA>) => {
      state.sectionedWorkflow.ctas.push(action.payload)
    },

    removeCTA: (state, action: PayloadAction<string>) => {
      state.sectionedWorkflow.ctas = state.sectionedWorkflow.ctas.filter(cta => cta.id !== action.payload)
    },

    updateCTA: (state, action: PayloadAction<{ id: string; updates: Partial<CTA> }>) => {
      const { id, updates } = action.payload
      const ctaIndex = state.sectionedWorkflow.ctas.findIndex(cta => cta.id === id)
      if (ctaIndex !== -1) {
        state.sectionedWorkflow.ctas[ctaIndex] = { ...state.sectionedWorkflow.ctas[ctaIndex], ...updates }
      }
    },

    setCTAField: (state, action: PayloadAction<{ field: keyof CTA; value: any }>) => {
      const { field, value } = action.payload
      // This is a legacy action - we'll keep it for backward compatibility but it's not ideal
      state.sectionedWorkflow.ctas.forEach(cta => {
        ;(cta as any)[field] = value
      })
    },

    setCTAEnabled: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
      const { id, enabled } = action.payload
      const cta = state.sectionedWorkflow.ctas.find(cta => cta.id === id)
      if (cta) {
        cta.enabled = enabled
      }
    },

    setCTAPlacement: (state, action: PayloadAction<{ id: string; placement: CTA['placement'] }>) => {
      const { id, placement } = action.payload
      const cta = state.sectionedWorkflow.ctas.find(cta => cta.id === id)
      if (cta) {
        cta.placement = placement
      }
    },

    setCTAType: (state, action: PayloadAction<{ id: string; type: CTA['type'] }>) => {
      const { id, type } = action.payload
      const cta = state.sectionedWorkflow.ctas.find(cta => cta.id === id)
      if (cta) {
        cta.type = type
      }
    },

    // Quote configuration reducers
    setQuote: (state, action: PayloadAction<{ text: string; author: string }>) => {
      const { text, author } = action.payload
      state.sectionedWorkflow.quote.text = text
      state.sectionedWorkflow.quote.author = author
      state.sectionedWorkflow.quote.enabled = true
    },

    setQuoteEnabled: (state, action: PayloadAction<boolean>) => {
      state.sectionedWorkflow.quote.enabled = action.payload
    },

    clearQuote: (state) => {
      state.sectionedWorkflow.quote = {
        text: '',
        author: '',
        enabled: false
      }
    },

    // New actions for batch processing
    startGeneratingBatch: (state, action: PayloadAction<string[]>) => {
      const sectionIds = action.payload
      sectionIds.forEach(id => {
        const section = state.sectionedWorkflow.sections.find(s => s.id === id)
        if (section) {
          section.isGenerating = true
        }
      })
    },

    startDetailedScriptGeneration: (state, action: PayloadAction<{ totalBatches: number; totalSections: number }>) => {
      const { totalBatches, totalSections } = action.payload
      state.sectionedWorkflow.detailedScriptProgress = {
        isActive: true,
        currentBatch: 0,
        totalBatches,
        currentSection: 0,
        totalSections,
        message: 'Starting detailed script generation...'
      }
    },

    updateDetailedScriptProgress: (state, action: PayloadAction<{ 
      currentBatch: number
      currentSection: number
      message: string 
    }>) => {
      const { currentBatch, currentSection, message } = action.payload
      if (state.sectionedWorkflow.detailedScriptProgress.isActive) {
        state.sectionedWorkflow.detailedScriptProgress.currentBatch = currentBatch
        state.sectionedWorkflow.detailedScriptProgress.currentSection = currentSection
        state.sectionedWorkflow.detailedScriptProgress.message = message
      }
    },

    completeDetailedScriptGeneration: (state) => {
      state.sectionedWorkflow.detailedScriptProgress = {
        isActive: false,
        currentBatch: 0,
        totalBatches: 0,
        currentSection: 0,
        totalSections: 0,
        message: ''
      }
    },

    setBatchResults: (state, action: PayloadAction<Array<{ id: string; script: string; wordCount: number; error?: boolean }>>) => {
      const batchResults = action.payload
      
      batchResults.forEach(({ id, script, wordCount, error }) => {
        const section = state.sectionedWorkflow.sections.find(s => s.id === id)
        if (section) {
          section.generatedScript = script
          section.wordCount = wordCount
          section.isGenerating = false
        }
      })
      
      // Update fullScript with all completed sections
      state.sectionedWorkflow.fullScript = state.sectionedWorkflow.sections
        .filter(s => s.generatedScript.trim() && !s.generatedScript.includes('[Error generating content'))
        .sort((a, b) => a.order - b.order)
        .map(s => s.generatedScript)
        .join('\n\n')
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
  updateSectionsProgress,
  setSections,
  updateSection,
  startGeneratingDetailedScript,
  startRegeneratingSection,
  stopRegeneratingSection,
  startGeneratingAllDetailedScripts,
  setAllDetailedScripts,
  setDetailedScript,
  clearSections,
  
  // Style upload actions
  startAnalyzingUploadedStyle,
  setUploadedStyle,
  clearUploadedStyle,
  
  // FullScript actions
  setFullScript,

  // Translation actions
  startTranslation,
  setTranslationResult,
  clearTranslation,
  setTranslationError,

  // CTA configuration actions
  addCTA,
  removeCTA,
  updateCTA,
  setCTAField,
  setCTAEnabled,
  setCTAPlacement,
  setCTAType,

  // Quote configuration actions
  setQuote,
  setQuoteEnabled,
  clearQuote,

  // New actions for batch processing
  startGeneratingBatch,
  startDetailedScriptGeneration,
  updateDetailedScriptProgress,
  completeDetailedScriptGeneration,
  setBatchResults,

  // Workflow navigation actions
  setCurrentStep,
  markStepCompleted,
  resetWorkflowProgress,

  // Outline generation actions
  setOutlineMethod,
  setScriptContent,
  setCustomInformation
} = scriptsSlice.actions

export default scriptsSlice.reducer 