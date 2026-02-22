import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us | Kalpix Games',
  description: 'Contact Kalpix Software Private Limited. Email: contact@kalpixgames.com. Registered office in Varanasi, Uttar Pradesh.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
