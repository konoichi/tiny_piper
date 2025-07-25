import { useState, useCallback } from 'react';
import { ToastVariant } from '../components/common/Toast';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info', duration: number = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, message, variant, duration };
    
    setToasts((prevToasts) => [...prevToasts, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods for different toast types
  const showSuccess = useCallback((message: string, duration?: number) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};