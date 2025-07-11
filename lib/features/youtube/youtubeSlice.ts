import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

// YouTube Video interface
export interface Video {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
  }
  statistics?: {
    viewCount: string
    likeCount: string
    commentCount: string
  }
  contentDetails?: {
    duration: string
  }
}

// Subtitle File interface
export interface SubtitleFile {
  videoId: string
  title: string
  filename: string
  srtContent: string
  size: number
  status: 'processing' | 'completed' | 'error' | 'downloading' | 'transcribing' | 'extracting' | 'pending'
  progress?: string
  method?: 'yt-dlp' | 'whisper' | 'supadata'
}

// Detailed Timestamp interface for Gemini analysis
export interface DetailedTimestamp {
  startTime: string
  endTime: string
  speaker: string
  quote?: string
  extraInfo: string
  description: string
  significance: string
}

// Key Quote interface for Gemini analysis  
export interface KeyQuote {
  startTime: string
  endTime: string
  speaker: string
  quote: string
  context: string
}

// Transcript Analysis interface
export interface TranscriptAnalysis {
  timestamp: string
  summary: string
  relevantContent: string
  confidence: number
  youtubeUrl?: string
  dramaticElements?: string[]
  keyQuotes?: string[]
  contextualInfo?: string
}

// Analysis Result interface - updated to handle multiple results
export interface AnalysisResult {
  videoId: string
  query: string
  analysis: TranscriptAnalysis[] // Changed from single TranscriptAnalysis to array
  timestamp: string
  usingMock?: boolean
}

// Clip interface for script attachment
export interface AvailableClip {
  id: string
  videoId: string
  videoTitle: string
  youtubeUrl: string
  startTime: string
  endTime: string
  description: string
  quote?: string
  speaker?: string
  significance?: string
  source: 'analysis' | 'research' | 'gemini' // Where the clip came from
  confidence?: number
}

// Search Info interface
export interface SearchInfo {
  query?: string
  channelId?: string
  maxResults: number
}

// Video Summary interfaces
export interface VideoSummary {
  videoId: string
  title: string
  keyPoints: string[]
  mainTopic: string
  timestamp?: string // Keep for backward compatibility
  timestamps?: DetailedTimestamp[] // NEW: Array of all timestamps from analysis
  keyQuotes?: KeyQuote[] // NEW: Array of key quotes with timestamps
  narrativeElements: string[]
  emotionalTone: string
  dramaticElements?: string[]
  contextualInfo?: string
}

export interface VideosSummary {
  overallTheme: string
  keyInsights: string[]
  videoSummaries: VideoSummary[]
  commonPatterns: string[]
  actionableItems: string[]
  narrativeThemes: string[]
  characterInsights: string[]
  conflictElements: string[]
  storyIdeas: string[]
  creativePrompt: string
}

// Research Summary interfaces
export interface WebSearchResult {
  title: string
  link: string
  description: string
  source?: string
}

export interface GoogleResearchSummary {
  id: string
  query: string
  context?: string
  webResults: WebSearchResult[]
  insights: string
  keyFindings: string[]
  recommendations: string[]
  sources: string[]
  timestamp: string
  usingMock?: boolean
  appliedToScript?: boolean
}

export interface YouTubeResearchSummary {
  id: string
  query: string
  videosSummary: VideosSummary
  timestamp: string
  usingMock?: boolean
  appliedToScript?: boolean
}

// SRT Entry interface for deduplication
interface SRTEntry {
  index: number
  startTime: string
  endTime: string
  text: string
  startMs: number
  endMs: number
}

// Utility function to convert timestamp to milliseconds
function timestampToMs(timestamp: string): number {
  const [time, ms] = timestamp.split(',')
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + Number(ms)
}

// Utility function to convert milliseconds to timestamp
function msToTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

// Utility function to calculate text similarity (simple approach)
function textSimilarity(text1: string, text2: string): number {
  const clean1 = text1.toLowerCase().trim()
  const clean2 = text2.toLowerCase().trim()
  
  if (clean1 === clean2) return 1.0
  
  // Simple containment check
  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    return Math.max(clean2.length, clean1.length) / Math.min(clean1.length || 1, clean2.length || 1)
  }
  
  return 0
}

