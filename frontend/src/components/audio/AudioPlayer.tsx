import React from 'react';
import { Button } from '../common/Button';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

interface AudioPlayerProps {
  audioBlob?: Blob | null;
  audioUrl?: string | null;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioBlob = null, 
  audioUrl = null, 
  className = '' 
}) => {
  const {
    waveformRef,
    isPlaying,
    togglePlayPause,
    currentTime,
    duration,
    downloadAudio
  } = useAudioPlayer({ audioBlob, audioUrl });

  // Check if we have audio content
  const hasAudio = audioBlob !== null || audioUrl !== null;

  // Format time in MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="mb-4" ref={waveformRef} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={togglePlayPause}
            disabled={!hasAudio}
            variant="primary"
            size="md"
            icon={
              isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                </svg>
              )
            }
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          
          <span className="text-sm text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        <Button
          onClick={downloadAudio}
          disabled={!hasAudio}
          variant="outline"
          size="md"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
            </svg>
          }
        >
          Download
        </Button>
      </div>
    </div>
  );
};