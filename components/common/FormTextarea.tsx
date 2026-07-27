'use client';

import React from 'react';
import { FieldError } from 'react-hook-form';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: FieldError;
  helperText?: string;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-24 ${
            error ? 'border-red-500 dark:border-red-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>}
        {helperText && <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';
