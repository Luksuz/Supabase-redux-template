// Murf.ai API utilities
export interface MurfVoice {
  description: string
  displayName: string
  gender: 'Male' | 'Female'
  locale: string
  supportedLocales: Record<string, {
    availableStyles: string[]
    detail: string
  }>
  voiceId: string
  accent: string
  availableStyles: string[]
  displayLanguage: string
}

export interface MurfAudioResponse {
  audioFile: string
}

// Fetch available voices from Murf.ai
export async function fetchMurfVoices(): Promise<MurfVoice[]> {
  try {
    const response = await fetch('https://api.murf.ai/v1/speech/voices', {
      method: 'GET',
      headers: {
        'api-key': process.env.MURF_API_KEY || ''
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Murf voices: ${response.status}`)
    }

    const voices = await response.json()
    return voices as MurfVoice[]
  } catch (error) {
    console.error('Error fetching Murf voices:', error)
    return []
  }
}

// Generate audio using Murf.ai API
export async function generateMurfAudio(text: string, voiceId: string): Promise<MurfAudioResponse> {
  const data = {
    text: text,
    voiceId: voiceId,
  }

  const response = await fetch("https://api.murf.ai/v1/speech/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": process.env.MURF_API_KEY || ''
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Murf.ai API request failed with status ${response.status}: ${JSON.stringify(errorData)}`
    )
  }

  const result = await response.json()
  return result as MurfAudioResponse
}

// Check if Murf.ai API key is configured
export function isMurfConfigured(): boolean {
  return !!process.env.MURF_API_KEY
} 