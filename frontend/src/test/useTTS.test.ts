import { renderHook, act } from '@testing-library/react';
import { useTTS } from '../hooks/useTTS';
import { ttsService } from '../services/ttsService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the ttsService
vi.mock('../services/ttsService', () => ({
  ttsService: {
    generateSpeech: vi.fn(),
    fetchAudioBlob: vi.fn()
  }
}));

describe('useTTS Hook', () => {
  const mockTTSResponse = {
    audio_url: '/audio/test.wav',
    duration: 2.5,
    format: 'wav'
  };
  
  const mockAudioBlob = new Blob(['audio-data'], { type: 'audio/wav' });
  
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    
    // Setup mock implementations
    (ttsService.generateSpeech as any).mockResolvedValue(mockTTSResponse);
    (ttsService.fetchAudioBlob as any).mockResolvedValue(mockAudioBlob);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('initializes with default values', () => {
    const { result } = renderHook(() => useTTS());
    
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });
  
  it('generates speech successfully', async () => {
    const { result } = renderHook(() => useTTS());
    
    const request = {
      text: 'Hello world',
      model: 'en_US-model1',
      speaker_id: 'speaker1'
    };
    
    let audioBlob: Blob | undefined;
    
    await act(async () => {
      const promise = result.current.generateSpeech(request);
      
      // Fast-forward timers to simulate progress
      vi.advanceTimersByTime(1000);
      
      audioBlob = await promise;
    });
    
    expect(ttsService.generateSpeech).toHaveBeenCalledWith(request);
    expect(ttsService.fetchAudioBlob).toHaveBeenCalledWith(mockTTSResponse.audio_url);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.error).toBeNull();
    expect(audioBlob).toBe(mockAudioBlob);
  });
  
  it('handles errors during speech generation', async () => {
    const errorMessage = 'API error';
    (ttsService.generateSpeech as any).mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() => useTTS());
    
    const request = {
      text: 'Hello world',
      model: 'en_US-model1',
      speaker_id: 'speaker1'
    };
    
    await act(async () => {
      try {
        await result.current.generateSpeech(request);
      } catch (error) {
        // Expected error
      }
    });
    
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBe(errorMessage);
  });
  
  it('resets state correctly', async () => {
    const { result } = renderHook(() => useTTS());
    
    // First set some state
    await act(async () => {
      try {
        (ttsService.generateSpeech as any).mockRejectedValue(new Error('Test error'));
        await result.current.generateSpeech({
          text: 'Hello',
          model: 'test',
          speaker_id: 'test'
        });
      } catch (error) {
        // Expected error
      }
    });
    
    expect(result.current.error).not.toBeNull();
    
    // Reset the state
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });
  
  it('simulates progress during generation', async () => {
    const { result } = renderHook(() => useTTS());
    
    act(() => {
      result.current.generateSpeech({
        text: 'Hello world',
        model: 'en_US-model1',
        speaker_id: 'speaker1'
      }).catch(() => {});
    });
    
    // Initial state
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.progress).toBe(0);
    
    // After some time, progress should increase
    act(() => {
      vi.advanceTimersByTime(500); // 500ms
    });
    
    expect(result.current.progress).toBeGreaterThan(0);
    expect(result.current.progress).toBeLessThan(100);
    
    // Complete the request
    await act(async () => {
      vi.runAllTimers();
    });
    
    expect(result.current.progress).toBe(100);
  });
});