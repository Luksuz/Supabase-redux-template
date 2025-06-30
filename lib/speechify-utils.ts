// Speechify API utilities

import { SpeechifyClient } from "@speechify/api";

// Check if Speechify API key is configured
export function isSpeechifyConfigured(): boolean {
  return !!process.env.SPEECHIFY_API_KEY;
}

export interface SpeechifyVoice {
  id: string
  displayName: string
  gender: 'male' | 'female'
  locale: string
  type: 'shared' | 'premium'
  avatarImage?: string
  previewAudio?: string
  tags?: string[]
  models: Array<{
    name: string
    languages: Array<{
      locale: string
    }>
  }>
}

export interface SpeechifyAudioResponse {
  audioData: string // Base64 encoded audio
  audioFormat: string
  billableCharactersCount: number
  speechMarks?: {
    chunks: any[]
    end: number
    endTime: number
    start: number
    startTime: number
    type: string
    value: string
  }
}

// Fetch available voices from Speechify using the SpeechifyClient
export async function fetchSpeechifyVoices(): Promise<SpeechifyVoice[]> {
  if (!isSpeechifyConfigured()) {
    console.error('Speechify API key not configured');
    return [];
  }

  try {
    console.log('🎤 Fetching Speechify voices...');
    
    const speechClient = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY! });
    const voices = await speechClient.tts.voices.list();
    
    console.log('🎤 Speechify voices response:', {
      count: Array.isArray(voices) ? voices.length : 0,
      isArray: Array.isArray(voices),
      firstVoice: Array.isArray(voices) && voices.length > 0 ? {
        id: voices[0]?.id,
        displayName: voices[0]?.displayName,
        hasRequiredFields: !!(voices[0]?.id && voices[0]?.displayName)
      } : null
    });

    if (!voices || !Array.isArray(voices)) {
      console.error('Speechify API returned invalid voices format:', voices);
      throw new Error('Invalid voices response format from Speechify API');
    }

    // Validate voice objects
    const validVoices = voices.filter((voice: any) => {
      const isValid = voice && 
                     typeof voice.id === 'string' && 
                     typeof voice.displayName === 'string' &&
                     voice.id.length > 0 &&
                     voice.displayName.length > 0;
      
      if (!isValid) {
        console.warn('Invalid Speechify voice object:', voice);
      }
      return isValid;
    });

    console.log(`✅ Speechify: Found ${validVoices.length} valid voices out of ${voices.length} total`);
    
    return validVoices as SpeechifyVoice[];
  } catch (error: any) {
    console.error('❌ Error fetching Speechify voices:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      console.error('Speechify API key appears to be invalid');
    } else if (error.message?.includes('403') || error.message?.includes('forbidden')) {
      console.error('Speechify API access forbidden - check permissions');
    } else if (error.message?.includes('429')) {
      console.error('Speechify API rate limit exceeded');
    }
    
    return [];
  }
}

// Preprocess text for Speechify compatibility
function preprocessTextForSpeechify(text: string): string {
  return text
    .replace(/\r\n/g, '\n')                    // Normalize line endings
    .replace(/\r/g, '\n')                      // Convert remaining \r to \n
    .replace(/\n{3,}/g, '\n\n')                // Reduce multiple newlines
    .replace(/\s{2,}/g, ' ')                   // Reduce multiple spaces
    .replace(/[^\x20-\x7E\n\u00C0-\u017F]/g, '') // Keep only printable ASCII + Latin-1
    .replace(/["""'']/g, '"')                  // Normalize quotes
    .replace(/[–—]/g, '-')                     // Normalize dashes
    .replace(/…/g, '...')                      // Replace ellipsis
    .trim()
}

// Generate audio using Speechify API via SpeechifyClient
export async function generateSpeechifyAudio(
  text: string,
  voiceId: string,
  retryCount: number = 0
): Promise<SpeechifyAudioResponse> {
  if (!isSpeechifyConfigured()) {
    throw new Error('Speechify API key not configured');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for Speechify audio generation');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required for Speechify audio generation');
  }

  // Preprocess text for better compatibility
  const processedText = preprocessTextForSpeechify(text);
  
  if (processedText.length === 0) {
    throw new Error('Text became empty after preprocessing - contains unsupported characters');
  }

  if (processedText.length > 2000) {
    throw new Error(`Text too long for Speechify: ${processedText.length} characters (max 2000)`);
  }

  try {
    console.log(`🎤 Speechify: Generating audio for ${processedText.length} characters with voice ${voiceId}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
    
    const speechClient = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY! });
    const result = await speechClient.tts.audio.speech({
      input: processedText,
      voiceId: voiceId,
    });
    
    console.log('🎤 Speechify API Response received:', {
      hasAudioData: !!(result as any)?.audioData,
      audioFormat: (result as any)?.audioFormat,
      billableCharacters: (result as any)?.billableCharactersCount,
      responseKeys: Object.keys(result || {})
    });

    // Validate response
    const response = result as any;
    if (!response) {
      throw new Error('Empty response from Speechify API');
    }

    if (!response.audioData) {
      console.error('Speechify API response missing audioData:', response);
      throw new Error('Speechify API response missing audio data. Check API key permissions.');
    }

    if (typeof response.audioData !== 'string') {
      throw new Error('Speechify API returned invalid audio data format');
    }

    // Validate base64 format
    try {
      const buffer = Buffer.from(response.audioData, 'base64');
      if (buffer.length === 0) {
        throw new Error('Empty audio buffer');
      }
    } catch (base64Error) {
      throw new Error('Speechify API returned invalid base64 audio data');
    }

    const validatedResponse: SpeechifyAudioResponse = {
      audioData: response.audioData,
      audioFormat: response.audioFormat || 'wav',
      billableCharactersCount: response.billableCharactersCount || processedText.length,
      speechMarks: response.speechMarks
    };

    console.log(`✅ Speechify audio generated successfully: ${validatedResponse.audioFormat}, ${validatedResponse.billableCharactersCount} billable chars`);
    
    return validatedResponse;
  } catch (error: any) {
    console.error('❌ Speechify API error:', error);
    
    // Handle specific error types with retry logic
    const isRetryableError = (
      error.message?.includes('BadRequestError') ||
      error.message?.includes('400') ||
      error.message?.includes('500') ||
      error.message?.includes('timeout')
    ) && retryCount < 2;
    
    if (isRetryableError) {
      console.log(`🔄 Retrying Speechify request (attempt ${retryCount + 1}/3) after error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000)); // Progressive delay
      return generateSpeechifyAudio(text, voiceId, retryCount + 1);
    }
    
    // Provide more specific error messages
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      throw new Error('Speechify API key is invalid or expired. Please check your API key configuration.');
    }
    
    if (error.message?.includes('403') || error.message?.includes('forbidden')) {
      throw new Error('Speechify API access forbidden. Check your API key permissions.');
    }
    
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error('Speechify API rate limit exceeded. Please try again later.');
    }
    
    if (error.message?.includes('400') || error.message?.includes('BadRequestError')) {
      throw new Error(`Speechify rejected the text content. Try shorter text or check for special characters. Original error: ${error.message}`);
    }
    
    if (error.message?.includes('timeout')) {
      throw new Error('Speechify API request timed out. Please try again.');
    }

    throw new Error(`Speechify API request failed: ${error.message}`);
  }
}