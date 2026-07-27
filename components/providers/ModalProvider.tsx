'use client';

import { Toaster } from 'react-hot-toast';

export function ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#ffffff',
            color: '#000000',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderRadius: '8px',
            padding: '16px',
          },
          success: {
            style: {
              background: '#ecfdf5',
              color: '#065f46',
            },
            iconTheme: {
              primary: '#10b981',
              secondary: '#ecfdf5',
            },
          },
          error: {
            style: {
              background: '#fef2f2',
              color: '#991b1b',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fef2f2',
            },
          },
        }}
      />
    </>
  );
}
