import { useState, useEffect, useCallback } from 'react';
import { Model } from '../types';

interface UseVoicesResult {
  models: Model[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useVoices = (): UseVoicesResult => {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/voices');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform API response to our Model type
      const transformedModels: Model[] = Object.entries(data).map(([id, modelData]: [string, any]) => {
        return {
          id,
          name: id, // Use ID as name if no name provided
          speakers: modelData.speakers.map((speaker: any) => ({
            id: speaker.id,
            name: speaker.id // Use ID as name if no name provided
          })),
          hasModelCard: !!modelData.model_card,
          hasDemo: !!modelData.demo
        };
      });

      setModels(transformedModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching voices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch voices on component mount
  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  return {
    models,
    isLoading,
    error,
    refetch: fetchVoices
  };
};