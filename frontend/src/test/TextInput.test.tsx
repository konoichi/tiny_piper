import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from '../components/text/TextInput';
import { describe, it, expect, vi } from 'vitest';

describe('TextInput Component', () => {
  it('renders correctly with default props', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} />);
    
    const textareaElement = screen.getByPlaceholderText('Enter text to convert to speech...');
    expect(textareaElement).toBeInTheDocument();
    
    // Check character counter
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });
  
  it('shows label when provided', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} label="Test Label" />);
    
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });
  
  it('shows required indicator when required is true', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} label="Test Label" required />);
    
    const label = screen.getByText('Test Label');
    expect(label.parentElement).toContainHTML('*');
  });
  
  it('shows error message when provided', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} error="This is an error" />);
    
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });
  
  it('shows helper text when provided and no error', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} helperText="This is helper text" />);
    
    expect(screen.getByText('This is helper text')).toBeInTheDocument();
  });
  
  it('prioritizes error over helper text', () => {
    const handleChange = vi.fn();
    render(
      <TextInput 
        value="" 
        onChange={handleChange} 
        error="This is an error" 
        helperText="This is helper text" 
      />
    );
    
    expect(screen.getByText('This is an error')).toBeInTheDocument();
    expect(screen.queryByText('This is helper text')).not.toBeInTheDocument();
  });
  
  it('calls onChange with sanitized value when text is entered', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} />);
    
    const textareaElement = screen.getByPlaceholderText('Enter text to convert to speech...');
    fireEvent.change(textareaElement, { target: { value: 'Hello world' } });
    
    expect(handleChange).toHaveBeenCalledWith('Hello world');
  });
  
  it('shows character count in red when over limit', () => {
    const handleChange = vi.fn();
    const longText = 'a'.repeat(501);
    render(<TextInput value={longText} onChange={handleChange} maxLength={500} />);
    
    const counter = screen.getByText('501/500');
    expect(counter).toHaveClass('text-red-600');
  });
  
  it('disables the textarea when disabled prop is true', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} disabled />);
    
    const textareaElement = screen.getByPlaceholderText('Enter text to convert to speech...');
    expect(textareaElement).toBeDisabled();
  });
});