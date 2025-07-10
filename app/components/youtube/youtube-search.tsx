'use client'

import React, { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut, Download, FileText, Eye, Search, Brain, Shield } from 'lucide-react'
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
  setError,
  searchVideos,
  generateSubtitles,
  generateSubtitlesIndividually,
  analyzeTranscript,
  summarizeVideos,
  clearVideosSummary,
  addYouTubeResearchSummary,
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
  type YouTubeResearchSummary,
} from '@/lib/features/youtube/youtubeSlice'
import { showToast } from '@/lib/utils/toast'

// Import modular components
import { AnalysisSection } from './analysis-section'
import { GlobalAnalysisSection } from './global-analysis-section'
import { ResearchTab } from './research-tab'
import { CurrentResearchTab } from './current-research-tab'
import { ChannelBlacklistManager } from './channel-blacklist-manager'
import { formatTimestamp, formatDate, formatFileSize, getSearchInfoText, getStatusDisplay, downloadSRTFile, parseDurationToSeconds } from './utils'
import { AnalysisType, EnhancedTranscriptAnalysis } from './types'

// Method icon component
const MethodIcon = ({ method }: { method?: string }) => {
  if (method === 'yt-dlp') {
    return (
      <div title="Fast extraction via yt-dlp">
        <Brain className="h-3 w-3 text-blue-600" />
      </div>
    )
  } else if (method === 'whisper') {
    return (
      <div title="AI transcription via Whisper">
        <FileText className="h-3 w-3 text-purple-600" />
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
  
  // Local state
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set())
  const [localQueries, setLocalQueries] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'youtube' | 'research' | 'current-research'>('youtube')
  const [geminiAnalyzing, setGeminiAnalyzing] = useState<Record<string, boolean>>({})
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false)
  const [showBlacklistManager, setShowBlacklistManager] = useState(false)
  const [blacklistedChannels, setBlacklistedChannels] = useState<any[]>([])
  const [minDurationFilter, setMinDurationFilter] = useState<number>(0) // Duration filter in seconds

  // Load blacklisted channels on component mount
  React.useEffect(() => {
    loadBlacklistedChannels()
  }, [])

  const loadBlacklistedChannels = async () => {
    try {
      const response = await fetch('/api/channel-blacklist')
      const result = await response.json()

      if (result.success) {
        setBlacklistedChannels(result.data || [])
      } else {
        console.error('Failed to load blacklisted channels:', result.error)
      }
    } catch (error) {
      console.error('Error loading blacklisted channels:', error)
    }
  }

  // Filter function to check if a video should be excluded
  const isVideoBlacklisted = (video: Video): boolean => {
    const channelTitle = video.snippet.channelTitle?.toLowerCase()

    return blacklistedChannels.some(entry => {
      // Check by channel name (case insensitive)
      if (entry.channel_name && channelTitle && 
          channelTitle.includes(entry.channel_name.toLowerCase())) {
        return true
      }

      // Check by channel handle (if available in future)
      if (entry.channel_handle && channelTitle && 
          channelTitle.includes(entry.channel_handle.toLowerCase().replace('@', ''))) {
        return true
      }

      // Note: Channel ID matching not available in current Video interface
      // This could be enhanced if channel ID becomes available in search results

      return false
    })
  }

  // Filter function to check if a video meets duration requirements
  const isVideoBelowDurationThreshold = (video: Video): boolean => {
    if (minDurationFilter === 0) return false // No filter applied
    
    // Check if duration data exists and filter accordingly
    const duration = (video as any).contentDetails?.duration
    if (!duration) return false // Don't filter if no duration data available
    
    const totalSeconds = parseDurationToSeconds(duration)
    return totalSeconds < minDurationFilter
  }

  // Filter search results to exclude blacklisted channels and short videos
  const filteredVideos = React.useMemo(() => {
    let filtered = searchResults.videos.filter(video => !isVideoBlacklisted(video))
    
    // Apply duration filter
    const durationFiltered = filtered.filter(video => !isVideoBelowDurationThreshold(video))
    const durationFilteredCount = filtered.length - durationFiltered.length
    
    filtered = durationFiltered
    
    const blacklistFilteredCount = searchResults.videos.length - (filtered.length + durationFilteredCount)
    
    // Show notification if videos were filtered
    if ((blacklistFilteredCount > 0 || durationFilteredCount > 0) && searchResults.videos.length > 0) {
      let message = '🚫 Filtered out '
      const filters = []
      if (blacklistFilteredCount > 0) filters.push(`${blacklistFilteredCount} from blacklisted channels`)
      if (durationFilteredCount > 0) filters.push(`${durationFilteredCount} below ${minDurationFilter / 60}min duration`)
      message += filters.join(' and ')
      console.log(message)
    }
    
    return filtered
  }, [searchResults.videos, blacklistedChannels, minDurationFilter])

  // Handler functions
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
    // Check if trying to select when limit is reached
    if (!searchResults.selectedVideos.includes(videoId) && searchResults.selectedVideos.length >= 5) {
      showToast.error('Maximum 5 videos can be selected for analysis at once')
      return
    }
    dispatch(toggleVideoSelection(videoId))
  }

  const handleSelectAll = () => {
    if (searchResults.selectedVideos.length > 0) {
      dispatch(deselectAllVideos())
    } else {
      dispatch(selectAllVideos())
      if (filteredVideos.length > 5) {
        showToast.info('Selected first 5 videos (maximum limit)')
      }
    }
  }

  const handleGenerateSubtitles = () => {
    if (searchResults.selectedVideos.length === 0) {
      return
    }

    // Since we limit selection to 5 videos, we can process all selected videos
    dispatch(generateSubtitlesIndividually(searchResults.selectedVideos))
  }

  const handleBulkAnalysis = async (analysisType: AnalysisType, query: string) => {
    setBulkAnalyzing(true)
    
    try {
      if (analysisType === 'standard') {
        // Bulk transcript analysis
        const videosWithSubtitles = searchResults.selectedVideos.filter(videoId => {
          const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
          return subtitleFile && subtitleFile.status === 'completed'
        })
        
        if (videosWithSubtitles.length === 0) {
          dispatch(setError('No videos with completed subtitles selected for analysis.'))
          return
        }

        // Analyze all transcripts and create a summary
        const analysisPromises = videosWithSubtitles.map(videoId => {
          const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
          const video = searchResults.videos.find(v => v.id.videoId === videoId)
          
          if (subtitleFile && video) {
            return dispatch(analyzeTranscript({
              videoId: videoId,
              srtContent: subtitleFile.srtContent,
              query: query.trim(),
              videoTitle: video.snippet.title
            }))
          }
          return null
        }).filter(Boolean)
        
        const analysisResults = await Promise.all(analysisPromises)
        
        // Create individual research entries for each analyzed video
        videosWithSubtitles.forEach(videoId => {
          const subtitleFile = subtitleGeneration.subtitleFiles.find(sf => sf.videoId === videoId)
          const video = searchResults.videos.find(v => v.id.videoId === videoId)
          const analysisResult = transcriptAnalysis.analysisResults.find(ar => ar.videoId === videoId)
          
          if (subtitleFile && video && analysisResult) {
            const individualSummary: YouTubeResearchSummary = {
              id: `transcript-${videoId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              query: `Transcript Analysis: "${query}" - ${video.snippet.title}`,
              videosSummary: {
                overallTheme: `Analysis of "${query}" in: ${video.snippet.title}`,
                keyInsights: analysisResult.analysis.length > 0 ? [analysisResult.analysis[0].summary] : [`Key insights from analyzing "${query}" in this video`],
                characterInsights: [],
                conflictElements: [],
                storyIdeas: [`Content ideas based on "${query}" analysis from ${video.snippet.title}`],
                commonPatterns: [`Patterns found for "${query}"`],
                creativePrompt: `Based on the transcript analysis of "${query}" in ${video.snippet.title}, create content that explores these themes...`,
                actionableItems: [`Review detailed transcript analysis for "${query}" in this video`],
                narrativeThemes: [query],
                videoSummaries: [{
                  videoId: videoId,
                  title: video.snippet.title,
                  mainTopic: query,
                  emotionalTone: 'Analytical',
                  keyPoints: analysisResult.analysis.length > 0 ? [analysisResult.analysis[0].relevantContent] : [`Analysis of "${query}"`],
                  narrativeElements: [],
                  keyQuotes: analysisResult.analysis.length > 0 && analysisResult.analysis[0].keyQuotes ? analysisResult.analysis[0].keyQuotes as any[] : [],
                  dramaticElements: analysisResult.analysis.length > 0 && analysisResult.analysis[0].dramaticElements ? analysisResult.analysis[0].dramaticElements : [],
                  contextualInfo: analysisResult.analysis.length > 0 ? analysisResult.analysis[0].contextualInfo || `Transcript analysis focusing on "${query}"` : `Transcript analysis focusing on "${query}"`,
                  timestamp: '0:00'
                }]
              },
              timestamp: new Date().toISOString(),
              appliedToScript: false,
              usingMock: false
            }
            
            dispatch(addYouTubeResearchSummary(individualSummary))
          }
        })
        
        showToast.success(`✅ Bulk transcript analysis completed! Created ${videosWithSubtitles.length} individual research entries for "${query}"`)
        
      } else {
        // Bulk Gemini analysis - REAL IMPLEMENTATION
        const videosForGemini = searchResults.selectedVideos.filter(videoId => {
          return searchResults.videos.find(v => v.id.videoId === videoId)
        })
        
        if (videosForGemini.length === 0) {
          dispatch(setError('No videos available for AI analysis.'))
          return
        }

        console.log(`🚀 Starting bulk Gemini analysis for ${videosForGemini.length} videos`)
        
        // Process each video through the real Gemini API
        const analysisPromises = videosForGemini.map(async (videoId) => {
          const video = searchResults.videos.find(v => v.id.videoId === videoId)
          if (!video) return null

          try {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
            
            // Step 1: Call Gemini analyze endpoint
            console.log(`🔍 Analyzing video: ${video.snippet.title}`)
            const geminiResponse = await fetch('/api/youtube/gemini-analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId: videoId,
                videoUrl: videoUrl,
                title: video.snippet.title,
                query: query?.trim() || undefined
              })
            })
            
            if (!geminiResponse.ok) {
              console.error(`Failed to analyze ${video.snippet.title}:`, geminiResponse.statusText)
              return null
            }
            
            const geminiResult = await geminiResponse.json()
            
            if (!geminiResult.success) {
              console.error(`Gemini analysis failed for ${video.snippet.title}:`, geminiResult.error)
              return null
            }
            
            // Step 2: Parse Gemini response with GPT-4o-mini
            const parseResponse = await fetch('/api/youtube/parse-gemini', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId: videoId,
                videoTitle: video.snippet.title,
                videoUrl: videoUrl,
                geminiRawResponse: geminiResult.rawResponse,
                query: query?.trim() || undefined
              })
            })
            
            if (!parseResponse.ok) {
              console.error(`Failed to parse Gemini response for ${video.snippet.title}:`, parseResponse.statusText)
              return null
            }
            
            const parseResult = await parseResponse.json()
            
            if (!parseResult.success) {
              console.error(`Failed to parse Gemini response for ${video.snippet.title}:`, parseResult.error)
              return null
            }
            
            console.log(`✅ Successfully analyzed: ${video.snippet.title}`)
            return {
              videoId,
              video,
              analysis: parseResult.analysis
            }
            
          } catch (error) {
            console.error(`Error analyzing ${video.snippet.title}:`, error)
            return null
          }
        })

        // Wait for all analyses to complete
        const results = await Promise.all(analysisPromises)
        const successfulResults = results.filter(result => result !== null)
        
        if (successfulResults.length === 0) {
          throw new Error('All video analyses failed. Please try again.')
        }
        
        // Create individual research entries for each analyzed video
        successfulResults.forEach(({ videoId, video, analysis }) => {
          const individualSummary: YouTubeResearchSummary = {
            id: `gemini-${videoId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            query: query ? `AI Analysis: "${query}" - ${video.snippet.title}` : `Full AI Analysis - ${video.snippet.title}`,
            videosSummary: {
              overallTheme: analysis.summary,
              keyInsights: analysis.keyPoints,
              characterInsights: analysis.characterInsights,
              conflictElements: analysis.conflictElements,
              storyIdeas: analysis.storyIdeas,
              commonPatterns: analysis.topics,
              creativePrompt: analysis.creativePrompt,
              actionableItems: analysis.actionableInsights,
              narrativeThemes: analysis.topics,
              videoSummaries: [{
                videoId: videoId,
                title: video.snippet.title,
                mainTopic: analysis.topics[0] || 'General Content',
                emotionalTone: analysis.emotionalTone,
                keyPoints: analysis.keyPoints,
                narrativeElements: analysis.actionableInsights,
                dramaticElements: analysis.conflictElements,
                contextualInfo: analysis.summary,
                timestamp: analysis.timestamps?.[0]?.startTime || '0:00', // Keep for backward compatibility
                timestamps: analysis.timestamps || [], // Store ALL timestamps
                keyQuotes: (analysis.keyQuotes || []).map((q: any) => 
                  typeof q === 'string' ? 
                    { startTime: '0:00', endTime: '0:00', speaker: 'Unknown', quote: q, context: '' } : 
                    q
                ) // Store ALL key quotes with timestamps
              }]
            },
            timestamp: new Date().toISOString(),
            appliedToScript: false,
            usingMock: false
          }
          
          dispatch(addYouTubeResearchSummary(individualSummary))
        })
        
        const successMessage = `✅ Bulk AI analysis completed! Successfully analyzed ${successfulResults.length}/${videosForGemini.length} videos and created individual research entries.`
        showToast.success(successMessage)
        
        console.log(`🎉 Bulk Gemini analysis complete: ${successfulResults.length}/${videosForGemini.length} videos processed as individual entries`)
      }
      
    } catch (error) {
      console.error('Bulk analysis error:', error)
      dispatch(setError(`Bulk analysis failed: ${(error as Error).message}`))
    } finally {
      setBulkAnalyzing(false)
    }
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

  const handleGeminiAnalysis = async (videoId: string, video: Video, analysisType: AnalysisType) => {
    const query = localQueries[videoId]
    
    try {
      setGeminiAnalyzing(prev => ({ ...prev, [videoId]: true }))
      
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      
      // Step 1: Call Gemini analyze endpoint
      console.log('🚀 Starting Gemini analysis for:', video.snippet.title)
      const geminiResponse = await fetch('/api/youtube/gemini-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          videoUrl: videoUrl,
          title: video.snippet.title,
          query: query?.trim() || undefined
        })
      })
      
      if (!geminiResponse.ok) {
        throw new Error(`Gemini analysis failed: ${geminiResponse.statusText}`)
      }
      
      const geminiResult = await geminiResponse.json()
      
      if (!geminiResult.success) {
        throw new Error(geminiResult.error || 'Gemini analysis failed')
      }
      
      console.log('✅ Gemini analysis completed, parsing with GPT-4o-mini...')
      
      // Step 2: Parse Gemini response with GPT-4o-mini
      const parseResponse = await fetch('/api/youtube/parse-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          videoTitle: video.snippet.title,
          videoUrl: videoUrl,
          geminiRawResponse: geminiResult.rawResponse,
          query: query?.trim() || undefined
        })
      })
      
      if (!parseResponse.ok) {
        throw new Error(`Failed to parse Gemini response: ${parseResponse.statusText}`)
      }
      
      const parseResult = await parseResponse.json()
      
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse Gemini response')
      }
      
      console.log('✅ Gemini response parsed successfully')
      
      // Step 3: Add to current research
      const analysisData = parseResult.analysis
      
      const youtubeResearchSummary: YouTubeResearchSummary = {
        id: `gemini-${videoId}-${Date.now()}`,
        query: query?.trim() || `Full Analysis: ${video.snippet.title}`,
        videosSummary: {
          overallTheme: analysisData.summary,
          keyInsights: analysisData.keyPoints,
          characterInsights: analysisData.characterInsights,
          conflictElements: analysisData.conflictElements,
          storyIdeas: analysisData.storyIdeas,
          commonPatterns: analysisData.topics,
          creativePrompt: analysisData.creativePrompt,
          actionableItems: analysisData.actionableInsights,
          narrativeThemes: analysisData.topics,
          videoSummaries: [{
            videoId: videoId,
            title: video.snippet.title,
            mainTopic: analysisData.topics[0] || 'General Content',
            emotionalTone: analysisData.emotionalTone,
            keyPoints: analysisData.keyPoints,
            narrativeElements: analysisData.actionableInsights,
            dramaticElements: analysisData.conflictElements,
            contextualInfo: analysisData.summary,
            timestamp: analysisData.timestamps[0]?.startTime || '0:00', // Keep for backward compatibility
            timestamps: analysisData.timestamps || [], // Store ALL timestamps
            keyQuotes: (analysisData.keyQuotes || []).map((q: any) => 
              typeof q === 'string' ? 
                { startTime: '0:00', endTime: '0:00', speaker: 'Unknown', quote: q, context: '' } : 
                q
            ) // Store ALL key quotes with timestamps
          }]
        },
        timestamp: new Date().toISOString(),
        appliedToScript: false,
        usingMock: false
      }
      
      dispatch(addYouTubeResearchSummary(youtubeResearchSummary))
      
      const successMessage = query?.trim() 
        ? `✅ AI analysis for "${query}" added to current research`
        : `✅ Full AI analysis added to current research`
      
      setLocalQueries(prev => ({ ...prev, [videoId]: '' }))
      showToast.success(successMessage)
      
    } catch (error) {
      console.error('Error in Gemini analysis:', error)
      dispatch(setError(`Gemini analysis failed: ${(error as Error).message}`))
    } finally {
      setGeminiAnalyzing(prev => ({ ...prev, [videoId]: false }))
    }
  }

  const handlePreviewSRT = (subtitle: SubtitleFile) => {
    dispatch(setPreviewContent({ 
      content: subtitle.srtContent, 
      title: subtitle.title 
    }))
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

  const toggleAnalysisExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedAnalysis)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedAnalysis(newExpanded)
  }

  // Enhanced transcript analysis with Gemini state
  const enhancedTranscriptAnalysis: EnhancedTranscriptAnalysis = {
    ...transcriptAnalysis,
    analyzingGemini: geminiAnalyzing
  }

  // Validation for search form
  const isSearchFormValid = searchForm.searchQuery.trim() || searchForm.channelUrl.trim()

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

  return (
    <div className="flex-1 p-6 bg-white overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">YouTube Research Assistant</h1>
            <p className="text-gray-600">
              Search for videos, generate subtitles, analyze transcripts, and conduct comprehensive research with AI-powered insights.
            </p>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <button
              onClick={() => setShowBlacklistManager(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Channel Blacklist
              {blacklistedChannels.length > 0 && (
                <span className="bg-red-800 text-white text-xs px-2 py-1 rounded-full">
                  {blacklistedChannels.length}
                </span>
              )}
            </button>
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
                      Min Duration (minutes):
                    </label>
                    <input
                      type="number"
                      id="minDuration"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                        minDurationFilter > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                      }`}
                      min="0"
                      max="1440"
                      value={minDurationFilter / 60}
                      onChange={(e) => setMinDurationFilter((parseInt(e.target.value) || 0) * 60)}
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Filter out videos shorter than this duration
                      {minDurationFilter > 0 && (
                        <span className="text-blue-600 font-medium ml-1">
                          (Currently filtering videos under {minDurationFilter / 60} minutes)
                        </span>
                      )}
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
                  Found {searchResults.videos.length} videos for {getSearchInfoText(searchResults.searchInfo)}
                  {filteredVideos.length !== searchResults.videos.length && (
                    <>
                      <br />
                      <span className="text-red-700">
                        🚫 Filtered out {searchResults.videos.length - filteredVideos.length} video(s)
                        {blacklistedChannels.length > 0 && ' from blacklisted channels'}
                        {minDurationFilter > 0 && (blacklistedChannels.length > 0 ? ' and' : '') + ` below ${minDurationFilter / 60}min duration`}
                      </span>
                    </>
                  )}
                  <br />
                  Showing: {filteredVideos.length} videos • Requested: {searchResults.searchInfo.maxResults} results
                  {minDurationFilter > 0 && (
                    <>
                      <br />
                      <span className="text-blue-700">
                        ⏱️ Duration filter: {minDurationFilter / 60} minutes minimum
                        <span className="text-xs ml-2">(Note: Duration data may not be available for all videos)</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Selection Controls - use filteredVideos */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <button
                        onClick={handleSelectAll}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors"
                      >
                        {searchResults.selectedVideos.length > 0 ? 'Deselect All' : `Select ${Math.min(5, filteredVideos.length)} Video${Math.min(5, filteredVideos.length) === 1 ? '' : 's'}`}
                      </button>
                      <span className="ml-4 text-blue-700">
                        {searchResults.selectedVideos.length} of {Math.min(5, filteredVideos.length)} videos selected
                        <span className="text-sm text-gray-600 ml-2">(max 5 for analysis)</span>
                      </span>
                    </div>
                  </div>
                  
                  {filteredVideos.length > 5 && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm">
                      ℹ️ Note: You can select up to 5 videos at once for transcript generation and analysis.
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <button
                      onClick={handleGenerateSubtitles}
                      disabled={searchResults.selectedVideos.length === 0 || subtitleGeneration.generatingSubtitles}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded transition-colors"
                    >
                      {subtitleGeneration.generatingSubtitles ? (
                        <>
                          <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        `Generate Subtitles (${searchResults.selectedVideos.length})`
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
                          <Brain className="h-4 w-4" />
                          Summarize ({getVideosWithSubtitlesCount()})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Global Analysis Section - pass filteredVideos */}
                <GlobalAnalysisSection
                  selectedVideos={searchResults.selectedVideos}
                  videos={filteredVideos}
                  subtitleFiles={subtitleGeneration.subtitleFiles}
                  onBulkAnalysis={handleBulkAnalysis}
                  isAnalyzing={bulkAnalyzing}
                />
              </>
            )}

            {/* Videos List - use filteredVideos */}
            <div className="space-y-4">
              {filteredVideos.map((video) => {
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
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group mb-2"
                        >
                          <h3 className="text-lg font-bold text-red-600 group-hover:text-red-800 group-hover:underline transition-colors">
                            {video.snippet.title}
                          </h3>
                        </a>
                        <p className="text-gray-600 mb-3 line-clamp-3">{video.snippet.description}</p>
                        <div className="text-sm text-gray-500 mb-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Channel:</span>
                            <span>{video.snippet.channelTitle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Published:</span>
                            <span>{formatDate(video.snippet.publishedAt)}</span>
                          </div>
                          {(video as any).contentDetails?.duration && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Duration:</span>
                              <span className="text-blue-600 font-medium">
                                {(() => {
                                  const seconds = parseDurationToSeconds((video as any).contentDetails.duration)
                                  const minutes = Math.floor(seconds / 60)
                                  const remainingSeconds = seconds % 60
                                  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
                                })()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium">YouTube:</span>
                            <a
                              href={videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 hover:text-red-800 underline flex items-center gap-1"
                            >
                              Watch Video
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-6m-7 1l8-8m0 0V8m0 0H8" />
                              </svg>
                            </a>
                          </div>
                        </div>
                        
                        {/* Compact Analysis Section */}
                        <AnalysisSection 
                          videoId={videoId} 
                          video={video} 
                          subtitleFile={subtitleFile}
                          localQueries={localQueries}
                          setLocalQueries={setLocalQueries}
                          transcriptAnalysis={enhancedTranscriptAnalysis}
                          expandedAnalysis={expandedAnalysis}
                          toggleAnalysisExpansion={toggleAnalysisExpansion}
                          handleAnalyzeTranscript={handleAnalyzeTranscript}
                          handleAnalyzeVideoTranscript={handleAnalyzeVideoTranscript}
                          handleGeminiAnalysis={handleGeminiAnalysis}
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
                                <MethodIcon method={subtitleFile.method} />
                              </div>
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
                        
                        {/* Compact Analysis Section for Subtitle Files */}
                        <AnalysisSection 
                          videoId={subtitleFile.videoId} 
                          subtitleFile={subtitleFile}
                          localQueries={localQueries}
                          setLocalQueries={setLocalQueries}
                          transcriptAnalysis={enhancedTranscriptAnalysis}
                          expandedAnalysis={expandedAnalysis}
                          toggleAnalysisExpansion={toggleAnalysisExpansion}
                          handleAnalyzeTranscript={handleAnalyzeTranscript}
                          handleAnalyzeVideoTranscript={handleAnalyzeVideoTranscript}
                          handleGeminiAnalysis={handleGeminiAnalysis}
                        />
                      </div>
                    )
                  })}
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
      
      {/* Channel Blacklist Manager Modal */}
      <ChannelBlacklistManager 
        isOpen={showBlacklistManager}
        onClose={() => setShowBlacklistManager(false)}
        onBlacklistUpdate={loadBlacklistedChannels}
      />
    </div>
  )
} 