// Utility function to deduplicate SRT content
function deduplicateSRT(srtContent: string): string {
  if (!srtContent || !srtContent.trim()) return srtContent

  console.log('🔧 Starting SRT deduplication...')
  
  // Parse SRT entries
  const entries: SRTEntry[] = []
  const blocks = srtContent.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length >= 3) {
      const index = parseInt(lines[0])
      const [startTime, endTime] = lines[1].split(' --> ')
      const text = lines.slice(2).join('\n').trim()
      
      if (!isNaN(index) && startTime && endTime && text) {
        entries.push({
          index,
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          text,
          startMs: timestampToMs(startTime.trim()),
          endMs: timestampToMs(endTime.trim())
        })
      }
    }
  }

  console.log(`📝 Parsed ${entries.length} SRT entries`)

  if (entries.length === 0) return srtContent

  // Sort by start time
  entries.sort((a, b) => a.startMs - b.startMs)

  // Deduplicate entries
  const deduplicatedEntries: SRTEntry[] = []
  const OVERLAP_THRESHOLD = 500 // 500ms overlap threshold
  const SIMILARITY_THRESHOLD = 0.8 // 80% text similarity threshold

  for (let i = 0; i < entries.length; i++) {
    const currentEntry = entries[i]
    let shouldKeep = true

    // Check against already kept entries
    for (const keptEntry of deduplicatedEntries) {
      // Check for time overlap
      const timeOverlap = !(currentEntry.endMs <= keptEntry.startMs || currentEntry.startMs >= keptEntry.endMs)
      const timeClose = Math.abs(currentEntry.startMs - keptEntry.startMs) <= OVERLAP_THRESHOLD

      // Check for text similarity
      const similarity = textSimilarity(currentEntry.text, keptEntry.text)

      // If similar time and text, skip this entry
      if ((timeOverlap || timeClose) && similarity >= SIMILARITY_THRESHOLD) {
        shouldKeep = false
        break
      }
    }

    if (shouldKeep) {
      // Clean up the text by removing word-level timestamps
      let cleanText = currentEntry.text
      // Remove patterns like <00:00:00.560>
      cleanText = cleanText.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      // Remove extra spaces
      cleanText = cleanText.replace(/\s+/g, ' ').trim()
      
      if (cleanText) { // Only keep entries with actual text
        deduplicatedEntries.push({
          ...currentEntry,
          text: cleanText
        })
      }
    }
  }

  console.log(`✅ Deduplicated from ${entries.length} to ${deduplicatedEntries.length} entries`)

  // Rebuild SRT content with sequential numbering
  const deduplicatedSRT = deduplicatedEntries
    .map((entry, index) => {
      return `${index + 1}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`
    })
    .join('\n\n')

  return deduplicatedSRT + '\n'
}

// YouTube state interface
interface YouTubeState {
  // Search form state
  searchQuery: string
  channelUrl: string
  maxResults: number
  sortOrder: string
  
  // Search results
  videos: Video[]
  searchInfo: SearchInfo | null
  selectedVideos: string[] // Array instead of Set for serialization
  
  // Subtitle generation
  subtitleFiles: SubtitleFile[]
  generatingSubtitles: boolean
  totalVideosProcessing: number
  completedVideosCount: number
  
  // Transcript analysis
  analysisResults: AnalysisResult[]
  analyzingTranscripts: Record<string, boolean> // videoId -> isAnalyzing
  analysisQueries: Record<string, string> // videoId -> current query
  
  // Video summarization
  videosSummary: VideosSummary | null
  summarizingVideos: boolean
  
  // Research summaries
  googleResearchSummaries: GoogleResearchSummary[]
  youtubeResearchSummaries: YouTubeResearchSummary[]
  
  // Available clips for script attachment
  availableClips: AvailableClip[]
  
  // Loading and error states
  searchLoading: boolean
  error: string | null
  
  // Preview modal
  previewContent: string | null
  previewTitle: string
}

// Initial state
const initialState: YouTubeState = {
  // Search form state
  searchQuery: '',
  channelUrl: '',
  maxResults: 50,
  sortOrder: 'date',
  
  // Search results
  videos: [],
  searchInfo: null,
  selectedVideos: [],
  
  // Subtitle generation
  subtitleFiles: [],
  generatingSubtitles: false,
  totalVideosProcessing: 0,
  completedVideosCount: 0,
  
  // Transcript analysis
  analysisResults: [],
  analyzingTranscripts: {},
  analysisQueries: {},
  
  // Video summarization
  videosSummary: null,
  summarizingVideos: false,
  
  // Research summaries
  googleResearchSummaries: [],
  youtubeResearchSummaries: [],
  
  // Available clips for script attachment
  availableClips: [],
  
  // Loading and error states
  searchLoading: false,
  error: null,
  
  // Preview modal
  previewContent: null,
  previewTitle: '',
}

// Helper function to try yt-dlp method first
async function tryYtDlpExtraction(videoIds: string[]): Promise<{ subtitleFiles: SubtitleFile[], failedVideoIds: string[] }> {
  console.log('🔄 Trying yt-dlp extraction for', videoIds.length, 'videos')
  
  try {
    const response = await fetch('https://fdaa-34-173-92-192.ngrok-free.app/extract-multiple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoIds: videoIds,
        language: 'en'
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'yt-dlp extraction failed')
    }

    // Convert successful results to SubtitleFile format with deduplication
    const subtitleFiles: SubtitleFile[] = []
    const failedVideoIds: string[] = []

    for (const result of data.results) {
      if (result.success) {
        // Deduplicate the SRT content before storing
        const deduplicatedSRT = deduplicateSRT(result.srtContent)
        
        subtitleFiles.push({
          videoId: result.videoId,
          title: result.videoTitle,
          filename: `${result.videoTitle.replace(/[<>:"/\\|?*]+/g, "")}_subtitles.srt`,
          srtContent: deduplicatedSRT,
          size: Buffer.byteLength(deduplicatedSRT, 'utf8'), // Recalculate size after deduplication
          status: 'completed',
          method: 'yt-dlp'
        })
      } else {
        failedVideoIds.push(result.videoId)
      }
    }

    console.log(`✅ yt-dlp extracted ${subtitleFiles.length} subtitles, ${failedVideoIds.length} failed`)
    
    return { subtitleFiles, failedVideoIds }
  } catch (error) {
    console.error('❌ yt-dlp extraction failed:', error)
    throw error
  }
}

