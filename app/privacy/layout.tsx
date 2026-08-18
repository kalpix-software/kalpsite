import type { Metadata } from 'next'
import { APP, COMPANY } from '@/lib/company'

export const metadata: Metadata = {
	title: `Privacy Policy | ${APP.name}`,
	description: `How ${COMPANY.legalName} collects, uses, shares and protects your personal data in ${APP.name}: what we hold and why, who we share it with, push notifications, the decisions our systems make automatically, your rights under India's DPDP Act 2023, and what deleting your account does and does not reach.`,
}

export default function PrivacyLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
