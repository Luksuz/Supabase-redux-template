// Helper function to remove YouTube timestamps from script content for audio generation
export function removeYouTubeTimestamps(scriptContent: string): string {
  // Remove YouTube links and timestamps in the format [[YT_LINK: url, timestamps]]
  const timestampRegex = /\[\[YT_LINK:[^\]]+\]\]/g
  return scriptContent.replace(timestampRegex, '').trim()
}

// Helper function to extract YouTube timestamps from script content
export function extractYouTubeTimestamps(scriptContent: string): Array<{
  url: string
  timestamps: string
}> {
  const timestampRegex = /\[\[YT_LINK:\s*([^,]+),\s*([^\]]+)\]\]/g
  const timestamps: Array<{ url: string; timestamps: string }> = []
  
  let match
  while ((match = timestampRegex.exec(scriptContent)) !== null) {
    timestamps.push({
      url: match[1].trim(),
      timestamps: match[2].trim()
    })
  }
  
  return timestamps
}

// Helper function to format YouTube links and timestamps for script insertion
export function formatYouTubeReference(url: string, timestamps?: string): string {
  if (timestamps) {
    return `[[YT_LINK: ${url}, ${timestamps}]]`
  }
  return `[[YT_LINK: ${url}]]`
}

// Helper function to validate YouTube URL format
export function isValidYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  return youtubeRegex.test(url)
} 

// YouTube-related utility functions

/**
 * Parse various timestamp formats and convert to total seconds
 * Supports formats: "HH:MM:SS", "MM:SS", "H:MM:SS", "HH:MM:SS,mmm" (SRT format)
 */
function parseTimestampToSeconds(timestamp: string): number {
  if (!timestamp || timestamp.trim() === '') return 0
  
  // Remove any milliseconds part (SRT format: HH:MM:SS,mmm)
  const timeOnly = timestamp.split(',')[0].trim()
  
  // Split by colon and parse numbers
  const parts = timeOnly.split(':').map(part => parseInt(part.trim(), 10))
  
  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts
    return (minutes * 60) + seconds
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts
    return (hours * 3600) + (minutes * 60) + seconds
  }
  
  // Invalid format, return 0
  console.warn(`Invalid timestamp format: ${timestamp}`)
  return 0
}

/**
 * Convert total seconds back to HH:MM:SS format
 */
function secondsToTimestamp(totalSeconds: number): string {
  // Ensure we don't go below 0
  const seconds = Math.max(0, totalSeconds)
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Extend timestamp range by adding buffer seconds before start and after end
 * @param startTime - Start timestamp in various formats (HH:MM:SS, MM:SS, etc.)
 * @param endTime - End timestamp in various formats (HH:MM:SS, MM:SS, etc.)
 * @param bufferSeconds - Seconds to add before start and after end (default: 3)
 * @returns Object with extended startTime and endTime in HH:MM:SS format
 */
export function extendTimestampRange(
  startTime: string, 
  endTime: string, 
  bufferSeconds: number = 3
): { startTime: string; endTime: string } {
  
  // Parse both timestamps to seconds
  const startSeconds = parseTimestampToSeconds(startTime)
  const endSeconds = parseTimestampToSeconds(endTime)
  
  // Add buffer (subtract from start, add to end)
  const extendedStartSeconds = Math.max(0, startSeconds - bufferSeconds)
  const extendedEndSeconds = endSeconds + bufferSeconds
  
  // Convert back to timestamp format
  const extendedStartTime = secondsToTimestamp(extendedStartSeconds)
  const extendedEndTime = secondsToTimestamp(extendedEndSeconds)
  
  console.log(`🎬 Extended timestamp: ${startTime}-${endTime} → ${extendedStartTime}-${extendedEndTime} (+${bufferSeconds}s buffer)`)
  
  return {
    startTime: extendedStartTime,
    endTime: extendedEndTime
  }
}

/**
 * Extend a single timestamp by buffer seconds (useful for single-point timestamps)
 * @param timestamp - Timestamp in various formats
 * @param bufferSeconds - Seconds to add/subtract for range (default: 3)
 * @returns Object with startTime (timestamp - buffer) and endTime (timestamp + buffer)
 */
export function createTimestampRange(
  timestamp: string, 
  bufferSeconds: number = 3
): { startTime: string; endTime: string } {
  
  const timestampSeconds = parseTimestampToSeconds(timestamp)
  
  // Create range around the timestamp
  const startSeconds = Math.max(0, timestampSeconds - bufferSeconds)
  const endSeconds = timestampSeconds + bufferSeconds
  
  const startTime = secondsToTimestamp(startSeconds)
  const endTime = secondsToTimestamp(endSeconds)
  
  console.log(`🎬 Created range from timestamp: ${timestamp} → ${startTime}-${endTime} (±${bufferSeconds}s)`)
  
  return {
    startTime,
    endTime
  }
}

/**
 * Validate if a timestamp string is in a supported format
 */
export function isValidTimestamp(timestamp: string): boolean {
  if (!timestamp || timestamp.trim() === '') return false
  
  // Check for supported formats: HH:MM:SS, MM:SS, HH:MM:SS,mmm
  const timestampRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}(,\d{3})?$/
  return timestampRegex.test(timestamp.trim())
}

/**
 * Get YouTube URL with timestamp parameters
 */
export function getYouTubeUrlWithTimestamp(videoId: string, startTime: string, endTime?: string): string {
  const baseUrl = `https://youtube.com/watch?v=${videoId}`
  
  // Convert start time to seconds for YouTube's t parameter
  const startSeconds = parseTimestampToSeconds(startTime)
  
  if (endTime) {
    const endSeconds = parseTimestampToSeconds(endTime)
    return `${baseUrl}&t=${startSeconds}s&end=${endSeconds}s`
  }
  
  return `${baseUrl}&t=${startSeconds}s`
} 