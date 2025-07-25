import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { TTSRequest, TTSResponse } from '../types';

interface UseTTSResult {
  generateSpeech: (request: TTSRequest) => Promise<Blob>;
  isGenerating: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for managing TTS generation state with React Query
 */
export const useTTS = (): UseTTSResult => {
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Use React Query mutation for TTS generation
  const mutation = useMutation<TTSResponse, Error, TTSRequest>({
    mutationFn: (request: TTSRequest) => apiService.generateSpeech(request),
    retry: 2,
    onError: (err) => {
      setError(err.message || 'An unknown error occurred');
    }
  });

  /**
   * Reset the TTS state
   */
  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
  }, []);

  /**
   * Generate speech from text
   * @param request The TTS request parameters
   * @returns Promise with the audio blob
   */
  const generateSpeech = useCallback(async (request: TTSRequest): Promise<Blob> => {
    reset();
    setProgress(0);
    
    try {
      // Start progress simulation
      const progressInterval = simulateProgress(setProgress);
      
      // Generate speech using React Query mutation
      const response = await mutation.mutateAsync(request);
      
      // Fetch audio blob
      const audioBlob = await apiService.fetchAudioBlob(response.audio_url);
      
      // Complete progress
      clearInterval(progressInterval);
      setProgress(100);
      
      return audioBlob;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      throw err;
    }
  }, [mutation, reset]);

  return {
    generateSpeech,
    isGenerating: mutation.isPending,
    progress,
    error: error || (mutation.error?.message || null),
    reset
  };
};

/**
 * Simulate progress for better UX during TTS generation
 * @param setProgress Function to update progress state
 * @returns Interval ID for cleanup
 */
function simulateProgress(setProgress: (progress: number) => void): NodeJS.Timeout {
  let currentProgress = 0;
  
  // Update progress every 100ms
  return setInterval(() => {
    // Progress simulation logic:
    // - Fast initial progress up to 70%
    // - Slower progress from 70% to 90%
    // - Last 10% reserved for actual completion
    if (currentProgress < 70) {
      currentProgress += 2;
    } else if (currentProgress < 90) {
      currentProgress += 0.5;
    }
    
    if (currentProgress > 90) {
      currentProgress = 90;
    }
    
    setProgress(currentProgress);
  }, 100);
}