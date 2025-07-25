import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useModels } from '../hooks/useModels';
import { apiService } from '../services/apiService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the API service
vi.mock('../services/apiService', () => ({
  apiService: {
    getModels: vi.fn()
  }
}));

// Create a wrapper for the React Query provider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return models data when API call is successful', async () => {
    const mockModels = [
      {
        id: 'model1',
        name: 'Model 1',
        speakers: [
          { id: 'speaker1', name: 'Speaker 1' },
          { id: 'speaker2', name: 'Speaker 2' }
        ],
        hasModelCard: true,
        hasDemo: false
      },
      {
        id: 'model2',
        name: 'Model 2',
        speakers: [
          { id: 'speaker3', name: 'Speaker 3' }
        ],
        hasModelCard: false,
        hasDemo: true
      }
    ];
    
    // Mock the API response
    (apiService.getModels as any).mockResolvedValue(mockModels);
    
    // Render the hook with the React Query provider
    const { result } = renderHook(() => useModels(), {
      wrapper: createWrapper()
    });
    
    // Initially, it should be loading with empty models array
    expect(result.current.isLoading).toBe(true);
    expect(result.current.models).toEqual([]);
    
    // Wait for the query to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    // Check the final state
    expect(result.current.models).toEqual(mockModels);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(apiService.getModels).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors correctly', async () => {
    const mockError = new Error('Failed to fetch models');
    
    // Mock the API to throw an error
    (apiService.getModels as any).mockRejectedValue(mockError);
    
    // Render the hook with the React Query provider
    const { result } = renderHook(() => useModels(), {
      wrapper: createWrapper()
    });
    
    // Wait for the query to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    // Check the error state
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
    expect(result.current.models).toEqual([]);
  });
});