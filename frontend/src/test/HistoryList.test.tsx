import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryList } from '../components/history/HistoryList';
import { vi } from 'vitest';

describe('HistoryList', () => {
  const mockHistoryItems = [
    {
      id: '1',
      text: 'Hello world',
      model: 'en_US-model',
      speaker: 'speaker1',
      timestamp: 1626912000000,
      audioUrl: 'audio-url-1',
    },
    {
      id: '2',
      text: 'Testing history',
      model: 'en_GB-model',
      speaker: 'speaker2',
      timestamp: 1626912100000,
      audioUrl: 'audio-url-2',
    },
  ];

  const mockHandlers = {
    onFilterChange: vi.fn(),
    onReplay: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders history items correctly', () => {
    render(
      <HistoryList
        items={mockHistoryItems}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Testing history')).toBeInTheDocument();
    expect(screen.getByText('Model: en_US-model | Speaker: speaker1')).toBeInTheDocument();
    expect(screen.getByText('Model: en_GB-model | Speaker: speaker2')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(
      <HistoryList
        items={[]}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    expect(screen.getByText('No history items yet')).toBeInTheDocument();
  });

  it('calls onFilterChange when filter input changes', () => {
    render(
      <HistoryList
        items={mockHistoryItems}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    const filterInput = screen.getByPlaceholderText('Filter history...');
    fireEvent.change(filterInput, { target: { value: 'test' } });
    
    expect(mockHandlers.onFilterChange).toHaveBeenCalledWith('test');
  });

  it('calls onReplay when replay button is clicked', () => {
    render(
      <HistoryList
        items={mockHistoryItems}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    const replayButtons = screen.getAllByText('Replay');
    fireEvent.click(replayButtons[0]);
    
    expect(mockHandlers.onReplay).toHaveBeenCalledWith(mockHistoryItems[0]);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(
      <HistoryList
        items={mockHistoryItems}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('1');
  });

  it('calls onClear when clear all button is clicked', () => {
    render(
      <HistoryList
        items={mockHistoryItems}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    expect(mockHandlers.onClear).toHaveBeenCalled();
  });

  it('disables clear button when no items', () => {
    render(
      <HistoryList
        items={[]}
        filterText=""
        onFilterChange={mockHandlers.onFilterChange}
        onReplay={mockHandlers.onReplay}
        onDelete={mockHandlers.onDelete}
        onClear={mockHandlers.onClear}
      />
    );
    
    const clearButton = screen.getByText('Clear All');
    expect(clearButton).toBeDisabled();
  });
});