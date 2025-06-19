'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setSectionedWorkflowField,
  startGeneratingSections,
  updateSectionsProgress,
  setSections,
  updateSection,
  startGeneratingDetailedScript,
  setDetailedScript,
  clearSections,
  setFullScript,
  setCTAEnabled,
  setCTAPlacement,
  setCTAType,
  startGeneratingAllDetailedScripts,
  setAllDetailedScripts,
  startGeneratingBatch,
  startDetailedScriptGeneration,
  updateDetailedScriptProgress,
  completeDetailedScriptGeneration,
  setBatchResults,
  startRegeneratingSection,
  stopRegeneratingSection,
  THEME_OPTIONS,
  setQuoteEnabled,
  setQuote,
  addCTA,
  removeCTA,
  updateCTA,
  setCurrentStep,
  markStepCompleted,
  resetWorkflowProgress,
  setOutlineMethod,
  setScriptContent,
  setCustomInformation
} from '../lib/features/scripts/scriptsSlice'
import type { ScriptSection } from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Progress } from './ui/progress'
import { 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Edit, 
  Save, 
  X, 
  Plus,
  Trash2,
  RotateCcw,
  Settings,
  Target,
  Users,
  Zap,
  Lightbulb,
  Languages,
  List,
  Search,
  Megaphone,
  ChevronRight,
  ChevronLeft,
  Upload,
  Palette,
  BookOpen,
  PenTool,
  Globe,
  Info
} from 'lucide-react'
import { ResearchAssistant } from './research-assistant'
import { StyleFileUpload } from './style-file-upload'
import { ScriptTranslator } from './script-translator'

// Stepper component
interface StepperProps {
  steps: string[]
  currentStep: number
  onStepClick: (step: number) => void
}

function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div 
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 cursor-pointer transition-all ${
                index < currentStep 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : index === currentStep
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-gray-200 border-gray-300 text-gray-500'
              }`}
              onClick={() => onStepClick(index)}
            >
              {index < currentStep ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </div>
            <div className="ml-3 text-sm font-medium">
              <div className={index <= currentStep ? 'text-gray-900' : 'text-gray-500'}>
                {step}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ml-4 mr-4 ${
                index < currentStep ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Progress Bar Component
interface ProgressBarProps {
  current: number
  total: number
  message: string
  className?: string
}

function ProgressBar({ current, total, message, className = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{message}</span>
        <span className="text-gray-600">{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{current} of {total}</span>
        <span>{total - current} remaining</span>
      </div>
    </div>
  )
}

// Simple Dialog Component for Prompt Preview
function PromptDialog({ 
  isOpen, 
  onClose, 
  title, 
  prompt 
}: { 
  isOpen: boolean
  onClose: () => void
  title: string
  prompt: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] w-full mx-4 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This is the exact prompt that will be sent to the AI model for generation:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {prompt}
              </pre>
            </div>
          </div>
        </div>
        <div className="flex justify-end p-6 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { sectionedWorkflow, research } = useAppSelector(state => state.scripts)
  
  // Stepper state - now from Redux
  const steps = ['Script Style', 'Configuration', 'Research', 'Outline', 'Generation', 'Translation']
  
  // UI state (keep these as local state since they're temporary UI states)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  
  // Modal state for prompt previews
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalPrompt, setModalPrompt] = useState("")
  
  // Outline generation state - REMOVED: Now handled by Redux
  // const [outlineMethod, setOutlineMethod] = useState<'standard' | 'title-only' | 'script-extractor' | 'custom-info'>('standard')
  // const [scriptContent, setScriptContent] = useState('')
  // const [customInformation, setCustomInformation] = useState('')
  
  // Step completion tracking - REMOVED: Now handled by Redux
  // const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  const handleFieldChange = (field: keyof typeof sectionedWorkflow, value: any) => {
    dispatch(setSectionedWorkflowField({ field, value }))
  }

  const handleStepClick = (step: number) => {
    // Only allow clicking on completed steps or the next step
    if (step <= Math.max(...sectionedWorkflow.completedSteps, -1) + 1) {
      dispatch(setCurrentStep(step))
    }
  }

  const canProceedToNext = () => {
    switch (sectionedWorkflow.currentStep) {
      case 0: // Script Style
        return sectionedWorkflow.selectedStyle || sectionedWorkflow.uploadedStyle
      case 1: // Configuration  
        return sectionedWorkflow.videoTitle.trim()
      case 2: // Research
        return true // Research is optional
      case 3: // Outline
        return sectionedWorkflow.sections.length > 0
      case 4: // Generation
        return sectionedWorkflow.sections.some(s => s.generatedScript.trim())
      case 5: // Translation
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceedToNext()) {
      dispatch(markStepCompleted(sectionedWorkflow.currentStep))
      dispatch(setCurrentStep(Math.min(sectionedWorkflow.currentStep + 1, steps.length - 1)))
    }
  }

  const handlePrevious = () => {
    dispatch(setCurrentStep(Math.max(sectionedWorkflow.currentStep - 1, 0)))
  }

  // Helper function to show script prompt  
  const showOutlinePrompt = () => {
    // Get theme instructions if theme is selected
    const selectedTheme = sectionedWorkflow.themeId ? THEME_OPTIONS.find(t => t.id === sectionedWorkflow.themeId) : null;
    const themeInstructions = selectedTheme ? `
THEMATIC DIRECTION - ${selectedTheme.name}:
Core Approach: ${selectedTheme.instructions.hook}
Desired Tone: ${selectedTheme.instructions.tone}
Communication Style: ${selectedTheme.instructions.clarity}
Narrative Progression: ${selectedTheme.instructions.narrativeFlow}
Content Balance: ${selectedTheme.instructions.balance}
Audience Connection: ${selectedTheme.instructions.engagement}
Structural Guidelines: ${selectedTheme.instructions.format}
Broader Context: ${selectedTheme.instructions.overall}

CRITICAL: These are thematic guidelines for APPROACH and TONE, not literal phrases to repeat. 
- Use the SPIRIT of these instructions, not the exact wording
- Vary your language extensively - never repeat the same phrases across sections
- Focus on authentic human communication that embodies these principles naturally
- If the theme mentions specific phrases, treat them as occasional accent points, not repetitive mantras
` : '';

    // Get active CTAs
    const activeCTAs = sectionedWorkflow.ctas.filter(cta => cta.enabled);
    
    // Calculate sections
    const numSections = Math.max(1, Math.ceil(sectionedWorkflow.wordCount / 800));
    const avgWordsPerSection = Math.round(sectionedWorkflow.wordCount / numSections);

    const promptExample = `You are a master storyteller and researcher creating compelling, authentic video content that sounds like a passionate expert sharing genuine insights. Your goal is to educate and engage through natural human communication, not AI-generated content patterns.

TITLE: "${sectionedWorkflow.videoTitle}"
CURRENT BATCH: Sections 1 to ${numSections} of ${numSections} total sections
BATCH SIZE: ${numSections}

FUNDAMENTAL WRITING PRINCIPLES:
[Style guide content from uploaded style or default feeder_script_style.txt]

THEMATIC DIRECTION:
${themeInstructions}

${sectionedWorkflow.emotionalTone ? `EMOTIONAL APPROACH: ${sectionedWorkflow.emotionalTone}` : ''}
${sectionedWorkflow.targetAudience ? `INTENDED AUDIENCE: ${sectionedWorkflow.targetAudience}` : ''}

${research.analysis ? `
RESEARCH FOUNDATION:
Incorporate these research insights to create authoritative, fact-based content:

Analysis: ${JSON.stringify(research.analysis || {}, null, 2)}
Key Findings: [Research results from your search]

INTEGRATION REQUIREMENTS:
- Weave specific facts, statistics, and insights naturally into the narrative
- Use research to support claims with concrete examples
- Reference current developments and real-world applications
- Build authority through demonstrated knowledge, not dramatic claims
- Make abstract concepts tangible through research-backed examples
` : ''}

${sectionedWorkflow.forbiddenWords ? `LANGUAGE RESTRICTIONS: Completely avoid these terms: ${sectionedWorkflow.forbiddenWords}` : ''}
${sectionedWorkflow.additionalInstructions ? `
ADDITIONAL INSTRUCTIONS:
${sectionedWorkflow.additionalInstructions}
` : ''}

ANTI-AI CONTENT REQUIREMENTS:
- NEVER use repetitive catchphrases or formulaic expressions
- AVOID dramatic declarations like "Your life is a lie" or "They don't want you to know" unless used sparingly and contextually
- ELIMINATE generic, interchangeable language that could apply to any topic
- REJECT artificial excitement or forced urgency
- NEVER repeat the same rhetorical devices or sentence structures across sections
- AVOID lists of vague benefits or empty promises
- CREATE unique, topic-specific insights that demonstrate genuine expertise

NATURAL HUMAN COMMUNICATION STANDARDS:
- Write as if you're a knowledgeable friend sharing fascinating discoveries
- Use varied sentence structures and natural speech patterns
- Include specific, verifiable details and examples
- Show genuine curiosity and intellectual engagement with the topic
- Build arguments through logic and evidence, not repetitive assertions
- Respect your audience's intelligence and critical thinking abilities
- Connect ideas to real-world experiences and practical applications

