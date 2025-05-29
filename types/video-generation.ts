export interface SegmentTiming {
  duration: number
  startTime?: number
}

export interface CreateVideoRequestBody {
  imageUrls: string[]
  audioUrl: string
  subtitlesUrl?: string
  userId: string
  thumbnailUrl?: string
  segmentTimings?: SegmentTiming[]
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
  status: 'processing' | 'completed' | 'failed'
  shotstack_id: string
  image_urls: string[]
  audio_url: string
  subtitles_url?: string
  final_video_url?: string
  thumbnail_url: string
  error_message?: string
  created_at: string
  updated_at: string
  metadata?: {
    type?: 'segmented' | 'traditional' | 'script-based'
    segment_timings?: SegmentTiming[]
    total_duration?: number
    scenes_count?: number
  }
}

export interface VideoGenerationSettings {
  useSegmentedTiming: boolean
  useScriptBasedTiming: boolean
  videoQuality: 'hd' | 'sd'
  includeSubtitles: boolean
} 