import React from 'react';
import { HistoryItem } from '../../types';
import { Button } from '../common/Button';

interface HistoryListProps {
  items: HistoryItem[];
  filterText: string;
  onFilterChange: (text: string) => void;
  onReplay: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  items,
  filterText,
  onFilterChange,
  onReplay,
  onDelete,
  onClear
}) => {
  // Format timestamp to readable date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Truncate text if it's too long
  const truncateText = (text: string, maxLength: number = 50): string => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">History</h2>
        <Button 
          onClick={onClear} 
          variant="danger" 
          size="sm"
          disabled={items.length === 0}
        >
          Clear All
        </Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter history..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No history items yet
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="p-3 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{truncateText(item.text)}</p>
                  <p className="text-sm text-gray-600">
                    Model: {item.model} | Speaker: {item.speaker}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => onReplay(item)} 
                    variant="primary" 
                    size="sm"
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                      </svg>
                    }
                  >
                    Replay
                  </Button>
                  <Button 
                    onClick={() => onDelete(item.id)} 
                    variant="outline" 
                    size="sm"
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                      </svg>
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};