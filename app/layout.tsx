import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kalpix Games - Social Gaming Platform | Kalpix Software Private Limited',
  description: 'Play Tero Card, Puzzle Master, and more. Kalpix Games is the social gaming platform by Kalpix Software Private Limited. Play, connect, and compete with friends.',
  keywords: 'Kalpix Games, social gaming, multiplayer games, Tero Card, Puzzle Master, Kalpix Software Private Limited',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