CONTENT DEPTH REQUIREMENTS:
- Provide specific, actionable insights that viewers can verify or apply
- Explain underlying mechanisms and causalities, not just surface-level claims
- Include historical context, comparative examples, or case studies
- Address complexity and nuance rather than oversimplifying
- Connect individual concepts to broader frameworks or principles
- Offer practical next steps or applications for the information shared

${activeCTAs.length > 0 ? `
CTA INTEGRATION REQUIREMENTS:
${activeCTAs.map((ctaItem, ctaIndex) => {
  let ctaInstructions = '';
  if (ctaItem.type === 'newsletter') {
    ctaInstructions = `IMPORTANT CTA REQUIREMENT: You must incorporate a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube (so they are more likely to sign up). Mention that the viewer will receive a free ebook copy of "The Kybalion" (hermetic book) upon signing up for a limited time only (this is not a reward). The viewer must go to the link in the description and enter their email to receive the e-book. This CTA must be incorporated smoothly and in flow with the script around it and can only be 2 sentences max. It must be short, sharp and concise so that viewers won't click off or skip. The CTA must use persuasive sales writing and sound as if some things can't be shared on YouTube, but you must come up with your own that suits the current section. It must be positioned in a way so viewers cannot afford to lose this opportunity to not sign up. Make sure you seamlessly flow into this CTA from the previous paragraph and into the next.`;
  } else if (ctaItem.type === 'engagement') {
    ctaInstructions = `IMPORTANT CTA REQUIREMENT: You must incorporate this engagement CTA smoothly into the content: "If this video resonated with you, let us know by commenting, 'I understood it.'" This should feel natural and be integrated seamlessly with the surrounding content. Make it feel like a genuine request for engagement rather than a forced call-to-action.`;
  } else if (ctaItem.type === 'custom' && ctaItem.content) {
    ctaInstructions = `IMPORTANT CTA REQUIREMENT: You must incorporate this custom CTA smoothly into the content: "${ctaItem.content}" This should feel natural and be integrated seamlessly with the surrounding content.`;
  }
  
  return `- CTA Type: ${ctaItem.type} (${ctaItem.placement}${ctaItem.customPosition ? ` - Section ${ctaItem.customPosition}` : ''})
${ctaInstructions}
CRITICAL: Integrate the CTA naturally into the content flow - it should feel like a natural extension of the discussion, not an abrupt interruption.`;
}).join('\n\n')}
` : ''}

SECTION DEVELOPMENT SPECIFICATIONS:
Each section must demonstrate expertise through detailed, valuable content. Your writing instructions should specify:

1. AUTHENTIC ENGAGEMENT STRATEGY:
   - How to open with genuine intrigue based on real phenomena or questions
   - Specific rhetorical approaches that feel natural and conversational
   - Ways to maintain interest through substantial content, not manipulation tactics

2. SUBSTANTIVE CONTENT FRAMEWORK:
   - Key concepts, facts, or insights to explore with supporting evidence
   - Specific examples, case studies, or practical applications to include
   - Historical context, comparative analysis, or expert perspectives to reference
   - How to explain complex ideas through relatable analogies or examples

3. NATURAL PROGRESSION TECHNIQUES:
   - How this section builds upon previous content and sets up future sections
   - Logical transitions that maintain narrative coherence
   - Ways to introduce complexity gradually without overwhelming the audience
   - Connection strategies linking individual insights to broader themes

4. AUDIENCE RESPECT INDICATORS:
   - How to challenge assumptions while validating viewers' intelligence
   - Ways to present controversial or complex ideas with appropriate nuance
   - Techniques for inspiring curiosity and further exploration
   - Methods for empowering viewers rather than creating dependency

For each section, provide:
1. A compelling, specific title that captures unique value (not generic clickbait)
2. Comprehensive writing instructions (minimum 200 words) detailing:
   - The authentic intellectual journey viewers should experience
   - Specific content points with supporting evidence and examples from research
   - Natural engagement techniques that respect audience intelligence
   - How this section contributes to the overall educational narrative
   - Smooth transition strategies maintaining conversational flow
   - Special emphasis on depth, nuance, and practical applicability
   - Concrete examples, analogies, or case studies to include
   - Key questions to address or insights to reveal
   - Emotional pacing and tonal shifts throughout the section
   - Specific facts, statistics, or expert perspectives to reference
   - How to connect abstract concepts to tangible experiences
   - Methods for building credibility and trust with the audience
3. A detailed visual prompt describing scenes that complement the educational content

CRITICAL WORD COUNT ENFORCEMENT:
- Include sufficient detail in writing instructions (200 words minimum)
- Better to exceed targets than fall short - aim for substantial, valuable content

${sectionedWorkflow.forbiddenWords ? `FINAL REMINDER: Completely avoid these prohibited terms: ${sectionedWorkflow.forbiddenWords}` : ''}

[Structured output format instructions for generating sections array]`

    setModalTitle('Script Sections Generation Prompt')
    setModalPrompt(promptExample)
    setShowPromptModal(true)
  }

  // Helper function to show detailed script generation prompt
  const showDetailedScriptPrompt = () => {
    // Get theme instructions if theme is selected
    const selectedTheme = sectionedWorkflow.themeId ? THEME_OPTIONS.find(t => t.id === sectionedWorkflow.themeId) : null;
    const themeInstructions = selectedTheme ? `
THEMATIC DIRECTION - ${selectedTheme.name}:
Core Approach: ${selectedTheme.instructions.hook}
Desired Tone: ${selectedTheme.instructions.tone}
Communication Style: ${selectedTheme.instructions.clarity}
Narrative Progression: ${selectedTheme.instructions.narrativeFlow}
Content Balance: ${selectedTheme.instructions.balance}
Audience Connection: ${selectedTheme.instructions.engagement}
Structural Guidelines: ${selectedTheme.instructions.format}
Broader Context: ${selectedTheme.instructions.overall}

CRITICAL: These are thematic guidelines for APPROACH and TONE, not literal phrases to repeat. 
- Use the SPIRIT of these instructions, not the exact wording
- Vary your language extensively - never repeat the same phrases across sections
- Focus on authentic human communication that embodies these principles naturally
- If the theme mentions specific phrases, treat them as occasional accent points, not repetitive mantras
` : '';

    // Get active CTAs
    const activeCTAs = sectionedWorkflow.ctas.filter(cta => cta.enabled);
    
    // Example section for demonstration
    const exampleSection = sectionedWorkflow.sections.length > 0 ? sectionedWorkflow.sections[0] : {
      title: "Example Section Title",
      writingInstructions: "Example writing instructions for this section..."
    };

    const promptExample = `You are a master storyteller and researcher writing section 1 of ${sectionedWorkflow.sections.length || 'X'} for a compelling video script titled "${sectionedWorkflow.videoTitle}". Your goal is to create authentic, expert-level content that sounds like a passionate human sharing genuine insights.

SECTION TITLE: "${exampleSection.title}"
WRITING INSTRUCTIONS: ${exampleSection.writingInstructions}

[CONTEXT FROM PREVIOUS SECTIONS would appear here for sections 2+]

FUNDAMENTAL WRITING PRINCIPLES:
[Style guide content from uploaded style or default feeder_script_style.txt]

THEMATIC DIRECTION:
${themeInstructions}

${sectionedWorkflow.emotionalTone ? `EMOTIONAL APPROACH: Ensure content matches this tone: ${sectionedWorkflow.emotionalTone}` : ''}
${sectionedWorkflow.targetAudience ? `INTENDED AUDIENCE: Write specifically for: ${sectionedWorkflow.targetAudience}` : ''}
${sectionedWorkflow.forbiddenWords ? `LANGUAGE RESTRICTIONS: Completely avoid these terms: ${sectionedWorkflow.forbiddenWords}` : ''}

${research.analysis ? `
RESEARCH FOUNDATION:
Use insights from this research to create authoritative, fact-based content:
${JSON.stringify(research.analysis, null, 2).substring(0, 1000)}...

INTEGRATION REQUIREMENTS:
- Weave specific facts, statistics, and insights naturally into the narrative
- Use research to support claims with concrete examples
- Reference current developments and real-world applications
- Build authority through demonstrated knowledge, not dramatic claims
` : ''}

${activeCTAs.length > 0 ? `
CTA REQUIREMENTS FOR THIS SECTION:
${activeCTAs.map((ctaItem) => {
  let ctaContent = '';
  if (ctaItem.type === 'newsletter') {
    ctaContent = `Include a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube. Mention that the viewer will receive a free ebook copy of "The Kybalion" upon signing up for a limited time only. The CTA must be incorporated smoothly and naturally into the content flow and can only be 2 sentences max. Make it persuasive and create urgency.`;
  } else if (ctaItem.type === 'engagement') {
    ctaContent = `Include this engagement CTA naturally: "If this video resonated with you, let us know by commenting, 'I understood it.'" Integrate it seamlessly with the surrounding content.`;
  } else if (ctaItem.type === 'custom' && ctaItem.content) {
    ctaContent = `Include this custom CTA naturally: ${ctaItem.content}`;
  }
  return ctaContent;
}).filter(Boolean).join('\n')}

CRITICAL: CTAs must be integrated naturally into the content flow. Do NOT use transition phrases like "[TRANSITION TO CTA]" or similar - these will be spoken by the voice-over. Instead, make the CTA feel like a natural part of the narrative. Bold or emphasize the CTA content for visual distinction.
` : ''}

