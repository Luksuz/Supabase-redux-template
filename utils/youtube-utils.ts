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