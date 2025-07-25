import React, { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';
import { ToastVariant } from '../components/common/Toast';
import { ToastContainer } from '../components/common/ToastContainer';

interface ToastContextType {
  toasts: Array<{
    id: string;
    message: string;
    variant: ToastVariant;
    duration?: number;
  }>;
  addToast: (message: string, variant?: ToastVariant, duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toastMethods = useToast();

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <ToastContainer toasts={toastMethods.toasts} onClose={toastMethods.removeToast} />
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};