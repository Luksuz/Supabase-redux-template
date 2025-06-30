// Text chunking utility for audio generation

export interface TextChunk {
  text: string
  chunkIndex: number
  startPosition: number
  endPosition: number
}

/**
 * Split text into chunks of maximum characters at word boundaries
 * @param text The input text to chunk
 * @param maxLength Maximum characters per chunk (default: 2000 for better API compatibility)
 * @returns Array of text chunks
 */
export function chunkTextByWords(text: string, maxLength: number = 2000): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // Clean and normalize text for better API compatibility
  const cleanedText = text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\r/g, '\n')             // Convert remaining \r to \n
    .replace(/\n{3,}/g, '\n\n')       // Reduce multiple newlines to max 2
    .replace(/\s{2,}/g, ' ')          // Reduce multiple spaces to single space
    .replace(/[^\x20-\x7E\n]/g, '')   // Remove non-printable ASCII characters except newlines
    .trim()

  const chunks: TextChunk[] = []
  const words = cleanedText.split(/\s+/)
  let currentChunk = ''
  let chunkIndex = 0
  let startPosition = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + word

    // If adding this word would exceed the limit, save current chunk and start new one
    if (potentialChunk.length > maxLength && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        chunkIndex,
        startPosition,
        endPosition: startPosition + currentChunk.length
      })
      
      chunkIndex++
      startPosition = startPosition + currentChunk.length + 1 // +1 for space
      currentChunk = word
    } else {
      currentChunk = potentialChunk
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      chunkIndex,
      startPosition,
      endPosition: startPosition + currentChunk.length
    })
  }

  console.log(`📝 Split text into ${chunks.length} chunks (max ${maxLength} chars each):`)
  chunks.forEach((chunk, index) => {
    console.log(`   Chunk ${index + 1}: ${chunk.text.length} chars - "${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}"`)
  })

  return chunks
}

/**
 * Calculate total estimated duration for text chunks
 * Assumes approximately 150 words per minute speaking rate
 * @param chunks Array of text chunks
 * @returns Estimated total duration in seconds
 */
export function estimateChunksDuration(chunks: TextChunk[]): number {
  const totalWords = chunks.reduce((sum, chunk) => {
    return sum + chunk.text.split(/\s+/).length
  }, 0)
  
  // Assuming 150 words per minute = 2.5 words per second
  const estimatedDuration = totalWords / 2.5
  
  console.log(`⏱️ Estimated total duration: ${estimatedDuration.toFixed(1)}s for ${totalWords} words`)
  return estimatedDuration
} 