'use client'

import React from 'react'
import { Loader2, Search, ChevronDown, ChevronRight, Clock, BarChart3, Brain, ExternalLink, Play } from 'lucide-react'
import { formatTimestamp } from './utils'
import { AnalysisType, EnhancedTranscriptAnalysis } from './types'
import { Video, SubtitleFile, AnalysisResult, TranscriptAnalysis } from '@/lib/features/youtube/youtubeSlice'

interface AnalysisSectionProps {
  videoId: string
  subtitleFile?: SubtitleFile
  video?: Video
  localQueries: Record<string, string>
  setLocalQueries: React.Dispatch<React.SetStateAction<Record<string, string>>>
  transcriptAnalysis: EnhancedTranscriptAnalysis
  expandedAnalysis: Set<string>
  toggleAnalysisExpansion: (resultId: string) => void
  handleAnalyzeTranscript: (videoId: string, subtitleFile: SubtitleFile) => void
  handleAnalyzeVideoTranscript: (video: Video) => void
  handleGeminiAnalysis: (videoId: string, video: Video, analysisType: AnalysisType) => void
}

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  videoId,
  subtitleFile,
  video,
  localQueries,
  setLocalQueries,
  transcriptAnalysis,
  expandedAnalysis,
  toggleAnalysisExpansion,
  handleAnalyzeTranscript,
  handleAnalyzeVideoTranscript,
  handleGeminiAnalysis
}) => {
  const isAnalyzing = transcriptAnalysis.analyzingTranscripts[videoId] || false
  const isGeminiAnalyzing = transcriptAnalysis.analyzingGemini?.[videoId] || false
  const currentQuery = localQueries[videoId] || ''
  const analysisResults = transcriptAnalysis.analysisResults.filter((result: AnalysisResult) => result.videoId === videoId)
  const canAnalyze = subtitleFile?.status === 'completed' || video
  
  // Local state for analysis type selection - compact version
  const [analysisType, setAnalysisType] = React.useState<AnalysisType>('standard')
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div className="mt-4 border border-gray-200 rounded-lg bg-gray-50">
      {/* Compact Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-800">Individual Analysis</span>
          {analysisResults.length > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
              {analysisResults.length} result{analysisResults.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!canAnalyze && (
            <span className="text-xs text-gray-500">Subtitles needed</span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          {/* Compact Analysis Type Selection */}
          <div className="mb-3 mt-3">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setAnalysisType('standard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  analysisType === 'standard'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50'
                }`}
              >
                <Search className="h-3 w-3 inline mr-1" />
                Transcript
              </button>
              
              <button
                onClick={() => setAnalysisType('full')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  analysisType === 'full'
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50'
                }`}
              >
                <Brain className="h-3 w-3 inline mr-1" />
                AI Analysis
              </button>
            </div>
            
            <p className="text-xs text-gray-600">
              {analysisType === 'standard' 
                ? 'Search this video\'s transcript for specific content'
                : 'AI analysis of this video\'s content and visuals'
              }
            </p>
          </div>
          
          {/* Query Input and Analyze Button */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={analysisType === 'standard' 
                  ? "Search query..." 
                  : "Focus area (optional)..."
                }
                value={currentQuery}
                onChange={(e) => setLocalQueries(prev => ({ ...prev, [videoId]: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={!canAnalyze}
              />
              <button
                onClick={() => {
                  if (analysisType === 'standard') {
                    if (subtitleFile) {
                      handleAnalyzeTranscript(videoId, subtitleFile)
                    } else if (video) {
                      handleAnalyzeVideoTranscript(video)
                    }
                  } else {
                    if (video) {
                      handleGeminiAnalysis(videoId, video, analysisType)
                    }
                  }
                }}
                disabled={!canAnalyze || (analysisType === 'standard' && !currentQuery.trim()) || isAnalyzing || isGeminiAnalyzing}
                className={`px-4 py-2 rounded-md transition-colors flex items-center gap-1 text-sm font-medium ${
                  analysisType === 'standard'
                    ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white'
                }`}
              >
                {isAnalyzing || isGeminiAnalyzing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    {analysisType === 'full' ? <Brain className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                    Analyze
                  </>
                )}
              </button>
            </div>

            {/* Prerequisites Message */}
            {!canAnalyze && (
              <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                {analysisType === 'standard' 
                  ? 'Generate subtitles first to enable transcript analysis.'
                  : 'Video must be available for AI analysis.'
                }
              </p>
            )}
          </div>

          {/* Analysis Results - Compact */}
          {analysisResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h6 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Results:
              </h6>
              {analysisResults.map((result: AnalysisResult & { usingGemini?: boolean }, resultIndex: number) => {
                return (
                  <div key={`${result.videoId}-${resultIndex}`} className="space-y-1">
                    <div className="text-xs font-medium text-gray-600 bg-gray-100 p-2 rounded flex items-center justify-between">
                      <span>"{result.query}"</span>
                      <div className="flex items-center gap-1">
                        {result.usingGemini && (
                          <span className="bg-purple-100 text-purple-600 px-1 py-0.5 rounded text-xs">AI</span>
                        )}
                        <span className="text-gray-500">
                          {result.analysis.length} result{result.analysis.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    {result.analysis.slice(0, 2).map((analysis: TranscriptAnalysis, analysisIndex: number) => {
                      const resultId = `${result.videoId}-${resultIndex}-${analysisIndex}`
                      const isExpanded = expandedAnalysis.has(resultId)
                      
                      return (
                        <div key={resultId} className="border border-gray-200 rounded bg-white ml-2">
                          <button
                            onClick={() => toggleAnalysisExpansion(resultId)}
                            className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-700">
                                #{analysisIndex + 1}
                              </span>
                              <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">
                                {Math.round(analysis.confidence * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(analysis.timestamp)}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-600" />
                              )}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
                              <div>
                                <h6 className="text-xs font-semibold text-gray-700 mb-1">Summary:</h6>
                                <p className="text-xs text-gray-700">{analysis.summary}</p>
                              </div>
                              
                              {analysis.keyQuotes && analysis.keyQuotes.length > 0 && (
                                <div>
                                  <h6 className="text-xs font-semibold text-gray-700 mb-1">Quotes:</h6>
                                  <div className="space-y-1">
                                    {analysis.keyQuotes.slice(0, 2).map((quote: string, quoteIndex: number) => (
                                      <div key={quoteIndex} className="text-xs text-gray-700 bg-yellow-50 p-1 rounded border-l-2 border-yellow-400">
                                        "{quote}"
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center text-xs text-gray-600 pt-1">
                                <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
                                {analysis.youtubeUrl && (
                                  <a
                                    href={analysis.youtubeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded transition-colors"
                                  >
                                    <Play className="h-2 w-2" />
                                    Watch
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    
                    {result.analysis.length > 2 && (
                      <div className="text-xs text-gray-500 ml-2">
                        + {result.analysis.length - 2} more results
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 