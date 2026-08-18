import type { Metadata } from 'next'
import { APP, COMPANY } from '@/lib/company'

export const metadata: Metadata = {
	title: `Terms of Service | ${APP.name}`,
	description: `The agreement between you and ${COMPANY.legalName} for the ${APP.name} app: eligibility, accounts, acceptable use, coins and gems, purchases, and how disputes are handled under Indian law.`,
}

export default function TermsLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
