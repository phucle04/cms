'use client';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-4 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin`} />
    </div>
  );
}
