import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPlayer } from '../components/audio/AudioPlayer';
import { vi } from 'vitest';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

// Mock the useAudioPlayer hook
vi.mock('../hooks/useAudioPlayer', () => ({
  useAudioPlayer: vi.fn().mockImplementation(() => ({
    waveformRef: { current: document.createElement('div') },
    isPlaying: false,
    togglePlayPause: vi.fn(),
    currentTime: 30,
    duration: 120,
    downloadAudio: vi.fn(),
  })),
}));

describe('AudioPlayer', () => {
  const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  const mockAudioUrl = 'http://example.com/audio.wav';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with audio blob', () => {
    render(<AudioPlayer audioBlob={mockAudioBlob} />);
    
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('0:30 / 2:00')).toBeInTheDocument();
    
    // Verify useAudioPlayer was called with correct params
    expect(useAudioPlayer).toHaveBeenCalledWith({ audioBlob: mockAudioBlob, audioUrl: null });
  });
  
  it('renders correctly with audio URL', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);
    
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    
    // Verify useAudioPlayer was called with correct params
    expect(useAudioPlayer).toHaveBeenCalledWith({ audioBlob: null, audioUrl: mockAudioUrl });
  });

  it('renders correctly without audio source', () => {
    // Update the mock to disable buttons when no audio source is provided
    (useAudioPlayer as jest.Mock).mockImplementationOnce(() => ({
      waveformRef: { current: document.createElement('div') },
      isPlaying: false,
      togglePlayPause: vi.fn(),
      currentTime: 0,
      duration: 0,
      downloadAudio: vi.fn(),
    }));
    
    render(<AudioPlayer />);
    
    const playButton = screen.getByText('Play');
    const downloadButton = screen.getByText('Download');
    
    expect(playButton).toBeDisabled();
    expect(downloadButton).toBeDisabled();
    expect(useAudioPlayer).toHaveBeenCalledWith({ audioBlob: null, audioUrl: null });
  });

  it('calls togglePlayPause when play button is clicked', () => {
    const mockTogglePlayPause = vi.fn();
    
    (useAudioPlayer as jest.Mock).mockImplementationOnce(() => ({
      waveformRef: { current: document.createElement('div') },
      isPlaying: false,
      togglePlayPause: mockTogglePlayPause,
      currentTime: 30,
      duration: 120,
      downloadAudio: vi.fn(),
    }));
    
    render(<AudioPlayer audioBlob={mockAudioBlob} />);
    
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    
    expect(mockTogglePlayPause).toHaveBeenCalled();
  });

  it('calls downloadAudio when download button is clicked', () => {
    const mockDownloadAudio = vi.fn();
    
    (useAudioPlayer as jest.Mock).mockImplementationOnce(() => ({
      waveformRef: { current: document.createElement('div') },
      isPlaying: false,
      togglePlayPause: vi.fn(),
      currentTime: 30,
      duration: 120,
      downloadAudio: mockDownloadAudio,
    }));
    
    render(<AudioPlayer audioBlob={mockAudioBlob} />);
    
    const downloadButton = screen.getByText('Download');
    fireEvent.click(downloadButton);
    
    expect(mockDownloadAudio).toHaveBeenCalled();
  });

  it('shows pause button when audio is playing', () => {
    (useAudioPlayer as jest.Mock).mockImplementationOnce(() => ({
      waveformRef: { current: document.createElement('div') },
      isPlaying: true,
      togglePlayPause: vi.fn(),
      currentTime: 30,
      duration: 120,
      downloadAudio: vi.fn(),
    }));
    
    render(<AudioPlayer audioBlob={mockAudioBlob} />);
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });
});