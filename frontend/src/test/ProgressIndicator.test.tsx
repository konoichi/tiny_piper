import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from '../components/common/ProgressIndicator';
import { describe, it, expect } from 'vitest';

describe('ProgressIndicator Component', () => {
  it('renders correctly with default props', () => {
    render(<ProgressIndicator progress={50} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
  
  it('shows label when provided', () => {
    render(<ProgressIndicator progress={50} label="Processing" />);
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });
  
  it('hides percentage when showPercentage is false', () => {
    render(<ProgressIndicator progress={50} showPercentage={false} />);
    
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
  
  it('renders indeterminate progress bar correctly', () => {
    render(<ProgressIndicator progress={50} isIndeterminate />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).not.toHaveAttribute('aria-valuenow');
    expect(progressBar).toHaveClass('animate-pulse');
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
  
  it('applies different sizes correctly', () => {
    const { rerender } = render(<ProgressIndicator progress={50} size="sm" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-1');
    
    rerender(<ProgressIndicator progress={50} size="md" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-2');
    
    rerender(<ProgressIndicator progress={50} size="lg" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-3');
  });
  
  it('applies different colors correctly', () => {
    const { rerender } = render(<ProgressIndicator progress={50} color="primary" />);
    expect(screen.getByRole('progressbar')).toHaveClass('bg-primary-600');
    
    rerender(<ProgressIndicator progress={50} color="secondary" />);
    expect(screen.getByRole('progressbar')).toHaveClass('bg-gray-600');
    
    rerender(<ProgressIndicator progress={50} color="success" />);
    expect(screen.getByRole('progressbar')).toHaveClass('bg-green-600');
    
    rerender(<ProgressIndicator progress={50} color="danger" />);
    expect(screen.getByRole('progressbar')).toHaveClass('bg-red-600');
  });
  
  it('normalizes progress values outside 0-100 range', () => {
    const { rerender } = render(<ProgressIndicator progress={-10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    rerender(<ProgressIndicator progress={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});