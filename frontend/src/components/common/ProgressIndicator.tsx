import React from 'react';

interface ProgressIndicatorProps {
  progress: number;
  isIndeterminate?: boolean;
  className?: string;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'danger';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  isIndeterminate = false,
  className = '',
  label,
  showPercentage = true,
  size = 'md',
  color = 'primary',
}) => {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Size classes
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  // Color classes
  const colorClasses = {
    primary: 'bg-primary-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    danger: 'bg-red-600',
  };
  
  // Animation class for indeterminate progress
  const animationClass = isIndeterminate ? 'animate-pulse' : '';
  
  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && !isIndeterminate && (
            <span className="text-sm font-medium text-gray-500">{Math.round(normalizedProgress)}%</span>
          )}
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full ${animationClass}`}
          style={{ width: isIndeterminate ? '100%' : `${normalizedProgress}%` }}
          role="progressbar"
          aria-valuenow={isIndeterminate ? undefined : normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};