// Helper function for fallback Whisper method
async function fallbackWhisperMethod(videoIds: string[]): Promise<SubtitleFile[]> {
  console.log('🔄 Using fallback Whisper method for', videoIds.length, 'videos')
  
  const response = await fetch('/api/youtube/download-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ videoIds }),
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Whisper transcription failed')
  }

  // Mark as Whisper method and deduplicate SRT content
  return (data.subtitleFiles || []).map((file: SubtitleFile) => {
    const deduplicatedSRT = deduplicateSRT(file.srtContent)
    return {
    ...file,
      method: 'whisper',
      srtContent: deduplicatedSRT,
      size: Buffer.byteLength(deduplicatedSRT, 'utf8') // Recalculate size after deduplication
    }
  })
}

// Async thunk for searching videos
export const searchVideos = createAsyncThunk(
  'youtube/searchVideos',
  async (params: {
    searchQuery?: string
    channelUrl?: string
    maxResults: number
    sortOrder: string
  }) => {
    const response = await fetch('/api/youtube/youtube-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'An error occurred while searching')
    }

    return {
      videos: data.data.items || [],
      searchInfo: data.searchInfo
    }
  }
)

// Original async thunk for generating subtitles with yt-dlp first, then fallback (keep for compatibility)
export const generateSubtitles = createAsyncThunk(
  'youtube/generateSubtitles',
  async (videoIds: string[], { dispatch }) => {
    console.log(`🎬 Starting subtitle generation for ${videoIds.length} videos`)
    
    let allSubtitleFiles: SubtitleFile[] = []
    let remainingVideoIds = [...videoIds]

    // Step 1: Try yt-dlp extraction first
    try {
      dispatch(updateSubtitleGenerationStatus('extracting'))
      console.log('📡 Attempting yt-dlp extraction...')
      
      const ytDlpResult = await tryYtDlpExtraction(videoIds)
      allSubtitleFiles.push(...ytDlpResult.subtitleFiles)
      remainingVideoIds = ytDlpResult.failedVideoIds || []
      
      console.log(`✅ yt-dlp: ${ytDlpResult.subtitleFiles.length} successful, ${remainingVideoIds.length} need fallback`)
      
    } catch (error) {
      console.warn('⚠️ yt-dlp extraction failed, using fallback for all videos:', error)
      // If yt-dlp completely fails, use fallback for all videos
      remainingVideoIds = videoIds
    }

    // Step 2: Use Whisper fallback for remaining videos
    if (remainingVideoIds.length > 0) {
      try {
        dispatch(updateSubtitleGenerationStatus('transcribing'))
        console.log(`🤖 Using Whisper fallback for ${remainingVideoIds.length} videos`)
        
        const whisperFiles = await fallbackWhisperMethod(remainingVideoIds)
        allSubtitleFiles.push(...whisperFiles)
        
        console.log(`✅ Whisper: ${whisperFiles.length} additional subtitles generated`)
        
      } catch (error) {
        console.error('❌ Whisper fallback also failed:', error)
        
        // Add error entries for completely failed videos
        const errorFiles: SubtitleFile[] = remainingVideoIds.map(videoId => ({
          videoId,
          title: `Video ${videoId}`,
          filename: '',
          srtContent: '',
          size: 0,
          status: 'error',
          progress: error instanceof Error ? error.message : 'Both extraction methods failed',
          method: 'whisper'
        }))
        
        allSubtitleFiles.push(...errorFiles)
      }
    }

    console.log(`🎉 Subtitle generation complete: ${allSubtitleFiles.length} total files`)
    return allSubtitleFiles
  }
)

