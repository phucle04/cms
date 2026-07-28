import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import { AppShell } from '@/components/layout/AppShell'
import { ModalProvider } from '@/components/providers/ModalProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Hệ thống quản lý nội dung',
    template: '%s | Hệ thống quản lý nội dung',
  },
  description: 'Hệ thống sản xuất nội dung: sản phẩm, nghiên cứu TikTok, ý tưởng, kịch bản',
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
    <html lang="vi" className={beVietnamPro.variable} suppressHydrationWarning>
      <body className="antialiased font-sans bg-background text-foreground">
        <ThemeProvider>
          <ModalProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
              {process.env.NODE_ENV === 'production' && <Analytics />}
            </AppProvider>
          </ModalProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
