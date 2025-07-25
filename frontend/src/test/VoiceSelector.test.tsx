import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceSelector } from '../components/voice/VoiceSelector';
import { Model } from '../types';

// Mock models for testing
const mockModels: Model[] = [
  {
    id: 'en_US-model1',
    name: 'English US - Model 1',
    speakers: [
      { id: 'speaker1', name: 'Speaker 1' },
      { id: 'speaker2', name: 'Speaker 2' }
    ],
    hasModelCard: true,
    hasDemo: true
  },
  {
    id: 'en_GB-model2',
    name: 'English GB - Model 2',
    speakers: [
      { id: 'speaker3', name: 'Speaker 3' }
    ],
    hasModelCard: false,
    hasDemo: false
  }
];

describe('VoiceSelector Component', () => {
  const mockOnModelChange = jest.fn();
  const mockOnSpeakerChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default props', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Check if the component renders with the correct selected model
    expect(screen.getByText('English US - Model 1')).toBeInTheDocument();
  });

  test('opens model dropdown when clicked', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Click the model dropdown button
    fireEvent.click(screen.getByText('English US - Model 1'));

    // Check if dropdown items are visible
    expect(screen.getByText('English GB - Model 2')).toBeInTheDocument();
  });

  test('filters models based on search term', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Enter search term
    const searchInput = screen.getByPlaceholderText('Search voices...');
    fireEvent.change(searchInput, { target: { value: 'GB' } });

    // Open dropdown
    fireEvent.click(screen.getByText('English US - Model 1'));

    // Only GB model should be visible
    expect(screen.getByText('English GB - Model 2')).toBeInTheDocument();
    expect(screen.queryByText('English US - Model 1')).not.toBeInTheDocument();
  });

  test('calls onModelChange when a model is selected', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByText('English US - Model 1'));

    // Select a different model
    fireEvent.click(screen.getByText('English GB - Model 2'));

    // Check if onModelChange was called with the correct model ID
    expect(mockOnModelChange).toHaveBeenCalledWith('en_GB-model2');
  });

  test('shows speaker dropdown for models with multiple speakers', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Check if speaker dropdown is visible for model with multiple speakers
    expect(screen.getByText('Speaker 1')).toBeInTheDocument();
  });

  test('shows preview button for models with demo', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[0].id}
        selectedSpeaker={mockModels[0].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Check if preview button is visible for model with demo
    expect(screen.getByText('Play Preview')).toBeInTheDocument();
  });

  test('does not show preview button for models without demo', () => {
    render(
      <VoiceSelector
        models={mockModels}
        selectedModel={mockModels[1].id}
        selectedSpeaker={mockModels[1].speakers[0].id}
        onModelChange={mockOnModelChange}
        onSpeakerChange={mockOnSpeakerChange}
      />
    );

    // Check if preview button is not visible for model without demo
    expect(screen.queryByText('Play Preview')).not.toBeInTheDocument();
  });
});