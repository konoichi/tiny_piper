import React, { useState, useEffect, useCallback } from 'react';
import { Model, Speaker } from '../../types';

interface VoiceSelectorProps {
  models: Model[];
  selectedModel: string;
  selectedSpeaker: string;
  onModelChange: (modelId: string) => void;
  onSpeakerChange: (speakerId: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  modelError?: string;
  speakerError?: string;
  required?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  models,
  selectedModel,
  selectedSpeaker,
  onModelChange,
  onSpeakerChange,
  disabled = false,
  className = '',
  label = 'Voice',
  error,
  modelError,
  speakerError,
  required = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState<Model[]>(models);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSpeakerDropdownOpen, setIsSpeakerDropdownOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Get current model and speakers
  const currentModel = models.find(model => model.id === selectedModel);
  const speakers = currentModel?.speakers || [];

  // Filter models based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredModels(models);
      return;
    }

    const filtered = models.filter(model => 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.speakers.some(speaker => 
        speaker.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    
    setFilteredModels(filtered);
  }, [searchTerm, models]);

  // Handle model selection
  const handleModelSelect = useCallback((modelId: string) => {
    onModelChange(modelId);
    setIsModelDropdownOpen(false);
    
    // Select first speaker of the new model if current speaker doesn't exist in the new model
    const newModel = models.find(model => model.id === modelId);
    if (newModel) {
      const speakerExists = newModel.speakers.some(speaker => speaker.id === selectedSpeaker);
      if (!speakerExists && newModel.speakers.length > 0) {
        onSpeakerChange(newModel.speakers[0].id);
      }
    }
  }, [models, onModelChange, onSpeakerChange, selectedSpeaker]);

  // Handle speaker selection
  const handleSpeakerSelect = useCallback((speakerId: string) => {
    onSpeakerChange(speakerId);
    setIsSpeakerDropdownOpen(false);
  }, [onSpeakerChange]);

  // Handle preview playback
  const handlePreview = useCallback(async () => {
    if (!currentModel) return;
    
    try {
      if (isPlaying && audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        setIsPlaying(false);
        return;
      }
      
      // Construct demo URL
      const demoUrl = `/demo/${currentModel.id}${selectedSpeaker ? `?speaker_id=${selectedSpeaker}` : ''}`;
      
      // Create audio element if it doesn't exist
      const audio = audioElement || new Audio();
      audio.src = demoUrl;
      
      // Set up event handlers
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => {
        console.error('Error playing audio preview');
        setIsPlaying(false);
      };
      
      // Play audio
      await audio.play();
      setIsPlaying(true);
      setAudioElement(audio);
    } catch (error) {
      console.error('Failed to play preview:', error);
      setIsPlaying(false);
    }
  }, [currentModel, selectedSpeaker, isPlaying, audioElement]);

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.model-dropdown') && isModelDropdownOpen) {
        setIsModelDropdownOpen(false);
      }
      if (!target.closest('.speaker-dropdown') && isSpeakerDropdownOpen) {
        setIsSpeakerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen, isSpeakerDropdownOpen]);

  // Get current model and speaker names for display
  const currentModelName = currentModel?.name || 'Select model';
  const currentSpeaker = speakers.find(speaker => speaker.id === selectedSpeaker);
  const currentSpeakerName = currentSpeaker?.name || 'Default';

  const modelBorderClasses = modelError || error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500';
    
  const speakerBorderClasses = speakerError || error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor="voice-selector" className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex flex-col space-y-3">
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search voices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className={`block w-full rounded-md shadow-sm py-2 px-3 pr-10 border-gray-300 focus:border-primary-500 focus:ring-primary-500
              disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
              transition-colors focus:outline-none`}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Model dropdown */}
        <div className="relative model-dropdown">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            disabled={disabled}
            className={`flex justify-between items-center w-full rounded-md border ${modelBorderClasses} bg-white py-2 px-3 text-left shadow-sm focus:outline-none ${
              disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
            aria-haspopup="listbox"
            aria-expanded={isModelDropdownOpen}
          >
            <span className="block truncate">{currentModelName}</span>
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {isModelDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
              <ul className="py-1" role="listbox">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <li
                      key={model.id}
                      role="option"
                      className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 ${
                        model.id === selectedModel ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                      }`}
                      onClick={() => handleModelSelect(model.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-gray-500">
                          {model.speakers.length} {model.speakers.length === 1 ? 'speaker' : 'speakers'}
                        </span>
                      </div>
                      {model.id === selectedModel && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <svg className="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="py-2 px-3 text-gray-500 text-center">No models found</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Speaker dropdown (only show if model has multiple speakers) */}
        {speakers.length > 1 && (
          <div className="relative speaker-dropdown">
            <button
              type="button"
              onClick={() => setIsSpeakerDropdownOpen(!isSpeakerDropdownOpen)}
              disabled={disabled}
              className={`flex justify-between items-center w-full rounded-md border ${speakerBorderClasses} bg-white py-2 px-3 text-left shadow-sm focus:outline-none ${
                disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50'
              }`}
              aria-haspopup="listbox"
              aria-expanded={isSpeakerDropdownOpen}
            >
              <span className="block truncate">{currentSpeakerName}</span>
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {isSpeakerDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
                <ul className="py-1" role="listbox">
                  {speakers.map((speaker) => (
                    <li
                      key={speaker.id}
                      role="option"
                      className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 ${
                        speaker.id === selectedSpeaker ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                      }`}
                      onClick={() => handleSpeakerSelect(speaker.id)}
                    >
                      <span className="block truncate">{speaker.name}</span>
                      {speaker.id === selectedSpeaker && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <svg className="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Preview button (only show if model has demo) */}
        {currentModel?.hasDemo && (
          <button
            type="button"
            onClick={handlePreview}
            disabled={disabled || !currentModel}
            className={`flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm 
              ${isPlaying 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
              }
              disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
          >
            {isPlaying ? (
              <>
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop Preview
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Play Preview
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {modelError && !error && (
        <p className="mt-1 text-sm text-red-600">{modelError}</p>
      )}
      {speakerError && !error && !modelError && (
        <p className="mt-1 text-sm text-red-600">{speakerError}</p>
      )}
    </div>
  );
};