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
  // New imports for approval workflow
  setPendingSections,
  startApprovingSections,
  finishApprovingSections,
  rejectPendingSections,
  setPendingScript,
  startApprovingScript,
  finishApprovingScript,
  rejectPendingScript,
  updatePendingScripts,
  type PendingSection,
  type PendingScript,
  generateAudioThunk
} from '../lib/features/scripts/scriptsSlice'
import { initializeAuth, loginUser, logoutUser } from '../lib/features/user/userSlice'
import { selectAvailableClips, populateClipsFromAnalysis, type AvailableClip } from '../lib/features/youtube/youtubeSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { RatingComponent } from './ui/rating'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { FileText, Loader2, Edit3, Play, Download, Copy, CheckCircle, AlertCircle, User, LogOut, Lock, Settings, MessageCircle, Send, Bot, Eye, Zap, Plus, Trash2, Paperclip, Clock, Quote, Video } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// Timestamp interface for selection with enhanced element types
interface AvailableTimestamp {
  id: string
  videoId: string
  videoTitle: string
  youtubeUrl: string
  startTime: string
  endTime: string
  description: string
  quote?: string
  speaker?: string
  source: 'analysis' | 'research' | 'gemini'
  confidence?: number
  elementType?: 'quote' | 'background_footage' | 'crime_scene' | 'dramatic_moment' | 'security_camera' | 'news_footage' | 'court_footage' | 'evidence' | 'the_moment'
}

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
    mergingData,
    // New pending approval states
    pendingSections,
    pendingScripts,
    approvingSections,
    approvingScript,
    // Audio generation state
    audioGeneration
  } = useAppSelector(state => state.scripts)
  
  // Get YouTube data from Redux
  const youtubeState = useAppSelector(state => state.youtube)
  const availableClips = useAppSelector(selectAvailableClips)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'generator' | 'assistant'>('generator')
  
  // Form inputs
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('')
  const [stylePreferences, setStylePreferences] = useState('')
  
  // AI will automatically determine optimal sections based on content
  
  // Intro hook settings
  const [enableIntroHook, setEnableIntroHook] = useState(false)
  const [introHookWordCount, setIntroHookWordCount] = useState(50)
  
  // Preview modal state
  const [showResearchPreview, setShowResearchPreview] = useState(false)
  const [previewResearchData, setPreviewResearchData] = useState('')

  // Clip attachment state
  const [showClipAttachment, setShowClipAttachment] = useState(false)
  const [selectedClip, setSelectedClip] = useState<AvailableClip | null>(null)
  const [clipAttachmentTarget, setClipAttachmentTarget] = useState<{
    sectionId: string
    textareaRef: React.RefObject<HTMLTextAreaElement>
  } | null>(null)

  // Timestamp selection state
  const [showTimestampPicker, setShowTimestampPicker] = useState(false)
  const [selectedTimestamp, setSelectedTimestamp] = useState<AvailableTimestamp | null>(null)
  const [timestampInsertionTarget, setTimestampInsertionTarget] = useState<{
    textId: string
    textareaRef: React.RefObject<HTMLTextAreaElement>
  } | null>(null)
  const [availableTimestamps, setAvailableTimestamps] = useState<AvailableTimestamp[]>([])
  
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

  // Load available timestamps when YouTube data changes
  useEffect(() => {
    const timestamps: AvailableTimestamp[] = []
    
    // Extract timestamps from video summaries with enhanced element types
    if (youtubeState.videosSummary?.videoSummaries) {
      youtubeState.videosSummary.videoSummaries.forEach(video => {
        if (video.timestamps) {
          video.timestamps.forEach((timestamp, index) => {
            timestamps.push({
              id: `summary-${video.videoId}-${index}`,
              videoId: video.videoId,
              videoTitle: video.title,
              youtubeUrl: `https://youtube.com/watch?v=${video.videoId}`,
              startTime: timestamp.startTime,
              endTime: timestamp.endTime,
              description: timestamp.description,
              quote: timestamp.quote,
              speaker: timestamp.speaker,
              source: 'research',
              elementType: (timestamp as any).elementType || 'quote' // Extract enhanced element type
            })
          })
        }
      })
    }

    // Extract timestamps from YouTube research summaries with enhanced element types
    youtubeState.youtubeResearchSummaries.forEach(research => {
      research.videosSummary.videoSummaries.forEach(video => {
        if (video.timestamps) {
          video.timestamps.forEach((timestamp, index) => {
            timestamps.push({
              id: `youtube-research-${video.videoId}-${index}`,
              videoId: video.videoId,
              videoTitle: video.title,
              youtubeUrl: `https://youtube.com/watch?v=${video.videoId}`,
              startTime: timestamp.startTime,
              endTime: timestamp.endTime,
              description: timestamp.description,
              quote: timestamp.quote,
              speaker: timestamp.speaker,
              source: 'research',
              elementType: (timestamp as any).elementType || 'quote' // Extract enhanced element type
            })
          })
        }
      })
    })

    // Extract timestamps from analysis results with enhanced element types
    youtubeState.analysisResults.forEach(result => {
      const video = youtubeState.videos.find(v => v.id.videoId === result.videoId)
      const videoTitle = video?.snippet?.title || `Video ${result.videoId}`
      
      result.analysis.forEach((analysis, index) => {
        if (analysis.timestamp) {
          timestamps.push({
            id: `analysis-${result.videoId}-${index}`,
            videoId: result.videoId,
            videoTitle,
            youtubeUrl: analysis.youtubeUrl || `https://youtube.com/watch?v=${result.videoId}`,
            startTime: analysis.timestamp,
            endTime: analysis.timestamp, // Same as start time for analysis results
            description: analysis.summary,
            quote: analysis.keyQuotes?.[0],
            source: 'analysis',
            confidence: analysis.confidence,
            elementType: (analysis as any).elementType || 'quote' // Extract enhanced element type
          })
        }
      })
    })

    setAvailableTimestamps(timestamps)
  }, [youtubeState])

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

  // Build comprehensive research data
  const buildFullResearchData = () => {
    let fullResearchData = ''
    
    // Check if we have YouTube research data available
    const hasVideosSummary = !!youtubeState.videosSummary
    const hasAnalysisResults = youtubeState.analysisResults && youtubeState.analysisResults.length > 0
    const hasGoogleResearch = youtubeState.googleResearchSummaries && youtubeState.googleResearchSummaries.length > 0
    const hasYouTubeResearch = youtubeState.youtubeResearchSummaries && youtubeState.youtubeResearchSummaries.length > 0
    const hasCompletedSubtitles = youtubeState.subtitleFiles && youtubeState.subtitleFiles.filter(sf => sf.status === 'completed').length > 0
    
    if (hasVideosSummary || hasAnalysisResults || hasGoogleResearch || hasYouTubeResearch || hasCompletedSubtitles) {
      fullResearchData = '\n\n=== COMPREHENSIVE YOUTUBE RESEARCH DATA ===\n'
      
      // Add video collection analysis
      if (hasVideosSummary) {
        fullResearchData += '\n--- VIDEO COLLECTION ANALYSIS ---\n'
        fullResearchData += `Overall Theme: ${youtubeState.videosSummary?.overallTheme}\n\n`
        fullResearchData += 'Key Insights:\n'
        youtubeState.videosSummary?.keyInsights.forEach((insight, i) => {
          fullResearchData += `${i + 1}. ${insight}\n`
        })
        
        // Add individual video summaries with complete details
        if (youtubeState.videosSummary?.videoSummaries && youtubeState.videosSummary.videoSummaries.length > 0) {
          fullResearchData += '\n--- INDIVIDUAL VIDEO SUMMARIES WITH TIMESTAMPS ---\n'
          youtubeState.videosSummary.videoSummaries.forEach((video, i) => {
            const videoUrl = `https://youtube.com/watch?v=${video.videoId}`
            fullResearchData += `\n=== Video ${i + 1}: ${video.title} ===\n`
            fullResearchData += `URL: ${videoUrl}\n`
            fullResearchData += `Video ID: ${video.videoId}\n`
            fullResearchData += `Main Topic: ${video.mainTopic}\n`
            fullResearchData += `Emotional Tone: ${video.emotionalTone}\n`
            
            if (video.keyPoints && video.keyPoints.length > 0) {
              fullResearchData += `\nKey Points:\n`
              video.keyPoints.forEach((point, idx) => {
                fullResearchData += `  ${idx + 1}. ${point}\n`
              })
            }
            
            if (video.keyQuotes && video.keyQuotes.length > 0) {
              fullResearchData += `\nKey Quotes:\n`
              video.keyQuotes.forEach((quote, idx) => {
                fullResearchData += `  "${quote}"\n`
              })
            }
            
                         // Add all timestamps with details
             if (video.timestamps && video.timestamps.length > 0) {
               fullResearchData += `\nTimestamps & Clips (${video.timestamps.length} total):\n`
               video.timestamps.forEach((timestamp, idx) => {
                 fullResearchData += `  ${idx + 1}. ${timestamp.startTime} - ${timestamp.endTime || 'End'}\n`
                 fullResearchData += `     Speaker: ${timestamp.speaker}\n`
                 fullResearchData += `     Description: ${timestamp.description}\n`
                 if (timestamp.quote) {
                   fullResearchData += `     Quote: "${timestamp.quote}"\n`
                 }
                 if (timestamp.extraInfo) {
                   fullResearchData += `     Extra Info: ${timestamp.extraInfo}\n`
                 }
                 if (timestamp.significance) {
                   fullResearchData += `     Significance: ${timestamp.significance}\n`
                 }
                 fullResearchData += `     URL with timestamp: ${videoUrl}&t=${timestamp.startTime.replace(/:/g, 'm').replace(/m$/, 's')}\n`
               })
             }
            
            if (video.timestamp) {
              fullResearchData += `\nMain Timestamp: ${video.timestamp}\n`
              fullResearchData += `Main Timestamp URL: ${videoUrl}&t=${video.timestamp.replace(/:/g, 'm').replace(/m$/, 's')}\n`
            }
            
            if (video.contextualInfo) {
              fullResearchData += `\nContextual Info: ${video.contextualInfo}\n`
            }
            
            fullResearchData += '\n' + '='.repeat(50) + '\n'
          })
        }
      }
      
      // Add Perplexity research summaries
      if (hasGoogleResearch) {
        fullResearchData += '\n--- PERPLEXITY RESEARCH SUMMARIES ---\n'
        youtubeState.googleResearchSummaries.forEach((research, i) => {
          const isApplied = research.appliedToScript ? ' [APPLIED]' : ''
          fullResearchData += `\nPerplexity Research ${i + 1}${isApplied}: ${research.query}\n`
          
          // Use rich research data if available
          if (research.researchSummary) {
            const rs = research.researchSummary
            fullResearchData += `Overall Theme: ${rs.overallTheme}\n`
            
            if (rs.keyInsights && rs.keyInsights.length > 0) {
              fullResearchData += `Key Insights:\n`
              rs.keyInsights.forEach((insight, idx) => {
                fullResearchData += `  ${idx + 1}. ${insight}\n`
              })
            }
            
            if (rs.visualAudioCues && rs.visualAudioCues.length > 0) {
              fullResearchData += `Visual/Audio Cues:\n`
              rs.visualAudioCues.forEach((cue, idx) => {
                fullResearchData += `  ${idx + 1}. ${cue}\n`
              })
            }
            
            if (rs.audienceQuestions && rs.audienceQuestions.length > 0) {
              fullResearchData += `Audience Questions/Hooks:\n`
              rs.audienceQuestions.forEach((question, idx) => {
                fullResearchData += `  ${idx + 1}. ${question}\n`
              })
            }
            
            if (rs.conflictElements && rs.conflictElements.length > 0) {
              fullResearchData += `Dramatic Elements:\n`
              rs.conflictElements.forEach((element, idx) => {
                fullResearchData += `  ${idx + 1}. ${element}\n`
              })
            }
            
            if (rs.storyIdeas && rs.storyIdeas.length > 0) {
              fullResearchData += `Story Ideas:\n`
              rs.storyIdeas.forEach((idea, idx) => {
                fullResearchData += `  ${idx + 1}. ${idea}\n`
              })
            }
            
            if (rs.creativePrompt) {
              fullResearchData += `Creative Prompt: ${rs.creativePrompt}\n`
            }
            
            if (rs.actionableItems && rs.actionableItems.length > 0) {
              fullResearchData += `Actionable Items:\n`
              rs.actionableItems.forEach((item, idx) => {
                fullResearchData += `  ${idx + 1}. ${item}\n`
              })
            }
          } else {
            // Fallback to legacy format
          fullResearchData += `Insights: ${research.insights}\n`
          }
          
          fullResearchData += '---\n'
        })
      }
      
      // Add YouTube research summaries
      if (hasYouTubeResearch) {
        fullResearchData += '\n--- YOUTUBE RESEARCH SUMMARIES ---\n'
        youtubeState.youtubeResearchSummaries.forEach((research, i) => {
          const isApplied = research.appliedToScript ? ' [APPLIED]' : ''
          fullResearchData += `\nYouTube Research ${i + 1}${isApplied}: ${research.query}\n`
          fullResearchData += `Overall Theme: ${research.videosSummary.overallTheme}\n`
          if (research.videosSummary.keyInsights) {
            fullResearchData += `Key Insights:\n`
            research.videosSummary.keyInsights.forEach((insight, idx) => {
              fullResearchData += `  ${idx + 1}. ${insight}\n`
            })
          }
          
          // Add detailed video summaries with timestamps from YouTube research
          if (research.videosSummary.videoSummaries && research.videosSummary.videoSummaries.length > 0) {
            fullResearchData += `\nDetailed Video Analysis:\n`
            research.videosSummary.videoSummaries.forEach((video, videoIdx) => {
              const videoUrl = `https://youtube.com/watch?v=${video.videoId}`
              fullResearchData += `\n  Video ${videoIdx + 1}: ${video.title}\n`
              fullResearchData += `  URL: ${videoUrl}\n`
              fullResearchData += `  Main Topic: ${video.mainTopic}\n`
              fullResearchData += `  Emotional Tone: ${video.emotionalTone}\n`
              
              if (video.keyPoints && video.keyPoints.length > 0) {
                fullResearchData += `  Key Points:\n`
                video.keyPoints.forEach((point, pointIdx) => {
                  fullResearchData += `    ${pointIdx + 1}. ${point}\n`
                })
              }
              
              if (video.keyQuotes && video.keyQuotes.length > 0) {
                fullResearchData += `  Key Quotes:\n`
                video.keyQuotes.forEach((quote, quoteIdx) => {
                  fullResearchData += `    "${quote}"\n`
                })
              }
              
              // Add all timestamps with details
              if (video.timestamps && video.timestamps.length > 0) {
                fullResearchData += `  Timestamps & Clips (${video.timestamps.length} total):\n`
                video.timestamps.forEach((timestamp, tsIdx) => {
                  fullResearchData += `    ${tsIdx + 1}. ${timestamp.startTime} - ${timestamp.endTime || 'End'}\n`
                  fullResearchData += `       Speaker: ${timestamp.speaker}\n`
                  fullResearchData += `       Description: ${timestamp.description}\n`
                  if (timestamp.quote) {
                    fullResearchData += `       Quote: "${timestamp.quote}"\n`
                  }
                  if (timestamp.extraInfo) {
                    fullResearchData += `       Extra Info: ${timestamp.extraInfo}\n`
                  }
                  if (timestamp.significance) {
                    fullResearchData += `       Significance: ${timestamp.significance}\n`
                  }
                  fullResearchData += `       URL with timestamp: ${videoUrl}&t=${timestamp.startTime.replace(/:/g, 'm').replace(/m$/, 's')}\n`
                })
              }
              
              if (video.timestamp) {
                fullResearchData += `  Main Timestamp: ${video.timestamp}\n`
                fullResearchData += `  Main Timestamp URL: ${videoUrl}&t=${video.timestamp.replace(/:/g, 'm').replace(/m$/, 's')}\n`
              }
              
              if (video.contextualInfo) {
                fullResearchData += `  Contextual Info: ${video.contextualInfo}\n`
              }
              
              fullResearchData += `  ${'-'.repeat(30)}\n`
            })
          }
          
          fullResearchData += '---\n'
        })
      }
      
             // Add analysis results
       if (hasAnalysisResults) {
         fullResearchData += '\n--- ANALYSIS RESULTS ---\n'
         youtubeState.analysisResults.forEach((result, i) => {
           const videoUrl = `https://youtube.com/watch?v=${result.videoId}`
           fullResearchData += `\nAnalysis ${i + 1}: ${result.query}\n`
           fullResearchData += `Video ID: ${result.videoId}\n`
           fullResearchData += `Video URL: ${videoUrl}\n`
           
           if (result.analysis && result.analysis.length > 0) {
             fullResearchData += `Analysis Results:\n`
             result.analysis.forEach((analysis, idx) => {
               fullResearchData += `  ${idx + 1}. ${analysis.summary}\n`
               if (analysis.relevantContent) {
                 fullResearchData += `     Relevant Content: ${analysis.relevantContent}\n`
               }
               if (analysis.youtubeUrl) {
                 fullResearchData += `     URL: ${analysis.youtubeUrl}\n`
               }
               if (analysis.dramaticElements && analysis.dramaticElements.length > 0) {
                 fullResearchData += `     Dramatic Elements: ${analysis.dramaticElements.join(', ')}\n`
               }
               if (analysis.keyQuotes && analysis.keyQuotes.length > 0) {
                 fullResearchData += `     Key Quotes: ${analysis.keyQuotes.join('; ')}\n`
               }
               
               // Add timestamp if available in analysis (single timestamp, not array)
               if (analysis.timestamp) {
                 fullResearchData += `     Timestamp: ${analysis.timestamp}\n`
                 fullResearchData += `     URL with timestamp: ${videoUrl}&t=${analysis.timestamp.replace(/:/g, 'm').replace(/m$/, 's')}\n`
               }
             })
           }
           fullResearchData += '---\n'
         })
       }
      
      fullResearchData += '\n=== END COMPREHENSIVE RESEARCH DATA ===\n'
    }
    
    return fullResearchData
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
      // Build comprehensive research context
      const fullResearchData = buildFullResearchData()
      const additionalContext = fullResearchData ? 'This script should incorporate insights from analyzed YouTube videos and research data with specific timestamps and clips.' : ''
      const additionalResearch = fullResearchData

      const requestBody: any = {
        theme: currentJob.theme,
        title: currentJob.name,
        target_audience: targetAudience,
        tone: tone,
        style_preferences: stylePreferences,
        model: selectedModel,
        additionalContext,
        additionalResearch,
        enableIntroHook: enableIntroHook,
        introHookWordCount: introHookWordCount
      }

      // Add promptId if a custom prompt is selected
      if (selectedPromptId && selectedPromptId !== 'default') {
        requestBody.promptId = selectedPromptId
      }

      // Add custom prompt content if it has been edited
      if (selectedPromptId && selectedPromptId !== 'default' && selectedPromptContent) {
        requestBody.customPrompt = selectedPromptContent
      }

      console.log('🚀 Sending section generation request with:', {
        theme: requestBody.theme,
        title: requestBody.title,
        hasAdditionalContext: !!additionalContext,
        additionalResearchLength: additionalResearch.length,
        model: requestBody.model
      })

      const response = await fetch('/api/script/generate-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Failed to generate sections')
      }

      const data = await response.json()
      
      // Convert generated sections to pending sections for approval
      const pendingSections: PendingSection[] = data.sections.map((section: any) => ({
        id: section.id,
        title: section.title,
        writingInstructions: section.writingInstructions,
        tempId: `temp-${Date.now()}-${Math.random()}`
      }))
      
      dispatch(setPendingSections(pendingSections))
      const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
      const promptMessage = selectedPromptId && selectedPromptId !== 'default' ? ' (Using custom prompt)' : ''
      const youtubeMessage = additionalResearch ? ' (Enhanced with YouTube data)' : ''
      showMessage(`Sections generated! Please review and approve.${modelMessage}${promptMessage}${youtubeMessage} ${data.usingMock ? '(Using mock data)' : ''}`, 'success')
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
      // Build comprehensive research context
      const fullResearchData = buildFullResearchData()
      const additionalContext = fullResearchData ? 'This script should incorporate insights from analyzed YouTube videos and research data with specific timestamps and clips.' : ''
      const additionalResearch = fullResearchData

      const requestBody: any = {
        title: section.title,
        writingInstructions: section.writing_instructions,
        theme: currentJob?.theme,
        targetAudience: targetAudience,
        tone: tone,
        stylePreferences: stylePreferences,
        model: selectedModel,
        additionalContext,
        additionalResearch,
        youtubeLinks: section.youtubeLinks || []
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

      // Create pending script for approval
      const pendingScript: PendingScript = {
        sectionId: section.id,
        title: section.title,
        writingInstructions: section.writing_instructions,
        generatedScript: data.script,
        tempId: `temp-${Date.now()}-${Math.random()}`,
        characterCount: data.script.length,
        wordCount: data.script.trim().split(/\s+/).length,
        youtubeLinks: section.youtubeLinks
      }
      
      dispatch(setPendingScript(pendingScript))
      const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
      const promptMessage = selectedPromptId && selectedPromptId !== 'default' ? ' (Using custom prompt)' : ''
      const youtubeMessage = additionalResearch ? ' (Enhanced with YouTube data)' : ''
      showMessage(`Script generated! Please review and approve.${modelMessage}${promptMessage}${youtubeMessage} ${data.usingMock ? '(Using mock data)' : ''}`, 'success')
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

    // Build comprehensive research context once for all sections
    const fullResearchData = buildFullResearchData()
    const additionalContext = fullResearchData ? 'This script should incorporate insights from analyzed YouTube videos and research data with specific timestamps and clips.' : ''
    const additionalResearch = fullResearchData

    const promises = currentJob.sections.map(async (section: FineTuningSection) => {
      try {

        const requestBody: any = {
          title: section.title,
          writingInstructions: section.writing_instructions,
          theme: currentJob.theme,
          targetAudience: targetAudience,
          tone: tone,
          stylePreferences: stylePreferences,
          model: selectedModel,
          additionalContext,
          additionalResearch,
          youtubeLinks: section.youtubeLinks || []
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
        
        // Create pending script for approval instead of saving directly
        const pendingScript: PendingScript = {
          sectionId: section.id,
          title: section.title,
          writingInstructions: section.writing_instructions,
          generatedScript: data.script,
          tempId: `temp-${Date.now()}-${Math.random()}-${section.id}`,
          characterCount: data.script.length,
          wordCount: data.script.trim().split(/\s+/).length,
          youtubeLinks: section.youtubeLinks
        }
        
        return { sectionId: section.id, pendingScript, success: true }
      } catch (error) {
        return { sectionId: section.id, error: (error as Error).message, success: false }
      }
    })

    const results = await Promise.all(promises)
    
    // Process results and create pending scripts
    const successfulPendingScripts: PendingScript[] = []
    let successCount = 0
    
    results.forEach((result: any) => {
      if (result.success && result.pendingScript) {
        successfulPendingScripts.push(result.pendingScript)
        successCount++
      }
    })

    // Add all successful pending scripts to the state
    successfulPendingScripts.forEach(pendingScript => {
      dispatch(setPendingScript(pendingScript))
    })

    const modelMessage = selectedModel !== 'gpt-4.1-mini' ? ` (Using ${selectedModel})` : ''
    const promptMessage = selectedPromptId && selectedPromptId !== 'default' ? ' (Using custom prompt)' : ''
    
    // Check if YouTube data was used
    const hasYouTubeData = !!youtubeState.videosSummary || 
                          (youtubeState.googleResearchSummaries && youtubeState.googleResearchSummaries.length > 0) ||
                          (youtubeState.youtubeResearchSummaries && youtubeState.youtubeResearchSummaries.length > 0)
    const youtubeMessage = hasYouTubeData ? ' (Enhanced with YouTube data)' : ''
    
    if (successCount === results.length) {
      showMessage(
        `Generated ${successCount} scripts successfully! Please review and approve them below.${modelMessage}${promptMessage}${youtubeMessage}`,
        'success'
      )
    } else {
      showMessage(
        `Generated ${successCount}/${results.length} scripts successfully! Please review and approve them below.${modelMessage}${promptMessage}${youtubeMessage}`,
        'info'
      )
    }
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

  // Generate audio from all scripts combined
  const generateCombinedAudio = async () => {
    if (!currentJob) return
    
    const sectionsWithScripts = currentJob.sections.filter((s: FineTuningSection) => s.texts && s.texts.length > 0)
    
    if (sectionsWithScripts.length === 0) {
      showMessage('No approved scripts found to generate audio from', 'error')
      return
    }

    // Concatenate all scripts and remove YouTube timestamps
    const combinedScript = sectionsWithScripts
      .map((s: FineTuningSection) => s.texts?.[0]?.generated_script || '')
      .join('\n\n')
    
    // Import the removeYouTubeTimestamps function
    const { removeYouTubeTimestamps } = await import('../utils/youtube-utils')
    const cleanedScript = removeYouTubeTimestamps(combinedScript)
    
    if (!cleanedScript.trim()) {
      showMessage('No content available after cleaning timestamps', 'error')
      return
    }

    showMessage('Generating audio from combined scripts...', 'info')
    
    try {
      // Use existing audioGeneration state
      const result = await dispatch(generateAudioThunk({
        sectionId: 'combined-all-scripts',
        text: cleanedScript,
        voiceId: audioGeneration.selectedVoice || 'EXAVITQu4vr4xnSDxMaL', // Default voice
        modelId: audioGeneration.selectedModel || 'eleven_multilingual_v2'
      }))

      if (result.success) {
        showMessage(`Audio generated successfully from ${sectionsWithScripts.length} combined scripts!`, 'success')
      } else {
        showMessage(result.error || 'Failed to generate combined audio', 'error')
      }
    } catch (error) {
      console.error('Error generating combined audio:', error)
      showMessage('Failed to generate combined audio', 'error')
    }
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

  // Helper function to get prompt used text
  const getPromptUsedText = () => {
    if (selectedPromptId && selectedPromptId !== 'default') {
      if (selectedPromptContent) {
        return selectedPromptContent
      } else {
        const selectedPrompt = prompts.find(p => p.id === selectedPromptId)
        if (selectedPrompt) {
          return `${selectedPrompt.title}: ${selectedPrompt.prompt}`
        }
      }
    }
    return 'Default Prompt'
  }

  // Approve pending sections
  const handleApproveSections = async () => {
    if (!currentJob || pendingSections.length === 0) return

    dispatch(startApprovingSections())

    try {
      const response = await fetch('/api/script/approve-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: currentJob.id,
          sections: pendingSections,
          promptUsed: getPromptUsedText()
        })
      })

      const data = await response.json()

      if (response.ok) {
        dispatch(setSections(data.sections))
        dispatch(finishApprovingSections())
        showMessage(`${data.sections.length} sections approved and saved successfully!`, 'success')
      } else {
        showMessage(data.error || 'Failed to approve sections', 'error')
      }
    } catch (error) {
      showMessage('Failed to approve sections', 'error')
    }
  }

  // Reject pending sections
  const handleRejectSections = () => {
    dispatch(rejectPendingSections())
    showMessage('Sections rejected. You can generate new ones.', 'info')
  }

  // Approve pending script
  const handleApproveScript = async (pendingScript: PendingScript) => {
    dispatch(startApprovingScript(pendingScript.tempId))

    try {
      const response = await fetch('/api/script/approve-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline_section_id: pendingScript.sectionId,
          input_text: pendingScript.writingInstructions,
          generated_script: pendingScript.generatedScript
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Structure the data correctly for Redux state
        const textForRedux = {
          id: data.text.id,
          input_text: data.text.input_text,
          generated_script: data.text.generated_script,
          text_order: data.text.text_order,
          quality_score: data.text.quality_score,
          is_validated: data.text.is_validated || false,
          validation_notes: data.text.validation_notes,
          character_count: data.text.character_count,
          word_count: data.text.word_count
        }

        dispatch(addGeneratedText({
          sectionId: pendingScript.sectionId,
          text: textForRedux
        }))
        dispatch(finishApprovingScript(pendingScript.tempId))
        showMessage('Script approved and saved successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to approve script', 'error')
        dispatch(finishApprovingScript(pendingScript.tempId)) // Stop spinner even on error
      }
    } catch (error) {
      showMessage('Failed to approve script', 'error')
      dispatch(finishApprovingScript(pendingScript.tempId)) // Stop spinner even on error
    }
  }

  // Approve all pending scripts
  const handleApproveAllScripts = async () => {
    if (pendingScripts.length === 0) return

    showMessage('Approving all scripts...', 'info')

    const promises = pendingScripts.map(async (pendingScript) => {
      try {
        const response = await fetch('/api/script/approve-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline_section_id: pendingScript.sectionId,
            input_text: pendingScript.writingInstructions,
            generated_script: pendingScript.generatedScript
          })
        })

        const data = await response.json()

        if (response.ok) {
          return { success: true, pendingScript, apiData: data }
        } else {
          return { success: false, pendingScript, error: data.error }
        }
      } catch (error) {
        return { success: false, pendingScript, error: (error as Error).message }
      }
    })

    const results = await Promise.all(promises)
    
    let successCount = 0
    results.forEach((result: any) => {
      if (result.success) {
        // Structure the data correctly for Redux state
        const textForRedux = {
          id: result.apiData.text.id,
          input_text: result.apiData.text.input_text,
          generated_script: result.apiData.text.generated_script,
          text_order: result.apiData.text.text_order,
          quality_score: result.apiData.text.quality_score,
          is_validated: result.apiData.text.is_validated || false,
          validation_notes: result.apiData.text.validation_notes,
          character_count: result.apiData.text.character_count,
          word_count: result.apiData.text.word_count
        }

        dispatch(addGeneratedText({
          sectionId: result.pendingScript.sectionId,
          text: textForRedux
        }))
        dispatch(finishApprovingScript(result.pendingScript.tempId))
        successCount++
      }
    })

    if (successCount === results.length) {
      showMessage(`All ${successCount} scripts approved and saved successfully!`, 'success')
    } else {
      showMessage(`${successCount}/${results.length} scripts approved successfully. Some failed.`, 'info')
    }
  }

  // Reject pending script
  const handleRejectScript = (tempId: string) => {
    dispatch(rejectPendingScript(tempId))
    showMessage('Script rejected. You can generate a new one.', 'info')
  }

  // Update section in pending state
  const updatePendingSection = (tempId: string, updates: Partial<PendingSection>) => {
    const updatedSections = pendingSections.map(section => 
      section.tempId === tempId ? { ...section, ...updates } : section
    )
    dispatch(setPendingSections(updatedSections))
  }

  // Update pending script content
  const updatePendingScript = (tempId: string, updates: Partial<PendingScript>) => {
    const updatedScripts = pendingScripts.map(script => 
      script.tempId === tempId ? { 
        ...script, 
        ...updates,
        // Recalculate counts if script content changed
        characterCount: updates.generatedScript ? updates.generatedScript.length : script.characterCount,
        wordCount: updates.generatedScript ? updates.generatedScript.trim().split(/\s+/).length : script.wordCount
      } : script
    )
    // Use the new action to update the entire array at once
    dispatch(updatePendingScripts(updatedScripts))
  }

  // Preview research data
  const handlePreviewResearch = () => {
    const researchData = buildFullResearchData()
    if (researchData) {
      setPreviewResearchData(researchData)
      setShowResearchPreview(true)
    } else {
      showMessage('No research data available to preview', 'info')
    }
  }

  // Add new pending section
  const addNewPendingSection = () => {
    const newSection: PendingSection = {
      id: `new-${Date.now()}`,
      title: 'New Section',
      writingInstructions: 'Add your writing instructions here...',
      tempId: `temp-${Date.now()}-${Math.random()}`
    }
    
    const updatedSections = [...pendingSections, newSection]
    dispatch(setPendingSections(updatedSections))
    showMessage('New section added', 'success')
  }

  // Remove pending section
  const removePendingSection = (tempId: string) => {
    const updatedSections = pendingSections.filter(section => section.tempId !== tempId)
    dispatch(setPendingSections(updatedSections))
    showMessage('Section removed', 'success')
  }

  // Add new section to approved job
  const addNewSection = async () => {
    if (!currentJob) return

    try {
      const newSectionData = {
        title: 'New Section',
        writingInstructions: 'Add your writing instructions here...',
        target_audience: 'General',
        tone: 'Professional',
        style_preferences: 'Clear and engaging'
      }

      const requestBody = {
        job_id: currentJob.id,
        sections: [newSectionData],
        promptUsed: getPromptUsedText()
      }

      const response = await fetch('/api/fine-tuning/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.sections && data.sections.length > 0) {
          // Add the new section to the current job sections
          const updatedSections = [...currentJob.sections, data.sections[0]]
          dispatch(setSections(updatedSections))
          showMessage('New section added successfully!', 'success')
        }
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to add section', 'error')
      }
    } catch (error) {
      showMessage('Failed to add section', 'error')
    }
  }

  // Remove section from approved job
  const removeSection = async (sectionId: string) => {
    if (!currentJob) return

    try {
      const response = await fetch(`/api/fine-tuning/sections/${sectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove section from Redux state
        const updatedSections = currentJob.sections.filter(s => s.id !== sectionId)
        dispatch(setSections(updatedSections))
        showMessage('Section removed successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to remove section', 'error')
      }
    } catch (error) {
      showMessage('Failed to remove section', 'error')
    }
  }

  // Clip attachment functions
  const handleOpenClipAttachment = (sectionId: string, textareaRef: React.RefObject<HTMLTextAreaElement>) => {
    // Auto-populate clips from analysis if not already done
    if (availableClips.length === 0) {
      dispatch(populateClipsFromAnalysis())
    }
    
    setClipAttachmentTarget({ sectionId, textareaRef })
    setShowClipAttachment(true)
  }

  const handleClipSelection = (clip: AvailableClip) => {
    setSelectedClip(clip)
  }

  const handleInsertClip = () => {
    if (!selectedClip || !clipAttachmentTarget?.textareaRef.current) return

    const textarea = clipAttachmentTarget.textareaRef.current
    const cursorPosition = textarea.selectionStart
    const currentText = textarea.value
    
    // Format the clip reference
    const clipReference = `[[CLIP: ${selectedClip.youtubeUrl}&t=${convertTimeToSeconds(selectedClip.startTime)}s | ${selectedClip.startTime} - ${selectedClip.endTime} | ${selectedClip.description}]]`
    
    // Insert the clip reference at cursor position
    const newText = currentText.slice(0, cursorPosition) + clipReference + currentText.slice(cursorPosition)
    
    // Update the textarea directly
    textarea.value = newText
    textarea.focus()
    textarea.setSelectionRange(cursorPosition + clipReference.length, cursorPosition + clipReference.length)
    
    // Trigger change event to update the state
    const event = new Event('input', { bubbles: true })
    textarea.dispatchEvent(event)
    
    // Close the clip attachment modal
    setShowClipAttachment(false)
    setSelectedClip(null)
    setClipAttachmentTarget(null)
    
    showMessage('Clip inserted successfully!', 'success')
  }

  // Helper function to convert time format to seconds
  const convertTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':')
    if (parts.length === 3) {
      const hours = parseInt(parts[0])
      const minutes = parseInt(parts[1])
      const seconds = parseInt(parts[2])
      return hours * 3600 + minutes * 60 + seconds
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0])
      const seconds = parseInt(parts[1])
      return minutes * 60 + seconds
    }
    return parseInt(timeStr) || 0
  }

  // Helper function to format clip display
  const formatClipDisplay = (clip: AvailableClip) => {
    const duration = clip.startTime !== clip.endTime ? `${clip.startTime} - ${clip.endTime}` : clip.startTime
    return {
      title: clip.videoTitle,
      duration,
      description: clip.description,
      quote: clip.quote,
      speaker: clip.speaker,
      source: clip.source,
      confidence: clip.confidence
    }
  }

  // Timestamp selection functions
  const handleOpenTimestampPicker = (textId: string, textareaRef: React.RefObject<HTMLTextAreaElement>) => {
    setTimestampInsertionTarget({ textId, textareaRef })
    setShowTimestampPicker(true)
  }

  const handleTimestampSelection = (timestamp: AvailableTimestamp) => {
    setSelectedTimestamp(timestamp)
  }

  const handleInsertTimestamp = () => {
    if (!selectedTimestamp || !timestampInsertionTarget?.textId) return

    const textarea = timestampInsertionTarget.textareaRef.current
    const cursorPosition = textarea?.selectionStart || 0
    
    // Convert timestamps to 00m00 format for consistent output
    const convertToMinutesFormat = (time: string) => {
      if (time.includes('m')) return time // Already in correct format
      
      const parts = time.split(':')
      if (parts.length === 3) {
        // HH:MM:SS format
        const minutes = parseInt(parts[1]) + (parseInt(parts[0]) * 60)
        return `${minutes.toString().padStart(2, '0')}m${parts[2]}`
      } else if (parts.length === 2) {
        // MM:SS format
        return `${parts[0]}m${parts[1]}`
      }
      return time
    }

    const startFormatted = convertToMinutesFormat(selectedTimestamp.startTime)
    const endFormatted = convertToMinutesFormat(selectedTimestamp.endTime)
    const timeRange = startFormatted !== endFormatted ? `${startFormatted} - ${endFormatted}` : startFormatted
    
    // Generate enhanced timestamp reference based on element type
    let timestampReference = ''
    
    const elementType = selectedTimestamp.elementType || 'quote'
    
    if (elementType === 'quote') {
      // Standard quote format: [[TIMESTAMP: 00m00 - 00m00 | description | "quote"]]
      timestampReference = `[[TIMESTAMP: ${timeRange} | ${selectedTimestamp.description}${selectedTimestamp.quote ? ` | "${selectedTimestamp.quote}"` : ''}]]`
    } else {
      // Enhanced element formats: [[TYPE: 00m00 - 00m00 | description]]
      const typeMapping = {
        'background_footage': 'BACKGROUND FOOTAGE',
        'crime_scene': 'CRIME SCENE FOOTAGE',
        'dramatic_moment': 'DRAMATIC MOMENT',
        'security_camera': 'SECURITY CAMERA',
        'news_footage': 'NEWS FOOTAGE',
        'court_footage': 'COURT FOOTAGE',
        'evidence': 'EVIDENCE FOOTAGE',
        'the_moment': 'THE MOMENT'
      }
      
      const typeName = typeMapping[elementType as keyof typeof typeMapping] || 'VIDEO ELEMENT'
      
      // For special cases like "THE MOMENT RAPPER GOT KILLED"
      if (elementType === 'the_moment' && selectedTimestamp.description.toLowerCase().includes('killed')) {
        timestampReference = `[[THE MOMENT RAPPER GOT KILLED: ${timeRange} | ${selectedTimestamp.description}]]`
      } else if (elementType === 'the_moment' && selectedTimestamp.description.toLowerCase().includes('shot')) {
        timestampReference = `[[THE MOMENT ${selectedTimestamp.description.split(' ')[0]?.toUpperCase() || 'PERSON'} GOT SHOT: ${timeRange} | ${selectedTimestamp.description}]]`
      } else {
        timestampReference = `[[${typeName}: ${timeRange} | ${selectedTimestamp.description}]]`
      }
    }
    
    // Check if this is a pending script or an approved script
    const pendingScript = pendingScripts.find(ps => ps.tempId === timestampInsertionTarget.textId)
    
    if (pendingScript) {
      // Handle pending script - update Redux state directly
      const currentText = pendingScript.generatedScript
      const newText = currentText.slice(0, cursorPosition) + timestampReference + currentText.slice(cursorPosition)
      
      updatePendingScript(timestampInsertionTarget.textId, { generatedScript: newText })
      
      // Update textarea cursor position
      if (textarea) {
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(cursorPosition + timestampReference.length, cursorPosition + timestampReference.length)
        }, 0)
      }
    } else {
      // Handle approved script - update database
      const section = currentJob?.sections.find(s => s.texts?.[0]?.id === timestampInsertionTarget.textId)
      if (!section || !section.texts?.[0]) return

      const currentText = section.texts[0].generated_script
      const newText = currentText.slice(0, cursorPosition) + timestampReference + currentText.slice(cursorPosition)
      
      updateGeneratedScript(timestampInsertionTarget.textId, newText)
    }
    
    // Close the timestamp picker modal
    setShowTimestampPicker(false)
    setSelectedTimestamp(null)
    setTimestampInsertionTarget(null)
    
    showMessage('Timestamp inserted successfully!', 'success')
  }

  // Function to update generated script content
  const updateGeneratedScript = async (textId: string, newScript: string) => {
    try {
      const response = await fetch('/api/fine-tuning/texts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text_id: textId, 
          generated_script: newScript,
          character_count: newScript.length,
          word_count: newScript.trim().split(/\s+/).length
        })
      })

      if (response.ok) {
        // Refresh the job data to get updated content
        const jobResponse = await fetch(`/api/fine-tuning/jobs/${currentJob?.id}`)
        if (jobResponse.ok) {
          const jobData = await jobResponse.json()
          dispatch(setCurrentJob(jobData.job))
        }
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to update script', 'error')
      }
    } catch (error) {
      showMessage('Failed to update script', 'error')
    }
  }

  // Helper function to format timestamp display with enhanced element types
  const formatTimestampDisplay = (timestamp: AvailableTimestamp) => {
    // Convert timestamps to consistent format (00m00-00m00)
    const convertToMinutesFormat = (time: string) => {
      // Handle various input formats: 00:00:00, 00:00, or already in 00m00 format
      if (time.includes('m')) return time // Already in correct format
      
      const parts = time.split(':')
      if (parts.length === 3) {
        // HH:MM:SS format
        const minutes = parseInt(parts[1]) + (parseInt(parts[0]) * 60)
        return `${minutes.toString().padStart(2, '0')}m${parts[2]}`
      } else if (parts.length === 2) {
        // MM:SS format
        return `${parts[0]}m${parts[1]}`
      }
      return time // Return as is if format is unclear
    }

    const startFormatted = convertToMinutesFormat(timestamp.startTime)
    const endFormatted = convertToMinutesFormat(timestamp.endTime)
    const duration = startFormatted !== endFormatted ? `${startFormatted} - ${endFormatted}` : startFormatted

    // Get enhanced element type display
    const getElementTypeDisplay = (elementType?: string) => {
      switch (elementType) {
        case 'background_footage': return { label: 'Background Footage', color: 'bg-blue-100 text-blue-800' }
        case 'crime_scene': return { label: 'Crime Scene', color: 'bg-red-100 text-red-800' }
        case 'dramatic_moment': return { label: 'Dramatic Moment', color: 'bg-purple-100 text-purple-800' }
        case 'security_camera': return { label: 'Security Camera', color: 'bg-gray-100 text-gray-800' }
        case 'news_footage': return { label: 'News Footage', color: 'bg-green-100 text-green-800' }
        case 'court_footage': return { label: 'Court Footage', color: 'bg-yellow-100 text-yellow-800' }
        case 'evidence': return { label: 'Evidence', color: 'bg-orange-100 text-orange-800' }
        case 'the_moment': return { label: 'The Moment', color: 'bg-pink-100 text-pink-800' }
        case 'quote':
        default: return { label: 'Quote/Dialogue', color: 'bg-indigo-100 text-indigo-800' }
      }
    }

    const elementDisplay = getElementTypeDisplay(timestamp.elementType)

    return {
      title: timestamp.videoTitle,
      duration,
      description: timestamp.description,
      quote: timestamp.quote,
      speaker: timestamp.speaker,
      source: timestamp.source,
      confidence: timestamp.confidence,
      elementType: timestamp.elementType || 'quote',
      elementDisplay
    }
  }

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
          {/* Action Buttons */}
          {hasGeneratedScripts && user.isLoggedIn && (
            <div className="flex gap-2 mt-3">
              <Button onClick={downloadAllScripts} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download All Scripts
              </Button>
              <Button onClick={generateCombinedAudio} variant="outline" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Generate Combined Audio
              </Button>
            </div>
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

          {/* Pending Sections Approval */}
          {pendingSections.length > 0 && user.isLoggedIn && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertCircle className="h-5 w-5" />
                  Sections Pending Approval
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Review the generated sections below and approve or reject them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingSections.map((section) => (
                  <div key={section.tempId} className="border rounded-lg p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-800">Section {pendingSections.indexOf(section) + 1}</h4>
                      <Button
                        onClick={() => removePendingSection(section.tempId)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Section Title</Label>
                      <Input
                        value={section.title}
                        onChange={(e) => updatePendingSection(section.tempId, { title: e.target.value })}
                        className="font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Writing Instructions</Label>
                      <Textarea
                        value={section.writingInstructions}
                        onChange={(e) => updatePendingSection(section.tempId, { writingInstructions: e.target.value })}
                        className="min-h-[100px]"
                      />
                    </div>
                  </div>
                ))}
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={addNewPendingSection}
                    variant="outline"
                    className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section
                  </Button>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleApproveSections}
                    disabled={approvingSections}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {approvingSections ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve All Sections
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleRejectSections}
                    disabled={approvingSections}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Reject All
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Scripts Approval */}
          {pendingScripts.length > 0 && user.isLoggedIn && (
            <div className="space-y-4">
              {/* Approve All Scripts Header */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-orange-800">
                        <AlertCircle className="h-5 w-5" />
                        {pendingScripts.length} Script{pendingScripts.length > 1 ? 's' : ''} Pending Approval
                      </CardTitle>
                      <CardDescription className="text-orange-700">
                        Review and edit the generated scripts below, then approve or reject them.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleApproveAllScripts}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve All Scripts
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Individual Pending Scripts */}
              {pendingScripts.map((pendingScript) => (
                <Card key={pendingScript.tempId} className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <AlertCircle className="h-5 w-5" />
                      Script: {pendingScript.title}
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      Review and edit the script content below before approving.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Editable Script Title */}
                    <div className="space-y-2">
                      <Label>Script Title</Label>
                      <Input
                        value={pendingScript.title}
                        onChange={(e) => updatePendingScript(pendingScript.tempId, { title: e.target.value })}
                        className="font-medium bg-white"
                      />
                    </div>

                    {/* Editable Writing Instructions */}
                    <div className="space-y-2">
                      <Label>Writing Instructions</Label>
                      <Textarea
                        value={pendingScript.writingInstructions}
                        onChange={(e) => updatePendingScript(pendingScript.tempId, { writingInstructions: e.target.value })}
                        className="min-h-[80px] bg-white"
                      />
                    </div>

                    {/* YouTube Links Display */}
                    {pendingScript.youtubeLinks && pendingScript.youtubeLinks.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Play className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">YouTube References</span>
                          <Badge variant="secondary">{pendingScript.youtubeLinks.length} link(s)</Badge>
                        </div>
                        <div className="space-y-2">
                          {pendingScript.youtubeLinks.map((link: any, index: number) => (
                            <div key={index} className="bg-white rounded p-2 text-sm border">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-blue-600">
                                  {link.title || `Video ${index + 1}`}:
                                </span>
                                <a 
                                  href={link.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline truncate flex-1"
                                >
                                  {link.url}
                                </a>
                              </div>
                              {link.timestamps && (
                                <div className="text-gray-600 text-xs mt-1">
                                  Timestamps: {link.timestamps}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          These references will be included at the beginning of generated scripts in the format: [[YT_LINK: url, timestamps]]
                        </p>
                      </div>
                    )}
                    
                    {/* Editable Generated Script */}
                    <div className="bg-white rounded p-4 border space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">Generated Script (Editable)</span>
                        <Badge variant="secondary">
                          {pendingScript.characterCount} chars • {pendingScript.wordCount} words
                        </Badge>
                        <Button
                          onClick={() => {
                            const textareaRef = { current: document.getElementById(`pending-script-${pendingScript.tempId}`) as HTMLTextAreaElement }
                            handleOpenTimestampPicker(pendingScript.tempId, textareaRef)
                          }}
                          variant="outline"
                          size="sm"
                          className="ml-auto flex items-center gap-1"
                          disabled={availableTimestamps.length === 0}
                        >
                          <Clock className="h-3 w-3" />
                          Add Timestamp {availableTimestamps.length > 0 && `(${availableTimestamps.length})`}
                        </Button>
                      </div>
                      <Textarea
                        id={`pending-script-${pendingScript.tempId}`}
                        value={pendingScript.generatedScript}
                        onChange={(e) => updatePendingScript(pendingScript.tempId, { generatedScript: e.target.value })}
                        className="min-h-[200px] bg-gray-50 border-gray-200 font-mono text-sm"
                        placeholder="Edit the generated script content here... Click anywhere and use 'Add Timestamp' to insert timestamps."
                      />
                      <p className="text-xs text-blue-600">
                        💡 Click anywhere in the script above, then use "Add Timestamp" to insert timestamps at that position
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveScript(pendingScript)}
                        disabled={approvingScript === pendingScript.tempId}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {approvingScript === pendingScript.tempId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Script
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleRejectScript(pendingScript.tempId)}
                        disabled={approvingScript === pendingScript.tempId}
                        variant="outline"
                        className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Reject Script
                      </Button>
                      <Button
                        onClick={() => copyScript(pendingScript.generatedScript)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                      Configure Script Generation
                </CardTitle>
                    <CardDescription>
                      Set target audience, tone, and style preferences. AI will determine optimal sections automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* AI Section Determination */}
                    <div className="space-y-2">
                                             <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                             <span className="text-blue-800 font-medium">AI-Powered Section Planning</span>
                           </div>
                           <Button
                             onClick={handlePreviewResearch}
                             variant="outline"
                             size="sm"
                             className="text-blue-600 border-blue-300 hover:bg-blue-100"
                           >
                             <Eye className="h-4 w-4 mr-1" />
                             Preview Research
                           </Button>
                         </div>
                         <p className="text-sm text-blue-700">
                           The AI will automatically analyze your research data and content to determine the optimal number of sections needed to:
                         </p>
                         <ul className="text-sm text-blue-600 mt-2 space-y-1 ml-4">
                           <li>• Utilize all valuable content from research</li>
                           <li>• Explain each major concept thoroughly</li>
                           <li>• Create logical narrative flow</li>
                           <li>• Ensure comprehensive coverage</li>
                         </ul>
                       </div>
                    </div>

                    {/* Intro Hook Settings */}
                    <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-orange-500" />
                          <Label className="text-base font-medium">Video Intro Hook (Optional)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="enableIntroHook"
                            checked={enableIntroHook}
                            onChange={(e) => setEnableIntroHook(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="enableIntroHook" className="text-sm">Enable</Label>
                        </div>
                      </div>
                      
                      {enableIntroHook && (
                        <div className="space-y-3">
                          <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                            <p className="text-sm text-orange-700">
                              Generate a separate intro hook segment to grab viewer attention. Our intros are typically 30-65 words.
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label htmlFor="introHookWordCount" className="text-sm">Target Word Count</Label>
                              <Input
                                id="introHookWordCount"
                                type="number"
                                min="20"
                                max="100"
                                step="5"
                                value={introHookWordCount}
                                onChange={(e) => setIntroHookWordCount(Number(e.target.value) || 50)}
                                className="mt-1"
                              />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
                              <span className="text-blue-600 font-medium">
                                {introHookWordCount} words
                              </span>
                              <span className="text-blue-500 text-xs ml-1 block">
                                {introHookWordCount <= 35 ? 'Short & punchy' : 
                                 introHookWordCount <= 55 ? 'Standard length' : 
                                 'Detailed hook'}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500">
                            The intro hook will be generated as a separate segment before the main script sections.
                          </p>
                        </div>
                      )}
                    </div>

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
                      <SelectItem value="default">Default prompt</SelectItem>
                      {prompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose a custom prompt from your library or use the default style guide
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
                      <SelectItem value="claude-opus-4-20250514">Claude-Opus-4-20250514</SelectItem>
                      <SelectItem value="claude-sonnet-4-20250514">Claude-Sonnet-4-20250514</SelectItem>
                      <SelectItem value="claude-3-7-sonnet-20250219">Claude-3-7-Sonnet-20250219</SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude-3-5-Haiku-20241022</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude-3-5-Sonnet-20241022</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20240620">Claude-3-5-Sonnet-20240620</SelectItem>
                      <SelectItem value="claude-3-opus-20240229">Claude-3-Opus-20240229</SelectItem>
                      <SelectItem value="claude-3-sonnet-20240229">Claude-3-Sonnet-20240229</SelectItem>
                      <SelectItem value="claude-3-haiku-20240307">Claude-3-Haiku-20240307</SelectItem>
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
                      <SelectItem disabled value="divider" className="font-semibold text-blue-600">
                        --- Your Fine-Tuned Models ---
                      </SelectItem>
                      <SelectItem value="ft:gpt-4.1-2025-04-14:pletfree-creations-ltd:initial-model:Blhdq95X">Initial Model (GPT-4.1)</SelectItem>
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

                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateSections}
                    disabled={currentJob.isGeneratingSections}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    {currentJob.isGeneratingSections ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI Analyzing Content & Generating Sections...
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4" />
                        Generate Script Sections (AI-Determined)
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={addNewPendingSection}
                    variant="outline"
                    className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4" />
                    Create Manual Section
                  </Button>
                </div>
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
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={addNewSection}
                          variant="outline"
                          className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add Section
                        </Button>
                        <Button 
                          onClick={handleGenerateAllScripts}
                          disabled={currentJob.sections.some((s: FineTuningSection) => s.isGeneratingScript)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Generate All Scripts
                        </Button>
                      </div>
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
                                onClick={() => removeSection(section.id)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 border-red-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
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
                          
                          {/* YouTube Links Display */}
                          {section.youtubeLinks && section.youtubeLinks.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Play className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">YouTube References</span>
                                <Badge variant="secondary">{section.youtubeLinks.length} link(s)</Badge>
                              </div>
                              <div className="space-y-2">
                                {section.youtubeLinks.map((link, index) => (
                                  <div key={index} className="bg-white rounded p-2 text-sm border">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-blue-600">
                                        {link.title || `Video ${index + 1}`}:
                                      </span>
                                      <a 
                                        href={link.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline truncate flex-1"
                                      >
                                        {link.url}
                                      </a>
                                    </div>
                                    {link.timestamps && (
                                      <div className="text-gray-600 text-xs mt-1">
                                        Timestamps: {link.timestamps}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-blue-600 mt-2">
                                These references will be included at the beginning of generated scripts in the format: [[YT_LINK: url, timestamps]]
                              </p>
                            </div>
                          )}
                          
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
                                <Button
                                  onClick={() => {
                                    const textareaRef = { current: document.getElementById(`script-${section.texts[0].id}`) as HTMLTextAreaElement }
                                    handleOpenTimestampPicker(section.texts[0].id, textareaRef)
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="ml-auto flex items-center gap-1"
                                  disabled={availableTimestamps.length === 0}
                                >
                                  <Clock className="h-3 w-3" />
                                  Add Timestamp {availableTimestamps.length > 0 && `(${availableTimestamps.length})`}
                                </Button>
                                      </div>
                              <Textarea
                                id={`script-${section.texts[0].id}`}
                                value={section.texts[0].generated_script}
                                readOnly
                                onClick={(e) => {
                                  // Allow cursor positioning even in read-only mode
                                  const textarea = e.target as HTMLTextAreaElement
                                  textarea.focus()
                                }}
                                className="bg-white border-gray-200 font-mono text-sm min-h-[200px] cursor-text"
                                placeholder="Click anywhere in this text area and use 'Add Timestamp' to insert timestamps..."
                              />
                              <div className="mt-2 text-xs text-gray-500">
                                {section.texts[0].character_count} characters • {section.texts[0].word_count} words
                              </div>
                              <p className="text-xs text-blue-600 mt-1">
                                💡 Click anywhere in the script above, then use "Add Timestamp" to insert timestamps at that position
                              </p>
                              
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

      {/* Timestamp Picker Modal */}
      <Dialog open={showTimestampPicker} onOpenChange={setShowTimestampPicker}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Select Timestamp to Insert
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-700">
                Select a timestamp from your research data to insert into the script. 
                The timestamp will be inserted at your cursor position.
              </p>
              <div className="mt-2 text-xs text-blue-600">
                <p className="font-medium">Enhanced Formats Available:</p>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <span>• Standard quotes/dialogue</span>
                  <span>• Background footage</span>
                  <span>• Crime scene footage</span>
                  <span>• Dramatic moments</span>
                  <span>• Security camera footage</span>
                  <span>• News footage</span>
                  <span>• Court footage</span>
                  <span>• Evidence presentation</span>
                </div>
              </div>
            </div>
            
            {availableTimestamps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No timestamps available from your research data.</p>
                <p className="text-sm">Analyze some YouTube videos first to get timestamps.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availableTimestamps.map((timestamp) => {
                  const display = formatTimestampDisplay(timestamp)
                  return (
                    <div
                      key={timestamp.id}
                      onClick={() => handleTimestampSelection(timestamp)}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedTimestamp?.id === timestamp.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Video className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <h4 className="font-medium text-sm truncate">{display.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {display.source}
                            </Badge>
                            <Badge className={`text-xs px-2 py-1 rounded-full ${display.elementDisplay.color}`}>
                              {display.elementDisplay.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {display.duration}
                            </span>
                            {display.speaker && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {display.speaker}
                              </span>
                            )}
                            {display.confidence && (
                              <span className="text-xs">
                                {Math.round(display.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2">{display.description}</p>
                          
                          {display.quote && (
                            <div className="bg-gray-100 border-l-4 border-gray-400 pl-3 py-1">
                              <Quote className="h-3 w-3 text-gray-500 inline mr-1" />
                              <span className="text-sm italic text-gray-600">"{display.quote}"</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0">
                          <a
                            href={`${timestamp.youtubeUrl}&t=${convertTimeToSeconds(timestamp.startTime)}s`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Watch →
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleInsertTimestamp}
                disabled={!selectedTimestamp}
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                Insert Selected Timestamp
              </Button>
              <Button
                onClick={() => {
                  setShowTimestampPicker(false)
                  setSelectedTimestamp(null)
                  setTimestampInsertionTarget(null)
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Research Preview Modal */}
      <Dialog open={showResearchPreview} onOpenChange={setShowResearchPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Research Data Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-700">
                This is the comprehensive research data that will be provided to the AI for script generation. 
                It includes all YouTube videos, timestamps, quotes, and analysis results.
              </p>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto">
                {previewResearchData || 'No research data available'}
              </pre>
            </div>
            
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>
                {previewResearchData ? `${previewResearchData.length} characters` : '0 characters'}
              </span>
              <Button
                onClick={() => {
                  if (previewResearchData) {
                    navigator.clipboard.writeText(previewResearchData)
                    showMessage('Research data copied to clipboard!', 'success')
                  }
                }}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy to Clipboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 