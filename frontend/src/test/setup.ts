import '@testing-library/jest-dom';

// Mock for ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};