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
}

// Subtitle File interface
export interface SubtitleFile {
  videoId: string
  title: string
  filename: string
  srtContent: string
  size: number
  status: 'processing' | 'completed' | 'error' | 'downloading' | 'transcribing' | 'extracting'
  progress?: string
  method?: 'yt-dlp' | 'whisper'
}

// Transcript Analysis interface
export interface TranscriptAnalysis {
  timestamp: string
  summary: string
  relevantContent: string
  confidence: number
  youtubeUrl?: string
}

// Analysis Result interface
export interface AnalysisResult {
  videoId: string
  query: string
  analysis: TranscriptAnalysis
  timestamp: string
  usingMock?: boolean
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
  timestamp?: string
  narrativeElements: string[]
  emotionalTone: string
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
  
  // Transcript analysis
  analysisResults: AnalysisResult[]
  analyzingTranscripts: Record<string, boolean> // videoId -> isAnalyzing
  analysisQueries: Record<string, string> // videoId -> current query
  
  // Video summarization
  videosSummary: VideosSummary | null
  summarizingVideos: boolean
  
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
  
  // Transcript analysis
  analysisResults: [],
  analyzingTranscripts: {},
  analysisQueries: {},
  
  // Video summarization
  videosSummary: null,
  summarizingVideos: false,
  
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
    const response = await fetch('http://localhost:3001/extract-multiple', {
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

// Updated async thunk for generating subtitles with yt-dlp first, then fallback
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

    return {
      videoId: params.videoId,
      query: params.query,
      analysis: data.analysis,
      timestamp: new Date().toISOString(),
      usingMock: data.usingMock
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
      videoCount: videosWithSubtitles.length
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
        state.selectedVideos.splice(index, 1)
      } else {
        state.selectedVideos.push(videoId)
      }
    },
    
    selectAllVideos: (state) => {
      state.selectedVideos = state.videos.map(v => v.id.videoId)
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
        state.error = null
      })
      .addCase(summarizeVideos.rejected, (state, action) => {
        state.summarizingVideos = false
        state.error = action.error.message || 'Network error occurred while summarizing videos'
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