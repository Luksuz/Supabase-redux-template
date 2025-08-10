'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { History, Database } from "lucide-react"
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StaggerContainer, StaggerItem, ScaleOnHover } from "../animated-page"

interface OpenAIModel {
  id: string
  owned_by: string
}

interface ScriptGeneratorFormProps {
  // Form values
  title: string
  targetSections: number
  theme: string
  povSelection: string
  scriptFormat: string
  audience: string
  selectedModel: string
  sectionPrompt: string
  scriptPrompt: string
  additionalPrompt: string
  researchContext: string
  
  // Form handlers
  onTitleChange: (value: string) => void
  onTargetSectionsChange: (value: number) => void
  onThemeChange: (value: string) => void
  onPovSelectionChange: (value: string) => void
  onScriptFormatChange: (value: string) => void
  onAudienceChange: (value: string) => void
  onModelChange: (value: string) => void
  onSectionPromptChange: (value: string) => void
  onScriptPromptChange: (value: string) => void
  onAdditionalPromptChange: (value: string) => void
  onResearchContextChange: (value: string) => void
  onClearResearch: () => void
  onPreviewResearch: () => void
  
  // Actions
  onGenerateOutline: () => void
  onGenerateFullScript: () => void
  onDownloadDocx: () => void
  onOpenPromptHistory: () => void
  onOpenLoadCachedData: () => void
  
  // State
  models: OpenAIModel[]
  isLoading: boolean
  isGeneratingScript: boolean
  hasScriptSections: boolean
  hasFullScript: boolean
  scriptGenerationError: string | null
}

