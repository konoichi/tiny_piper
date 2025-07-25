import React, { useState, useCallback } from 'react';
import DOMPurify from 'dompurify';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  maxLength = 500,
  placeholder = 'Enter text to convert to speech...',
  disabled = false,
  className = '',
  rows = 4,
  label,
  error,
  helperText,
  required = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  // Sanitize input to prevent XSS
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitizedValue = DOMPurify.sanitize(e.target.value);
    onChange(sanitizedValue);
  }, [onChange]);

  const characterCount = value.length;
  const isOverLimit = maxLength > 0 && characterCount > maxLength;
  
  const borderClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : isFocused
      ? 'border-primary-500 focus:border-primary-500 focus:ring-primary-500'
      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          id="text-input"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`block w-full rounded-md shadow-sm py-2 px-3 ${borderClasses} 
            disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
            resize-y transition-colors focus:outline-none`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'text-input-error' : helperText ? 'text-input-helper' : undefined}
        />
        
        <div className="flex justify-between items-center mt-1">
          {(error || helperText) && (
            <div className="text-sm">
              {error ? (
                <p id="text-input-error" className="text-red-600">{error}</p>
              ) : helperText ? (
                <p id="text-input-helper" className="text-gray-500">{helperText}</p>
              ) : null}
            </div>
          )}
          
          <div className={`text-sm ml-auto ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {characterCount}/{maxLength}
          </div>
        </div>
      </div>
    </div>
  );
};