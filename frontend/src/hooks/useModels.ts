import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { Model } from '../types';

/**
 * Hook for fetching and managing TTS models
 */
export const useModels = () => {
  const {
    data: models = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<Model[]>({
    queryKey: ['models'],
    queryFn: () => apiService.getModels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt > 1 ? 2 ** attempt * 1000 : 1000, 30 * 1000),
    onError: (error) => {
      console.error('Error fetching models:', error);
    }
  });

  return {
    models,
    isLoading,
    isError,
    error,
    refetch
  };
};