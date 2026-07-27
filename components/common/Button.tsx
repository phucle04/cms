import { cn } from '@/lib/utils';
import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = 'font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring',
      outline:
        'border border-input text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
      ghost:
        'text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span>Đang xử lý...</span>
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
