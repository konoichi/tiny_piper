import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormError } from '../components/common/FormError';
import { describe, it, expect } from 'vitest';

describe('FormError Component', () => {
  it('renders error message when provided', () => {
    render(<FormError error="This field is required" />);
    
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('text-red-600');
  });
  
  it('applies additional className when provided', () => {
    render(<FormError error="Error message" className="custom-class" />);
    
    expect(screen.getByRole('alert')).toHaveClass('custom-class');
  });
  
  it('renders nothing when no error is provided', () => {
    const { container } = render(<FormError />);
    
    expect(container.firstChild).toBeNull();
  });
});