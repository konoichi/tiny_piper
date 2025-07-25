import { HistoryItem } from '../types';

const HISTORY_STORAGE_KEY = 'tts-history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Service for managing local storage operations
 */
export const storageService = {
  /**
   * Get all history items from local storage
   * @returns Array of history items
   */
  getHistoryItems: (): HistoryItem[] => {
    try {
      const storedItems = localStorage.getItem(HISTORY_STORAGE_KEY);
      return storedItems ? JSON.parse(storedItems) : [];
    } catch (error) {
      console.error('Error retrieving history from local storage:', error);
      return [];
    }
  },

  /**
   * Add a new history item to local storage
   * @param item The history item to add
   * @returns Updated array of history items
   */
  addHistoryItem: (item: HistoryItem): HistoryItem[] => {
    try {
      // Get current items
      const currentItems = storageService.getHistoryItems();
      
      // Add new item at the beginning
      const updatedItems = [item, ...currentItems];
      
      // Limit to max items
      const limitedItems = updatedItems.slice(0, MAX_HISTORY_ITEMS);
      
      // Save to local storage
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limitedItems));
      
      return limitedItems;
    } catch (error) {
      console.error('Error adding history item to local storage:', error);
      return storageService.getHistoryItems();
    }
  },

  /**
   * Delete a history item from local storage
   * @param id The ID of the item to delete
   * @returns Updated array of history items
   */
  deleteHistoryItem: (id: string): HistoryItem[] => {
    try {
      // Get current items
      const currentItems = storageService.getHistoryItems();
      
      // Filter out the item to delete
      const updatedItems = currentItems.filter(item => item.id !== id);
      
      // Save to local storage
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedItems));
      
      return updatedItems;
    } catch (error) {
      console.error('Error deleting history item from local storage:', error);
      return storageService.getHistoryItems();
    }
  },

  /**
   * Clear all history items from local storage
   * @returns Empty array
   */
  clearHistory: (): HistoryItem[] => {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return [];
    } catch (error) {
      console.error('Error clearing history from local storage:', error);
      return storageService.getHistoryItems();
    }
  }
};