export function ScriptGeneratorForm({
  title,
  targetSections,
  theme,
  povSelection,
  scriptFormat,
  audience,
  selectedModel,
  sectionPrompt,
  scriptPrompt,
  additionalPrompt,
  researchContext,
  onTitleChange,
  onTargetSectionsChange,
  onThemeChange,
  onPovSelectionChange,
  onScriptFormatChange,
  onAudienceChange,
  onModelChange,
  onSectionPromptChange,
  onScriptPromptChange,
  onAdditionalPromptChange,
  onResearchContextChange,
  onClearResearch,
  onPreviewResearch,
  onGenerateOutline,
  onGenerateFullScript,
  onDownloadDocx,
  onOpenPromptHistory,
  onOpenLoadCachedData,
  models,
  isLoading,
  isGeneratingScript,
  hasScriptSections,
  hasFullScript,
  scriptGenerationError
}: ScriptGeneratorFormProps) {
  const openAIModels = models.filter(m => m.owned_by === 'openai')
  const anthropicModels = models.filter(m => m.owned_by === 'anthropic')
  const customModels = models.filter(m => m.owned_by !== 'openai' && m.owned_by !== 'anthropic')

  return (
    <StaggerContainer className="w-full space-y-6 p-6 bg-card rounded-lg border shadow-sm">
      <StaggerItem>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Script Generator</h2>
          <p className="text-muted-foreground">
            Create a script using AI. Fill in the details below.
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <div className="flex gap-2">
            <ScaleOnHover>
              <Button
                variant="outline"
                onClick={onOpenLoadCachedData}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                Load Cached Data
              </Button>
            </ScaleOnHover>
            <ScaleOnHover>
              <Button
                variant="outline"
                onClick={onOpenPromptHistory}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                Prompt History
              </Button>
            </ScaleOnHover>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="flex justify-between">
            <span>Title</span>
            {!title && <span className="text-red-500 text-xs">Required for regeneration</span>}
          </Label>
          <Input
            id="title"
            placeholder="Enter a title for your script"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={!title ? "border-red-300 focus-visible:ring-red-500" : ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetSections">Number of Sections</Label>
          <Input
            id="targetSections"
            type="number"
            min={2}
            max={8}
            step={1}
            value={targetSections}
            onChange={(e) => onTargetSectionsChange(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Create {targetSections} logical sections with natural story divisions
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {openAIModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel>OpenAI</SelectLabel>
                  {openAIModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {anthropicModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Anthropic</SelectLabel>
                  {anthropicModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {customModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Custom</SelectLabel>
                  {customModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.id} ({model.owned_by})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme" className="flex justify-between">
            <span>Story Theme</span>
          </Label>
          <Input
            id="theme"
            placeholder="E.g., Mystery, Romance, Sci-Fi"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
          />
        </div>
        </div>
      </StaggerItem>

      {/* Second row of inputs for new fields */}
      <StaggerItem>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="povSelection">POV Selection</Label>
          <Select value={povSelection} onValueChange={onPovSelectionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select POV" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1st Person">1st Person</SelectItem>
              <SelectItem value="3rd Person">3rd Person</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scriptFormat">Format of Scripting</Label>
          <Select value={scriptFormat} onValueChange={onScriptFormatChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Story">Story</SelectItem>
              <SelectItem value="Facts">Facts</SelectItem>
              <SelectItem value="Documentary">Documentary</SelectItem>
              <SelectItem value="Tutorial">Tutorial</SelectItem>
              <SelectItem value="Interview">Interview</SelectItem>
              <SelectItem value="Presentation">Presentation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience">Target Audience</Label>
          <Input
            id="audience"
            placeholder="E.g., Young adults, Professionals, General audience"
            value={audience}
            onChange={(e) => onAudienceChange(e.target.value)}
          />
        </div>
        </div>
      </StaggerItem>

      {/* Research Context Box */}
      {researchContext && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="researchContext" className="flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Applied Research Context
            </Label>
            <div className="flex gap-2">
              <button
                onClick={onPreviewResearch}
                className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview Research
              </button>
              <button
                onClick={onClearResearch}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Clear Research
              </button>
            </div>
          </div>
          <Textarea
            id="researchContext"
            value={researchContext}
            onChange={(e) => onResearchContextChange(e.target.value)}
            className="min-h-[120px] bg-blue-50 border-blue-200"
            placeholder="Research context will appear here when applied from YouTube Research Assistant"
          />
          <p className="text-xs text-blue-600">
            This research data will be automatically included when generating your script to ensure it's backed by insights and analysis.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionPrompt">Section Generation Instructions (Optional)</Label>
          <Textarea
            id="sectionPrompt"
            placeholder="Specific instructions for how the AI should create and structure the script sections/outline"
            value={sectionPrompt}
            onChange={(e) => onSectionPromptChange(e.target.value)}
            className="min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            Controls how the script is divided into sections and the overall structure
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scriptPrompt">Script Writing Instructions (Optional)</Label>
          <Textarea
            id="scriptPrompt"
            placeholder="Specific instructions for how the AI should write the actual script content"
            value={scriptPrompt}
            onChange={(e) => onScriptPromptChange(e.target.value)}
            className="min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            Controls the writing style, tone, and content approach for the final script
          </p>
        </div>

        {/* Prompt Version Selection */}
        <div className="space-y-2">
          <Label>Quick Prompt Templates</Label>
          <p className="text-sm text-gray-600 mb-3">
            Choose a template to quickly populate your general instructions
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdditionalPromptChange(`You are a master storyteller and researcher creating compelling, authentic video content for philosophy topics. Your goal is to educate and engage through natural human communication, not AI-generated content patterns.

TITLE: "${title}"
THEME: ${theme}
AUDIENCE: ${audience}

ANTI-AI CONTENT REQUIREMENTS:
- NEVER use repetitive catchphrases or formulaic expressions
- ELIMINATE generic, interchangeable language that could apply to any topic
- REJECT artificial excitement or forced urgency
- CREATE unique, topic-specific insights that demonstrate genuine expertise

NATURAL HUMAN COMMUNICATION STANDARDS:
- Write as if you're a knowledgeable friend sharing fascinating discoveries
- Use varied sentence structures and natural speech patterns
- Include specific, verifiable details and examples
- Show genuine curiosity and intellectual engagement with the topic
- Respect your audience's intelligence and critical thinking abilities

CONTENT DEPTH REQUIREMENTS:
- Provide specific, actionable insights that viewers can verify or apply
- Explain underlying mechanisms and causalities, not just surface-level claims
- Include historical context, comparative examples, or case studies
- Connect individual concepts to broader frameworks or principles`)}
              className="text-left h-auto py-3 px-3"
            >
              <div>
                <div className="font-medium text-xs">Philosopy niche</div>
                <div className="text-xs text-gray-500 mt-1">Philosophy</div>
              </div>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdditionalPromptChange(`You are a professional script outline generator. Create a detailed script outline for story sections with the following details:

Title: ${title}
Theme: ${theme || "No specific theme provided"}
Target Sections: ${targetSections}

Each section must have:
1. A 'title' that captures the essence of that section.
2. Detailed 'writingInstructions' (150-250 words for main content sections) that explain what should happen in that section, including plot developments, character interactions, and thematic elements. These instructions are for the narrator.
3. An 'image_generation_prompt' (a concise phrase or sentence, around 10-25 words) that describes the key visual elements of the scene for an AI image generator. This prompt should be purely descriptive of the visuals, suitable for direct use in image generation, and must avoid any taboo, sensitive, or controversial topics.

IMPORTANT GUIDELINES FOR WRITING INSTRUCTIONS:
1. Do NOT include instructions for the narrator to begin with greetings like "Hi", "Hello", etc.
2. Do NOT instruct the narrator to state or repeat the title or section names.
3. Focus on the narrative flow and content rather than introductory elements.
4. The narrator should begin directly with the story content, not with meta-references to the story itself.
5. Ensure the story can flow naturally without headers, titles, or section markers.

IMPORTANT INSTRUCTIONS FOR NARRATOR CALLS TO ACTION (CTAs):
You MUST incorporate the following CTAs directly into the 'writingInstructions' of the appropriate sections. These CTAs are spoken by the narrator. Ensure these CTAs are integrated naturally within the narrative flow where specified.

1. **CTA 1 (After First Hook):** In the 'writingInstructions' for the FIRST SECTION, after approximately 70-100 words of narrative content (about 30-40 seconds of speaking time), include this EXACT text: "Before we jump back in, tell us where you're tuning in from, and if this story touches you, make sure you're subscribed—because tomorrow, I've saved something extra special for you!" This CTA should be placed after the initial hook and setup, once the audience is engaged with the story.

2. **CTA 2 (Mid-Script ~10 minutes / ~1500 words):** For longer scripts, embed this CTA into the 'writingInstructions' of a suitable mid-point section: "Preparing and narrating this story took us a lot of time, so if you are enjoying it, subscribe to our channel, it means a lot to us! Now back to the story."

3. **CTA 3 (Later-Script ~40 minutes):** For very long scripts, embed this CTA into the 'writingInstructions' of an appropriate later section: "Enjoying the video so far? Don't forget to subscribe!"

4. **CTA 4 (End of Script):** After the main story narrative is completely finished, the 'writingInstructions' for the very final section MUST include: "Up next, you've got two more standout stories right on your screen. If this one hit the mark, you won't want to pass these up. Just click and check them out! And don't forget to subscribe and turn on the notification bell, so you don't miss any upload from us!"

Adherence to CTA placement and inclusion in 'writingInstructions' is critical.
Make all sections flow logically. Ensure all generated content, including CTAs and image prompts, is safe, respectful, and avoids controversial subjects.`)}
              className="text-left h-auto py-3 px-3"
            >
              <div>
                <div className="font-medium text-xs">AI story niche</div>
                <div className="text-xs text-gray-500 mt-1">AI + Story + Niche</div>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdditionalPromptChange(`You are a philosophical educator and thought leader creating accessible yet profound content that explores fundamental questions about existence, meaning, and human experience. Your approach combines academic rigor with practical wisdom.

Title: ${title}
Theme: ${theme || "Philosophical Exploration"}
Audience: ${audience || "Thoughtful individuals seeking deeper understanding"}

PHILOSOPHICAL INQUIRY APPROACH:
- Begin with universal human experiences that connect to deeper philosophical questions
- Use the Socratic method: ask probing questions that lead viewers to their own insights
- Present multiple philosophical perspectives without forcing a single conclusion
- Connect abstract concepts to concrete, everyday examples
- Encourage critical thinking rather than passive consumption

CONTENT STRUCTURE:
- Opening Question: Start with a thought-provoking dilemma or paradox
- Historical Context: Reference relevant philosophers and their contributions
- Modern Applications: How these ideas apply to contemporary life
- Multiple Viewpoints: Present different philosophical schools of thought
- Personal Reflection: Invite viewers to examine their own beliefs and assumptions

COMMUNICATION STYLE:
- Conversational yet intellectually substantive
- Use metaphors and analogies to explain complex concepts
- Acknowledge the complexity and nuance of philosophical questions
- Avoid dogmatic statements; embrace intellectual humility
- Balance scholarly knowledge with accessible language

ENGAGEMENT TECHNIQUES:
- Pose hypothetical scenarios and moral dilemmas
- Reference current events through a philosophical lens
- Use historical examples and case studies
- Include thought experiments and paradoxes
- Connect philosophy to practical decision-making

DEPTH REQUIREMENTS:
- Explore the "why" behind beliefs and assumptions
- Examine underlying premises and logical foundations
- Address counterarguments and alternative perspectives
- Connect individual concepts to broader philosophical frameworks
- Encourage viewers to develop their own philosophical positions

PRACTICAL WISDOM INTEGRATION:
- Show how philosophical thinking improves daily life
- Provide frameworks for ethical decision-making
- Explore the relationship between knowledge and happiness
- Address contemporary challenges through philosophical wisdom
- Demonstrate the relevance of ancient wisdom to modern problems`)}
              className="text-left h-auto py-3 px-3"
            >
              <div>
                <div className="font-medium text-xs">🏛️ Philosophy 2</div>
                <div className="text-xs text-gray-500 mt-1">Questions + Wisdom + Practice</div>
              </div>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdditionalPromptChange(`You are an investigative journalist creating compelling, fact-based content that uncovers hidden truths and explores mysteries. Your approach is methodical, evidence-driven, and designed to keep viewers engaged through revelation and discovery.

Title: ${title}
Theme: ${theme || "No specific theme provided"}
Format: Investigative Documentary Style

INVESTIGATIVE JOURNALISM PRINCIPLES:
- Present information as if uncovering a mystery or hidden truth
- Build suspense through strategic revelation of facts
- Use phrases like "What we discovered next...", "But there's more to this story...", "The evidence suggests..."
- Structure content to reveal information progressively, not all at once
- Create intrigue through questions that lead to answers

NARRATIVE STRUCTURE:
- Hook: Start with the most compelling question or mysterious element
- Investigation: Present evidence, interview insights, and findings systematically
- Revelations: Build to key discoveries that answer the central questions
- Conclusion: Tie together all evidence and present the fuller picture

TONE AND STYLE:
- Professional yet accessible, like a skilled documentary narrator
- Use investigative language: "sources reveal", "evidence shows", "investigation uncovered"
- Build credibility through citing specific examples, data, and expert perspectives
- Maintain objectivity while keeping the narrative compelling
- Create urgency without sensationalism

ENGAGEMENT TECHNIQUES:
- Use rhetorical questions to involve the audience in the investigation
- Present contradictory evidence before revealing the truth
- Include "what if" scenarios and alternative explanations
- Use transitional phrases that build anticipation
- Reference "what most people don't know" or "the untold story"

CONTENT REQUIREMENTS:
- Verify all claims with credible sources and evidence
- Present multiple perspectives before drawing conclusions
- Use specific dates, names, and verifiable details
- Include background context that explains why this investigation matters
- Connect individual cases to broader patterns or implications`)}
              className="text-left h-auto py-3 px-3"
            >
              <div>
                <div className="font-medium text-xs">🔍 Investigation</div>
                <div className="text-xs text-gray-500 mt-1">Mystery + Evidence + Discovery</div>
              </div>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdditionalPromptChange(`You are a true crime narrator creating a compelling, respectful documentary-style narrative about real criminal cases. Your approach balances factual accuracy with engaging storytelling while maintaining sensitivity to victims and their families.

Title: ${title}
Theme: ${theme || "True Crime Investigation"}
Format: True Crime Documentary
Research Context: ${researchContext ? "Integrate provided research data" : "No research data provided"}

RESEARCH INTEGRATION REQUIREMENTS:
${researchContext ? `- Utilize the provided research context to establish factual foundation
- Cross-reference research findings with case details
- Incorporate verified information from research sources
- Use research data to provide context and background
- Reference specific facts and evidence from research materials` : '- Ensure all facts are verifiable and from credible sources'}

CHARACTER-FOCUSED STRUCTURE:
Create dedicated sections for each key character with detailed writing instructions:

1. THE VICTIM(S) SECTION:
   - Background: Personal history, life circumstances, relationships
   - Character Development: What made them unique, their dreams, daily life
   - Timeline: Events leading up to the crime
   - Writing Instructions: Present the victim as a full person, not just a crime statistic
   - Tone: Respectful, humanizing, avoiding sensationalism

2. THE PERPETRATOR(S) SECTION:
   - Background: Early life, psychological factors, criminal history
   - Motive Analysis: What drove them to commit the crime
   - Methods: How the crime was planned and executed
   - Writing Instructions: Objective analysis without glorification
   - Tone: Clinical but engaging, focused on understanding not sympathy

3. THE INVESTIGATORS SECTION:
   - Key Personnel: Detectives, forensic experts, legal professionals
   - Investigation Process: Challenges, breakthroughs, setbacks
   - Evidence Analysis: Forensic findings, witness testimony
   - Writing Instructions: Show the human side of investigation work
   - Tone: Procedural but personal, highlighting dedication and skill

4. THE FAMILY/COMMUNITY SECTION:
   - Impact: How the crime affected loved ones and community
   - Response: Community rallying, advocacy efforts, memorial activities
   - Ongoing Effects: Long-term consequences and healing process
   - Writing Instructions: Focus on resilience and healing, not just trauma
   - Tone: Compassionate, hopeful where appropriate

5. THE LEGAL PROCEEDINGS SECTION:
   - Trial Process: Key moments, evidence presentation, legal strategies
   - Verdict and Sentencing: Outcome and its significance
   - Appeals/Aftermath: Long-term legal consequences
   - Writing Instructions: Explain complex legal concepts clearly
   - Tone: Informative, balanced coverage of all parties

TRUE CRIME NARRATIVE PRINCIPLES:
- Respect for victims and families always comes first
- Present facts objectively without sensationalizing violence
- Focus on the human story behind the headlines
- Include psychological and social context
- Address broader implications for society and justice
- Use chronological structure with strategic flashbacks
- Build suspense through pacing, not graphic details

ETHICAL GUIDELINES:
- Avoid graphic descriptions of violence
- Don't glorify or romanticize perpetrators
- Include trigger warnings where appropriate
- Respect ongoing legal proceedings
- Acknowledge limitations in available information
- Present multiple perspectives when relevant
- Focus on lessons learned and prevention

ENGAGEMENT TECHNIQUES:
- Use timeline reveals and procedural discoveries
- Include "what if" moments and turning points
- Present evidence as it was discovered chronologically
- Use expert insights and professional perspectives
- Connect case to broader patterns in criminal justice
- Reference similar cases for context and comparison`)}
              className="text-left h-auto py-3 px-3"
            >
              <div>
                <div className="font-medium text-xs">🚨 True Crime</div>
                <div className="text-xs text-gray-500 mt-1">Characters + Research + Ethics</div>
              </div>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalPrompt">General Instructions (Optional)</Label>
          <Textarea
            id="additionalPrompt"
            placeholder="Any other general instructions that apply to both section generation and script writing"
            value={additionalPrompt}
            onChange={(e) => onAdditionalPromptChange(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      </div>
      
      <StaggerItem>
        <div className="flex flex-col sm:flex-row gap-3">
          <ScaleOnHover>
            <Button
              className="flex-1 glow-button" 
              onClick={onGenerateOutline}
              disabled={isLoading || isGeneratingScript || !title}
            >
              {isLoading ? "Generating Sections..." : "Generate Sections"}
            </Button>
          </ScaleOnHover>
        
          {hasScriptSections && (
            <ScaleOnHover>
              <Button
                className="flex-1" 
                onClick={onGenerateFullScript}
                disabled={isLoading || isGeneratingScript}
                variant="secondary"
              >
                {isGeneratingScript ? "Generating Script..." : "Generate Full Script"}
              </Button>
            </ScaleOnHover>
          )}

          {hasFullScript && (
            <ScaleOnHover>
              <Button
                variant="outline"
                onClick={onDownloadDocx}
                className="flex-1 gap-2"
              >
                Download DOCX
              </Button>
            </ScaleOnHover>
          )}
        </div>
      </StaggerItem>

      {/* Error Display */}
      {scriptGenerationError && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p className="font-semibold">Error:</p>
          <p className="text-sm">{scriptGenerationError}</p>
        </div>
      )}
    </StaggerContainer>
  )
} 