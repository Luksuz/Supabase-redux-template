'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { CheckCircle, ImageIcon, Volume2, Subtitles } from 'lucide-react'

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
  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Prerequisites Status
        </CardTitle>
        <CardDescription>
          Ensure all required components are ready for video generation
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Images Status */}
        <div className={`p-3 rounded-lg border ${
          hasGeneratedImages ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className={`h-4 w-4 ${
              hasGeneratedImages ? 'text-green-600' : 'text-orange-600'
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
          {!hasGeneratedImages && (
            <p className="text-xs text-orange-600 mt-1">Process images first</p>
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