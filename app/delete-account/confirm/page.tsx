import { Suspense } from 'react'
import PublicPageLayout from '@/components/PublicPageLayout'
import FadeIn from '@/components/FadeIn'
import DeleteAccountConfirm from '@/components/DeleteAccountConfirm'

export default function DeleteAccountConfirmPage() {
	return (
		<PublicPageLayout>
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				<FadeIn>
					<h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						Confirm account deletion
					</h1>
					<Suspense fallback={<p className="text-gray-300">Loading…</p>}>
						<DeleteAccountConfirm />
					</Suspense>
				</FadeIn>
			</div>
		</PublicPageLayout>
	)
}
