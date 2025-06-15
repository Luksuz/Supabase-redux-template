'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Info, X, FileText, Briefcase, Database, Settings, Youtube, Volume2, Activity, MessageCircle, Brain, Search, BarChart3, Lightbulb, Target, Users, BookOpen, PenTool, Globe } from 'lucide-react'

interface TerminologyInfoProps {
  isOpen: boolean
  onClose: () => void
}

export function TerminologyInfo({ isOpen, onClose }: TerminologyInfoProps) {
  if (!isOpen) return null

  const terminology = [
    {
      category: "Core Concepts",
      icon: Briefcase,
      terms: [
        {
          term: "Jobs",
          icon: Briefcase,
          definition: "A fine-tuning project that contains multiple script sections. Each job has a theme, target audience, and generates training data for custom AI models."
        },
        {
          term: "Sections",
          icon: FileText,
          definition: "Individual parts of a script within a job. Each section has writing instructions and can generate multiple script variations for training data."
        },
        {
          term: "Texts",
          icon: PenTool,
          definition: "Generated script content for each section. These are the actual outputs that become training data for fine-tuning AI models."
        },
        {
          term: "Prompts",
          icon: Settings,
          definition: "Custom instructions that guide how the AI generates scripts. You can create, edit, and reuse prompts across different jobs."
        }
      ]
    },
    {
      category: "YouTube Research",
      icon: Youtube,
      terms: [
        {
          term: "Video Search",
          icon: Search,
          definition: "Find YouTube videos by keywords or channel. The system can search across all of YouTube or within specific channels."
        },
        {
          term: "Subtitle Generation",
          icon: FileText,
          definition: "Extract or generate subtitles from YouTube videos using either existing captions or AI transcription (Whisper)."
        },
        {
          term: "Transcript Analysis",
          icon: BarChart3,
          definition: "AI-powered analysis of video transcripts to find specific topics, extract timestamps, and summarize content with confidence scores."
        },
        {
          term: "Video Summarization",
          icon: Lightbulb,
          definition: "Comprehensive AI analysis of multiple videos to identify themes, character insights, narrative elements, and generate creative prompts."
        }
      ]
    },
    {
      category: "AI Research",
      icon: Brain,
      terms: [
        {
          term: "Google Research",
          icon: Globe,
          definition: "Web search using SerpAPI to gather up to 30 relevant articles and sources, then AI analysis to generate insights and recommendations."
        },
        {
          term: "Research Summaries",
          icon: BookOpen,
          definition: "Structured analysis combining web sources and YouTube content to provide comprehensive insights, key findings, and actionable recommendations."
        },
        {
          term: "Current Research",
          icon: Target,
          definition: "Collection of all your research summaries (both Google and YouTube) that can be applied to script generation for enhanced prompts."
        }
      ]
    },
    {
      category: "Script Generation",
      icon: FileText,
      terms: [
        {
          term: "Fine-Tuning",
          icon: Database,
          definition: "Process of training custom AI models using your generated scripts as training data to create specialized writing assistants."
        },
        {
          term: "Models",
          icon: Settings,
          definition: "AI models used for generation. Includes standard OpenAI models (GPT-4, etc.) and your custom fine-tuned models."
        },
        {
          term: "Training Data",
          icon: Database,
          definition: "Pairs of writing instructions and generated scripts exported in JSONL format for training custom AI models."
        },
        {
          term: "Quality Ratings",
          icon: BarChart3,
          definition: "Scoring system (1-5 stars) to rate the quality of sections and generated texts, helping improve training data quality."
        }
      ]
    },
    {
      category: "Audio & Export",
      icon: Volume2,
      terms: [
        {
          term: "Audio Generation",
          icon: Volume2,
          definition: "Convert any text or generated scripts into high-quality speech using ElevenLabs text-to-speech technology."
        },
        {
          term: "Fine-Tuning Export",
          icon: Database,
          definition: "Export your rated scripts as JSONL training data for OpenAI fine-tuning, with quality filtering options."
        },
        {
          term: "Fine-Tuning Sessions",
          icon: Activity,
          definition: "Monitor and manage your OpenAI fine-tuning jobs, track training progress, and deploy custom models."
        }
      ]
    },
    {
      category: "AI Assistant",
      icon: MessageCircle,
      terms: [
        {
          term: "Script Assistant",
          icon: MessageCircle,
          definition: "AI chatbot specialized in script writing, character development, story structure, and creative writing guidance."
        },
        {
          term: "Markdown Support",
          icon: PenTool,
          definition: "Chat messages support formatting like **bold**, *italic*, `code`, lists, and headers for better readability."
        }
      ]
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white rounded-full p-2">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">App Terminology Guide</h2>
              <p className="text-gray-600">Understanding the key concepts and features</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {terminology.map((category, categoryIndex) => {
            const CategoryIcon = category.icon
            
            return (
              <Card key={categoryIndex} className="border border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <CategoryIcon className="h-5 w-5 text-blue-600" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {category.terms.map((item, termIndex) => {
                      const TermIcon = item.icon
                      
                      return (
                        <div key={termIndex} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0">
                            <TermIcon className="h-5 w-5 text-gray-600 mt-0.5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{item.term}</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">{item.definition}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              This guide covers all the main concepts used throughout the application. 
              Each feature is designed to work together for comprehensive content creation and AI model training.
            </p>
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white">
              Got it, thanks!
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TerminologyInfoButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border-gray-300"
        title="Learn about app terminology"
      >
        <Info className="h-4 w-4" />
        Help
      </Button>
      
      <TerminologyInfo 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
} 