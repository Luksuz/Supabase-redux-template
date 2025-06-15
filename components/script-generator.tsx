'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  createNewJob, 
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingScript,
  addGeneratedText,
  startGeneratingAllScripts,
  setLoading,
  setError,
  updateSectionRating,
  updateTextRating,
  type FineTuningSection,
  setCurrentJob,
  type Prompt,
  fetchPromptsThunk,
  handlePromptSelectionThunk,
  savePromptChangesThunk,
  setSelectedPromptContent,
  setShowPromptEditor,
  mergeYouTubeDataWithPromptThunk
} from '../lib/features/scripts/scriptsSlice'
import { initializeAuth, loginUser, logoutUser } from '../lib/features/user/userSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { RatingComponent } from './ui/rating'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { FileText, Loader2, Edit3, Play, Download, Copy, CheckCircle, AlertCircle, User, LogOut, Lock, Settings, MessageCircle, Send, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// Chat message interface
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  usingMock?: boolean
}

// Chatbot Tab Component
const ChatbotTab = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your script generation assistant. I can help you with writing techniques, character development, story structure, and any questions about the script generation process. How can I assist you today?",
      timestamp: new Date().toISOString()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp,
          usingMock: data.usingMock
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        usingMock: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your script generation assistant. I can help you with writing techniques, character development, story structure, and any questions about the script generation process. How can I assist you today?",
        timestamp: new Date().toISOString()
      }
    ])
  }

  return (
    <div className="flex flex-col h-[600px] bg-white border border-gray-200 rounded-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white rounded-full p-2">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Script Assistant</h3>
            <p className="text-sm text-gray-600">Your AI writing companion</p>
          </div>
        </div>
        <Button
          onClick={clearChat}
          variant="outline"
          size="sm"
          className="text-gray-600 hover:text-gray-800"
        >
          Clear Chat
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 border border-gray-200'
              }`}
            >
              <div className={`prose prose-sm max-w-none ${
                message.role === 'user' 
                  ? 'prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-code:text-white prose-pre:text-white prose-li:text-white' 
                  : 'prose-gray'
              }`}>
                <ReactMarkdown
                  components={{
                    // Customize code blocks
                    code: ({inline, className, children, ...props}: {inline?: boolean, className?: string, children?: React.ReactNode}) => {
                      return inline ? (
                        <code
                          className={`px-1 py-0.5 rounded text-xs font-mono ${
                            message.role === 'user' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-800'
                          }`}
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <pre className={`p-2 rounded text-xs font-mono overflow-x-auto ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          <code {...props}>{children}</code>
                        </pre>
                      )
                    },
                    // Customize paragraphs to remove default margins
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    // Customize lists
                    ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4">{children}</ol>,
                    // Customize headings
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              <div className={`text-xs mt-2 flex items-center gap-2 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                {message.usingMock && (
                  <span className="bg-orange-100 text-orange-600 px-1 py-0.5 rounded text-xs">
                    Mock
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Assistant is typing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about script writing, character development, story structure, or anything related to script generation..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line. Supports **bold**, *italic*, `code`, and more markdown formatting.
        </p>
      </div>
    </div>
  )
}

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { currentJob } = useAppSelector(state => state.scripts)
  const user = useAppSelector(state => state.user)
  
  // Get prompt state from Redux
  const {
    prompts,
    selectedPromptId,
    selectedPromptContent,
    showPromptEditor,
    promptsLoading,
    promptContentLoading,
    mergingData
  } = useAppSelector(state => state.scripts)
  
  // Get YouTube data from Redux
  const youtubeState = useAppSelector(state => state.youtube)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'generator' | 'assistant'>('generator')
  
  // Form inputs
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('')
  const [stylePreferences, setStylePreferences] = useState('')
  
  // Model selection
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini')
  const [fineTunedModels, setFineTunedModels] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  
  // Auth form inputs
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  
  // UI states
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [showAuthForm, setShowAuthForm] = useState(false)

  // Initialize auth on component mount
  useEffect(() => {
    if (!user.initialized) {
      dispatch(initializeAuth())
    }
  }, [dispatch, user.initialized])

  // Fetch available prompts on mount
  useEffect(() => {
    dispatch(fetchPromptsThunk())
  }, [dispatch])

  // Load fine-tuned models when user logs in
  const loadFineTunedModels = async () => {
    if (!user.isLoggedIn) return

    setLoadingModels(true)
    try {
      const response = await fetch('/api/fine-tuning/models')
      const data = await response.json()

      if (response.ok && data.success) {
        setFineTunedModels(data.models)
      } else {
        console.error('Failed to load fine-tuned models:', data.error)
      }
    } catch (error) {
      console.error('Failed to load fine-tuned models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    loadFineTunedModels()
  }, [user.isLoggedIn])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Handle prompt selection
  const handlePromptSelection = (promptId: string) => {
    dispatch(handlePromptSelectionThunk(promptId))
  }

  // Save prompt changes
  const savePromptChanges = async () => {
    const result = await dispatch(savePromptChangesThunk())
    if (result?.success) {
      showMessage('Prompt updated successfully!', 'success')
    } else {
      showMessage(result?.error || 'Failed to save prompt', 'error')
    }
  }

  // Merge YouTube data with current prompt
  const handleMergeYouTubeData = async () => {
    if (!selectedPromptContent) {
      showMessage('Please select a prompt first', 'error')
      return
    }

    // Collect YouTube data from various sources
    const youtubeData = []

    // Add Google research summaries
    youtubeState.googleResearchSummaries?.forEach(research => {
      youtubeData.push({
        type: 'google_research',
        title: `Google Research: ${research.query}`,
        summary: research.insights,
        keyInsights: research.keyFindings,
        recommendations: research.recommendations,
        sources: research.sources,
        timestamp: research.timestamp
      })
    })

    // Add YouTube research summaries
    youtubeState.youtubeResearchSummaries?.forEach(research => {
      youtubeData.push({
        type: 'youtube_research',
        title: `YouTube Research: ${research.query}`,
        summary: research.videosSummary.overallTheme,
        keyInsights: research.videosSummary.keyInsights,
        narrativeThemes: research.videosSummary.narrativeThemes,
        characterInsights: research.videosSummary.characterInsights,
        conflictElements: research.videosSummary.conflictElements,
        storyIdeas: research.videosSummary.storyIdeas,
        creativePrompt: research.videosSummary.creativePrompt,
        timestamp: research.timestamp
      })
    })

    // Add video summaries if available
    if (youtubeState.videosSummary) {
      youtubeData.push({
        type: 'summary',
        title: 'Video Collection Summary',
        summary: youtubeState.videosSummary.overallTheme,
        keyInsights: youtubeState.videosSummary.keyInsights,
        narrativeThemes: youtubeState.videosSummary.narrativeThemes,
        characterInsights: youtubeState.videosSummary.characterInsights,
        conflictElements: youtubeState.videosSummary.conflictElements,
        storyIdeas: youtubeState.videosSummary.storyIdeas,
        creativePrompt: youtubeState.videosSummary.creativePrompt
      })

      // Add individual video summaries
      youtubeState.videosSummary.videoSummaries.forEach(video => {
        youtubeData.push({
          type: 'video_summary',
          title: video.title,
          summary: `Main Topic: ${video.mainTopic}. Emotional Tone: ${video.emotionalTone}`,
          keyInsights: video.keyPoints,
          narrativeElements: video.narrativeElements,
          timestamp: video.timestamp
        })
      })
    }

    // Add transcript analysis results
    youtubeState.analysisResults.forEach(result => {
      result.analysis.forEach(analysis => {
        youtubeData.push({
          type: 'analysis',
          title: `Analysis: "${result.query}"`,
          analysis: analysis.summary,
          relevantContent: analysis.relevantContent,
          timestamp: analysis.timestamp,
          confidence: analysis.confidence
        })
      })
    })

    // Add subtitle content (first few for context)
    youtubeState.subtitleFiles.slice(0, 3).forEach(subtitle => {
      if (subtitle.status === 'completed') {
        // Extract first few lines of subtitle for context
        const lines = subtitle.srtContent.split('\n').slice(0, 20).join('\n')
        youtubeData.push({
          type: 'transcript',
          title: subtitle.title,
          summary: 'Video transcript content',
          relevantContent: lines
        })
      }
    })

    if (youtubeData.length === 0) {
      showMessage('No research data found. Please perform Google research, analyze YouTube videos, or generate summaries first.', 'error')
      return
    }

    try {
      const result = await dispatch(mergeYouTubeDataWithPromptThunk(youtubeData, currentJob?.theme || theme))
      if (result?.success) {
        const mockMessage = result.usingMock ? ' (Using mock data - Set OPENAI_API_KEY for AI-powered merging)' : ''
        showMessage(`Successfully merged ${youtubeData.length} research items with prompt!${mockMessage}`, 'success')
      } else {
        showMessage(result?.error || 'Failed to merge research data with prompt', 'error')
      }
    } catch (error) {
      showMessage('Failed to merge research data with prompt', 'error')
    }
  }

  // Check if research data is available for merging
  const hasYouTubeData = () => {
    return youtubeState.videosSummary || 
           youtubeState.analysisResults.length > 0 || 
           youtubeState.subtitleFiles.some(sf => sf.status === 'completed') ||
           youtubeState.googleResearchSummaries?.length > 0 ||
           youtubeState.youtubeResearchSummaries?.length > 0
  }

  // Handle authentication
  const handleLogin = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      showMessage('Please enter both email and password', 'error')
      return
    }

    try {
      await dispatch(loginUser({ email: authEmail, password: authPassword })).unwrap()
      showMessage('Successfully logged in!', 'success')
      setShowAuthForm(false)
      setAuthEmail('')
      setAuthPassword('')
    } catch (error: any) {
      showMessage(error.message || 'Login failed', 'error')
    }
  }

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap()
      showMessage('Successfully logged out', 'success')
    } catch (error: any) {
      showMessage(error.message || 'Logout failed', 'error')
    }
  }

  // Create new job and generate sections (requires authentication)
  const handleCreateJob = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to create fine-tuning jobs', 'error')
      setShowAuthForm(true)
      return
    }

    if (!name.trim() || !theme.trim()) {
      showMessage('Please enter both name and theme', 'error')
      return
    }

    try {
      dispatch(setLoading(true))
      
      // Create job in database
      const response = await fetch('/api/fine-tuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), theme: theme.trim() })
      })
      
      const data = await response.json()
        
      if (response.ok) {
        // Use the actual job returned from the API (with UUID) instead of creating a new one in Redux
        dispatch(setCurrentJob(data.job))
        showMessage('Job created successfully! Now configure sections.', 'success')
      } else {
        if (response.status === 401) {
          showMessage('Please log in to create jobs', 'error')
          setShowAuthForm(true)
        } else {
          dispatch(setError(data.error || 'Failed to create job'))
          showMessage(data.error || 'Failed to create job', 'error')
        }
      }
    } catch (error) {
      dispatch(setError('Failed to create job'))
      showMessage('Failed to create job', 'error')
    } finally {
      dispatch(setLoading(false))
    }
  }

  // Generate sections (requires authentication)
  const handleGenerateSections = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate sections', 'error')
      setShowAuthForm(true)
      return
    }

    if (!currentJob) return

    dispatch(startGeneratingSections())
    showMessage('Generating script sections...', 'info')

    try {
      const requestBody: any = {
        theme: currentJob.theme,
        target_audience: targetAudience,
        tone: tone,
        style_preferences: stylePreferences,
        model: selectedModel
      }

      // Add promptId if a custom prompt is selected
      if (selectedPromptId && selectedPromptId !== 'default') {
        requestBody.promptId = selectedPromptId
      }

      // Add custom prompt content if it has been edited
      if (selectedPromptId && selectedPromptId !== 'default' && selectedPromptContent) {
        requestBody.customPrompt = selectedPromptContent
      }

      const response = await fetch('/api/script/generate-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Failed to generate sections')
      }

      const data = await response.json()
      
      // Determine which prompt was used for tracking
      let promptUsed = 'Default Crime Dynasty Prompt'
      if (selectedPromptId && selectedPromptId !== 'default') {
        if (selectedPromptContent) {
          promptUsed = selectedPromptContent
        } else {
          // Find the prompt title from the prompts array
          const selectedPrompt = prompts.find(p => p.id === selectedPromptId)
          if (selectedPrompt) {
            promptUsed = `${selectedPrompt.title}: ${selectedPrompt.prompt}`
          }
        }
      }

      // Save sections to database and update Redux state
      const sectionsResponse = await fetch('/api/fine-tuning/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: currentJob.id,
          sections: data.sections,
          promptUsed: promptUsed
        })
      })

      const sectionsData = await sectionsResponse.json()

      if (sectionsResponse.ok) {
        dispatch(setSections(sectionsData.sections))
        const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
        const promptMessage = selectedPromptId ? ' (Using custom prompt)' : ''
        showMessage(`Sections generated successfully!${modelMessage}${promptMessage} ${data.usingMock ? '(Using mock data)' : ''}`, 'success')
      } else {
        showMessage(sectionsData.error || 'Failed to save sections', 'error')
      }
    } catch (error) {
      showMessage('Failed to generate sections', 'error')
    }
  }

  // Generate script for individual section
  const handleGenerateScript = async (section: FineTuningSection) => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate scripts', 'error')
      setShowAuthForm(true)
      return
    }

    dispatch(startGeneratingScript(section.id))

    try {
      const requestBody: any = {
        title: section.title,
        writingInstructions: section.writing_instructions,
        theme: currentJob?.theme,
        targetAudience: targetAudience,
        tone: tone,
        stylePreferences: stylePreferences,
        model: selectedModel
      }

      // Add promptId if a custom prompt is selected
      if (selectedPromptId && selectedPromptId !== 'default') {
        requestBody.promptId = selectedPromptId
      }

      // Add custom prompt content if it has been edited
      if (selectedPromptId && selectedPromptId !== 'default' && selectedPromptContent) {
        requestBody.customPrompt = selectedPromptContent
      }

      const response = await fetch('/api/script/generate-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Failed to generate script')
      }

      const data = await response.json()

      // Save generated text to database
      const textResponse = await fetch('/api/fine-tuning/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline_section_id: section.id,
          input_text: section.writing_instructions,
          generated_script: data.script
        })
      })

      const textData = await textResponse.json()

      if (textResponse.ok) {
        dispatch(addGeneratedText({
          sectionId: section.id,
          text: textData.text
        }))

        const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
        const promptMessage = selectedPromptId ? ' (Using custom prompt)' : ''
        showMessage(`Script generated successfully!${modelMessage}${promptMessage} ${data.usingMock ? '(Using mock data)' : ''}`, 'success')
      } else {
        showMessage(textData.error || 'Failed to save generated script', 'error')
      }
    } catch (error) {
      showMessage('Failed to generate script', 'error')
    }
  }

  // Generate all scripts at once (requires authentication)
  const handleGenerateAllScripts = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate scripts', 'error')
      setShowAuthForm(true)
      return
    }

    if (!currentJob?.sections) return

    dispatch(startGeneratingAllScripts())
    showMessage('Generating all scripts in parallel...', 'info')

    const promises = currentJob.sections.map(async (section: FineTuningSection) => {
      try {
        const requestBody: any = {
          title: section.title,
          writingInstructions: section.writing_instructions,
          theme: currentJob.theme,
          targetAudience: targetAudience,
          tone: tone,
          stylePreferences: stylePreferences,
          model: selectedModel
        }

        // Add promptId if a custom prompt is selected
        if (selectedPromptId && selectedPromptId !== 'default') {
          requestBody.promptId = selectedPromptId
        }

        // Add custom prompt content if it has been edited
        if (selectedPromptId && selectedPromptId !== 'default' && selectedPromptContent) {
          requestBody.customPrompt = selectedPromptContent
        }

        const response = await fetch('/api/script/generate-full-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`Failed to generate script for ${section.title}`)
        }

        const data = await response.json()
        
        // Save generated text to database
        const textResponse = await fetch('/api/fine-tuning/texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline_section_id: section.id,
            input_text: section.writing_instructions,
            generated_script: data.script
          })
        })

        const textData = await textResponse.json()

        if (textResponse.ok) {
          dispatch(addGeneratedText({
            sectionId: section.id,
            text: textData.text
          }))
          return { sectionId: section.id, success: true }
        } else {
          return { sectionId: section.id, error: textData.error, success: false }
        }
      } catch (error) {
        return { sectionId: section.id, error: (error as Error).message, success: false }
      }
    })

    const results = await Promise.all(promises)
    
    let successCount = 0
    results.forEach((result: any) => {
      if (result.success) {
        successCount++
      }
    })

    const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
    const promptMessage = selectedPromptId && selectedPromptId !== 'default' ? ' (Using custom prompt)' : ''
    showMessage(
      `Generated ${successCount}/${results.length} scripts successfully!${modelMessage}${promptMessage}`,
      successCount === results.length ? 'success' : 'error'
    )
  }

  // Copy script to clipboard
  const copyScript = async (script: string) => {
    try {
      await navigator.clipboard.writeText(script)
      showMessage('Script copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy script', 'error')
    }
  }

  // Download all scripts
  const downloadAllScripts = () => {
    if (!currentJob) return
    
    const allScripts = currentJob.sections
      .filter((s: FineTuningSection) => s.texts && s.texts.length > 0)
      .map((s: FineTuningSection) => `=== ${s.title} ===\n\n${s.texts?.[0]?.generated_script || ''}\n\n`)
      .join('')
    
    const blob = new Blob([allScripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentJob.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_scripts.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage('Scripts downloaded!', 'success')
  }

  // Handle section rating
  const handleSectionRating = async (
    sectionId: string,
    quality_score: number,
    rating_notes: string,
    isValidated: boolean
  ) => {
    try {
      const updates = {
        quality_score,
        rating_notes
      }

      const response = await fetch('/api/fine-tuning/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, updates })
      })

      if (response.ok) {
        dispatch(updateSectionRating({ sectionId, ...updates }))
        showMessage('Section rating saved successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to save section rating', 'error')
      }
    } catch (error) {
      showMessage('Failed to save section rating', 'error')
    }
  }

  // Handle text rating
  const handleTextRating = async (
    textId: string,
    quality_score: number,
    validation_notes: string,
    is_validated: boolean
  ) => {
    try {
      const response = await fetch('/api/fine-tuning/texts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text_id: textId, 
          quality_score, 
          validation_notes, 
          is_validated 
        })
      })

      if (response.ok) {
        dispatch(updateTextRating({ textId, quality_score, validation_notes, is_validated }))
        showMessage('Text rating saved successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to save text rating', 'error')
      }
    } catch (error) {
      showMessage('Failed to save text rating', 'error')
    }
  }

  const hasGeneratedScripts = currentJob?.sections.some((s: FineTuningSection) => s.texts && s.texts.length > 0)

  // Show loading screen during auth initialization
  if (!user.initialized) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
              <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Initializing authentication...</p>
              </div>
              </div>
    )
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fine-Tuning Script Generator</h1>
          <p className="text-gray-600 mt-1">Create training data for your custom script generation model</p>
          {/* Download Button */}
          {hasGeneratedScripts && user.isLoggedIn && (
            <Button onClick={downloadAllScripts} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download All Scripts
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('generator')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'generator'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Script Generator
            </div>
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assistant'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              AI Assistant
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'generator' && (
        <>
          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg ${
              messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
                {messageType === 'error' && <AlertCircle className="h-4 w-4" />}
                {messageType === 'info' && <FileText className="h-4 w-4" />}
                {message}
              </div>
            </div>
          )}

          {/* Authentication Form */}
          {showAuthForm && !user.isLoggedIn && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Login Required
              </CardTitle>
              <CardDescription>
                  Please log in to create and manage fine-tuning jobs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="authEmail">Email</Label>
                  <Input
                    id="authEmail"
                    type="email"
                    placeholder="your@email.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authPassword">Password</Label>
                  <Input
                    id="authPassword"
                    type="password"
                    placeholder="Your password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
              </div>
                <div className="flex gap-2">
                <Button 
                    onClick={handleLogin}
                    disabled={user.loading || !authEmail.trim() || !authPassword.trim()}
                    className="flex-1"
                  >
                    {user.loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Logging in...
                    </>
                  ) : (
                      'Login'
                  )}
                </Button>
                  <Button 
                    onClick={() => setShowAuthForm(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                    </div>
                {user.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {user.error}
                  </div>
                )}
            </CardContent>
          </Card>
          )}

          {/* Job Creation Form */}
          {!currentJob && user.isLoggedIn && (
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create New Fine-Tuning Job
                  </CardTitle>
                  <CardDescription>
                  Define your job name, theme, and description to start generating training data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                    <Label htmlFor="name">Job Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Marketing Copy Generator"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                      </div>
                      <div className="space-y-2">
                    <Label htmlFor="theme">Theme *</Label>
                    <Input
                      id="theme"
                      placeholder="e.g., Product descriptions, Blog posts"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                    />
                        </div>
                      </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this fine-tuning job will accomplish..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px]"
                  />
                          </div>

                <Button 
                  onClick={handleCreateJob}
                  disabled={!name.trim() || !theme.trim()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Create Fine-Tuning Job
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Current Job Display */}
          {currentJob && user.isLoggedIn && (
            <>
              {/* Job Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{currentJob.name}</CardTitle>
                      <CardDescription>Theme: {currentJob.theme}</CardDescription>
                      {currentJob.prompt_used && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            Prompt: {currentJob.prompt_used.length > 50 
                              ? currentJob.prompt_used.substring(0, 50) + '...' 
                              : currentJob.prompt_used}
                          </Badge>
                        </div>
                      )}
                    </div>
                      <div className="flex items-center gap-2">
                      {currentJob.sectionsGenerated && (
                        <Badge variant="secondary">{currentJob.sections.length} sections</Badge>
                      )}
                      {currentJob.isGeneratingSections && (
                        <Badge variant="secondary">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating
                        </Badge>
                      )}
                      </div>
                    </div>
                  {currentJob.description && (
                    <p className="text-sm text-gray-600 mt-2">
                      {currentJob.description}
                    </p>
                  )}
                </CardHeader>
              </Card>

              {/* Section Configuration */}
              {!currentJob.sectionsGenerated && (
                <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                      <Edit3 className="h-5 w-5" />
                      Configure Script Sections
                </CardTitle>
                    <CardDescription>
                      Set target audience, tone, and style preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="targetAudience">Target Audience</Label>
                        <Input
                          id="targetAudience"
                          placeholder="e.g., Young professionals"
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                        />
                    </div>
                      <div className="space-y-2">
                        <Label htmlFor="tone">Tone</Label>
                        <Input
                          id="tone"
                          placeholder="e.g., Professional, Casual"
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                        />
                  </div>
                      <div className="space-y-2">
                        <Label htmlFor="stylePreferences">Style Preferences</Label>
                        <Input
                          id="stylePreferences"
                          placeholder="e.g., Short sentences, bullet points"
                          value={stylePreferences}
                          onChange={(e) => setStylePreferences(e.target.value)}
                        />
                </div>
                            </div>

                {/* Merge YouTube Data Button */}
                {hasYouTubeData() && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">YouTube Research Integration</Label>
                    <Button
                      onClick={handleMergeYouTubeData}
                      disabled={!selectedPromptContent || mergingData}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800"
                    >
                      {mergingData ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Merging Research Data...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Merge YouTube Research with Prompt
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Enhance your prompt with YouTube video summaries, analysis results, and transcript data using AI
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="selectedPrompt">Select Prompt (Optional)</Label>
                  <Select
                    value={selectedPromptId}
                    onValueChange={handlePromptSelection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={promptsLoading ? "Loading prompts..." : "Use default prompt or select custom"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Crime Dynasty Prompt</SelectItem>
                      {prompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose a custom prompt from your library or use the default Crime Dynasty style guide
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selectedModel">Select Model</Label>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingModels ? "Loading models..." : "Select a model"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (Default)</SelectItem>
                      <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (2025-04-14)</SelectItem>
                      <SelectItem value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano (2025-04-14)</SelectItem>
                      <SelectItem value="gpt-4o-mini-2024-07-18">GPT-4o Mini (2024-07-18)</SelectItem>
                      {fineTunedModels.length > 0 && (
                        <>
                          <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                            --- Your Fine-Tuned Models ---
                          </SelectItem>
                          {fineTunedModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name.split(':').pop()} (based on {model.baseModel})
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose between standard OpenAI models or your fine-tuned models
                    {loadingModels && " (Loading your fine-tuned models...)"}
                  </p>
                </div>

                {/* Prompt Editor */}
                {showPromptEditor && (
                  <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Edit Prompt Content
                        {promptContentLoading && (
                          <Loader2 className="h-3 w-3 animate-spin inline ml-2" />
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          onClick={savePromptChanges}
                          size="sm"
                          variant="outline"
                          disabled={!selectedPromptContent.trim()}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Save Changes
                        </Button>
                        <Button
                          onClick={() => dispatch(setShowPromptEditor(false))}
                          size="sm"
                          variant="outline"
                        >
                          Hide
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={selectedPromptContent}
                      onChange={(e) => dispatch(setSelectedPromptContent(e.target.value))}
                      placeholder="Edit your prompt content here..."
                      className="min-h-[200px] bg-white"
                      disabled={promptContentLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Modifications will be used for script generation. Click "Save Changes" to update the original prompt in your library.
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleGenerateSections}
                  disabled={currentJob.isGeneratingSections}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {currentJob.isGeneratingSections ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Sections...
                                  </>
                                ) : (
                                  <>
                      <Edit3 className="h-4 w-4" />
                      Generate Script Sections
                                  </>
                                )}
                </Button>
                        </CardContent>
                      </Card>
              )}

              {/* Sections */}
              {currentJob.sectionsGenerated && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Edit3 className="h-5 w-5" />
                        Script Sections
                      </CardTitle>
                      <Button 
                        onClick={handleGenerateAllScripts}
                        disabled={currentJob.sections.some((s: FineTuningSection) => s.isGeneratingScript)}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Generate All Scripts
                      </Button>
                    </div>
                    <CardDescription>
                      Review and edit sections, then generate training scripts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {currentJob.sections.map((section: FineTuningSection) => (
                        <div key={section.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <Input
                                value={section.title}
                                onChange={(e) => dispatch(updateSection({ 
                                  sectionId: section.id, 
                                  updates: { title: e.target.value }
                                }))}
                                className="font-medium text-lg border-none p-0 focus:ring-0"
                                placeholder="Section title"
                              />
                          </div>
                          <div className="flex items-center gap-2">
                              {section.texts && section.texts.length > 0 && (
                                    <Button
                                  onClick={() => copyScript(section.texts[0].generated_script)}
                                      variant="outline"
                                      size="sm"
                                    >
                                  <Copy className="h-3 w-3" />
                                    </Button>
                              )}
                                    <Button
                                onClick={() => handleGenerateScript(section)}
                                disabled={section.isGeneratingScript}
                                      size="sm"
                                >
                                {section.isGeneratingScript ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                  <Play className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            
                                    <Textarea
                            value={section.writing_instructions}
                            onChange={(e) => dispatch(updateSection({ 
                              sectionId: section.id, 
                              updates: { writing_instructions: e.target.value }
                            }))}
                            placeholder="Writing instructions for this section..."
                            className="min-h-[80px]"
                          />
                          
                          {/* Section Rating */}
                          <div className="mt-3">
                            <RatingComponent
                              title="Section"
                              currentRating={section.quality_score || 0}
                              currentNotes={section.rating_notes || ''}
                              isValidated={false}
                              showValidation={false}
                              onRatingChange={(rating, notes, validated) => {
                                handleSectionRating(section.id, rating, notes, validated)
                              }}
                            />
                        </div>

                          {section.texts && section.texts.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800">Generated Script</span>
                                <Badge variant="secondary">{section.texts.length} version(s)</Badge>
                                      </div>
                              <div className="bg-white rounded p-3 text-sm whitespace-pre-wrap border">
                                {section.texts[0].generated_script}
                                      </div>
                              <div className="mt-2 text-xs text-gray-500">
                                {section.texts[0].character_count} characters • {section.texts[0].word_count} words
                              </div>
                              
                              {/* Text Rating */}
                              <div className="mt-3">
                                <RatingComponent
                                  title="Generated Text"
                                  currentRating={section.texts[0].quality_score || 0}
                                  currentNotes={section.texts[0].validation_notes || ''}
                                  isValidated={section.texts[0].is_validated || false}
                                  showValidation={true}
                                  onRatingChange={(rating, notes, validated) => {
                                    if (section.texts[0].id) {
                                      handleTextRating(section.texts[0].id, rating, notes, validated)
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          )}
                                  </div>
                  ))}
                              </div>
                  </CardContent>
                </Card>
                  )}
            </>
          )}

          {/* Empty State */}
          {!currentJob && user.isLoggedIn && (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your First Fine-Tuning Job</h3>
                <p className="text-gray-500 mb-4">
                  Create a fine-tuning job to generate training data for your custom script generation model.
                </p>
                  </CardContent>
                </Card>
          )}

          {/* Unauthenticated State */}
          {!user.isLoggedIn && !showAuthForm && (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
                <p className="text-gray-500 mb-4">
                  Please log in to access the fine-tuning script generator.
                </p>
                                    <Button
                onClick={() => setShowAuthForm(true)}
                className="flex items-center gap-2"
                  >
                <User className="h-4 w-4" />
                Login to Continue
                                    </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Assistant Tab Content */}
      {activeTab === 'assistant' && (
        <ChatbotTab />
      )}
    </div>
  )
} 