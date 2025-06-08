export interface SegmentTiming {
  duration: number
  startTime?: number
}

export interface CreateVideoRequestBody {
  audioUrl: string
  videoUrl: string
  subtitlesUrl?: string
  userId: string
  quality: 'hd' | 'sd'
  fontFamily?: string
  fontColor?: string
  fontSize?: number
  strokeWidth?: number
  videoDuration?: number
  audioDuration?: number
  loopCount?: number
}

export interface CreateVideoResponse {
  message?: string
  video_id?: string
  shotstack_id?: string
  error?: string
  details?: string
}

export interface VideoRecord {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_urls: string[] // This will be empty array for new workflow but kept for DB compatibility
  audio_url: string
  subtitles_url?: string | null
  final_video_url?: string | null
  thumbnail_url?: string | null
  shotstack_id?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
  metadata?: {
    type: 'traditional' | 'subtitles'
    total_duration: number
  }
}

export interface VideoGenerationSettings {
  videoQuality: 'hd' | 'sd'
  includeSubtitles: boolean
  fontFamily: string
  fontColor: string
  fontSize: number
  strokeWidth: number
}

export interface AudioUpload {
  audioUrl: string
  duration: number
  fileName: string
  originalFileName: string
  filePath: string
}

export interface VideoUpload {
  videoUrl: string
  fileName: string
  originalFileName: string
  filePath: string
  fileSize: number
}

export interface SubtitlesGeneration {
  subtitlesUrl: string
  message: string
}

export interface VideoProcessing {
  processedVideoUrl: string
  fileName: string
  filePath: string
  originalVideoDuration: number
  finalDuration: number
  loopCount: number
  quality: 'hd' | 'sd'
} 