// New async thunk for generating subtitles with individual progress tracking
export const generateSubtitlesIndividually = createAsyncThunk(
  'youtube/generateSubtitlesIndividually',
  async (videoIds: string[], { dispatch }) => {
    console.log(`🎬 Starting individual subtitle generation for ${videoIds.length} videos`)
    
    // Initialize subtitle files and counters
    dispatch(initializeSubtitleFiles(videoIds))
    
    // Process each video individually in parallel
    const processingPromises = videoIds.map(async (videoId) => {
      try {
        // Update status to downloading
        dispatch(updateSubtitleStatus({
          videoId,
          status: 'downloading',
          progress: 'Starting transcript extraction...'
        }))

        // Make API call for individual video
        const response = await fetch('/api/youtube/download-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoId }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          // Handle API error response
          const errorMessage = data.details || data.error || `HTTP ${response.status}: Failed to extract transcript`
          throw new Error(errorMessage)
        }

        // Update status to transcribing
        dispatch(updateSubtitleStatus({
          videoId,
          status: 'transcribing',
          progress: 'Processing transcript data...'
        }))

        // Update with completed result
        const subtitleFile = data.subtitleFile
        dispatch(addSubtitleFile({
          ...subtitleFile,
          method: 'supadata'
        }))

        // Increment completed count
        dispatch(incrementCompletedVideos())

        return subtitleFile

      } catch (error) {
        console.error(`Error processing video ${videoId}:`, error)
        
        // Update with error status and detailed error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        dispatch(updateSubtitleStatus({
          videoId,
          status: 'error',
          progress: errorMessage
        }))

        // Still increment completed count for failed videos
        dispatch(incrementCompletedVideos())

        return null
      }
    })

    // Wait for all videos to complete
    const results = await Promise.all(processingPromises)
    const successfulResults = results.filter(result => result !== null)
    
    console.log(`🎉 Individual subtitle generation complete: ${successfulResults.length}/${videoIds.length} successful`)
    
    return {
      totalVideos: videoIds.length,
      successfulVideos: successfulResults.length,
      subtitleFiles: successfulResults
    }
  }
)

// Async thunk for analyzing transcripts
export const analyzeTranscript = createAsyncThunk(
  'youtube/analyzeTranscript',
  async (params: {
    videoId: string
    srtContent: string
    query: string
    videoTitle: string
  }) => {
    const response = await fetch('/api/youtube/analyze-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        srtContent: params.srtContent,
        query: params.query,
        videoTitle: params.videoTitle,
        videoId: params.videoId
      }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'An error occurred while analyzing transcript')
    }

    // data.analysis is now an array of results
    return {
      videoId: params.videoId,
      query: params.query,
      analysis: data.analysis, // This is now an array
      timestamp: new Date().toISOString(),
      usingMock: data.usingMock
    }
  }
)

// Async thunk for Google research
export const performGoogleResearch = createAsyncThunk(
  'youtube/performGoogleResearch',
  async ({ query, context, maxResults = 30 }: { query: string; context?: string; maxResults?: number }) => {
    console.log(`🔍 Performing Google research for: "${query}"`)

    // Step 1: Search the web
    const webResponse = await fetch('/api/research/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query,
        context,
        maxResults 
      })
    })
    
    const webData = await webResponse.json()
    if (!webData.success) {
      throw new Error(webData.error || 'Failed to search web')
    }

    // Step 2: Generate Google-only research summary
    const summaryResponse = await fetch('/api/research/generate-google-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        context,
        webResults: webData.results
      })
    })

    const summaryData = await summaryResponse.json()
    if (!summaryData.success) {
      throw new Error(summaryData.error || 'Failed to generate research summary')
    }

    return {
      id: `google-${Date.now()}`,
      query,
      context,
      webResults: webData.results,
      insights: summaryData.insights,
      keyFindings: summaryData.keyFindings,
      recommendations: summaryData.recommendations,
      sources: summaryData.sources || [],
      timestamp: new Date().toISOString(),
      usingMock: summaryData.usingMock,
      appliedToScript: false
    }
  }
)

// Async thunk for summarizing videos
export const summarizeVideos = createAsyncThunk(
  'youtube/summarizeVideos',
  async (videoIds: string[], { getState }) => {
    const state = getState() as { youtube: YouTubeState }
    
    // Get subtitle files for the selected videos
    const videosWithSubtitles = videoIds
      .map(videoId => {
        const subtitleFile = state.youtube.subtitleFiles.find(sf => sf.videoId === videoId && sf.status === 'completed')
        return subtitleFile ? {
          videoId: videoId,
          title: subtitleFile.title,
          srtContent: subtitleFile.srtContent
        } : null
      })
      .filter((video): video is NonNullable<typeof video> => video !== null)

    if (videosWithSubtitles.length === 0) {
      throw new Error('No videos with completed subtitles found for summarization')
    }

    console.log(`🎬 Summarizing ${videosWithSubtitles.length} videos with completed subtitles`)

    const response = await fetch('/api/summarize-videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videos: videosWithSubtitles
      }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'An error occurred while summarizing videos')
    }

    return {
      summary: data.summary,
      usingMock: data.usingMock,
      videoCount: videosWithSubtitles.length,
      // Create research summary data
      researchSummary: {
        id: `youtube-${Date.now()}`,
        query: `YouTube video analysis (${videosWithSubtitles.length} videos)`,
        videosSummary: data.summary,
        timestamp: new Date().toISOString(),
        usingMock: data.usingMock,
        appliedToScript: false
      }
    }
  }
)

