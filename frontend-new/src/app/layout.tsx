import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HealSync',
  description: 'Multi-agent health decision system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
