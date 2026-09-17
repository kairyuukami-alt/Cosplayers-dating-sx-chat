import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cosplay Match',
  description: '18+ cosplay dating, matching and private chat.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
