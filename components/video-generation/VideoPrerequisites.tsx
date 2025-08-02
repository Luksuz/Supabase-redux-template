'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { CheckCircle, ImageIcon, Volume2, Subtitles, Video } from 'lucide-react'
import { useAppSelector } from '@/lib/hooks'
import { getStoredVideosFromLocalStorage } from '@/utils/video-storage-utils'
import { useState, useEffect } from 'react'

interface VideoPrerequisitesProps {
  hasGeneratedImages: boolean
  imageSetsCount: number
  audioGeneration: any
}

export function VideoPrerequisites({ 
  hasGeneratedImages, 
  imageSetsCount, 
  audioGeneration 
}: VideoPrerequisitesProps) {
  const selectedVideoIds = useAppSelector(state => state.video.selectedVideosForGeneration)
  const [selectedVideosCount, setSelectedVideosCount] = useState(0)
  const [totalVideoDuration, setTotalVideoDuration] = useState(0)

  // Load selected videos details
  useEffect(() => {
    const storedVideos = getStoredVideosFromLocalStorage()
    const selectedVideos = storedVideos.filter(video => selectedVideoIds.includes(video.id))
    
    setSelectedVideosCount(selectedVideos.length)
    setTotalVideoDuration(selectedVideos.reduce((total, video) => total + video.duration, 0))
  }, [selectedVideoIds])

  const hasVideoContent = hasGeneratedImages || selectedVideosCount > 0

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Prerequisites Status
        </CardTitle>
        <CardDescription>
          Ensure all required components are ready for video generation. You need either images OR videos, plus audio.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Images Status */}
        <div className={`p-3 rounded-lg border ${
          hasGeneratedImages ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className={`h-4 w-4 ${
              hasGeneratedImages ? 'text-green-600' : 'text-gray-400'
            }`} />
            <span className="font-medium">Images</span>
          </div>
          <p className="text-sm text-gray-600">
            {imageSetsCount} images processed
            {hasGeneratedImages && (
              <span className="block">
                uploaded to Supabase
              </span>
            )}
          </p>
          {!hasGeneratedImages && selectedVideosCount === 0 && (
            <p className="text-xs text-orange-600 mt-1">Need images or videos</p>
          )}
        </div>

        {/* Videos Status */}
        <div className={`p-3 rounded-lg border ${
          selectedVideosCount > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Video className={`h-4 w-4 ${
              selectedVideosCount > 0 ? 'text-green-600' : 'text-gray-400'
            }`} />
            <span className="font-medium">Videos</span>
          </div>
          <p className="text-sm text-gray-600">
            {selectedVideosCount > 0 ? (
              <>
                {selectedVideosCount} video{selectedVideosCount !== 1 ? 's' : ''} selected
                <span className="block">
                  {totalVideoDuration}s total duration
                </span>
              </>
            ) : (
              'No videos selected'
            )}
          </p>
          {selectedVideosCount === 0 && !hasGeneratedImages && (
            <p className="text-xs text-orange-600 mt-1">Select videos from history</p>
          )}
        </div>

        {/* Audio Status */}
        <div className={`p-3 rounded-lg border ${audioGeneration?.audioUrl ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className={`h-4 w-4 ${audioGeneration?.audioUrl ? 'text-green-600' : 'text-orange-600'}`} />
            <span className="font-medium">Audio</span>
          </div>
          <p className="text-sm text-gray-600">
            {audioGeneration?.audioUrl ? (
              audioGeneration.duration ? 
                `${audioGeneration.duration.toFixed(1)}s audio ready` : 
                'Audio ready (duration unknown)'
            ) : 'No audio generated'}
          </p>
          {!audioGeneration?.audioUrl && (
            <p className="text-xs text-orange-600 mt-1">Generate audio first</p>
          )}
          {audioGeneration?.audioUrl && !audioGeneration.duration && (
            <p className="text-xs text-orange-600 mt-1">Duration missing - may need to regenerate audio</p>
          )}
        </div>

        {/* Subtitles Status */}
        <div className={`p-3 rounded-lg border ${audioGeneration?.subtitlesUrl ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Subtitles className={`h-4 w-4 ${audioGeneration?.subtitlesUrl ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="font-medium">Subtitles</span>
          </div>
          <p className="text-sm text-gray-600">
            {audioGeneration?.subtitlesUrl ? 'Subtitles available' : 'Optional subtitles'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 