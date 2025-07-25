import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

// Define custom error types for better error handling
export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, any>;
  
  constructor(message: string, status?: number, code?: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthenticationError';
  }
}

// Base API configuration
const apiClient = axios.create({
  baseURL: '/api', // Base URL for all API requests
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle specific error cases
    if (error.response) {
      // Server responded with an error status
      const status = error.response.status;
      
      if (status === 401) {
        // Unauthorized - clear token and redirect to login if needed
        localStorage.removeItem('auth_token');
        return Promise.reject(new AuthenticationError('Authentication failed. Please log in again.'));
      }
      
      // Extract error message from response if available
      const { message, code, details } = extractErrorInfo(error.response);
      return Promise.reject(new ApiError(message, status, code, details));
    } else if (error.request) {
      // Request was made but no response received
      return Promise.reject(new NetworkError('No response received from server. Please check your connection.'));
    } else {
      // Error in setting up the request
      return Promise.reject(new Error(`Request failed: ${error.message}`));
    }
  }
);

/**
 * Extract error information from API response
 */
function extractErrorInfo(response: AxiosResponse): { 
  message: string; 
  code?: string;
  details?: Record<string, any>;
} {
  try {
    const data = response.data;
    
    // Check for structured error format
    if (data.error) {
      return {
        message: data.error.message || `Error: ${response.status} ${response.statusText}`,
        code: data.error.code,
        details: data.error.details
      };
    }
    
    // Check for simple message format
    if (data.message) {
      return {
        message: data.message,
        code: data.code
      };
    }
    
    // Fallback to status text
    return {
      message: `Error: ${response.status} ${response.statusText}`
    };
  } catch (e) {
    return {
      message: `Error: ${response.status} ${response.statusText}`
    };
  }
}

/**
 * Generic API request function with retry capability
 */
export async function apiRequest<T>(
  config: AxiosRequestConfig,
  retries = 3,
  retryDelay = 1000
): Promise<T> {
  try {
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry with exponential backoff
      return apiRequest<T>(
        config,
        retries - 1,
        retryDelay * 2
      );
    }
    throw error;
  }
}

/**
 * Determine if a request should be retried based on the error
 */
function shouldRetry(error: any): boolean {
  // Don't retry client errors (4xx) except for 429 (too many requests)
  if (error.response) {
    const status = error.response.status;
    if (status === 429) return true;
    if (status >= 400 && status < 500) return false;
  }
  
  // Retry server errors and network issues
  return true;
}

/**
 * API service with methods for different endpoints
 */
export const apiService = {
  /**
   * Get available TTS models
   */
  getModels: () => {
    return apiRequest<any[]>({
      method: 'GET',
      url: '/models',
    });
  },
  
  /**
   * Generate speech from text
   */
  generateSpeech: (request: any) => {
    return apiRequest<any>({
      method: 'POST',
      url: '/tts',
      data: request,
    });
  },
  
  /**
   * Fetch audio file as blob
   */
  fetchAudioBlob: async (url: string): Promise<Blob> => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error fetching audio blob:', error);
      throw error instanceof Error 
        ? error 
        : new Error('An unknown error occurred while fetching audio');
    }
  },
  
  /**
   * Get server health status
   */
  getServerStatus: () => {
    return apiRequest<any>({
      method: 'GET',
      url: '/health',
    });
  }
};