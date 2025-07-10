'use client'

import React from 'react'
import { Loader2, Globe, FileSearch, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { performGoogleResearch, removeGoogleResearchSummary, clearAllResearchSummaries, addGoogleResearchSummary } from '@/lib/features/youtube/youtubeSlice'
import { AppDispatch } from '@/lib/store'

interface ResearchTabProps {
  researchSummaries: any
  dispatch: AppDispatch
}

export const ResearchTab: React.FC<ResearchTabProps> = ({ 
  researchSummaries,
  dispatch
}) => {
  const [researchQuery, setResearchQuery] = React.useState('')
  const [researchContext, setResearchContext] = React.useState('')
  const [isResearching, setIsResearching] = React.useState(false)
  const [isSummarizing, setIsSummarizing] = React.useState(false)
  const [expandedResults, setExpandedResults] = React.useState<Set<string>>(new Set())
  const [pendingWebResults, setPendingWebResults] = React.useState<any[]>([])
  const [selectedArticles, setSelectedArticles] = React.useState<Set<number>>(new Set())
  const [lastSearchQuery, setLastSearchQuery] = React.useState('')
  const [lastSearchContext, setLastSearchContext] = React.useState('')

  const handleResearch = async () => {
    if (!researchQuery.trim()) return

    setIsResearching(true)
    try {
      // Only perform web search, don't summarize yet
      const webResponse = await fetch('/api/research/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: researchQuery,
          context: researchContext,
          maxResults: 30 
        })
      })
      
      const webData = await webResponse.json()
      if (!webData.success) {
        throw new Error(webData.error || 'Failed to search web')
      }

      // Store results for user selection
      setPendingWebResults(webData.results || [])
      setSelectedArticles(new Set(webData.results?.map((_: any, index: number) => index) || []))
      setLastSearchQuery(researchQuery)
      setLastSearchContext(researchContext)
      
      console.log(`🔍 Found ${webData.results?.length || 0} articles for "${researchQuery}"`)
      
    } catch (error) {
      console.error('Research error:', error)
    } finally {
      setIsResearching(false)
    }
  }

  const handleSummarizeSelected = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to summarize.')
      return
    }

    setIsSummarizing(true)
    try {
      const selectedWebResults = Array.from(selectedArticles).map(index => pendingWebResults[index])
      
      // Generate summary from selected articles
      const summaryResponse = await fetch('/api/research/generate-google-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: lastSearchQuery,
          context: lastSearchContext,
          webResults: selectedWebResults
        })
      })

      const summaryData = await summaryResponse.json()
      if (!summaryData.success) {
        throw new Error(summaryData.error || 'Failed to generate research summary')
      }

      const researchSummary = {
        id: `google-${Date.now()}`,
        query: lastSearchQuery,
        context: lastSearchContext,
        webResults: selectedWebResults,
        insights: summaryData.insights,
        keyFindings: summaryData.keyFindings,
        recommendations: summaryData.recommendations,
        sources: summaryData.sources || [],
        timestamp: new Date().toISOString(),
        usingMock: summaryData.usingMock,
        appliedToScript: false
      }

      dispatch(addGoogleResearchSummary(researchSummary))
      
      // Clear pending results and form
      setPendingWebResults([])
      setSelectedArticles(new Set())
      setResearchQuery('')
      setResearchContext('')
      setLastSearchQuery('')
      setLastSearchContext('')
      
      console.log(`✅ Created research summary from ${selectedWebResults.length} selected articles`)
      
    } catch (error) {
      console.error('Summarization error:', error)
    } finally {
      setIsSummarizing(false)
    }
  }

  const toggleArticleSelection = (index: number) => {
    const newSelected = new Set(selectedArticles)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedArticles(newSelected)
  }

  const selectAllArticles = () => {
    setSelectedArticles(new Set(pendingWebResults.map((_: any, index: number) => index)))
  }

  const deselectAllArticles = () => {
    setSelectedArticles(new Set())
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
                Searching...
              </>
            ) : (
              <>
                <FileSearch className="h-5 w-5" />
                Search Articles
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pending Web Results for Selection */}
      {pendingWebResults.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-yellow-900 flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Found Articles ({pendingWebResults.length}) - Select to Summarize
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllArticles}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Select All
              </button>
              <button
                onClick={deselectAllArticles}
                className="text-red-600 hover:text-red-800 font-medium text-sm"
              >
                Deselect All
              </button>
              <span className="text-sm text-gray-600">
                {selectedArticles.size} of {pendingWebResults.length} selected
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
            {pendingWebResults.map((article: any, index: number) => {
              const isSelected = selectedArticles.has(index)
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                    isSelected 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => toggleArticleSelection(index)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleArticleSelection(index)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-600 hover:text-blue-800 mb-1">
                        <a 
                          href={article.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {article.title}
                        </a>
                      </h4>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {article.description}
                      </p>
                      <div className="text-xs text-gray-500">
                        {article.source && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded mr-2">
                            {article.source}
                          </span>
                        )}
                        <span>{new URL(article.link).hostname}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-yellow-700">
              💡 Review and deselect any articles that seem unrelated or low-quality before summarizing.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPendingWebResults([])
                  setSelectedArticles(new Set())
                  setLastSearchQuery('')
                  setLastSearchContext('')
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSummarizeSelected}
                disabled={selectedArticles.size === 0 || isSummarizing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Summarizing {selectedArticles.size} articles...
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5" />
                    Summarize Selected ({selectedArticles.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Research Results */}
      {googleResearchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Globe className="h-5 w-5" />
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