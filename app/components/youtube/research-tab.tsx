'use client'

import React from 'react'
import { Loader2, Globe, FileSearch, ChevronDown, ChevronRight, Brain, Save } from 'lucide-react'
import { performGoogleResearch, removeGoogleResearchSummary, clearAllResearchSummaries, addGoogleResearchSummary, setIsResearching, setIsSummarizing, setPendingWebResults, setSelectedArticles, setLastSearchQuery, setLastSearchContext, addSavingToHistory, removeSavingToHistory, clearResearchState, selectResearchLoadingStates, setAvailableLinks } from '@/lib/features/youtube/youtubeSlice'
import { AppDispatch, RootState } from '@/lib/store'
import { useSelector } from 'react-redux'
import { showToast } from '@/lib/utils/toast'
import ReactMarkdown from 'react-markdown'

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
  const [expandedResults, setExpandedResults] = React.useState<Set<string>>(new Set())
  const [directUrl, setDirectUrl] = React.useState('')
  const [scrapingDirectUrl, setScrapingDirectUrl] = React.useState(false)
  const [extractionPrompt, setExtractionPrompt] = React.useState('')
  const [selectedRegion, setSelectedRegion] = React.useState('us')
  const [selectedLanguage, setSelectedLanguage] = React.useState('en')
  const [filteringStats, setFilteringStats] = React.useState<any>(null)
  
  // Get research loading states from Redux
  const {
    isResearching,
    isSummarizing,
    savingToHistory,
    pendingWebResults,
    selectedArticles,
    lastSearchQuery,
    lastSearchContext
  } = useSelector((state: RootState) => selectResearchLoadingStates(state))

  // Update local form state when Redux state has values (on component mount/remount)
  React.useEffect(() => {
    if (lastSearchQuery && !researchQuery) {
      setResearchQuery(lastSearchQuery)
    }
    if (lastSearchContext && !researchContext) {
      setResearchContext(lastSearchContext)
    }
  }, [lastSearchQuery, lastSearchContext, researchQuery, researchContext])

  // Helper function to determine research source
  const getResearchSource = (research: any) => {
    if (research.research_method === 'firecrawl_scraping') return 'firecrawl_api'
    if (research.videosSummary || research.type === 'youtube' || research.content?.videosSummary) return 'gemini_analysis'
    return 'perplexity_api'
  }

  // Save research to history function
  const saveToResearchHistory = async (research: any) => {
    const researchId = research.id
    dispatch(addSavingToHistory(researchId))
    
    try {
      const requestData = {
        title: research.query,
        query: research.query,
        type: 'google',
        content: {
          researchSummary: research.researchSummary,
          insights: research.insights,
          keyFindings: research.keyFindings,
          recommendations: research.recommendations,
          webResults: research.webResults || [],
          sources: research.sources || []
        },
        tags: [],
        category: research.category === 'Article Content' ? 'Article Content' : 'Perplexity Research',
        source: getResearchSource(research)
      }

      const response = await fetch('/api/research-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save research to history')
      }

      showToast.success(`Research "${research.query}" saved to history successfully!`)
      
    } catch (error) {
      console.error('Error saving research to history:', error)
      showToast.error(`Failed to save to history: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      dispatch(removeSavingToHistory(researchId))
    }
  }

  const handleResearch = async () => {
    if (!researchQuery.trim()) return

    dispatch(setIsResearching(true))
    dispatch(setLastSearchQuery(researchQuery))
    dispatch(setLastSearchContext(researchContext))
    setFilteringStats(null) // Clear previous filtering stats
    
    try {
      // Only perform web search, don't summarize yet
      const webResponse = await fetch('/api/research/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: researchQuery,
          context: researchContext,
          maxResults: 30,
          region: selectedRegion,
          language: selectedLanguage
        })
      })
      
      const webData = await webResponse.json()
      if (!webData.success) {
        throw new Error(webData.error || 'Failed to search web')
      }

      // Store search results for selection
      dispatch(setPendingWebResults(webData.search_results || []))
      dispatch(setSelectedArticles([]))
      
      // Set available links for scraping if provided by the API
      if (webData.availableLinks && webData.availableLinks.length > 0) {
        dispatch(setAvailableLinks(webData.availableLinks))
        console.log(`🔗 Found ${webData.availableLinks.length} links available for scraping`)
      }
      
      // Store filtering statistics for display
      if (webData.filteringStats) {
        setFilteringStats(webData.filteringStats)
        console.log(`🔍 Filtering stats: ${webData.filteringStats.totalFound} total, ${webData.filteringStats.filteredOut} filtered (social media)`)
      }
      
      console.log(`🔍 Found ${webData.search_results?.length || 0} search results from Perplexity for "${researchQuery}"`)
      
    } catch (error) {
      console.error('Research error:', error)
      showToast.error(`Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      dispatch(setIsResearching(false))
    }
  }

  const handleScrapeSelected = async () => {
    if (selectedArticles.length === 0) {
      showToast.error('Please select at least one link to scrape.')
      return
    }

    dispatch(setIsSummarizing(true))
    try {
      const selectedResults = selectedArticles.map(index => pendingWebResults[index])
      console.log('Selected results for scraping:', selectedResults)

      // Process each selected link individually
      const scrapePromises = selectedResults.map(async (result) => {
        try {
          const response = await fetch('/api/research/scrape-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
              url: result.url, 
              title: result.title 
        })
      })

          const data = await response.json()
          if (!data.success) {
            throw new Error(data.error || 'Failed to scrape link')
          }

          return { success: true, url: result.url, research: data.research }
        } catch (error) {
          console.error(`Failed to scrape ${result.url}:`, error)
          return { success: false, url: result.url, error }
        }
      })

      const results = await Promise.all(scrapePromises)
      
      const successfulResults = results.filter(r => r.success)
      const failedResults = results.filter(r => !r.success)

      // Add successful research results to current research
      successfulResults.forEach(result => {
        if (result.research) {
          dispatch(addGoogleResearchSummary(result.research))
        }
      })

      // Only clear selections, keep the search results for more scraping
      dispatch(setSelectedArticles([]))

      // Show results
      if (successfulResults.length > 0 && failedResults.length === 0) {
        showToast.success(`Successfully scraped all ${successfulResults.length} links! You can select more to scrape.`)
      } else if (successfulResults.length > 0 && failedResults.length > 0) {
        showToast.warning(`Scraped ${successfulResults.length} links successfully, but ${failedResults.length} failed. You can select more to scrape.`)
      } else {
        showToast.error(`Failed to scrape all ${failedResults.length} links`)
      }
      
      console.log(`✅ Scraping completed: ${successfulResults.length} successful, ${failedResults.length} failed`)
      
    } catch (error) {
      console.error('Scraping error:', error)
      showToast.error(`Failed to scrape links: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      dispatch(setIsSummarizing(false))
    }
  }

  const toggleArticleSelection = (index: number) => {
    const newSelected = selectedArticles.includes(index)
      ? selectedArticles.filter(i => i !== index)
      : [...selectedArticles, index]
    dispatch(setSelectedArticles(newSelected))
  }

  // Handle direct URL scraping
  const handleDirectUrlScraping = async () => {
    if (!directUrl.trim()) {
      showToast.error('Please enter a valid URL')
      return
    }

    // Validate URL format
    try {
      new URL(directUrl.trim())
    } catch (error) {
      showToast.error('Please enter a valid URL format (e.g., https://example.com)')
      return
    }

    setScrapingDirectUrl(true)
    try {
      const response = await fetch('/api/research/scrape-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: directUrl.trim(), 
          title: new URL(directUrl.trim()).hostname,
          extractionPrompt: extractionPrompt.trim() || undefined
        })
      })
      
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape URL')
    }

      // Add successful research result to current research
      dispatch(addGoogleResearchSummary(data.research))
      
      showToast.success(`Successfully scraped and analyzed: ${new URL(directUrl.trim()).hostname}`)
      setDirectUrl('') // Clear the input after successful scraping
      
    } catch (error) {
      console.error('Direct URL scraping error:', error)
      showToast.error(`Failed to scrape URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setScrapingDirectUrl(false)
    }
  }

  const selectAllArticles = () => {
    dispatch(setSelectedArticles(pendingWebResults.map((_, index) => index)))
  }

  const deselectAllArticles = () => {
    dispatch(setSelectedArticles([]))
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

  // Get Perplexity research summaries sorted by timestamp
  const googleResearchResults = researchSummaries.googleResearchSummaries
    .slice()
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6">
      {/* Research Input Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Perplexity AI Research Assistant
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
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Search Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="us">United States</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
                <option value="au">Australia</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
                <option value="es">Spain</option>
                <option value="it">Italy</option>
                <option value="jp">Japan</option>
                <option value="kr">South Korea</option>
                <option value="cn">China</option>
                <option value="in">India</option>
                <option value="br">Brazil</option>
                <option value="mx">Mexico</option>
                <option value="all">Global (All Regions)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Search Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
                <option value="ar">Arabic</option>
                <option value="hi">Hindi</option>
                <option value="nl">Dutch</option>
                <option value="sv">Swedish</option>
                <option value="da">Danish</option>
                <option value="no">Norwegian</option>
                <option value="fi">Finnish</option>
                <option value="pl">Polish</option>
                <option value="tr">Turkish</option>
                <option value="he">Hebrew</option>
              </select>
            </div>
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

      {/* Direct URL Scraping Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
        <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
          <FileSearch className="h-6 w-6" />
          Direct URL Analysis
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="Enter any website URL to scrape and analyze (e.g., https://example.com/article)"
              className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !scrapingDirectUrl && directUrl.trim()) {
                  handleDirectUrlScraping()
                }
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              Extraction Focus (Optional)
            </label>
            <textarea
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              placeholder="Tell the AI what to focus on when analyzing this content (e.g., 'Extract all statistics and data points', 'Focus on the timeline of events', 'Look for quotes from specific people', etc.)"
              rows={3}
              className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-vertical"
            />
          </div>
          
          <button
            onClick={handleDirectUrlScraping}
            disabled={!directUrl.trim() || scrapingDirectUrl}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            {scrapingDirectUrl ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing URL...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                Scrape & Analyze URL
              </>
            )}
          </button>
          
          <p className="text-sm text-green-700">
            💡 Paste any article, blog post, news story, or web page URL to extract and analyze its content using AI. Use the focus field to direct the AI's attention to specific types of information.
          </p>
        </div>
      </div>

      {/* Filtering Statistics Notice */}
      {filteringStats && filteringStats.filteredOut > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-amber-600 font-bold text-sm">!</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 mb-2">Social Media Links Filtered</h4>
              <p className="text-sm text-amber-700 mb-2">
                <strong>{filteringStats.filteredOut}</strong> out of <strong>{filteringStats.totalFound}</strong> search results were filtered out because they are from social media platforms that cannot be scraped.
              </p>
              <p className="text-xs text-amber-600 mb-2">
                <strong>Reason:</strong> {filteringStats.reason}
              </p>
              {filteringStats.filteredDomains && filteringStats.filteredDomains.length > 0 && (
                <div className="text-xs text-amber-600">
                  <strong>Filtered domains:</strong> {filteringStats.filteredDomains.join(', ')}
                </div>
              )}
              <div className="mt-2 text-xs text-amber-600">
                💡 <strong>{filteringStats.availableForScraping}</strong> links are available for detailed content scraping.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Perplexity Search Results for Link Scraping */}
      {pendingWebResults.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-yellow-900 flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Perplexity Search Results ({pendingWebResults.length}) - Select to Scrape
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
                {selectedArticles.length} of {pendingWebResults.length} selected
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
            {pendingWebResults.map((article: any, index: number) => {
              const isSelected = selectedArticles.includes(index)
              
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
                          href={article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {article.title}
                        </a>
                      </h4>
                      <p className="text-sm text-gray-700 mb-2">
                        {article.url}
                      </p>
                      <div className="text-xs text-gray-500 flex gap-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {new URL(article.url).hostname}
                          </span>
                        {article.date && <span>📅 {article.date}</span>}
                        {article.last_updated && <span>🔄 Updated: {article.last_updated}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-yellow-700">
              🔥 Select links to scrape full content using Firecrawl. Each link will become a detailed research item.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  dispatch(clearResearchState())
                  setResearchQuery('')
                  setResearchContext('')
                  setFilteringStats(null)
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScrapeSelected}
                disabled={selectedArticles.length === 0 || isSummarizing}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Scraping {selectedArticles.length} links...
                  </>
                ) : (
                  <>
                    <Globe className="h-5 w-5" />
                    Scrape Selected ({selectedArticles.length})
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
                onClick={() => {
                  dispatch(clearAllResearchSummaries())
                  setFilteringStats(null)
                }}
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
                        Perplexity Research: {result.query}
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
                        onClick={() => saveToResearchHistory(result)}
                        disabled={savingToHistory.includes(result.id)}
                        className="text-green-500 hover:text-green-700 disabled:text-green-300 transition-colors"
                        title="Save to Research History"
                      >
                        {savingToHistory.includes(result.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                      
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
                        <div className="text-gray-700 bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                          {result.scraped_content ? (
                            <ReactMarkdown>{result.scraped_content}</ReactMarkdown>
                          ) : (
                            <p>{result.insights}</p>
                          )}
                        </div>
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
                        <p>No research results yet. Start a Perplexity AI research query above to see results here.</p>
        </div>
      )}
    </div>
  )
} 