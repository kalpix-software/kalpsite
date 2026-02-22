import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Kalpix Games',
  description: 'Privacy Policy for Kalpix Games and Kalpix Software Private Limited. How we collect, use, and protect your information.',
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
