'use client'

import React from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut, Download, FileText, Eye, Search, ChevronDown, ChevronRight, Clock, BarChart3, Zap, Mic, ExternalLink, Lightbulb, Target, TrendingUp, Users, Zap as Spark, BookOpen, PenTool, Globe, FileSearch, Brain } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { AppDispatch, RootState } from '@/lib/store'
import {
  setSearchQuery,
  setChannelUrl,
  setMaxResults,
  setSortOrder,
  toggleVideoSelection,
  selectAllVideos,
  deselectAllVideos,
  setPreviewContent,
  clearError,
  searchVideos,
  generateSubtitles,
  analyzeTranscript,
  summarizeVideos,
  clearVideosSummary,
  setAnalysisQuery,
  clearAnalysisResults,
  performGoogleResearch,
  removeGoogleResearchSummary,
  removeYouTubeResearchSummary,
  clearAllResearchSummaries,
  selectSearchForm,
  selectSearchResults,
  selectSubtitleGeneration,
  selectTranscriptAnalysis,
  selectVideoSummarization,
  selectResearchSummaries,
  selectPreviewModal,
  selectError,
  type Video,
  type SubtitleFile,
  type AnalysisResult,
  type VideosSummary,
  type TranscriptAnalysis,
  type GoogleResearchSummary,
  type YouTubeResearchSummary,
} from '@/lib/features/youtube/youtubeSlice'

// Research interfaces
interface WebSearchResult {
  title: string
  link: string
  description: string
  source?: string
}

interface ResearchSummary {
  query: string
  webResults: WebSearchResult[]
  youtubeResults: Video[]
  combinedInsights: string
  keyFindings: string[]
  recommendations: string[]
  timestamp: string
}

