import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../hooks/useHistory';
import { storageService } from '../services/storageService';
import { vi } from 'vitest';

// Mock the storage service
vi.mock('../services/storageService', () => ({
  storageService: {
    getHistoryItems: vi.fn(),
    addHistoryItem: vi.fn(),
    deleteHistoryItem: vi.fn(),
    clearHistory: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

describe('useHistory', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    (storageService.getHistoryItems as jest.Mock).mockReturnValue(mockHistoryItems);
  });

  it('initializes with history items from storage', () => {
    const { result } = renderHook(() => useHistory());
    
    expect(storageService.getHistoryItems).toHaveBeenCalled();
    expect(result.current.historyItems).toEqual(mockHistoryItems);
    expect(result.current.filteredItems).toEqual(mockHistoryItems);
    expect(result.current.filterText).toBe('');
  });

  it('filters history items based on filter text', () => {
    const { result } = renderHook(() => useHistory());
    
    act(() => {
      result.current.setFilterText('Testing');
    });
    
    expect(result.current.filterText).toBe('Testing');
    expect(result.current.filteredItems).toEqual([mockHistoryItems[1]]);
    
    act(() => {
      result.current.setFilterText('en_US');
    });
    
    expect(result.current.filteredItems).toEqual([mockHistoryItems[0]]);
    
    act(() => {
      result.current.setFilterText('');
    });
    
    expect(result.current.filteredItems).toEqual(mockHistoryItems);
  });

  it('adds a new history item', () => {
    const updatedItems = [...mockHistoryItems, {
      id: 'mock-uuid',
      text: 'New item',
      model: 'new-model',
      speaker: 'new-speaker',
      timestamp: Date.now(),
      audioUrl: 'new-audio-url',
    }];
    
    (storageService.addHistoryItem as jest.Mock).mockReturnValue(updatedItems);
    
    const { result } = renderHook(() => useHistory());
    
    act(() => {
      result.current.addHistoryItem('New item', 'new-model', 'new-speaker', 'new-audio-url');
    });
    
    expect(storageService.addHistoryItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'mock-uuid',
      text: 'New item',
      model: 'new-model',
      speaker: 'new-speaker',
      audioUrl: 'new-audio-url',
    }));
    
    expect(result.current.historyItems).toEqual(updatedItems);
  });

  it('deletes a history item', () => {
    const updatedItems = [mockHistoryItems[1]];
    (storageService.deleteHistoryItem as jest.Mock).mockReturnValue(updatedItems);
    
    const { result } = renderHook(() => useHistory());
    
    act(() => {
      result.current.deleteHistoryItem('1');
    });
    
    expect(storageService.deleteHistoryItem).toHaveBeenCalledWith('1');
    expect(result.current.historyItems).toEqual(updatedItems);
  });

  it('clears all history items', () => {
    (storageService.clearHistory as jest.Mock).mockReturnValue([]);
    
    const { result } = renderHook(() => useHistory());
    
    act(() => {
      result.current.clearHistory();
    });
    
    expect(storageService.clearHistory).toHaveBeenCalled();
    expect(result.current.historyItems).toEqual([]);
  });
});