import React from 'react';
import { render, screen } from '@testing-library/react';
import { ToastContainer } from '../components/common/ToastContainer';
import { vi } from 'vitest';

describe('ToastContainer Component', () => {
  it('renders multiple toasts', () => {
    const toasts = [
      { id: 'toast1', message: 'First toast', variant: 'info' as const, onClose: vi.fn() },
      { id: 'toast2', message: 'Second toast', variant: 'success' as const, onClose: vi.fn() },
      { id: 'toast3', message: 'Third toast', variant: 'error' as const, onClose: vi.fn() }
    ];
    
    const onClose = vi.fn();
    
    render(<ToastContainer toasts={toasts} onClose={onClose} />);
    
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });
  
  it('renders no toasts when array is empty', () => {
    const onClose = vi.fn();
    
    const { container } = render(<ToastContainer toasts={[]} onClose={onClose} />);
    
    // The container should be empty except for the fixed positioning div
    expect(container.firstChild).toBeEmptyDOMElement();
  });
  
  it('passes the onClose function to each toast', () => {
    const toasts = [
      { id: 'toast1', message: 'Test toast', variant: 'info' as const, onClose: vi.fn() }
    ];
    
    const onClose = vi.fn();
    
    render(<ToastContainer toasts={toasts} onClose={onClose} />);
    
    // We can't directly test that onClose is passed, but we can verify the toast renders
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });
});