// Research Tab Component (Google-only)
const ResearchTab = ({ 
  researchSummaries,
  dispatch
}: {
  researchSummaries: any
  dispatch: any
}) => {
  const [researchQuery, setResearchQuery] = React.useState('')
  const [researchContext, setResearchContext] = React.useState('')
  const [isResearching, setIsResearching] = React.useState(false)
  const [expandedResults, setExpandedResults] = React.useState<Set<string>>(new Set())

  const handleResearch = async () => {
    if (!researchQuery.trim()) return

    setIsResearching(true)
    try {
      await dispatch(performGoogleResearch({
        query: researchQuery,
        context: researchContext,
        maxResults: 30
      })).unwrap()
      
      // Clear form after successful research
      setResearchQuery('')
      setResearchContext('')
    } catch (error) {
      console.error('Research error:', error)
    } finally {
      setIsResearching(false)
    }
  }

  const toggleResultExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }

  // Get Google research summaries sorted by timestamp
  const googleResearchResults = researchSummaries.googleResearchSummaries
    .slice()
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6">
      {/* Research Input Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Google Research Assistant
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Research Query
            </label>
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder="What would you like to research? (e.g., 'AI in healthcare', 'climate change solutions')"
              className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Research Context (Optional)
            </label>
            <textarea
              value={researchContext}
              onChange={(e) => setResearchContext(e.target.value)}
              placeholder="Provide additional context for your research (e.g., 'Focus on recent developments', 'Looking for business applications', etc.)"
              rows={3}
              className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={handleResearch}
            disabled={!researchQuery.trim() || isResearching}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            {isResearching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <FileSearch className="h-5 w-5" />
                Start Google Research
              </>
            )}
          </button>
        </div>
      </div>

      {/* Research Results */}
      {googleResearchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Research Results ({googleResearchResults.length})
            </h4>
            
            {googleResearchResults.length > 0 && (
              <button
                onClick={() => dispatch(clearAllResearchSummaries())}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Clear All
              </button>
            )}
          </div>

          {googleResearchResults.map((result: any) => {
            const isExpanded = expandedResults.has(result.id)
            
            return (
              <div key={result.id} className="border border-gray-200 bg-white rounded-lg">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-600" />
                      <h5 className="font-semibold text-gray-900">
                        Google Research: {result.query}
                      </h5>
                      
                      {result.usingMock && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs">
                          Mock
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleString()}
                      </span>
                      
                      <button
                        onClick={() => toggleResultExpansion(result.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => dispatch(removeGoogleResearchSummary(result.id))}
                        className="text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Preview */}
                  <div className="text-sm text-gray-600 mb-2">
                    <p>{result.insights.slice(0, 200)}...</p>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div>
                        <h6 className="font-semibold text-gray-800 mb-2">Full Insights</h6>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded">{result.insights}</p>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h6 className="font-semibold text-gray-800 mb-2">Key Findings</h6>
                          <ul className="space-y-1">
                            {result.keyFindings.map((finding: string, index: number) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h6 className="font-semibold text-gray-800 mb-2">Recommendations</h6>
                          <ul className="space-y-1">
                            {result.recommendations.map((rec: string, index: number) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                  →
                                </span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Web Search Results */}
                      {result.webResults && result.webResults.length > 0 && (
                        <div>
                          <h6 className="font-semibold text-gray-800 mb-2">
                            Source Articles ({result.webResults.length})
                          </h6>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {result.webResults.slice(0, 10).map((webResult: any, index: number) => (
                              <div key={index} className="bg-gray-50 p-3 rounded border">
                                <div className="font-medium text-blue-600 text-sm">
                                  <a 
                                    href={webResult.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-800 underline"
                                  >
                                    {webResult.title}
                                  </a>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                  {webResult.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {result.sources && result.sources.length > 0 && (
                        <div>
                          <h6 className="font-semibold text-gray-800 mb-2">Key Sources</h6>
                          <div className="flex flex-wrap gap-2">
                            {result.sources.slice(0, 5).map((source: string, index: number) => (
                              <a
                                key={index}
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                              >
                                Source {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {googleResearchResults.length === 0 && (
        <div className="text-center text-gray-600">
          <p>No research results yet. Start a Google research query above to see results here.</p>
        </div>
      )}
    </div>
  )
}

// Current Research Tab Component
const CurrentResearchTab = ({ 
  researchSummaries,
  dispatch
}: {
  researchSummaries: any
  dispatch: any
}) => {
  const [expandedSummaries, setExpandedSummaries] = React.useState<Set<string>>(new Set())
  const [selectedForScript, setSelectedForScript] = React.useState<Set<string>>(new Set())

  const toggleSummaryExpansion = (summaryId: string) => {
    const newExpanded = new Set(expandedSummaries)
    if (newExpanded.has(summaryId)) {
      newExpanded.delete(summaryId)
    } else {
      newExpanded.add(summaryId)
    }
    setExpandedSummaries(newExpanded)
  }

  const toggleScriptSelection = (summaryId: string) => {
    const newSelected = new Set(selectedForScript)
    if (newSelected.has(summaryId)) {
      newSelected.delete(summaryId)
    } else {
      newSelected.add(summaryId)
    }
    setSelectedForScript(newSelected)
  }

  const handleApplyToScript = () => {
    const selectedSummaries = allSummaries.filter(s => selectedForScript.has(s.id))
    
    if (selectedSummaries.length === 0) return
    
    // Show success message with guidance
    const summaryTypes = selectedSummaries.map(s => s.type === 'google' ? 'Google Research' : 'YouTube Analysis').join(', ')
    
    // For now, we'll show a success message and log the data
    // In a real implementation, this would integrate with the script generator
    console.log('Selected research summaries for script generation:', selectedSummaries)
    
    // Show success message
    alert(`✅ Selected ${selectedSummaries.length} research summaries (${summaryTypes}) for script generation!\n\nTo use this research in your scripts:\n1. Go to the Script Generator page\n2. Create or select a job\n3. Click "Merge Research Data" to integrate this research with your prompts\n\nThe research data is now available in the script generator.`)
    
    // Clear selection after applying
    setSelectedForScript(new Set())
  }

  const allSummaries = [
    ...researchSummaries.googleResearchSummaries.map((s: GoogleResearchSummary) => ({ ...s, type: 'google' })),
    ...researchSummaries.youtubeResearchSummaries.map((s: YouTubeResearchSummary) => ({ ...s, type: 'youtube' }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Current Research ({allSummaries.length})
        </h3>
        
        <div className="flex gap-2">
          {selectedForScript.size > 0 && (
            <button
              onClick={handleApplyToScript}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <PenTool className="h-4 w-4" />
              Apply to Script ({selectedForScript.size})
            </button>
          )}
          
          {allSummaries.length > 0 && (
            <button
              onClick={() => dispatch(clearAllResearchSummaries())}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Research Summaries */}
      {allSummaries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-600 mb-2">No Research Yet</h4>
          <p className="text-gray-500">
            Use the "AI Research" tab to perform Google research or the "YouTube Analysis" tab to analyze videos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allSummaries.map((summary: any) => {
            const isExpanded = expandedSummaries.has(summary.id)
            const isSelected = selectedForScript.has(summary.id)
            
            return (
              <div key={summary.id} className={`border rounded-lg ${isSelected ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleScriptSelection(summary.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      
                      <div className="flex items-center gap-2">
                        {summary.type === 'google' ? (
                          <Globe className="h-5 w-5 text-blue-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className="font-semibold text-gray-900">
                          {summary.type === 'google' ? 'Google Research' : 'YouTube Analysis'}: {summary.query}
                        </h4>
                      </div>
                      
                      {summary.usingMock && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs">
                          Mock
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {new Date(summary.timestamp).toLocaleString()}
                      </span>
                      
                      <button
                        onClick={() => toggleSummaryExpansion(summary.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          if (summary.type === 'google') {
                            dispatch(removeGoogleResearchSummary(summary.id))
                          } else {
                            dispatch(removeYouTubeResearchSummary(summary.id))
                          }
                        }}
                        className="text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Preview */}
                  <div className="text-sm text-gray-600 mb-2">
                    {summary.type === 'google' ? (
                      <p>{summary.insights.slice(0, 150)}...</p>
                    ) : (
                      <p>{summary.videosSummary.overallTheme.slice(0, 150)}...</p>
                    )}
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {summary.type === 'google' ? (
                        <>
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Insights</h5>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded">{summary.insights}</p>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Key Findings</h5>
                              <ul className="space-y-1">
                                {summary.keyFindings.map((finding: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      {index + 1}
                                    </span>
                                    {finding}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Recommendations</h5>
                              <ul className="space-y-1">
                                {summary.recommendations.map((rec: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      →
                                    </span>
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Overall Theme</h5>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded">{summary.videosSummary.overallTheme}</p>
                          </div>
                          
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Key Insights</h5>
                            <ul className="space-y-1">
                              {summary.videosSummary.keyInsights.map((insight: string, index: number) => (
                                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                    {index + 1}
                                  </span>
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Creative Prompt</h5>
                            <p className="text-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded border border-purple-200">
                              {summary.videosSummary.creativePrompt}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Move AnalysisSection outside of the main component
const AnalysisSection = ({ 
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
  formatTimestamp
}: { 
  videoId: string; 
  subtitleFile?: SubtitleFile; 
  video?: Video;
  localQueries: Record<string, string>;
  setLocalQueries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  transcriptAnalysis: any;
  expandedAnalysis: Set<string>;
  toggleAnalysisExpansion: (resultId: string) => void;
  handleAnalyzeTranscript: (videoId: string, subtitleFile: SubtitleFile) => void;
  handleAnalyzeVideoTranscript: (video: Video) => void;
  formatTimestamp: (timestamp: string) => string;
}) => {
  const isAnalyzing = transcriptAnalysis.analyzingTranscripts[videoId] || false
  const currentQuery = localQueries[videoId] || ''
  const analysisResults = transcriptAnalysis.analysisResults.filter((result: AnalysisResult) => result.videoId === videoId)
  const canAnalyze = subtitleFile?.status === 'completed'

  return (
    <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        Summarize & Extract Timestamps
      </h4>
      
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Enter phrase or topic to analyze..."
          value={currentQuery}
          onChange={(e) => setLocalQueries(prev => ({ ...prev, [videoId]: e.target.value }))}
          className="flex-1 px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
          disabled={!canAnalyze}
        />
        <button
          onClick={() => {
            if (subtitleFile) {
              handleAnalyzeTranscript(videoId, subtitleFile)
            } else if (video) {
              handleAnalyzeVideoTranscript(video)
            }
          }}
          disabled={!canAnalyze || !currentQuery.trim() || isAnalyzing}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Analyze
            </>
          )}
        </button>
      </div>

      {!canAnalyze && (
        <p className="text-sm text-purple-600 mb-2">
          Generate subtitles first to enable transcript analysis.
        </p>
      )}

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-purple-700">Analysis Results:</h5>
          {analysisResults.map((result: AnalysisResult, resultIndex: number) => (
            <div key={`${result.videoId}-${resultIndex}`} className="space-y-2">
              <div className="text-xs font-medium text-purple-600 flex items-center gap-2">
                Query: "{result.query}"
                {result.usingMock && (
                  <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded">
                    Mock
                  </span>
                )}
                <span className="text-gray-500">
                  ({result.analysis.length} result{result.analysis.length !== 1 ? 's' : ''})
                </span>
              </div>
              
              {result.analysis.map((analysis: TranscriptAnalysis, analysisIndex: number) => {
                const resultId = `${result.videoId}-${resultIndex}-${analysisIndex}`
                const isExpanded = expandedAnalysis.has(resultId)
                
                return (
                  <div key={resultId} className="border border-purple-200 rounded-md bg-white ml-4">
                    <button
                      onClick={() => toggleAnalysisExpansion(resultId)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-purple-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-purple-700">
                          Result #{analysisIndex + 1}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                          {Math.round(analysis.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(analysis.timestamp)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-purple-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-purple-100">
                        <div>
                          <h6 className="text-xs font-semibold text-purple-700 mb-1">Summary:</h6>
                          <p className="text-sm text-gray-700">{analysis.summary}</p>
                        </div>
                        
                        <div>
                          <h6 className="text-xs font-semibold text-purple-700 mb-1">Relevant Content:</h6>
                          <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded">
                            "{analysis.relevantContent}"
                          </p>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs text-purple-600">
                          <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
                          <div className="flex items-center gap-2">
                            {analysis.youtubeUrl && (
                              <a
                                href={analysis.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Watch at {formatTimestamp(analysis.timestamp)}
                              </a>
                            )}
                            <span>Analyzed: {new Date(result.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function YouTubeSearch() {
  const { data: session, status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  
  // Redux selectors
  const searchForm = useSelector((state: RootState) => selectSearchForm(state))
  const searchResults = useSelector((state: RootState) => selectSearchResults(state))
  const subtitleGeneration = useSelector((state: RootState) => selectSubtitleGeneration(state))
  const transcriptAnalysis = useSelector((state: RootState) => selectTranscriptAnalysis(state))
  const videoSummarization = useSelector((state: RootState) => selectVideoSummarization(state))
  const researchSummaries = useSelector((state: RootState) => selectResearchSummaries(state))
  const previewModal = useSelector((state: RootState) => selectPreviewModal(state))
  const error = useSelector((state: RootState) => selectError(state))
  
  // Local state for accordion visibility and input values
  const [expandedAnalysis, setExpandedAnalysis] = React.useState<Set<string>>(new Set())
  const [localQueries, setLocalQueries] = React.useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = React.useState<'youtube' | 'research' | 'current-research'>('youtube')

  const handleSearch = () => {
    if (!searchForm.searchQuery.trim() && !searchForm.channelUrl.trim()) {
      dispatch(clearError())
      return
    }

    dispatch(searchVideos({
      searchQuery: searchForm.searchQuery.trim() || undefined,
      channelUrl: searchForm.channelUrl.trim() || undefined,
      maxResults: searchForm.maxResults,
      sortOrder: searchForm.sortOrder,
    }))
  }

  const handleVideoSelect = (videoId: string) => {
    dispatch(toggleVideoSelection(videoId))
  }

  const handleSelectAll = () => {
    if (searchResults.selectedVideos.length === searchResults.videos.length) {
      dispatch(deselectAllVideos())
    } else {
      dispatch(selectAllVideos())
    }
  }

  const handleGenerateSubtitles = () => {
    if (searchResults.selectedVideos.length === 0) {
      return
    }

    dispatch(generateSubtitles(searchResults.selectedVideos))
  }

  const handleAnalyzeTranscript = (videoId: string, subtitleFile: SubtitleFile) => {
    const query = localQueries[videoId]
    if (!query || !query.trim()) {
      return
    }

    dispatch(analyzeTranscript({
      videoId: videoId,
      srtContent: subtitleFile.srtContent,
      query: query.trim(),
      videoTitle: subtitleFile.title
    }))
  }

  const handleAnalyzeVideoTranscript = (video: Video) => {
    const videoId = video.id.videoId
    const query = localQueries[videoId]
    const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
    
    if (!query || !query.trim() || !subtitleFile || subtitleFile.status !== 'completed') {
      return
    }

    dispatch(analyzeTranscript({
      videoId: videoId,
      srtContent: subtitleFile.srtContent,
      query: query.trim(),
      videoTitle: video.snippet.title
    }))
  }

  const handlePreviewSRT = (subtitle: SubtitleFile) => {
    dispatch(setPreviewContent({ 
      content: subtitle.srtContent, 
      title: subtitle.title 
    }))
  }

  const downloadSRTFile = (subtitle: SubtitleFile) => {
    const blob = new Blob([subtitle.srtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = subtitle.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleAnalysisExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedAnalysis)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedAnalysis(newExpanded)
  }

  const formatTimestamp = (timestamp: string) => {
    // Convert from SRT format (HH:MM:SS,mmm) to display format
    return timestamp.replace(',', '.')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024).toFixed(2) + ' KB'
  }

  const getSearchInfoText = () => {
    if (!searchResults.searchInfo) return ''
    
    if (searchResults.searchInfo.query && searchResults.searchInfo.channelId) {
      return `"${searchResults.searchInfo.query}" in channel (${searchResults.searchInfo.channelId})`
    } else if (searchResults.searchInfo.query) {
      return `"${searchResults.searchInfo.query}" across YouTube`
    } else if (searchResults.searchInfo.channelId) {
      return `recent videos from channel (${searchResults.searchInfo.channelId})`
    }
    return ''
  }

  const getVideoAnalysisResults = (videoId: string): AnalysisResult[] => {
    return transcriptAnalysis.analysisResults.filter(result => result.videoId === videoId)
  }

  const getStatusDisplay = (subtitleFile: SubtitleFile) => {
    const statusMessages = {
      extracting: 'Extracting Subtitles',
      downloading: 'Downloading Audio',
      transcribing: 'Generating Subtitles',
      processing: 'Processing',
      completed: 'Completed',
      error: 'Error'
    }

    const statusColors = {
      extracting: 'text-blue-600',
      downloading: 'text-blue-600',
      transcribing: 'text-purple-600',
      processing: 'text-yellow-600',
      completed: 'text-green-600',
      error: 'text-red-600'
    }

    return {
      message: statusMessages[subtitleFile.status] || subtitleFile.status,
      color: statusColors[subtitleFile.status] || 'text-gray-600'
    }
  }

  const getMethodIcon = (method?: string) => {
    if (method === 'yt-dlp') {
      return (
        <div title="Fast extraction via yt-dlp">
          <Zap className="h-3 w-3 text-blue-600" />
        </div>
      )
    } else if (method === 'whisper') {
      return (
        <div title="AI transcription via Whisper">
          <Mic className="h-3 w-3 text-purple-600" />
        </div>
      )
    }
    return null
  }

  const handleSummarizeVideos = () => {
    const videosWithSubtitles = searchResults.selectedVideos.filter(videoId => {
      const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
      return subtitleFile && subtitleFile.status === 'completed'
    })

    if (videosWithSubtitles.length === 0) {
      return
    }

    dispatch(summarizeVideos(videosWithSubtitles))
  }

  const getVideosWithSubtitlesCount = () => {
    return searchResults.selectedVideos.filter(videoId => {
      const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
      return subtitleFile && subtitleFile.status === 'completed'
    }).length
  }

  const YouTubeAuthButton = () => {
    if (status === 'loading') {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          disabled
          className="border-gray-300 bg-white text-gray-400"
        >
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </Button>
      )
    }

    if (status === 'authenticated') {
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="text-green-600 font-medium">✓ Authenticated</div>
            <div className="text-gray-500 text-xs">{session?.user?.email}</div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => signOut()}
            className="flex items-center gap-2 border-red-300 bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      )
    }

    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => signIn('google')}
        className="flex items-center gap-2 border-blue-300 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm transition-all duration-200 hover:shadow-md"
      >
        <span className="font-medium">Sign in for Enhanced Features</span>
      </Button>
    )
  }

  // Validation for search form
  const isSearchFormValid = searchForm.searchQuery.trim() || searchForm.channelUrl.trim()
  
  return (
    <div className="flex-1 p-6 bg-white overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">YouTube Research Assistant</h1>
            <p className="text-gray-600">
              Search for videos, generate subtitles, analyze transcripts, and conduct comprehensive research with AI-powered insights.
            </p>
          </div>
          <div className="ml-4">
            <YouTubeAuthButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('youtube')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'youtube'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  YouTube Analysis
                </div>
              </button>
              <button
                onClick={() => setActiveTab('research')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'research'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Research
                </div>
              </button>
              <button
                onClick={() => setActiveTab('current-research')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'current-research'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Current Research
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'youtube' && (
          <div>
            {/* Search Form */}
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-2">
                    Search Query (optional):
                  </label>
                  <input
                    type="text"
                    id="searchQuery"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter keywords to search for..."
                    value={searchForm.searchQuery}
                    onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to get all recent videos from a channel, or enter keywords to search for specific content.
                  </p>
                </div>

                <div>
                  <label htmlFor="channelUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    Channel URL or Channel ID (optional):
                  </label>
                  <input
                    type="text"
                    id="channelUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="https://www.youtube.com/@channelname or UC_x5XG1OV2P6uZZ5FSM9Ttw"
                    value={searchForm.channelUrl}
                    onChange={(e) => dispatch(setChannelUrl(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to search all of YouTube, or specify a channel to search within that channel only.<br />
                    Supported formats: @handle, /channel/ID, /c/name, /user/name, or just the channel ID
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Results:
                    </label>
                    <input
                      type="number"
                      id="maxResults"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      min="1"
                      max="50"
                      value={searchForm.maxResults}
                      onChange={(e) => dispatch(setMaxResults(parseInt(e.target.value) || 50))}
                    />
                  </div>

                  <div>
                    <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-2">
                      Sort Order:
                    </label>
                    <select
                      id="sortOrder"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      value={searchForm.sortOrder}
                      onChange={(e) => dispatch(setSortOrder(e.target.value))}
                    >
                      <option value="date">Most Recent</option>
                      <option value="relevance">Most Relevant</option>
                      <option value="viewCount">Most Viewed</option>
                      <option value="rating">Highest Rated</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  disabled={searchResults.searchLoading || !isSearchFormValid}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors"
                >
                  {searchResults.searchLoading ? 'Searching...' : 'Search Videos'}
                </button>
                
                {!isSearchFormValid && (
                  <p className="text-sm text-red-600 mt-2">
                    Please enter either a search query or a channel URL (or both).
                  </p>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex justify-between items-center">
                <span>{error}</span>
                <button 
                  onClick={() => dispatch(clearError())}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            )}

            {/* Search Results */}
            {searchResults.searchInfo && searchResults.videos.length > 0 && (
              <>
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
                  Found {searchResults.videos.length} videos for {getSearchInfoText()}
                  <br />
                  Requested: {searchResults.searchInfo.maxResults} results
                </div>

                {/* Selection Controls */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <button
                        onClick={handleSelectAll}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors"
                      >
                        {searchResults.selectedVideos.length === searchResults.videos.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="ml-4 text-blue-700">
                        {searchResults.selectedVideos.length} of {searchResults.videos.length} videos selected
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateSubtitles}
                        disabled={searchResults.selectedVideos.length === 0 || subtitleGeneration.generatingSubtitles}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors flex items-center gap-2"
                      >
                        {subtitleGeneration.generatingSubtitles ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating Subtitles...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Generate Subtitles ({searchResults.selectedVideos.length})
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={handleSummarizeVideos}
                        disabled={getVideosWithSubtitlesCount() === 0 || videoSummarization.summarizingVideos}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors flex items-center gap-2"
                      >
                        {videoSummarization.summarizingVideos ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Summarizing...
                          </>
                        ) : (
                          <>
                            <Lightbulb className="h-4 w-4" />
                            Summarize ({getVideosWithSubtitlesCount()})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {searchResults.selectedVideos.length === 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      Please select at least one video to generate subtitles or create summaries.
                    </p>
                  )}
                  
                  {searchResults.selectedVideos.length > 0 && getVideosWithSubtitlesCount() === 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      Generate subtitles first to enable video summarization.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Videos List */}
            <div className="space-y-4">
              {searchResults.videos.map((video) => {
                const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`
                const isSelected = searchResults.selectedVideos.includes(video.id.videoId)
                const videoId = video.id.videoId
                const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
                
                return (
                  <div key={videoId} className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm border-l-4 ${isSelected ? 'border-l-green-500 bg-green-50' : 'border-l-red-500'}`}>
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleVideoSelect(video.id.videoId)}
                        className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-2">{video.snippet.title}</h3>
                        <p className="text-gray-600 mb-3 line-clamp-3">{video.snippet.description}</p>
                        <div className="text-sm text-gray-500 mb-2">
                          <div>Channel: {video.snippet.channelTitle}</div>
                          <div>Published: {formatDate(video.snippet.publishedAt)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-800 text-sm underline"
                          >
                            Watch on YouTube
                          </a>
                        </div>
                        
                        {/* Analysis Section for Videos */}
                        <AnalysisSection 
                          videoId={videoId} 
                          video={video} 
                          subtitleFile={subtitleFile}
                          localQueries={localQueries}
                          setLocalQueries={setLocalQueries}
                          transcriptAnalysis={transcriptAnalysis}
                          expandedAnalysis={expandedAnalysis}
                          toggleAnalysisExpansion={toggleAnalysisExpansion}
                          handleAnalyzeTranscript={handleAnalyzeTranscript}
                          handleAnalyzeVideoTranscript={handleAnalyzeVideoTranscript}
                          formatTimestamp={formatTimestamp}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Generated Subtitle Files */}
            {subtitleGeneration.subtitleFiles.length > 0 && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Generated Subtitle Files</h2>
                <div className="space-y-4">
                  {subtitleGeneration.subtitleFiles.map((subtitleFile) => {
                    const statusDisplay = getStatusDisplay(subtitleFile)
                    
                    return (
                      <div key={subtitleFile.videoId} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 mb-2">{subtitleFile.title}</h3>
                            <div className="text-sm text-gray-500">
                              <div>File: {subtitleFile.filename}</div>
                              <div>Size: {formatFileSize(subtitleFile.size)}</div>
                              <div className="flex items-center gap-2">
                                Status: 
                                <span className={`font-medium ${statusDisplay.color}`}>
                                  {statusDisplay.message}
                                </span>
                                {getMethodIcon(subtitleFile.method)}
                                {subtitleFile.method && (
                                  <span className="text-xs text-gray-400">
                                    via {subtitleFile.method === 'yt-dlp' ? 'yt-dlp' : 'Whisper AI'}
                                  </span>
                                )}
                              </div>
                              {subtitleFile.progress && (
                                <div className="text-xs text-gray-400 mt-1">{subtitleFile.progress}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {subtitleFile.status === 'completed' && (
                              <>
                                <button
                                  onClick={() => handlePreviewSRT(subtitleFile)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded flex items-center gap-2 transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                  Preview
                                </button>
                                <button
                                  onClick={() => downloadSRTFile(subtitleFile)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded flex items-center gap-2 transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                  Download SRT
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {subtitleFile.status === 'error' && subtitleFile.progress && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            Error: {subtitleFile.progress}
                          </div>
                        )}
                        
                        {/* Analysis Section for Subtitle Files */}
                        <AnalysisSection 
                          videoId={subtitleFile.videoId} 
                          subtitleFile={subtitleFile}
                          localQueries={localQueries}
                          setLocalQueries={setLocalQueries}
                          transcriptAnalysis={transcriptAnalysis}
                          expandedAnalysis={expandedAnalysis}
                          toggleAnalysisExpansion={toggleAnalysisExpansion}
                          handleAnalyzeTranscript={handleAnalyzeTranscript}
                          handleAnalyzeVideoTranscript={handleAnalyzeVideoTranscript}
                          formatTimestamp={formatTimestamp}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Video Summary Section */}
            {videoSummarization.videosSummary && (
              <div className="mb-8">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-900 flex items-center gap-2">
                      <Lightbulb className="h-6 w-6" />
                      AI Video Summary & Insights
                    </h2>
                    <button
                      onClick={() => dispatch(clearVideosSummary())}
                      className="text-purple-600 hover:text-purple-800 text-sm underline"
                    >
                      Clear Summary
                    </button>
                  </div>

                  {/* Overall Theme */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Overall Theme
                    </h3>
                    <p className="text-gray-700 bg-white p-4 rounded-lg border border-purple-100">
                      {videoSummarization.videosSummary.overallTheme}
                    </p>
                  </div>

                  {/* Key Insights */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Key Insights
                    </h3>
                    <div className="grid gap-3">
                      {videoSummarization.videosSummary.keyInsights.map((insight, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-purple-100 flex items-start gap-3">
                          <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {index + 1}
                          </span>
                          <p className="text-gray-700">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Individual Video Summaries */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">Individual Video Analysis</h3>
                    <div className="grid gap-4">
                      {videoSummarization.videosSummary.videoSummaries.map((video, index) => (
                        <div key={video.videoId} className="bg-white p-4 rounded-lg border border-purple-100">
                          <h4 className="font-semibold text-gray-900 mb-2">{video.title}</h4>
                          <p className="text-sm text-purple-600 mb-3">Main Topic: {video.mainTopic}</p>
                          <p className="text-sm text-amber-600 mb-3">Emotional Tone: {video.emotionalTone}</p>
                          
                          <div className="space-y-3">
                            <div>
                            <h5 className="text-sm font-medium text-gray-700">Key Points:</h5>
                            <ul className="list-disc list-inside space-y-1">
                              {video.keyPoints.map((point, pointIndex) => (
                                <li key={pointIndex} className="text-sm text-gray-600">{point}</li>
                              ))}
                            </ul>
                          </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-700">Narrative Elements:</h5>
                              <ul className="list-disc list-inside space-y-1">
                                {video.narrativeElements.map((element, elementIndex) => (
                                  <li key={elementIndex} className="text-sm text-blue-600">{element}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          {video.timestamp && (
                            <p className="text-xs text-gray-500 mt-2">
                              Key moment: {formatTimestamp(video.timestamp)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Narrative Themes */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Central Narrative Themes
                    </h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="grid gap-3">
                        {videoSummarization.videosSummary.narrativeThemes.map((theme, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                              {index + 1}
                            </span>
                            <p className="text-gray-700">{theme}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Character Insights */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Character Insights & Motivations
                    </h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="space-y-2">
                        {videoSummarization.videosSummary.characterInsights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-emerald-600 mt-1">👤</span>
                            <span className="text-gray-700">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Conflict Elements */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <Spark className="h-5 w-5" />
                      Dramatic Conflicts & Tensions
                    </h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="space-y-2">
                        {videoSummarization.videosSummary.conflictElements.map((conflict, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-red-600 mt-1">⚡</span>
                            <span className="text-gray-700">{conflict}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Story Ideas */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Story & Script Concepts
                    </h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="grid gap-4">
                        {videoSummarization.videosSummary.storyIdeas.map((idea, index) => (
                          <div key={index} className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-start gap-3">
                              <span className="bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                💡
                              </span>
                              <p className="text-gray-800 font-medium">{idea}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Creative Writing Prompt */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <PenTool className="h-5 w-5" />
                      Your Creative Writing Prompt
                    </h3>
                    <div className="bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 p-6 rounded-lg border-2 border-purple-300">
                      <div className="flex items-start gap-4">
                        <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
                          <PenTool className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-purple-900 mb-3">Story Inspiration</h4>
                          <p className="text-gray-800 leading-relaxed text-base">
                            {videoSummarization.videosSummary.creativePrompt}
                          </p>
                          <div className="mt-4 p-3 bg-white/70 rounded-lg">
                            <p className="text-sm text-purple-700 font-medium">
                              💡 Use this prompt as a starting point for your story, script, or creative project. 
                              Consider the themes, characters, and conflicts identified above to build a compelling narrative.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Common Patterns */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">Common Patterns</h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <ul className="space-y-2">
                        {videoSummarization.videosSummary.commonPatterns.map((pattern, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-purple-600 mt-1">•</span>
                            <span className="text-gray-700">{pattern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actionable Items */}
                  <div>
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">Writer's Action Plan</h3>
                    <div className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="space-y-3">
                        {videoSummarization.videosSummary.actionableItems.map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                              ✓
                            </span>
                            <p className="text-gray-700">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SRT Preview Modal */}
            {previewModal.previewContent && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold">
                      SRT Preview: {previewModal.previewTitle}
                    </h2>
                    <button
                      onClick={() => dispatch(setPreviewContent(null))}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="p-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {previewModal.previewContent}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'research' && (
          <ResearchTab 
            researchSummaries={researchSummaries}
            dispatch={dispatch}
          />
        )}

        {activeTab === 'current-research' && (
          <CurrentResearchTab 
            researchSummaries={researchSummaries}
            dispatch={dispatch}
          />
        )}
      </div>
    </div>
  )
} 