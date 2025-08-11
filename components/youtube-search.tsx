'use client'

import React, { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  generateSubtitlesIndividually,
  analyzeTranscript,
  analyzeVideoWithGemini,
  summarizeVideos,
  clearVideosSummary,
  setAnalysisQuery,
  clearAnalysisResults,
  clearGeminiAnalysisResults,
  clearAllGeminiAnalysisResults,
  removeYouTubeResearchSummary,
  clearAllResearchSummaries,
  markMultipleResearchAsApplied,
  selectSearchForm,
  selectSearchResults,
  selectSubtitleGeneration,
  selectTranscriptAnalysis,
  selectGeminiAnalysis,
  selectVideoSummarization,
  selectResearchSummaries,
  selectPreviewModal,
  selectError,
  type Video,
  type SubtitleFile,
  type AnalysisResult,
  type GeminiAnalysisResult,
  type VideosSummary,
  type TranscriptAnalysis,
  type YouTubeResearchSummary,
  addYouTubeResearchSummary,
  setMinDuration,
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

interface ChannelAnalysisResult {
  channelInfo: {
    snippet: {
      title: string
      description: string
      thumbnails: any
    }
    statistics: {
      subscriberCount: string
      videoCount: string
      viewCount: string
    }
  }
  totalVideos: number
  analyzedVideos: number
  top10Videos: {
    id: string
    title: string
    description: string
    publishedAt: string
    viewCount: string
    likeCount: string
    commentCount: string
    duration: string
    thumbnails: any
  }[]
  titleSuggestions: string[]
  analysis: string
  userPrompt?: string
}

// Enhanced Research Tab Component (Google + Perplexity + Firecrawl)
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

  const [filteringStats, setFilteringStats] = React.useState<any>(null)
  const [availableLinks, setAvailableLinks] = React.useState<any[]>([])
  const [scrapingLinks, setScrapingLinks] = React.useState<Set<string>>(new Set())




  const handlePerplexityResearch = async () => {
    if (!researchQuery.trim()) return

    setIsResearching(true)
    setFilteringStats(null)
    setAvailableLinks([])
    
    try {
      console.log('🔍 Starting Perplexity research...')
      
      const response = await fetch('/api/research/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: researchQuery,
          context: researchContext,
          maxResults: 20,
          region: 'us',
          language: 'en'
        })
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to perform Perplexity research')
      }

      console.log('✅ Perplexity research completed')

      // Store filtering stats and available links
      if (data.filteringStats) {
        setFilteringStats(data.filteringStats)
      }
      if (data.availableLinks) {
        setAvailableLinks(data.availableLinks)
      }

            // Show success notification - Perplexity only provides links, no research card created
      alert(`✅ Perplexity research completed! Found ${data.availableLinks?.length || 0} scrapeable links. Click "Scrape Content" on any link to create research cards.`)

      // Clear form after successful research
      setResearchQuery('')
      setResearchContext('')
      
    } catch (error) {
      console.error('Perplexity research error:', error)
      alert(`Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsResearching(false)
    }
  }

  const handleScrapeLink = async (url: string) => {
    if (scrapingLinks.has(url)) return

    setScrapingLinks(prev => new Set([...prev, url]))
    
    try {
      console.log(`🔥 Starting Firecrawl scraping for: ${url}`)
      
      const response = await fetch('/api/research/scrape-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape link')
      }

      console.log('✅ Firecrawl scraping completed')

      // Create scraped content summary
      const scrapedResearch = {
        id: `scraped-${Date.now()}`,
        query: `Article: ${data.title}`,
        videosSummary: {
          overallTheme: `Article content: ${data.title}`,
          keyInsights: ['Article content extracted and processed via Firecrawl'],
          videoSummaries: [{
            videoId: `scraped-single`,
            title: data.title,
            summary: data.content ? data.content.substring(0, 500) + '...' : 'Article content scraped',
            keyPoints: data.content ? data.content.split('\n').filter((line: string) => line.trim()).slice(0, 5) : ['Article content'],
            thumbnailUrl: '',
            link: url,
            insights: data.content || 'Full article content scraped'
          }],
          commonPatterns: ['Individual article scraping'],
          actionableItems: ['Review the extracted content for insights'],
          narrativeThemes: ['Article-based content themes'],
          characterInsights: ['Key figures from article'],
          conflictElements: ['Issues identified in article'],
          storyIdeas: ['Content ideas from article'],
          creativePrompt: `Create content based on article: ${data.title}`
        },
        timestamp: new Date().toISOString(),
        usingMock: false,
        appliedToScript: false,
        analysisType: 'firecrawl-scraping' as any,
        rawContent: data.content || '' // Raw markdown content from Firecrawl
      }

      // Add to research summaries
      dispatch({
        type: 'youtube/addYouTubeResearchSummary',
        payload: scrapedResearch
      })

      // Show success notification
      alert(`✅ Article scraped successfully! "${data.title}" saved to Current Research tab.`)

      // Remove the link from available links
      setAvailableLinks(prev => prev.filter(link => link.url !== url))
      
    } catch (error) {
      console.error('Link scraping error:', error)
      alert(`Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setScrapingLinks(prev => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })
    }
  }

  

  const handleResearch = () => {
    handlePerplexityResearch()
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



  return (
    <div className="space-y-6">
      {/* Research Input Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Globe className="h-6 w-6" />
          AI Research Assistant
        </h3>
        
        <div className="space-y-4">
          {/* Research Method */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <div>
                <div className="font-medium text-purple-800">Perplexity AI Research</div>
                <div className="text-xs text-purple-600">Intelligent web search with automatic link scraping</div>
              </div>
            </div>
          </div>

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
            className="w-full font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white"
          >
            {isResearching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Researching with Perplexity AI...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                Start Perplexity AI Research
              </>
            )}
          </button>



          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Brain className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-800">
                <p className="font-medium">Perplexity AI Research</p>
                <p className="mt-1">
                  Uses advanced AI to search the web, filter out social media links, and provide scraping capabilities for deep content analysis.
                </p>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Filtering Stats Notice */}
      {filteringStats && filteringStats.filteredOut > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Links Filtered for Scraping</p>
              <p className="mt-1">
                Found {filteringStats.totalFound} links, {filteringStats.availableForScraping} available for scraping. 
                Filtered out {filteringStats.filteredOut} social media links ({filteringStats.filteredDomains.join(', ')}) 
                - {filteringStats.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Available Links for Scraping */}
      {availableLinks.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Available Links for Deep Analysis ({availableLinks.length})
          </h4>
          <p className="text-sm text-green-700 mb-4">
            These links can be scraped for detailed content analysis. Click "Scrape Content" to extract full article text.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableLinks.map((link: any, index: number) => (
              <div key={index} className="bg-white border border-green-200 rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-green-900 truncate">
                      {link.title}
                    </h5>
                    <p className="text-xs text-green-600 truncate">
                      {link.source} • {link.date}
                    </p>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline truncate block mt-1"
                    >
                      {link.url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleScrapeLink(link.url)}
                    disabled={scrapingLinks.has(link.url)}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium py-2 px-3 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                  >
                    {scrapingLinks.has(link.url) ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Scrape Content
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  )
}

// Current Research Tab Component
const CurrentResearchTab = ({ 
  researchSummaries,
  dispatch,
  onSaveToHistory
}: {
  researchSummaries: any
  dispatch: any
  onSaveToHistory: (item: any) => void
}) => {
  const [expandedSummaries, setExpandedSummaries] = React.useState<Set<string>>(new Set())
  const [selectedForScript, setSelectedForScript] = React.useState<Set<string>>(new Set())
  const [editingRawContent, setEditingRawContent] = React.useState<{[key: string]: string}>({})

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
    
    // Get research IDs for all types
    const youtubeIds = selectedSummaries.map(s => s.id)
    
    // Mark selected summaries as applied in Redux state
    dispatch(markMultipleResearchAsApplied({ youtubeIds }))
    
    // Show success message with guidance
    const summaryTypes = selectedSummaries.map(s => {
      if (s.type === 'perplexity-ai') return 'Perplexity AI Research'
      if (s.type === 'firecrawl-scraping') return 'Article Scraping'
      if (s.type === 'web-research') return 'Web Research'
      return 'YouTube Analysis'
    }).join(', ')
    
    // For now, we'll show a success message and log the data
    // In a real implementation, this would integrate with the script generator
    console.log('Selected research summaries for script generation:', selectedSummaries)
    
    // Show success message
    alert(`✅ Applied ${selectedSummaries.length} research summaries (${summaryTypes}) to script generation!\n\nThese research summaries are now marked as applied and will be automatically included when generating script sections.\n\nGo to the Script Generator to create sections with this research data.`)
    
    // Clear selection after applying
    setSelectedForScript(new Set())
  }

  const allSummaries = [
    ...researchSummaries.youtubeResearchSummaries.map((s: YouTubeResearchSummary) => ({
      ...s,
      type: (s as any).analysisType || 'youtube' // Use analysisType if available, fallback to youtube
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Count applied summaries
  const appliedCount = allSummaries.filter(s => s.appliedToScript).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Current Research ({allSummaries.length})
          {appliedCount > 0 && (
            <span className="text-sm font-normal text-green-600">
              • {appliedCount} applied
            </span>
          )}
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
            const isApplied = summary.appliedToScript
            
            return (
              <div key={summary.id} className={`border rounded-lg ${
                isApplied 
                  ? 'border-green-300 bg-green-50' 
                  : isSelected 
                    ? 'border-purple-300 bg-purple-50' 
                    : 'border-gray-200 bg-white'
              }`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleScriptSelection(summary.id)}
                        disabled={isApplied}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded disabled:opacity-50"
                      />
                      
                      <div className="flex items-center gap-2">
                        {summary.type === 'perplexity-ai' ? (
                          <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        ) : summary.type === 'firecrawl-scraping' ? (
                          <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : summary.type === 'web-research' ? (
                          <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                          </svg>
                        ) : (
                          <FileText className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className="font-semibold text-gray-900">
                          {summary.type === 'perplexity-ai' ? 'Perplexity AI Research' : 
                           summary.type === 'firecrawl-scraping' ? 'Article Scraping' : 
                           summary.type === 'web-research' ? 'Web Research' : 
                           'YouTube Analysis'}: {summary.query}
                        </h4>
                        
                        {/* Analysis type badges for YouTube research */}
                        {(summary.type === 'youtube' || summary.type === 'openai' || summary.type === 'gemini' || summary.type === 'gemini+gpt') && summary.analysisType && (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            summary.analysisType === 'openai' 
                              ? 'bg-purple-100 text-purple-700'
                              : summary.analysisType === 'gemini+gpt'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {summary.analysisType === 'openai' 
                              ? 'OpenAI'
                              : summary.analysisType === 'gemini+gpt'
                                ? 'Gemini + GPT-4o-mini'
                                : 'Gemini AI'
                            }
                          </span>
                        )}
                      </div>
                      
                      {isApplied && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                          ✓ Applied to Script
                        </span>
                      )}
                      
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
                        onClick={() => onSaveToHistory(summary)}
                        className="text-purple-600 hover:text-purple-800 p-1"
                        title="Save to History"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      
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
                          dispatch(removeYouTubeResearchSummary(summary.id))
                        }}
                        className="text-red-400 hover:text-red-600"
                        title="Remove from Current Research"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Preview */}
                  <div className="text-sm text-gray-600 mb-2">
                    <p>{summary.videosSummary.overallTheme.slice(0, 150)}...</p>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* All research now uses videosSummary structure */}
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
                          
                          {/* Timestamps Section - Added for Gemini analysis */}
                          {summary.videosSummary.timestamps && summary.videosSummary.timestamps.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Key Timestamps</h5>
                              <div className="space-y-2">
                                {summary.videosSummary.timestamps.map((timestamp: any, index: number) => (
                                  <div key={index} className="bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Clock className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium text-blue-700">{timestamp.time}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-1">{timestamp.description}</p>
                                    <p className="text-xs text-blue-600">{timestamp.significance}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Similar Titles Section - Added for Gemini analysis */}
                          {summary.videosSummary.similarTitles && summary.videosSummary.similarTitles.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Similar Title Suggestions</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {summary.videosSummary.similarTitles.map((title: string, index: number) => (
                                  <div key={index} className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded border-l-4 border-green-400">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                                        {index + 1}
                                      </span>
                                      <p className="text-sm text-gray-800 font-medium">{title}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                💡 These are AI-generated title suggestions based on the video's content, style, and themes
                              </p>
                            </div>
                          )}
                          
                          {/* Character Insights */}
                          {summary.videosSummary.characterInsights && summary.videosSummary.characterInsights.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Character Insights</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.characterInsights.map((insight: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      👤
                                    </span>
                                    {insight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Conflict Elements */}
                          {summary.videosSummary.conflictElements && summary.videosSummary.conflictElements.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Conflict Elements</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.conflictElements.map((conflict: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      ⚡
                                    </span>
                                    {conflict}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          

                          
                          {/* Common Patterns */}
                          {summary.videosSummary.commonPatterns && summary.videosSummary.commonPatterns.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Common Patterns</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.commonPatterns.map((pattern: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      🔄
                                    </span>
                                    {pattern}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          

                        
                      {/* End of all research content */}

                      {/* Raw Content Section - Only for AI Research (Firecrawl) */}
                      {(summary as any).rawContent && (
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                              <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Raw Content
                            </h5>
                            {editingRawContent[summary.id] !== undefined ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    // Save the edited content
                                    const updatedSummary = {
                                      ...summary,
                                      rawContent: editingRawContent[summary.id]
                                    }
                                    // Update in Redux
                                    dispatch({
                                      type: 'youtube/removeYouTubeResearchSummary',
                                      payload: summary.id
                                    })
                                    dispatch({
                                      type: 'youtube/addYouTubeResearchSummary',
                                      payload: updatedSummary
                                    })
                                    // Clear editing state
                                    const newEditing = { ...editingRawContent }
                                    delete newEditing[summary.id]
                                    setEditingRawContent(newEditing)
                                    alert('✅ Raw content saved!')
                                  }}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    const newEditing = { ...editingRawContent }
                                    delete newEditing[summary.id]
                                    setEditingRawContent(newEditing)
                                  }}
                                  className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRawContent({
                                    ...editingRawContent,
                                    [summary.id]: (summary as any).rawContent
                                  })
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          
                          {editingRawContent[summary.id] !== undefined ? (
                            <textarea
                              value={editingRawContent[summary.id]}
                              onChange={(e) => setEditingRawContent({
                                ...editingRawContent,
                                [summary.id]: e.target.value
                              })}
                              className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-vertical"
                              placeholder="Raw markdown content..."
                            />
                          ) : (
                            <div className="bg-gray-50 p-3 rounded-lg border">
                              <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                                {(summary as any).rawContent || 'No raw content available'}
                              </pre>
                            </div>
                          )}
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
    </div>
  )
}

// Research History Tab Component
const ResearchHistoryTab = ({ 
  researchHistory, 
  editingResearch, 
  onStartEditing, 
  onSaveEdit, 
  onCancelEdit, 
  onUpdateEdit, 
  onDeleteFromHistory, 
  onClearHistory, 
  onRestoreFromHistory 
}: {
  researchHistory: any[]
  editingResearch: {id: string, field: string, value: string} | null
  onStartEditing: (id: string, field: string, value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onUpdateEdit: (value: string) => void
  onDeleteFromHistory: (id: string) => void
  onClearHistory: () => void
  onRestoreFromHistory: (item: any) => void
}) => {
  const [searchFilter, setSearchFilter] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'google' | 'perplexity' | 'youtube'>('all')
  const [sortBy, setSortBy] = React.useState<'date' | 'type' | 'query'>('date')

  const filteredHistory = researchHistory
    .filter(item => {
      const matchesSearch = !searchFilter || 
        item.query?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.insights?.toLowerCase().includes(searchFilter.toLowerCase())
      
      const matchesType = typeFilter === 'all' || 
        (typeFilter === 'google' && !item.researchMethod) ||
        (typeFilter === 'perplexity' && item.researchMethod === 'perplexity_ai') ||
        (typeFilter === 'youtube' && item.analysisType)
      
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.savedAt || b.timestamp).getTime() - new Date(a.savedAt || a.timestamp).getTime()
        case 'type':
          const getType = (item: any) => item.researchMethod || item.analysisType || 'google'
          return getType(a).localeCompare(getType(b))
        case 'query':
          return (a.query || '').localeCompare(b.query || '')
        default:
          return 0
      }
    })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getResearchIcon = (item: any) => {
    if (item.analysisType) return <Spark className="h-4 w-4 text-blue-600" />
    if (item.researchMethod === 'perplexity_ai') return <Brain className="h-4 w-4 text-purple-600" />
    if (item.researchMethod === 'firecrawl_scraping') return <Download className="h-4 w-4 text-green-600" />
    if (item.researchMethod === 'web_research_perplexity_firecrawl') return <ExternalLink className="h-4 w-4 text-emerald-600" />
    return <Globe className="h-4 w-4 text-blue-600" />
  }

  const getResearchType = (item: any) => {
    if (item.analysisType) return 'YouTube Analysis'
    if (item.researchMethod === 'perplexity_ai') return 'Perplexity AI'
    if (item.researchMethod === 'firecrawl_scraping') return 'Scraped Article'
    if (item.researchMethod === 'web_research_perplexity_firecrawl') return 'Web Research'
    return 'Google Research'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-purple-600" />
            Research History
          </h2>
          <p className="text-gray-600 mt-1">
            View, edit, and manage your past research sessions
          </p>
        </div>
        
        {researchHistory.length > 0 && (
          <button
            onClick={onClearHistory}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All History
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search research content..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            >
              <option value="all">All Types</option>
              <option value="google">Google Research</option>
              <option value="perplexity">Perplexity AI</option>
              <option value="youtube">YouTube Analysis</option>
              
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            >
              <option value="date">Date (Newest First)</option>
              <option value="type">Research Type</option>
              <option value="query">Query Name</option>
            </select>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {filteredHistory.length} of {researchHistory.length} research sessions
        </div>
      </div>

      {/* Research History Items */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {researchHistory.length === 0 ? 'No Research History' : 'No Matching Results'}
          </h3>
          <p className="text-gray-600">
            {researchHistory.length === 0 
              ? 'Your research sessions will appear here automatically' 
              : 'Try adjusting your filters to find specific research'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => (
            <div key={item.historyId} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getResearchIcon(item)}
                  <div>
                    {editingResearch?.id === item.historyId && editingResearch?.field === 'query' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingResearch.value}
                          onChange={(e) => onUpdateEdit(e.target.value)}
                          className="text-lg font-semibold text-gray-900 border border-purple-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          autoFocus
                        />
                        <button
                          onClick={onSaveEdit}
                          className="text-green-600 hover:text-green-800 p-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <h3 
                        className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-purple-600 transition-colors"
                        onClick={() => onStartEditing(item.historyId, 'query', item.query || '')}
                      >
                        {item.query || 'Untitled Research'}
                      </h3>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        {getResearchIcon(item)}
                        {getResearchType(item)}
                      </span>
                      <span>Saved: {formatDate(item.savedAt || item.timestamp)}</span>
                      {item.lastModified && (
                        <span>Modified: {formatDate(item.lastModified)}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRestoreFromHistory(item)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </button>
                      <button
                        onClick={() => onDeleteFromHistory(item.historyId)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete from history"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
              </div>
              
              {/* Research Content */}
              <div className="space-y-3">
                {item.insights && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Key Insights</h4>
                    {editingResearch?.id === item.historyId && editingResearch?.field === 'insights' ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingResearch.value}
                          onChange={(e) => onUpdateEdit(e.target.value)}
                          className="w-full p-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={onSaveEdit}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p 
                        className="text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        onClick={() => onStartEditing(item.historyId, 'insights', item.insights)}
                      >
                        {item.insights}
                      </p>
                    )}
                  </div>
                )}
                
                {item.keyFindings && item.keyFindings.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-700">Key Findings</h4>
                      {editingResearch?.id === item.historyId && editingResearch?.field === 'keyFindings' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={onSaveEdit}
                            className="text-green-600 hover:text-green-800 text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onStartEditing(item.historyId, 'keyFindings', JSON.stringify(item.keyFindings))}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    
                    {editingResearch?.id === item.historyId && editingResearch?.field === 'keyFindings' ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingResearch.value}
                          onChange={(e) => onUpdateEdit(e.target.value)}
                          placeholder="Enter key findings, one per line"
                          className="w-full p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          rows={4}
                        />
                        <p className="text-xs text-gray-500">Enter each finding on a new line</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {item.keyFindings.slice(0, 3).map((finding: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span className="text-sm text-gray-700">{finding}</span>
                          </div>
                        ))}
                        {item.keyFindings.length > 3 && (
                          <div className="text-xs text-gray-500 ml-3">
                            +{item.keyFindings.length - 3} more findings
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {item.scrapedArticles && item.scrapedArticles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-700">
                        Scraped Articles ({item.scrapedArticles.length})
                      </h4>
                      {editingResearch?.id === item.historyId && editingResearch?.field === 'scrapedArticles' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={onSaveEdit}
                            className="text-green-600 hover:text-green-800 text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onStartEditing(item.historyId, 'scrapedArticles', JSON.stringify(item.scrapedArticles))}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    
                    {editingResearch?.id === item.historyId && editingResearch?.field === 'scrapedArticles' ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingResearch.value}
                          onChange={(e) => onUpdateEdit(e.target.value)}
                          placeholder="Edit scraped articles data (JSON format)"
                          className="w-full p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                          rows={6}
                        />
                        <p className="text-xs text-gray-500">Edit the JSON data for scraped articles</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {item.scrapedArticles.slice(0, 3).map((article: any, index: number) => (
                          <span key={index} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                            {article.title.substring(0, 30)}...
                          </span>
                        ))}
                        {item.scrapedArticles.length > 3 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            +{item.scrapedArticles.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// AnalysisSection component removed - analysis now handled at the top level

export default function YouTubeSearch() {
  const { data: session, status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  
  // Redux selectors
  const searchForm = useSelector((state: RootState) => selectSearchForm(state))
  const searchResults = useSelector((state: RootState) => selectSearchResults(state))
  const subtitleGeneration = useSelector((state: RootState) => selectSubtitleGeneration(state))
  const transcriptAnalysis = useSelector((state: RootState) => selectTranscriptAnalysis(state))
  const geminiAnalysis = useSelector((state: RootState) => selectGeminiAnalysis(state))
  const videoSummarization = useSelector((state: RootState) => selectVideoSummarization(state))
  const researchSummaries = useSelector((state: RootState) => selectResearchSummaries(state))
  const previewModal = useSelector((state: RootState) => selectPreviewModal(state))
  const error = useSelector((state: RootState) => selectError(state))
  
  // Local state for accordion visibility and input values
  const [expandedAnalysis, setExpandedAnalysis] = React.useState<Set<string>>(new Set())
  const [localQueries, setLocalQueries] = React.useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = React.useState<'youtube' | 'research' | 'current-research' | 'history'>('youtube')
  const [researchHistory, setResearchHistory] = React.useState<any[]>([])
  const [editingResearch, setEditingResearch] = React.useState<{id: string, field: string, value: string} | null>(null)
  const [analysisMode, setAnalysisMode] = React.useState<'openai' | 'gemini'>('openai')
  const [isAnalyzingBatch, setIsAnalyzingBatch] = React.useState(false)
  const [batchAnalysisProgress, setBatchAnalysisProgress] = React.useState({ completed: 0, total: 0 })
  
  // Custom YouTube link analysis state
  const [customYouTubeLink, setCustomYouTubeLink] = React.useState('')
  const [customLinkAnalysisType, setCustomLinkAnalysisType] = React.useState<'transcript' | 'gemini' | 'channel'>('gemini')
  const [analyzingCustomLink, setAnalyzingCustomLink] = React.useState(false)
  const [customTranscript, setCustomTranscript] = React.useState('')
  const [customAnalysisQuery, setCustomAnalysisQuery] = React.useState('Comprehensive analysis of this video content')
  
  // Channel analysis state
  const [channelAnalysisResult, setChannelAnalysisResult] = React.useState<ChannelAnalysisResult | null>(null)
  const [channelAnalysisPrompt, setChannelAnalysisPrompt] = React.useState('')
  const [analyzingChannel, setAnalyzingChannel] = React.useState(false)

  // Research History Management Functions
  const deleteFromHistory = (historyId: string) => {
    try {
      const history = researchHistory.filter(item => item.historyId !== historyId)
      setResearchHistory(history)
      localStorage.setItem('research-history', JSON.stringify(history))
      console.log('✅ Research deleted from history')
      alert('🗑️ Research item deleted from history!')
    } catch (error) {
      console.error('Failed to delete from history:', error)
    }
  }

  const clearHistory = () => {
    setResearchHistory([])
    localStorage.removeItem('research-history')
    console.log('✅ Research history cleared')
    alert('🧹 All research history cleared!')
  }

  const saveToHistory = (researchItem: any) => {
    try {
      const history = [...researchHistory]
      const historyItem = {
        ...researchItem,
        savedAt: new Date().toISOString(),
        historyId: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      history.unshift(historyItem) // Add to beginning
      
      // Keep only last 50 items
      if (history.length > 50) {
        history.splice(50)
      }
      
      setResearchHistory(history)
      localStorage.setItem('research-history', JSON.stringify(history))
      console.log('✅ Research saved to history')
      alert('📚 Research saved to history!')
    } catch (error) {
      console.error('Failed to save to history:', error)
    }
  }

  const updateHistoryItem = (historyId: string, updates: any) => {
    try {
      const history = researchHistory.map(item => 
        item.historyId === historyId 
          ? { ...item, ...updates, lastModified: new Date().toISOString() }
          : item
      )
      setResearchHistory(history)
      localStorage.setItem('research-history', JSON.stringify(history))
      console.log('✅ Research history updated')
      alert('📝 Research history updated!')
    } catch (error) {
      console.error('Failed to update history:', error)
    }
  }

  const restoreFromHistory = (historyItem: any) => {
    // Add the historical research back to current research
    const restoredItem = {
      ...historyItem,
      id: `restored-${Date.now()}`,
      timestamp: new Date().toISOString(),
      appliedToScript: false,
      isRestoredFromHistory: true // Flag to prevent auto-save
    }
    
    dispatch({
      type: 'youtube/addYouTubeResearchSummary',
      payload: restoredItem
    })
    
    console.log('✅ Research restored from history')
    alert('↩️ Research restored from history to Current Research!')
  }

  // Load history on component mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('research-history')
      if (stored) {
        const history = JSON.parse(stored)
        setResearchHistory(history)
      }
    } catch (error) {
      console.error('Failed to load research history:', error)
    }
  }, [])

  // Track which items have been saved to prevent re-saving deleted items
  const [savedItemIds, setSavedItemIds] = React.useState<Set<string>>(new Set())

  // Auto-save current research to history when research summaries change
  React.useEffect(() => {
    const currentResearch = [
      ...researchSummaries.youtubeResearchSummaries
    ]
    
    // Save new research to history automatically (but not restored items or already saved items)
    currentResearch.forEach(item => {
      if (!(item as any).isRestoredFromHistory && 
          !researchHistory.find(h => h.id === item.id) && 
          !savedItemIds.has(item.id)) {
        saveToHistory(item)
        setSavedItemIds(prev => new Set(prev).add(item.id))
      }
    })
  }, [researchSummaries.youtubeResearchSummaries, researchHistory])

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
      minDuration: searchForm.minDuration,
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

    // Limit to 10 videos maximum
    const videosToProcess = searchResults.selectedVideos.slice(0, 10)
    
    // Always use individual processing for real-time progress tracking
    dispatch(generateSubtitlesIndividually(videosToProcess))
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

  const handleAnalyzeVideoWithGemini = (video: Video) => {
    const videoId = video.id.videoId
    const query = localQueries[videoId]
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    
    if (!query || !query.trim()) {
      return
    }

    dispatch(analyzeVideoWithGemini({
      videoId: videoId,
      videoUrl: videoUrl,
      title: video.snippet.title,
      query: query.trim()
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

  const formatCount = (count: string | number | undefined) => {
    if (!count) return 'N/A'
    
    const num = typeof count === 'string' ? parseInt(count) : count
    
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B'
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    } else {
      return num.toLocaleString()
    }
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

  const getGeminiAnalysisResults = (videoId: string): GeminiAnalysisResult[] => {
    return geminiAnalysis.geminiAnalysisResults.filter(result => result.videoId === videoId)
  }

  const getStatusDisplay = (subtitleFile: SubtitleFile) => {
    const statusMessages = {
      pending: 'Pending',
      extracting: 'Extracting Subtitles',
      downloading: 'Downloading Audio',
      transcribing: 'Generating Subtitles',
      processing: 'Processing',
      completed: 'Completed',
      error: 'Error'
    }

    const statusColors = {
      pending: 'text-gray-600',
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
    } else if (method === 'supadata') {
      return (
        <div title="Direct transcript via Supadata">
          <FileText className="h-3 w-3 text-green-600" />
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

  // Helper function to extract video ID from YouTube URL
  const extractVideoIdFromUrl = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  // Channel analysis function
  const handleAnalyzeChannel = async () => {
    if (!customYouTubeLink.trim()) {
      alert('Please enter a YouTube channel URL')
      return
    }

    setAnalyzingChannel(true)
    setChannelAnalysisResult(null)

    try {
      console.log('🔍 Starting channel analysis for:', customYouTubeLink)
      
      const response = await fetch('/api/youtube/analyze-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelUrl: customYouTubeLink.trim(),
          userPrompt: channelAnalysisPrompt.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze channel')
      }

      if (data.success) {
        setChannelAnalysisResult(data.data)
        console.log('✅ Channel analysis completed:', data.data)
      } else {
        throw new Error('Invalid response format')
      }

    } catch (error) {
      console.error('💥 Channel analysis error:', error)
      alert(`Failed to analyze channel: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAnalyzingChannel(false)
    }
  }

  // Custom YouTube link analysis function
  const handleAnalyzeCustomLink = async () => {
    // Handle channel analysis separately
    if (customLinkAnalysisType === 'channel') {
      await handleAnalyzeChannel()
      return
    }

    // Validation based on analysis type
    if (customLinkAnalysisType === 'gemini') {
      if (!customYouTubeLink.trim()) {
        alert('Please enter a YouTube URL for Gemini analysis')
        return
      }
    } else if (customLinkAnalysisType === 'transcript') {
      if (!customTranscript.trim()) {
        alert('Please enter a transcript for analysis')
        return
      }
      if (!customAnalysisQuery.trim()) {
        alert('Please enter an analysis query')
        return
      }
    }

    const videoId = customYouTubeLink.trim() ? extractVideoIdFromUrl(customYouTubeLink.trim()) : `custom-${Date.now()}`
    
    // For Gemini analysis, videoId extraction is required
    if (customLinkAnalysisType === 'gemini' && (videoId === null || videoId.startsWith('custom-'))) {
      alert('Invalid YouTube URL. Please enter a valid YouTube video URL for Gemini analysis.')
      return
    }

    setAnalyzingCustomLink(true)

    try {
      if (customLinkAnalysisType === 'transcript') {
        // Transcript analysis using existing LLM functionality
        console.log('🎯 Starting transcript analysis for custom content')
        
        const result = await dispatch(analyzeTranscript({
          videoId: videoId || `custom-transcript-${Date.now()}`,
          srtContent: customTranscript,
          query: customAnalysisQuery,
          videoTitle: `Custom Transcript Analysis${customYouTubeLink ? ` (${customYouTubeLink})` : ''}`
        })).unwrap()

        // Create research summary for custom transcript analysis
        const customTranscriptResearchSummary = {
          id: `custom-transcript-analysis-${Date.now()}`,
          query: `Custom Transcript Analysis: ${customAnalysisQuery}`,
          videosSummary: {
            overallTheme: result.analysis.length > 0 ? result.analysis[0].summary : 'Transcript analysis completed',
            keyInsights: result.analysis.map((a: any) => a.summary || 'Analysis insight'),
            timestamps: result.analysis.filter((a: any) => a.timestamp).map((a: any) => ({
              time: a.timestamp,
              description: a.summary,
              significance: a.keyPoints?.[0] || 'Important moment'
            })),
            similarTitles: [], // Not applicable for transcript analysis
            videoSummaries: [{
              videoId: videoId || `custom-transcript-${Date.now()}`,
              title: `Custom Transcript Analysis${customYouTubeLink ? ` (${customYouTubeLink})` : ''}`,
              keyPoints: result.analysis.flatMap((a: any) => a.keyPoints || []),
              mainTopic: customAnalysisQuery,
              narrativeElements: result.analysis.flatMap((a: any) => a.narrativeElements || []),
              emotionalTone: result.analysis.find((a: any) => a.emotionalTone)?.emotionalTone || 'Neutral'
            }],
            commonPatterns: ['Custom transcript analysis performed using OpenAI'],
            actionableItems: result.analysis.flatMap((a: any) => a.actionableItems || []),
            narrativeThemes: result.analysis.flatMap((a: any) => a.themes || []),
            characterInsights: result.analysis.flatMap((a: any) => a.characterInsights || []),
            conflictElements: result.analysis.flatMap((a: any) => a.conflictElements || []),
            storyIdeas: result.analysis.flatMap((a: any) => a.storyIdeas || []),
            creativePrompt: result.analysis.find((a: any) => a.creativePrompt)?.creativePrompt || ''
          },
          timestamp: new Date().toISOString(),
          usingMock: result.usingMock || false,
          appliedToScript: false,
          analysisType: 'openai' as 'openai',
          customVideoUrl: customYouTubeLink || undefined,
          customTranscript: true // Flag to indicate this was a custom transcript analysis
        }

        dispatch(addYouTubeResearchSummary(customTranscriptResearchSummary))
        console.log(`✅ Created custom transcript research summary`)
        
        // Clear the inputs and switch to current research tab
        setCustomTranscript('')
        setCustomAnalysisQuery('Comprehensive analysis of this video content')
        setCustomYouTubeLink('')
        setActiveTab('current-research')
        
      } else {
        // Gemini analysis (existing functionality)
        console.log('🎯 Starting Gemini analysis for custom link:', customYouTubeLink)
        
        const result = await dispatch(analyzeVideoWithGemini({
          videoId: videoId!,
          videoUrl: customYouTubeLink,
          title: `Custom Video Analysis (${videoId})`,
          query: customAnalysisQuery
        })).unwrap()

        // Create research summary for custom Gemini analysis
        const customGeminiResearchSummary = {
          id: `custom-gemini-analysis-${videoId}-${Date.now()}`,
          query: `${result.parsedWithGPT ? 'Gemini AI + GPT-4o-mini' : 'Gemini AI'} Custom Analysis: ${customYouTubeLink}`,
          videosSummary: {
            overallTheme: result.analysis.summary,
            keyInsights: result.analysis.keyPoints,
            timestamps: result.analysis.timestamps,
            similarTitles: result.analysis.similarTitles || [], // Add similar titles
            videoSummaries: [{
              videoId: videoId!,
              title: `Custom Video Analysis (${videoId})`,
              keyPoints: result.analysis.keyPoints,
              mainTopic: result.analysis.topics[0] || 'Custom video analysis',
              narrativeElements: result.analysis.storyIdeas,
              emotionalTone: result.analysis.emotionalTone
            }],
            commonPatterns: [`Custom analysis performed using ${result.parsedWithGPT ? 'Gemini AI with GPT-4o-mini structured parsing' : 'Gemini AI'}`],
            actionableItems: result.analysis.actionableInsights || ['Review analysis insights for content creation'],
            narrativeThemes: result.analysis.topics.slice(0, 5),
            characterInsights: result.analysis.characterInsights,
            conflictElements: result.analysis.conflictElements,
            storyIdeas: result.analysis.storyIdeas,
            creativePrompt: result.analysis.creativePrompt
          },
          timestamp: new Date().toISOString(),
          usingMock: false,
          appliedToScript: false,
          analysisType: result.parsedWithGPT ? 'gemini+gpt' : 'gemini' as 'gemini' | 'gemini+gpt',
          customVideoUrl: customYouTubeLink // Add custom URL for reference
        }

        dispatch(addYouTubeResearchSummary(customGeminiResearchSummary))
        console.log(`✅ Created custom Gemini research summary for: ${customYouTubeLink}`)
        
        // Clear the inputs and switch to current research tab
        setCustomYouTubeLink('')
        setCustomAnalysisQuery('Comprehensive analysis of this video content')
        setActiveTab('current-research')
      }

    } catch (error) {
      console.error('Error analyzing custom content:', error)
      alert(`Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAnalyzingCustomLink(false)
    }
  }

  const getVideosWithSubtitlesCount = () => {
    return searchResults.selectedVideos.filter(videoId => {
      const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
      return subtitleFile && subtitleFile.status === 'completed'
    }).length
  }

  const handleAnalyzeSelectedVideos = async () => {
    setIsAnalyzingBatch(true)
    setBatchAnalysisProgress({ completed: 0, total: searchResults.selectedVideos.length })

    try {
      // If transcript analysis mode, first generate subtitles for videos that don't have them
      if (analysisMode === 'openai') {
        const videosNeedingSubtitles = searchResults.selectedVideos.filter(videoId => {
          const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
          return !subtitleFile || subtitleFile.status !== 'completed'
        })

        if (videosNeedingSubtitles.length > 0) {
          console.log(`Generating subtitles for ${videosNeedingSubtitles.length} videos before analysis...`)
          
          // Generate subtitles first (limit to 10 videos)
          const videosToProcess = videosNeedingSubtitles.slice(0, 10)
          await dispatch(generateSubtitlesIndividually(videosToProcess)).unwrap()
          
          // Wait a bit for subtitles to be processed
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Create all analysis promises at once for parallel execution
      const analysisPromises = searchResults.selectedVideos.map(async (videoId) => {
        const video = searchResults.videos.find(v => v.id.videoId === videoId)
        if (!video) return null

        try {
          if (analysisMode === 'openai') {
            // OpenAI transcript analysis
            const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
            if (subtitleFile && subtitleFile.status === 'completed') {
              const result = await dispatch(analyzeTranscript({
                videoId: videoId,
                srtContent: subtitleFile.srtContent,
                query: 'Comprehensive analysis of this video content',
                videoTitle: video.snippet.title
              })).unwrap()

              // Create individual research summary for OpenAI analysis
              const openaiResearchSummary = {
                id: `openai-analysis-${videoId}-${Date.now()}`,
                query: `OpenAI Analysis: ${video.snippet.title}`,
                videosSummary: {
                  overallTheme: result.analysis[0]?.summary || 'Video analysis completed',
                  keyInsights: result.analysis.map((a: any) => a.summary || 'Analysis insight'),
                  videoSummaries: [{
                    videoId: videoId,
                    title: video.snippet.title,
                    keyPoints: result.analysis.map((a: any) => a.summary || 'Key point'),
                    mainTopic: result.analysis[0]?.summary?.slice(0, 100) + '...' || 'Video analysis',
                    narrativeElements: result.analysis.flatMap((a: any) => a.dramaticElements || []),
                    emotionalTone: 'Analytical'
                  }],
                  commonPatterns: ['OpenAI transcript-based analysis'],
                  actionableItems: ['Review detailed analysis results for script development'],
                  narrativeThemes: result.analysis.flatMap((a: any) => a.dramaticElements || []).slice(0, 5),
                  characterInsights: [],
                  conflictElements: result.analysis.flatMap((a: any) => a.dramaticElements || []).slice(0, 5),
                  storyIdeas: [], // Empty for YouTube analysis
                  creativePrompt: '' // Empty for YouTube analysis
                },
                timestamp: new Date().toISOString(),
                usingMock: false,
                appliedToScript: false,
                analysisType: 'openai' as const
              }

              dispatch(addYouTubeResearchSummary(openaiResearchSummary))
              console.log(`✅ Created OpenAI research summary for: ${video.snippet.title}`)
            } else {
              console.warn(`Skipping ${video.snippet.title} - no completed subtitles available`)
            }
          } else {
            // Gemini analysis
            const result = await dispatch(analyzeVideoWithGemini({
              videoId: videoId,
              videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
              title: video.snippet.title,
              query: 'Comprehensive analysis of this video content'
            })).unwrap()

            // Create individual research summary for Gemini analysis
            const analysisType = result.parsedWithGPT ? 'gemini+gpt' : 'gemini'
            const geminiResearchSummary = {
              id: `gemini-analysis-${videoId}-${Date.now()}`,
              query: `${result.parsedWithGPT ? 'Gemini AI + GPT-4o-mini' : 'Gemini AI'} Analysis: ${video.snippet.title}`,
              videosSummary: {
                overallTheme: result.analysis.summary,
                keyInsights: result.analysis.keyPoints,
                timestamps: result.analysis.timestamps, // Add timestamps to the structure
                similarTitles: result.analysis.similarTitles || [], // Add similar titles
                videoSummaries: [{
                  videoId: videoId,
                  title: video.snippet.title,
                  keyPoints: result.analysis.keyPoints,
                  mainTopic: result.analysis.topics[0] || 'Video analysis',
                  narrativeElements: result.analysis.storyIdeas,
                  emotionalTone: result.analysis.emotionalTone
                }],
                commonPatterns: [`Analysis performed using ${result.parsedWithGPT ? 'Gemini AI with GPT-4o-mini structured parsing' : 'Gemini AI'}`],
                actionableItems: result.analysis.actionableInsights || ['Review analysis insights for content creation'],
                narrativeThemes: result.analysis.topics.slice(0, 5),
                characterInsights: result.analysis.characterInsights,
                conflictElements: result.analysis.conflictElements,
                storyIdeas: [], // Empty for YouTube analysis
                creativePrompt: '' // Empty for YouTube analysis
              },
              timestamp: new Date().toISOString(),
              usingMock: false,
              appliedToScript: false,
              analysisType: analysisType as 'gemini' | 'gemini+gpt'
            }

            dispatch(addYouTubeResearchSummary(geminiResearchSummary))
            console.log(`✅ Created ${result.parsedWithGPT ? 'Gemini+GPT' : 'Gemini'} research summary for: ${video.snippet.title}`)
          }
          return { success: true, videoId }
        } catch (error) {
          console.error(`Error analyzing video ${videoId}:`, error)
          return { success: false, videoId, error }
        }
      })

      // Execute all analysis requests in parallel and track progress
      let completedCount = 0
      const results = await Promise.allSettled(analysisPromises.map(async (promise) => {
        const result = await promise
        completedCount += 1
        setBatchAnalysisProgress(prev => ({ ...prev, completed: completedCount }))
        return result
      }))

      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value?.success)
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter(Boolean)

      // If transcript analysis mode, also generate overall video summary
      if (analysisMode === 'openai') {
        const videosWithSubtitles = searchResults.selectedVideos.filter(videoId => {
          const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
          return subtitleFile && subtitleFile.status === 'completed'
        })

        if (videosWithSubtitles.length > 0) {
          console.log(`🎯 Generating overall summary for ${videosWithSubtitles.length} videos with completed transcripts...`)
          try {
            await dispatch(summarizeVideos(videosWithSubtitles)).unwrap()
            console.log(`✅ Overall video summary completed for ${videosWithSubtitles.length} videos`)
          } catch (error) {
            console.error('Error generating overall video summary:', error)
          }
        }
      }

      console.log(`✅ Batch analysis complete! ${successfulResults.length}/${searchResults.selectedVideos.length} videos successfully analyzed and added to Current Research`)

    } catch (error) {
      console.error('Error analyzing selected videos:', error)
    } finally {
      setIsAnalyzingBatch(false)
    }
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
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Research History
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  <div>
                    <label htmlFor="minDuration" className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Duration:
                    </label>
                    <select
                      id="minDuration"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      value={searchForm.minDuration}
                      onChange={(e) => dispatch(setMinDuration(parseInt(e.target.value)))}
                    >
                      <option value={0}>No minimum (include all videos)</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={120}>2 minutes</option>
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                      <option value={1200}>20 minutes</option>
                      <option value={1800}>30 minutes</option>
                      <option value={3600}>1 hour</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Filter out videos shorter than the selected duration
                    </p>
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

            {/* Custom YouTube Link Analysis */}
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">
                🔗 Analyze Custom YouTube Link
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="customYouTubeLink" className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube {customLinkAnalysisType === 'channel' ? 'Channel' : 'Video'} URL {customLinkAnalysisType === 'gemini' || customLinkAnalysisType === 'channel' ? '(Required)' : '(Optional)'}:
                  </label>
                  <input
                    type="text"
                    id="customYouTubeLink"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={customLinkAnalysisType === 'channel' 
                      ? "https://www.youtube.com/@channelname or https://www.youtube.com/channel/UC..."
                      : "https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
                    }
                    value={customYouTubeLink}
                    onChange={(e) => setCustomYouTubeLink(e.target.value)}
                    disabled={analyzingCustomLink || analyzingChannel}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {customLinkAnalysisType === 'gemini' 
                      ? 'Enter a YouTube video URL for Gemini to analyze directly from the video'
                      : customLinkAnalysisType === 'channel'
                      ? 'Enter a YouTube channel URL to analyze all videos and suggest top-performing title patterns'
                      : 'Optional: Enter a YouTube URL for reference (you will provide the transcript below)'
                    }
                  </p>
                </div>

                {/* Transcript Analysis Fields */}
                {customLinkAnalysisType === 'transcript' && (
                  <>
                    <div>
                      <label htmlFor="customTranscript" className="block text-sm font-medium text-gray-700 mb-2">
                        Video Transcript (Required):
                      </label>
                      <textarea
                        id="customTranscript"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Paste the video transcript here... You can include timestamps like [00:30] or use SRT format."
                        value={customTranscript}
                        onChange={(e) => setCustomTranscript(e.target.value)}
                        disabled={analyzingCustomLink}
                        rows={8}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Paste the complete transcript of the video. Supports plain text or SRT format with timestamps.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="customAnalysisQuery" className="block text-sm font-medium text-gray-700 mb-2">
                        Analysis Query (Required):
                      </label>
                      <input
                        type="text"
                        id="customAnalysisQuery"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="What should the AI analyze? e.g., 'Key insights about marketing strategies'"
                        value={customAnalysisQuery}
                        onChange={(e) => setCustomAnalysisQuery(e.target.value)}
                        disabled={analyzingCustomLink}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Specify what you want the AI to focus on when analyzing the transcript.
                      </p>
                    </div>
                  </>
                )}

                {/* Analysis Query for Gemini */}
                {customLinkAnalysisType === 'gemini' && (
                  <div>
                    <label htmlFor="customAnalysisQuery" className="block text-sm font-medium text-gray-700 mb-2">
                      Analysis Focus (Optional):
                    </label>
                    <input
                      type="text"
                      id="customAnalysisQuery"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 'Focus on marketing strategies and audience engagement'"
                      value={customAnalysisQuery}
                      onChange={(e) => setCustomAnalysisQuery(e.target.value)}
                      disabled={analyzingCustomLink}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Specify what aspects you want Gemini to focus on during analysis.
                    </p>
                  </div>
                )}

                {/* Channel Analysis Prompt */}
                {customLinkAnalysisType === 'channel' && (
                  <div>
                    <label htmlFor="channelAnalysisPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Prompt for Title Suggestions (Optional):
                    </label>
                    <textarea
                      id="channelAnalysisPrompt"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 'Generate clickbait titles for tech reviews' or 'Focus on educational content for beginners'"
                      value={channelAnalysisPrompt}
                      onChange={(e) => setChannelAnalysisPrompt(e.target.value)}
                      disabled={analyzingChannel}
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Provide specific guidance for the AI when generating new title suggestions based on the top-performing videos.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Analysis Type:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="customAnalysisType"
                          value="gemini"
                          checked={customLinkAnalysisType === 'gemini'}
                          onChange={(e) => setCustomLinkAnalysisType(e.target.value as 'gemini' | 'transcript' | 'channel')}
                          disabled={analyzingCustomLink || analyzingChannel}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600">Gemini AI Analysis</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="customAnalysisType"
                          value="transcript"
                          checked={customLinkAnalysisType === 'transcript'}
                          onChange={(e) => setCustomLinkAnalysisType(e.target.value as 'gemini' | 'transcript' | 'channel')}
                          disabled={analyzingCustomLink || analyzingChannel}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600">Transcript Analysis</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="customAnalysisType"
                          value="channel"
                          checked={customLinkAnalysisType === 'channel'}
                          onChange={(e) => setCustomLinkAnalysisType(e.target.value as 'gemini' | 'transcript' | 'channel')}
                          disabled={analyzingCustomLink || analyzingChannel}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600">Channel Analysis</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyzeCustomLink}
                    disabled={
                      analyzingCustomLink || analyzingChannel ||
                      (customLinkAnalysisType === 'gemini' && !customYouTubeLink.trim()) ||
                      (customLinkAnalysisType === 'transcript' && (!customTranscript.trim() || !customAnalysisQuery.trim())) ||
                      (customLinkAnalysisType === 'channel' && !customYouTubeLink.trim())
                    }
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors ml-auto"
                  >
                    {(analyzingCustomLink || analyzingChannel) ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {customLinkAnalysisType === 'channel' ? 'Analyzing Channel...' : 'Analyzing...'}
                      </span>
                    ) : (
                      customLinkAnalysisType === 'channel' ? 'Analyze Channel' : 'Analyze Video'
                    )}
                  </button>
                </div>
                
                {customLinkAnalysisType === 'transcript' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Transcript Analysis:</strong> Provide your own transcript for detailed AI analysis using OpenAI models. 
                      Perfect when you already have the transcript or want to analyze specific content sections.
                    </p>
                  </div>
                )}
                
                {customLinkAnalysisType === 'gemini' && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-800">
                      <strong>Gemini AI Analysis:</strong> Get comprehensive video analysis directly from YouTube URL including 
                      timestamps, similar title suggestions, and content insights using Google's Gemini AI.
                    </p>
                  </div>
                )}

                {customLinkAnalysisType === 'channel' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                    <p className="text-sm text-purple-800">
                      <strong>Channel Analysis:</strong> Analyze all videos from a YouTube channel, sort them by view count, 
                      and get AI-generated title suggestions based on the top 10 performing videos. Perfect for understanding 
                      what content resonates with the audience.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Channel Analysis Results */}
            {channelAnalysisResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">📊 Channel Analysis Results</h3>
                  <button
                    onClick={() => setChannelAnalysisResult(null)}
                    className="text-gray-400 hover:text-gray-600 ml-auto"
                    title="Close results"
                  >
                    ×
                  </button>
                </div>

                {/* Channel Info */}
                {channelAnalysisResult.channelInfo && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-4">
                      {channelAnalysisResult.channelInfo.snippet.thumbnails?.default && (
                        <img 
                          src={channelAnalysisResult.channelInfo.snippet.thumbnails.default.url}
                          alt={channelAnalysisResult.channelInfo.snippet.title}
                          className="w-16 h-16 rounded-full border-2 border-white shadow-sm"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-gray-800">
                          {channelAnalysisResult.channelInfo.snippet.title}
                        </h4>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-purple-600">
                              {parseInt(channelAnalysisResult.channelInfo.statistics.subscriberCount).toLocaleString()}
                            </div>
                            <div className="text-gray-600">Subscribers</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">
                              {parseInt(channelAnalysisResult.channelInfo.statistics.videoCount).toLocaleString()}
                            </div>
                            <div className="text-gray-600">Videos</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-green-600">
                              {parseInt(channelAnalysisResult.channelInfo.statistics.viewCount).toLocaleString()}
                            </div>
                            <div className="text-gray-600">Total Views</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Performing Videos */}
                  <div>
                    <h4 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                      🏆 Top 10 Performing Videos
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {channelAnalysisResult.top10Videos.map((video, index) => (
                        <div key={video.id} className="bg-gray-50 rounded-lg p-3 border">
                          <div className="flex items-start gap-3">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h5 className="font-medium text-sm text-gray-800 line-clamp-2 mb-1">
                                {video.title}
                              </h5>
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  👁️ {parseInt(video.viewCount).toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  👍 {parseInt(video.likeCount || '0').toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  📅 {new Date(video.publishedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI-Generated Title Suggestions */}
                  <div>
                    <h4 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                      🤖 AI Title Suggestions
                    </h4>
                    
                    {/* Analysis Summary */}
                    {channelAnalysisResult.analysis && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <h5 className="font-medium text-blue-800 mb-2">Pattern Analysis</h5>
                        <p className="text-sm text-blue-700">{channelAnalysisResult.analysis}</p>
                      </div>
                    )}

                    {/* Title Suggestions */}
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {channelAnalysisResult.titleSuggestions.map((suggestion, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <p className="text-sm text-gray-800 flex-1">{suggestion}</p>
                          </div>
                        </div>
                      ))}
                      {channelAnalysisResult.titleSuggestions.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          No title suggestions generated
                        </div>
                      )}
                    </div>

                    {/* User Prompt Display */}
                    {channelAnalysisResult.userPrompt && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <h5 className="font-medium text-yellow-800 mb-1">Custom Prompt Used:</h5>
                        <p className="text-sm text-yellow-700">{channelAnalysisResult.userPrompt}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Analysis Stats */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-800">{channelAnalysisResult.totalVideos}</div>
                      <div className="text-gray-600">Total Videos Found</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{channelAnalysisResult.analyzedVideos}</div>
                      <div className="text-gray-600">Videos Analyzed</div>
                    </div>
                    <div className="md:col-span-1 col-span-2">
                      <div className="font-semibold text-gray-800">{channelAnalysisResult.titleSuggestions.length}</div>
                      <div className="text-gray-600">Title Suggestions</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                  {searchResults.searchInfo.filteredShortVideos !== undefined && searchResults.searchInfo.filteredShortVideos > 0 && (
                    <div className="text-sm text-green-600 mt-1">
                      ⚡ Filtered out {searchResults.searchInfo.filteredShortVideos} short videos 
                      {searchResults.searchInfo.minDuration && searchResults.searchInfo.minDuration > 0 ? (
                        ` (less than ${
                          searchResults.searchInfo.minDuration >= 3600 
                            ? `${Math.floor(searchResults.searchInfo.minDuration / 3600)}h ${Math.floor((searchResults.searchInfo.minDuration % 3600) / 60)}m`
                            : searchResults.searchInfo.minDuration >= 60 
                              ? `${Math.floor(searchResults.searchInfo.minDuration / 60)}m ${searchResults.searchInfo.minDuration % 60}s`.replace(' 0s', '')
                              : `${searchResults.searchInfo.minDuration}s`
                        })`
                      ) : ' (less than 1 minute)'}
                    </div>
                  )}
                </div>

                {/* Selection Controls */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4">
                  <div className="flex justify-between items-center mb-3">
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
                  </div>
                  
                  {/* Enhanced Analysis Mode Selection */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-blue-800 mb-3">Choose Analysis Approach for Selected Videos</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setAnalysisMode('openai')}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          analysisMode === 'openai'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <Search className="h-6 w-6" />
                          <div className="text-center">
                            <div className="font-medium">Transcript Analysis</div>
                            <div className="text-xs opacity-75 mt-1">OpenAI analyzes generated subtitles</div>
                            <div className="text-xs mt-1 text-amber-600">
                              ⚠ Requires subtitle generation first
                            </div>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => setAnalysisMode('gemini')}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          analysisMode === 'gemini'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <Spark className="h-6 w-6" />
                          <div className="text-center">
                            <div className="font-medium">Video Analysis</div>
                            <div className="text-xs opacity-75 mt-1">Gemini AI analyzes videos directly</div>
                            <div className="text-xs mt-1 text-green-600">
                              ✓ No subtitles required
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleAnalyzeSelectedVideos}
                        disabled={searchResults.selectedVideos.length === 0 || isAnalyzingBatch}
                        className={`flex-1 sm:flex-none font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                          analysisMode === 'openai'
                            ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                        }`}
                      >
                        {isAnalyzingBatch ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            {analysisMode === 'openai' ? 'Analyzing Transcripts...' : 'Analyzing Videos...'}
                            <span className="ml-1">({batchAnalysisProgress.completed}/{batchAnalysisProgress.total})</span>
                          </>
                        ) : (
                          <>
                            {analysisMode === 'gemini' ? <Spark className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                            {analysisMode === 'openai' ? 'Analyze Transcripts' : 'Analyze Videos'} ({searchResults.selectedVideos.length})
                          </>
                        )}
                      </button>
                      
                      {/* Other bulk actions */}
                      <button
                        onClick={handleGenerateSubtitles}
                        disabled={searchResults.selectedVideos.length === 0 || subtitleGeneration.generatingSubtitles}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-md transition-colors flex items-center gap-2"
                      >
                        {subtitleGeneration.generatingSubtitles ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Generate Subtitles ({searchResults.selectedVideos.length})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress information for batch analysis */}
                  {isAnalyzingBatch && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">
                          {analysisMode === 'openai' ? 'Analyzing Transcripts' : 'Analyzing Videos'} with AI
                        </span>
                        </div>
                      <div className="text-xs text-purple-600">
                        Progress: {batchAnalysisProgress.completed} of {batchAnalysisProgress.total} videos completed
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${batchAnalysisProgress.total > 0 ? (batchAnalysisProgress.completed / batchAnalysisProgress.total) * 100 : 0}%` 
                          }}
                        ></div>
                        </div>
                      </div>
                    )}

                  {searchResults.selectedVideos.length === 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      Please select at least one video to perform analysis.
                    </p>
                  )}
                </div>
                
                {/* Overall Progress Bar */}
                {subtitleGeneration.generatingSubtitles && subtitleGeneration.totalVideosProcessing > 0 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-green-800">
                        Processing Videos ({subtitleGeneration.completedVideosCount}/{subtitleGeneration.totalVideosProcessing})
                      </span>
                      <span className="text-sm text-green-600">
                        {Math.round((subtitleGeneration.completedVideosCount / subtitleGeneration.totalVideosProcessing) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-3">
                      <div 
                        className="bg-green-600 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(subtitleGeneration.completedVideosCount / subtitleGeneration.totalVideosProcessing) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      Videos are being processed in parallel. Each completed video will update this progress bar.
                    </p>
                  </div>
                )}

                {/* Analysis Progress Bar */}
                {isAnalyzingBatch && batchAnalysisProgress.total > 0 && (
                  <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-indigo-800">
                        Analyzing Videos ({batchAnalysisProgress.completed}/{batchAnalysisProgress.total})
                      </span>
                      <span className="text-sm text-indigo-600">
                        {Math.round((batchAnalysisProgress.completed / batchAnalysisProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-3">
                      <div 
                        className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(batchAnalysisProgress.completed / batchAnalysisProgress.total) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-indigo-700 mt-1">
                      {analysisMode === 'openai' 
                        ? 'Analyzing transcripts with OpenAI for detailed insights and timestamps.'
                        : 'Analyzing videos directly with Gemini AI for comprehensive insights.'
                      }
                    </p>
                  </div>
                )}
                
                {searchResults.selectedVideos.length === 0 && (
                  <p className="text-sm text-blue-600 mt-2">
                    Please select at least one video to generate subtitles, create summaries, or perform analysis.
                  </p>
                )}
                
                {searchResults.selectedVideos.length > 10 && (
                  <p className="text-sm text-orange-600 mt-2">
                    ⚠️ You have selected {searchResults.selectedVideos.length} videos. Only the first 10 videos will be processed for subtitle generation due to processing limitations.
                  </p>
                )}
                
                {analysisMode === 'openai' && searchResults.selectedVideos.length > 0 && getVideosWithSubtitlesCount() === 0 && (
                  <p className="text-sm text-purple-600 mt-2">
                    Generate subtitles first to enable OpenAI transcript analysis.
                  </p>
                )}
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
                          {video.statistics && (
                            <div className="flex gap-4 mt-1">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {formatCount(video.statistics.viewCount)} views
                              </span>
                              {video.statistics.likeCount && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                  </svg>
                                  {formatCount(video.statistics.likeCount)}
                                </span>
                              )}
                              {video.statistics.commentCount && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  {formatCount(video.statistics.commentCount)}
                                </span>
                              )}
                            </div>
                          )}
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
                        
                        {/* Show error if transcript extraction failed */}
                        {subtitleFile && subtitleFile.status === 'error' && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-red-800">Transcript extraction failed</p>
                                <p className="text-xs text-red-600 mt-1">{subtitleFile.progress}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Show processing status if in progress */}
                        {subtitleFile && ['pending', 'downloading', 'transcribing', 'processing'].includes(subtitleFile.status) && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-blue-800">{getStatusDisplay(subtitleFile).message}</p>
                                {subtitleFile.progress && (
                                  <p className="text-xs text-blue-600 mt-1">{subtitleFile.progress}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Show success status if completed */}
                        {subtitleFile && subtitleFile.status === 'completed' && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-green-800">Transcript ready</p>
                                <p className="text-xs text-green-600 mt-1">
                                  {formatFileSize(subtitleFile.size)} • via {subtitleFile.method === 'supadata' ? 'Supadata' : subtitleFile.method}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Individual analysis removed - now handled at the top level */}
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
                                    via {subtitleFile.method === 'yt-dlp' ? 'yt-dlp' : subtitleFile.method === 'whisper' ? 'Whisper AI' : 'Supadata'}
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
                          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-red-800 mb-1">
                                  Transcript Extraction Failed
                                </h4>
                                <p className="text-sm text-red-700">
                                  {subtitleFile.progress}
                                </p>
                                <div className="mt-2 text-xs text-red-600">
                                  <p><strong>Possible reasons:</strong></p>
                                  <ul className="list-disc list-inside mt-1 space-y-1">
                                    <li>Video has no available transcript/captions</li>
                                    <li>Video is private or restricted</li>
                                    <li>Transcript is in a language not supported</li>
                                    <li>Video is too new (transcripts may not be ready)</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        

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
                            
                            {video.keyQuotes && video.keyQuotes.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700">Key Quotes:</h5>
                                <div className="space-y-1">
                                  {video.keyQuotes.map((quote, quoteIndex) => (
                                    <div key={quoteIndex} className="text-sm text-gray-700 bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
                                      <span className="text-yellow-700 font-medium">"</span>
                                      {quote}
                                      <span className="text-yellow-700 font-medium">"</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {video.dramaticElements && video.dramaticElements.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700">Dramatic Elements:</h5>
                                <div className="flex flex-wrap gap-1">
                                  {video.dramaticElements.map((element, elemIndex) => (
                                    <span key={elemIndex} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                      {element}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {video.contextualInfo && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700">Context & Significance:</h5>
                                <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                                  {video.contextualInfo}
                                </p>
                              </div>
                            )}
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
            onSaveToHistory={saveToHistory}
          />
        )}

        {activeTab === 'history' && (
          <ResearchHistoryTab 
            researchHistory={researchHistory}
            editingResearch={editingResearch}
            onStartEditing={(id: string, field: string, value: string) => setEditingResearch({ id, field, value })}
            onSaveEdit={() => {
              if (editingResearch) {
                let updatedValue: any = editingResearch.value
                
                // Handle special fields that need JSON parsing
                if (editingResearch.field === 'keyFindings') {
                  try {
                    // If it's already a JSON string, parse it
                    if (editingResearch.value.startsWith('[')) {
                      updatedValue = JSON.parse(editingResearch.value)
                    } else {
                      // If it's plain text, split by lines
                      updatedValue = editingResearch.value.split('\n').filter(line => line.trim()).map(line => line.trim())
                    }
                  } catch (e) {
                    // Fallback to splitting by lines
                    updatedValue = editingResearch.value.split('\n').filter(line => line.trim()).map(line => line.trim())
                  }
                } else if (editingResearch.field === 'scrapedArticles') {
                  try {
                    updatedValue = JSON.parse(editingResearch.value)
                  } catch (e) {
                    alert('Invalid JSON format for scraped articles')
                    return
                  }
                }
                
                updateHistoryItem(editingResearch.id, {
                  [editingResearch.field]: updatedValue
                })
                setEditingResearch(null)
              }
            }}
            onCancelEdit={() => setEditingResearch(null)}
            onUpdateEdit={(value) => setEditingResearch(editingResearch ? {...editingResearch, value} : null)}
            onDeleteFromHistory={deleteFromHistory}
            onClearHistory={clearHistory}
            onRestoreFromHistory={restoreFromHistory}
          />
        )}
      </div>
    </div>
  )
} 
