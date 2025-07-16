import './globals.css'
import type { Metadata } from 'next'

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
    <html lang="sv">
      <body className="font-sans bg-slate-50">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
