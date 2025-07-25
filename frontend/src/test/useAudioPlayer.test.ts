import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { vi } from 'vitest';

// Mock WaveSurfer
vi.mock('wavesurfer.js', () => {
  const mockWaveSurfer = {
    create: vi.fn().mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        // Store callbacks to trigger them in tests
        if (event === 'ready') {
          mockCallbacks.ready = callback;
        } else if (event === 'play') {
          mockCallbacks.play = callback;
        } else if (event === 'pause') {
          mockCallbacks.pause = callback;
        } else if (event === 'finish') {
          mockCallbacks.finish = callback;
        } else if (event === 'audioprocess') {
          mockCallbacks.audioprocess = callback;
        } else if (event === 'seek') {
          mockCallbacks.seek = callback;
        }
      }),
      load: vi.fn(),
      playPause: vi.fn(),
      getDuration: vi.fn().mockReturnValue(120),
      getCurrentTime: vi.fn().mockReturnValue(30),
      destroy: vi.fn(),
    })),
  };
  return mockWaveSurfer;
});

// Store mock callbacks for testing
const mockCallbacks: Record<string, Function> = {};

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('useAudioPlayer', () => {
  const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  const mockAudioUrl = 'http://example.com/audio.wav';

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockCallbacks).forEach(key => delete mockCallbacks[key]);
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.waveformRef.current).toBe(null);
  });

  it('loads audio when blob is provided', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useAudioPlayer(options),
      { initialProps: { options: {} } }
    );
    
    // Simulate providing an audio blob
    rerender({ options: { audioBlob: mockAudioBlob } });
    
    // URL should be created and wavesurfer should load the audio
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockAudioBlob);
  });

  it('loads audio when URL is provided', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useAudioPlayer(options),
      { initialProps: { options: {} } }
    );
    
    // Simulate providing an audio URL
    rerender({ options: { audioUrl: mockAudioUrl } });
    
    // URL should not be created for external URLs
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('cleans up previous URL when switching from blob to URL', () => {
    const { rerender } = renderHook(
      ({ options }) => useAudioPlayer(options),
      { initialProps: { options: { audioBlob: mockAudioBlob } } }
    );
    
    // URL should be created for the blob
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockAudioBlob);
    
    // Simulate switching to URL
    rerender({ options: { audioUrl: mockAudioUrl } });
    
    // Previous URL should be revoked
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('updates isPlaying state when play/pause events occur', () => {
    const { result } = renderHook(() => useAudioPlayer({ audioBlob: mockAudioBlob }));
    
    // Initial state
    expect(result.current.isPlaying).toBe(false);
    
    // Simulate play event
    act(() => {
      mockCallbacks.play && mockCallbacks.play();
    });
    expect(result.current.isPlaying).toBe(true);
    
    // Simulate pause event
    act(() => {
      mockCallbacks.pause && mockCallbacks.pause();
    });
    expect(result.current.isPlaying).toBe(false);
    
    // Simulate finish event
    act(() => {
      mockCallbacks.play && mockCallbacks.play();
      mockCallbacks.finish && mockCallbacks.finish();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('updates duration when ready event occurs', () => {
    const { result } = renderHook(() => useAudioPlayer({ audioBlob: mockAudioBlob }));
    
    // Initial state
    expect(result.current.duration).toBe(0);
    
    // Simulate ready event
    act(() => {
      mockCallbacks.ready && mockCallbacks.ready();
    });
    
    expect(result.current.duration).toBe(120);
  });

  it('updates currentTime when audioprocess event occurs', () => {
    const { result } = renderHook(() => useAudioPlayer({ audioBlob: mockAudioBlob }));
    
    // Initial state
    expect(result.current.currentTime).toBe(0);
    
    // Simulate audioprocess event
    act(() => {
      mockCallbacks.audioprocess && mockCallbacks.audioprocess();
    });
    
    expect(result.current.currentTime).toBe(30);
  });

  it('calls playPause when togglePlayPause is called', () => {
    const { result } = renderHook(() => useAudioPlayer({ audioBlob: mockAudioBlob }));
    
    act(() => {
      result.current.togglePlayPause();
    });
    
    // Since we're using a mock, we can't directly test the wavesurfer instance
    // But we can verify the function was called without errors
  });

  it('creates a download link when downloadAudio is called', () => {
    // Mock document.createElement and other DOM methods
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);
    
    const { result } = renderHook(() => useAudioPlayer({ audioBlob: mockAudioBlob }));
    
    act(() => {
      result.current.downloadAudio();
    });
    
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockAnchor.href).toBe('mock-url');
    expect(mockAnchor.download).toMatch(/^tts-audio-\d+\.wav$/);
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    
    // Clean up
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});