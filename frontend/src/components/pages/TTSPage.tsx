import React, { useState, useCallback, useEffect } from 'react';
import { TextInput } from '../text/TextInput';
import { VoiceSelector } from '../voice/VoiceSelector';
import { AudioPlayer } from '../audio/AudioPlayer';
import { HistoryList } from '../history/HistoryList';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { Alert } from '../common/Alert';
import { useTTS } from '../../hooks/useTTS';
import { useHistory } from '../../hooks/useHistory';
import { useModels } from '../../hooks/useModels';
import { useToastContext } from '../../contexts/ToastContext';
import { Model, Speaker, HistoryItem } from '../../types';
import { validateText, validateSelection, sanitizeText, createFormValidator } from '../../utils/validation';
import { ApiError, NetworkError } from '../../services/apiService';

export const TTSPage: React.FC = () => {
  // State
  const [text, setText] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    text?: string;
    model?: string;
    speaker?: string;
  }>({});
  
  // Fetch models using React Query
  const { models, isLoading: isLoadingModels, isError: isModelsError, error: modelsError } = useModels();
  
  // Hooks
  const { generateSpeech, isGenerating, progress, error, reset } = useTTS();
  const { 
    filteredItems, 
    filterText, 
    setFilterText, 
    addHistoryItem, 
    deleteHistoryItem, 
    clearHistory 
  } = useHistory();
  const { showSuccess, showError, showInfo } = useToastContext();
  
  // Create form validator using our validation utilities
  const formValidator = useCallback(() => {
    return createFormValidator({
      text: (value) => validateText(value, { 
        required: true, 
        maxLength: 1000,
        customValidator: (val) => {
          // Additional custom validation if needed
          return undefined;
        }
      }),
      model: (value) => validateSelection(value, { 
        required: true,
        customValidator: (val) => {
          // Validate that model exists in available models
          if (models.length > 0 && !models.some(m => m.id === val)) {
            return 'Please select a valid model';
          }
          return undefined;
        }
      }),
      speaker: (value) => validateSelection(value, { 
        required: true,
        customValidator: (val) => {
          // Validate that speaker exists in selected model
          const model = models.find(m => m.id === selectedModel);
          if (model && model.speakers.length > 0 && !model.speakers.some(s => s.id === val)) {
            return 'Please select a valid speaker';
          }
          return undefined;
        }
      })
    })({
      text,
      model: selectedModel,
      speaker: selectedSpeaker
    });
  }, [text, selectedModel, selectedSpeaker, models]);
  
  // Validate form
  const validateForm = useCallback(() => {
    const errors = formValidator();
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formValidator]);
  
  // Handle text change
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    // Clear validation error when user starts typing
    if (validationErrors.text) {
      setValidationErrors(prev => ({ ...prev, text: undefined }));
    }
  }, [validationErrors]);
  
  // Handle model change
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    
    // Reset speaker when model changes
    const model = models.find(m => m.id === modelId);
    if (model && model.speakers.length > 0) {
      setSelectedSpeaker(model.speakers[0].id);
    } else {
      setSelectedSpeaker('');
    }
    
    // Clear validation error when user selects a model
    if (validationErrors.model) {
      setValidationErrors(prev => ({ ...prev, model: undefined }));
    }
  }, [models, validationErrors]);
  
  // Handle speaker change
  const handleSpeakerChange = useCallback((speakerId: string) => {
    setSelectedSpeaker(speakerId);
    
    // Clear validation error when user selects a speaker
    if (validationErrors.speaker) {
      setValidationErrors(prev => ({ ...prev, speaker: undefined }));
    }
  }, [validationErrors]);
  
  // Handle generate speech
  const handleGenerateSpeech = useCallback(async () => {
    // Validate form before submitting
    if (!validateForm()) {
      showError('Please fix the errors in the form before generating speech');
      return;
    }
    
    try {
      reset();
      showInfo('Generating speech...');
      
      // Sanitize text input to prevent XSS
      const sanitizedText = sanitizeText(text);
      
      const blob = await generateSpeech({
        text: sanitizedText,
        model: selectedModel,
        speaker_id: selectedSpeaker
      });
      
      setAudioBlob(blob);
      
      // Get model and speaker names for history
      const model = models.find(m => m.id === selectedModel);
      const speaker = model?.speakers.find(s => s.id === selectedSpeaker);
      
      // Create audio URL for history
      const audioUrl = URL.createObjectURL(blob);
      
      // Add to history
      addHistoryItem(
        text,
        model?.name || selectedModel,
        speaker?.name || selectedSpeaker,
        audioUrl
      );
      
      showSuccess('Speech generated successfully!');
    } catch (err) {
      console.error('Failed to generate speech:', err);
      
      // Handle different error types
      if (err instanceof ApiError) {
        // API errors with status codes
        if (err.status === 429) {
          showError('Too many requests. Please try again later.');
        } else if (err.status === 400) {
          showError(`Invalid request: ${err.message}`);
        } else if (err.status === 404) {
          showError(`Model or speaker not found: ${err.message}`);
        } else if (err.status >= 500) {
          showError('Server error. Our team has been notified.');
        } else {
          showError(err.message);
        }
      } else if (err instanceof NetworkError) {
        // Network connectivity issues
        showError('Network error. Please check your connection and try again.');
      } else {
        // Generic error fallback
        showError(err instanceof Error ? err.message : 'Failed to generate speech. Please try again.');
      }
    }
  }, [text, selectedModel, selectedSpeaker, generateSpeech, reset, models, addHistoryItem, validateForm, showInfo, showSuccess, showError]);
  
  // Handle replay from history
  const handleReplayFromHistory = useCallback((item: HistoryItem) => {
    // Set text and model/speaker from history item
    setText(item.text);
    
    // Find model and speaker IDs from names
    const model = models.find(m => m.name === item.model);
    if (model) {
      setSelectedModel(model.id);
      
      const speaker = model.speakers.find(s => s.name === item.speaker);
      if (speaker) {
        setSelectedSpeaker(speaker.id);
      }
    }
    
    // Create a blob from the audio URL
    fetch(item.audioUrl)
      .then(response => response.blob())
      .then(blob => {
        setAudioBlob(blob);
        showInfo('Loaded audio from history');
      })
      .catch(err => {
        console.error('Failed to load audio from history:', err);
        showError('Failed to load audio from history');
      });
  }, [models, showInfo, showError]);
  
  // Show error toast when API error occurs
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);
  
  // Show error toast when models API error occurs
  useEffect(() => {
    if (isModelsError && modelsError) {
      showError(modelsError instanceof Error ? modelsError.message : 'Failed to load voice models');
    }
  }, [isModelsError, modelsError, showError]);
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <TextInput
            value={text}
            onChange={handleTextChange}
            maxLength={1000}
            placeholder="Enter text to convert to speech..."
            disabled={isGenerating}
            error={validationErrors.text}
          />
          
          {validationErrors.model && (
            <Alert variant="error">{validationErrors.model}</Alert>
          )}
          
          {isLoadingModels ? (
            <div className="flex items-center justify-center p-4 border rounded-md bg-gray-50">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-2"></div>
              <span>Loading voice models...</span>
            </div>
          ) : (
            <VoiceSelector
              models={models}
              selectedModel={selectedModel}
              selectedSpeaker={selectedSpeaker}
              onModelChange={handleModelChange}
              onSpeakerChange={handleSpeakerChange}
              disabled={isGenerating}
              modelError={validationErrors.model}
              speakerError={validationErrors.speaker}
            />
          )}
          
          <button
            onClick={handleGenerateSpeech}
            disabled={!text || !selectedModel || !selectedSpeaker || isGenerating}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Speech'}
          </button>
          
          {isGenerating && (
            <ProgressIndicator progress={progress} />
          )}
          
          {error && (
            <Alert variant="error" title="Error Generating Speech">
              {error}
            </Alert>
          )}
          
          {audioBlob && !isGenerating && (
            <AudioPlayer audioBlob={audioBlob} />
          )}
        </div>
        
        <div>
          <HistoryList
            items={filteredItems}
            filterText={filterText}
            onFilterChange={setFilterText}
            onReplay={handleReplayFromHistory}
            onDelete={deleteHistoryItem}
            onClear={clearHistory}
          />
        </div>
      </div>
    </div>
  );
};