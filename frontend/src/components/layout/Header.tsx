import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-primary-700 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">TTS Server</h1>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <a href="/" className="hover:text-primary-200 transition-colors">
                Home
              </a>
            </li>
            <li>
              <a href="/docs" className="hover:text-primary-200 transition-colors">
                Documentation
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};