import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 p-4 border-t border-gray-200 mt-8">
      <div className="container mx-auto text-center text-gray-600">
        <p>
          TTS Server v0.1.0 | 
          <a href="/docs" className="text-primary-600 hover:underline ml-2">
            Documentation
          </a>
        </p>
      </div>
    </footer>
  );
};