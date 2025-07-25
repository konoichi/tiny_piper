import { useState, useEffect, useCallback } from 'react';
import { HistoryItem } from '../types';
import { storageService } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

interface UseHistoryResult {
  historyItems: HistoryItem[];
  filteredItems: HistoryItem[];
  filterText: string;
  setFilterText: (text: string) => void;
  addHistoryItem: (text: string, model: string, speaker: string, audioUrl: string) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
}

/**
 * Hook for managing TTS history
 */
export const useHistory = (): UseHistoryResult => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  
  // Load history items from local storage on mount
  useEffect(() => {
    const items = storageService.getHistoryItems();
    setHistoryItems(items);
  }, []);
  
  // Filter history items based on filter text
  const filteredItems = historyItems.filter(item => {
    if (!filterText) return true;
    
    const lowerFilter = filterText.toLowerCase();
    return (
      item.text.toLowerCase().includes(lowerFilter) ||
      item.model.toLowerCase().includes(lowerFilter) ||
      item.speaker.toLowerCase().includes(lowerFilter)
    );
  });
  
  // Add a new history item
  const addHistoryItem = useCallback((text: string, model: string, speaker: string, audioUrl: string) => {
    const newItem: HistoryItem = {
      id: uuidv4(),
      text,
      model,
      speaker,
      timestamp: Date.now(),
      audioUrl
    };
    
    const updatedItems = storageService.addHistoryItem(newItem);
    setHistoryItems(updatedItems);
  }, []);
  
  // Delete a history item
  const deleteHistoryItem = useCallback((id: string) => {
    const updatedItems = storageService.deleteHistoryItem(id);
    setHistoryItems(updatedItems);
  }, []);
  
  // Clear all history
  const clearHistory = useCallback(() => {
    const emptyItems = storageService.clearHistory();
    setHistoryItems(emptyItems);
  }, []);
  
  return {
    historyItems,
    filteredItems,
    filterText,
    setFilterText,
    addHistoryItem,
    deleteHistoryItem,
    clearHistory
  };
};