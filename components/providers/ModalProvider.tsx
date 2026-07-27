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
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            boxShadow: 'var(--shadow-dropdown)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          },
          success: {
            style: {
              background: 'var(--success-muted)',
              color: 'var(--success-muted-foreground)',
            },
            iconTheme: {
              primary: 'var(--success)',
              secondary: 'var(--success-muted)',
            },
          },
          error: {
            style: {
              background: 'var(--destructive-muted)',
              color: 'var(--destructive-muted-foreground)',
            },
            iconTheme: {
              primary: 'var(--destructive)',
              secondary: 'var(--destructive-muted)',
            },
          },
        }}
      />
    </>
  );
}
