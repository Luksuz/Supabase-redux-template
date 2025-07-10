'use client'

import React from 'react'
import { Loader2, Search, Brain, BarChart3, Zap, Users } from 'lucide-react'
import { AnalysisType } from './types'
import { Video, SubtitleFile } from '@/lib/features/youtube/youtubeSlice'

interface GlobalAnalysisSectionProps {
  selectedVideos: string[]
  videos: Video[]
  subtitleFiles: SubtitleFile[]
  onBulkAnalysis: (analysisType: AnalysisType, query: string) => void
  isAnalyzing: boolean
}

export const GlobalAnalysisSection: React.FC<GlobalAnalysisSectionProps> = ({
  selectedVideos,
  videos,
  subtitleFiles,
  onBulkAnalysis,
  isAnalyzing
}) => {
  const [analysisType, setAnalysisType] = React.useState<AnalysisType>('standard')
  const [query, setQuery] = React.useState('')

  // Calculate available videos for each analysis type
  const videosWithSubtitles = selectedVideos.filter(videoId => {
    const subtitleFile = subtitleFiles.find(sf => sf.videoId === videoId)
    return subtitleFile && subtitleFile.status === 'completed'
  })
  
  const videosForGemini = selectedVideos.filter(videoId => {
    return videos.find(v => v.id.videoId === videoId)
  })

  const canAnalyze = analysisType === 'standard' 
    ? videosWithSubtitles.length > 0 
    : videosForGemini.length > 0

  const availableCount = analysisType === 'standard' 
    ? videosWithSubtitles.length 
    : videosForGemini.length

  const getAnalysisTypeColor = (type: AnalysisType) => {
    return type === 'standard' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
  }

  const getAnalysisTypeTextColor = (type: AnalysisType) => {
    return type === 'standard' ? 'text-blue-800' : 'text-purple-800'
  }

  if (selectedVideos.length === 0) {
    return null
  }

  return (
    <div className={`p-6 rounded-lg border-2 transition-colors ${getAnalysisTypeColor(analysisType)} mb-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-bold text-xl flex items-center gap-2 ${getAnalysisTypeTextColor(analysisType)}`}>
          <Users className="h-6 w-6" />
          Bulk Analysis ({selectedVideos.length} videos selected)
        </h3>
        {analysisType === 'full' && (
          <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
            <Zap className="h-4 w-4" />
            Powered by Google Gemini
          </div>
        )}
      </div>
      
      {/* Analysis Type Selection */}
      <div className="mb-4 space-y-3">
        <label className={`block text-sm font-semibold ${getAnalysisTypeTextColor(analysisType)}`}>
          Choose Analysis Method:
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setAnalysisType('standard')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              analysisType === 'standard'
                ? 'border-blue-500 bg-blue-100 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-5 w-5" />
              <span className="font-medium">Bulk Transcript Analysis</span>
            </div>
            <p className="text-sm">
              Search through subtitles across all videos ({videosWithSubtitles.length} available)
            </p>
          </button>
          
          <button
            onClick={() => setAnalysisType('full')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              analysisType === 'full'
                ? 'border-purple-500 bg-purple-100 text-purple-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5" />
              <span className="font-medium">Bulk AI Analysis</span>
            </div>
            <p className="text-sm">
              Comprehensive AI analysis across all videos ({videosForGemini.length} available)
            </p>
          </button>
        </div>
      </div>
      
      {/* Query Input and Analyze Button */}
      <div className="space-y-3">
        <div>
          <label className={`block text-sm font-medium ${getAnalysisTypeTextColor(analysisType)} mb-2`}>
            {analysisType === 'standard' ? 'Search Query:' : 'Analysis Focus (Optional):'}
          </label>
          <input
            type="text"
            placeholder={analysisType === 'standard' 
              ? "Enter phrase or topic to search across all videos..." 
              : "Enter focus area for analysis across all videos..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              analysisType === 'standard'
                ? 'border-blue-300 focus:ring-blue-500 focus:border-blue-500'
                : 'border-purple-300 focus:ring-purple-500 focus:border-purple-500'
            }`}
            disabled={!canAnalyze}
          />
        </div>
        
        <button
          onClick={() => onBulkAnalysis(analysisType, query)}
          disabled={!canAnalyze || (analysisType === 'standard' && !query.trim()) || isAnalyzing}
          className={`w-full font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-3 ${
            analysisType === 'standard'
              ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
              : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white'
          } ${!canAnalyze || isAnalyzing ? 'cursor-not-allowed' : 'hover:scale-105'}`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              {analysisType === 'full' 
                ? `AI Analyzing ${availableCount} Videos...` 
                : `Analyzing ${availableCount} Transcripts...`
              }
            </>
          ) : (
            <>
              {analysisType === 'full' ? (
                <>
                  <Brain className="h-6 w-6" />
                  Start Bulk AI Analysis ({availableCount} videos)
                </>
              ) : (
                <>
                  <Search className="h-6 w-6" />
                  Start Bulk Transcript Analysis ({availableCount} videos)
                </>
              )}
            </>
          )}
        </button>
      </div>

      {/* Prerequisites Message */}
      {!canAnalyze && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            {analysisType === 'standard' 
              ? '⚠️ No videos with completed subtitles selected. Generate subtitles first.'
              : '⚠️ No videos available for AI analysis.'
            }
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 text-xs text-gray-600 bg-gray-50 p-3 rounded">
        <p>
          <strong>Bulk Analysis</strong> will process all selected videos and create a comprehensive research summary 
          that will be added to your Current Research tab. This is ideal for finding patterns and insights across 
          multiple videos.
        </p>
      </div>
    </div>
  )
} 