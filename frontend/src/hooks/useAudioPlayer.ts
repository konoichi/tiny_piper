import { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface UseAudioPlayerResult {
  waveformRef: React.RefObject<HTMLDivElement>;
  isPlaying: boolean;
  togglePlayPause: () => void;
  currentTime: number;
  duration: number;
  downloadAudio: () => void;
}

interface UseAudioPlayerOptions {
  audioBlob?: Blob | null;
  audioUrl?: string | null;
}

/**
 * Hook for managing audio playback with waveform visualization
 * @param options The audio source options (blob or URL)
 * @returns Audio player state and controls
 */
export const useAudioPlayer = (options: UseAudioPlayerOptions = {}): UseAudioPlayerResult => {
  const { audioBlob = null, audioUrl: externalAudioUrl = null } = options;
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioUrlRef = useRef<string | null>(null);
  const isExternalUrl = useRef<boolean>(false);

  // Initialize WaveSurfer when component mounts
  useEffect(() => {
    if (waveformRef.current) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4f46e5', // primary color
        progressColor: '#312e81', // darker primary
        cursorColor: '#6366f1', // lighter primary
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 80,
        barGap: 2,
        responsive: true,
      });

      // Set up event listeners
      wavesurfer.on('ready', () => {
        setDuration(Math.floor(wavesurfer.getDuration()));
      });

      wavesurfer.on('audioprocess', () => {
        setCurrentTime(Math.floor(wavesurfer.getCurrentTime()));
      });

      wavesurfer.on('seek', () => {
        setCurrentTime(Math.floor(wavesurfer.getCurrentTime()));
      });

      wavesurfer.on('play', () => {
        setIsPlaying(true);
      });

      wavesurfer.on('pause', () => {
        setIsPlaying(false);
      });

      wavesurfer.on('finish', () => {
        setIsPlaying(false);
      });

      wavesurferRef.current = wavesurfer;

      return () => {
        wavesurfer.destroy();
      };
    }
  }, []);

  // Clean up function to revoke object URLs
  const cleanupUrl = () => {
    if (audioUrlRef.current && !isExternalUrl.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  // Load audio when blob changes
  useEffect(() => {
    if (audioBlob && wavesurferRef.current) {
      // Clean up previous URL
      cleanupUrl();

      // Create new URL for the blob
      audioUrlRef.current = URL.createObjectURL(audioBlob);
      isExternalUrl.current = false;
      
      // Load audio
      wavesurferRef.current.load(audioUrlRef.current);
    }

    // Cleanup function to revoke URL when component unmounts
    return cleanupUrl;
  }, [audioBlob]);

  // Load audio when URL changes
  useEffect(() => {
    if (externalAudioUrl && wavesurferRef.current) {
      // Clean up previous URL if it was created internally
      cleanupUrl();

      // Use the external URL
      audioUrlRef.current = externalAudioUrl;
      isExternalUrl.current = true;
      
      // Load audio
      wavesurferRef.current.load(externalAudioUrl);
    }
  }, [externalAudioUrl]);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  // Download audio
  const downloadAudio = () => {
    if (audioUrlRef.current) {
      const a = document.createElement('a');
      a.href = audioUrlRef.current;
      a.download = `tts-audio-${new Date().getTime()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return {
    waveformRef,
    isPlaying,
    togglePlayPause,
    currentTime,
    duration,
    downloadAudio
  };
};