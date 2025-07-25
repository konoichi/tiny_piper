import React from 'react';

interface FormErrorProps {
  error?: string;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ error, className = '' }) => {
  if (!error) return null;
  
  return (
    <div className={`text-sm text-red-600 mt-1 ${className}`} role="alert">
      {error}
    </div>
  );
};