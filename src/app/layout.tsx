import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '../contexts/ThemeContext'

export const metadata: Metadata = {
  title: 'Drönarkompaniet - Leveransportal',
  description: 'Säker leverans av högkvalitativa drönarbilder och filmmaterial från Drönarkompaniet',
  keywords: 'drönarkompaniet, drönarfotografering, luftfotografering, professionell fotografering, filmleverans',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" className="">
      <body className="font-sans transition-colors min-h-screen bg-slate-50 dark:bg-slate-900">
        <ThemeProvider>
          <div className="min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