ANTI-AI CONTENT REQUIREMENTS:
- NEVER use repetitive catchphrases or formulaic expressions
- AVOID dramatic declarations like "Your life is a lie" or "They don't want you to know" unless used sparingly and contextually
- ELIMINATE generic, interchangeable language that could apply to any topic
- REJECT artificial excitement or forced urgency
- NEVER repeat the same rhetorical devices or sentence structures
- AVOID lists of vague benefits or empty promises
- CREATE unique, topic-specific insights that demonstrate genuine expertise

NATURAL HUMAN COMMUNICATION STANDARDS:
- Write as if you're a knowledgeable friend sharing fascinating discoveries
- Use varied sentence structures and natural speech patterns
- Include specific, verifiable details and examples
- Show genuine curiosity and intellectual engagement with the topic
- Build arguments through logic and evidence, not repetitive assertions
- Respect your audience's intelligence and critical thinking abilities
- Connect ideas to real-world experiences and practical applications

CONTENT DEPTH REQUIREMENTS:
- Provide specific, actionable insights that viewers can verify or apply
- Explain underlying mechanisms and causalities, not just surface-level claims
- Include historical context, comparative examples, or case studies
- Address complexity and nuance rather than oversimplifying
- Connect individual concepts to broader frameworks or principles
- Offer practical next steps or applications for the information shared

CRITICAL WRITING REQUIREMENTS:
- Write ONLY the script content for this section - no stage directions, titles, or meta-commentary
- Create content that sounds natural and authentic when spoken aloud
- Use specific examples, case studies, or relatable scenarios to illustrate points
- Vary sentence structure and length extensively to create natural rhythm
- Build arguments through logical progression and evidence, not shock tactics
- Include genuine insights that provide real educational value
- If including CTAs, make them **bold** but integrate naturally into the narrative flow
- Balance direct address ("you") with inclusive language ("we") appropriately
- Build on previous sections naturally (this is section 1 of ${sectionedWorkflow.sections.length || 'X'})
${sectionedWorkflow.emotionalTone ? `- Maintain the ${sectionedWorkflow.emotionalTone} emotional tone throughout while remaining authentic` : ''}
${sectionedWorkflow.targetAudience ? `- Speak directly to ${sectionedWorkflow.targetAudience} with relevant examples and appropriate language` : ''}

CRITICAL WORD COUNT REQUIREMENTS:
- This section should be AT LEAST 500 words minimum
- Target approximately 700-900 words for optimal depth and engagement
- If your initial draft is under 500 words, expand with additional examples, case studies, or deeper explanations
- Better to exceed the target than fall significantly short
- Focus on providing substantial value rather than reaching a word count through filler

QUALITY VERIFICATION:
Before finalizing, ensure your content:
- Sounds like a knowledgeable human expert, not an AI
- Provides specific, verifiable information unique to this topic
- Uses completely varied language with no repeated phrases or structures
- Builds trust through transparency and demonstrated expertise
- Educates and empowers rather than manipulates or overwhelms
- Maintains conversational authenticity while delivering substantial value

${sectionedWorkflow.forbiddenWords ? `FINAL REMINDER: Completely avoid these prohibited terms: ${sectionedWorkflow.forbiddenWords}` : ''}