export const youtubeSlice = createSlice({
  name: 'youtube',
  initialState,
  reducers: {
    // Search form actions
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    
    setChannelUrl: (state, action: PayloadAction<string>) => {
      state.channelUrl = action.payload
    },
    
    setMaxResults: (state, action: PayloadAction<number>) => {
      state.maxResults = action.payload
    },
    
    setSortOrder: (state, action: PayloadAction<string>) => {
      state.sortOrder = action.payload
    },
    
    // Video selection actions
    toggleVideoSelection: (state, action: PayloadAction<string>) => {
      const videoId = action.payload
      const index = state.selectedVideos.indexOf(videoId)
      
      if (index >= 0) {
        // Remove video if already selected
        state.selectedVideos.splice(index, 1)
      } else {
        // Check if we can add more videos (max 5)
        if (state.selectedVideos.length >= 5) {
          // Don't add - limit reached
          return
        }
        state.selectedVideos.push(videoId)
      }
    },
    
    selectAllVideos: (state) => {
      // Select only the first 5 videos (max limit)
      state.selectedVideos = state.videos.slice(0, 5).map(v => v.id.videoId)
    },
    
    deselectAllVideos: (state) => {
      state.selectedVideos = []
    },
    
    // Subtitle actions
    updateSubtitleStatus: (state, action: PayloadAction<{
      videoId: string
      status: SubtitleFile['status']
      progress?: string
    }>) => {
      const { videoId, status, progress } = action.payload
      const subtitle = state.subtitleFiles.find(s => s.videoId === videoId)
      if (subtitle) {
        subtitle.status = status
        if (progress !== undefined) {
          subtitle.progress = progress
        }
      }
    },
    
    updateSubtitleGenerationStatus: (state, action: PayloadAction<'extracting' | 'transcribing'>) => {
      const status = action.payload
      // Update all processing subtitle files with the current step
      state.subtitleFiles.forEach(file => {
        if (file.status === 'processing' || file.status === 'extracting' || file.status === 'transcribing') {
          file.status = status
        }
      })
    },
    
    addSubtitleFile: (state, action: PayloadAction<SubtitleFile>) => {
      const existingIndex = state.subtitleFiles.findIndex(s => s.videoId === action.payload.videoId)
      if (existingIndex >= 0) {
        state.subtitleFiles[existingIndex] = action.payload
      } else {
        state.subtitleFiles.push(action.payload)
      }
    },
    
    // Transcript analysis actions
    setAnalysisQuery: (state, action: PayloadAction<{ videoId: string; query: string }>) => {
      const { videoId, query } = action.payload
      state.analysisQueries[videoId] = query
    },
    
    clearAnalysisResults: (state, action: PayloadAction<string>) => {
      const videoId = action.payload
      state.analysisResults = state.analysisResults.filter(result => result.videoId !== videoId)
    },
    
    // Video summarization actions
    clearVideosSummary: (state) => {
      state.videosSummary = null
    },
    
    // Research summary actions
    addGoogleResearchSummary: (state, action: PayloadAction<GoogleResearchSummary>) => {
      state.googleResearchSummaries.push(action.payload)
    },
    
    addYouTubeResearchSummary: (state, action: PayloadAction<YouTubeResearchSummary>) => {
      state.youtubeResearchSummaries.push(action.payload)
    },
    
    updateGoogleResearchSummary: (state, action: PayloadAction<GoogleResearchSummary>) => {
      const index = state.googleResearchSummaries.findIndex(s => s.id === action.payload.id)
      if (index >= 0) {
        state.googleResearchSummaries[index] = action.payload
      }
    },
    
    updateYouTubeResearchSummary: (state, action: PayloadAction<YouTubeResearchSummary>) => {
      const index = state.youtubeResearchSummaries.findIndex(s => s.id === action.payload.id)
      if (index >= 0) {
        state.youtubeResearchSummaries[index] = action.payload
      }
    },
    
    removeGoogleResearchSummary: (state, action: PayloadAction<string>) => {
      state.googleResearchSummaries = state.googleResearchSummaries.filter(
        summary => summary.id !== action.payload
      )
    },
    
    removeYouTubeResearchSummary: (state, action: PayloadAction<string>) => {
      state.youtubeResearchSummaries = state.youtubeResearchSummaries.filter(
        summary => summary.id !== action.payload
      )
    },
    
    clearAllResearchSummaries: (state) => {
      state.googleResearchSummaries = []
      state.youtubeResearchSummaries = []
    },
    
    // Mark research summaries as applied to script
    markGoogleResearchAsApplied: (state, action: PayloadAction<string>) => {
      const summary = state.googleResearchSummaries.find(s => s.id === action.payload)
      if (summary) {
        summary.appliedToScript = true
      }
    },
    
    markYouTubeResearchAsApplied: (state, action: PayloadAction<string>) => {
      const summary = state.youtubeResearchSummaries.find(s => s.id === action.payload)
      if (summary) {
        summary.appliedToScript = true
      }
    },
    
    markMultipleResearchAsApplied: (state, action: PayloadAction<{ googleIds: string[], youtubeIds: string[] }>) => {
      action.payload.googleIds.forEach(id => {
        const summary = state.googleResearchSummaries.find(s => s.id === id)
        if (summary) {
          summary.appliedToScript = true
        }
      })
      
      action.payload.youtubeIds.forEach(id => {
        const summary = state.youtubeResearchSummaries.find(s => s.id === id)
        if (summary) {
          summary.appliedToScript = true
        }
      })
    },
    
    // Preview modal actions
    setPreviewContent: (state, action: PayloadAction<{ content: string; title: string } | null>) => {
      if (action.payload) {
        state.previewContent = action.payload.content
        state.previewTitle = action.payload.title
      } else {
        state.previewContent = null
        state.previewTitle = ''
      }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
    
    // Reset actions
    resetSearchResults: (state) => {
      state.videos = []
      state.searchInfo = null
      state.selectedVideos = []
      state.error = null
    },
    
    resetSubtitleFiles: (state) => {
      state.subtitleFiles = []
    },
    
    resetAnalysisResults: (state) => {
      state.analysisResults = []
      state.analyzingTranscripts = {}
      state.analysisQueries = {}
    },
    
    resetAll: (state) => {
      return { ...initialState }
    },

    // Initialize subtitle files for processing
    initializeSubtitleFiles: (state, action: PayloadAction<string[]>) => {
      const videoIds = action.payload
      state.totalVideosProcessing = videoIds.length
      state.completedVideosCount = 0
      
      videoIds.forEach(videoId => {
        const existingFile = state.subtitleFiles.find(sf => sf.videoId === videoId)
        if (!existingFile) {
          state.subtitleFiles.push({
            videoId,
            title: `Video ${videoId}`,
            filename: '',
            srtContent: '',
            size: 0,
            status: 'pending'
          })
        } else {
          // Reset existing file status
          existingFile.status = 'pending'
          existingFile.progress = undefined
        }
      })
    },

    // Increment completed videos count
    incrementCompletedVideos: (state) => {
      state.completedVideosCount += 1
    },

    // Reset processing counters
    resetProcessingCounters: (state) => {
      state.totalVideosProcessing = 0
      state.completedVideosCount = 0
    },

    // Clip management actions
    addAvailableClip: (state, action: PayloadAction<AvailableClip>) => {
      const newClip = action.payload
      // Avoid duplicates by checking if clip with same id already exists
      const existingClip = state.availableClips.find(clip => clip.id === newClip.id)
      if (!existingClip) {
        state.availableClips.push(newClip)
      }
    },

    addMultipleAvailableClips: (state, action: PayloadAction<AvailableClip[]>) => {
      const newClips = action.payload
      newClips.forEach(newClip => {
        // Avoid duplicates by checking if clip with same id already exists
        const existingClip = state.availableClips.find(clip => clip.id === newClip.id)
        if (!existingClip) {
          state.availableClips.push(newClip)
        }
      })
    },

    removeAvailableClip: (state, action: PayloadAction<string>) => {
      const clipId = action.payload
      state.availableClips = state.availableClips.filter(clip => clip.id !== clipId)
    },

    clearAvailableClips: (state) => {
      state.availableClips = []
    },

    // Auto-populate clips from analysis results
    populateClipsFromAnalysis: (state) => {
      const newClips: AvailableClip[] = []
      
      // Extract clips from analysis results
      state.analysisResults.forEach(result => {
        const video = state.videos.find(v => v.id.videoId === result.videoId)
        const videoTitle = video?.snippet?.title || `Video ${result.videoId}`
        
        result.analysis.forEach((analysis, index) => {
          const clipId = `analysis-${result.videoId}-${index}-${Date.now()}`
          newClips.push({
            id: clipId,
            videoId: result.videoId,
            videoTitle,
            youtubeUrl: analysis.youtubeUrl || `https://youtube.com/watch?v=${result.videoId}`,
            startTime: analysis.timestamp,
            endTime: analysis.timestamp, // Use same timestamp as end if not provided
            description: analysis.summary,
            quote: analysis.keyQuotes?.[0] || analysis.relevantContent,
            significance: analysis.contextualInfo,
            source: 'analysis',
            confidence: analysis.confidence
          })
        })
      })

      // Extract clips from research summaries
      state.youtubeResearchSummaries.forEach(research => {
        research.videosSummary.videoSummaries.forEach(videoSummary => {
          // Add clips from detailed timestamps
          videoSummary.timestamps?.forEach((timestamp, index) => {
            const clipId = `research-${videoSummary.videoId}-${index}-${Date.now()}`
            newClips.push({
              id: clipId,
              videoId: videoSummary.videoId,
              videoTitle: videoSummary.title,
              youtubeUrl: `https://youtube.com/watch?v=${videoSummary.videoId}`,
              startTime: timestamp.startTime,
              endTime: timestamp.endTime,
              description: timestamp.description,
              quote: timestamp.quote,
              speaker: timestamp.speaker,
              significance: timestamp.significance,
              source: 'research'
            })
          })

          // Add clips from key quotes
          videoSummary.keyQuotes?.forEach((quote, index) => {
            const clipId = `quote-${videoSummary.videoId}-${index}-${Date.now()}`
            newClips.push({
              id: clipId,
              videoId: videoSummary.videoId,
              videoTitle: videoSummary.title,
              youtubeUrl: `https://youtube.com/watch?v=${videoSummary.videoId}`,
              startTime: quote.startTime,
              endTime: quote.endTime,
              description: quote.context,
              quote: quote.quote,
              speaker: quote.speaker,
              source: 'research'
            })
          })
        })
      })

      // Add new clips, avoiding duplicates
      newClips.forEach(newClip => {
        const existingClip = state.availableClips.find(clip => clip.id === newClip.id)
        if (!existingClip) {
          state.availableClips.push(newClip)
        }
      })
    },
  },
  extraReducers: (builder) => {
    // Search videos
    builder
      .addCase(searchVideos.pending, (state) => {
        state.searchLoading = true
        state.error = null
        state.videos = []
        state.selectedVideos = []
      })
      .addCase(searchVideos.fulfilled, (state, action) => {
        state.searchLoading = false
        state.videos = action.payload.videos
        state.searchInfo = action.payload.searchInfo
        state.error = null
      })
      .addCase(searchVideos.rejected, (state, action) => {
        state.searchLoading = false
        state.error = action.error.message || 'Network error occurred while searching'
      })
    
    // Generate subtitles
    builder
      .addCase(generateSubtitles.pending, (state) => {
        state.generatingSubtitles = true
        state.error = null
        // Initialize subtitle files with processing status
        state.subtitleFiles = []
      })
      .addCase(generateSubtitles.fulfilled, (state, action) => {
        state.generatingSubtitles = false
        state.subtitleFiles = action.payload
        state.error = null
      })
      .addCase(generateSubtitles.rejected, (state, action) => {
        state.generatingSubtitles = false
        state.error = action.error.message || 'Network error occurred while generating subtitles'
      })
    
    // Generate subtitles individually
    .addCase(generateSubtitlesIndividually.pending, (state) => {
      state.generatingSubtitles = true
      state.error = null
    })
    .addCase(generateSubtitlesIndividually.fulfilled, (state, action) => {
      state.generatingSubtitles = false
      state.error = null
      // Reset counters when done
      state.totalVideosProcessing = 0
      state.completedVideosCount = 0
    })
    .addCase(generateSubtitlesIndividually.rejected, (state, action) => {
      state.generatingSubtitles = false
      state.error = action.error.message || 'Network error occurred while generating subtitles individually'
      // Reset counters on error
      state.totalVideosProcessing = 0
      state.completedVideosCount = 0
    })
    
    // Analyze transcript
    builder
      .addCase(analyzeTranscript.pending, (state, action) => {
        const videoId = action.meta.arg.videoId
        state.analyzingTranscripts[videoId] = true
        state.error = null
      })
      .addCase(analyzeTranscript.fulfilled, (state, action) => {
        const videoId = action.payload.videoId
        state.analyzingTranscripts[videoId] = false
        
        // Remove any existing analysis for this video and query
        state.analysisResults = state.analysisResults.filter(
          result => !(result.videoId === videoId && result.query === action.payload.query)
        )
        
        // Add new analysis result
        state.analysisResults.push(action.payload)
        
        // Auto-populate clips from the new analysis
        const video = state.videos.find(v => v.id.videoId === videoId)
        const videoTitle = video?.snippet?.title || `Video ${videoId}`
        
        action.payload.analysis.forEach((analysis: any, index: number) => {
          const clipId = `analysis-${videoId}-${index}-${Date.now()}`
          const newClip: AvailableClip = {
            id: clipId,
            videoId,
            videoTitle,
            youtubeUrl: analysis.youtubeUrl || `https://youtube.com/watch?v=${videoId}`,
            startTime: analysis.timestamp,
            endTime: analysis.timestamp,
            description: analysis.summary,
            quote: analysis.keyQuotes?.[0] || analysis.relevantContent,
            significance: analysis.contextualInfo,
            source: 'analysis',
            confidence: analysis.confidence
          }
          
          // Add clip if it doesn't already exist
          const existingClip = state.availableClips.find(clip => clip.id === clipId)
          if (!existingClip) {
            state.availableClips.push(newClip)
          }
        })
        
        state.error = null
      })
      .addCase(analyzeTranscript.rejected, (state, action) => {
        const videoId = action.meta.arg.videoId
        state.analyzingTranscripts[videoId] = false
        state.error = action.error.message || 'Network error occurred while analyzing transcript'
      })
    
    // Summarize videos
    builder
      .addCase(summarizeVideos.pending, (state) => {
        state.summarizingVideos = true
        state.error = null
        state.videosSummary = null
      })
      .addCase(summarizeVideos.fulfilled, (state, action) => {
        state.summarizingVideos = false
        state.videosSummary = action.payload.summary
        // Add to YouTube research summaries
        state.youtubeResearchSummaries.push(action.payload.researchSummary)
        
        // Auto-populate clips from the new research summary
        action.payload.researchSummary.videosSummary.videoSummaries.forEach((videoSummary: any) => {
          // Add clips from detailed timestamps
          videoSummary.timestamps?.forEach((timestamp: any, index: number) => {
            const clipId = `research-${videoSummary.videoId}-${index}-${Date.now()}`
            const newClip: AvailableClip = {
              id: clipId,
              videoId: videoSummary.videoId,
              videoTitle: videoSummary.title,
              youtubeUrl: `https://youtube.com/watch?v=${videoSummary.videoId}`,
              startTime: timestamp.startTime,
              endTime: timestamp.endTime,
              description: timestamp.description,
              quote: timestamp.quote,
              speaker: timestamp.speaker,
              significance: timestamp.significance,
              source: 'research'
            }
            
            // Add clip if it doesn't already exist
            const existingClip = state.availableClips.find(clip => clip.id === clipId)
            if (!existingClip) {
              state.availableClips.push(newClip)
            }
          })

          // Add clips from key quotes
          videoSummary.keyQuotes?.forEach((quote: any, index: number) => {
            const clipId = `quote-${videoSummary.videoId}-${index}-${Date.now()}`
            const newClip: AvailableClip = {
              id: clipId,
              videoId: videoSummary.videoId,
              videoTitle: videoSummary.title,
              youtubeUrl: `https://youtube.com/watch?v=${videoSummary.videoId}`,
              startTime: quote.startTime,
              endTime: quote.endTime,
              description: quote.context,
              quote: quote.quote,
              speaker: quote.speaker,
              source: 'research'
            }
            
            // Add clip if it doesn't already exist
            const existingClip = state.availableClips.find(clip => clip.id === clipId)
            if (!existingClip) {
              state.availableClips.push(newClip)
            }
          })
        })
        
        state.error = null
      })
      .addCase(summarizeVideos.rejected, (state, action) => {
        state.summarizingVideos = false
        state.error = action.error.message || 'Network error occurred while summarizing videos'
      })
    
    // Google research
    builder
      .addCase(performGoogleResearch.pending, (state) => {
        state.error = null
      })
      .addCase(performGoogleResearch.fulfilled, (state, action) => {
        state.googleResearchSummaries.push(action.payload)
        state.error = null
      })
      .addCase(performGoogleResearch.rejected, (state, action) => {
        state.error = action.error.message || 'Network error occurred while performing Google research'
      })
  },
})

// Export actions
export const {
  setSearchQuery,
  setChannelUrl,
  setMaxResults,
  setSortOrder,
  toggleVideoSelection,
  selectAllVideos,
  deselectAllVideos,
  updateSubtitleStatus,
  updateSubtitleGenerationStatus,
  addSubtitleFile,
  setAnalysisQuery,
  clearAnalysisResults,
  clearVideosSummary,
  setPreviewContent,
  clearError,
  setError,
  resetSearchResults,
  resetSubtitleFiles,
  resetAnalysisResults,
  resetAll,
  addGoogleResearchSummary,
  addYouTubeResearchSummary,
  updateGoogleResearchSummary,
  updateYouTubeResearchSummary,
  removeGoogleResearchSummary,
  removeYouTubeResearchSummary,
  clearAllResearchSummaries,
  markGoogleResearchAsApplied,
  markYouTubeResearchAsApplied,
  markMultipleResearchAsApplied,
  initializeSubtitleFiles,
  incrementCompletedVideos,
  resetProcessingCounters,
  addAvailableClip,
  addMultipleAvailableClips,
  removeAvailableClip,
  clearAvailableClips,
  populateClipsFromAnalysis,
} = youtubeSlice.actions

// Export reducer
export default youtubeSlice.reducer

// Selectors (for easy access to state)
export const selectSearchForm = (state: { youtube: YouTubeState }) => ({
  searchQuery: state.youtube.searchQuery,
  channelUrl: state.youtube.channelUrl,
  maxResults: state.youtube.maxResults,
  sortOrder: state.youtube.sortOrder,
})

export const selectSearchResults = (state: { youtube: YouTubeState }) => ({
  videos: state.youtube.videos,
  searchInfo: state.youtube.searchInfo,
  selectedVideos: state.youtube.selectedVideos,
  searchLoading: state.youtube.searchLoading,
})

export const selectSubtitleGeneration = (state: { youtube: YouTubeState }) => ({
  subtitleFiles: state.youtube.subtitleFiles,
  generatingSubtitles: state.youtube.generatingSubtitles,
  totalVideosProcessing: state.youtube.totalVideosProcessing,
  completedVideosCount: state.youtube.completedVideosCount,
})

export const selectTranscriptAnalysis = (state: { youtube: YouTubeState }) => ({
  analysisResults: state.youtube.analysisResults,
  analyzingTranscripts: state.youtube.analyzingTranscripts,
  analysisQueries: state.youtube.analysisQueries,
})

export const selectPreviewModal = (state: { youtube: YouTubeState }) => ({
  previewContent: state.youtube.previewContent,
  previewTitle: state.youtube.previewTitle,
})

export const selectError = (state: { youtube: YouTubeState }) => state.youtube.error

export const selectVideoSummarization = (state: { youtube: YouTubeState }) => ({
  videosSummary: state.youtube.videosSummary,
  summarizingVideos: state.youtube.summarizingVideos,
})

export const selectResearchSummaries = (state: { youtube: YouTubeState }) => ({
  googleResearchSummaries: state.youtube.googleResearchSummaries,
  youtubeResearchSummaries: state.youtube.youtubeResearchSummaries,
})

export const selectAvailableClips = (state: { youtube: YouTubeState }) => state.youtube.availableClips 