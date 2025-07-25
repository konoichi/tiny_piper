import { TTSRequest, TTSResponse } from '../types';

/**
 * Service for handling TTS API requests
 */
export const ttsService = {
  /**
   * Generate speech from text
   * @param request The TTS request parameters
   * @returns Promise with the TTS response
   */
  generateSpeech: async (request: TTSRequest): Promise<TTSResponse> => {
    try {
      const response = await fetch('/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to generate speech: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error instanceof Error 
        ? error 
        : new Error('An unknown error occurred while generating speech');
    }
  },

  /**
   * Fetch audio file as blob
   * @param url The URL of the audio file
   * @returns Promise with the audio blob
   */
  fetchAudioBlob: async (url: string): Promise<Blob> => {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error fetching audio blob:', error);
      throw error instanceof Error 
        ? error 
        : new Error('An unknown error occurred while fetching audio');
    }
  }
};