import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from '../components/common/Toast';
import { vi } from 'vitest';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with the correct message and variant', () => {
    const onClose = vi.fn();
    render(
      <Toast 
        id="test-toast" 
        message="Test message" 
        variant="success" 
        onClose={onClose} 
      />
    );
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Toast 
        id="test-toast" 
        message="Test message" 
        onClose={onClose} 
      />
    );
    
    fireEvent.click(screen.getByRole('button'));
    
    // Allow animation to complete
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(onClose).toHaveBeenCalledWith('test-toast');
  });

  it('automatically closes after duration', () => {
    const onClose = vi.fn();
    render(
      <Toast 
        id="test-toast" 
        message="Test message" 
        duration={2000}
        onClose={onClose} 
      />
    );
    
    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    // Allow animation to complete
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(onClose).toHaveBeenCalledWith('test-toast');
  });

  it('renders different variants with correct styling', () => {
    const onClose = vi.fn();
    
    const { rerender } = render(
      <Toast 
        id="test-toast" 
        message="Info message" 
        variant="info"
        onClose={onClose} 
      />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');
    
    rerender(
      <Toast 
        id="test-toast" 
        message="Warning message" 
        variant="warning"
        onClose={onClose} 
      />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50');
    
    rerender(
      <Toast 
        id="test-toast" 
        message="Error message" 
        variant="error"
        onClose={onClose} 
      />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');
  });
});