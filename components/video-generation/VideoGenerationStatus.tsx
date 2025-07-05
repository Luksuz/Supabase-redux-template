'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { VideoIcon, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { VideoRecord } from '@/types/video-generation'

interface VideoGenerationStatusProps {
  currentGeneration: VideoRecord | null
  onDownloadVideo: (videoUrl: string, filename: string) => void
}

export function VideoGenerationStatus({ 
  currentGeneration, 
  onDownloadVideo 
}: VideoGenerationStatusProps) {
  if (!currentGeneration) {
    return null
  }

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="h-5 w-5" />
          Current Video Generation
        </CardTitle>
        <CardDescription>
          Generated on {new Date(currentGeneration.created_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generation Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <p className="font-medium">{currentGeneration.metadata?.type || 'traditional'}</p>
          </div>
          <div>
            <span className="text-gray-500">Images:</span>
            <p className="font-medium">{currentGeneration.image_urls.length}</p>
          </div>
          <div>
            <span className="text-gray-500">Duration:</span>
            <p className="font-medium">
              {currentGeneration.metadata?.total_duration?.toFixed(1) || 'Unknown'}s
            </p>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <Badge 
              variant={currentGeneration.status === 'completed' ? 'default' : 'secondary'}
              className={
                currentGeneration.status === 'completed' ? 'bg-green-100 text-green-800' :
                currentGeneration.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }
            >
              {currentGeneration.status}
            </Badge>
          </div>
        </div>

        {/* Processing Status */}
        {currentGeneration.status === 'processing' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-800">Video is being processed by Shotstack</span>
            </div>
            <p className="text-sm text-blue-700">
              This may take several minutes depending on video length and complexity. The page will update automatically when complete.
            </p>
          </div>
        )}

        {/* Completed Video */}
        {currentGeneration.status === 'completed' && currentGeneration.final_video_url && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Video Generated Successfully!</span>
            </div>
            <video controls className="w-full mb-3 rounded">
              <source src={currentGeneration.final_video_url} type="video/mp4" />
              Your browser does not support the video element.
            </video>
            <Button
              onClick={() => onDownloadVideo(currentGeneration.final_video_url!, `video-${currentGeneration.id}.mp4`)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Video
            </Button>
          </div>
        )}

        {/* Error */}
        {currentGeneration.status === 'failed' && currentGeneration.error_message && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800">Generation Error:</span>
            </div>
            <p className="text-red-700 mt-1">{currentGeneration.error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 