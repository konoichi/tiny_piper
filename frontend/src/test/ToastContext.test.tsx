import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToastContext } from '../contexts/ToastContext';
import { describe, it, expect, vi } from 'vitest';

// Test component that uses the toast context
const TestComponent = () => {
  const { showSuccess, showError, showWarning, showInfo, clearToasts } = useToastContext();
  
  return (
    <div>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showError('Error message')}>Show Error</button>
      <button onClick={() => showWarning('Warning message')}>Show Warning</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
      <button onClick={clearToasts}>Clear Toasts</button>
    </div>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('provides toast methods to children', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    expect(screen.getByText('Show Success')).toBeInTheDocument();
    expect(screen.getByText('Show Error')).toBeInTheDocument();
    expect(screen.getByText('Show Warning')).toBeInTheDocument();
    expect(screen.getByText('Show Info')).toBeInTheDocument();
  });
  
  it('shows success toast when showSuccess is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Success'));
    
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50');
  });
  
  it('shows error toast when showError is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Error'));
    
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');
  });
  
  it('shows warning toast when showWarning is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Warning'));
    
    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50');
  });
  
  it('shows info toast when showInfo is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Info'));
    
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');
  });
  
  it('clears all toasts when clearToasts is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    // Add multiple toasts
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    
    // Verify toasts are shown
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
    
    // Clear toasts
    fireEvent.click(screen.getByText('Clear Toasts'));
    
    // Verify toasts are removed
    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });
  
  it('automatically removes toast after duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Info'));
    
    expect(screen.getByText('Info message')).toBeInTheDocument();
    
    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5000); // Default duration
    });
    
    // Allow animation to complete
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(screen.queryByText('Info message')).not.toBeInTheDocument();
  });
  
  it('throws error when used outside of ToastProvider', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToastContext must be used within a ToastProvider');
    
    consoleErrorSpy.mockRestore();
  });
});