Write the authentic, expert-level script content now:`

    setModalTitle('Detailed Script Generation Prompt')
    setModalPrompt(promptExample)
    setShowPromptModal(true)
  }

  // Step 1: Script Style
  const renderScriptStyleStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Choose Your Script Style
        </CardTitle>
        <CardDescription>
          Select from proven writing styles or upload/paste your own reference script
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Intimate Philosophical Narrative Style */}
          <Card className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${
            sectionedWorkflow.selectedStyle === 'intimate-philosophical' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}>
            <CardContent className="p-6 text-center space-y-4">
              <Lightbulb className="h-12 w-12 mx-auto text-purple-500" />
              <div>
                <h3 className="font-semibold text-lg">Intimate Philosophical</h3>
                <p className="text-sm text-gray-600">
                  Conversational yet profound tone with deep psychological insights and therapeutic guidance
                </p>
              </div>
              <Button 
                variant={sectionedWorkflow.selectedStyle === 'intimate-philosophical' ? "default" : "outline"}
                onClick={() => {
                  handleFieldChange('selectedStyle', 'intimate-philosophical')
                  handleFieldChange('uploadedStyle', null)
                  handleFieldChange('uploadedStyleFileName', null)
                }}
                className="w-full"
              >
                {sectionedWorkflow.selectedStyle === 'intimate-philosophical' ? 'Selected' : 'Select Style'}
              </Button>
            </CardContent>
          </Card>

          {/* Breaking Free Persuasive Style */}
          <Card className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${
            sectionedWorkflow.selectedStyle === 'breaking-free' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}>
            <CardContent className="p-6 text-center space-y-4">
              <Zap className="h-12 w-12 mx-auto text-orange-500" />
              <div>
                <h3 className="font-semibold text-lg">Breaking Free</h3>
                <p className="text-sm text-gray-600">
                  Direct, persuasive monologue style that challenges beliefs and creates paradigm shifts
                </p>
              </div>
              <Button 
                variant={sectionedWorkflow.selectedStyle === 'breaking-free' ? "default" : "outline"}
                onClick={() => {
                  handleFieldChange('selectedStyle', 'breaking-free')
                  handleFieldChange('uploadedStyle', null)
                  handleFieldChange('uploadedStyleFileName', null)
                }}
                className="w-full"
              >
                {sectionedWorkflow.selectedStyle === 'breaking-free' ? 'Selected' : 'Select Style'}
              </Button>
            </CardContent>
          </Card>

          {/* Upload/Paste Reference Script */}
          <Card className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${
            sectionedWorkflow.uploadedStyle ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-300'
          }`}>
            <CardContent className="p-6 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-green-500" />
              <div>
                <h3 className="font-semibold text-lg">Custom Reference</h3>
                <p className="text-sm text-gray-600">
                  Upload a file or paste your own script to match your unique writing style
                </p>
              </div>
              <StyleFileUpload />
            </CardContent>
          </Card>
        </div>

        {/* Style Preview */}
        {sectionedWorkflow.selectedStyle === 'intimate-philosophical' && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-800">Intimate Philosophical Narrative Style</span>
            </div>
            <div className="text-sm text-purple-700 space-y-2">
              <p><strong>Key Features:</strong> Conversational wisdom, gentle authority, thoughtful pacing, emotional intelligence</p>
              <p><strong>Best For:</strong> Self-help content, philosophical discussions, psychological insights, personal development</p>
              <div className="mt-3 p-3 bg-white border border-purple-100 rounded text-xs italic">
                <strong>Example:</strong> "Have you ever noticed how some of your strongest beliefs about success came from people who never achieved what you're trying to build? It's not their fault—we all inherit ideas from our environment. But recognizing this pattern is the first step toward thinking for yourself."
              </div>
            </div>
          </div>
        )}

        {sectionedWorkflow.selectedStyle === 'breaking-free' && (
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-orange-800">Breaking Free Persuasive Style</span>
            </div>
            <div className="text-sm text-orange-700 space-y-2">
              <p><strong>Key Features:</strong> Confident revelation, controlled intensity, evidence-based persuasion, empowering direction</p>
              <p><strong>Best For:</strong> Challenging conventional thinking, paradigm shift topics, awareness content, empowerment</p>
              <div className="mt-3 p-3 bg-white border border-orange-100 rounded text-xs italic">
                <strong>Example:</strong> "Think about the last time you made a major life decision. How many of the factors you considered—what success looks like, what others would think, what's 'realistic'—actually came from your own experience versus what you absorbed from family, media, and culture? Most of us are living by rules we never consciously chose."
              </div>
            </div>
          </div>
        )}

        {sectionedWorkflow.uploadedStyle && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Custom style reference uploaded!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Your scripts will match the style and tone of your reference content.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Step 2: Configuration
  const renderConfigurationStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Script Configuration
        </CardTitle>
        <CardDescription>
          Configure your script parameters and settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title *</Label>
                <Input
                  id="video-title"
                  value={sectionedWorkflow.videoTitle}
                  onChange={(e) => handleFieldChange('videoTitle', e.target.value)}
                  placeholder="Enter your video title..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="word-count">Target Word Count *</Label>
                <Input
                  id="word-count"
                  type="number"
                  value={sectionedWorkflow.wordCount}
                  onChange={(e) => handleFieldChange('wordCount', parseInt(e.target.value) || 0)}
                  placeholder="e.g., 2000"
                  min="100"
                  max="10000"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience (Optional)</Label>
                <Input
                  id="target-audience"
                  value={sectionedWorkflow.targetAudience}
                  onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
                  placeholder="e.g., Young professionals, entrepreneurs..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emotional-tone">Emotional Tone</Label>
                <Input
                  id="emotional-tone"
                  value={sectionedWorkflow.emotionalTone}
                  onChange={(e) => handleFieldChange('emotionalTone', e.target.value)}
                  placeholder="e.g., Urgent, inspiring, mysterious..."
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme (Optional)</Label>
              <Select
                value={sectionedWorkflow.themeId || "none"}
                onValueChange={(value) => handleFieldChange('themeId', value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No theme</SelectItem>
                  {THEME_OPTIONS.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sectionedWorkflow.themeId && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {THEME_OPTIONS.find(t => t.id === sectionedWorkflow.themeId)?.description}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-instructions">Additional Instructions</Label>
              <Textarea
                id="additional-instructions"
                value={sectionedWorkflow.additionalInstructions}
                onChange={(e) => handleFieldChange('additionalInstructions', e.target.value)}
                placeholder="Any specific instructions for the script..."
                rows={3}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forbidden-words">Forbidden Words (comma-separated)</Label>
              <Input
                id="forbidden-words"
                value={sectionedWorkflow.forbiddenWords}
                onChange={(e) => handleFieldChange('forbiddenWords', e.target.value)}
                placeholder="e.g., amazing, incredible, awesome..."
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ai-model">AI Model</Label>
                <Select
                  value={sectionedWorkflow.selectedModel}
                  onValueChange={(value) => handleFieldChange('selectedModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI model..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (Ultra Fast)</SelectItem>
                    <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (Fast)</SelectItem>
                    <SelectItem value="gpt-4.1">GPT-4.1 (Balanced)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Balanced)</SelectItem>
                    
                    <SelectItem value="claude-3-5-haiku-20241022">Claude Haiku 3.5</SelectItem>
                    <SelectItem value="claude-3-5-sonnet-20241022">Claude Sonnet 3.5</SelectItem>
                    <SelectItem value="claude-3-7-sonnet-20250219">Claude Sonnet 3.7</SelectItem>
                    <SelectItem value="claude-opus-4-20250514">Claude Opus 4</SelectItem>
                    <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Quote Configuration
            </CardTitle>
            <CardDescription>
              Add an AI-generated inspiring quote at the beginning of your script
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="quote-enabled"
                checked={sectionedWorkflow.quote.enabled}
                onChange={(e) => dispatch(setQuoteEnabled(e.target.checked))}
                className="rounded"
              />
              <Label htmlFor="quote-enabled">Auto-generate a relevant quote at the beginning of script</Label>
            </div>

            {sectionedWorkflow.quote.enabled && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <p>✨ <strong>Auto-Generated Quote Feature Enabled</strong></p>
                  <p>A relevant, profound quote from an authority figure will be automatically generated and placed at the top of your script based on the content and theme.</p>
                  <p className="mt-2 text-blue-600">💡 The quote will be sourced from experts, historical figures, or thought leaders relevant to your script's subject matter.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Call-to-Action (CTA) Configuration
            </CardTitle>
            <CardDescription>
              Configure multiple CTAs to include in your script
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>CTAs</Label>
              <div className="space-x-2">
                <Button
                  onClick={() => {
                    // Add both newsletter and engagement CTAs
                    dispatch(addCTA({
                      id: `cta-newsletter-${Date.now()}`,
                      type: 'newsletter',
                      placement: 'middle',
                      enabled: true
                    }));
                    dispatch(addCTA({
                      id: `cta-engagement-${Date.now()}`,
                      type: 'engagement',
                      placement: 'end',
                      enabled: true
                    }));
                  }}
                  size="sm"
                  variant="outline"
                  className="text-blue-600"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Add Default CTAs
                </Button>
                <Button
                  onClick={() => {
                    const newCTA = {
                      id: `cta-${Date.now()}`,
                      type: 'newsletter' as const,
                      placement: 'end' as const,
                      enabled: true
                    };
                    dispatch(addCTA(newCTA));
                  }}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add CTA
                </Button>
              </div>
            </div>

            {sectionedWorkflow.ctas.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No CTAs configured. Click "Add CTA" to get started.</p>
                <div className="mt-4 space-x-2">
                  <Button
                    onClick={() => {
                      dispatch(addCTA({
                        id: `cta-newsletter-${Date.now()}`,
                        type: 'newsletter',
                        placement: 'middle',
                        enabled: true
                      }));
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Add Newsletter CTA
                  </Button>
                  <Button
                    onClick={() => {
                      dispatch(addCTA({
                        id: `cta-engagement-${Date.now()}`,
                        type: 'engagement',
                        placement: 'end',
                        enabled: true
                      }));
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Add Engagement CTA
                  </Button>
                </div>
              </div>
            )}

            {sectionedWorkflow.ctas.map((cta, index) => (
              <div key={cta.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">CTA #{index + 1}</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cta.enabled}
                      onChange={(e) => dispatch(setCTAEnabled({ id: cta.id, enabled: e.target.checked }))}
                      className="rounded"
                    />
                    <Button
                      onClick={() => dispatch(removeCTA(cta.id))}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {cta.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CTA Type</Label>
                      <Select
                        value={cta.type}
                        onValueChange={(value) => dispatch(setCTAType({ 
                          id: cta.id, 
                          type: value as 'newsletter' | 'engagement' | 'custom' 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newsletter">Newsletter Signup</SelectItem>
                          <SelectItem value="engagement">Engagement (Like/Subscribe)</SelectItem>
                          <SelectItem value="custom">Custom CTA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>CTA Placement</Label>
                      <Select
                        value={cta.placement}
                        onValueChange={(value) => dispatch(setCTAPlacement({ 
                          id: cta.id, 
                          placement: value as 'beginning' | 'middle' | 'end' | 'custom' 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginning">Beginning</SelectItem>
                          <SelectItem value="middle">Middle</SelectItem>
                          <SelectItem value="end">End</SelectItem>
                          <SelectItem value="custom">Custom Position</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {cta.placement === 'custom' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Custom Position (Section Number)</Label>
                        <Input
                          type="number"
                          value={cta.customPosition || 1}
                          onChange={(e) => dispatch(updateCTA({ 
                            id: cta.id, 
                            updates: { customPosition: parseInt(e.target.value) || 1 } 
                          }))}
                          min="1"
                          placeholder="Section number..."
                          className="w-full"
                        />
                      </div>
                    )}

                    {cta.type === 'custom' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Custom CTA Content</Label>
                        <Textarea
                          value={cta.content || ''}
                          onChange={(e) => dispatch(updateCTA({ 
                            id: cta.id, 
                            updates: { content: e.target.value } 
                          }))}
                          placeholder="Enter your custom CTA text..."
                          rows={2}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )

  // Step 3: Research
  const renderResearchStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research Phase
          </CardTitle>
          <CardDescription>
            Gather insights and information to enhance your script content (Optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold">Research Your Topic</h3>
              <p className="text-gray-600">
                Use our research assistant to gather relevant information about your video topic.
                This will help create more informative and engaging script content.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ResearchAssistant />
    </div>
  )

  // Generate detailed script for a single section
  const handleGenerateDetailedScript = async (sectionId: string) => {
    const section = sectionedWorkflow.sections.find(s => s.id === sectionId)
    if (!section) {
      showMessage('Section not found', 'error')
      return
    }

    dispatch(startGeneratingDetailedScript(sectionId))

    try {
      // Determine the style to use
      let styleToUse = sectionedWorkflow.uploadedStyle

      // If no uploaded style but a selected style, use predefined style content
      if (!styleToUse && sectionedWorkflow.selectedStyle) {
        if (sectionedWorkflow.selectedStyle === 'intimate-philosophical') {
          styleToUse = `INTIMATE PHILOSOPHICAL NARRATIVE - ADVANCED STYLE GUIDE

CORE WRITING PHILOSOPHY:
Write as if you're having a deep, meaningful conversation with someone you care about. Your goal is to guide them toward profound insights through gentle revelation, not forceful persuasion. Think of yourself as a wise friend who sees patterns others miss.

VOICE & TONE PRINCIPLES:
- Conversational wisdom: Speak like someone who has lived, learned, and wants to share insights
- Gentle authority: Confident without being preachy, knowing without being condescending  
- Intimate connection: Write as if speaking to one person, not a crowd
- Thoughtful pacing: Allow ideas to breathe and develop naturally
- Emotional intelligence: Acknowledge the complexity of human experience

STRUCTURAL APPROACH:
- Begin with relatable observations that most people recognize but haven't deeply considered
- Layer insights progressively, building from simple to profound
- Use personal examples and universal experiences as bridges to deeper concepts
- Create "aha moments" through careful revelation rather than shock
- End sections with insights that linger and invite reflection

LANGUAGE PATTERNS:
- Favor flowing, natural sentences over choppy declarations
- Use "you" to create intimacy, but balance with "we" to show shared humanity
- Employ metaphors that illuminate rather than confuse
- Ask questions that genuinely invite reflection, not just rhetorical effect
- Vary sentence length and rhythm to create natural speech patterns

CONTENT DEPTH:
- Draw from psychology, philosophy, and human nature without being academic
- Include specific, relatable examples that readers can connect to their own lives
- Explore the "why" behind behaviors and patterns, not just the "what"
- Address both the problem and the path forward with equal care
- Weave in hope and possibility alongside difficult truths

WHAT TO AVOID:
- Repetitive catchphrases or formulaic language
- Overly dramatic declarations that sound artificial
- Preaching or talking down to the reader
- Generic self-help clichés
- Forcing profundity where simplicity would serve better

EXAMPLE APPROACH:
Instead of: "Your life is a lie and they've been programming you"
Try: "Have you ever noticed how some of your strongest beliefs about success came from people who never achieved what you're trying to build? It's not their fault—we all inherit ideas from our environment. But recognizing this pattern is the first step toward thinking for yourself."

This style works best for content that helps people understand themselves, their relationships, and their place in the world through gentle insight rather than dramatic revelation.`
        } else if (sectionedWorkflow.selectedStyle === 'breaking-free') {
          styleToUse = `BREAKING FREE PERSUASIVE STYLE - ADVANCED GUIDE

CORE WRITING PHILOSOPHY:
Write with the urgency of someone who has discovered something important and feels compelled to share it. Your goal is to awaken awareness through compelling evidence and logical progression, not through repetitive shock tactics.

VOICE & TONE PRINCIPLES:
- Confident revelation: Speak with the authority of someone who has done the research
- Controlled intensity: Passionate but not frantic, urgent but not panicked
- Respectful challenge: Question beliefs without attacking the person holding them
- Evidence-based persuasion: Build cases through examples and logic, not just assertions
- Empowering direction: Always point toward solutions and personal agency

STRUCTURAL APPROACH:
- Open with a compelling observation or question that challenges conventional thinking
- Present evidence through varied examples and logical progression
- Build momentum through layered revelations, each more significant than the last
- Address counterarguments and common objections naturally
- Conclude with clear, actionable insights that empower the reader

LANGUAGE PATTERNS:
- Use direct, clear language that cuts through confusion
- Employ rhetorical questions strategically, not constantly
- Vary your evidence sources: personal examples, historical patterns, current events
- Create natural transitions between ideas without forced drama
- Balance "you" statements with broader observations about society and systems

CONTENT DEPTH:
- Focus on patterns and systems rather than individual villains
- Provide specific, verifiable examples that readers can investigate themselves
- Explain the "how" and "why" behind the patterns you're revealing
- Connect individual experiences to larger systemic issues
- Offer practical steps for breaking free from limiting patterns

PERSUASION TECHNIQUES:
- Start with points most people can agree with, then build toward more challenging ideas
- Use analogies that make complex systems understandable
- Acknowledge the difficulty of change while emphasizing its possibility
- Validate the reader's experiences and frustrations
- Present alternative perspectives as empowering choices, not just criticisms

WHAT TO AVOID:
- Overusing dramatic phrases like "Your life is a lie" or "The truth they don't want you to know"
- Repetitive enemy language that becomes predictable
- Vague accusations without specific examples
- Conspiracy thinking that lacks nuance
- Leaving readers feeling hopeless or powerless

EXAMPLE APPROACH:
Instead of: "Your life is a lie. They've been programming your mind since birth."
Try: "Think about the last time you made a major life decision. How many of the factors you considered—what success looks like, what others would think, what's 'realistic'—actually came from your own experience versus what you absorbed from family, media, and culture? Most of us are living by rules we never consciously chose."

This style works best for content that challenges conventional thinking while providing clear paths toward greater personal freedom and authentic choice.`
        }
      }

      const response = await fetch('/api/generate-detailed-script', {
            method: 'POST',
        headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
          sections: [section],
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          targetAudience: sectionedWorkflow.targetAudience,
          forbiddenWords: sectionedWorkflow.forbiddenWords,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: styleToUse,
          themeId: sectionedWorkflow.themeId,
          cta: sectionedWorkflow.ctas,
          quote: sectionedWorkflow.quote.enabled ? sectionedWorkflow.quote : null,
          researchData: research.analysis ? { analysis: research.analysis, searchResults: research.searchResults } : null,
          generateQuote: sectionedWorkflow.quote.enabled
        }),
          })

          if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate detailed script')
          }

          const data = await response.json()
          
      if (data.detailedSections && data.detailedSections.length > 0) {
        const detailedSection = data.detailedSections[0]
      dispatch(setDetailedScript({
          sectionId: sectionId,
          script: detailedSection.detailedContent,
          wordCount: detailedSection.wordCount
        }))
        showMessage('Script generated successfully!', 'success')
        dispatch(markStepCompleted(4))
      }

        } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate script: ${errorMessage}`, 'error')
      // Stop the loading state
      const section = sectionedWorkflow.sections.find(s => s.id === sectionId)
      if (section) {
        dispatch(updateSection({ id: sectionId, field: 'isGenerating', value: false }))
      }
    }
  }

  // Generate detailed scripts for all sections
  const handleGenerateAllScripts = async () => {
    if (sectionedWorkflow.sections.length === 0) {
      showMessage('No sections available to generate scripts', 'error')
      return
    }

    dispatch(startGeneratingAllDetailedScripts())
    dispatch(startDetailedScriptGeneration({
      totalBatches: 1,
      totalSections: sectionedWorkflow.sections.length
    }))

    try {
      // Determine the style to use
      let styleToUse = sectionedWorkflow.uploadedStyle

      // If no uploaded style but a selected style, use predefined style content
      if (!styleToUse && sectionedWorkflow.selectedStyle) {
        if (sectionedWorkflow.selectedStyle === 'intimate-philosophical') {
          styleToUse = `INTIMATE PHILOSOPHICAL NARRATIVE - ADVANCED STYLE GUIDE

CORE WRITING PHILOSOPHY:
Write as if you're having a deep, meaningful conversation with someone you care about. Your goal is to guide them toward profound insights through gentle revelation, not forceful persuasion. Think of yourself as a wise friend who sees patterns others miss.

VOICE & TONE PRINCIPLES:
- Conversational wisdom: Speak like someone who has lived, learned, and wants to share insights
- Gentle authority: Confident without being preachy, knowing without being condescending  
- Intimate connection: Write as if speaking to one person, not a crowd
- Thoughtful pacing: Allow ideas to breathe and develop naturally
- Emotional intelligence: Acknowledge the complexity of human experience

STRUCTURAL APPROACH:
- Begin with relatable observations that most people recognize but haven't deeply considered
- Layer insights progressively, building from simple to profound
- Use personal examples and universal experiences as bridges to deeper concepts
- Create "aha moments" through careful revelation rather than shock
- End sections with insights that linger and invite reflection

LANGUAGE PATTERNS:
- Favor flowing, natural sentences over choppy declarations
- Use "you" to create intimacy, but balance with "we" to show shared humanity
- Employ metaphors that illuminate rather than confuse
- Ask questions that genuinely invite reflection, not just rhetorical effect
- Vary sentence length and rhythm to create natural speech patterns

CONTENT DEPTH:
- Draw from psychology, philosophy, and human nature without being academic
- Include specific, relatable examples that readers can connect to their own lives
- Explore the "why" behind behaviors and patterns, not just the "what"
- Address both the problem and the path forward with equal care
- Weave in hope and possibility alongside difficult truths

WHAT TO AVOID:
- Repetitive catchphrases or formulaic language
- Overly dramatic declarations that sound artificial
- Preaching or talking down to the reader
- Generic self-help clichés
- Forcing profundity where simplicity would serve better

EXAMPLE APPROACH:
Instead of: "Your life is a lie and they've been programming you"
Try: "Have you ever noticed how some of your strongest beliefs about success came from people who never achieved what you're trying to build? It's not their fault—we all inherit ideas from our environment. But recognizing this pattern is the first step toward thinking for yourself."

This style works best for content that helps people understand themselves, their relationships, and their place in the world through gentle insight rather than dramatic revelation.`
        } else if (sectionedWorkflow.selectedStyle === 'breaking-free') {
          styleToUse = `BREAKING FREE PERSUASIVE STYLE - ADVANCED GUIDE

CORE WRITING PHILOSOPHY:
Write with the urgency of someone who has discovered something important and feels compelled to share it. Your goal is to awaken awareness through compelling evidence and logical progression, not through repetitive shock tactics.

VOICE & TONE PRINCIPLES:
- Confident revelation: Speak with the authority of someone who has done the research
- Controlled intensity: Passionate but not frantic, urgent but not panicked
- Respectful challenge: Question beliefs without attacking the person holding them
- Evidence-based persuasion: Build cases through examples and logic, not just assertions
- Empowering direction: Always point toward solutions and personal agency

STRUCTURAL APPROACH:
- Open with a compelling observation or question that challenges conventional thinking
- Present evidence through varied examples and logical progression
- Build momentum through layered revelations, each more significant than the last
- Address counterarguments and common objections naturally
- Conclude with clear, actionable insights that empower the reader

LANGUAGE PATTERNS:
- Use direct, clear language that cuts through confusion
- Employ rhetorical questions strategically, not constantly
- Vary your evidence sources: personal examples, historical patterns, current events
- Create natural transitions between ideas without forced drama
- Balance "you" statements with broader observations about society and systems

CONTENT DEPTH:
- Focus on patterns and systems rather than individual villains
- Provide specific, verifiable examples that readers can investigate themselves
- Explain the "how" and "why" behind the patterns you're revealing
- Connect individual experiences to larger systemic issues
- Offer practical steps for breaking free from limiting patterns

PERSUASION TECHNIQUES:
- Start with points most people can agree with, then build toward more challenging ideas
- Use analogies that make complex systems understandable
- Acknowledge the difficulty of change while emphasizing its possibility
- Validate the reader's experiences and frustrations
- Present alternative perspectives as empowering choices, not just criticisms

WHAT TO AVOID:
- Overusing dramatic phrases like "Your life is a lie" or "The truth they don't want you to know"
- Repetitive enemy language that becomes predictable
- Vague accusations without specific examples
- Conspiracy thinking that lacks nuance
- Leaving readers feeling hopeless or powerless

EXAMPLE APPROACH:
Instead of: "Your life is a lie. They've been programming your mind since birth."
Try: "Think about the last time you made a major life decision. How many of the factors you considered—what success looks like, what others would think, what's 'realistic'—actually came from your own experience versus what you absorbed from family, media, and culture? Most of us are living by rules we never consciously chose."

This style works best for content that challenges conventional thinking while providing clear paths toward greater personal freedom and authentic choice.`
        }
      }

      const response = await fetch('/api/generate-detailed-script', {
              method: 'POST',
        headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
          sections: sectionedWorkflow.sections,
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          targetAudience: sectionedWorkflow.targetAudience,
          forbiddenWords: sectionedWorkflow.forbiddenWords,
          selectedModel: sectionedWorkflow.selectedModel,
          uploadedStyle: styleToUse,
          themeId: sectionedWorkflow.themeId,
          cta: sectionedWorkflow.ctas,
          quote: sectionedWorkflow.quote.enabled ? sectionedWorkflow.quote : null,
          researchData: research.analysis ? { analysis: research.analysis, searchResults: research.searchResults } : null,
          generateQuote: sectionedWorkflow.quote.enabled
        }),
            })

            if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate detailed scripts')
            }

            const data = await response.json()
            
      if (data.detailedSections && data.detailedSections.length > 0) {
        const scriptResults = data.detailedSections.map((section: any) => ({
            id: section.id,
          script: section.detailedContent,
          wordCount: section.wordCount,
          error: section.error || false
        }))
        
        dispatch(setAllDetailedScripts(scriptResults))
        dispatch(completeDetailedScriptGeneration())
        
        const successCount = scriptResults.filter((s: any) => !s.error).length
        showMessage(`Generated ${successCount}/${scriptResults.length} scripts successfully!`, 'success')
        dispatch(markStepCompleted(4))
      }

    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Failed to generate scripts: ${errorMessage}`, 'error')
      dispatch(completeDetailedScriptGeneration())
      // Reset all section loading states
      sectionedWorkflow.sections.forEach(section => {
        dispatch(updateSection({ id: section.id, field: 'isGenerating', value: false }))
      })
    }
  }

  // Step 4: Script Outline
  const renderOutlineStep = () => {
    const handleGenerateOutline = async (method: string) => {
      if (!sectionedWorkflow.videoTitle.trim()) {
        showMessage('Please enter a video title', 'error')
      return
    }

      // Determine the style to use first
      let styleToUse = sectionedWorkflow.uploadedStyle
      if (!styleToUse && sectionedWorkflow.selectedStyle) {
        if (sectionedWorkflow.selectedStyle === 'intimate-philosophical') {
          styleToUse = `INTIMATE PHILOSOPHICAL NARRATIVE - ADVANCED STYLE GUIDE

CORE WRITING PHILOSOPHY:
Write as if you're having a deep, meaningful conversation with someone you care about. Your goal is to guide them toward profound insights through gentle revelation, not forceful persuasion. Think of yourself as a wise friend who sees patterns others miss.

VOICE & TONE PRINCIPLES:
- Conversational wisdom: Speak like someone who has lived, learned, and wants to share insights
- Gentle authority: Confident without being preachy, knowing without being condescending  
- Intimate connection: Write as if speaking to one person, not a crowd
- Thoughtful pacing: Allow ideas to breathe and develop naturally
- Emotional intelligence: Acknowledge the complexity of human experience

STRUCTURAL APPROACH:
- Begin with relatable observations that most people recognize but haven't deeply considered
- Layer insights progressively, building from simple to profound
- Use personal examples and universal experiences as bridges to deeper concepts
- Create "aha moments" through careful revelation rather than shock
- End sections with insights that linger and invite reflection

LANGUAGE PATTERNS:
- Favor flowing, natural sentences over choppy declarations
- Use "you" to create intimacy, but balance with "we" to show shared humanity
- Employ metaphors that illuminate rather than confuse
- Ask questions that genuinely invite reflection, not just rhetorical effect
- Vary sentence length and rhythm to create natural speech patterns

CONTENT DEPTH:
- Draw from psychology, philosophy, and human nature without being academic
- Include specific, relatable examples that readers can connect to their own lives
- Explore the "why" behind behaviors and patterns, not just the "what"
- Address both the problem and the path forward with equal care
- Weave in hope and possibility alongside difficult truths

WHAT TO AVOID:
- Repetitive catchphrases or formulaic language
- Overly dramatic declarations that sound artificial
- Preaching or talking down to the reader
- Generic self-help clichés
- Forcing profundity where simplicity would serve better

EXAMPLE APPROACH:
Instead of: "Your life is a lie and they've been programming you"
Try: "Have you ever noticed how some of your strongest beliefs about success came from people who never achieved what you're trying to build? It's not their fault—we all inherit ideas from our environment. But recognizing this pattern is the first step toward thinking for yourself."

This style works best for content that helps people understand themselves, their relationships, and their place in the world through gentle insight rather than dramatic revelation.`
        } else if (sectionedWorkflow.selectedStyle === 'breaking-free') {
          styleToUse = `BREAKING FREE PERSUASIVE STYLE - ADVANCED GUIDE

CORE WRITING PHILOSOPHY:
Write with the urgency of someone who has discovered something important and feels compelled to share it. Your goal is to awaken awareness through compelling evidence and logical progression, not through repetitive shock tactics.

VOICE & TONE PRINCIPLES:
- Confident revelation: Speak with the authority of someone who has done the research
- Controlled intensity: Passionate but not frantic, urgent but not panicked
- Respectful challenge: Question beliefs without attacking the person holding them
- Evidence-based persuasion: Build cases through examples and logic, not just assertions
- Empowering direction: Always point toward solutions and personal agency

STRUCTURAL APPROACH:
- Open with a compelling observation or question that challenges conventional thinking
- Present evidence through varied examples and logical progression
- Build momentum through layered revelations, each more significant than the last
- Address counterarguments and common objections naturally
- Conclude with clear, actionable insights that empower the reader

LANGUAGE PATTERNS:
- Use direct, clear language that cuts through confusion
- Employ rhetorical questions strategically, not constantly
- Vary your evidence sources: personal examples, historical patterns, current events
- Create natural transitions between ideas without forced drama
- Balance "you" statements with broader observations about society and systems

CONTENT DEPTH:
- Focus on patterns and systems rather than individual villains
- Provide specific, verifiable examples that readers can investigate themselves
- Explain the "how" and "why" behind the patterns you're revealing
- Connect individual experiences to larger systemic issues
- Offer practical steps for breaking free from limiting patterns

PERSUASION TECHNIQUES:
- Start with points most people can agree with, then build toward more challenging ideas
- Use analogies that make complex systems understandable
- Acknowledge the difficulty of change while emphasizing its possibility
- Validate the reader's experiences and frustrations
- Present alternative perspectives as empowering choices, not just criticisms

WHAT TO AVOID:
- Overusing dramatic phrases like "Your life is a lie" or "The truth they don't want you to know"
- Repetitive enemy language that becomes predictable
- Vague accusations without specific examples
- Conspiracy thinking that lacks nuance
- Leaving readers feeling hopeless or powerless

EXAMPLE APPROACH:
Instead of: "Your life is a lie. They've been programming your mind since birth."
Try: "Think about the last time you made a major life decision. How many of the factors you considered—what success looks like, what others would think, what's 'realistic'—actually came from your own experience versus what you absorbed from family, media, and culture? Most of us are living by rules we never consciously chose."

This style works best for content that challenges conventional thinking while providing clear paths toward greater personal freedom and authentic choice.`
        }
      }

      let apiEndpoint = '/api/generate-script-sections'
      let requestBody: any = {
          videoTitle: sectionedWorkflow.videoTitle,
          targetAudience: sectionedWorkflow.targetAudience,
          themeId: sectionedWorkflow.themeId,
          wordCount: sectionedWorkflow.wordCount,
          title: sectionedWorkflow.videoTitle,
          emotionalTone: sectionedWorkflow.emotionalTone,
          additionalInstructions: sectionedWorkflow.additionalInstructions,
          selectedModel: sectionedWorkflow.selectedModel,
        uploadedStyle: styleToUse,
        ctas: sectionedWorkflow.ctas,
          forbiddenWords: sectionedWorkflow.forbiddenWords,
        researchData: research.analysis ? { analysis: research.analysis, searchResults: research.searchResults } : null,
        generateQuote: sectionedWorkflow.quote.enabled
      }

      // Update request based on method
      switch (method) {
        case 'title-only':
          apiEndpoint = '/api/generate-outline-title-only'
          requestBody = {
            title: sectionedWorkflow.videoTitle,
            targetAudience: sectionedWorkflow.targetAudience,
            emotionalTone: sectionedWorkflow.emotionalTone,
            selectedModel: sectionedWorkflow.selectedModel,
            themeId: sectionedWorkflow.themeId,
            additionalInstructions: sectionedWorkflow.additionalInstructions
          }
          break
        case 'script-extractor':
          if (!sectionedWorkflow.scriptContent.trim()) {
            showMessage('Please enter script content to extract from', 'error')
            return
          }
          apiEndpoint = '/api/extract-script-outline'
          requestBody = {
            title: sectionedWorkflow.videoTitle,
            script: sectionedWorkflow.scriptContent,
            targetAudience: sectionedWorkflow.targetAudience,
            emotionalTone: sectionedWorkflow.emotionalTone,
            selectedModel: sectionedWorkflow.selectedModel,
            themeId: sectionedWorkflow.themeId,
            additionalInstructions: sectionedWorkflow.additionalInstructions
          }
          break
        case 'custom-info':
          if (!sectionedWorkflow.customInformation.trim()) {
            showMessage('Please enter custom information/articles', 'error')
            return
          }
          apiEndpoint = '/api/generate-outline-custom-info'
          requestBody = {
            title: sectionedWorkflow.videoTitle,
            customInformation: sectionedWorkflow.customInformation,
            targetAudience: sectionedWorkflow.targetAudience,
            emotionalTone: sectionedWorkflow.emotionalTone,
            selectedModel: sectionedWorkflow.selectedModel,
            themeId: sectionedWorkflow.themeId,
            additionalInstructions: sectionedWorkflow.additionalInstructions
          }
          break
        default:
          // Standard method - use existing logic
          requestBody.uploadedStyle = styleToUse
          break
      }

      dispatch(startGeneratingSections())
      
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate sections')
        }

        const data = await response.json()
        
        // Handle generated quote if present
        if (data.quote && data.quote.text && data.quote.author) {
          dispatch(setQuote({ text: data.quote.text, author: data.quote.author }))
          showMessage(`Generated quote: "${data.quote.text}" - ${data.quote.author}`, 'success')
        }
        
        const sections: ScriptSection[] = data.sections.map((section: any, index: number) => ({
          id: `section-${Date.now()}-${index}`,
          title: section.title,
          writingInstructions: section.writingInstructions,
          image_generation_prompt: section.image_generation_prompt || '',
          generatedScript: '',
          isGenerating: false,
          wordCount: section.wordCount || 0,
          order: index + 1
        }))
        
        dispatch(setSections(sections))
        showMessage(`Generated ${sections.length} script sections using ${method} method!`, 'success')
        dispatch(markStepCompleted(3))
    } catch (error) {
        const errorMessage = (error as Error).message
        showMessage(`Failed to generate sections: ${errorMessage}`, 'error')
    }
  }

    return (
      <div className="space-y-6">
        <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Generate Script Outline
                </CardTitle>
                <CardDescription>
              Choose your preferred method to create structured sections for your video script
                </CardDescription>
              </CardHeader>
          <CardContent className="space-y-6">
            {/* Outline Method Selection */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Outline Generation Method</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Standard Method */}
                <Card className={`cursor-pointer transition-all ${
                  sectionedWorkflow.outlineMethod === 'standard' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <CardContent className="p-4 text-center" onClick={() => dispatch(setOutlineMethod('standard'))}>
                    <Zap className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <h3 className="font-semibold text-sm">Standard</h3>
                    <p className="text-xs text-gray-600 mt-1">Full configuration-based outline</p>
              </CardContent>
            </Card>

                {/* Title Only */}
                <Card className={`cursor-pointer transition-all ${
                  sectionedWorkflow.outlineMethod === 'title-only' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <CardContent className="p-4 text-center" onClick={() => dispatch(setOutlineMethod('title-only'))}>
                    <FileText className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-semibold text-sm">Title Only</h3>
                    <p className="text-xs text-gray-600 mt-1">Generate from title alone</p>
                  </CardContent>
                </Card>

                {/* Script Extractor */}
                <Card className={`cursor-pointer transition-all ${
                  sectionedWorkflow.outlineMethod === 'script-extractor' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <CardContent className="p-4 text-center" onClick={() => dispatch(setOutlineMethod('script-extractor'))}>
                    <Edit className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <h3 className="font-semibold text-sm">Script Extractor</h3>
                    <p className="text-xs text-gray-600 mt-1">Extract from existing script</p>
                  </CardContent>
                </Card>

                {/* Custom Information */}
                <Card className={`cursor-pointer transition-all ${
                  sectionedWorkflow.outlineMethod === 'custom-info' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <CardContent className="p-4 text-center" onClick={() => dispatch(setOutlineMethod('custom-info'))}>
                    <BookOpen className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                    <h3 className="font-semibold text-sm">Custom Info</h3>
                    <p className="text-xs text-gray-600 mt-1">From articles & information</p>
                  </CardContent>
                </Card>
              </div>
              </div>

            {/* Method-specific inputs */}
            {sectionedWorkflow.outlineMethod === 'script-extractor' && (
            <div className="space-y-2">
                <Label htmlFor="scriptContent">Script Content to Extract From</Label>
            <Textarea
                  id="scriptContent"
                  value={sectionedWorkflow.scriptContent}
                  onChange={(e) => dispatch(setScriptContent(e.target.value))}
                  placeholder="Paste the script you want to extract information and structure from..."
                  rows={8}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  The system will analyze this script and create an outline based on its structure and content.
                </p>
            </div>
            )}

            {sectionedWorkflow.outlineMethod === 'custom-info' && (
          <div className="space-y-2">
                <Label htmlFor="customInformation">Custom Information & Articles</Label>
            <Textarea
                  id="customInformation"
                  value={sectionedWorkflow.customInformation}
                  onChange={(e) => dispatch(setCustomInformation(e.target.value))}
                  placeholder="Paste your articles, research, information, or any content you want the script to be based on..."
                  rows={8}
                  className="w-full"
            />
            <p className="text-xs text-gray-500">
                  The system will analyze this information and create an engaging script outline from it.
            </p>
                </div>
            )}

            {/* Generate Button */}
            <div className="flex justify-center items-center gap-2">
              <Button
                onClick={() => handleGenerateOutline(sectionedWorkflow.outlineMethod)} 
                disabled={sectionedWorkflow.sectionsProgress.isActive}
                className="px-8 py-2"
              >
                {sectionedWorkflow.sectionsProgress.isActive ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                </>
              ) : (
                <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Outline ({sectionedWorkflow.outlineMethod.replace('-', ' ')})
                </>
              )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => showOutlinePrompt()}
                title="🔍 View exact prompt that will be sent to AI for outline generation"
                className="px-3"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>

            {/* Generated Sections Display */}
            {sectionedWorkflow.sections.length > 0 && (
              <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Script Outline ({sectionedWorkflow.sections.length} sections)</h3>
                  <Button variant="outline" onClick={() => handleGenerateOutline(sectionedWorkflow.outlineMethod)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate
            </Button>
      </div>

                {sectionedWorkflow.sections.map((section, index) => {
                  // Check if this section has a CTA
                  const activeCTAs = sectionedWorkflow.ctas.filter(cta => cta.enabled);
                  const sectionHasCTA = activeCTAs.some((ctaItem) => {
                    if (ctaItem.placement === 'beginning' && index === 0) return true;
                    if (ctaItem.placement === 'middle' && index === Math.floor(sectionedWorkflow.sections.length / 2)) return true;
                    if (ctaItem.placement === 'end' && index === sectionedWorkflow.sections.length - 1) return true;
                    if (ctaItem.placement === 'custom' && ctaItem.customPosition === index + 1) return true;
                    return false;
                  });

                  const sectionCTAs = activeCTAs.filter((ctaItem) => {
                    if (ctaItem.placement === 'beginning' && index === 0) return true;
                    if (ctaItem.placement === 'middle' && index === Math.floor(sectionedWorkflow.sections.length / 2)) return true;
                    if (ctaItem.placement === 'end' && index === sectionedWorkflow.sections.length - 1) return true;
                    if (ctaItem.placement === 'custom' && ctaItem.customPosition === index + 1) return true;
                    return false;
                  });

                  return (
                    <Card 
                      key={section.id} 
                      className={sectionHasCTA ? 'border-l-4 border-l-orange-500 bg-orange-50/30' : 'border-l-4 border-l-blue-500'}
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                              {index + 1}. {section.title}
                              {sectionHasCTA && (
                                <div className="flex items-center gap-1">
                                  <Megaphone className="h-4 w-4 text-orange-600" />
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                    {sectionCTAs.length} CTA{sectionCTAs.length > 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              )}
                            </h4>
                          </div>
                          
                          {sectionHasCTA && (
                            <div className="bg-orange-100 border border-orange-200 rounded-lg p-2 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <Megaphone className="h-3 w-3 text-orange-600" />
                                <span className="font-medium text-orange-800">
                                  Planned CTA{sectionCTAs.length > 1 ? 's' : ''}:
                                </span>
                              </div>
                              <div className="space-y-1 text-orange-700">
                                {sectionCTAs.map((cta) => (
                                  <div key={cta.id} className="text-xs">
                                    • <span className="font-medium capitalize">{cta.type}</span>
                                    {cta.type === 'newsletter' && ' - Newsletter signup'}
                                    {cta.type === 'engagement' && ' - Engagement request'}
                                    {cta.type === 'custom' && ' - Custom CTA'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <p className="text-sm text-gray-600">
                            {section.writingInstructions}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              ~{section.wordCount} words
                            </Badge>
                            {sectionHasCTA && (
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                Will contain CTA
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
        </div>
      )}
          </CardContent>
        </Card>

        {/* Progress tracking */}
          {sectionedWorkflow.sectionsProgress.isActive && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <ProgressBar
                  current={sectionedWorkflow.sectionsProgress.current}
                  total={sectionedWorkflow.sectionsProgress.total}
                  message={sectionedWorkflow.sectionsProgress.message}
                />
              </CardContent>
            </Card>
          )}
                  </div>
    )
  }

  // Step 5: Script Generation (simplified)
  const renderGenerationStep = () => (
    <div className="space-y-6">
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Generate Full Script
          </CardTitle>
          <CardDescription>
            Generate detailed script content for each section
          </CardDescription>
        </CardHeader>
          <CardContent>
          {sectionedWorkflow.sections.length === 0 ? (
            <div className="text-center p-8">
              <AlertCircle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Outline Available</h3>
              <p className="text-gray-600">Please complete the outline step first.</p>
            </div>
          ) : (
            <div className="space-y-4">
                        <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Script Sections</h3>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleGenerateAllScripts}
                    disabled={sectionedWorkflow.detailedScriptProgress.isActive || sectionedWorkflow.sections.some(s => s.isGenerating)}
                  >
                    {sectionedWorkflow.detailedScriptProgress.isActive || sectionedWorkflow.sections.some(s => s.isGenerating) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Generate All Scripts
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showDetailedScriptPrompt()}
                    title="🔍 View exact prompt that will be sent to AI for script generation"
                    className="px-3"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
            </div>
                      
              {sectionedWorkflow.sections.map((section, index) => {
                // Check if this section has a CTA
                const activeCTAs = sectionedWorkflow.ctas.filter(cta => cta.enabled);
                const sectionHasCTA = activeCTAs.some((ctaItem) => {
                  if (ctaItem.placement === 'beginning' && index === 0) return true;
                  if (ctaItem.placement === 'middle' && index === Math.floor(sectionedWorkflow.sections.length / 2)) return true;
                  if (ctaItem.placement === 'end' && index === sectionedWorkflow.sections.length - 1) return true;
                  if (ctaItem.placement === 'custom' && ctaItem.customPosition === index + 1) return true;
                  return false;
                });

                const sectionCTAs = activeCTAs.filter((ctaItem) => {
                  if (ctaItem.placement === 'beginning' && index === 0) return true;
                  if (ctaItem.placement === 'middle' && index === Math.floor(sectionedWorkflow.sections.length / 2)) return true;
                  if (ctaItem.placement === 'end' && index === sectionedWorkflow.sections.length - 1) return true;
                  if (ctaItem.placement === 'custom' && ctaItem.customPosition === index + 1) return true;
                  return false;
                });

                return (
                  <Card 
                    key={section.id} 
                    className={sectionHasCTA ? 'border-orange-300 bg-orange-50/30 shadow-md' : 'border-l-4 border-l-blue-500'}
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold flex items-center gap-2">
                            {section.title}
                            {sectionHasCTA && (
                              <div className="flex items-center gap-1">
                                <Megaphone className="h-4 w-4 text-orange-600" />
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                  {sectionCTAs.length} CTA{sectionCTAs.length > 1 ? 's' : ''}
                                </Badge>
                              </div>
                            )}
                          </h4>
                        </div>
                        
                        {sectionHasCTA && (
                          <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <Megaphone className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-orange-800">
                                CTA{sectionCTAs.length > 1 ? 's' : ''} in this section:
                              </span>
                            </div>
                            <div className="space-y-1 text-orange-700">
                              {sectionCTAs.map((cta, ctaIndex) => (
                                <div key={cta.id} className="text-xs">
                                  • <span className="font-medium capitalize">{cta.type}</span>
                                  {cta.type === 'newsletter' && ' - Insights Academy signup with "The Kybalion" ebook'}
                                  {cta.type === 'engagement' && ' - "If this video resonated with you, let us know by commenting, \'I understood it.\'"'}
                                  {cta.type === 'custom' && cta.content && ` - ${cta.content.substring(0, 50)}${cta.content.length > 50 ? '...' : ''}`}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {section.generatedScript ? (
                          <div className="bg-gray-50 p-4 rounded border">
                            <p className="text-sm whitespace-pre-wrap">{section.generatedScript}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <Badge className="text-xs">{section.wordCount} words</Badge>
                                {sectionHasCTA && (
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                    Contains CTA
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateDetailedScript(section.id)}
                                disabled={section.isGenerating}
                              >
                                {section.isGenerating ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Regenerating...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Regenerate
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded">
                            <p className="text-gray-500 mb-2">Script not generated yet</p>
                            <Button
                              size="sm"
                              onClick={() => handleGenerateDetailedScript(section.id)}
                              disabled={section.isGenerating}
                            >
                              {section.isGenerating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                'Generate Script'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
                        </div>
          )}
        </CardContent>
      </Card>

      {/* Progress tracking for detailed script generation */}
      {sectionedWorkflow.detailedScriptProgress.isActive && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <ProgressBar
              current={sectionedWorkflow.detailedScriptProgress.currentSection}
              total={sectionedWorkflow.detailedScriptProgress.totalSections}
              message={sectionedWorkflow.detailedScriptProgress.message}
            />
          </CardContent>
        </Card>
      )}

      {/* Full Script Preview */}
      {sectionedWorkflow.fullScript && (
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Complete Script Preview
              </CardTitle>
              <CardDescription>
              Combined script from all generated sections
              {sectionedWorkflow.quote.enabled && sectionedWorkflow.quote.text && (
                <span className="ml-2 text-blue-600">• Quote included</span>
              )}
              </CardDescription>
            </CardHeader>
          <CardContent>
            {/* Quote Display */}
            {sectionedWorkflow.quote.enabled && sectionedWorkflow.quote.text && (
              <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r">
                <blockquote className="text-lg italic text-blue-900 mb-2">
                  "{sectionedWorkflow.quote.text}"
                </blockquote>
                <cite className="text-sm text-blue-700 font-medium">
                  — {sectionedWorkflow.quote.author}
                </cite>
                <div className="mt-2 text-xs text-blue-600">
                  ✨ Auto-generated quote
                </div>
              </div>
            )}
            
            <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
              <div className="text-sm leading-relaxed space-y-4">
                {sectionedWorkflow.sections
                  .filter(section => section.generatedScript.trim())
                  .sort((a, b) => a.order - b.order)
                  .map((section, index) => (
                    <div key={section.id} className="space-y-2">
                      <h3 className="font-bold text-gray-900 text-base">
                        {section.title}
                      </h3>
                      <div className="text-gray-800 whitespace-pre-wrap">
                        {section.generatedScript}
                </div>
                      {index < sectionedWorkflow.sections.filter(s => s.generatedScript.trim()).length - 1 && (
                        <hr className="my-4 border-gray-300" />
                            )}
                          </div>
                  ))
                }
                              </div>
                          </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {sectionedWorkflow.sections.reduce((total, section) => total + section.wordCount, 0)} total words
                </Badge>
                <Badge variant="outline">
                  {sectionedWorkflow.sections.filter(s => s.generatedScript.trim()).length} sections
                </Badge>
                {sectionedWorkflow.ctas.filter(cta => cta.enabled).length > 0 && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    {sectionedWorkflow.ctas.filter(cta => cta.enabled).length} CTAs included
                    </Badge>
                  )}
                  </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Script
              </Button>
                </div>
              </CardContent>
          </Card>
      )}
    </div>
  )

  // Step 6: Translation
  const renderTranslationStep = () => (
    <div className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Script Translation
            </CardTitle>
                <CardDescription>
            Translate your generated script to other languages
                </CardDescription>
              </CardHeader>
      </Card>
      
      <ScriptTranslator />
                </div>
  )

  const renderCurrentStep = () => {
    switch (sectionedWorkflow.currentStep) {
      case 0: return renderScriptStyleStep()
      case 1: return renderConfigurationStep()  
      case 2: return renderResearchStep()
      case 3: return renderOutlineStep()
      case 4: return renderGenerationStep()
      case 5: return renderTranslationStep()
      default: return null
    }
  }

  return (
    <div className="w-full max-w-full p-6 space-y-6">
      {/* Header */}
                  <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Script Generator</h1>
        <p className="text-gray-600">
          Create professional video scripts with our step-by-step guided workflow
        </p>
                            </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          messageType === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          messageType === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message}
        </div>
      )}

      {/* Stepper */}
      <Stepper 
        steps={steps} 
        currentStep={sectionedWorkflow.currentStep} 
        onStepClick={handleStepClick}
      />

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {renderCurrentStep()}
                      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
                                <Button
                                  variant="outline"
          onClick={handlePrevious}
          disabled={sectionedWorkflow.currentStep === 0}
                                >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
                                </Button>

        <div className="text-sm text-gray-500">
          Step {sectionedWorkflow.currentStep + 1} of {steps.length}
                    </div>

                                <Button
          onClick={handleNext}
          disabled={sectionedWorkflow.currentStep === steps.length - 1 || !canProceedToNext()}
                >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
      </div>

      {/* Prompt Preview Modal */}
      <PromptDialog
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        title={modalTitle}
        prompt={modalPrompt}
      />
    </div>
  )
} 