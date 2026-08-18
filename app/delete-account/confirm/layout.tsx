import type { Metadata } from 'next'
import { APP } from '@/lib/company'

export const metadata: Metadata = {
	title: `Confirm account deletion | ${APP.name}`,
	description: `Confirm deletion of your ${APP.name} account.`,
	robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
	return children
}
