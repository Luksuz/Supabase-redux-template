import type { SubtitleFile } from '@/lib/features/youtube/youtubeSlice'

// Utility functions for YouTube components

export const formatTimestamp = (timestamp: string) => {
  // Convert from SRT format (HH:MM:SS,mmm) to display format
  return timestamp.replace(',', '.')
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

export const formatFileSize = (bytes: number) => {
  return (bytes / 1024).toFixed(2) + ' KB'
}

export const getSearchInfoText = (searchInfo: any) => {
  if (!searchInfo) return ''
  
  if (searchInfo.query && searchInfo.channelId) {
    return `"${searchInfo.query}" in channel (${searchInfo.channelId})`
  } else if (searchInfo.query) {
    return `"${searchInfo.query}" across YouTube`
  } else if (searchInfo.channelId) {
    return `recent videos from channel (${searchInfo.channelId})`
  }
  return ''
}

export const getStatusDisplay = (subtitleFile: { status: string }) => {
  const statusMessages: Record<string, string> = {
    pending: 'Pending',
    extracting: 'Extracting Subtitles',
    downloading: 'Downloading Audio',
    transcribing: 'Generating Subtitles',
    processing: 'Processing',
    completed: 'Completed',
    error: 'Error'
  }

  const statusColors: Record<string, string> = {
    pending: 'text-gray-600',
    extracting: 'text-blue-600',
    downloading: 'text-blue-600',
    transcribing: 'text-purple-600',
    processing: 'text-yellow-600',
    completed: 'text-green-600',
    error: 'text-red-600'
  }

  return {
    message: statusMessages[subtitleFile.status] || subtitleFile.status,
    color: statusColors[subtitleFile.status] || 'text-gray-600'
  }
}

export const getMethodIcon = (method?: string) => {
  // Note: This would need to be moved to a React component since it returns JSX
  // For now, just return the method name
  return method
}

export const downloadSRTFile = (subtitleFile: SubtitleFile) => {
  const blob = new Blob([subtitleFile.srtContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = subtitleFile.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Parse YouTube ISO 8601 duration format (PT4M13S) to seconds
export const parseDurationToSeconds = (duration: string): number => {
  if (!duration) return 0
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  return hours * 3600 + minutes * 60 + seconds
}

// Format seconds to human readable duration (e.g., "4:13", "1:23:45")
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
} 