"use server";

import textToSpeech from '@google-cloud/text-to-speech';

// Configure the Text-to-Speech client
const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export interface GoogleVoice {
  name: string;
  languageCodes: string[];
  ssmlGender: 'SSML_VOICE_GENDER_UNSPECIFIED' | 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
}

/**
 * Lists available Google Cloud Text-to-Speech voices.
 * @returns A promise that resolves to an array of GoogleVoice objects.
 */
export async function listGoogleTtsVoices(): Promise<GoogleVoice[]> {
  try {
    const [result] = await client.listVoices({});
    const voices = result.voices;
    if (!voices) {
      return [];
    }
    return voices.map((voice: any) => ({
      name: voice.name || 'Unknown Name',
      languageCodes: voice.languageCodes || [],
      ssmlGender: voice.ssmlGender as GoogleVoice['ssmlGender'] || 'SSML_VOICE_GENDER_UNSPECIFIED',
      naturalSampleRateHertz: voice.naturalSampleRateHertz || 0,
    }));
  } catch (error) {
    console.error('Error listing Google TTS voices:', error);
    throw new Error('Failed to list Google TTS voices.');
  }
}

/**
 * Synthesizes speech using Google Cloud Text-to-Speech.
 * @param text The text to synthesize.
 * @param voiceName The name of the voice to use (e.g., "en-US-Wavenet-D").
 * @param languageCode The language code (e.g., "en-US").
 * @param ssmlGender The SSML gender ('MALE', 'FEMALE', 'NEUTRAL').
 * @returns A promise that resolves to the audio content as a Buffer.
 */
export async function synthesizeGoogleTts(
  text: string,
  voiceName: string,
  languageCode: string,
  // ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL', // Voice name is usually specific enough
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS' = 'MP3'
): Promise<Buffer> {
  try {
    const request = {
      input: { text: text },
      voice: { languageCode: languageCode, name: voiceName },
      audioConfig: { audioEncoding: audioEncoding },
    };

    const [response] = await client.synthesizeSpeech(request);
    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS.');
    }
    return Buffer.from(response.audioContent as Uint8Array);
  } catch (error) {
    console.error('Error synthesizing speech with Google TTS:', error);
    throw new Error('Failed to synthesize speech with Google TTS.');
  }
}

// export { client as googleTtsClient }; Commented out or removed 