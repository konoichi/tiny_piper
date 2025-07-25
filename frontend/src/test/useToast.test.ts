import { renderHook, act } from '@testing-library/react';
import { useToast } from '../hooks/useToast';
import { vi } from 'vitest';

describe('useToast Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock Date.now to return a consistent value for testing
    const mockDateNow = vi.spyOn(Date, 'now');
    mockDateNow.mockReturnValue(1234567890);
    
    // Mock Math.random to return a consistent value for testing
    const mockMathRandom = vi.spyOn(Math, 'random');
    mockMathRandom.mockReturnValue(0.123456789);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  it('initializes with an empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });
  
  it('adds a toast with addToast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.addToast('Test message');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 'toast-1234567890-4fzyo8rcg',
      message: 'Test message',
      variant: 'info',
      duration: 5000
    });
  });
  
  it('removes a toast with removeToast', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      toastId = result.current.addToast('Test message');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    
    act(() => {
      result.current.removeToast(toastId);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });
  
  it('clears all toasts with clearToasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.addToast('First message');
      result.current.addToast('Second message');
      result.current.addToast('Third message');
    });
    
    expect(result.current.toasts).toHaveLength(3);
    
    act(() => {
      result.current.clearToasts();
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });
  
  it('adds toasts with different variants', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showSuccess('Success message');
      result.current.showError('Error message');
      result.current.showWarning('Warning message');
      result.current.showInfo('Info message');
    });
    
    expect(result.current.toasts).toHaveLength(4);
    expect(result.current.toasts[0].variant).toBe('success');
    expect(result.current.toasts[1].variant).toBe('error');
    expect(result.current.toasts[2].variant).toBe('warning');
    expect(result.current.toasts[3].variant).toBe('info');
  });
  
  it('allows custom duration for toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.addToast('Custom duration', 'info', 10000);
    });
    
    expect(result.current.toasts[0].duration).toBe(10000);
  });
});