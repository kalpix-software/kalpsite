'use client'

import { useState } from 'react'

/**
 * The web account-deletion request form. Collects the account email and asks
 * the backend to send a one-time confirm link to it. The response is always
 * neutral, so the form never reveals whether an email is registered — it just
 * tells the user to check their inbox.
 */
export default function DeleteAccountForm() {
	const [email, setEmail] = useState('')
	const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email.includes('@') || state === 'sending') return
		setState('sending')
		try {
			await fetch('/api/deletion/request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			})
		} finally {
			// Always land on "sent": the neutral response is the whole point.
			setState('sent')
		}
	}

	if (state === 'sent') {
		return (
			<div className="rounded-2xl border border-green-600/40 bg-green-500/10 p-6">
				<p className="text-green-100 font-semibold mb-1">Check your email</p>
				<p className="text-gray-300 text-sm leading-relaxed">
					If <span className="text-white">{email}</span> belongs to a Plak account,
					we have sent it a link to confirm deletion. The link expires in one hour.
					Open it to start the 14-day grace period. If you do not see the email,
					check your spam folder.
				</p>
			</div>
		)
	}

	return (
		<form
			onSubmit={onSubmit}
			className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6"
		>
			<label htmlFor="del-email" className="block text-white font-semibold mb-2">
				Request account deletion
			</label>
			<p className="text-gray-400 text-sm mb-4 leading-relaxed">
				Enter the email address on your Plak account. We will send a confirmation
				link to that address; only opening it starts the deletion, so nobody else
				can delete your account.
			</p>
			<div className="flex flex-col sm:flex-row gap-3">
				<input
					id="del-email"
					type="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@example.com"
					className="flex-1 rounded-xl bg-slate-900 border border-slate-600 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
				/>
				<button
					type="submit"
					disabled={state === 'sending' || !email.includes('@')}
					className="rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 text-white font-semibold transition-colors"
				>
					{state === 'sending' ? 'Sending…' : 'Send confirmation link'}
				</button>
			</div>
		</form>
	)
}
