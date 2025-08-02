'use client'

import { Card, CardContent } from '../ui/card'
import { VideoIcon } from 'lucide-react'

interface VideoEmptyStateProps {
  hasPrerequisites: boolean
  hasGeneratedImages: boolean
  selectedVideosCount: number
  audioGeneration: any
}

export function VideoEmptyState({ 
  hasPrerequisites, 
  hasGeneratedImages, 
  selectedVideosCount,
  audioGeneration 
}: VideoEmptyStateProps) {
  if (hasPrerequisites) {
    return null
  }

  return (
    <Card className="bg-gray-50 border border-gray-200">
      <CardContent className="pt-6 text-center py-12">
        <VideoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Create Videos</h3>
        <p className="text-gray-600 mb-4">
          Complete the prerequisite steps to generate professional videos
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          {!hasGeneratedImages && <div>1. Generate and select images in Image Generator</div>}
          {!audioGeneration?.audioUrl && <div>2. Generate audio from scripts</div>}
          <div>3. Configure video settings and generate</div>
        </div>
      </CardContent>
    </Card>
  )
} 