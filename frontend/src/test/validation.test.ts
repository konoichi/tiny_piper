import { describe, it, expect } from 'vitest';
import { validateText, validateSelection, sanitizeText, createFormValidator } from '../utils/validation';

describe('Validation Utilities', () => {
  describe('validateText', () => {
    it('should return undefined for valid text', () => {
      expect(validateText('Valid text')).toBeUndefined();
    });
    
    it('should validate required text', () => {
      expect(validateText('', { required: true })).toBe('This field is required');
      expect(validateText('  ', { required: true })).toBe('This field is required');
      expect(validateText('Text', { required: true })).toBeUndefined();
    });
    
    it('should validate minimum length', () => {
      expect(validateText('abc', { minLength: 5 })).toBe('Must be at least 5 characters');
      expect(validateText('abcdef', { minLength: 5 })).toBeUndefined();
    });
    
    it('should validate maximum length', () => {
      expect(validateText('abcdefghij', { maxLength: 5 })).toBe('Must be 5 characters or less');
      expect(validateText('abc', { maxLength: 5 })).toBeUndefined();
    });
    
    it('should validate against pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(validateText('not-an-email', { pattern: emailPattern })).toBe('Invalid format');
      expect(validateText('valid@email.com', { pattern: emailPattern })).toBeUndefined();
    });
    
    it('should use custom validator', () => {
      const customValidator = (value: string) => {
        return value === 'allowed' ? undefined : 'Only "allowed" is allowed';
      };
      
      expect(validateText('not-allowed', { customValidator })).toBe('Only "allowed" is allowed');
      expect(validateText('allowed', { customValidator })).toBeUndefined();
    });
  });
  
  describe('validateSelection', () => {
    it('should return undefined for valid selection', () => {
      expect(validateSelection('option1')).toBeUndefined();
    });
    
    it('should validate required selection', () => {
      expect(validateSelection('', { required: true })).toBe('Please make a selection');
      expect(validateSelection('option1', { required: true })).toBeUndefined();
    });
    
    it('should validate against allowed values', () => {
      const allowedValues = ['option1', 'option2', 'option3'];
      expect(validateSelection('option4', { allowedValues })).toBe('Invalid selection');
      expect(validateSelection('option2', { allowedValues })).toBeUndefined();
    });
    
    it('should use custom validator', () => {
      const customValidator = (value: string) => {
        return value.startsWith('valid-') ? undefined : 'Must start with "valid-"';
      };
      
      expect(validateSelection('invalid', { customValidator })).toBe('Must start with "valid-"');
      expect(validateSelection('valid-option', { customValidator })).toBeUndefined();
    });
  });
  
  describe('sanitizeText', () => {
    it('should sanitize HTML tags and quotes', () => {
      expect(sanitizeText('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(sanitizeText("Don't <b>do</b> that")).toBe('Don&#039;t &lt;b&gt;do&lt;/b&gt; that');
    });
    
    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(undefined as unknown as string)).toBe('');
    });
  });
  
  describe('createFormValidator', () => {
    interface TestForm {
      name: string;
      email: string;
      age: number;
    }
    
    const validator = createFormValidator<TestForm>({
      name: (value) => !value ? 'Name is required' : undefined,
      email: (value) => {
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        return undefined;
      },
      age: (value) => {
        if (value < 18) return 'Must be 18 or older';
        return undefined;
      }
    });
    
    it('should validate multiple fields', () => {
      const result = validator({
        name: '',
        email: 'invalid-email',
        age: 16
      });
      
      expect(result).toEqual({
        name: 'Name is required',
        email: 'Invalid email format',
        age: 'Must be 18 or older'
      });
    });
    
    it('should return only invalid fields', () => {
      const result = validator({
        name: 'John Doe',
        email: 'invalid-email',
        age: 25
      });
      
      expect(result).toEqual({
        email: 'Invalid email format'
      });
    });
    
    it('should return empty object for valid form', () => {
      const result = validator({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      });
      
      expect(result).toEqual({});
    });
  });
});