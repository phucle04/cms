import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ModalProvider } from '@/components/providers/ModalProvider'

export const metadata: Metadata = {
  title: 'Content Management System',
  description: 'Comprehensive CMS for content production workflow',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 dark:bg-gray-900">
        <ModalProvider>
          <AppProvider>
            <Sidebar />
            <Header />
            <main className="lg:ml-64 pt-16 min-h-screen">
              {children}
            </main>
            {process.env.NODE_ENV === 'production' && <Analytics />}
          </AppProvider>
        </ModalProvider>
      </body>
    </html>
  )
}
