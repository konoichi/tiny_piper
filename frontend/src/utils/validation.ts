/**
 * Validation utility functions for form validation
 */

/**
 * Validates text input with configurable constraints
 */
export function validateText(
  text: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: string) => string | undefined;
  } = {}
): string | undefined {
  const { required = false, minLength, maxLength, pattern, customValidator } = options;
  
  // Check if required
  if (required && (!text || text.trim() === '')) {
    return 'This field is required';
  }
  
  // Skip other validations if empty and not required
  if (!text || text.trim() === '') {
    return undefined;
  }
  
  // Check min length
  if (minLength !== undefined && text.length < minLength) {
    return `Must be at least ${minLength} characters`;
  }
  
  // Check max length
  if (maxLength !== undefined && text.length > maxLength) {
    return `Must be ${maxLength} characters or less`;
  }
  
  // Check pattern
  if (pattern && !pattern.test(text)) {
    return 'Invalid format';
  }
  
  // Run custom validator if provided
  if (customValidator) {
    return customValidator(text);
  }
  
  return undefined;
}

/**
 * Validates a selection from a list of options
 */
export function validateSelection(
  value: string,
  options: {
    required?: boolean;
    allowedValues?: string[];
    customValidator?: (value: string) => string | undefined;
  } = {}
): string | undefined {
  const { required = false, allowedValues, customValidator } = options;
  
  // Check if required
  if (required && (!value || value.trim() === '')) {
    return 'Please make a selection';
  }
  
  // Skip other validations if empty and not required
  if (!value || value.trim() === '') {
    return undefined;
  }
  
  // Check if value is in allowed values
  if (allowedValues && !allowedValues.includes(value)) {
    return 'Invalid selection';
  }
  
  // Run custom validator if provided
  if (customValidator) {
    return customValidator(value);
  }
  
  return undefined;
}

/**
 * Sanitizes text input to prevent XSS attacks
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates a form validator that can validate multiple fields
 */
export function createFormValidator<T extends Record<string, any>>(
  validationRules: {
    [K in keyof T]?: (value: T[K]) => string | undefined;
  }
) {
  return (values: T): { [K in keyof T]?: string } => {
    const errors: Partial<Record<keyof T, string>> = {};
    
    for (const key in validationRules) {
      if (Object.prototype.hasOwnProperty.call(validationRules, key)) {
        const validator = validationRules[key];
        if (validator) {
          const error = validator(values[key]);
          if (error) {
            errors[key] = error;
          }
        }
      }
    }
    
    return errors;
  };
}